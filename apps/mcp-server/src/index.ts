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
import type { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { verifyBearer } from './auth.js';
import { buildPayrollMcpServer } from './server.js';

const app = express();
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ service: 'meridian-payroll', status: 'ok', version: '1.0.0' });
});

app.post('/mcp', async (req: Request, res: Response) => {
  let principal;
  try {
    principal = await verifyBearer(req.headers.authorization);
  } catch (err: unknown) {
    const e = err as { message?: string };
    res.setHeader('WWW-Authenticate', 'Bearer');
    res.status(401).json({ error: 'unauthorized', error_description: e.message });
    return;
  }

  const server = buildPayrollMcpServer(principal);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const port = parseInt(process.env.MCP_SERVER_PORT ?? '3002', 10);
app.listen(port, () => {
  console.log(`[meridian-payroll] MCP server listening on :${port}`);
});
