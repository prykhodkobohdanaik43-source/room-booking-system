import bcrypt from 'bcryptjs';
import { loadConfig } from '../config/index.js';
import { createPool } from './pool.js';
import { demoRooms, demoUsers } from './seedData.js';

const { databaseUrl, bcryptCost } = loadConfig();
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const pool = createPool(databaseUrl);
try {
  const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD ?? 'Passw0rd!', bcryptCost);

  for (const room of demoRooms) {
    await pool.query(
      `INSERT INTO rooms (name, capacity, floor)
       SELECT $1, $2, $3 WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE lower(name) = lower($1))`,
      [room.name, room.capacity, room.floor],
    );
  }
  for (const user of demoUsers) {
    await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      [user.fullName, user.email, passwordHash, user.role],
    );
  }
  console.info(`seeded: ${demoRooms.length} rooms, ${demoUsers.length} users`);
} finally {
  await pool.end();
}
