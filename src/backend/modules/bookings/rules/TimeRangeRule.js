import { ValidationError } from '../../../shared/errors.js';
import { BookingRule } from './BookingRule.js';

// ФВ-04
export class TimeRangeRule extends BookingRule {
  check({ booking }) {
    if (booking.endTime <= booking.startTime) {
      throw new ValidationError('Час завершення має бути пізнішим за час початку');
    }
  }
}
