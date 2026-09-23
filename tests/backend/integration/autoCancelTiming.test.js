import { describe, expect, it } from 'vitest';
import { BookingStatus } from '../../../src/backend/modules/bookings/BookingStatus.js';
import { EMPLOYEE, at, createTestApp } from '../../helpers/testApp.js';

// НФВ-07: автоскасування не раніше ніж через 10:00 і не пізніше ніж через 10:30 після початку слота.
// Планувальник спрацьовує кожні tickSeconds секунд, а фаза тіків відносно початку слота довільна,
// тому перебираємо всі фази від 0 до tickSeconds − 1 і для кожної шукаємо момент фактичного скасування.
describe('точність автоскасування (НФВ-07)', () => {
  // Найгірша затримка дорівнює одному кроку, тому вимагаємо запас удвічі на час виконання самої задачі
  it('крок планувальника має дворазовий запас до допуску в 30 секунд', async () => {
    const { container } = await createTestApp();
    expect(container.config.scheduler.tickSeconds * 2).toBeLessThanOrEqual(30);
  });

  it('за будь-якої фази тіків бронь скасовується в межах 10:00–10:30 після початку', async () => {
    const probe = await createTestApp();
    const tick = probe.container.config.scheduler.tickSeconds;

    for (let phase = 0; phase < tick; phase += 1) {
      const context = await createTestApp();
      const token = await context.loginAs(EMPLOYEE);
      const created = await context.book(token);

      let cancelledAfter = null;
      for (let elapsed = -120 + phase; elapsed <= 700; elapsed += tick) {
        context.clock.set(new Date(at(10).getTime() + elapsed * 1000));
        await context.container.services.bookingService.autoCancelOverdue();
        const stored = await context.container.storage.bookings.findById(created.body.id);
        if (stored.status === BookingStatus.AUTO_CANCELLED) {
          cancelledAfter = elapsed;
          break;
        }
      }

      expect(cancelledAfter, `фаза ${phase} с`).not.toBeNull();
      expect(cancelledAfter).toBeGreaterThanOrEqual(600);
      expect(cancelledAfter).toBeLessThanOrEqual(630);
    }
  });
});
