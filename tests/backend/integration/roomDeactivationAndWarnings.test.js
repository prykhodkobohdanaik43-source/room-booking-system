import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus } from '../../../src/backend/modules/bookings/BookingStatus.js';
import { EMPLOYEE, EMPLOYEE_2, IT, at, createTestApp, onDay } from '../../helpers/testApp.js';

describe('деактивація кімнати скасовує броні (ФВ-26)', () => {
  let app;
  let context;
  let employee;
  let it_;

  beforeEach(async () => {
    context = await createTestApp();
    ({ app } = context);
    employee = await context.loginAs(EMPLOYEE);
    it_ = await context.loginAs(IT);
  });

  const auth = (token) => ({ Authorization: `Bearer ${token}` });
  const deactivate = (room, body) => request(app).post(`/api/rooms/${room.id}/deactivate`).set(auth(it_)).send(body);

  it('«активні» броні в періоді стають «скасованими» з причиною «деактивація кімнати»', async () => {
    const room = context.roomFor(6);
    const inside = await context.book(employee, { room, start: at(10), end: at(11) });
    const outside = await context.book(employee, { room, start: onDay(5), end: onDay(5, 11) });

    const response = await deactivate(room, { from: '2026-09-21', to: '2026-09-23' });
    expect(response.status).toBe(200);
    expect(response.body.cancelledBookings).toBe(1);

    const cancelled = await context.container.storage.bookings.findById(inside.body.id);
    expect(cancelled).toMatchObject({
      status: BookingStatus.CANCELLED,
      cancelReason: 'деактивація кімнати',
      cancelledBy: null,
    });
    const untouched = await context.container.storage.bookings.findById(outside.body.id);
    expect(untouched.status).toBe(BookingStatus.ACTIVE);
  });

  it('автор отримує лист із причиною (ФВ-25), а в журналі є запис від «системи» (ФВ-22)', async () => {
    const room = context.roomFor(6);
    await context.book(employee, { room });
    await deactivate(room, { from: '2026-09-21', to: '2026-09-21' });

    await vi.waitFor(() => expect(context.channel.sent.at(-1)).toMatchObject({ to: EMPLOYEE }));
    expect(context.channel.sent.at(-1).text).toMatch(/деактивація кімнати/);

    const entries = await context.container.services.eventLog.recent(10);
    const cancelEntry = entries.find((entry) => entry.actionType === 'BOOKING_CANCELLED');
    expect(cancelEntry).toMatchObject({ actorId: null });
    expect(cancelEntry.details.reason).toBe('деактивація кімнати');
  });

  it('підтверджені броні не чіпає (за специфікацією скасовуються лише «активні»)', async () => {
    const room = context.roomFor(6);
    const created = await context.book(employee, { room, start: at(10), end: at(11) });
    context.clock.set(at(10, 5));
    await request(app).post(`/api/bookings/${created.body.id}/confirm-arrival`).set(auth(employee)).send({});

    const response = await deactivate(room, { from: '2026-09-21', to: '2026-09-21' });
    expect(response.body.cancelledBookings).toBe(0);
    expect((await context.container.storage.bookings.findById(created.body.id)).status).toBe(BookingStatus.CONFIRMED);
  });

  it('слот скасованої броні можна забронювати в іншій кімнаті, а в цій — ні', async () => {
    const room = context.roomFor(6);
    await context.book(employee, { room });
    await deactivate(room, { from: '2026-09-21', to: '2026-09-21' });

    expect((await context.book(employee, { room })).status).toBe(422);
    expect((await context.book(employee, { room: context.roomFor(8) })).status).toBe(201);
  });
});

describe('попередження про завелику кімнату (ФВ-30)', () => {
  let app;
  let context;
  let employee;

  beforeEach(async () => {
    context = await createTestApp();
    ({ app } = context);
    employee = await context.loginAs(EMPLOYEE);
  });

  const auth = (token) => ({ Authorization: `Bearer ${token}` });
  const warn = (room, participantsCount, { start = at(10), end = at(11) } = {}) =>
    request(app)
      .post('/api/bookings/warnings')
      .set(auth(employee))
      .send({ roomId: room.id, startTime: start.toISOString(), endTime: end.toISOString(), participantsCount });

  it('кімната на 20 місць для 2 учасників за вільної кімнати на 4 — є попередження з її назвою', async () => {
    const response = await warn(context.roomFor(20), 2);
    expect(response.status).toBe(200);
    expect(response.body.warnings).toHaveLength(1);
    expect(response.body.warnings[0].code).toBe('SMALLER_ROOM_AVAILABLE');
    expect(response.body.warnings[0].message).toMatch(/Десна/);
    expect(response.body.warnings[0].rooms.map((room) => room.name)).toContain('Десна');
  });

  it('попередження не блокує бронювання — бронь після цього створюється', async () => {
    await warn(context.roomFor(20), 2);
    const created = await context.book(employee, { room: context.roomFor(20), participants: 2 });
    expect(created.status).toBe(201);
  });

  it('пропонує лише кімнати, у які вміщаються учасники', async () => {
    const response = await warn(context.roomFor(20), 10);
    expect(response.body.warnings[0].rooms.map((room) => room.name)).toEqual(['Говерла']);
  });

  it('якщо менші кімнати зайняті на цей час — попередження немає', async () => {
    for (const capacity of [4, 6, 8, 12]) {
      await context.book(employee, { room: context.roomFor(capacity), participants: 2 });
    }
    const response = await warn(context.roomFor(20), 2);
    expect(response.body.warnings).toEqual([]);
  });

  it('для найменшої кімнати попередження немає', async () => {
    expect((await warn(context.roomFor(4), 2)).body.warnings).toEqual([]);
  });

  it('не пропонує кімнату, деактивовану на цю дату', async () => {
    const it_ = await context.loginAs(IT);
    for (const capacity of [4, 6, 8, 12]) {
      await request(app)
        .post(`/api/rooms/${context.roomFor(capacity).id}/deactivate`)
        .set(auth(it_))
        .send({ from: '2026-09-21', to: '2026-09-21' });
    }
    expect((await warn(context.roomFor(20), 2)).body.warnings).toEqual([]);
  });

  it('ролі IT перевірка недоступна (ФВ-29)', async () => {
    const it_ = await context.loginAs(IT);
    const response = await request(app)
      .post('/api/bookings/warnings')
      .set(auth(it_))
      .send({ roomId: context.roomFor(20).id });
    expect(response.status).toBe(403);
  });

  it('попередження доступне будь-якому співробітнику, а не лише автору першої броні', async () => {
    const colleague = await context.loginAs(EMPLOYEE_2);
    const response = await request(app)
      .post('/api/bookings/warnings')
      .set(auth(colleague))
      .send({
        roomId: context.roomFor(20).id,
        startTime: at(10).toISOString(),
        endTime: at(11).toISOString(),
        participantsCount: 3,
      });
    expect(response.body.warnings).toHaveLength(1);
  });
});
