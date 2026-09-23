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

  /**
   * ФВ-07: зберігає нову кімнату, час і кількість учасників «активної» броні.
   * @throws {import('./SlotTakenError.js').SlotTakenError} якщо новий час перетинається з іншою бронню (ФВ-18)
   */
  async updateSchedule(booking) {
    throw new Error('Not implemented');
  }

  /** Броні автора у статусах «активна» і «підтверджена», що ще не завершилися до from. */
  async findByAuthor(authorId, from) {
    throw new Error('Not implemented');
  }

  /** ФВ-09: усі броні, що займають слот і не завершилися до from. */
  async findUpcoming(from) {
    throw new Error('Not implemented');
  }

  /** ФВ-11: броні всіх статусів з початком у [from, to). */
  async findByPeriod(from, to) {
    throw new Error('Not implemented');
  }

  /** ФВ-26: «активні» броні кімнати з початком у [from, to). */
  async findActiveByRoom(roomId, from, to) {
    throw new Error('Not implemented');
  }
}
