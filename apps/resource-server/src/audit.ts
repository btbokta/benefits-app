import type Database from 'better-sqlite3';
import type { AuditRow } from '@benefits-agent/shared';

let _db: Database.Database | null = null;

export function setDb(db: Database.Database): void {
  _db = db;
}

export function writeAudit(row: Omit<AuditRow, 'id'>): void {
  if (!_db) return;
  _db.prepare(
    `INSERT INTO audit_log (ts, actor, userSub, tool, scopeRequired, decision, httpStatus, detail, tokenJti)
     VALUES (@ts, @actor, @userSub, @tool, @scopeRequired, @decision, @httpStatus, @detail, @tokenJti)`
  ).run(row);
}
