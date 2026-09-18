import { ValidationError } from '../../../shared/errors.js';
import { BookingRule } from './BookingRule.js';

// ФВ-15
export class RoomAvailabilityRule extends BookingRule {
  check({ booking, room }) {
    if (!room.isAvailable(booking.startTime, booking.endTime)) {
      throw new ValidationError(`Кімната «${room.name}» недоступна для бронювання на цю дату`);
    }
  }
}
