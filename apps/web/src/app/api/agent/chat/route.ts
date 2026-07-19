import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getAgentToken, BrokerError } from '@/lib/token-broker';
import { runAgentLoop } from '@/lib/agent/loop';

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { message?: string };
  if (!body.message || typeof body.message !== 'string' || body.message.length > 2000) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  let brokeredToken;
  try {
    brokeredToken = await getAgentToken(user);
  } catch (err) {
    if (err instanceof BrokerError) {
      return NextResponse.json({
        error: 'token_broker_error',
        stage: err.stage,
        oktaError: err.oktaError,
        oktaDescription: err.oktaDescription,
        message: err.message,
      }, { status: 502 });
    }
    throw err;
  }

  const result = await runAgentLoop(body.message, user, brokeredToken);
  return NextResponse.json(result);
}
