import type { Principal } from '../rs/auth';
import { requireScopes } from '../rs/auth';
import { findEmployee, getLatestPayStubs, getTaxElection, addPendingAdjustment } from './data';
import { resolveUserEmail, deriveRole, canAccess, getDirectReports } from './identity';

type McpContent = { type: 'text'; text: string };
type ToolResult = { content: McpContent[] };

function ok(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

function denied(missingScopes: string[], detail = ''): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify({ denied: true, missingScopes, detail }) }] };
}

function noAccess(targetEmail: string): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify({ denied: true, error: `No row-level access to ${targetEmail}` }) }] };
}

function getCtx(principal: Principal) {
  const userEmail = resolveUserEmail(principal);
  if (!userEmail) throw new Error('user_not_found');
  const role = deriveRole(principal);
  const directReports = role === 'manager' ? getDirectReports(userEmail) : [];
  return { userEmail, role, directReports };
}

export async function tool_get_pay_summary(args: { employee_email: string }, principal: Principal): Promise<ToolResult> {
  try { requireScopes('payroll.read')(principal); } catch (e: unknown) {
    return denied((e as { missing?: string[] }).missing ?? ['payroll.read']);
  }
  const { userEmail, role, directReports } = getCtx(principal);
  if (!canAccess(role, userEmail, args.employee_email, directReports)) return noAccess(args.employee_email);
  const stubs = getLatestPayStubs(args.employee_email, 1);
  if (!stubs.length) return ok({ error: 'No payroll records found' });
  const emp = findEmployee(args.employee_email);
  return ok({
    employee: `${emp?.firstName} ${emp?.lastName}`,
    annualSalary: emp?.salary,
    payFrequency: 'bi-weekly',
    latestPayDate: stubs[0].payDate,
    grossPay: stubs[0].grossPay,
    netPay: stubs[0].netPay,
    totalDeductions: stubs[0].federalTax + stubs[0].stateTax + stubs[0].socialSecurity + stubs[0].medicare + stubs[0].benefits,
  });
}

export async function tool_list_pay_stubs(args: { employee_email: string; count?: number }, principal: Principal): Promise<ToolResult> {
  try { requireScopes('payroll.read')(principal); } catch (e: unknown) {
    return denied((e as { missing?: string[] }).missing ?? ['payroll.read']);
  }
  const { userEmail, role, directReports } = getCtx(principal);
  if (!canAccess(role, userEmail, args.employee_email, directReports)) return noAccess(args.employee_email);
  const stubs = getLatestPayStubs(args.employee_email, args.count ?? 3);
  return ok(stubs);
}

export async function tool_get_tax_withholding(args: { employee_email: string }, principal: Principal): Promise<ToolResult> {
  try { requireScopes('payroll.read')(principal); } catch (e: unknown) {
    return denied((e as { missing?: string[] }).missing ?? ['payroll.read']);
  }
  const { userEmail, role, directReports } = getCtx(principal);
  if (!canAccess(role, userEmail, args.employee_email, directReports)) return noAccess(args.employee_email);
  const election = getTaxElection(args.employee_email);
  if (!election) return ok({ error: 'No tax election on file' });
  return ok(election);
}

export async function tool_request_salary_adjustment(
  args: { employee_email: string; new_salary: number; reason: string },
  principal: Principal
): Promise<ToolResult> {
  try { requireScopes('payroll.adjust')(principal); } catch (e: unknown) {
    return denied((e as { missing?: string[] }).missing ?? ['payroll.adjust'], 'payroll.adjust scope is restricted to hr_admin');
  }
  const { userEmail } = getCtx(principal);
  const emp = findEmployee(args.employee_email);
  if (!emp) return ok({ error: 'Employee not found' });
  const adj = addPendingAdjustment({
    employeeEmail: args.employee_email,
    requestedBy: userEmail,
    newSalary: args.new_salary,
    reason: args.reason,
    requestedAt: new Date().toISOString(),
  });
  return ok({
    success: true,
    adjustmentId: adj.id,
    message: `Salary adjustment for ${emp.firstName} ${emp.lastName} submitted for review (${adj.id}). Current: $${emp.salary.toLocaleString()}, requested: $${args.new_salary.toLocaleString()}.`,
  });
}

export const TOOL_DEFINITIONS = [
  {
    name: 'get_pay_summary',
    description: 'Get the most recent pay stub summary for an employee (requires payroll.read)',
    inputSchema: { type: 'object', properties: { employee_email: { type: 'string', format: 'email' } }, required: ['employee_email'] },
  },
  {
    name: 'list_pay_stubs',
    description: 'List recent pay stubs for an employee (requires payroll.read)',
    inputSchema: { type: 'object', properties: { employee_email: { type: 'string', format: 'email' }, count: { type: 'number', minimum: 1, maximum: 6, default: 3 } }, required: ['employee_email'] },
  },
  {
    name: 'get_tax_withholding',
    description: 'Get W-4 tax withholding elections for an employee (requires payroll.read)',
    inputSchema: { type: 'object', properties: { employee_email: { type: 'string', format: 'email' } }, required: ['employee_email'] },
  },
  {
    name: 'request_salary_adjustment',
    description: 'Submit a salary adjustment request (requires payroll.adjust — hr_admin only)',
    inputSchema: { type: 'object', properties: { employee_email: { type: 'string', format: 'email' }, new_salary: { type: 'number', minimum: 1 }, reason: { type: 'string', minLength: 10 } }, required: ['employee_email', 'new_salary', 'reason'] },
  },
];

export async function callPayrollTool(
  name: string,
  args: Record<string, unknown>,
  principal: Principal
): Promise<ToolResult> {
  switch (name) {
    case 'get_pay_summary': return tool_get_pay_summary(args as { employee_email: string }, principal);
    case 'list_pay_stubs': return tool_list_pay_stubs(args as { employee_email: string; count?: number }, principal);
    case 'get_tax_withholding': return tool_get_tax_withholding(args as { employee_email: string }, principal);
    case 'request_salary_adjustment': return tool_request_salary_adjustment(args as { employee_email: string; new_salary: number; reason: string }, principal);
    default: return ok({ error: `Unknown tool: ${name}` });
  }
}
