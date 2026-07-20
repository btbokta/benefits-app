import { NextRequest } from 'next/server';
import { verifyBearer, requireScopes, denied } from '@/lib/rs/auth';
import { plans } from '@/lib/rs/data';
import { writeAudit } from '@/lib/rs/audit';

export async function GET(req: NextRequest) {
  const ts = new Date().toISOString();
  let p;
  try { p = await verifyBearer(req.headers.get('authorization') ?? undefined); }
  catch { return denied('unauthorized', 401); }
  try { requireScopes('benefits.enrollment.read')(p); }
  catch (e: unknown) {
    const err = e as { message?: string; missing?: string[] };
    writeAudit({ ts, actor: p.cid ?? p.sub, userSub: p.sub, tool: 'list_plans', scopeRequired: 'benefits.enrollment.read', decision: 'deny', httpStatus: 403, detail: err.message ?? '', tokenJti: p.jti ?? '' });
    return denied('insufficient_scope', 403, { missing: err.missing });
  }
  writeAudit({ ts, actor: p.cid ?? p.sub, userSub: p.sub, tool: 'list_plans', scopeRequired: 'benefits.enrollment.read', decision: 'allow', httpStatus: 200, detail: `${plans.length} plans`, tokenJti: p.jti ?? '' });
  return Response.json(plans);
}
