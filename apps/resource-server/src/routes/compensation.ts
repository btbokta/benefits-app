import { Router } from 'express';
import type { Request, Response } from 'express';
import type Database from 'better-sqlite3';
import type { Employee } from '@benefits-agent/shared';
import { verifyBearer, requireScopes, wwwAuthenticate } from '../auth.js';
import { resolveUserEmail, deriveRole, getDirectReports, canAccessEmployee } from '../identity.js';
import { writeAudit } from '../audit.js';

export function compensationRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/:email', async (req: Request, res: Response) => {
    const ts = new Date().toISOString();
    const targetEmail = Array.isArray(req.params.email) ? req.params.email[0] : req.params.email;
    let principal;
    try {
      principal = await verifyBearer(req.headers.authorization);
    } catch (err: unknown) {
      const e = err as { message?: string };
      res.setHeader('WWW-Authenticate', wwwAuthenticate);
      writeAudit({ ts, actor: 'anon', userSub: '', tool: 'get_compensation', scopeRequired: 'benefits.compensation.read', decision: 'deny', httpStatus: 401, detail: e.message ?? 'unauthorized', tokenJti: '' });
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    try {
      requireScopes('benefits.compensation.read')(principal);
    } catch (err: unknown) {
      const e = err as { message?: string; missing?: string[] };
      res.setHeader('WWW-Authenticate', wwwAuthenticate);
      writeAudit({ ts, actor: principal.cid ?? principal.sub, userSub: principal.sub, tool: 'get_compensation', scopeRequired: 'benefits.compensation.read', decision: 'deny', httpStatus: 403, detail: e.message ?? 'forbidden', tokenJti: principal.jti ?? '' });
      res.status(403).json({ error: 'insufficient_scope', error_description: e.message, missing: e.missing });
      return;
    }

    const userEmail = resolveUserEmail(principal, db);
    if (!userEmail) { res.status(403).json({ error: 'user_not_found' }); return; }
    const userEmp = db.prepare('SELECT * FROM employees WHERE email = ? COLLATE NOCASE').get(userEmail) as Employee;
    const role = deriveRole(principal, userEmp);
    const directReports = role === 'manager' ? getDirectReports(userEmail, db) : [];

    if (!canAccessEmployee(role, userEmail, targetEmail, directReports)) {
      writeAudit({ ts, actor: principal.cid ?? principal.sub, userSub: principal.sub, tool: 'get_compensation', scopeRequired: 'benefits.compensation.read', decision: 'deny', httpStatus: 403, detail: `row-level: ${targetEmail}`, tokenJti: principal.jti ?? '' });
      res.setHeader('WWW-Authenticate', wwwAuthenticate);
      res.status(403).json({ error: 'insufficient_scope', error_description: 'No access to that employee compensation' });
      return;
    }

    const target = db.prepare('SELECT * FROM employees WHERE email = ? COLLATE NOCASE').get(targetEmail) as Employee | undefined;
    if (!target) { res.status(404).json({ error: 'not_found' }); return; }

    writeAudit({ ts, actor: principal.cid ?? principal.sub, userSub: principal.sub, tool: 'get_compensation', scopeRequired: 'benefits.compensation.read', decision: 'allow', httpStatus: 200, detail: targetEmail, tokenJti: principal.jti ?? '' });
    res.json({ email: target.email, firstName: target.firstName, lastName: target.lastName, salary: target.salary });
  });

  return router;
}
