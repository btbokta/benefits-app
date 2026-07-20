// Load root .env (supports multi-line quoted values, e.g. PEM keys)
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __appDir = dirname(fileURLToPath(import.meta.url));
const envPath = resolvePath(__appDir, '..', '..', '..', '.env');
if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf8');
  const lines: string[] = [];
  let buf = '', inQ = false;
  for (const raw of content.split('\n')) {
    if (!inQ) {
      const t = raw.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 0) continue;
      const val = t.slice(eq + 1);
      const q = val[0];
      if ((q === '"' || q === "'") && !val.slice(1).includes(q)) { buf = raw; inQ = true; continue; }
      lines.push(raw);
    } else {
      buf += '\n' + raw;
      const q = buf[buf.indexOf('=') + 1];
      if (buf.slice(buf.indexOf('=') + 2).includes(q)) { inQ = false; lines.push(buf); buf = ''; }
    }
  }
  for (const line of lines) {
    const t = line.trim();
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1);
    const q = v[0];
    if ((q === '"' || q === "'") && v.endsWith(q) && v.length > 1) v = v.slice(1, -1);
    v = v.replace(/\\n/g, '\n');
    if (k && !process.env[k]) process.env[k] = v;
  }
}

import express from 'express';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDb, seed } from '@benefits-agent/shared';
import { setDb } from './audit.js';
import { PRM_URL, wwwAuthenticate } from './auth.js';
import { employeesRouter } from './routes/employees.js';
import { plansRouter } from './routes/plans.js';
import { enrollmentsRouter } from './routes/enrollments.js';
import { ptoRouter } from './routes/pto.js';
import { compensationRouter } from './routes/compensation.js';
import { auditRouter } from './routes/audit-route.js';
import { mcpRouter } from './routes/mcp.js';

const PORT = Number(process.env.PORT ?? 3001);
const dataDir = resolve(process.cwd(), 'data');
mkdirSync(dataDir, { recursive: true });

const db = getDb(resolve(dataDir, 'benefits.sqlite'));
seed(db);
setDb(db);

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.WEB_ORIGIN ?? 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

app.get('/healthz', (_req, res) => {
  res.json({
    ok: true,
    issuer: `${process.env.OKTA_ORG_URL}/oauth2/default`,
    audience: process.env.RESOURCE_AUDIENCE ?? 'api://default',
  });
});

app.get('/.well-known/oauth-protected-resource', (_req, res) => {
  const base = process.env.RESOURCE_BASE_URL ?? 'http://localhost:3001';
  res.json({
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
});

app.use('/api/employees', employeesRouter(db));
app.use('/api/plans', plansRouter(db));
app.use('/api/enrollments', enrollmentsRouter(db));
app.use('/api/pto', ptoRouter(db));
app.use('/api/compensation', compensationRouter(db));
app.use('/api/audit', auditRouter(db));
app.use('/mcp', mcpRouter(db));

// Debug route: expose subject token (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/debug/mode', (_req, res) => {
    res.json({ mode: process.env.OKTA_AI_MODE ?? 'unset' });
  });
}

// Error handler
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const e = err as { status?: number; message?: string };
  const status = e.status ?? 500;
  if (status === 401 || status === 403) {
    res.setHeader('WWW-Authenticate', wwwAuthenticate);
  }
  res.status(status).json({ error: e.message ?? 'internal_error' });
});

app.listen(PORT, () => {
  console.log(`Resource server listening on :${PORT}`);
  console.log(`  issuer: ${process.env.OKTA_ORG_URL}/oauth2/default`);
  console.log(`  PRM: ${PRM_URL}`);
});
