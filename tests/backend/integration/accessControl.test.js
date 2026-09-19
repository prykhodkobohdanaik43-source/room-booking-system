import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { EMPLOYEE, EMPLOYEE_2, IT, OFFICE_ADMIN, createTestApp } from '../../helpers/testApp.js';

describe('розмежування прав за ролями', () => {
  let app;
  let context;

  beforeEach(async () => {
    context = await createTestApp();
    ({ app } = context);
  });

  const auth = (token) => ({ Authorization: `Bearer ${token}` });

  it('без токена доступу немає (ФВ-01)', async () => {
    expect((await request(app).get('/api/rooms')).status).toBe(401);
    expect((await request(app).get('/api/rooms').set({ Authorization: 'Bearer invalid.token.value' })).status).toBe(
      401,
    );
  });

  it('співробітник не може скасувати чужу бронь (ФВ-28)', async () => {
    const employee = await context.loginAs(EMPLOYEE);
    const created = await context.book(employee);
    const colleague = await context.loginAs(EMPLOYEE_2);

    const response = await request(app)
      .post(`/api/bookings/${created.body.id}/cancel`)
      .set(auth(colleague))
      .send({ reason: 'Потрібна кімната' });

    expect(response.status).toBe(403);
    const stored = await context.container.storage.bookings.findById(created.body.id);
    expect(stored.status).toBe('ACTIVE');
  });

  it('роль IT не має доступу до розкладу і броней (ФВ-29)', async () => {
    const it = await context.loginAs(IT);

    expect((await request(app).get('/api/schedule?date=2026-09-21').set(auth(it))).status).toBe(403);
    expect((await request(app).get('/api/schedule/now').set(auth(it))).status).toBe(403);
    expect((await context.book(it)).status).toBe(403);

    // довідник кімнат і облікові записи при цьому доступні
    expect((await request(app).get('/api/rooms').set(auth(it))).status).toBe(200);
    expect((await request(app).get('/api/users').set(auth(it))).status).toBe(200);
  });

  it('співробітник не бачить перелік облікових записів (ФВ-16)', async () => {
    const employee = await context.loginAs(EMPLOYEE);
    expect((await request(app).get('/api/users').set(auth(employee))).status).toBe(403);
  });

  it('заблокований обліковий запис втрачає доступ із наявним токеном (ФВ-17)', async () => {
    const employee = await context.loginAs(EMPLOYEE);
    const it = await context.loginAs(IT);
    const users = await request(app).get('/api/users').set(auth(it));
    const target = users.body.find((user) => user.email === EMPLOYEE);

    await request(app).post(`/api/users/${target.id}/block`).set(auth(it)).send({});
    expect((await request(app).get('/api/schedule/now').set(auth(employee))).status).toBe(401);
  });

  it('адміністратор офісу бронює нарівні зі співробітником (табл. 4.1)', async () => {
    const admin = await context.loginAs(OFFICE_ADMIN);
    expect((await context.book(admin)).status).toBe(201);
  });
});
