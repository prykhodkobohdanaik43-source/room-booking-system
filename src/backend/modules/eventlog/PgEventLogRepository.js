import { EventLogEntry } from './EventLogEntry.js';
import { EventLogRepository } from './EventLogRepository.js';

function toEntry(row) {
  return new EventLogEntry({
    id: row.id,
    timestamp: row.occurred_at,
    actorId: row.actor_id,
    actionType: row.action_type,
    details: row.details,
  });
}

export class PgEventLogRepository extends EventLogRepository {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async append(entry) {
    const { rows } = await this.pool.query(
      `INSERT INTO event_log (occurred_at, actor_id, action_type, details)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [entry.timestamp, entry.actorId, entry.actionType, JSON.stringify(entry.details)],
    );
    return toEntry(rows[0]);
  }

  async findRecent(limit = 50) {
    const { rows } = await this.pool.query('SELECT * FROM event_log ORDER BY occurred_at DESC LIMIT $1', [limit]);
    return rows.map(toEntry);
  }
}
