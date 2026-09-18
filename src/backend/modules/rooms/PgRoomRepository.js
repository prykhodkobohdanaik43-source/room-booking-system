import { toIsoDay } from '../../shared/dates.js';
import { ConflictError } from '../../shared/errors.js';
import { Room } from './Room.js';
import { RoomRepository } from './RoomRepository.js';

const UNIQUE_VIOLATION = '23505';

function toRoom(row) {
  if (!row) return null;
  return new Room({
    id: row.id,
    name: row.name,
    capacity: row.capacity,
    floor: row.floor,
    isActive: row.is_active,
    deactivatedFrom: row.deactivated_from,
    deactivatedTo: row.deactivated_to,
  });
}

export class PgRoomRepository extends RoomRepository {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async findAll() {
    const { rows } = await this.pool.query('SELECT * FROM rooms ORDER BY capacity, name');
    return rows.map(toRoom);
  }

  async findById(id) {
    const { rows } = await this.pool.query('SELECT * FROM rooms WHERE id = $1', [id]);
    return toRoom(rows[0]);
  }

  async insert(room) {
    return this.#write(
      `INSERT INTO rooms (name, capacity, floor, is_active, deactivated_from, deactivated_to)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        room.name,
        room.capacity,
        room.floor,
        room.isActive,
        toIsoDay(room.deactivatedFrom),
        toIsoDay(room.deactivatedTo),
      ],
    );
  }

  async update(room) {
    return this.#write(
      `UPDATE rooms
          SET name = $2, capacity = $3, floor = $4, is_active = $5,
              deactivated_from = $6, deactivated_to = $7
        WHERE id = $1
        RETURNING *`,
      [
        room.id,
        room.name,
        room.capacity,
        room.floor,
        room.isActive,
        toIsoDay(room.deactivatedFrom),
        toIsoDay(room.deactivatedTo),
      ],
    );
  }

  async #write(sql, params) {
    try {
      const { rows } = await this.pool.query(sql, params);
      return toRoom(rows[0]);
    } catch (err) {
      if (err.code === UNIQUE_VIOLATION) throw new ConflictError('Кімната з такою назвою вже існує', 'ROOM_NAME_TAKEN');
      throw err;
    }
  }
}
