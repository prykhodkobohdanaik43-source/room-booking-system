import { readdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { loadConfig } from '../config/index.js';
import { createPool } from './pool.js';

const migrationsDir = new URL('./migrations/', import.meta.url);

export async function migrate(pool, { logger = console } = {}) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  const { rows } = await pool.query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((row) => row.name));
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(new URL(file, migrationsDir), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      logger.info(`migrated: ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { databaseUrl } = loadConfig();
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');
  const pool = createPool(databaseUrl);
  try {
    await migrate(pool);
  } finally {
    await pool.end();
  }
}
