import { ValidationError } from '../../shared/errors.js';
import { startOfDay } from '../../shared/dates.js';

export class Room {
  constructor({ id = null, name, capacity, floor, isActive = true, deactivatedFrom = null, deactivatedTo = null }) {
    this.id = id;
    this.update({ name, capacity, floor });
    this.isActive = isActive;
    this.deactivatedFrom = deactivatedFrom;
    this.deactivatedTo = deactivatedTo;
  }

  // ФВ-13, ФВ-14
  update({ name = this.name, capacity = this.capacity, floor = this.floor }) {
    const trimmed = String(name ?? '').trim();
    if (!trimmed) throw new ValidationError('Назва кімнати не може бути порожньою');
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new ValidationError('Місткість кімнати має бути цілим числом, більшим за нуль');
    }
    if (!Number.isInteger(floor)) throw new ValidationError('Поверх має бути цілим числом');

    this.name = trimmed;
    this.capacity = capacity;
    this.floor = floor;
  }

  // ФВ-15
  deactivate(from, to) {
    if (!(from instanceof Date) || !(to instanceof Date) || to < from) {
      throw new ValidationError('Вкажіть коректний період деактивації');
    }
    this.deactivatedFrom = startOfDay(from);
    this.deactivatedTo = startOfDay(to);
  }

  activate() {
    this.deactivatedFrom = null;
    this.deactivatedTo = null;
  }

  isDeactivatedOn(date) {
    if (!this.deactivatedFrom || !this.deactivatedTo) return false;
    const day = startOfDay(date);
    return day >= this.deactivatedFrom && day <= this.deactivatedTo;
  }

  isAvailable(start, end) {
    return this.isActive && !this.isDeactivatedOn(start) && !this.isDeactivatedOn(end);
  }

  // ФВ-19
  fits(participantsCount) {
    return participantsCount <= this.capacity;
  }
}
