/**
 * Applies the SQL files in ./migrations in name order, each in its own transaction.
 *
 *   npm run migrate
 *
 * - Applied files are recorded in schema_migrations with a SHA-256 checksum.
 *   Editing an applied migration makes the runner stop: add a new migration instead.
 * - A Postgres advisory lock stops two runners (for example two deploys) from racing.
 * - Only needs DATABASE_URL, so it can run before the app's other secrets exist.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { config } from 'dotenv';
import pg from 'pg';

config({ quiet: true });

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'migrations');
const LOCK_ID = 7_340_019_001; // Arbitrary, unique to this app.

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');

  const client = new pg.Client({
    connectionString,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
    application_name: 'ff-arena-migrate',
  });
  await client.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT PRIMARY KEY,
        checksum   TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const applied = new Map(
      (await client.query<{ filename: string; checksum: string }>('SELECT filename, checksum FROM schema_migrations')).rows.map(
        (row) => [row.filename, row.checksum]
      )
    );

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => /^\d{3}_[\w-]+\.sql$/.test(f)).sort();
    let ran = 0;

    for (const file of files) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const previous = applied.get(file);

      if (previous) {
        if (previous !== checksum) {
          throw new Error(`${file} was changed after it was applied. Revert it and add a new migration instead.`);
        }
        continue;
      }

      process.stdout.write(`Applying ${file} ... `);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)', [file, checksum]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        process.stdout.write('failed\n');
        throw error;
      }
      process.stdout.write('done\n');
      ran += 1;
    }

    console.log(ran === 0 ? 'Database is up to date.' : `Applied ${ran} migration(s).`);
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
