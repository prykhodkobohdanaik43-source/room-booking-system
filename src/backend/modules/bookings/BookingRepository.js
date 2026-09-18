/* eslint-disable no-unused-vars */

export class BookingRepository {
  /**
   * @returns {Promise<import('./Booking.js').Booking>}
   * @throws {import('./SlotTakenError.js').SlotTakenError} якщо час перетинається з іншою бронню кімнати (ФВ-18)
   */
  async insert(booking) {
    throw new Error('Not implemented');
  }

  /**
   * Зберігає зміну статусу; застосовується лише до броні, яка в сховищі ще «активна».
   * @returns {Promise<import('./Booking.js').Booking>}
   */
  async update(booking) {
    throw new Error('Not implemented');
  }

  /** @returns {Promise<import('./Booking.js').Booking|null>} */
  async findById(id) {
    throw new Error('Not implemented');
  }

  /** Броні, що займають слот і перетинаються з [from, to). */
  async findOccupying(from, to) {
    throw new Error('Not implemented');
  }

  /** «Активні» броні з часом початку не пізніше за deadline. */
  async findActiveStartedBy(deadline) {
    throw new Error('Not implemented');
  }

  /** «Активні» броні без нагадування з початком у (from, to]. */
  async findAwaitingReminder(from, to) {
    throw new Error('Not implemented');
  }
}
