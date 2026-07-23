// Local dev with Express RS: RESOURCE_SERVER_URL=http://localhost:3001
// Vercel: RESOURCE_SERVER_URL=https://your-app.vercel.app (or auto via VERCEL_URL)
// Local dev without Express RS: falls back to same Next.js server on :3000
function getRsBase(): string {
  if (process.env.RESOURCE_SERVER_URL) return process.env.RESOURCE_SERVER_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}
const RS = getRsBase();

// Meridian Payroll MCP server URL
// Local dev: Express server on :3002 at /mcp
// Vercel: Next.js route at /api/payroll-mcp (PAYROLL_MCP_URL unset)
function getPayrollMcpUrl(): string {
  if (process.env.PAYROLL_MCP_URL) return process.env.PAYROLL_MCP_URL;
  // Use VERCEL_PROJECT_PRODUCTION_URL (stable) not VERCEL_URL (deployment-specific)
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (host) return `https://${host}/api/payroll-mcp`;
  return 'http://localhost:3002/mcp';
}

async function mcpCall(toolName: string, args: Record<string, unknown>, bearerToken: string): Promise<{ status: number; body: unknown }> {
  let res: Response;
  try {
    res = await fetch(getPayrollMcpUrl(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/call', params: { name: toolName, arguments: args }, id: 1 }),
    });
  } catch (err) {
    return { status: 503, body: { error: `Meridian Payroll MCP unreachable: ${String(err)}` } };
  }
  if (res.status === 401 || res.status === 403) {
    return { status: res.status, body: { denied: true, error: 'unauthorized' } };
  }
  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (data.error) {
    const rpcErr = data.error as Record<string, unknown>;
    if (rpcErr.code === -32001) return { status: 401, body: { denied: true, error: rpcErr.message } };
    return { status: 500, body: { error: rpcErr.message } };
  }
  const result = data.result as { content?: Array<{ type: string; text: string }> } | undefined;
  const text = result?.content?.[0]?.type === 'text' ? result.content[0].text : undefined;
  if (text) {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (parsed.denied) return { status: 403, body: parsed };
      return { status: 200, body: parsed };
    } catch { /* non-JSON text result */ }
  }
  return { status: 200, body: result ?? data };
}

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
  | 'enroll_in_plan'
  | 'get_pay_summary'
  | 'list_pay_stubs'
  | 'get_tax_withholding'
  | 'request_salary_adjustment';

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
  // Meridian Payroll MCP tools
  {
    name: 'get_pay_summary' as ToolName,
    description: 'Get the most recent pay stub summary for an employee from Meridian Payroll (requires payroll.read)',
    input_schema: {
      type: 'object',
      properties: { employee_email: { type: 'string', description: 'Employee email address' } },
      required: ['employee_email'],
    },
    scopeRequired: 'payroll.read',
  },
  {
    name: 'list_pay_stubs' as ToolName,
    description: 'List recent pay stubs for an employee from Meridian Payroll (requires payroll.read)',
    input_schema: {
      type: 'object',
      properties: {
        employee_email: { type: 'string', description: 'Employee email address' },
        count: { type: 'number', description: 'Number of stubs to return (1-6, default 3)' },
      },
      required: ['employee_email'],
    },
    scopeRequired: 'payroll.read',
  },
  {
    name: 'get_tax_withholding' as ToolName,
    description: 'Get W-4 tax withholding elections for an employee from Meridian Payroll (requires payroll.read)',
    input_schema: {
      type: 'object',
      properties: { employee_email: { type: 'string', description: 'Employee email address' } },
      required: ['employee_email'],
    },
    scopeRequired: 'payroll.read',
  },
  {
    name: 'request_salary_adjustment' as ToolName,
    description: 'Submit a salary adjustment request via Meridian Payroll (requires payroll.adjust — hr_admin only)',
    input_schema: {
      type: 'object',
      properties: {
        employee_email: { type: 'string', description: 'Employee email address' },
        new_salary: { type: 'number', description: 'New annual salary in USD' },
        reason: { type: 'string', description: 'Justification for the adjustment (min 10 characters)' },
      },
      required: ['employee_email', 'new_salary', 'reason'],
    },
    scopeRequired: 'payroll.adjust',
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
      res = await rsGet('/api/rs/employees', bearerToken);
      break;
    case 'get_employee':
      res = await rsGet(`/api/rs/employees/${encodeURIComponent(input.email as string)}`, bearerToken);
      break;
    case 'get_compensation':
      res = await rsGet(`/api/rs/compensation/${encodeURIComponent(input.email as string)}`, bearerToken);
      break;
    case 'list_plans':
      res = await rsGet('/api/rs/plans', bearerToken);
      break;
    case 'get_enrollments': {
      const q = input.employee ? `?employee=${encodeURIComponent(input.employee as string)}` : '';
      res = await rsGet(`/api/rs/enrollments${q}`, bearerToken);
      break;
    }
    case 'enroll_in_plan':
      res = await rsPost('/api/rs/enrollments', bearerToken, input);
      break;
    case 'get_pto': {
      const q = input.employee ? `?employee=${encodeURIComponent(input.employee as string)}` : '';
      res = await rsGet(`/api/rs/pto${q}`, bearerToken);
      break;
    }
    case 'read_audit': {
      const q = input.limit ? `?limit=${input.limit}` : '';
      res = await rsGet(`/api/rs/audit${q}`, bearerToken);
      break;
    }
    // Meridian Payroll MCP tools
    case 'get_pay_summary':
      res = await mcpCall('get_pay_summary', { employee_email: input.employee_email }, bearerToken);
      break;
    case 'list_pay_stubs':
      res = await mcpCall('list_pay_stubs', { employee_email: input.employee_email, count: input.count }, bearerToken);
      break;
    case 'get_tax_withholding':
      res = await mcpCall('get_tax_withholding', { employee_email: input.employee_email }, bearerToken);
      break;
    case 'request_salary_adjustment':
      res = await mcpCall('request_salary_adjustment', { employee_email: input.employee_email, new_salary: input.new_salary, reason: input.reason }, bearerToken);
      break;
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
