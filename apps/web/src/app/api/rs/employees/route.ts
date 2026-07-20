import { NextRequest } from 'next/server';
import { verifyBearer, requireScopes, denied, WWW_AUTHENTICATE } from '@/lib/rs/auth';
import { resolveUserEmail, deriveRole, canAccess, getDirectReports } from '@/lib/rs/identity';
import { employees, findEmployee } from '@/lib/rs/data';
import { writeAudit } from '@/lib/rs/audit';
import type { Employee, Role } from '@benefits-agent/shared';

function strip(e: Employee, role: Role, hasComp: boolean, hasNotes: boolean) {
  const { salary, hrNotes, ...rest } = e;
  return { ...rest, ...(hasComp ? { salary } : {}), ...(hasNotes ? { hrNotes } : {}) };
}

export async function GET(req: NextRequest) {
  const ts = new Date().toISOString();
  let p;
  try { p = await verifyBearer(req.headers.get('authorization') ?? undefined); }
  catch (e: unknown) {
    const err = e as { message?: string };
    writeAudit({ ts, actor: 'anon', userSub: '', tool: 'list_employees', scopeRequired: 'benefits.record.read', decision: 'deny', httpStatus: 401, detail: err.message ?? '', tokenJti: '' });
    return denied('unauthorized', 401);
  }
  try { requireScopes('benefits.record.read')(p); }
  catch (e: unknown) {
    const err = e as { message?: string; missing?: string[] };
    writeAudit({ ts, actor: p.cid ?? p.sub, userSub: p.sub, tool: 'list_employees', scopeRequired: 'benefits.record.read', decision: 'deny', httpStatus: 403, detail: err.message ?? '', tokenJti: p.jti ?? '' });
    return denied('insufficient_scope', 403, { missing: err.missing });
  }

  const userEmail = resolveUserEmail(p);
  if (!userEmail) return denied('user_not_found', 403);

  const emp = findEmployee(userEmail)!;
  const role = deriveRole(p, emp);
  const directReports = role === 'manager' ? getDirectReports(userEmail) : [];
  const hasComp = p.scopes.includes('benefits.compensation.read');
  const hasNotes = p.scopes.includes('benefits.notes.read');

  const result = employees
    .filter(e => canAccess(role, userEmail, e.email, directReports))
    .map(e => strip(e, role, hasComp, hasNotes));

  writeAudit({ ts, actor: p.cid ?? p.sub, userSub: p.sub, tool: 'list_employees', scopeRequired: 'benefits.record.read', decision: 'allow', httpStatus: 200, detail: `${result.length} employees`, tokenJti: p.jti ?? '' });
  return Response.json(result, { headers: { 'Access-Control-Allow-Origin': process.env.WEB_ORIGIN ?? '*' } });
}
