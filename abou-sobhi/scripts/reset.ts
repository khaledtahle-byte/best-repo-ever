/**
 * Deletes the database file and rebuilds it from the schema and the printed
 * menu. Destructive — every order is lost.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../lib/db';

const file = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(process.cwd(), 'data', 'abou-sobhi.db');

for (const suffix of ['', '-shm', '-wal']) {
  fs.rmSync(`${file}${suffix}`, { force: true });
}

getDb();
console.log(`Rebuilt ${file} from the schema and the printed menu.`);
