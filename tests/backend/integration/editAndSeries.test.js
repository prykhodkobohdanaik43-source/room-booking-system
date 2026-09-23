import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { BookingStatus } from '../../../src/backend/modules/bookings/BookingStatus.js';
import { EventType } from '../../../src/backend/modules/eventlog/EventType.js';
import { EMPLOYEE, EMPLOYEE_2, OFFICE_ADMIN, at, createTestApp, onDay } from '../../helpers/testApp.js';

describe('мої броні, редагування й серії', () => {
  let app;
  let context;
  let employee;

  beforeEach(async () => {
    context = await createTestApp();
    ({ app } = context);
    employee = await context.loginAs(EMPLOYEE);
  });

  const auth = (token) => ({ Authorization: `Bearer ${token}` });
  const patch = (id, body, token = employee) => request(app).patch(`/api/bookings/${id}`).set(auth(token)).send(body);
  const series = (body, token = employee) => request(app).post('/api/bookings/series').set(auth(token)).send(body);
  const seriesBody = (overrides = {}) => ({
    roomId: context.roomFor(4).id,
    startTime: at(10).toISOString(),
    endTime: at(11).toISOString(),
    participantsCount: 3,
    weeks: 4,
    ...overrides,
  });

  describe('«мої броні»', () => {
    it('показує лише власні чинні броні з назвою кімнати', async () => {
      await context.book(employee, { start: at(10), end: at(11) });
      const colleague = await context.loginAs(EMPLOYEE_2);
      await context.book(colleague, { room: context.roomFor(6), start: at(10), end: at(11), participants: 2 });

      const response = await request(app).get('/api/bookings/mine').set(auth(employee));
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({ roomName: 'Десна', status: BookingStatus.ACTIVE });
    });

    it('завершені броні зі списку зникають', async () => {
      await context.book(employee, { start: at(10), end: at(11) });
      context.clock.set(at(12));
      const response = await request(app).get('/api/bookings/mine').set(auth(employee));
      expect(response.body).toHaveLength(0);
    });
  });

  describe('редагування (ФВ-07)', () => {
    it('автор змінює час і кількість учасників; розклад оновлюється', async () => {
      const created = await context.book(employee);
      const response = await patch(created.body.id, {
        startTime: at(14).toISOString(),
        endTime: at(15).toISOString(),
        participantsCount: 4,
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ participantsCount: 4, status: BookingStatus.ACTIVE });
      const schedule = await request(app).get('/api/schedule?date=2026-09-21').set(auth(employee));
      const room = schedule.body.find((entry) => entry.room.id === created.body.roomId);
      expect(room.bookings.map((booking) => new Date(booking.startTime).getHours())).toEqual([14]);
    });

    it('перенесення на зайнятий слот відхиляється, стара бронь не змінюється (ФВ-18)', async () => {
      await context.book(employee, { start: at(12), end: at(13) });
      const created = await context.book(employee, { start: at(10), end: at(11) });

      const response = await patch(created.body.id, {
        startTime: at(12, 30).toISOString(),
        endTime: at(13, 30).toISOString(),
      });
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('SLOT_TAKEN');

      const stored = await context.container.storage.bookings.findById(created.body.id);
      expect(stored.startTime).toEqual(at(10));
    });

    it('кількість учасників понад місткість відхиляється (ФВ-19)', async () => {
      const created = await context.book(employee);
      const response = await patch(created.body.id, { participantsCount: 5 });
      expect(response.status).toBe(422);
    });

    it('перенесення в кімнату, деактивовану на цю дату, відхиляється (ФВ-15)', async () => {
      const created = await context.book(employee);
      const target = context.roomFor(6);
      await context.container.services.roomService.deactivate(
        target.id,
        { from: '2026-09-21', to: '2026-09-21' },
        { id: 'it' },
      );

      const response = await patch(created.body.id, { roomId: target.id });
      expect(response.status).toBe(422);
    });

    it('редагувати чужу бронь не можна ні співробітнику, ні адміністратору (ФВ-28)', async () => {
      const created = await context.book(employee);
      const colleague = await context.loginAs(EMPLOYEE_2);
      const admin = await context.loginAs(OFFICE_ADMIN);

      expect((await patch(created.body.id, { participantsCount: 2 }, colleague)).status).toBe(403);
      expect((await patch(created.body.id, { participantsCount: 2 }, admin)).status).toBe(403);
    });

    it('після початку слота редагування недоступне', async () => {
      const created = await context.book(employee);
      context.clock.set(at(10, 1));
      const response = await patch(created.body.id, { participantsCount: 2 });
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('BOOKING_STARTED');
    });

    it('редагування фіксується в журналі подій (ФВ-22)', async () => {
      const created = await context.book(employee);
      await patch(created.body.id, { participantsCount: 2 });
      const entries = await context.container.services.eventLog.recent(5);
      expect(entries.map((entry) => entry.actionType)).toContain(EventType.BOOKING_UPDATED);
    });
  });

  describe('серія щотижневих броней (ФВ-24)', () => {
    it('серія на 4 тижні створює 4 окремі броні з кроком 7 днів', async () => {
      const response = await series(seriesBody());
      expect(response.status).toBe(201);
      expect(response.body.skipped).toEqual([]);
      expect(response.body.created).toHaveLength(4);

      const starts = response.body.created.map((booking) => new Date(booking.startTime));
      expect(starts).toEqual([at(10), onDay(7), onDay(14), onDay(21)]);
      expect(new Set(response.body.created.map((booking) => booking.id)).size).toBe(4);
    });

    it('тиждень із конфліктом пропускається, система називає його номер', async () => {
      await context.book(employee, { start: onDay(14, 10, 30), end: onDay(14, 11, 30) });
      const response = await series(seriesBody());

      expect(response.status).toBe(201);
      expect(response.body.created).toHaveLength(3);
      expect(response.body.skipped).toHaveLength(1);
      expect(response.body.skipped[0]).toMatchObject({ week: 3 });
    });

    it('якщо не вдалося забронювати жодного тижня — 409 зі списком пропущених', async () => {
      const other = await context.loginAs(EMPLOYEE_2);
      await series(seriesBody({ participantsCount: 2 }), other);

      const response = await series(seriesBody());
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('SERIES_EMPTY');
      expect(response.body.error.details.skipped).toHaveLength(4);
    });

    it('серія, що виходить за горизонт 28 днів, відхиляється повністю (ФВ-27)', async () => {
      const response = await series(
        seriesBody({ startTime: onDay(10).toISOString(), endTime: onDay(10, 11).toISOString() }),
      );
      expect(response.status).toBe(422);
      expect(response.body.error.message).toMatch(/горизонт/);
      const stored = await context.container.storage.bookings.findByAuthor(
        (await request(app).get('/api/auth/me').set(auth(employee))).body.id,
        at(0),
      );
      expect(stored).toHaveLength(0);
    });

    it.each([1, 0, 9, 'три'])('кількість тижнів %s відхиляється', async (weeks) => {
      expect((await series(seriesBody({ weeks }))).status).toBe(422);
    });

    it('перевищення місткості в серії відхиляє всю серію (ФВ-19)', async () => {
      expect((await series(seriesBody({ participantsCount: 9 }))).status).toBe(422);
    });
  });
});
