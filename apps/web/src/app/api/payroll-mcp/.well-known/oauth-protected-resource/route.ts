export function GET() {
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}/api/payroll-mcp`
    : 'http://localhost:3002';
  return Response.json({
    resource: base,
    authorization_servers: [`${process.env.OKTA_ORG_URL}/oauth2/default`],
    bearer_methods_supported: ['header'],
    scopes_supported: ['payroll.read', 'payroll.adjust'],
  });
}
