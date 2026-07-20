import type { Employee, Plan, Enrollment, PtoBalance } from '@benefits-agent/shared';

// Load seed JSON at module init — persists within the serverless instance lifetime
import employeesJson from '../../../../../packages/shared/src/seed/employees.json';
import plansJson from '../../../../../packages/shared/src/seed/plans.json';
import enrollmentsJson from '../../../../../packages/shared/src/seed/enrollments.json';
import ptoJson from '../../../../../packages/shared/src/seed/pto_balances.json';

// Assign stable IDs
export const employees: Employee[] = (employeesJson as Omit<Employee, 'id'>[]).map((e, i) => ({
  ...e,
  id: i + 1,
}));

export const plans: Plan[] = (plansJson as Omit<Plan, 'id'>[]).map((p, i) => ({
  ...p,
  id: i + 1,
}));

export const enrollments: Enrollment[] = (enrollmentsJson as Omit<Enrollment, 'id'>[]).map((e, i) => ({
  ...e,
  id: i + 1,
}));

export const ptoBalances: PtoBalance[] = (ptoJson as Omit<PtoBalance, 'id'>[]).map((p, i) => ({
  ...p,
  id: i + 1,
}));

export function findEmployee(email: string): Employee | undefined {
  return employees.find(e => e.email.toLowerCase() === email.toLowerCase());
}

export function findEmployeesByManager(managerEmail: string): string[] {
  return employees
    .filter(e => e.managerEmail?.toLowerCase() === managerEmail.toLowerCase())
    .map(e => e.email);
}
