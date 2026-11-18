import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {recoverRestore} from './restore-state.mjs';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const dataDirectory = resolve(process.env.PROJECT_DESK_DATA_DIR || resolve(root, 'data'));

export function openDatabase(directory = dataDirectory) {
  mkdirSync(directory, { recursive: true });
  recoverRestore(directory);
  const path = resolve(directory, 'project-desk.sqlite');
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL) STRICT;');
  migrateDatabase(db);
  return { db, path };
}

export function readSettings(db) {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'theme'").get();
  return { theme: row?.value ?? 'system' };
}

export function readSummary(db) {
  const projects = Object.fromEntries(db.prepare('SELECT status, COUNT(*) AS count FROM projects WHERE deleted_at IS NULL GROUP BY status').all().map(r => [r.status, r.count]));
  return {
    projects: { total: Object.values(projects).reduce((a, b) => a + b, 0), ...Object.fromEntries(['not_started', 'in_progress', 'paused', 'completed', 'abandoned'].map(s => [s, projects[s] || 0])) },
    archived: db.prepare('SELECT COUNT(*) AS count FROM projects WHERE deleted_at IS NULL AND archived_at IS NOT NULL').get().count,
    journals: db.prepare('SELECT COUNT(*) AS count FROM journal_entries j JOIN projects p ON p.id=j.project_id WHERE j.deleted_at IS NULL AND p.deleted_at IS NULL').get().count,
    resources: db.prepare('SELECT COUNT(*) AS count FROM resources WHERE deleted_at IS NULL').get().count,
  };
}

export function migrateDatabase(db) {
  const migrations = resolve(dirname(fileURLToPath(import.meta.url)), 'migrations');
  for (const file of readdirSync(migrations).filter(f => f.endsWith('.sql')).sort()) {
    if (db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(file)) continue;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(readFileSync(resolve(migrations, file), 'utf8'));
      db.prepare('INSERT INTO schema_migrations VALUES (?, ?)').run(file, new Date().toISOString());
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); db.close(); throw error; }
  }
}
