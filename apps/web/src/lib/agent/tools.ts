import { z } from 'zod';

const RS = process.env.RESOURCE_SERVER_URL ?? 'http://localhost:3001';

export interface ToolEvent {
  tool: string;
  input: Record<string, unknown>;
  scopeRequired: string;
  allowed: boolean;
  httpStatus: number;
  output: unknown;
}

async function rsGet(path: string, bearerToken: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${RS}${path}`, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function rsPost(path: string, bearerToken: string, data: unknown): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${RS}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

export type ToolName =
  | 'list_employees'
  | 'get_employee'
  | 'list_plans'
  | 'get_enrollments'
  | 'get_pto'
  | 'get_compensation'
  | 'read_audit'
  | 'enroll_in_plan';

export const TOOL_DEFINITIONS = [
  {
    name: 'list_employees' as ToolName,
    description: 'List employees accessible to the current user based on their role',
    input_schema: { type: 'object', properties: {}, required: [] },
    scopeRequired: 'benefits.record.read',
  },
  {
    name: 'get_employee' as ToolName,
    description: 'Get details for a specific employee by email address',
    input_schema: {
      type: 'object',
      properties: { email: { type: 'string', description: 'Employee email address' } },
      required: ['email'],
    },
    scopeRequired: 'benefits.record.read',
  },
  {
    name: 'get_compensation' as ToolName,
    description: 'Get salary/compensation information for an employee (requires compensation scope)',
    input_schema: {
      type: 'object',
      properties: { email: { type: 'string', description: 'Employee email address' } },
      required: ['email'],
    },
    scopeRequired: 'benefits.compensation.read',
  },
  {
    name: 'list_plans' as ToolName,
    description: 'List all available benefit plans (medical, dental, vision)',
    input_schema: { type: 'object', properties: {}, required: [] },
    scopeRequired: 'benefits.enrollment.read',
  },
  {
    name: 'get_enrollments' as ToolName,
    description: 'Get benefit enrollments for an employee',
    input_schema: {
      type: 'object',
      properties: { employee: { type: 'string', description: 'Employee email (optional; defaults to self)' } },
      required: [],
    },
    scopeRequired: 'benefits.enrollment.read',
  },
  {
    name: 'enroll_in_plan' as ToolName,
    description: 'Enroll an employee in a benefit plan',
    input_schema: {
      type: 'object',
      properties: {
        employeeEmail: { type: 'string' },
        planId: { type: 'number' },
        coverageLevel: { type: 'string', enum: ['self', 'self+spouse', 'family'] },
        effectiveDate: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['employeeEmail', 'planId', 'coverageLevel', 'effectiveDate'],
    },
    scopeRequired: 'benefits.enrollment.write',
  },
  {
    name: 'get_pto' as ToolName,
    description: 'Get PTO balances for an employee',
    input_schema: {
      type: 'object',
      properties: { employee: { type: 'string', description: 'Employee email (optional; defaults to self)' } },
      required: [],
    },
    scopeRequired: 'benefits.pto.read',
  },
  {
    name: 'read_audit' as ToolName,
    description: 'Read the authorization audit log (hr_admin only)',
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'Max rows to return (default 50)' } },
      required: [],
    },
    scopeRequired: 'benefits.audit.read',
  },
];

export async function executeTool(
  name: ToolName,
  input: Record<string, unknown>,
  bearerToken: string
): Promise<{ result: unknown; event: ToolEvent }> {
  const def = TOOL_DEFINITIONS.find((t) => t.name === name);
  const scopeRequired = def?.scopeRequired ?? 'unknown';

  let res: { status: number; body: unknown };

  switch (name) {
    case 'list_employees':
      res = await rsGet('/api/employees', bearerToken);
      break;
    case 'get_employee':
      res = await rsGet(`/api/employees/${encodeURIComponent(input.email as string)}`, bearerToken);
      break;
    case 'get_compensation':
      res = await rsGet(`/api/compensation/${encodeURIComponent(input.email as string)}`, bearerToken);
      break;
    case 'list_plans':
      res = await rsGet('/api/plans', bearerToken);
      break;
    case 'get_enrollments': {
      const q = input.employee ? `?employee=${encodeURIComponent(input.employee as string)}` : '';
      res = await rsGet(`/api/enrollments${q}`, bearerToken);
      break;
    }
    case 'enroll_in_plan':
      res = await rsPost('/api/enrollments', bearerToken, input);
      break;
    case 'get_pto': {
      const q = input.employee ? `?employee=${encodeURIComponent(input.employee as string)}` : '';
      res = await rsGet(`/api/pto${q}`, bearerToken);
      break;
    }
    case 'read_audit': {
      const q = input.limit ? `?limit=${input.limit}` : '';
      res = await rsGet(`/api/audit${q}`, bearerToken);
      break;
    }
    default:
      res = { status: 400, body: { error: 'unknown_tool' } };
  }

  const allowed = res.status >= 200 && res.status < 300;
  const body = res.body as Record<string, unknown>;
  const denied = !allowed ? { denied: true, missingScopes: body.missing ?? [scopeRequired], error: body.error, error_description: body.error_description } : null;

  const event: ToolEvent = {
    tool: name,
    input,
    scopeRequired,
    allowed,
    httpStatus: res.status,
    output: allowed ? res.body : denied,
  };

  return { result: allowed ? res.body : denied, event };
}
