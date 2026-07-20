import { NextRequest } from 'next/server';
import { verifyBearer, requireScopes, denied } from '@/lib/rs/auth';
import { resolveUserEmail, deriveRole, canAccess, getDirectReports } from '@/lib/rs/identity';
import { findEmployee, enrollments } from '@/lib/rs/data';
import { writeAudit } from '@/lib/rs/audit';

export async function GET(req: NextRequest) {
  const ts = new Date().toISOString();
  const employeeParam = req.nextUrl.searchParams.get('employee');
  let p;
  try { p = await verifyBearer(req.headers.get('authorization') ?? undefined); }
  catch { return denied('unauthorized', 401); }
  try { requireScopes('benefits.enrollment.read')(p); }
  catch (e: unknown) {
    const err = e as { message?: string; missing?: string[] };
    writeAudit({ ts, actor: p.cid ?? p.sub, userSub: p.sub, tool: 'get_enrollments', scopeRequired: 'benefits.enrollment.read', decision: 'deny', httpStatus: 403, detail: err.message ?? '', tokenJti: p.jti ?? '' });
    return denied('insufficient_scope', 403, { missing: err.missing });
  }

  const userEmail = resolveUserEmail(p);
  if (!userEmail) return denied('user_not_found', 403);
  const userEmp = findEmployee(userEmail)!;
  const role = deriveRole(p, userEmp);
  const directReports = role === 'manager' ? getDirectReports(userEmail) : [];
  const target = employeeParam ?? userEmail;

  if (!canAccess(role, userEmail, target, directReports)) {
    writeAudit({ ts, actor: p.cid ?? p.sub, userSub: p.sub, tool: 'get_enrollments', scopeRequired: 'benefits.enrollment.read', decision: 'deny', httpStatus: 403, detail: `row-level: ${target}`, tokenJti: p.jti ?? '' });
    return denied('insufficient_scope', 403, { error_description: 'No access to that employee' });
  }

  const result = (role === 'hr_admin' || role === 'benefits_specialist') && !employeeParam
    ? enrollments
    : enrollments.filter(e => e.employeeEmail.toLowerCase() === target.toLowerCase());

  writeAudit({ ts, actor: p.cid ?? p.sub, userSub: p.sub, tool: 'get_enrollments', scopeRequired: 'benefits.enrollment.read', decision: 'allow', httpStatus: 200, detail: `${result.length} rows`, tokenJti: p.jti ?? '' });
  return Response.json(result);
}

export async function POST(req: NextRequest) {
  const ts = new Date().toISOString();
  let p;
  try { p = await verifyBearer(req.headers.get('authorization') ?? undefined); }
  catch { return denied('unauthorized', 401); }
  try { requireScopes('benefits.enrollment.write')(p); }
  catch (e: unknown) {
    const err = e as { message?: string; missing?: string[] };
    writeAudit({ ts, actor: p.cid ?? p.sub, userSub: p.sub, tool: 'enroll_in_plan', scopeRequired: 'benefits.enrollment.write', decision: 'deny', httpStatus: 403, detail: err.message ?? '', tokenJti: p.jti ?? '' });
    return denied('insufficient_scope', 403, { missing: err.missing });
  }

  const body = await req.json().catch(() => ({})) as { employeeEmail?: string; planId?: number; coverageLevel?: string; effectiveDate?: string };
  if (!body.employeeEmail || !body.planId || !body.coverageLevel || !body.effectiveDate) {
    return Response.json({ error: 'missing_fields' }, { status: 400 });
  }

  const userEmail = resolveUserEmail(p);
  if (!userEmail) return denied('user_not_found', 403);
  const userEmp = findEmployee(userEmail)!;
  const role = deriveRole(p, userEmp);

  if (role !== 'hr_admin' && body.employeeEmail.toLowerCase() !== userEmail.toLowerCase()) {
    writeAudit({ ts, actor: p.cid ?? p.sub, userSub: p.sub, tool: 'enroll_in_plan', scopeRequired: 'benefits.enrollment.write', decision: 'deny', httpStatus: 403, detail: 'self-only write', tokenJti: p.jti ?? '' });
    return denied('insufficient_scope', 403, { error_description: 'Can only enroll yourself' });
  }

  const newId = enrollments.length + 1;
  enrollments.push({ id: newId, ...body } as typeof enrollments[0]);
  writeAudit({ ts, actor: p.cid ?? p.sub, userSub: p.sub, tool: 'enroll_in_plan', scopeRequired: 'benefits.enrollment.write', decision: 'allow', httpStatus: 201, detail: `enrollment ${newId}`, tokenJti: p.jti ?? '' });
  return Response.json({ id: newId }, { status: 201 });
}
