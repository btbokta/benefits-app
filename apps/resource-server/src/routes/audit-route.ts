import { Router } from 'express';
import type { Request, Response } from 'express';
import type Database from 'better-sqlite3';
import type { AuditRow } from '@benefits-agent/shared';
import { verifyBearer, requireScopes, wwwAuthenticate } from '../auth.js';
import { writeAudit } from '../audit.js';

export function auditRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    const ts = new Date().toISOString();
    let principal;
    try {
      principal = await verifyBearer(req.headers.authorization);
    } catch (err: unknown) {
      const e = err as { message?: string };
      res.setHeader('WWW-Authenticate', wwwAuthenticate);
      res.status(401).json({ error: 'unauthorized', error_description: e.message });
      return;
    }
    try {
      requireScopes('benefits.audit.read')(principal);
    } catch (err: unknown) {
      const e = err as { message?: string; missing?: string[] };
      res.setHeader('WWW-Authenticate', wwwAuthenticate);
      writeAudit({ ts, actor: principal.cid ?? principal.sub, userSub: principal.sub, tool: 'read_audit', scopeRequired: 'benefits.audit.read', decision: 'deny', httpStatus: 403, detail: e.message ?? 'forbidden', tokenJti: principal.jti ?? '' });
      res.status(403).json({ error: 'insufficient_scope', error_description: e.message, missing: e.missing });
      return;
    }

    const limit = Math.min(Number(req.query.limit ?? 200), 500);
    const rows = db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?').all(limit) as AuditRow[];
    writeAudit({ ts, actor: principal.cid ?? principal.sub, userSub: principal.sub, tool: 'read_audit', scopeRequired: 'benefits.audit.read', decision: 'allow', httpStatus: 200, detail: `${rows.length} rows`, tokenJti: principal.jti ?? '' });
    res.json(rows);
  });

  return router;
}
