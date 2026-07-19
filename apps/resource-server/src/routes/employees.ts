import { Router } from 'express';
import type { Request, Response } from 'express';
import type Database from 'better-sqlite3';
import type { Employee, Role } from '@benefits-agent/shared';
import { verifyBearer, requireScopes, wwwAuthenticate } from '../auth.js';
import { resolveUserEmail, deriveRole, getDirectReports, canAccessEmployee } from '../identity.js';
import { writeAudit } from '../audit.js';

export function employeesRouter(db: Database.Database): Router {
  const router = Router();

  const checkRecord = requireScopes('benefits.record.read');

  function stripEmployee(emp: Employee, role: Role, hasComp: boolean, hasNotes: boolean): Partial<Employee> {
    const out: Partial<Employee> = {
      id: emp.id,
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      department: emp.department,
      title: emp.title,
      managerEmail: emp.managerEmail,
      role: emp.role,
    };
    if (hasComp) out.salary = emp.salary;
    if (hasNotes) out.hrNotes = emp.hrNotes;
    return out;
  }

  router.get('/', async (req: Request, res: Response) => {
    const ts = new Date().toISOString();
    let principal;
    try {
      principal = await verifyBearer(req.headers.authorization);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      res.setHeader('WWW-Authenticate', wwwAuthenticate);
      writeAudit({ ts, actor: 'anon', userSub: '', tool: 'list_employees', scopeRequired: 'benefits.record.read', decision: 'deny', httpStatus: 401, detail: e.message ?? 'unauthorized', tokenJti: '' });
      res.status(401).json({ error: 'unauthorized', error_description: e.message });
      return;
    }

    try {
      checkRecord(principal);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string; missing?: string[] };
      res.setHeader('WWW-Authenticate', wwwAuthenticate);
      writeAudit({ ts, actor: principal.cid ?? principal.sub, userSub: principal.sub, tool: 'list_employees', scopeRequired: 'benefits.record.read', decision: 'deny', httpStatus: 403, detail: e.message ?? 'forbidden', tokenJti: principal.jti ?? '' });
      res.status(403).json({ error: 'insufficient_scope', error_description: e.message, missing: e.missing });
      return;
    }

    const userEmail = resolveUserEmail(principal, db);
    if (!userEmail) {
      writeAudit({ ts, actor: principal.cid ?? principal.sub, userSub: principal.sub, tool: 'list_employees', scopeRequired: 'benefits.record.read', decision: 'deny', httpStatus: 403, detail: 'user not found in directory', tokenJti: principal.jti ?? '' });
      res.status(403).json({ error: 'user_not_found', error_description: 'Authenticated user not in employee directory' });
      return;
    }

    const emp = db.prepare('SELECT * FROM employees WHERE email = ? COLLATE NOCASE').get(userEmail) as Employee;
    const role = deriveRole(principal, emp);
    const directReports = role === 'manager' ? getDirectReports(userEmail, db) : [];
    const hasComp = principal.scopes.includes('benefits.compensation.read');
    const hasNotes = principal.scopes.includes('benefits.notes.read');

    const allEmps = db.prepare('SELECT * FROM employees').all() as Employee[];
    const filtered = allEmps.filter((e) => canAccessEmployee(role, userEmail, e.email, directReports));
    const result = filtered.map((e) => stripEmployee(e, role, hasComp, hasNotes));

    writeAudit({ ts, actor: principal.cid ?? principal.sub, userSub: principal.sub, tool: 'list_employees', scopeRequired: 'benefits.record.read', decision: 'allow', httpStatus: 200, detail: `${result.length} employees`, tokenJti: principal.jti ?? '' });
    res.json(result);
  });

  router.get('/:email', async (req: Request, res: Response) => {
    const ts = new Date().toISOString();
    const targetEmail = Array.isArray(req.params.email) ? req.params.email[0] : req.params.email;
    let principal;
    try {
      principal = await verifyBearer(req.headers.authorization);
    } catch (err: unknown) {
      const e = err as { message?: string };
      res.setHeader('WWW-Authenticate', wwwAuthenticate);
      writeAudit({ ts, actor: 'anon', userSub: '', tool: 'get_employee', scopeRequired: 'benefits.record.read', decision: 'deny', httpStatus: 401, detail: e.message ?? 'unauthorized', tokenJti: '' });
      res.status(401).json({ error: 'unauthorized', error_description: e.message });
      return;
    }

    try {
      checkRecord(principal);
    } catch (err: unknown) {
      const e = err as { message?: string; missing?: string[] };
      res.setHeader('WWW-Authenticate', wwwAuthenticate);
      writeAudit({ ts, actor: principal.cid ?? principal.sub, userSub: principal.sub, tool: 'get_employee', scopeRequired: 'benefits.record.read', decision: 'deny', httpStatus: 403, detail: e.message ?? 'forbidden', tokenJti: principal.jti ?? '' });
      res.status(403).json({ error: 'insufficient_scope', error_description: e.message, missing: e.missing });
      return;
    }

    const userEmail = resolveUserEmail(principal, db);
    if (!userEmail) {
      res.status(403).json({ error: 'user_not_found' });
      return;
    }
    const userEmp = db.prepare('SELECT * FROM employees WHERE email = ? COLLATE NOCASE').get(userEmail) as Employee;
    const role = deriveRole(principal, userEmp);
    const directReports = role === 'manager' ? getDirectReports(userEmail, db) : [];

    if (!canAccessEmployee(role, userEmail, targetEmail, directReports)) {
      writeAudit({ ts, actor: principal.cid ?? principal.sub, userSub: principal.sub, tool: 'get_employee', scopeRequired: 'benefits.record.read', decision: 'deny', httpStatus: 403, detail: `row-level: cannot access ${targetEmail}`, tokenJti: principal.jti ?? '' });
      res.setHeader('WWW-Authenticate', wwwAuthenticate);
      res.status(403).json({ error: 'insufficient_scope', error_description: `You do not have access to employee ${targetEmail}` });
      return;
    }

    const target = db.prepare('SELECT * FROM employees WHERE email = ? COLLATE NOCASE').get(targetEmail) as Employee | undefined;
    if (!target) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    const hasComp = principal.scopes.includes('benefits.compensation.read');
    const hasNotes = principal.scopes.includes('benefits.notes.read');
    writeAudit({ ts, actor: principal.cid ?? principal.sub, userSub: principal.sub, tool: 'get_employee', scopeRequired: 'benefits.record.read', decision: 'allow', httpStatus: 200, detail: targetEmail, tokenJti: principal.jti ?? '' });
    res.json(stripEmployee(target, role, hasComp, hasNotes));
  });

  return router;
}
