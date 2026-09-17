import { EventLogEntry } from './EventLogEntry.js';

export class EventLogService {
  constructor({ entries, clock }) {
    this.entries = entries;
    this.clock = clock;
  }

  record({ actorId = null, actionType, details = {} }) {
    return this.entries.append(new EventLogEntry({ timestamp: this.clock.now(), actorId, actionType, details }));
  }

  recent(limit) {
    return this.entries.findRecent(limit);
  }
}
