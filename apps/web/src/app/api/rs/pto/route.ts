import { NextRequest } from 'next/server';
import { verifyBearer, requireScopes, denied } from '@/lib/rs/auth';
import { resolveUserEmail, deriveRole, canAccess, getDirectReports } from '@/lib/rs/identity';
import { findEmployee, ptoBalances } from '@/lib/rs/data';
import { writeAudit } from '@/lib/rs/audit';

export async function GET(req: NextRequest) {
  const ts = new Date().toISOString();
  const employeeParam = req.nextUrl.searchParams.get('employee');
  let p;
  try { p = await verifyBearer(req.headers.get('authorization') ?? undefined); }
  catch { return denied('unauthorized', 401); }
  try { requireScopes('benefits.pto.read')(p); }
  catch (e: unknown) {
    const err = e as { message?: string; missing?: string[] };
    writeAudit({ ts, actor: p.cid ?? p.sub, userSub: p.sub, tool: 'get_pto', scopeRequired: 'benefits.pto.read', decision: 'deny', httpStatus: 403, detail: err.message ?? '', tokenJti: p.jti ?? '' });
    return denied('insufficient_scope', 403, { missing: err.missing });
  }

  const userEmail = resolveUserEmail(p);
  if (!userEmail) return denied('user_not_found', 403);
  const userEmp = findEmployee(userEmail)!;
  const role = deriveRole(p, userEmp);
  const directReports = role === 'manager' ? getDirectReports(userEmail) : [];
  const target = employeeParam ?? userEmail;

  if (!canAccess(role, userEmail, target, directReports)) {
    writeAudit({ ts, actor: p.cid ?? p.sub, userSub: p.sub, tool: 'get_pto', scopeRequired: 'benefits.pto.read', decision: 'deny', httpStatus: 403, detail: `row-level: ${target}`, tokenJti: p.jti ?? '' });
    return denied('insufficient_scope', 403, { error_description: 'No access to that employee PTO' });
  }

  const result = (role === 'hr_admin' || role === 'benefits_specialist') && !employeeParam
    ? ptoBalances
    : ptoBalances.filter(r => r.employeeEmail.toLowerCase() === target.toLowerCase());

  writeAudit({ ts, actor: p.cid ?? p.sub, userSub: p.sub, tool: 'get_pto', scopeRequired: 'benefits.pto.read', decision: 'allow', httpStatus: 200, detail: target, tokenJti: p.jti ?? '' });
  return Response.json(result);
}
