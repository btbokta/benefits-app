export type Role = 'hr_admin' | 'benefits_specialist' | 'manager' | 'employee';

export type Scope =
  | 'benefits.record.read'
  | 'benefits.compensation.read'
  | 'benefits.notes.read'
  | 'benefits.enrollment.read'
  | 'benefits.enrollment.write'
  | 'benefits.pto.read'
  | 'benefits.audit.read'
  | 'payroll.read'
  | 'payroll.adjust';

export const ALL_SCOPES: Scope[] = [
  'benefits.record.read',
  'benefits.compensation.read',
  'benefits.notes.read',
  'benefits.enrollment.read',
  'benefits.enrollment.write',
  'benefits.pto.read',
  'benefits.audit.read',
  'payroll.read',
  'payroll.adjust',
];

export interface PayStub {
  employeeEmail: string;
  payDate: string;
  grossPay: number;
  netPay: number;
  federalTax: number;
  stateTax: number;
  socialSecurity: number;
  medicare: number;
  benefits: number;
}

export interface TaxElection {
  employeeEmail: string;
  filingStatus: 'single' | 'married' | 'head_of_household';
  allowances: number;
  additionalWithholding: number;
  exemptFromFederal: boolean;
}

export interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  title: string;
  managerEmail: string | null;
  role: Role;
  salary: number;
  hrNotes: string;
}

export interface Plan {
  id: number;
  name: string;
  type: 'medical' | 'dental' | 'vision';
  monthlyPremium: number;
}

export interface Enrollment {
  id: number;
  employeeEmail: string;
  planId: number;
  coverageLevel: 'self' | 'self+spouse' | 'family';
  effectiveDate: string;
}

export interface PtoBalance {
  id: number;
  employeeEmail: string;
  vacationHours: number;
  sickHours: number;
  personalHours: number;
}

export interface AuditRow {
  id?: number;
  ts: string;
  actor: string;
  userSub: string;
  tool: string;
  scopeRequired: string;
  decision: 'allow' | 'deny';
  httpStatus: number;
  detail: string;
  tokenJti: string;
}
