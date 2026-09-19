import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { EMPLOYEE, IT, createTestApp } from '../../helpers/testApp.js';

describe('довідник кімнат', () => {
  let app;
  let context;
  let it_;

  beforeEach(async () => {
    context = await createTestApp();
    ({ app } = context);
    it_ = await context.loginAs(IT);
  });

  const auth = (token) => ({ Authorization: `Bearer ${token}` });
  const createRoom = (payload) => request(app).post('/api/rooms').set(auth(it_)).send(payload);

  it('Сценарій 5: нова кімната одразу доступна для бронювання (ФВ-13)', async () => {
    const created = await createRoom({ name: 'Тиса', capacity: 10, floor: 5 });
    expect(created.status).toBe(201);

    const employee = await context.loginAs(EMPLOYEE);
    const schedule = await request(app).get('/api/schedule?date=2026-09-21').set(auth(employee));
    expect(schedule.body.map((entry) => entry.room.name)).toContain('Тиса');
    expect((await context.book(employee, { room: created.body, participants: 9 })).status).toBe(201);
  });

  it('назва-дублікат і нульова місткість відхиляються (ФВ-13)', async () => {
    expect((await createRoom({ name: 'Десна', capacity: 4, floor: 2 })).status).toBe(409);
    expect((await createRoom({ name: 'Тиса', capacity: 0, floor: 5 })).status).toBe(422);
  });

  it('змінена місткість застосовується при наступній перевірці (ФВ-14, ФВ-19)', async () => {
    const employee = await context.loginAs(EMPLOYEE);
    const room = context.roomFor(4);
    expect((await context.book(employee, { room, participants: 6 })).status).toBe(422);

    await request(app).patch(`/api/rooms/${room.id}`).set(auth(it_)).send({ capacity: 6 });
    expect((await context.book(employee, { room, participants: 6 })).status).toBe(201);
  });

  it('деактивована кімната зникає з розкладу і не бронюється (ФВ-15)', async () => {
    const room = context.roomFor(6);
    await request(app)
      .post(`/api/rooms/${room.id}/deactivate`)
      .set(auth(it_))
      .send({ from: '2026-09-21', to: '2026-09-23' });

    const employee = await context.loginAs(EMPLOYEE);
    const schedule = await request(app).get('/api/schedule?date=2026-09-21').set(auth(employee));
    expect(schedule.body.map((entry) => entry.room.id)).not.toContain(room.id);
    expect((await context.book(employee, { room })).status).toBe(422);
  });
});
