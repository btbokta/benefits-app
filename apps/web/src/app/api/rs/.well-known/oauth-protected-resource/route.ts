export function GET() {
  const base = process.env.RESOURCE_BASE_URL ?? 'http://localhost:3000';
  return Response.json({
    resource: base,
    authorization_servers: [`${process.env.OKTA_ORG_URL}/oauth2/default`],
    bearer_methods_supported: ['header'],
    scopes_supported: [
      'benefits.record.read',
      'benefits.compensation.read',
      'benefits.notes.read',
      'benefits.enrollment.read',
      'benefits.enrollment.write',
      'benefits.pto.read',
      'benefits.audit.read',
    ],
  });
}
