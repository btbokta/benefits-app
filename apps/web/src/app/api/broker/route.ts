import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getAgentToken, revokeAgentToken, invalidateCache, BrokerError } from '@/lib/token-broker';

// GET: return current broker chain (or force-refresh with ?refresh=1)
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  if (req.nextUrl.searchParams.get('refresh') === '1') {
    invalidateCache(user.sub);
  }

  try {
    const token = await getAgentToken(user);
    return NextResponse.json({
      scope: token.scope,
      expiresAt: token.expiresAt,
      chain: token.chain,
      mode: process.env.OKTA_AI_MODE ?? 'obo',
    });
  } catch (err) {
    if (err instanceof BrokerError) {
      return NextResponse.json({ error: err.oktaError, description: err.oktaDescription, stage: err.stage }, { status: 502 });
    }
    throw err;
  }
}

// DELETE: revoke the agent token
export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  await revokeAgentToken(user);
  return NextResponse.json({ revoked: true });
}
