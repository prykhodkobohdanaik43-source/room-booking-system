import { describe, expect, it } from 'vitest';
import { Room } from '../../../src/backend/modules/rooms/Room.js';
import { ValidationError } from '../../../src/backend/shared/errors.js';

const day = (date) => new Date(2026, 8, date, 12, 0);

describe('Room', () => {
  it('створюється з назвою, місткістю і поверхом (ФВ-13)', () => {
    const room = new Room({ name: '  Десна ', capacity: 4, floor: 2 });
    expect(room).toMatchObject({ name: 'Десна', capacity: 4, floor: 2, isActive: true });
  });

  it.each([
    ['порожня назва', { name: ' ', capacity: 4, floor: 2 }],
    ['місткість 0', { name: 'Десна', capacity: 0, floor: 2 }],
    ["від'ємна місткість", { name: 'Десна', capacity: -3, floor: 2 }],
    ['дробова місткість', { name: 'Десна', capacity: 4.5, floor: 2 }],
  ])('відхиляє некоректні дані: %s (ФВ-13)', (_label, props) => {
    expect(() => new Room(props)).toThrow(ValidationError);
  });

  it('змінює місткість, і нове значення одразу бере участь у перевірці (ФВ-14, ФВ-19)', () => {
    const room = new Room({ name: 'Десна', capacity: 4, floor: 2 });
    expect(room.fits(6)).toBe(false);
    room.update({ capacity: 6 });
    expect(room.fits(6)).toBe(true);
    expect(room.name).toBe('Десна');
  });

  it('деактивована на період кімната недоступна лише в цьому періоді (ФВ-15)', () => {
    const room = new Room({ name: 'Десна', capacity: 4, floor: 2 });
    room.deactivate(day(22), day(24));

    expect(room.isAvailable(day(21), day(21))).toBe(true);
    expect(room.isAvailable(day(22), day(22))).toBe(false);
    expect(room.isAvailable(day(24), day(24))).toBe(false);
    expect(room.isAvailable(day(25), day(25))).toBe(true);
  });

  it('не приймає період, у якому кінець раніший за початок', () => {
    const room = new Room({ name: 'Десна', capacity: 4, floor: 2 });
    expect(() => room.deactivate(day(24), day(22))).toThrow(ValidationError);
  });
});
