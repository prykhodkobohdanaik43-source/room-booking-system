import { NotFoundError } from '../../shared/errors.js';
import { parseDay } from '../../shared/dates.js';
import { EventType } from '../eventlog/EventType.js';
import { Room } from './Room.js';

export class RoomService {
  constructor({ rooms, eventLog }) {
    this.rooms = rooms;
    this.eventLog = eventLog;
  }

  list() {
    return this.rooms.findAll();
  }

  // ФВ-13
  async create({ name, capacity, floor }, actor) {
    const room = await this.rooms.insert(new Room({ name, capacity, floor }));
    await this.#log(EventType.ROOM_CREATED, room, actor);
    return room;
  }

  // ФВ-14
  async update(roomId, changes, actor) {
    const room = await this.#getOrFail(roomId);
    room.update(changes);
    const saved = await this.rooms.update(room);
    await this.#log(EventType.ROOM_UPDATED, saved, actor);
    return saved;
  }

  // ФВ-15
  async deactivate(roomId, { from, to }, actor) {
    const room = await this.#getOrFail(roomId);
    room.deactivate(parseDay(from), parseDay(to));
    const saved = await this.rooms.update(room);
    await this.#log(EventType.ROOM_DEACTIVATED, saved, actor);
    return saved;
  }

  async #getOrFail(roomId) {
    const room = await this.rooms.findById(roomId);
    if (!room) throw new NotFoundError('Кімнату не знайдено');
    return room;
  }

  #log(actionType, room, actor) {
    return this.eventLog.record({ actorId: actor.id, actionType, details: { roomId: room.id, name: room.name } });
  }
}
