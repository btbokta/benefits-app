import type Database from 'better-sqlite3';
import type { Principal } from './auth.js';
import type { Employee, Role } from '@benefits-agent/shared';
import { groupsToRole } from '@benefits-agent/shared';

const IDENTITY_CLAIM = process.env.USER_IDENTITY_CLAIM ?? 'sub';

export function resolveUserEmail(principal: Principal, db: Database.Database): string | null {
  const raw = IDENTITY_CLAIM === 'email' ? principal.email : principal.sub;
  if (!raw) return null;

  if (raw.includes('@')) {
    const row = db.prepare('SELECT email FROM employees WHERE email = ? COLLATE NOCASE').get(raw) as { email: string } | undefined;
    return row?.email ?? null;
  }

  // sub is an Okta UID (00u...) — try email claim fallback
  const emailFallback = principal.email;
  if (emailFallback) {
    const row = db.prepare('SELECT email FROM employees WHERE email = ? COLLATE NOCASE').get(emailFallback) as { email: string } | undefined;
    return row?.email ?? null;
  }
  return null;
}

export function deriveRole(principal: Principal, employee: Employee): Role {
  if (principal.groups?.includes('HR-Admins')) return 'hr_admin';
  if (principal.groups?.includes('Benefits-Team')) return 'benefits_specialist';
  if (principal.groups?.includes('Managers')) return 'manager';
  if (principal.groups && principal.groups.length > 0) {
    return groupsToRole(principal.groups);
  }
  return employee.role as Role;
}

export function getDirectReports(managerEmail: string, db: Database.Database): string[] {
  const rows = db.prepare('SELECT email FROM employees WHERE managerEmail = ? COLLATE NOCASE').all(managerEmail) as { email: string }[];
  return rows.map((r) => r.email);
}

export function canAccessEmployee(
  role: Role,
  userEmail: string,
  targetEmail: string,
  directReports: string[]
): boolean {
  if (role === 'hr_admin') return true;
  if (role === 'benefits_specialist') return true;
  if (role === 'manager') return targetEmail.toLowerCase() === userEmail.toLowerCase() || directReports.map(e => e.toLowerCase()).includes(targetEmail.toLowerCase());
  return targetEmail.toLowerCase() === userEmail.toLowerCase();
}
