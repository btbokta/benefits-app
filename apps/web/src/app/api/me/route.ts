import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { ROLE_SCOPES } from '@benefits-agent/shared';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ authenticated: false }, { status: 401 });

  return NextResponse.json({
    authenticated: true,
    sub: user.sub,
    email: user.email,
    name: user.name,
    groups: user.groups,
    role: user.role,
    scopeCeiling: ROLE_SCOPES[user.role],
    expiresAt: user.expiresAt,
    mode: process.env.OKTA_AI_MODE ?? 'obo',
  });
}
