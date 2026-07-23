import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Employee, PayStub, TaxElection } from '@benefits-agent/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedDir = join(__dirname, '../../../packages/shared/src/seed');

function loadJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(seedDir, file), 'utf-8')) as T;
}

const employeesRaw = loadJson<Omit<Employee, 'id'>[]>('employees.json');
export const employees: Employee[] = employeesRaw.map((e, i) => ({ ...e, id: i + 1 }));

const payrollRaw = loadJson<PayStub[]>('payroll.json');
const taxRaw = loadJson<TaxElection[]>('tax_elections.json');

export function findEmployee(email: string): Employee | undefined {
  return employees.find(e => e.email.toLowerCase() === email.toLowerCase());
}

export function findEmployeesByManager(managerEmail: string): string[] {
  return employees
    .filter(e => e.managerEmail?.toLowerCase() === managerEmail.toLowerCase())
    .map(e => e.email);
}

export function getPayStubs(email: string): PayStub[] {
  return payrollRaw
    .filter(s => s.employeeEmail.toLowerCase() === email.toLowerCase())
    .sort((a, b) => b.payDate.localeCompare(a.payDate));
}

export function getLatestPayStubs(email: string, count: number): PayStub[] {
  return getPayStubs(email).slice(0, count);
}

export function getTaxElection(email: string): TaxElection | undefined {
  return taxRaw.find(t => t.employeeEmail.toLowerCase() === email.toLowerCase());
}

// In-memory pending salary adjustments (resets on restart)
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
