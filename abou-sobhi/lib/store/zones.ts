import type { Db } from '../db';
import { getDb } from '../db';
import type { Zone } from '../types';

interface ZoneRow {
  id: number;
  name_ar: string;
  name_en: string;
  fee_lbp: number;
  active: number;
}

const toZone = (row: ZoneRow): Zone => ({
  id: row.id,
  nameAr: row.name_ar,
  nameEn: row.name_en,
  feeLbp: row.fee_lbp,
  active: row.active === 1,
});

export function listZones(db: Db = getDb(), opts: { activeOnly?: boolean } = {}): Zone[] {
  const where = opts.activeOnly ? 'WHERE active = 1' : '';
  const rows = db
    .prepare(`SELECT * FROM zones ${where} ORDER BY sort, id`)
    .all() as ZoneRow[];
  return rows.map(toZone);
}

export function getZone(id: number, db: Db = getDb()): Zone | null {
  const row = db.prepare('SELECT * FROM zones WHERE id = ?').get(id) as ZoneRow | undefined;
  return row ? toZone(row) : null;
}

export function createZone(
  input: { nameAr: string; nameEn: string; feeLbp: number },
  db: Db = getDb(),
): number {
  const sort =
    (db.prepare('SELECT COALESCE(MAX(sort), -1) AS s FROM zones').get() as { s: number }).s + 1;
  const result = db
    .prepare('INSERT INTO zones (name_ar, name_en, fee_lbp, sort) VALUES (?, ?, ?, ?)')
    .run(input.nameAr, input.nameEn, Math.max(0, Math.round(input.feeLbp)), sort);
  return Number(result.lastInsertRowid);
}

export function updateZone(
  id: number,
  patch: { nameAr?: string; nameEn?: string; feeLbp?: number; active?: boolean },
  db: Db = getDb(),
): void {
  const current = getZone(id, db);
  if (!current) return;
  db.prepare('UPDATE zones SET name_ar = ?, name_en = ?, fee_lbp = ?, active = ? WHERE id = ?').run(
    patch.nameAr ?? current.nameAr,
    patch.nameEn ?? current.nameEn,
    Math.max(0, Math.round(patch.feeLbp ?? current.feeLbp)),
    (patch.active ?? current.active) ? 1 : 0,
    id,
  );
}

/** Zones are kept as history on past orders, so deleting one only hides it. */
export function deleteZone(id: number, db: Db = getDb()): void {
  db.prepare('UPDATE zones SET active = 0 WHERE id = ?').run(id);
}
