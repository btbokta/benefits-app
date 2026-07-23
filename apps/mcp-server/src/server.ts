import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Principal } from './auth.js';
import { requireScopes } from './auth.js';
import { getLatestPayStubs, getPayStubs, getTaxElection, addPendingAdjustment, findEmployee } from './data.js';
import { resolveUserEmail, deriveRole, canAccess, getDirectReports } from './identity.js';

function denied(missingScopes: string[], detail = '') {
  return { content: [{ type: 'text' as const, text: JSON.stringify({ denied: true, missingScopes, detail }) }] };
}

function noAccess(targetEmail: string) {
  return { content: [{ type: 'text' as const, text: JSON.stringify({ denied: true, error: `No row-level access to ${targetEmail}` }) }] };
}

export function buildPayrollMcpServer(principal: Principal): McpServer {
  const server = new McpServer({ name: 'meridian-payroll', version: '1.0.0' });

  const getCtx = () => {
    const userEmail = resolveUserEmail(principal);
    if (!userEmail) throw new Error('user_not_found');
    const role = deriveRole(principal);
    const directReports = role === 'manager' ? getDirectReports(userEmail) : [];
    return { userEmail, role, directReports };
  };

  server.tool(
    'get_pay_summary',
    'Get the most recent pay stub summary for an employee (requires payroll.read)',
    { employee_email: z.string().email() },
    async ({ employee_email }) => {
      try { requireScopes('payroll.read')(principal); } catch (e: unknown) {
        const err = e as { missing?: string[] };
        return denied(err.missing ?? ['payroll.read']);
      }
      const { userEmail, role, directReports } = getCtx();
      if (!canAccess(role, userEmail, employee_email, directReports)) return noAccess(employee_email);
      const stubs = getLatestPayStubs(employee_email, 1);
      if (!stubs.length) return { content: [{ type: 'text', text: JSON.stringify({ error: 'No payroll records found' }) }] };
      const emp = findEmployee(employee_email);
      return { content: [{ type: 'text', text: JSON.stringify({
        employee: `${emp?.firstName} ${emp?.lastName}`,
        annualSalary: emp?.salary,
        payFrequency: 'bi-weekly',
        latestPayDate: stubs[0].payDate,
        grossPay: stubs[0].grossPay,
        netPay: stubs[0].netPay,
        totalDeductions: stubs[0].federalTax + stubs[0].stateTax + stubs[0].socialSecurity + stubs[0].medicare + stubs[0].benefits,
      }) }] };
    }
  );

  server.tool(
    'list_pay_stubs',
    'List recent pay stubs for an employee (requires payroll.read)',
    { employee_email: z.string().email(), count: z.number().int().min(1).max(6).default(3) },
    async ({ employee_email, count }) => {
      try { requireScopes('payroll.read')(principal); } catch (e: unknown) {
        const err = e as { missing?: string[] };
        return denied(err.missing ?? ['payroll.read']);
      }
      const { userEmail, role, directReports } = getCtx();
      if (!canAccess(role, userEmail, employee_email, directReports)) return noAccess(employee_email);
      const stubs = getLatestPayStubs(employee_email, count);
      return { content: [{ type: 'text', text: JSON.stringify(stubs) }] };
    }
  );

  server.tool(
    'get_tax_withholding',
    'Get W-4 tax withholding elections for an employee (requires payroll.read)',
    { employee_email: z.string().email() },
    async ({ employee_email }) => {
      try { requireScopes('payroll.read')(principal); } catch (e: unknown) {
        const err = e as { missing?: string[] };
        return denied(err.missing ?? ['payroll.read']);
      }
      const { userEmail, role, directReports } = getCtx();
      if (!canAccess(role, userEmail, employee_email, directReports)) return noAccess(employee_email);
      const election = getTaxElection(employee_email);
      if (!election) return { content: [{ type: 'text', text: JSON.stringify({ error: 'No tax election on file' }) }] };
      return { content: [{ type: 'text', text: JSON.stringify(election) }] };
    }
  );

  server.tool(
    'request_salary_adjustment',
    'Submit a salary adjustment request for an employee (requires payroll.adjust — hr_admin only)',
    { employee_email: z.string().email(), new_salary: z.number().positive(), reason: z.string().min(10) },
    async ({ employee_email, new_salary, reason }) => {
      try { requireScopes('payroll.adjust')(principal); } catch (e: unknown) {
        const err = e as { missing?: string[] };
        return denied(err.missing ?? ['payroll.adjust'], 'payroll.adjust scope is restricted to hr_admin');
      }
      const { userEmail } = getCtx();
      const emp = findEmployee(employee_email);
      if (!emp) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Employee not found' }) }] };
      const adj = addPendingAdjustment({
        employeeEmail: employee_email,
        requestedBy: userEmail,
        newSalary: new_salary,
        reason,
        requestedAt: new Date().toISOString(),
      });
      return { content: [{ type: 'text', text: JSON.stringify({
        success: true,
        adjustmentId: adj.id,
        message: `Salary adjustment for ${emp.firstName} ${emp.lastName} submitted for review (${adj.id}). Current salary: $${emp.salary.toLocaleString()}, requested: $${new_salary.toLocaleString()}.`,
      }) }] };
    }
  );

  return server;
}
