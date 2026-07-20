import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getAgentToken, BrokerError } from '@/lib/token-broker';

function getRsBase() {
  if (process.env.RESOURCE_SERVER_URL) return process.env.RESOURCE_SERVER_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

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

  const res = await fetch(`${getRsBase()}/api/rs/audit`, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    return NextResponse.json(body, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
