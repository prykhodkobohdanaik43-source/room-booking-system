import { ValidationError } from '../../../shared/errors.js';
import { BookingRule } from './BookingRule.js';

// ФВ-19
export class CapacityRule extends BookingRule {
  check({ booking, room }) {
    if (!room.fits(booking.participantsCount)) {
      throw new ValidationError(`Перевищено місткість кімнати: «${room.name}» вміщує до ${room.capacity} осіб`);
    }
  }
}
