import { NextRequest } from 'next/server';
import { verifyBearer, requireScopes, denied } from '@/lib/rs/auth';
import { readAudit, writeAudit } from '@/lib/rs/audit';

export async function GET(req: NextRequest) {
  const ts = new Date().toISOString();
  let p;
  try { p = await verifyBearer(req.headers.get('authorization') ?? undefined); }
  catch { return denied('unauthorized', 401); }
  try { requireScopes('benefits.audit.read')(p); }
  catch (e: unknown) {
    const err = e as { message?: string; missing?: string[] };
    writeAudit({ ts, actor: p.cid ?? p.sub, userSub: p.sub, tool: 'read_audit', scopeRequired: 'benefits.audit.read', decision: 'deny', httpStatus: 403, detail: err.message ?? '', tokenJti: p.jti ?? '' });
    return denied('insufficient_scope', 403, { missing: err.missing });
  }
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? '200'), 500);
  const rows = readAudit(limit);
  writeAudit({ ts, actor: p.cid ?? p.sub, userSub: p.sub, tool: 'read_audit', scopeRequired: 'benefits.audit.read', decision: 'allow', httpStatus: 200, detail: `${rows.length} rows`, tokenJti: p.jti ?? '' });
  return Response.json(rows);
}
