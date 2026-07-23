import type { Employee, PayStub, TaxElection } from '@benefits-agent/shared';
import payrollJson from '../../../../../packages/shared/src/seed/payroll.json';
import taxJson from '../../../../../packages/shared/src/seed/tax_elections.json';
import employeesJson from '../../../../../packages/shared/src/seed/employees.json';

export const employees: Employee[] = (employeesJson as Omit<Employee, 'id'>[]).map((e, i) => ({ ...e, id: i + 1 }));
const payrollData = payrollJson as PayStub[];
const taxData = taxJson as TaxElection[];

export function findEmployee(email: string): Employee | undefined {
  return employees.find(e => e.email.toLowerCase() === email.toLowerCase());
}

export function findEmployeesByManager(managerEmail: string): string[] {
  return employees
    .filter(e => e.managerEmail?.toLowerCase() === managerEmail.toLowerCase())
    .map(e => e.email);
}

export function getLatestPayStubs(email: string, count: number): PayStub[] {
  return payrollData
    .filter(s => s.employeeEmail.toLowerCase() === email.toLowerCase())
    .sort((a, b) => b.payDate.localeCompare(a.payDate))
    .slice(0, count);
}

export function getTaxElection(email: string): TaxElection | undefined {
  return taxData.find(t => t.employeeEmail.toLowerCase() === email.toLowerCase());
}

export interface PendingAdjustment {
  id: string;
  employeeEmail: string;
  requestedBy: string;
  newSalary: number;
  reason: string;
  requestedAt: string;
  status: 'pending';
}

const _pendingAdjustments: PendingAdjustment[] = [];

export function addPendingAdjustment(adj: Omit<PendingAdjustment, 'id' | 'status'>): PendingAdjustment {
  const entry: PendingAdjustment = { ...adj, id: `ADJ-${Date.now()}`, status: 'pending' };
  _pendingAdjustments.push(entry);
  return entry;
}
