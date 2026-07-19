export type Role = 'hr_admin' | 'benefits_specialist' | 'manager' | 'employee';

export type Scope =
  | 'benefits.record.read'
  | 'benefits.compensation.read'
  | 'benefits.notes.read'
  | 'benefits.enrollment.read'
  | 'benefits.enrollment.write'
  | 'benefits.pto.read'
  | 'benefits.audit.read';

export const ALL_SCOPES: Scope[] = [
  'benefits.record.read',
  'benefits.compensation.read',
  'benefits.notes.read',
  'benefits.enrollment.read',
  'benefits.enrollment.write',
  'benefits.pto.read',
  'benefits.audit.read',
];

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
