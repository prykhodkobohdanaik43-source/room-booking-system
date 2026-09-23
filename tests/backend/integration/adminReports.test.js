import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { BookingStatus } from '../../../src/backend/modules/bookings/BookingStatus.js';
import { EMPLOYEE, EMPLOYEE_2, IT, OFFICE_ADMIN, at, createTestApp } from '../../helpers/testApp.js';

// Розбір відповіді CSV у масив рядків (у тестових даних немає ком у значеннях)
function parseCsv(text) {
  return text
    .replace(/^\uFEFF/, '')
    .trim()
    .split('\r\n')
    .map((line) => line.split(','));
}

describe('розділ адміністратора офісу', () => {
  let app;
  let context;
  let employee;
  let colleague;
  let admin;

  beforeEach(async () => {
    context = await createTestApp();
    ({ app } = context);
    employee = await context.loginAs(EMPLOYEE);
    colleague = await context.loginAs(EMPLOYEE_2);
    admin = await context.loginAs(OFFICE_ADMIN);
  });

  const auth = (token) => ({ Authorization: `Bearer ${token}` });
  const get = (path, token = admin) => request(app).get(path).set(auth(token));

  describe('перелік поточних і майбутніх броней (ФВ-09)', () => {
    it('адміністратор бачить чужі броні з іменами авторів', async () => {
      await context.book(employee, { start: at(10), end: at(11) });
      await context.book(colleague, { room: context.roomFor(6), start: at(12), end: at(13), participants: 2 });

      const response = await get('/api/admin/bookings');
      expect(response.status).toBe(200);
      expect(response.body.map((booking) => booking.authorName)).toEqual(['Олена Коваленко', 'Андрій Ткачук']);
      expect(response.body.map((booking) => booking.roomName)).toEqual(['Десна', 'Ворскла']);
    });

    it('скасовані броні в переліку відсутні', async () => {
      const created = await context.book(employee);
      await request(app).post(`/api/bookings/${created.body.id}/cancel`).set(auth(employee)).send({});
      expect((await get('/api/admin/bookings')).body).toHaveLength(0);
    });

    it('співробітнику і ролі IT перелік недоступний (ФВ-09, ФВ-29)', async () => {
      expect((await get('/api/admin/bookings', employee)).status).toBe(403);
      expect((await get('/api/admin/bookings', await context.loginAs(IT))).status).toBe(403);
    });
  });

  describe('історія за період (ФВ-11)', () => {
    // Створює броні з трьома із чотирьох статусів; четверту («активну») тест додає сам
    async function prepareTerminalStatuses() {
      const room = (capacity) => context.roomFor(capacity);
      const toConfirm = await context.book(employee, { room: room(4), start: at(10), end: at(11) });
      const toCancel = await context.book(colleague, { room: room(6), start: at(10), end: at(11), participants: 2 });
      const toAutoCancel = await context.book(colleague, {
        room: room(8),
        start: at(10),
        end: at(11),
        participants: 2,
      });

      await request(app)
        .post(`/api/bookings/${toCancel.body.id}/cancel`)
        .set(auth(admin))
        .send({ reason: 'Термінова нарада' });

      context.clock.set(at(10, 5));
      await request(app).post(`/api/bookings/${toConfirm.body.id}/confirm-arrival`).set(auth(employee)).send({});

      context.clock.set(at(10, 11));
      await context.container.services.bookingService.autoCancelOverdue();
      return { toConfirm, toCancel, toAutoCancel };
    }

    it('містить броні всіх статусів зі статусом, автором, ініціатором і причиною', async () => {
      await prepareTerminalStatuses();
      const extra = await context.book(employee, { room: context.roomFor(20), start: at(15), end: at(16) });

      const response = await get('/api/admin/bookings/history?from=2026-09-21&to=2026-09-21');
      expect(response.status).toBe(200);
      const statuses = response.body.map((booking) => booking.status);
      expect(new Set(statuses)).toEqual(
        new Set([BookingStatus.ACTIVE, BookingStatus.CONFIRMED, BookingStatus.CANCELLED, BookingStatus.AUTO_CANCELLED]),
      );

      const cancelled = response.body.find((booking) => booking.status === BookingStatus.CANCELLED);
      expect(cancelled).toMatchObject({
        authorName: 'Андрій Ткачук',
        cancelledByName: 'Ірина Мельник',
        cancelReason: 'Термінова нарада',
      });
      const auto = response.body.find((booking) => booking.status === BookingStatus.AUTO_CANCELLED);
      expect(auto.cancelReason).toMatch(/10 хвилин/);
      expect(response.body.map((booking) => booking.id)).toContain(extra.body.id);
    });

    it('броні поза періодом не потрапляють у вибірку', async () => {
      await context.book(employee);
      const response = await get('/api/admin/bookings/history?from=2026-09-22&to=2026-09-25');
      expect(response.body).toEqual([]);
    });

    it.each(['', '?from=2026-09-21', '?from=2026-09-25&to=2026-09-21', '?from=2026-01-01&to=2027-12-31'])(
      'некоректний період %s — 422',
      async (query) => {
        expect((await get(`/api/admin/bookings/history${query}`)).status).toBe(422);
      },
    );

    it('співробітнику історія недоступна', async () => {
      expect((await get('/api/admin/bookings/history?from=2026-09-21&to=2026-09-21', employee)).status).toBe(403);
    });
  });

  describe('статистика завантаженості в CSV (ФВ-12)', () => {
    it('три підтверджені броні по 1 годині й одна автоскасована дають для кімнати 3 години', async () => {
      const room = context.roomFor(4);
      const ids = [];
      for (const hour of [10, 11, 12, 14]) {
        const created = await context.book(employee, { room, start: at(hour), end: at(hour + 1) });
        ids.push(created.body.id);
      }
      for (const [index, hour] of [10, 11, 12].entries()) {
        context.clock.set(at(hour, 5));
        const confirmed = await request(app)
          .post(`/api/bookings/${ids[index]}/confirm-arrival`)
          .set(auth(employee))
          .send({});
        expect(confirmed.status).toBe(200);
      }
      context.clock.set(at(14, 11));
      await context.container.services.bookingService.autoCancelOverdue();

      const response = await get('/api/admin/stats/utilization.csv?from=2026-09-21&to=2026-09-21');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/csv/);
      expect(response.headers['content-disposition']).toMatch(
        /attachment; filename="utilization_2026-09-21_2026-09-21\.csv"/,
      );

      const rows = parseCsv(response.text);
      expect(rows[0]).toEqual(['Кімната', 'Поверх', 'Місткість', 'Підтверджених броней', 'Годин підтверджених броней']);
      expect(rows.find((row) => row[0] === 'Десна')).toEqual(['Десна', '2', '4', '3', '3']);
      // решта кімнат теж у файлі, з нульовим завантаженням
      expect(rows.find((row) => row[0] === 'Дніпро')).toEqual(['Дніпро', '4', '20', '0', '0']);
    });

    it('файл починається з BOM, щоб Excel розпізнав кирилицю', async () => {
      const response = await get('/api/admin/stats/utilization.csv?from=2026-09-21&to=2026-09-21');
      expect(response.text.charCodeAt(0)).toBe(0xfeff);
    });

    it('співробітнику і ролі IT вивантаження недоступне', async () => {
      const path = '/api/admin/stats/utilization.csv?from=2026-09-21&to=2026-09-21';
      expect((await get(path, employee)).status).toBe(403);
      expect((await get(path, await context.loginAs(IT))).status).toBe(403);
    });
  });

  describe('перегляд журналу подій (ФВ-22)', () => {
    it('адміністратор бачить дії користувачів і позначку «система» для автоскасування', async () => {
      await context.book(employee);
      context.clock.set(at(10, 11));
      await context.container.services.bookingService.autoCancelOverdue();

      const response = await get('/api/admin/events?limit=10');
      expect(response.status).toBe(200);
      const byType = Object.fromEntries(response.body.map((entry) => [entry.actionType, entry]));
      expect(byType.BOOKING_CREATED.actorName).toBe('Олена Коваленко');
      expect(byType.BOOKING_AUTO_CANCELLED).toMatchObject({ actorName: 'система', bySystem: true });
    });

    it('журнал недоступний співробітнику', async () => {
      expect((await get('/api/admin/events', employee)).status).toBe(403);
    });
  });
});
