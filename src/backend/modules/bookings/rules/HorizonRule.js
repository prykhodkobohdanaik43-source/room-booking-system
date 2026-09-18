import { ValidationError } from '../../../shared/errors.js';
import { addDays, startOfDay } from '../../../shared/dates.js';
import { BookingRule } from './BookingRule.js';

// ФВ-27
export class HorizonRule extends BookingRule {
  constructor(horizonDays = 28) {
    super();
    this.horizonDays = horizonDays;
  }

  check({ booking, now }) {
    if (booking.startTime < now) {
      throw new ValidationError('Не можна бронювати час, що вже минув');
    }
    const lastDay = addDays(startOfDay(now), this.horizonDays);
    if (startOfDay(booking.startTime) > lastDay) {
      throw new ValidationError(`Бронювати можна не далі ніж на ${this.horizonDays} днів наперед`);
    }
  }
}
