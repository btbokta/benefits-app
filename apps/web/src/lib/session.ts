import { getIronSession, type IronSession } from 'iron-session';
import { cookies } from 'next/headers';
import type { Role } from '@benefits-agent/shared';

export interface SessionData {
  sub: string;
  email: string;
  name: string;
  groups: string[];
  role: Role;
  idToken: string;
  accessToken: string;
  expiresAt: number;
  nonce?: string;
  pkceVerifier?: string;
}

const SESSION_OPTIONS = {
  cookieName: 'benefits-session',
  password: process.env.SESSION_SECRET ?? 'change-me-32-chars-minimum-secret!!',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, SESSION_OPTIONS);
}

export async function getSessionUser(): Promise<SessionData | null> {
  const session = await getSession();
  if (!session.sub) return null;
  return session as SessionData;
}
