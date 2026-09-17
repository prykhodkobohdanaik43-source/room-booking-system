import { randomUUID } from 'node:crypto';
import { ConflictError } from '../../shared/errors.js';
import { Room } from './Room.js';
import { RoomRepository } from './RoomRepository.js';

export class InMemoryRoomRepository extends RoomRepository {
  #items = new Map();

  async findAll() {
    return [...this.#items.values()].sort((a, b) => a.capacity - b.capacity).map((room) => new Room({ ...room }));
  }

  async findById(id) {
    const room = this.#items.get(id);
    return room ? new Room({ ...room }) : null;
  }

  async insert(room) {
    this.#assertUniqueName(room);
    const stored = new Room({ ...room, id: room.id ?? randomUUID() });
    this.#items.set(stored.id, stored);
    return new Room({ ...stored });
  }

  async update(room) {
    this.#assertUniqueName(room);
    this.#items.set(room.id, new Room({ ...room }));
    return new Room({ ...room });
  }

  #assertUniqueName(room) {
    const name = room.name.toLowerCase();
    const taken = [...this.#items.values()].some((other) => other.id !== room.id && other.name.toLowerCase() === name);
    if (taken) throw new ConflictError('Кімната з такою назвою вже існує', 'ROOM_NAME_TAKEN');
  }
}
