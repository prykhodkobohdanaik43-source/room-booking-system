/* eslint-disable no-unused-vars */

export class BookingRule {
  /**
   * @param {{ booking: import('../Booking.js').Booking, room: import('../../rooms/Room.js').Room, now: Date }} context
   * @throws {import('../../../shared/errors.js').ValidationError}
   */
  check(context) {
    throw new Error('Not implemented');
  }
}
