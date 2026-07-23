#!/usr/bin/env node
/**
 * Creates the Okta OAuth app required for the Meridian Payroll MCP server registration.
 * Okta's Directory > MCP Servers requires a preregistered confidential client (auth_code flow).
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const content = readFileSync(resolve(root, '.env'), 'utf8');
const env = {};
for (const line of content.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq < 0) continue;
  const k = t.slice(0, eq).trim();
  let v = t.slice(eq + 1);
  if ((v[0] === '"' || v[0] === "'") && v.endsWith(v[0])) v = v.slice(1, -1);
  env[k] = v;
}

const orgUrl = env.OKTA_ORG_URL.replace(/\/$/, '');
const apiToken = env.OKTA_API_TOKEN;

// Use the existing Vercel callback URI — this is the redirect URI for the app
// (Okta requires one even though our MCP server doesn't do auth-code redirects)
const vercelUrl = process.argv[2] ?? 'https://benefits-app.vercel.app';
const redirectUri = `${vercelUrl}/auth/callback`;

const appPayload = {
  name: 'oidc_client',
  label: 'Meridian Payroll MCP Server',
  signOnMode: 'OPENID_CONNECT',
  credentials: {
    oauthClient: {
      autoKeyRotation: true,
      token_endpoint_auth_method: 'client_secret_post',
    },
  },
  settings: {
    oauthClient: {
      client_uri: vercelUrl + '/api/payroll-mcp',
      logo_uri: null,
      redirect_uris: [redirectUri],
      response_types: ['code'],
      grant_types: ['authorization_code', 'refresh_token'],
      application_type: 'web',
      consent_method: 'REQUIRED',
      issuer_mode: 'ORG_URL',
    },
  },
  profile: {
    implicitAssignment: false,
  },
};

const res = await fetch(`${orgUrl}/api/v1/apps`, {
  method: 'POST',
  headers: {
    Authorization: `SSWS ${apiToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  body: JSON.stringify(appPayload),
});

const body = await res.json();

if (!res.ok) {
  console.error('Failed to create app:', JSON.stringify(body, null, 2));
  process.exit(1);
}

const clientId = body.id;
const clientSecret = body.credentials?.oauthClient?.client_secret;

console.log('\n  Meridian Payroll MCP Server — Okta app created\n');
console.log('  App ID:        ', clientId);
console.log('  Client ID:     ', clientId);
console.log('  Client Secret: ', clientSecret ?? '(run: okta apps list to retrieve)');
console.log('\n  Use these values in Directory > MCP Servers > Add MCP server:\n');
console.log('  Name:           Meridian Payroll');
console.log('  Base URL:      ', vercelUrl + '/api/payroll-mcp');
console.log('  Credentials name: Meridian Payroll Credential');
console.log('  Client ID:     ', clientId);
console.log('  Client Secret: ', clientSecret ?? '<see above>');
console.log('  Scopes:         payroll.read  payroll.adjust\n');
console.log('  Note: Base URL is permanent — make sure this is your production Vercel URL.');
console.log('        Pass your production URL as an argument: node scripts/register-mcp-app.mjs https://your-app.vercel.app\n');
