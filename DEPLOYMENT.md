# Deployment Guide — Benefits Portal (Okta for AI Demo)

## Architecture overview

Everything deploys to **Vercel** as a single Next.js app.

| What | Where | Notes |
|---|---|---|
| `apps/web` | Vercel | Includes both the UI and the resource-server API routes at `/api/rs/*` |
| Data | In-memory (JSON seed files) | Employees/plans/PTO seeded from JSON on cold start. Audit log in-memory — resets on redeploy/cold start. Acceptable for demo use. |

> **Local dev:** The Express resource server (`apps/resource-server`) still runs on :3001 when you `npm run dev` — set `RESOURCE_SERVER_URL=http://localhost:3001` in your local `.env` to use it. On Vercel, leave `RESOURCE_SERVER_URL` unset and it auto-uses the Next.js routes.

> **Caveat:** Audit log entries do not survive Vercel redeployments or cold starts (Vercel scales down idle functions after ~5 min inactivity). The demo story still works — the log fills up as you run queries during a session.

---

## Step 1 — Push to GitHub

The `benefits-agent/` directory has its own git repo. Create a new GitHub repository and push to it.

**Option A — GitHub CLI (fastest):**
```bash
cd benefits-agent
gh repo create btbokta/benefits-agent-demo --public --source=. --remote=origin --push
```

**Option B — Manual:**
1. Go to https://github.com/new → name it `benefits-agent-demo` → Create
2. In `benefits-agent/`:
```bash
git remote add origin https://github.com/btbokta/benefits-agent-demo.git
git branch -M main
git push -u origin main
```

---

## Step 2 — Deploy to Vercel

1. Go to https://vercel.com/new → Import Git Repository → select `benefits-app`
2. **Framework Preset**: Next.js (auto-detected)
3. **Root Directory**: `apps/web`
4. **Install Command**: `cd ../.. && npm install --cache /tmp/npm-cache`
5. **Build Command**: `next build`
6. **Output Directory**: `.next` (default)

**Environment variables** (Project Settings → Environment Variables → add each):

```bash
# Okta
OKTA_ORG_URL=https://veridiandynamics.okta.com
OKTA_AI_MODE=agents
OKTA_WEB_CLIENT_ID=0oa15eg6vx5RZbYjf698
OKTA_WEB_CLIENT_SECRET=<from Okta app>
OKTA_REDIRECT_URI=https://your-app.vercel.app/auth/callback
OKTA_POST_LOGOUT_URI=https://your-app.vercel.app

# Agent identity
OKTA_AGENT_CLIENT_ID=wlp15eh9z6hj8G8tb698
OKTA_AGENT_PRIVATE_JWK=<paste full PEM including BEGIN/END lines>
OKTA_AGENT_KID=<your KID>

# Resource server (leave RESOURCE_SERVER_URL unset — auto-uses VERCEL_URL)
RESOURCE_AUDIENCE=api://default
RESOURCE_BASE_URL=https://your-app.vercel.app
USER_IDENTITY_CLAIM=sub

# Session
SESSION_SECRET=<generate: openssl rand -hex 32>

# LLM
ANTHROPIC_API_KEY=<your key>
ANTHROPIC_BASE_URL=<your LiteLLM base URL>
ANTHROPIC_MODEL=claude-sonnet-4-6
MOCK_LLM=false
AGENT_TOOL_TRANSPORT=rest

# Public (visible client-side)
NEXT_PUBLIC_OKTA_ORG_URL=https://veridiandynamics.okta.com
```

> **PEM key:** Paste the full multi-line PEM directly into the Vercel env var UI — it handles newlines correctly.

---

## Step 4 — Update Okta callback URLs

The deployed app needs its production URLs registered in Okta.

**Admin Console → Applications → Benefits Agent - Web → General tab:**

Add to **Sign-in redirect URIs**:
```
https://your-app.vercel.app/auth/callback
```

Add to **Sign-out redirect URIs**:
```
https://your-app.vercel.app
```

**Admin Console → Security → API → Trusted Origins → Add Origin:**
- Origin: `https://your-app.vercel.app`
- Check both **CORS** and **Redirect**

---

## Step 5 — Re-run or verify setup

If you want to verify your Okta org config is still correct after deployment:

```bash
cd benefits-agent
OKTA_ORG_URL=https://veridiandynamics.okta.com OKTA_API_TOKEN=your_token node scripts/verify-okta.mjs
```

---

## Step 6 — Test end-to-end

1. Visit `https://your-app.vercel.app`
2. Sign in (incognito) as `emily.davis@acmecorp.example`
3. Ask "How much PTO do I have?" → should return Emily's data
4. Ask "What is my salary?" → should show live Okta denial
5. Visit `/flow` → token chain should show live exchange
6. Check `/audit` (as Sarah) → decisions should persist in Railway's SQLite

---

## Notes

**SQLite on Railway:** The database seeds automatically on startup. Data persists between restarts but resets on re-deploy. For a demo this is fine — seed data is deterministic.

**Vercel monorepo build:** If the build fails with missing workspace dependencies, change the Install Command in Vercel to:
```
npm install --prefix ../..
```
and Root Directory to `apps/web`.

**Scaling:** For a real deployment, swap SQLite for Postgres (Railway provides managed Postgres). The `better-sqlite3` calls in `packages/shared/src/db.ts` would need to be replaced with a Postgres client.
