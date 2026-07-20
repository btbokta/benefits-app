import { NextRequest } from 'next/server';
import { verifyBearer, requireScopes, denied } from '@/lib/rs/auth';
import { resolveUserEmail, deriveRole, canAccess, getDirectReports } from '@/lib/rs/identity';
import { findEmployee } from '@/lib/rs/data';
import { writeAudit } from '@/lib/rs/audit';

export async function GET(req: NextRequest, { params }: { params: { email: string } }) {
  const ts = new Date().toISOString();
  const targetEmail = decodeURIComponent(params.email);
  let p;
  try { p = await verifyBearer(req.headers.get('authorization') ?? undefined); }
  catch { return denied('unauthorized', 401); }
  try { requireScopes('benefits.compensation.read')(p); }
  catch (e: unknown) {
    const err = e as { message?: string; missing?: string[] };
    writeAudit({ ts, actor: p.cid ?? p.sub, userSub: p.sub, tool: 'get_compensation', scopeRequired: 'benefits.compensation.read', decision: 'deny', httpStatus: 403, detail: err.message ?? '', tokenJti: p.jti ?? '' });
    return denied('insufficient_scope', 403, { missing: err.missing });
  }

  const userEmail = resolveUserEmail(p);
  if (!userEmail) return denied('user_not_found', 403);

  const userEmp = findEmployee(userEmail)!;
  const role = deriveRole(p, userEmp);
  const directReports = role === 'manager' ? getDirectReports(userEmail) : [];

  if (!canAccess(role, userEmail, targetEmail, directReports)) {
    writeAudit({ ts, actor: p.cid ?? p.sub, userSub: p.sub, tool: 'get_compensation', scopeRequired: 'benefits.compensation.read', decision: 'deny', httpStatus: 403, detail: `row-level: ${targetEmail}`, tokenJti: p.jti ?? '' });
    return denied('insufficient_scope', 403, { error_description: 'No access to that employee compensation' });
  }

  const target = findEmployee(targetEmail);
  if (!target) return Response.json({ error: 'not_found' }, { status: 404 });

  writeAudit({ ts, actor: p.cid ?? p.sub, userSub: p.sub, tool: 'get_compensation', scopeRequired: 'benefits.compensation.read', decision: 'allow', httpStatus: 200, detail: targetEmail, tokenJti: p.jti ?? '' });
  return Response.json({ email: target.email, firstName: target.firstName, lastName: target.lastName, salary: target.salary });
}
