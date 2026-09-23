import { NotFoundError } from '../../shared/errors.js';
import { parseDay } from '../../shared/dates.js';
import { EventType } from '../eventlog/EventType.js';
import { Room } from './Room.js';

export class RoomService {
  #deactivationListeners = [];

  constructor({ rooms, eventLog }) {
    this.rooms = rooms;
    this.eventLog = eventLog;
  }

  // ФВ-26: інші модулі підписуються на деактивацію, не даючи Rooms залежності від себе.
  // Слухач — об'єкт з методом onRoomDeactivated(room, { from, to }), що повертає кількість скасованих броней.
  addDeactivationListener(listener) {
    this.#deactivationListeners.push(listener);
    return this;
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

    let cancelledBookings = 0;
    for (const listener of this.#deactivationListeners) {
      cancelledBookings += await listener.onRoomDeactivated(saved, {
        from: saved.deactivatedFrom,
        to: saved.deactivatedTo,
      });
    }
    return { room: saved, cancelledBookings };
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
