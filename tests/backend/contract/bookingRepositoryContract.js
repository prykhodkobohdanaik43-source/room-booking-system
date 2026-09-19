import { beforeEach, describe, expect, it } from 'vitest';
import { Booking } from '../../../src/backend/modules/bookings/Booking.js';
import { BookingStatus } from '../../../src/backend/modules/bookings/BookingStatus.js';
import { SlotTakenError } from '../../../src/backend/modules/bookings/SlotTakenError.js';
import { ConflictError } from '../../../src/backend/shared/errors.js';

const at = (hours, minutes = 0) => new Date(2026, 8, 21, hours, minutes);

// Один набір перевірок для всіх реалізацій BookingRepository:
// setup() повертає порожній репозиторій та ідентифікатори наявних кімнат і користувача.
export function describeBookingRepository(name, setup, describeFn = describe) {
  describeFn(`${name} — контракт BookingRepository`, () => {
    let repo;
    let ids;

    beforeEach(async () => {
      ({ repo, ...ids } = await setup());
    });

    function draft({ roomId = ids.roomId, start = at(10), end = at(11) } = {}) {
      return new Booking({ roomId, authorId: ids.authorId, startTime: start, endTime: end, participantsCount: 3 });
    }

    it('зберігає бронь і видає їй ідентифікатор', async () => {
      const saved = await repo.insert(draft());
      expect(saved.id).toBeTruthy();
      expect(await repo.findById(saved.id)).toMatchObject({
        roomId: ids.roomId,
        status: BookingStatus.ACTIVE,
        startTime: at(10),
        endTime: at(11),
      });
    });

    it('відхиляє бронь, що перетинається з наявною в тій самій кімнаті (ФВ-18)', async () => {
      await repo.insert(draft());
      await expect(repo.insert(draft({ start: at(10, 30), end: at(11, 30) }))).rejects.toBeInstanceOf(SlotTakenError);
    });

    it('приймає суміжний слот і той самий час в іншій кімнаті', async () => {
      await repo.insert(draft());
      await expect(repo.insert(draft({ start: at(11), end: at(12) }))).resolves.toBeTruthy();
      await expect(repo.insert(draft({ roomId: ids.otherRoomId }))).resolves.toBeTruthy();
    });

    it('із двох одночасних запитів на один слот приймає рівно один (Сценарій 2)', async () => {
      const results = await Promise.allSettled([repo.insert(draft()), repo.insert(draft())]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.find((result) => result.status === 'rejected').reason).toBeInstanceOf(SlotTakenError);
      expect(await repo.findOccupying(at(0), at(23))).toHaveLength(1);
    });

    it('скасована бронь звільняє слот', async () => {
      const saved = await repo.insert(draft());
      saved.status = BookingStatus.CANCELLED;
      await repo.update(saved);

      expect(await repo.findOccupying(at(0), at(23))).toHaveLength(0);
      await expect(repo.insert(draft())).resolves.toBeTruthy();
    });

    it('update не чіпає бронь, яка в сховищі вже не «активна»', async () => {
      const saved = await repo.insert(draft());
      const stale = await repo.findById(saved.id);

      saved.status = BookingStatus.CONFIRMED;
      await repo.update(saved);

      stale.status = BookingStatus.AUTO_CANCELLED;
      await expect(repo.update(stale)).rejects.toBeInstanceOf(ConflictError);
      expect((await repo.findById(saved.id)).status).toBe(BookingStatus.CONFIRMED);
    });

    it('findActiveStartedBy повертає лише «активні» броні, що вже мали початися', async () => {
      const early = await repo.insert(draft({ start: at(9), end: at(10) }));
      await repo.insert(draft({ start: at(12), end: at(13) }));
      const confirmed = await repo.insert(draft({ roomId: ids.otherRoomId, start: at(9), end: at(10) }));
      confirmed.status = BookingStatus.CONFIRMED;
      await repo.update(confirmed);

      const found = await repo.findActiveStartedBy(at(9, 30));
      expect(found.map((booking) => booking.id)).toEqual([early.id]);
    });

    it('findAwaitingReminder не повертає броні, про які вже нагадали', async () => {
      const saved = await repo.insert(draft());
      expect(await repo.findAwaitingReminder(at(9, 44), at(10))).toHaveLength(1);

      saved.markReminded(at(9, 45));
      await repo.update(saved);
      expect(await repo.findAwaitingReminder(at(9, 44), at(10))).toHaveLength(0);
    });
  });
}
