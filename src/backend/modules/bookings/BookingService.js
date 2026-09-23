import { AppError, ConflictError, NotFoundError, ValidationError } from '../../shared/errors.js';
import { toCsv } from '../../shared/csv.js';
import { addDays, addMinutes, dayRange, parseDate, periodRange, startOfDay, toIsoDay } from '../../shared/dates.js';
import { EventType } from '../eventlog/EventType.js';
import { ARRIVAL_WINDOW_MINUTES, Booking } from './Booking.js';
import { BookingStatus } from './BookingStatus.js';

export const RoomState = Object.freeze({ FREE: 'FREE', BUSY: 'BUSY' });

const WEEK_DAYS = 7;
const MAX_REPORT_DAYS = 366;
const MAX_SERIES_WEEKS = 8;
const DEACTIVATION_REASON = 'деактивація кімнати';
const MS_PER_HOUR = 3_600_000;

export class BookingService {
  constructor({
    bookings,
    rooms,
    users,
    eventLog,
    notifications,
    clock,
    rules,
    horizonDays = 28,
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
    this.horizonDays = horizonDays;
    this.reminderMinutes = reminderMinutes;
    this.logger = logger;
  }

  // ФВ-04, ФВ-05, ФВ-18, ФВ-19, ФВ-27
  async create(input, actor) {
    const now = this.clock.now();
    const booking = Booking.create({ ...input, authorId: actor.id }, now);

    const room = await this.#roomOrFail(booking.roomId);
    this.#checkRules(booking, room, now);

    const saved = await this.bookings.insert(booking);
    await this.#log(EventType.BOOKING_CREATED, saved, actor.id);
    return saved;
  }

  // ФВ-24: серія щотижневих броней — окрема бронь на кожен тиждень; тижні з конфліктом пропускаються
  async createSeries(input, weeks, actor) {
    const now = this.clock.now();
    if (!Number.isInteger(weeks) || weeks < 2 || weeks > MAX_SERIES_WEEKS) {
      throw new ValidationError(`Серія має містити від 2 до ${MAX_SERIES_WEEKS} тижнів`);
    }

    const first = Booking.create({ ...input, authorId: actor.id }, now);
    const room = await this.#roomOrFail(first.roomId);
    // Помилка першого тижня або вихід серії за горизонт — помилка всієї серії, а не пропуск тижня
    this.#checkRules(first, room, now);
    this.#assertSeriesWithinHorizon(first, weeks, now);

    const created = [];
    const skipped = [];
    for (let week = 0; week < weeks; week += 1) {
      const booking = new Booking({
        ...first,
        startTime: addDays(first.startTime, week * WEEK_DAYS),
        endTime: addDays(first.endTime, week * WEEK_DAYS),
      });
      try {
        this.#checkRules(booking, room, now);
        const saved = await this.bookings.insert(booking);
        await this.#log(EventType.BOOKING_CREATED, saved, actor.id, { seriesWeek: week + 1 });
        created.push(saved);
      } catch (err) {
        if (!(err instanceof AppError) || ![409, 422].includes(err.status)) throw err;
        skipped.push({ week: week + 1, startTime: booking.startTime, endTime: booking.endTime, reason: err.message });
      }
    }

    if (created.length === 0) {
      throw new ConflictError('Жоден тиждень серії не вдалося забронювати', 'SERIES_EMPTY', { skipped });
    }
    return { created, skipped };
  }

  // ФВ-07, ФВ-18, ФВ-19, ФВ-27, ФВ-28
  async update(bookingId, changes, actor) {
    const now = this.clock.now();
    const booking = await this.#getOrFail(bookingId);
    booking.reschedule(changes, actor, now);

    const room = await this.#roomOrFail(booking.roomId);
    this.#checkRules(booking, room, now);

    const saved = await this.bookings.updateSchedule(booking);
    await this.#log(EventType.BOOKING_UPDATED, saved, actor.id);
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

  // ФВ-06–ФВ-08: «мої броні» — те, що ще не завершилося
  async getMyBookings(actor) {
    const bookings = await this.bookings.findByAuthor(actor.id, this.clock.now());
    return this.#withNames(bookings);
  }

  // ФВ-02
  async getDaySchedule(isoDay) {
    const range = dayRange(isoDay);
    if (!range) throw new ValidationError('Вкажіть дату у форматі РРРР-ММ-ДД');

    const [rooms, bookings] = await Promise.all([
      this.rooms.findAll(),
      this.bookings.findOccupying(range.from, range.to),
    ]);
    return this.#buildDay(rooms, bookings, range.from, range.to);
  }

  // ФВ-03: 7 днів поспіль, починаючи з указаної дати; один запит до бази на весь тиждень
  async getWeekSchedule(isoDay) {
    const range = dayRange(isoDay);
    if (!range) throw new ValidationError('Вкажіть дату у форматі РРРР-ММ-ДД');

    const weekEnd = addDays(range.from, WEEK_DAYS);
    const [rooms, bookings] = await Promise.all([
      this.rooms.findAll(),
      this.bookings.findOccupying(range.from, weekEnd),
    ]);
    return Array.from({ length: WEEK_DAYS }, (_, index) => {
      const from = addDays(range.from, index);
      return { date: toIsoDay(from), rooms: this.#buildDay(rooms, bookings, from, addDays(from, 1)) };
    });
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

  // ФВ-30: попередження, а не заборона — повертає вільні менші кімнати, у які вміщаються учасники
  async findSmallerFreeRooms({ roomId, startTime, endTime, participantsCount }) {
    const start = parseDate(startTime);
    const end = parseDate(endTime);
    if (!roomId || !start || !end || end <= start) return [];
    if (!Number.isInteger(participantsCount) || participantsCount < 1) return [];

    const selected = await this.rooms.findById(roomId);
    if (!selected) return [];

    const [rooms, occupied] = await Promise.all([this.rooms.findAll(), this.bookings.findOccupying(start, end)]);
    const busyRoomIds = new Set(occupied.map((booking) => booking.roomId));
    return rooms.filter(
      (room) =>
        room.id !== selected.id &&
        room.capacity < selected.capacity &&
        room.fits(participantsCount) &&
        room.isAvailable(start, end) &&
        !busyRoomIds.has(room.id),
    );
  }

  // ФВ-09: поточні й майбутні броні всіх кімнат з авторами
  async listUpcoming() {
    return this.#withNames(await this.bookings.findUpcoming(this.clock.now()));
  }

  // ФВ-11: історія за період, включно зі скасованими й автоскасованими
  async history(fromDay, toDay) {
    const range = this.#reportRange(fromDay, toDay);
    return this.#withNames(await this.bookings.findByPeriod(range.from, range.to));
  }

  // ФВ-12: години підтверджених броней на кімнату за період; автоскасовані не враховуються
  async utilizationCsv(fromDay, toDay) {
    const range = this.#reportRange(fromDay, toDay);
    const [rooms, bookings] = await Promise.all([
      this.rooms.findAll(),
      this.bookings.findByPeriod(range.from, range.to),
    ]);
    const confirmed = bookings.filter((booking) => booking.status === BookingStatus.CONFIRMED);

    const rows = rooms.map((room) => {
      const own = confirmed.filter((booking) => booking.roomId === room.id);
      const hours = own.reduce((sum, booking) => sum + (booking.endTime - booking.startTime) / MS_PER_HOUR, 0);
      return [room.name, room.floor, room.capacity, own.length, Number(hours.toFixed(2))];
    });
    return toCsv([['Кімната', 'Поверх', 'Місткість', 'Підтверджених броней', 'Годин підтверджених броней'], ...rows]);
  }

  // ФВ-26: слухач деактивації кімнати — скасовує «активні» броні періоду з причиною і сповіщає авторів
  async onRoomDeactivated(room, { from, to }) {
    const bookings = await this.bookings.findActiveByRoom(room.id, startOfDay(from), addDays(startOfDay(to), 1));

    for (const booking of bookings) {
      booking.cancelBySystem(DEACTIVATION_REASON);
      const saved = await this.bookings.update(booking);
      await this.#log(EventType.BOOKING_CANCELLED, saved, null, { reason: DEACTIVATION_REASON });
      this.#notifyCancelled(saved);
    }
    return bookings.length;
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

  #checkRules(booking, room, now) {
    for (const rule of this.rules) rule.check({ booking, room, now });
  }

  // ФВ-27: остання бронь серії теж має вкластися в горизонт бронювання
  #assertSeriesWithinHorizon(first, weeks, now) {
    const lastStart = addDays(first.startTime, (weeks - 1) * WEEK_DAYS);
    if (startOfDay(lastStart) > addDays(startOfDay(now), this.horizonDays)) {
      throw new ValidationError(
        `Серія з ${weeks} тижнів виходить за горизонт бронювання (${this.horizonDays} днів наперед)`,
      );
    }
  }

  #buildDay(rooms, bookings, from, to) {
    return rooms
      .filter((room) => room.isActive && !room.isDeactivatedOn(from))
      .map((room) => ({
        room,
        bookings: bookings.filter(
          (booking) => booking.roomId === room.id && booking.startTime < to && booking.endTime > from,
        ),
      }));
  }

  #reportRange(fromDay, toDay) {
    const range = periodRange(fromDay, toDay);
    if (!range) throw new ValidationError('Вкажіть період: from і to у форматі РРРР-ММ-ДД, to не раніше за from');
    if ((range.to - range.from) / (24 * MS_PER_HOUR) > MAX_REPORT_DAYS) {
      throw new ValidationError(`Період не може перевищувати ${MAX_REPORT_DAYS} днів`);
    }
    return range;
  }

  // Додає до броней назви кімнат та імена авторів; користувачі й кімнати читаються по одному разу
  async #withNames(bookings) {
    const [rooms, users] = await Promise.all([this.rooms.findAll(), this.users.findAll()]);
    const roomNames = new Map(rooms.map((room) => [room.id, room.name]));
    const userNames = new Map(users.map((user) => [user.id, user.fullName]));
    return bookings.map((booking) => ({
      ...booking,
      roomName: roomNames.get(booking.roomId) ?? null,
      authorName: userNames.get(booking.authorId) ?? null,
      cancelledByName: booking.cancelledBy ? (userNames.get(booking.cancelledBy) ?? null) : null,
    }));
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

  async #roomOrFail(roomId) {
    const room = await this.rooms.findById(roomId);
    if (!room) throw new NotFoundError('Кімнату не знайдено');
    return room;
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
