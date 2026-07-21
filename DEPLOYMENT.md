# Vercel Deployment Guide — Benefits Portal (Okta for AI Demo)

**GitHub repo:** https://github.com/btbokta/benefits-app  
**Architecture:** Single Next.js app on Vercel. No separate database or second service required.

> **Data note:** Employee/benefits data loads from bundled JSON files on every cold start. The audit log is in-memory and resets on redeploy or cold start (~5 min idle). This is acceptable for demo use.

---

## Step 1 — Create the Vercel project

1. Go to **https://vercel.com/new**
2. Click **Import Git Repository** → select **`btbokta/benefits-app`**
3. Configure the project settings:

| Setting | Value |
|---|---|
| **Framework Preset** | Next.js *(auto-detected)* |
| **Root Directory** | `apps/web` |
| **Install Command** | `cd ../.. && npm install --cache /tmp/npm-cache` |
| **Build Command** | `next build` |
| **Output Directory** | `.next` *(default)* |

4. **Do not deploy yet** — add environment variables first (Step 2).

---

## Step 2 — Add environment variables

Go to **Project Settings → Environment Variables** and add each variable below. Set all of them to apply to **Production**, **Preview**, and **Development** environments.

### Okta — Authentication

| Variable | Value |
|---|---|
| `OKTA_ORG_URL` | `https://veridiandynamics.okta.com` |
| `OKTA_AI_MODE` | `agents` |
| `OKTA_WEB_CLIENT_ID` | `0oa15eg6vx5RZbYjf698` |
| `OKTA_WEB_CLIENT_SECRET` | *(from Okta: Applications → Benefits Agent - Web → Client Credentials)* |
| `OKTA_REDIRECT_URI` | `https://your-app.vercel.app/auth/callback` *(update after first deploy)* |
| `OKTA_POST_LOGOUT_URI` | `https://your-app.vercel.app` *(update after first deploy)* |

### Okta — AI Agent identity

| Variable | Value |
|---|---|
| `OKTA_AGENT_CLIENT_ID` | `wlp15eh9z6hj8G8tb698` |
| `OKTA_AGENT_KID` | `5f28da21625d2c9c30e94d17b2963a65` |
| `OKTA_AGENT_PRIVATE_JWK` | *(full PEM — see note below)* |

> **OKTA_AGENT_PRIVATE_JWK — how to paste it:**  
> In the Vercel UI, click the variable name field, type `OKTA_AGENT_PRIVATE_JWK`, then in the value field paste the entire PEM block including the header and footer lines:
> ```
> -----BEGIN PRIVATE KEY-----
> MIIEvg...
> -----END PRIVATE KEY-----
> ```
> Vercel preserves multi-line values — do not collapse it to a single line.

### Resource server

| Variable | Value |
|---|---|
| `RESOURCE_AUDIENCE` | `api://default` |
| `RESOURCE_BASE_URL` | `https://your-app.vercel.app` *(update after first deploy)* |
| `USER_IDENTITY_CLAIM` | `sub` |

> **Do not set `RESOURCE_SERVER_URL`** — leaving it unset tells the app to call its own `/api/rs/*` routes using the Vercel deployment URL automatically.

### Session

| Variable | Value |
|---|---|
| `SESSION_SECRET` | *(generate: run `openssl rand -hex 32` in your terminal)* |

### LLM

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | *(your key — starts with `sk-as-WS`)* |
| `ANTHROPIC_BASE_URL` | *(your LiteLLM proxy base URL)* |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` |
| `MOCK_LLM` | `false` |
| `AGENT_TOOL_TRANSPORT` | `rest` |

### Public (exposed to the browser)

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_OKTA_ORG_URL` | `https://veridiandynamics.okta.com` |

---

## Step 3 — Deploy

Click **Deploy**. The first build takes ~2 minutes.

Once complete, Vercel shows your deployment URL (e.g. `https://benefits-app-abc123.vercel.app`). Copy it.

---

## Step 4 — Update URLs with your production domain

### 4a — Update Vercel environment variables

Go back to **Project Settings → Environment Variables** and update:

| Variable | New value |
|---|---|
| `OKTA_REDIRECT_URI` | `https://your-actual-domain.vercel.app/auth/callback` |
| `OKTA_POST_LOGOUT_URI` | `https://your-actual-domain.vercel.app` |
| `RESOURCE_BASE_URL` | `https://your-actual-domain.vercel.app` |

Then **redeploy** (Deployments → ⋯ → Redeploy).

### 4b — Update Okta

**Applications → Benefits Agent - Web → General tab:**

Add to **Sign-in redirect URIs**:
```
https://your-actual-domain.vercel.app/auth/callback
```

Add to **Sign-out redirect URIs**:
```
https://your-actual-domain.vercel.app
```

**Security → API → Trusted Origins → Add Origin:**
- Origin: `https://your-actual-domain.vercel.app`
- Check both **CORS** and **Redirect**

---

## Step 5 — Verify the deployment

Open your Vercel URL in an **incognito window** and run through these checks:

| Check | Expected result |
|---|---|
| Home page loads | Persona list visible, "Sign in with Okta" button present |
| Sign in as `emily.davis@acmecorp.example` | Redirects to Okta login, returns to portal with role `employee` |
| Chat → "How much PTO do I have?" | Returns Emily's PTO balance |
| Chat → "What is my salary?" | Live Okta denial — `benefits.compensation.read` missing |
| `/flow` | Three-node token chain with live decoded JWT |
| Sign out as Emily, sign in as `sarah.johnson@acmecorp.example` | Role shows `hr_admin`, full scope ceiling |
| Chat → "What is Michael Chen's salary?" | Returns salary (Sarah has compensation scope) |
| `/audit` | Shows allow + deny decisions from this session |

---

## Troubleshooting

**Build fails with "Cannot find module"**  
Make sure Root Directory is `apps/web` and Install Command is `cd ../.. && npm install --cache /tmp/npm-cache`.

**Login returns 400**  
The redirect URI in Okta doesn't match `OKTA_REDIRECT_URI`. Check for trailing slashes or `http` vs `https`.

**Broker returns 502 (hop1/hop2 error)**  
The agent isn't activated in Okta, or the PEM key doesn't match the registered public key. Check Directory → AI Agents → BenefitsAgentV2 → Credentials tab (key must be Active).

**`user_not_found` on every tool call**  
The signed-in user's email doesn't match one of the 10 seeded employees (`@acmecorp.example`). Sign in as one of the personas listed on the home page.

**Audit log is empty after redeploy**  
Expected — in-memory audit log resets on each deploy. Run a few queries to repopulate it.
