export const BookingStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  AUTO_CANCELLED: 'AUTO_CANCELLED',
});

// Слот вважається зайнятим, доки бронь у статусі «активна» або «підтверджена»
export const OCCUPYING_STATUSES = Object.freeze([BookingStatus.ACTIVE, BookingStatus.CONFIRMED]);
