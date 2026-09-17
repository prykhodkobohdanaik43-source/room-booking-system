import { randomUUID } from 'node:crypto';
import { EventLogEntry } from './EventLogEntry.js';
import { EventLogRepository } from './EventLogRepository.js';

export class InMemoryEventLogRepository extends EventLogRepository {
  #entries = [];

  async append(entry) {
    const stored = new EventLogEntry({ ...entry, id: randomUUID() });
    this.#entries.push(stored);
    return stored;
  }

  async findRecent(limit = 50) {
    return this.#entries.slice(-limit).reverse();
  }
}
