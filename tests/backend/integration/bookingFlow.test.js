import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { BookingStatus } from '../../../src/backend/modules/bookings/BookingStatus.js';
import { EventType } from '../../../src/backend/modules/eventlog/EventType.js';
import { EMPLOYEE, EMPLOYEE_2, OFFICE_ADMIN, at, createTestApp, onDay } from '../../helpers/testApp.js';

describe('бронювання через REST API', () => {
  let app;
  let context;
  let employee;

  beforeEach(async () => {
    context = await createTestApp();
    ({ app } = context);
    employee = await context.loginAs(EMPLOYEE);
  });

  const auth = (token) => ({ Authorization: `Bearer ${token}` });

  it('Сценарій 1: бронь створюється і слот стає зайнятим (ФВ-04, ФВ-02)', async () => {
    const response = await context.book(employee);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ status: BookingStatus.ACTIVE, participantsCount: 3 });

    const schedule = await request(app).get('/api/schedule?date=2026-09-21').set(auth(employee));
    const room = schedule.body.find((entry) => entry.room.id === response.body.roomId);
    expect(room.bookings).toHaveLength(1);
    expect(room.bookings[0].id).toBe(response.body.id);
  });

  it('Сценарій 2: другий запит на той самий слот отримує 409 (ФВ-18)', async () => {
    await context.book(employee);
    const colleague = await context.loginAs(EMPLOYEE_2);

    const conflict = await context.book(colleague, { start: at(10, 30), end: at(11, 30), participants: 2 });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('SLOT_TAKEN');
  });

  it('два одночасні запити створюють рівно одну бронь (Сценарій 2)', async () => {
    const colleague = await context.loginAs(EMPLOYEE_2);
    const responses = await Promise.all([context.book(employee), context.book(colleague, { participants: 2 })]);

    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(1);
  });

  it('кількість учасників понад місткість кімнати відхиляється до запису (ФВ-19)', async () => {
    const response = await context.book(employee, { participants: 5 });
    expect(response.status).toBe(422);
    expect(response.body.error.message).toMatch(/місткість/);
  });

  it('горизонт бронювання: 28-й день — 201, 29-й — 422 (ФВ-27)', async () => {
    const within = await context.book(employee, { start: onDay(28), end: onDay(28, 11) });
    const beyond = await context.book(employee, { start: onDay(29), end: onDay(29, 11) });

    expect(within.status).toBe(201);
    expect(beyond.status).toBe(422);
  });

  it('Сценарій 4: адміністратор скасовує чужу бронь із причиною, автор отримує лист (ФВ-10, ФВ-25)', async () => {
    const created = await context.book(employee);
    const admin = await context.loginAs(OFFICE_ADMIN);

    const withoutReason = await request(app).post(`/api/bookings/${created.body.id}/cancel`).set(auth(admin)).send({});
    expect(withoutReason.status).toBe(422);

    const cancelled = await request(app)
      .post(`/api/bookings/${created.body.id}/cancel`)
      .set(auth(admin))
      .send({ reason: 'Термінова нарада' });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body).toMatchObject({ status: BookingStatus.CANCELLED, cancelReason: 'Термінова нарада' });

    const letter = context.channel.sent.at(-1);
    expect(letter.to).toBe(EMPLOYEE);
    expect(letter.text).toMatch(/Термінова нарада/);

    // слот звільнився — його може зайняти інший співробітник
    const colleague = await context.loginAs(EMPLOYEE_2);
    expect((await context.book(colleague, { participants: 2 })).status).toBe(201);
  });

  it('автор скасовує власну бронь без причини і без листа (ФВ-06)', async () => {
    const created = await context.book(employee);
    const lettersBefore = context.channel.sent.length;

    const cancelled = await request(app).post(`/api/bookings/${created.body.id}/cancel`).set(auth(employee)).send({});
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe(BookingStatus.CANCELLED);
    expect(context.channel.sent).toHaveLength(lettersBefore);
  });

  it('журнал подій фіксує створення і скасування броні (ФВ-22)', async () => {
    const created = await context.book(employee);
    const admin = await context.loginAs(OFFICE_ADMIN);
    await request(app).post(`/api/bookings/${created.body.id}/cancel`).set(auth(admin)).send({ reason: 'Ремонт' });

    const entries = await context.container.services.eventLog.recent(10);
    expect(entries.map((entry) => entry.actionType)).toEqual(
      expect.arrayContaining([EventType.BOOKING_CREATED, EventType.BOOKING_CANCELLED]),
    );
    expect(entries.every((entry) => entry.timestamp instanceof Date)).toBe(true);
  });
});
