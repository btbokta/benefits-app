import { Router } from 'express';
import type { Request, Response } from 'express';
import type Database from 'better-sqlite3';
import type { Plan } from '@benefits-agent/shared';
import { verifyBearer, requireScopes, wwwAuthenticate } from '../auth.js';
import { writeAudit } from '../audit.js';

export function plansRouter(db: Database.Database): Router {
  const router = Router();
  const checkEnrollment = requireScopes('benefits.enrollment.read');

  router.get('/', async (req: Request, res: Response) => {
    const ts = new Date().toISOString();
    let principal;
    try {
      principal = await verifyBearer(req.headers.authorization);
    } catch (err: unknown) {
      const e = err as { message?: string };
      res.setHeader('WWW-Authenticate', wwwAuthenticate);
      writeAudit({ ts, actor: 'anon', userSub: '', tool: 'list_plans', scopeRequired: 'benefits.enrollment.read', decision: 'deny', httpStatus: 401, detail: e.message ?? 'unauthorized', tokenJti: '' });
      res.status(401).json({ error: 'unauthorized', error_description: e.message });
      return;
    }
    try {
      checkEnrollment(principal);
    } catch (err: unknown) {
      const e = err as { message?: string; missing?: string[] };
      res.setHeader('WWW-Authenticate', wwwAuthenticate);
      writeAudit({ ts, actor: principal.cid ?? principal.sub, userSub: principal.sub, tool: 'list_plans', scopeRequired: 'benefits.enrollment.read', decision: 'deny', httpStatus: 403, detail: e.message ?? 'forbidden', tokenJti: principal.jti ?? '' });
      res.status(403).json({ error: 'insufficient_scope', error_description: e.message, missing: e.missing });
      return;
    }
    const plans = db.prepare('SELECT * FROM plans').all() as Plan[];
    writeAudit({ ts, actor: principal.cid ?? principal.sub, userSub: principal.sub, tool: 'list_plans', scopeRequired: 'benefits.enrollment.read', decision: 'allow', httpStatus: 200, detail: `${plans.length} plans`, tokenJti: principal.jti ?? '' });
    res.json(plans);
  });

  return router;
}
