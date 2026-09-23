import { describe, expect, it } from 'vitest';
import { Booking } from '../../../src/backend/modules/bookings/Booking.js';
import { BookingStatus } from '../../../src/backend/modules/bookings/BookingStatus.js';
import { Role } from '../../../src/backend/modules/users/Role.js';
import { ConflictError, ForbiddenError, ValidationError } from '../../../src/backend/shared/errors.js';

const author = { id: 'user-1', role: Role.EMPLOYEE };
const colleague = { id: 'user-2', role: Role.EMPLOYEE };
const admin = { id: 'user-3', role: Role.OFFICE_ADMIN };

const at = (hours, minutes = 0, seconds = 0) => new Date(2026, 8, 21, hours, minutes, seconds);

function booking(overrides = {}) {
  return new Booking({
    id: 'booking-1',
    roomId: 'room-1',
    authorId: author.id,
    startTime: at(10),
    endTime: at(11),
    participantsCount: 3,
    ...overrides,
  });
}

describe('Booking.create', () => {
  it('створює бронь зі статусом «активна» (ФВ-04)', () => {
    const created = Booking.create(
      { roomId: 'room-1', authorId: author.id, startTime: at(10).toISOString(), endTime: at(11), participantsCount: 2 },
      at(9),
    );
    expect(created.status).toBe(BookingStatus.ACTIVE);
    expect(created.startTime).toEqual(at(10));
    expect(created.occupiesSlot).toBe(true);
  });

  it.each([0, -1, 2.5, '3', undefined])('не приймає кількість учасників %s (ФВ-05)', (participantsCount) => {
    expect(() =>
      Booking.create(
        { roomId: 'room-1', authorId: author.id, startTime: at(10), endTime: at(11), participantsCount },
        at(9),
      ),
    ).toThrow(ValidationError);
  });

  it('вимагає коректний час початку і завершення', () => {
    expect(() =>
      Booking.create(
        { roomId: 'room-1', authorId: author.id, startTime: 'завтра', endTime: at(11), participantsCount: 2 },
        at(9),
      ),
    ).toThrow(ValidationError);
  });
});

describe('Booking.overlaps (ФВ-18)', () => {
  it('бачить перетин у тій самій кімнаті', () => {
    expect(booking().overlaps(booking({ startTime: at(10, 30), endTime: at(11, 30) }))).toBe(true);
  });

  it('суміжні слоти не перетинаються', () => {
    expect(booking().overlaps(booking({ startTime: at(11), endTime: at(12) }))).toBe(false);
  });

  it('інша кімната не конфліктує', () => {
    expect(booking().overlaps(booking({ roomId: 'room-2' }))).toBe(false);
  });
});

describe('Booking.cancel', () => {
  it('автор скасовує власну бронь до початку (ФВ-06)', () => {
    const own = booking();
    own.cancel(undefined, author, at(9, 59));
    expect(own.status).toBe(BookingStatus.CANCELLED);
    expect(own.cancelledBy).toBe(author.id);
    expect(own.occupiesSlot).toBe(false);
  });

  it('після початку автор скасувати вже не може (ФВ-06)', () => {
    expect(() => booking().cancel(undefined, author, at(10))).toThrow(ConflictError);
  });

  it('інший співробітник не може скасувати чужу бронь (ФВ-28)', () => {
    expect(() => booking().cancel('потрібна кімната', colleague, at(9))).toThrow(ForbiddenError);
  });

  it('адміністратор офісу скасовує чужу бронь лише з причиною (ФВ-10)', () => {
    const foreign = booking();
    expect(() => foreign.cancel('  ', admin, at(9))).toThrow(ValidationError);

    foreign.cancel('Термінова нарада', admin, at(9));
    expect(foreign.status).toBe(BookingStatus.CANCELLED);
    expect(foreign.cancelReason).toBe('Термінова нарада');
    expect(foreign.cancelledBy).toBe(admin.id);
  });

  it('кінцеві статуси не змінюються', () => {
    const cancelled = booking({ status: BookingStatus.CANCELLED });
    expect(() => cancelled.cancel(undefined, author, at(9))).toThrow(ConflictError);
  });
});

describe('Booking.confirmArrival (ФВ-08)', () => {
  it('підтверджує прихід у межах 10 хвилин після початку', () => {
    const own = booking();
    own.confirmArrival(author, at(10, 9, 59));
    expect(own.status).toBe(BookingStatus.CONFIRMED);
  });

  it('до початку і після 10-ї хвилини відмітка недоступна', () => {
    expect(() => booking().confirmArrival(author, at(9, 59, 59))).toThrow(ConflictError);
    expect(() => booking().confirmArrival(author, at(10, 10))).toThrow(ConflictError);
  });

  it('відмітку ставить лише автор', () => {
    expect(() => booking().confirmArrival(admin, at(10, 5))).toThrow(ForbiddenError);
  });
});

describe('Booking.autoCancel (ФВ-20, НФВ-07)', () => {
  it('не спрацьовує раніше ніж через 10 хв 00 с після початку', () => {
    const own = booking();
    expect(own.isOverdue(at(10, 9, 59))).toBe(false);
    expect(() => own.autoCancel(at(10, 9, 59))).toThrow(ConflictError);
  });

  it('через 10 хвилин без відмітки бронь стає «автоскасованою»', () => {
    const own = booking();
    own.autoCancel(at(10, 10));
    expect(own.status).toBe(BookingStatus.AUTO_CANCELLED);
    expect(own.occupiesSlot).toBe(false);
  });

  it('підтверджена бронь не автоскасовується', () => {
    const own = booking();
    own.confirmArrival(author, at(10, 1));
    expect(own.isOverdue(at(10, 30))).toBe(false);
  });
});

describe('Booking.reschedule (ФВ-07, ФВ-28)', () => {
  it('автор змінює час, кімнату й кількість учасників до початку', () => {
    const item = booking();
    item.reschedule({ roomId: 'room-2', startTime: at(14), endTime: at(15), participantsCount: 5 }, author, at(9));
    expect(item).toMatchObject({ roomId: 'room-2', startTime: at(14), endTime: at(15), participantsCount: 5 });
    expect(item.status).toBe(BookingStatus.ACTIVE);
  });

  it('незадані поля лишаються як були', () => {
    const item = booking();
    item.reschedule({ participantsCount: 4 }, author, at(9));
    expect(item).toMatchObject({ roomId: 'room-1', startTime: at(10), participantsCount: 4 });
  });

  it('після зміни часу нагадування надсилається знову', () => {
    const item = booking({ reminderSentAt: at(9, 45) });
    item.reschedule({ startTime: at(15), endTime: at(16) }, author, at(9));
    expect(item.reminderSentAt).toBeNull();
  });

  it('чужу бронь співробітник і адміністратор редагувати не можуть (ФВ-28)', () => {
    expect(() => booking().reschedule({ participantsCount: 2 }, colleague, at(9))).toThrow(ForbiddenError);
    expect(() => booking().reschedule({ participantsCount: 2 }, admin, at(9))).toThrow(ForbiddenError);
  });

  it('після початку броні редагування недоступне', () => {
    expect(() => booking().reschedule({ participantsCount: 2 }, author, at(10))).toThrow(ConflictError);
  });

  it('скасовану бронь редагувати не можна', () => {
    const item = booking({ status: BookingStatus.CANCELLED });
    expect(() => item.reschedule({ participantsCount: 2 }, author, at(9))).toThrow(ConflictError);
  });

  it('відхиляє некоректну кількість учасників (ФВ-05)', () => {
    expect(() => booking().reschedule({ participantsCount: 0 }, author, at(9))).toThrow(ValidationError);
  });
});

describe('Booking.cancelBySystem (ФВ-26)', () => {
  it('скасовує «активну» бронь з причиною і без користувача-ініціатора', () => {
    const item = booking();
    item.cancelBySystem('деактивація кімнати');
    expect(item).toMatchObject({
      status: BookingStatus.CANCELLED,
      cancelReason: 'деактивація кімнати',
      cancelledBy: null,
    });
  });

  it('не скасовує підтверджену бронь', () => {
    expect(() => booking({ status: BookingStatus.CONFIRMED }).cancelBySystem('деактивація кімнати')).toThrow(
      ConflictError,
    );
  });
});
