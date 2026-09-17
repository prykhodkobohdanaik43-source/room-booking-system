// ФВ-22. actorId === null означає, що дію виконала система
export class EventLogEntry {
  constructor({ id = null, timestamp, actorId = null, actionType, details = {} }) {
    this.id = id;
    this.timestamp = timestamp;
    this.actorId = actorId;
    this.actionType = actionType;
    this.details = details;
  }

  get bySystem() {
    return this.actorId === null;
  }
}
