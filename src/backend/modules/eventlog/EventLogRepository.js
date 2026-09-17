/* eslint-disable no-unused-vars */

export class EventLogRepository {
  /** @returns {Promise<import('./EventLogEntry.js').EventLogEntry>} */
  async append(entry) {
    throw new Error('Not implemented');
  }

  /** @returns {Promise<import('./EventLogEntry.js').EventLogEntry[]>} */
  async findRecent(limit) {
    throw new Error('Not implemented');
  }
}
