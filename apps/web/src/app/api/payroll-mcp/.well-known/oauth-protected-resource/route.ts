export function GET() {
  // VERCEL_PROJECT_PRODUCTION_URL is the stable production hostname (e.g. benefits-app-five.vercel.app)
  // VERCEL_URL is deployment-specific and changes per deploy — must not be used here
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  const base = host ? `https://${host}/api/payroll-mcp` : 'http://localhost:3002';
  return Response.json({
    resource: base,
    authorization_servers: [`${process.env.OKTA_ORG_URL}/oauth2/default`],
    bearer_methods_supported: ['header'],
    scopes_supported: ['payroll.read', 'payroll.adjust'],
  });
}
