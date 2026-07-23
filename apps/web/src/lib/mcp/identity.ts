import type { Role } from '@benefits-agent/shared';
import { groupsToRole } from '@benefits-agent/shared';
import type { Principal } from '../rs/auth';
import { findEmployee, findEmployeesByManager } from './data';

const IDENTITY_CLAIM = process.env.USER_IDENTITY_CLAIM ?? 'sub';

export function resolveUserEmail(principal: Principal): string | null {
  const raw = IDENTITY_CLAIM === 'email' ? principal.email : principal.sub;
  if (!raw) return null;
  if (raw.includes('@')) {
    const emp = findEmployee(raw);
    return emp?.email ?? null;
  }
  const emailFallback = principal.email;
  if (emailFallback) {
    const emp = findEmployee(emailFallback);
    return emp?.email ?? null;
  }
  return null;
}

export function deriveRole(principal: Principal): Role {
  if (principal.groups?.includes('BenefitsDemo-HR-Admins')) return 'hr_admin';
  if (principal.groups?.includes('BenefitsDemo-Benefits-Team')) return 'benefits_specialist';
  if (principal.groups?.includes('BenefitsDemo-Managers')) return 'manager';
  if (principal.groups && principal.groups.length > 0) return groupsToRole(principal.groups);
  const email = resolveUserEmail(principal);
  return (email ? findEmployee(email)?.role : undefined) ?? 'employee';
}

export function canAccess(role: Role, userEmail: string, targetEmail: string, directReports: string[]): boolean {
  if (role === 'hr_admin' || role === 'benefits_specialist') return true;
  if (role === 'manager') return (
    targetEmail.toLowerCase() === userEmail.toLowerCase() ||
    directReports.map(e => e.toLowerCase()).includes(targetEmail.toLowerCase())
  );
  return targetEmail.toLowerCase() === userEmail.toLowerCase();
}

export function getDirectReports(managerEmail: string): string[] {
  return findEmployeesByManager(managerEmail);
}
