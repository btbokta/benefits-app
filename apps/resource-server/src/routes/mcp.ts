import { Router } from 'express';
import type { Request, Response } from 'express';
import type Database from 'better-sqlite3';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import type { Employee, PtoBalance, Enrollment } from '@benefits-agent/shared';
import { verifyBearer, requireScopes, wwwAuthenticate } from '../auth.js';
import { resolveUserEmail, deriveRole, getDirectReports, canAccessEmployee } from '../identity.js';
import { writeAudit } from '../audit.js';

function buildMcpServer(db: Database.Database, token: Awaited<ReturnType<typeof verifyBearer>>) {
  const server = new McpServer({ name: 'benefits-resource-server', version: '1.0.0' });

  const ts = () => new Date().toISOString();
  const actor = token.cid ?? token.sub;
  const jti = token.jti ?? '';

  const getUserContext = () => {
    const userEmail = resolveUserEmail(token, db);
    if (!userEmail) throw new Error('user_not_found');
    const emp = db.prepare('SELECT * FROM employees WHERE email = ? COLLATE NOCASE').get(userEmail) as Employee;
    const role = deriveRole(token, emp);
    const directReports = role === 'manager' ? getDirectReports(userEmail, db) : [];
    return { userEmail, role, directReports };
  };

  server.tool('list_employees', 'List employees accessible to the current user', {}, async () => {
    try {
      requireScopes('benefits.record.read')(token);
    } catch (e: unknown) {
      const err = e as { message?: string };
      writeAudit({ ts: ts(), actor, userSub: token.sub, tool: 'list_employees', scopeRequired: 'benefits.record.read', decision: 'deny', httpStatus: 403, detail: err.message ?? '', tokenJti: jti });
      return { content: [{ type: 'text', text: JSON.stringify({ denied: true, missingScopes: ['benefits.record.read'], error: err.message }) }] };
    }
    const { userEmail, role, directReports } = getUserContext();
    const all = db.prepare('SELECT * FROM employees').all() as Employee[];
    const filtered = all.filter((e) => canAccessEmployee(role, userEmail, e.email, directReports));
    writeAudit({ ts: ts(), actor, userSub: token.sub, tool: 'list_employees', scopeRequired: 'benefits.record.read', decision: 'allow', httpStatus: 200, detail: `${filtered.length}`, tokenJti: jti });
    return { content: [{ type: 'text', text: JSON.stringify(filtered.map(({ salary, hrNotes, ...rest }) => token.scopes.includes('benefits.compensation.read') ? { ...rest, salary } : rest)) }] };
  });

  server.tool('get_employee', 'Get a specific employee by email', { email: z.string().email() }, async ({ email }) => {
    try { requireScopes('benefits.record.read')(token); } catch (e: unknown) {
      const err = e as { message?: string };
      writeAudit({ ts: ts(), actor, userSub: token.sub, tool: 'get_employee', scopeRequired: 'benefits.record.read', decision: 'deny', httpStatus: 403, detail: err.message ?? '', tokenJti: jti });
      return { content: [{ type: 'text', text: JSON.stringify({ denied: true, missingScopes: ['benefits.record.read'] }) }] };
    }
    const { userEmail, role, directReports } = getUserContext();
    if (!canAccessEmployee(role, userEmail, email, directReports)) {
      writeAudit({ ts: ts(), actor, userSub: token.sub, tool: 'get_employee', scopeRequired: 'benefits.record.read', decision: 'deny', httpStatus: 403, detail: `row-level: ${email}`, tokenJti: jti });
      return { content: [{ type: 'text', text: JSON.stringify({ denied: true, error: 'No access to that employee' }) }] };
    }
    const emp = db.prepare('SELECT * FROM employees WHERE email = ? COLLATE NOCASE').get(email) as Employee | undefined;
    if (!emp) return { content: [{ type: 'text', text: JSON.stringify({ error: 'not_found' }) }] };
    const { salary, hrNotes, ...rest } = emp;
    const out = token.scopes.includes('benefits.compensation.read') ? { ...rest, salary } : rest;
    writeAudit({ ts: ts(), actor, userSub: token.sub, tool: 'get_employee', scopeRequired: 'benefits.record.read', decision: 'allow', httpStatus: 200, detail: email, tokenJti: jti });
    return { content: [{ type: 'text', text: JSON.stringify(out) }] };
  });

  server.tool('get_compensation', 'Get salary for an employee (requires compensation scope)', { email: z.string().email() }, async ({ email }) => {
    try { requireScopes('benefits.compensation.read')(token); } catch (e: unknown) {
      const err = e as { message?: string; missing?: string[] };
      writeAudit({ ts: ts(), actor, userSub: token.sub, tool: 'get_compensation', scopeRequired: 'benefits.compensation.read', decision: 'deny', httpStatus: 403, detail: err.message ?? '', tokenJti: jti });
      return { content: [{ type: 'text', text: JSON.stringify({ denied: true, missingScopes: err.missing ?? ['benefits.compensation.read'], wwwAuthenticate }) }] };
    }
    const { userEmail, role, directReports } = getUserContext();
    if (!canAccessEmployee(role, userEmail, email, directReports)) {
      writeAudit({ ts: ts(), actor, userSub: token.sub, tool: 'get_compensation', scopeRequired: 'benefits.compensation.read', decision: 'deny', httpStatus: 403, detail: `row-level: ${email}`, tokenJti: jti });
      return { content: [{ type: 'text', text: JSON.stringify({ denied: true, error: 'No access to that employee compensation' }) }] };
    }
    const emp = db.prepare('SELECT * FROM employees WHERE email = ? COLLATE NOCASE').get(email) as Employee | undefined;
    if (!emp) return { content: [{ type: 'text', text: JSON.stringify({ error: 'not_found' }) }] };
    writeAudit({ ts: ts(), actor, userSub: token.sub, tool: 'get_compensation', scopeRequired: 'benefits.compensation.read', decision: 'allow', httpStatus: 200, detail: email, tokenJti: jti });
    return { content: [{ type: 'text', text: JSON.stringify({ email: emp.email, firstName: emp.firstName, lastName: emp.lastName, salary: emp.salary }) }] };
  });

  server.tool('list_plans', 'List all available benefit plans', {}, async () => {
    try { requireScopes('benefits.enrollment.read')(token); } catch (e: unknown) {
      const err = e as { message?: string };
      writeAudit({ ts: ts(), actor, userSub: token.sub, tool: 'list_plans', scopeRequired: 'benefits.enrollment.read', decision: 'deny', httpStatus: 403, detail: err.message ?? '', tokenJti: jti });
      return { content: [{ type: 'text', text: JSON.stringify({ denied: true, missingScopes: ['benefits.enrollment.read'] }) }] };
    }
    const plans = db.prepare('SELECT * FROM plans').all();
    writeAudit({ ts: ts(), actor, userSub: token.sub, tool: 'list_plans', scopeRequired: 'benefits.enrollment.read', decision: 'allow', httpStatus: 200, detail: '', tokenJti: jti });
    return { content: [{ type: 'text', text: JSON.stringify(plans) }] };
  });

  server.tool('get_enrollments', 'Get enrollment records for an employee', { employee: z.string().email().optional() }, async ({ employee }) => {
    try { requireScopes('benefits.enrollment.read')(token); } catch (e: unknown) {
      const err = e as { message?: string };
      writeAudit({ ts: ts(), actor, userSub: token.sub, tool: 'get_enrollments', scopeRequired: 'benefits.enrollment.read', decision: 'deny', httpStatus: 403, detail: err.message ?? '', tokenJti: jti });
      return { content: [{ type: 'text', text: JSON.stringify({ denied: true, missingScopes: ['benefits.enrollment.read'] }) }] };
    }
    const { userEmail, role, directReports } = getUserContext();
    const target = employee ?? userEmail;
    if (!canAccessEmployee(role, userEmail, target, directReports)) {
      writeAudit({ ts: ts(), actor, userSub: token.sub, tool: 'get_enrollments', scopeRequired: 'benefits.enrollment.read', decision: 'deny', httpStatus: 403, detail: `row-level: ${target}`, tokenJti: jti });
      return { content: [{ type: 'text', text: JSON.stringify({ denied: true, error: 'No access to that employee' }) }] };
    }
    const rows = db.prepare('SELECT * FROM enrollments WHERE employeeEmail = ? COLLATE NOCASE').all(target) as Enrollment[];
    writeAudit({ ts: ts(), actor, userSub: token.sub, tool: 'get_enrollments', scopeRequired: 'benefits.enrollment.read', decision: 'allow', httpStatus: 200, detail: target, tokenJti: jti });
    return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
  });

  server.tool('get_pto', 'Get PTO balances for an employee', { employee: z.string().email().optional() }, async ({ employee }) => {
    try { requireScopes('benefits.pto.read')(token); } catch (e: unknown) {
      const err = e as { message?: string };
      writeAudit({ ts: ts(), actor, userSub: token.sub, tool: 'get_pto', scopeRequired: 'benefits.pto.read', decision: 'deny', httpStatus: 403, detail: err.message ?? '', tokenJti: jti });
      return { content: [{ type: 'text', text: JSON.stringify({ denied: true, missingScopes: ['benefits.pto.read'] }) }] };
    }
    const { userEmail, role, directReports } = getUserContext();
    const target = employee ?? userEmail;
    if (!canAccessEmployee(role, userEmail, target, directReports)) {
      writeAudit({ ts: ts(), actor, userSub: token.sub, tool: 'get_pto', scopeRequired: 'benefits.pto.read', decision: 'deny', httpStatus: 403, detail: `row-level: ${target}`, tokenJti: jti });
      return { content: [{ type: 'text', text: JSON.stringify({ denied: true, error: 'No access to that employee PTO' }) }] };
    }
    const row = db.prepare('SELECT * FROM pto_balances WHERE employeeEmail = ? COLLATE NOCASE').get(target) as PtoBalance | undefined;
    writeAudit({ ts: ts(), actor, userSub: token.sub, tool: 'get_pto', scopeRequired: 'benefits.pto.read', decision: 'allow', httpStatus: 200, detail: target, tokenJti: jti });
    return { content: [{ type: 'text', text: JSON.stringify(row ?? { error: 'not_found' }) }] };
  });

  server.tool('read_audit', 'Read the audit log (hr_admin only — requires benefits.audit.read)', { limit: z.number().int().min(1).max(500).optional() }, async ({ limit }) => {
    try { requireScopes('benefits.audit.read')(token); } catch (e: unknown) {
      const err = e as { message?: string; missing?: string[] };
      writeAudit({ ts: ts(), actor, userSub: token.sub, tool: 'read_audit', scopeRequired: 'benefits.audit.read', decision: 'deny', httpStatus: 403, detail: err.message ?? '', tokenJti: jti });
      return { content: [{ type: 'text', text: JSON.stringify({ denied: true, missingScopes: err.missing ?? ['benefits.audit.read'], wwwAuthenticate }) }] };
    }
    const rows = db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?').all(limit ?? 100);
    writeAudit({ ts: ts(), actor, userSub: token.sub, tool: 'read_audit', scopeRequired: 'benefits.audit.read', decision: 'allow', httpStatus: 200, detail: '', tokenJti: jti });
    return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
  });

  return server;
}

export function mcpRouter(db: Database.Database): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    let principal;
    try {
      principal = await verifyBearer(req.headers.authorization);
    } catch (err: unknown) {
      const e = err as { message?: string };
      res.setHeader('WWW-Authenticate', wwwAuthenticate);
      res.status(401).json({ error: 'unauthorized', error_description: e.message });
      return;
    }

    const server = buildMcpServer(db, principal);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  return router;
}
