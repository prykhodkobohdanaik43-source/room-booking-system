import { ConflictError, ForbiddenError, ValidationError } from '../../shared/errors.js';
import { addMinutes, parseDate } from '../../shared/dates.js';
import { Role } from '../users/Role.js';
import { BookingStatus, OCCUPYING_STATUSES } from './BookingStatus.js';

export const ARRIVAL_WINDOW_MINUTES = 10;

export class Booking {
  constructor({
    id = null,
    roomId,
    authorId,
    startTime,
    endTime,
    participantsCount,
    status = BookingStatus.ACTIVE,
    cancelReason = null,
    cancelledBy = null,
    reminderSentAt = null,
    createdAt = null,
  }) {
    this.id = id;
    this.roomId = roomId;
    this.authorId = authorId;
    this.startTime = startTime;
    this.endTime = endTime;
    this.participantsCount = participantsCount;
    this.status = status;
    this.cancelReason = cancelReason;
    this.cancelledBy = cancelledBy;
    this.reminderSentAt = reminderSentAt;
    this.createdAt = createdAt;
  }

  // ФВ-04, ФВ-05
  static create({ roomId, authorId, startTime, endTime, participantsCount }, now) {
    const start = parseDate(startTime);
    const end = parseDate(endTime);
    if (!roomId) throw new ValidationError('Оберіть кімнату');
    if (!start || !end) throw new ValidationError('Вкажіть час початку і завершення');
    if (!Number.isInteger(participantsCount) || participantsCount < 1) {
      throw new ValidationError('Вкажіть кількість учасників — ціле число від 1');
    }
    return new Booking({ roomId, authorId, startTime: start, endTime: end, participantsCount, createdAt: now });
  }

  get occupiesSlot() {
    return OCCUPYING_STATUSES.includes(this.status);
  }

  get arrivalDeadline() {
    return addMinutes(this.startTime, ARRIVAL_WINDOW_MINUTES);
  }

  // ФВ-18
  overlaps(other) {
    return this.roomId === other.roomId && this.startTime < other.endTime && other.startTime < this.endTime;
  }

  hasStarted(now) {
    return now >= this.startTime;
  }

  // ФВ-06, ФВ-10, ФВ-28
  cancel(reason, initiator, now) {
    this.#assertActive();
    const byAuthor = initiator.id === this.authorId;
    const text = String(reason ?? '').trim();

    if (!byAuthor && initiator.role !== Role.OFFICE_ADMIN) {
      throw new ForbiddenError('Скасувати можна лише власну бронь');
    }
    if (byAuthor && this.hasStarted(now)) {
      throw new ConflictError('Бронь уже почалася, скасувати її не можна', 'BOOKING_STARTED');
    }
    if (!byAuthor && !text) throw new ValidationError('Вкажіть причину скасування');

    this.status = BookingStatus.CANCELLED;
    this.cancelReason = byAuthor ? null : text;
    this.cancelledBy = initiator.id;
  }

  // ФВ-08
  confirmArrival(user, now) {
    this.#assertActive();
    if (user.id !== this.authorId) throw new ForbiddenError('Підтвердити прихід може лише автор броні');
    if (now < this.startTime || now >= this.arrivalDeadline) {
      throw new ConflictError(
        `Підтвердити прихід можна протягом ${ARRIVAL_WINDOW_MINUTES} хвилин після початку`,
        'ARRIVAL_WINDOW_CLOSED',
      );
    }
    this.status = BookingStatus.CONFIRMED;
  }

  // ФВ-20
  isOverdue(now) {
    return this.status === BookingStatus.ACTIVE && now >= this.arrivalDeadline;
  }

  autoCancel(now) {
    if (!this.isOverdue(now)) throw new ConflictError('Бронь не підлягає автоскасуванню', 'NOT_OVERDUE');
    this.status = BookingStatus.AUTO_CANCELLED;
    this.cancelReason = `Прихід не підтверджено протягом ${ARRIVAL_WINDOW_MINUTES} хвилин`;
  }

  markReminded(now) {
    this.reminderSentAt = now;
  }

  #assertActive() {
    if (this.status !== BookingStatus.ACTIVE) {
      throw new ConflictError('Бронь уже не активна', 'BOOKING_NOT_ACTIVE');
    }
  }
}
