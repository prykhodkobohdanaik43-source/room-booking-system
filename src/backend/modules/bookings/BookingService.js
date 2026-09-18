import { NotFoundError, ValidationError } from '../../shared/errors.js';
import { addDays, addMinutes, dayRange, startOfDay } from '../../shared/dates.js';
import { EventType } from '../eventlog/EventType.js';
import { ARRIVAL_WINDOW_MINUTES, Booking } from './Booking.js';

export const RoomState = Object.freeze({ FREE: 'FREE', BUSY: 'BUSY' });

export class BookingService {
  constructor({
    bookings,
    rooms,
    users,
    eventLog,
    notifications,
    clock,
    rules,
    reminderMinutes = 15,
    logger = console,
  }) {
    this.bookings = bookings;
    this.rooms = rooms;
    this.users = users;
    this.eventLog = eventLog;
    this.notifications = notifications;
    this.clock = clock;
    this.rules = rules;
    this.reminderMinutes = reminderMinutes;
    this.logger = logger;
  }

  // ФВ-04, ФВ-05, ФВ-18, ФВ-19, ФВ-27
  async create(input, actor) {
    const now = this.clock.now();
    const booking = Booking.create({ ...input, authorId: actor.id }, now);

    const room = await this.rooms.findById(booking.roomId);
    if (!room) throw new NotFoundError('Кімнату не знайдено');
    for (const rule of this.rules) rule.check({ booking, room, now });

    const saved = await this.bookings.insert(booking);
    await this.#log(EventType.BOOKING_CREATED, saved, actor.id);
    return saved;
  }

  // ФВ-06, ФВ-10, ФВ-25, ФВ-28
  async cancel(bookingId, reason, actor) {
    const booking = await this.#getOrFail(bookingId);
    booking.cancel(reason, actor, this.clock.now());

    const saved = await this.bookings.update(booking);
    await this.#log(EventType.BOOKING_CANCELLED, saved, actor.id, { reason: saved.cancelReason });
    if (saved.authorId !== actor.id) this.#notifyCancelled(saved);
    return saved;
  }

  // ФВ-08
  async confirmArrival(bookingId, actor) {
    const booking = await this.#getOrFail(bookingId);
    booking.confirmArrival(actor, this.clock.now());

    const saved = await this.bookings.update(booking);
    await this.#log(EventType.BOOKING_CONFIRMED, saved, actor.id);
    return saved;
  }

  // ФВ-02
  async getDaySchedule(isoDay) {
    const range = dayRange(isoDay);
    if (!range) throw new ValidationError('Вкажіть дату у форматі РРРР-ММ-ДД');

    const [rooms, bookings] = await Promise.all([
      this.rooms.findAll(),
      this.bookings.findOccupying(range.from, range.to),
    ]);
    return rooms
      .filter((room) => room.isActive && !room.isDeactivatedOn(range.from))
      .map((room) => ({ room, bookings: bookings.filter((booking) => booking.roomId === room.id) }));
  }

  // ФВ-23
  async getRoomStates() {
    const now = this.clock.now();
    const [rooms, bookings] = await Promise.all([
      this.rooms.findAll(),
      this.bookings.findOccupying(now, addDays(startOfDay(now), 1)),
    ]);

    return rooms
      .filter((room) => room.isActive && !room.isDeactivatedOn(now))
      .map((room) => {
        const upcoming = bookings.filter((booking) => booking.roomId === room.id);
        const current = upcoming.find((booking) => booking.startTime <= now);
        if (current) return { room, state: RoomState.BUSY, until: current.endTime };
        return { room, state: RoomState.FREE, until: upcoming[0]?.startTime ?? null };
      });
  }

  // ФВ-20
  async autoCancelOverdue() {
    const now = this.clock.now();
    const overdue = await this.bookings.findActiveStartedBy(addMinutes(now, -ARRIVAL_WINDOW_MINUTES));

    for (const booking of overdue) {
      booking.autoCancel(now);
      const saved = await this.bookings.update(booking);
      await this.#log(EventType.BOOKING_AUTO_CANCELLED, saved, null);
      this.#notifyCancelled(saved);
    }
    return overdue.length;
  }

  // ФВ-21: лист іде за 15 хвилин до початку з допуском ±1 хвилина
  async sendDueReminders() {
    const now = this.clock.now();
    const due = await this.bookings.findAwaitingReminder(
      addMinutes(now, this.reminderMinutes - 1),
      addMinutes(now, this.reminderMinutes),
    );

    for (const booking of due) {
      booking.markReminded(now);
      await this.bookings.update(booking);
      const { author, room } = await this.#authorAndRoom(booking);
      this.notifications.sendBookingReminder({ to: author.email, roomName: room.name, startTime: booking.startTime });
    }
    return due.length;
  }

  async #notifyCancelled(booking) {
    try {
      const { author, room } = await this.#authorAndRoom(booking);
      await this.notifications.sendBookingCancelled({
        to: author.email,
        roomName: room.name,
        startTime: booking.startTime,
        reason: booking.cancelReason,
      });
    } catch (err) {
      this.logger.error(`[bookings] сповіщення про скасування ${booking.id}: ${err.message}`);
    }
  }

  async #authorAndRoom(booking) {
    const [author, room] = await Promise.all([
      this.users.findById(booking.authorId),
      this.rooms.findById(booking.roomId),
    ]);
    return { author, room };
  }

  async #getOrFail(bookingId) {
    const booking = await this.bookings.findById(bookingId);
    if (!booking) throw new NotFoundError('Бронь не знайдено');
    return booking;
  }

  #log(actionType, booking, actorId, extra = {}) {
    return this.eventLog.record({
      actorId,
      actionType,
      details: { bookingId: booking.id, roomId: booking.roomId, ...extra },
    });
  }
}
