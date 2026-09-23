import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { EMPLOYEE, IT, at, createTestApp, onDay } from '../../helpers/testApp.js';

describe('розклад на тиждень (ФВ-03)', () => {
  let app;
  let context;
  let employee;

  beforeEach(async () => {
    context = await createTestApp();
    ({ app } = context);
    employee = await context.loginAs(EMPLOYEE);
  });

  const auth = (token) => ({ Authorization: `Bearer ${token}` });
  const week = (token = employee, date = '2026-09-21') =>
    request(app).get(`/api/schedule/week?date=${date}`).set(auth(token));

  it('повертає 7 днів поспіль, у кожному — усі активні кімнати', async () => {
    const response = await week();
    expect(response.status).toBe(200);
    expect(response.body.map((day) => day.date)).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
    ]);
    expect(response.body.every((day) => day.rooms.length === 5)).toBe(true);
  });

  it('бронь потрапляє лише в той день, коли вона відбувається', async () => {
    const room = context.roomFor(6);
    await context.book(employee, { room, start: at(10), end: at(11) });
    await context.book(employee, { room, start: onDay(2, 14), end: onDay(2, 15) });

    const response = await week();
    const bookingsOf = (index) => response.body[index].rooms.find((entry) => entry.room.id === room.id).bookings;
    expect(bookingsOf(0)).toHaveLength(1);
    expect(bookingsOf(1)).toHaveLength(0);
    expect(bookingsOf(2)).toHaveLength(1);
  });

  it('деактивована кімната зникає лише з днів деактивації (ФВ-15)', async () => {
    const room = context.roomFor(8);
    const it_ = await context.loginAs(IT);
    await request(app)
      .post(`/api/rooms/${room.id}/deactivate`)
      .set(auth(it_))
      .send({ from: '2026-09-22', to: '2026-09-23' });

    const response = await week();
    const hasRoom = (index) => response.body[index].rooms.some((entry) => entry.room.id === room.id);
    expect([hasRoom(0), hasRoom(1), hasRoom(2), hasRoom(3)]).toEqual([true, false, false, true]);
  });

  it('некоректна дата — 422, роль IT доступу не має (ФВ-29)', async () => {
    expect((await week(employee, 'завтра')).status).toBe(422);
    expect((await week(await context.loginAs(IT))).status).toBe(403);
  });
});
