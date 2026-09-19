import { describe, expect, it } from 'vitest';
import { Booking } from '../../../src/backend/modules/bookings/Booking.js';
import { BookingRule } from '../../../src/backend/modules/bookings/rules/BookingRule.js';
import {
  CapacityRule,
  HorizonRule,
  RoomAvailabilityRule,
  TimeRangeRule,
  defaultBookingRules,
} from '../../../src/backend/modules/bookings/rules/index.js';
import { Room } from '../../../src/backend/modules/rooms/Room.js';
import { ValidationError } from '../../../src/backend/shared/errors.js';

const now = new Date(2026, 8, 21, 9, 0);
const onDay = (offset, hours = 10) => new Date(2026, 8, 21 + offset, hours, 0);

const room = new Room({ id: 'room-1', name: 'Десна', capacity: 4, floor: 2 });

function context({ start = onDay(0), end = onDay(0, 11), participants = 3, inRoom = room } = {}) {
  const booking = new Booking({
    roomId: inRoom.id,
    authorId: 'user-1',
    startTime: start,
    endTime: end,
    participantsCount: participants,
  });
  return { booking, room: inRoom, now };
}

describe('правила бронювання', () => {
  it('усі правила мають спільний інтерфейс BookingRule', () => {
    for (const rule of defaultBookingRules({ horizonDays: 28 })) {
      expect(rule).toBeInstanceOf(BookingRule);
      expect(() => rule.check(context())).not.toThrow();
    }
  });

  it('TimeRangeRule: завершення має бути пізнішим за початок (ФВ-04)', () => {
    const rule = new TimeRangeRule();
    expect(() => rule.check(context({ start: onDay(0, 11), end: onDay(0, 10) }))).toThrow(ValidationError);
    expect(() => rule.check(context({ start: onDay(0, 10), end: onDay(0, 10) }))).toThrow(ValidationError);
  });

  it('HorizonRule: учора — відхилено, 28-й день — дозволено, 29-й — відхилено (ФВ-27)', () => {
    const rule = new HorizonRule(28);
    expect(() => rule.check(context({ start: onDay(-1), end: onDay(-1, 11) }))).toThrow(ValidationError);
    expect(() => rule.check(context({ start: onDay(28, 18), end: onDay(28, 19) }))).not.toThrow();
    expect(() => rule.check(context({ start: onDay(29, 8), end: onDay(29, 9) }))).toThrow(ValidationError);
  });

  it('CapacityRule: учасників не більше за місткість кімнати (ФВ-19)', () => {
    const rule = new CapacityRule();
    expect(() => rule.check(context({ participants: 4 }))).not.toThrow();
    expect(() => rule.check(context({ participants: 5 }))).toThrow(/місткість/);
  });

  it('RoomAvailabilityRule: деактивовану на дату кімнату бронювати не можна (ФВ-15)', () => {
    const closed = new Room({ id: 'room-2', name: 'Ворскла', capacity: 6, floor: 2 });
    closed.deactivate(onDay(1), onDay(3));
    const rule = new RoomAvailabilityRule();

    expect(() => rule.check(context({ inRoom: closed, start: onDay(2), end: onDay(2, 11) }))).toThrow(ValidationError);
    expect(() => rule.check(context({ inRoom: closed, start: onDay(4), end: onDay(4, 11) }))).not.toThrow();
  });
});
