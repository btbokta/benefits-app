# Deployment Guide — Benefits Portal (Okta for AI Demo)

## Architecture overview

The app is a two-service monorepo:

| Service | Framework | Port | Deploy to |
|---|---|---|---|
| `apps/web` | Next.js 14 (App Router) | 3000 | **Vercel** |
| `apps/resource-server` | Express 4 + SQLite | 3001 | **Railway** (or Render / Fly.io) |

The resource server must be deployed somewhere that supports a persistent Node.js process and a writable filesystem for SQLite. Vercel's serverless model doesn't support this — hence the split.

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

## Step 2 — Deploy the resource server to Railway

Railway gives the resource server a public HTTPS URL and persistent storage (needed for SQLite).

1. Go to https://railway.app → New Project → **Deploy from GitHub repo**
2. Select `benefits-agent-demo`
3. Railway auto-detects Node.js — set the **Root Directory** to `apps/resource-server`
4. Set **Start Command**: `npm start` (or `node dist/index.js` after build)
5. Add a **Build Command**: `npm run build` (runs `tsc`)

**Environment variables in Railway** (Settings → Variables):

```
OKTA_ORG_URL=https://veridiandynamics.okta.com
RESOURCE_AUDIENCE=api://default
RESOURCE_BASE_URL=https://your-rs.railway.app   # Railway provides this URL
WEB_ORIGIN=https://your-app.vercel.app           # Fill in after Vercel deploy
NODE_ENV=production
PORT=3001
```

> Railway assigns a public URL like `https://benefits-agent-demo-production.up.railway.app`. Copy it — you'll need it for `RESOURCE_SERVER_URL` in Vercel.

---

## Step 3 — Deploy the web app to Vercel

1. Go to https://vercel.com/new → Import Git Repository → select `benefits-agent-demo`
2. **Framework Preset**: Next.js (auto-detected)
3. **Root Directory**: `apps/web`
4. **Build Command**: `cd ../.. && npm install && npm run build -w apps/web` *(installs workspace deps first)*

   Or override to: `npm install --legacy-peer-deps && next build`

5. **Output Directory**: `.next` (default)

**Environment variables in Vercel** (Project Settings → Environment Variables):

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
OKTA_AGENT_PRIVATE_JWK=<paste full PEM — see note below>
OKTA_AGENT_KID=<your KID>

# Resource server
RESOURCE_SERVER_URL=https://your-rs.railway.app
RESOURCE_AUDIENCE=api://default
RESOURCE_BASE_URL=https://your-rs.railway.app
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

> **PEM key in Vercel:** Vercel env vars support multi-line values. In the Vercel UI, paste the full PEM block (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`) directly into the value field — it handles newlines correctly.

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
