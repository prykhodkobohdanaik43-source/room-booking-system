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

    // ---- Лаб. №5: методи для редагування, «моїх броней», адміністратора і деактивації кімнати

    function draftBy(authorId, { roomId = ids.roomId, start = at(10), end = at(11) } = {}) {
      return new Booking({ roomId, authorId, startTime: start, endTime: end, participantsCount: 3 });
    }

    describe('updateSchedule (ФВ-07)', () => {
      it('переносить бронь на інший час і зберігає зміни', async () => {
        const saved = await repo.insert(draft());
        saved.startTime = at(12);
        saved.endTime = at(13);
        saved.participantsCount = 2;
        await repo.updateSchedule(saved);

        expect(await repo.findById(saved.id)).toMatchObject({
          startTime: at(12),
          endTime: at(13),
          participantsCount: 2,
        });
      });

      it('дозволяє зсув, що перетинається зі старим часом тієї ж броні', async () => {
        const saved = await repo.insert(draft());
        saved.startTime = at(10, 30);
        saved.endTime = at(11, 30);
        await expect(repo.updateSchedule(saved)).resolves.toBeTruthy();
      });

      it('відхиляє перенесення на слот, зайнятий іншою бронню (ФВ-18)', async () => {
        await repo.insert(draft({ start: at(12), end: at(13) }));
        const saved = await repo.insert(draft());
        saved.startTime = at(12, 30);
        saved.endTime = at(13, 30);

        await expect(repo.updateSchedule(saved)).rejects.toBeInstanceOf(SlotTakenError);
        expect((await repo.findById(saved.id)).startTime).toEqual(at(10));
      });

      it('переносить бронь в іншу кімнату', async () => {
        const saved = await repo.insert(draft());
        saved.roomId = ids.otherRoomId;
        await repo.updateSchedule(saved);
        expect((await repo.findById(saved.id)).roomId).toBe(ids.otherRoomId);
      });

      it('не змінює бронь, яка вже не «активна»', async () => {
        const saved = await repo.insert(draft());
        const stale = await repo.findById(saved.id);
        saved.status = BookingStatus.CANCELLED;
        await repo.update(saved);

        stale.startTime = at(12);
        stale.endTime = at(13);
        await expect(repo.updateSchedule(stale)).rejects.toBeInstanceOf(ConflictError);
      });
    });

    it('findByAuthor повертає лише чинні броні автора, що не завершилися (ФВ-06–ФВ-08)', async () => {
      const mine = await repo.insert(draftBy(ids.authorId, { start: at(12), end: at(13) }));
      await repo.insert(draftBy(ids.authorId, { start: at(8), end: at(9) })); // вже завершилась
      await repo.insert(draftBy(ids.otherAuthorId, { start: at(14), end: at(15) }));
      const cancelled = await repo.insert(draftBy(ids.authorId, { start: at(16), end: at(17) }));
      cancelled.status = BookingStatus.CANCELLED;
      await repo.update(cancelled);

      const found = await repo.findByAuthor(ids.authorId, at(10));
      expect(found.map((booking) => booking.id)).toEqual([mine.id]);
    });

    it('findUpcoming повертає чинні броні всіх авторів, що не завершилися (ФВ-09)', async () => {
      const first = await repo.insert(draftBy(ids.authorId, { start: at(12), end: at(13) }));
      const second = await repo.insert(draftBy(ids.otherAuthorId, { start: at(14), end: at(15) }));
      await repo.insert(draftBy(ids.authorId, { start: at(8), end: at(9) }));
      const cancelled = await repo.insert(
        draftBy(ids.authorId, { roomId: ids.otherRoomId, start: at(12), end: at(13) }),
      );
      cancelled.status = BookingStatus.CANCELLED;
      await repo.update(cancelled);

      const found = await repo.findUpcoming(at(10));
      expect(found.map((booking) => booking.id)).toEqual([first.id, second.id]);
    });

    it('findByPeriod повертає броні всіх чотирьох статусів (ФВ-11)', async () => {
      const active = await repo.insert(draft({ start: at(9), end: at(10) }));
      const confirmed = await repo.insert(draft({ start: at(10), end: at(11) }));
      const cancelled = await repo.insert(draft({ start: at(11), end: at(12) }));
      const auto = await repo.insert(draft({ start: at(12), end: at(13) }));
      const outside = await repo.insert(draft({ start: at(20), end: at(21) }));
      confirmed.status = BookingStatus.CONFIRMED;
      cancelled.status = BookingStatus.CANCELLED;
      auto.status = BookingStatus.AUTO_CANCELLED;
      for (const booking of [confirmed, cancelled, auto]) await repo.update(booking);

      const found = await repo.findByPeriod(at(0), at(18));
      expect(found.map((booking) => booking.status)).toEqual([
        BookingStatus.ACTIVE,
        BookingStatus.CONFIRMED,
        BookingStatus.CANCELLED,
        BookingStatus.AUTO_CANCELLED,
      ]);
      expect(found.map((booking) => booking.id)).not.toContain(outside.id);
      expect(found[0].id).toBe(active.id);
    });

    it('findActiveByRoom повертає лише «активні» броні цієї кімнати в періоді (ФВ-26)', async () => {
      const target = await repo.insert(draft({ start: at(10), end: at(11) }));
      await repo.insert(draft({ roomId: ids.otherRoomId }));
      const confirmed = await repo.insert(draft({ start: at(12), end: at(13) }));
      confirmed.status = BookingStatus.CONFIRMED;
      await repo.update(confirmed);
      await repo.insert(draft({ start: at(20), end: at(21) }));

      const found = await repo.findActiveByRoom(ids.roomId, at(0), at(18));
      expect(found.map((booking) => booking.id)).toEqual([target.id]);
    });
  });
}
