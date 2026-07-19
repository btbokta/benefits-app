import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getAgentToken, BrokerError } from '@/lib/token-broker';

const RS = process.env.RESOURCE_SERVER_URL ?? 'http://localhost:3001';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  let token;
  try {
    token = await getAgentToken(user);
  } catch (err) {
    if (err instanceof BrokerError) {
      return NextResponse.json({ error: err.oktaError, description: err.oktaDescription }, { status: 502 });
    }
    throw err;
  }

  const res = await fetch(`${RS}/api/audit`, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    return NextResponse.json(body, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
