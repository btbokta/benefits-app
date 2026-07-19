import { Router } from 'express';
import type { Request, Response } from 'express';
import type Database from 'better-sqlite3';
import type { Enrollment, Employee, Role } from '@benefits-agent/shared';
import { verifyBearer, requireScopes, wwwAuthenticate } from '../auth.js';
import { resolveUserEmail, deriveRole, getDirectReports, canAccessEmployee } from '../identity.js';
import { writeAudit } from '../audit.js';

export function enrollmentsRouter(db: Database.Database): Router {
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
      writeAudit({ ts, actor: 'anon', userSub: '', tool: 'get_enrollments', scopeRequired: 'benefits.enrollment.read', decision: 'deny', httpStatus: 401, detail: e.message ?? 'unauthorized', tokenJti: '' });
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    try {
      requireScopes('benefits.enrollment.read')(principal);
    } catch (err: unknown) {
      const e = err as { message?: string; missing?: string[] };
      res.setHeader('WWW-Authenticate', wwwAuthenticate);
      writeAudit({ ts, actor: principal.cid ?? principal.sub, userSub: principal.sub, tool: 'get_enrollments', scopeRequired: 'benefits.enrollment.read', decision: 'deny', httpStatus: 403, detail: e.message ?? 'forbidden', tokenJti: principal.jti ?? '' });
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
      writeAudit({ ts, actor: principal.cid ?? principal.sub, userSub: principal.sub, tool: 'get_enrollments', scopeRequired: 'benefits.enrollment.read', decision: 'deny', httpStatus: 403, detail: `row-level: ${target}`, tokenJti: principal.jti ?? '' });
      res.setHeader('WWW-Authenticate', wwwAuthenticate);
      res.status(403).json({ error: 'insufficient_scope', error_description: 'No access to that employee' });
      return;
    }

    let enrollments: Enrollment[];
    if (role === 'hr_admin' || role === 'benefits_specialist') {
      enrollments = employeeParam
        ? db.prepare('SELECT * FROM enrollments WHERE employeeEmail = ? COLLATE NOCASE').all(employeeParam) as Enrollment[]
        : db.prepare('SELECT * FROM enrollments').all() as Enrollment[];
    } else {
      enrollments = db.prepare('SELECT * FROM enrollments WHERE employeeEmail = ? COLLATE NOCASE').all(target) as Enrollment[];
    }

    writeAudit({ ts, actor: principal.cid ?? principal.sub, userSub: principal.sub, tool: 'get_enrollments', scopeRequired: 'benefits.enrollment.read', decision: 'allow', httpStatus: 200, detail: `${enrollments.length} rows`, tokenJti: principal.jti ?? '' });
    res.json(enrollments);
  });

  router.post('/', async (req: Request, res: Response) => {
    const ts = new Date().toISOString();
    let principal;
    try {
      principal = await verifyBearer(req.headers.authorization);
    } catch (err: unknown) {
      res.setHeader('WWW-Authenticate', wwwAuthenticate);
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    try {
      requireScopes('benefits.enrollment.write')(principal);
    } catch (err: unknown) {
      const e = err as { message?: string; missing?: string[] };
      res.setHeader('WWW-Authenticate', wwwAuthenticate);
      writeAudit({ ts, actor: principal.cid ?? principal.sub, userSub: principal.sub, tool: 'enroll_in_plan', scopeRequired: 'benefits.enrollment.write', decision: 'deny', httpStatus: 403, detail: e.message ?? 'forbidden', tokenJti: principal.jti ?? '' });
      res.status(403).json({ error: 'insufficient_scope', error_description: e.message });
      return;
    }

    const { employeeEmail, planId, coverageLevel, effectiveDate } = req.body as Partial<Enrollment>;
    if (!employeeEmail || !planId || !coverageLevel || !effectiveDate) {
      res.status(400).json({ error: 'missing_fields' });
      return;
    }

    const userEmail = resolveUserEmail(principal, db);
    if (!userEmail) { res.status(403).json({ error: 'user_not_found' }); return; }
    const userEmp = db.prepare('SELECT * FROM employees WHERE email = ? COLLATE NOCASE').get(userEmail) as Employee;
    const role = deriveRole(principal, userEmp);

    if (role !== 'hr_admin' && employeeEmail.toLowerCase() !== userEmail.toLowerCase()) {
      writeAudit({ ts, actor: principal.cid ?? principal.sub, userSub: principal.sub, tool: 'enroll_in_plan', scopeRequired: 'benefits.enrollment.write', decision: 'deny', httpStatus: 403, detail: 'self-only write', tokenJti: principal.jti ?? '' });
      res.status(403).json({ error: 'insufficient_scope', error_description: 'Can only enroll yourself' });
      return;
    }

    const result = db.prepare(
      `INSERT INTO enrollments (employeeEmail, planId, coverageLevel, effectiveDate) VALUES (?, ?, ?, ?)`
    ).run(employeeEmail, planId, coverageLevel, effectiveDate);

    writeAudit({ ts, actor: principal.cid ?? principal.sub, userSub: principal.sub, tool: 'enroll_in_plan', scopeRequired: 'benefits.enrollment.write', decision: 'allow', httpStatus: 201, detail: `enrollment ${result.lastInsertRowid}`, tokenJti: principal.jti ?? '' });
    res.status(201).json({ id: result.lastInsertRowid });
  });

  return router;
}
