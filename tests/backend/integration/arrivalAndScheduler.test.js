import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { BookingStatus } from '../../../src/backend/modules/bookings/BookingStatus.js';
import { EMPLOYEE, EMPLOYEE_2, at, createTestApp } from '../../helpers/testApp.js';

describe('відмітка про прихід і планувальник', () => {
  let app;
  let context;
  let employee;
  let bookingId;

  beforeEach(async () => {
    context = await createTestApp();
    ({ app } = context);
    employee = await context.loginAs(EMPLOYEE);
    const created = await context.book(employee);
    bookingId = created.body.id;
  });

  const auth = (token) => ({ Authorization: `Bearer ${token}` });
  const confirm = (token = employee) =>
    request(app).post(`/api/bookings/${bookingId}/confirm-arrival`).set(auth(token)).send({});
  const runScheduler = () => context.container.services.bookingService.autoCancelOverdue();
  const statusOf = async () => (await context.container.storage.bookings.findById(bookingId)).status;

  it('до початку слота відмітка недоступна (ФВ-08)', async () => {
    const response = await confirm();
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('ARRIVAL_WINDOW_CLOSED');
  });

  it('у межах 10 хвилин відмітка переводить бронь у «підтверджена» (ФВ-08)', async () => {
    context.clock.set(at(10, 5));
    expect((await confirm()).status).toBe(200);
    expect(await statusOf()).toBe(BookingStatus.CONFIRMED);
  });

  it('відмітку ставить лише автор броні (ФВ-08)', async () => {
    context.clock.set(at(10, 5));
    const colleague = await context.loginAs(EMPLOYEE_2);
    expect((await confirm(colleague)).status).toBe(403);
  });

  it('Сценарій 3: без відмітки бронь автоскасовується і слот звільняється (ФВ-20)', async () => {
    context.clock.set(at(10, 9, 59));
    expect(await runScheduler()).toBe(0);
    expect(await statusOf()).toBe(BookingStatus.ACTIVE);

    context.clock.set(at(10, 10));
    expect(await runScheduler()).toBe(1);
    expect(await statusOf()).toBe(BookingStatus.AUTO_CANCELLED);

    const letter = context.channel.sent.at(-1);
    expect(letter.to).toBe(EMPLOYEE);
    expect(letter.subject).toMatch(/скасовано/);

    const colleague = await context.loginAs(EMPLOYEE_2);
    expect((await context.book(colleague, { start: at(10, 10), end: at(11), participants: 2 })).status).toBe(201);
  });

  it('підтверджену бронь планувальник не чіпає (ФВ-20)', async () => {
    context.clock.set(at(10, 1));
    await confirm();

    context.clock.set(at(10, 30));
    expect(await runScheduler()).toBe(0);
    expect(await statusOf()).toBe(BookingStatus.CONFIRMED);
  });

  it('нагадування йде за 15 хвилин до початку і лише один раз (ФВ-21)', async () => {
    const service = context.container.services.bookingService;

    context.clock.set(at(9, 40));
    expect(await service.sendDueReminders()).toBe(0);

    context.clock.set(at(9, 45));
    expect(await service.sendDueReminders()).toBe(1);
    expect(context.channel.sent.at(-1)).toMatchObject({ to: EMPLOYEE });

    expect(await service.sendDueReminders()).toBe(0);
  });
});
