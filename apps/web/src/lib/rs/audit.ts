import type { AuditRow } from '@benefits-agent/shared';

// In-memory audit log — persists within a serverless instance, resets on cold start/redeploy
const log: AuditRow[] = [];
let nextId = 1;

export function writeAudit(row: Omit<AuditRow, 'id'>): void {
  log.unshift({ ...row, id: nextId++ });
  if (log.length > 500) log.pop(); // cap memory usage
}

export function readAudit(limit = 200): AuditRow[] {
  return log.slice(0, Math.min(limit, 500));
}
