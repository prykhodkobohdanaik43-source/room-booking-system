import request from 'supertest';
import { createApp } from '../../src/backend/app.js';
import { loadConfig } from '../../src/backend/config/index.js';
import { buildContainer, createMemoryStorage, seedDemoData } from '../../src/backend/container.js';
import { FixedClock } from './FixedClock.js';
import { FakeHasher, RecordingChannel, silentLogger } from './fakes.js';

export const PASSWORD = 'Passw0rd!';
export const EMPLOYEE = 'olena.kovalenko@example.com';
export const EMPLOYEE_2 = 'andrii.tkachuk@example.com';
export const OFFICE_ADMIN = 'iryna.melnyk@example.com';
export const IT = 'taras.shevchuk@example.com';

// понеділок, 21 вересня 2026 р., 09:00 за часом сервера
export const MONDAY_9AM = new Date(2026, 8, 21, 9, 0, 0);

export function at(hours, minutes = 0, seconds = 0) {
  return new Date(2026, 8, 21, hours, minutes, seconds);
}

export function onDay(dayOffset, hours = 10, minutes = 0) {
  return new Date(2026, 8, 21 + dayOffset, hours, minutes, 0);
}

export async function createTestApp({ now = MONDAY_9AM, env = {} } = {}) {
  const clock = new FixedClock(now);
  const channel = new RecordingChannel();
  const config = loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test-secret', ...env });
  const container = buildContainer(config, {
    clock,
    channel,
    hasher: new FakeHasher(),
    storage: createMemoryStorage(),
    logger: silentLogger,
  });
  await seedDemoData(container.storage, container.hasher, PASSWORD);

  const app = createApp(container);
  const rooms = await container.storage.rooms.findAll();

  async function loginAs(email) {
    const response = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
    return response.body.token;
  }

  function roomFor(capacity) {
    return rooms.find((room) => room.capacity === capacity);
  }

  function book(token, { room = roomFor(4), start = at(10), end = at(11), participants = 3 } = {}) {
    return request(app).post('/api/bookings').set('Authorization', `Bearer ${token}`).send({
      roomId: room.id,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      participantsCount: participants,
    });
  }

  return { app, container, clock, channel, loginAs, roomFor, book };
}
