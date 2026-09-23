import { randomUUID } from 'node:crypto';
import { ConflictError } from '../../shared/errors.js';
import { Booking } from './Booking.js';
import { BookingRepository } from './BookingRepository.js';
import { BookingStatus } from './BookingStatus.js';
import { SlotTakenError } from './SlotTakenError.js';

export class InMemoryBookingRepository extends BookingRepository {
  #items = new Map();

  async insert(booking) {
    const taken = [...this.#items.values()].some((other) => other.occupiesSlot && other.overlaps(booking));
    if (taken) throw new SlotTakenError();

    const stored = new Booking({ ...booking, id: booking.id ?? randomUUID() });
    this.#items.set(stored.id, stored);
    return new Booking({ ...stored });
  }

  async update(booking) {
    const stored = this.#items.get(booking.id);
    if (!stored || stored.status !== BookingStatus.ACTIVE) {
      throw new ConflictError('Бронь уже змінено', 'BOOKING_NOT_ACTIVE');
    }
    this.#items.set(booking.id, new Booking({ ...booking }));
    return new Booking({ ...booking });
  }

  async updateSchedule(booking) {
    const stored = this.#items.get(booking.id);
    if (!stored || stored.status !== BookingStatus.ACTIVE) {
      throw new ConflictError('Бронь уже змінено', 'BOOKING_NOT_ACTIVE');
    }
    const taken = [...this.#items.values()].some(
      (other) => other.id !== booking.id && other.occupiesSlot && other.overlaps(booking),
    );
    if (taken) throw new SlotTakenError();

    this.#items.set(booking.id, new Booking({ ...stored, ...booking, status: stored.status }));
    return new Booking({ ...this.#items.get(booking.id) });
  }

  async findById(id) {
    const booking = this.#items.get(id);
    return booking ? new Booking({ ...booking }) : null;
  }

  async findOccupying(from, to) {
    return this.#select((b) => b.occupiesSlot && b.startTime < to && b.endTime > from);
  }

  async findActiveStartedBy(deadline) {
    return this.#select((b) => b.status === BookingStatus.ACTIVE && b.startTime <= deadline);
  }

  async findAwaitingReminder(from, to) {
    return this.#select(
      (b) => b.status === BookingStatus.ACTIVE && !b.reminderSentAt && b.startTime > from && b.startTime <= to,
    );
  }

  async findByAuthor(authorId, from) {
    return this.#select((b) => b.authorId === authorId && b.occupiesSlot && b.endTime > from);
  }

  async findUpcoming(from) {
    return this.#select((b) => b.occupiesSlot && b.endTime > from);
  }

  async findByPeriod(from, to) {
    return this.#select((b) => b.startTime >= from && b.startTime < to);
  }

  async findActiveByRoom(roomId, from, to) {
    return this.#select(
      (b) => b.roomId === roomId && b.status === BookingStatus.ACTIVE && b.startTime >= from && b.startTime < to,
    );
  }

  #select(predicate) {
    return [...this.#items.values()]
      .filter(predicate)
      .sort((a, b) => a.startTime - b.startTime)
      .map((b) => new Booking({ ...b }));
  }
}
