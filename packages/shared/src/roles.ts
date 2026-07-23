import type { Role, Scope } from './types.js';

export const ROLE_SCOPES: Record<Role, Scope[]> = {
  hr_admin: [
    'benefits.record.read',
    'benefits.compensation.read',
    'benefits.notes.read',
    'benefits.enrollment.read',
    'benefits.enrollment.write',
    'benefits.pto.read',
    'benefits.audit.read',
    'payroll.read',
    'payroll.adjust',
  ],
  benefits_specialist: [
    'benefits.record.read',
    'benefits.enrollment.read',
    'benefits.enrollment.write',
    'benefits.pto.read',
    'payroll.read',
  ],
  manager: [
    'benefits.record.read',
    'benefits.enrollment.read',
    'benefits.pto.read',
    'payroll.read',
  ],
  employee: [
    'benefits.record.read',
    'benefits.enrollment.read',
    'benefits.enrollment.write',
    'benefits.pto.read',
    'payroll.read',
  ],
};

const GROUP_TO_ROLE: Record<string, Role> = {
  'BenefitsDemo-HR-Admins': 'hr_admin',
  'BenefitsDemo-Benefits-Team': 'benefits_specialist',
  'BenefitsDemo-Managers': 'manager',
  'BenefitsDemo-Employees': 'employee',
};

export function groupsToRole(groups: string[]): Role {
  const order: Role[] = ['hr_admin', 'benefits_specialist', 'manager', 'employee'];
  for (const role of order) {
    const group = Object.entries(GROUP_TO_ROLE).find(([, r]) => r === role)?.[0];
    if (group && groups.includes(group)) return role;
  }
  return 'employee';
}
