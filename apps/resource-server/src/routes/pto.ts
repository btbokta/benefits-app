import { Router } from 'express';
import type { Request, Response } from 'express';
import type Database from 'better-sqlite3';
import type { PtoBalance, Employee } from '@benefits-agent/shared';
import { verifyBearer, requireScopes, wwwAuthenticate } from '../auth.js';
import { resolveUserEmail, deriveRole, getDirectReports, canAccessEmployee } from '../identity.js';
import { writeAudit } from '../audit.js';

export function ptoRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    const ts = new Date().toISOString();
    const employeeParam = req.query.employee as string | undefined;
    let principal;
    try {
      principal = await verifyBearer(req.headers.authorization);
    } catch (err: unknown) {
      const e = err as { message?: string };
      res.setHeader('WWW-Authenticate', wwwAuthenticate);
      writeAudit({ ts, actor: 'anon', userSub: '', tool: 'get_pto', scopeRequired: 'benefits.pto.read', decision: 'deny', httpStatus: 401, detail: e.message ?? 'unauthorized', tokenJti: '' });
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    try {
      requireScopes('benefits.pto.read')(principal);
    } catch (err: unknown) {
      const e = err as { message?: string; missing?: string[] };
      res.setHeader('WWW-Authenticate', wwwAuthenticate);
      writeAudit({ ts, actor: principal.cid ?? principal.sub, userSub: principal.sub, tool: 'get_pto', scopeRequired: 'benefits.pto.read', decision: 'deny', httpStatus: 403, detail: e.message ?? 'forbidden', tokenJti: principal.jti ?? '' });
      res.status(403).json({ error: 'insufficient_scope', error_description: e.message });
      return;
    }

    const userEmail = resolveUserEmail(principal, db);
    if (!userEmail) { res.status(403).json({ error: 'user_not_found' }); return; }
    const userEmp = db.prepare('SELECT * FROM employees WHERE email = ? COLLATE NOCASE').get(userEmail) as Employee;
    const role = deriveRole(principal, userEmp);
    const directReports = role === 'manager' ? getDirectReports(userEmail, db) : [];
    const target = employeeParam ?? userEmail;

    if (!canAccessEmployee(role, userEmail, target, directReports)) {
      writeAudit({ ts, actor: principal.cid ?? principal.sub, userSub: principal.sub, tool: 'get_pto', scopeRequired: 'benefits.pto.read', decision: 'deny', httpStatus: 403, detail: `row-level: ${target}`, tokenJti: principal.jti ?? '' });
      res.setHeader('WWW-Authenticate', wwwAuthenticate);
      res.status(403).json({ error: 'insufficient_scope', error_description: 'No access to that employee' });
      return;
    }

    let rows: PtoBalance[];
    if (role === 'hr_admin' || role === 'benefits_specialist') {
      rows = employeeParam
        ? db.prepare('SELECT * FROM pto_balances WHERE employeeEmail = ? COLLATE NOCASE').all(employeeParam) as PtoBalance[]
        : db.prepare('SELECT * FROM pto_balances').all() as PtoBalance[];
    } else {
      rows = db.prepare('SELECT * FROM pto_balances WHERE employeeEmail = ? COLLATE NOCASE').all(target) as PtoBalance[];
    }

    writeAudit({ ts, actor: principal.cid ?? principal.sub, userSub: principal.sub, tool: 'get_pto', scopeRequired: 'benefits.pto.read', decision: 'allow', httpStatus: 200, detail: `${rows.length} rows`, tokenJti: principal.jti ?? '' });
    res.json(rows);
  });

  return router;
}
