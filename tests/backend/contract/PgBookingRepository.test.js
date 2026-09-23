import { afterAll, beforeAll, describe } from 'vitest';
import { migrate } from '../../../src/backend/db/migrate.js';
import { createPool } from '../../../src/backend/db/pool.js';
import { PgBookingRepository } from '../../../src/backend/modules/bookings/PgBookingRepository.js';
import { silentLogger } from '../../helpers/fakes.js';
import { describeBookingRepository } from './bookingRepositoryContract.js';

// Запускається лише коли задано TEST_DATABASE_URL (у CI — сервіс postgres, локально — docker compose)
const databaseUrl = process.env.TEST_DATABASE_URL;
const pool = databaseUrl ? createPool(databaseUrl) : null;

beforeAll(async () => {
  if (pool) await migrate(pool, { logger: silentLogger });
});

afterAll(async () => {
  await pool?.end();
});

describeBookingRepository(
  'PgBookingRepository',
  async () => {
    await pool.query('TRUNCATE event_log, bookings, rooms, users CASCADE');
    const rooms = await pool.query(
      `INSERT INTO rooms (name, capacity, floor) VALUES ('Десна', 4, 2), ('Ворскла', 6, 2) RETURNING id`,
    );
    const users = await pool.query(
      `INSERT INTO users (full_name, email, role)
       VALUES ('Олена Коваленко', 'olena.kovalenko@example.com', 'EMPLOYEE'),
              ('Андрій Ткачук', 'andrii.tkachuk@example.com', 'EMPLOYEE') RETURNING id`,
    );
    return {
      repo: new PgBookingRepository(pool),
      roomId: rooms.rows[0].id,
      otherRoomId: rooms.rows[1].id,
      authorId: users.rows[0].id,
      otherAuthorId: users.rows[1].id,
    };
  },
  databaseUrl ? describe : describe.skip,
);
