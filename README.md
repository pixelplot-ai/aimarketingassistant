# AI Social Media Assistant

Production-ready AI-powered social media management app for a shared workspace team. Multiple admins can sign in and manage the same posts, brand, settings, and social connections. Create posts, generate AI content and images, connect social accounts, schedule publications, and publish automatically.

## Tech Stack

- **Next.js 15+** (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Supabase** — Auth, PostgreSQL, Storage, Cron (pg_cron + pg_net)
- **OpenAI** — Text generation (captions, rewrite, hashtags, etc.)
- **Google Gemini** — Image generation
- **Meta Graph API** — Facebook & Instagram publishing

## Prerequisites

- Node.js 20+
- Supabase project ([`zbrltkrcwfktrglkxaha`](https://supabase.com/dashboard/project/zbrltkrcwfktrglkxaha))
- OpenAI API key
- Google Gemini API key
- (Optional) Meta Developer App for live Facebook/Instagram publishing

## Quick Start

```bash
cd web
cp .env.example .env.local
# Fill in Supabase URL, anon key, service role key, ADMIN_EMAILS, API keys
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

See [`.env.example`](.env.example). Required for local dev:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (cron, image upload, publishing) |
| `ADMIN_EMAILS` | Comma-separated emails allowed to sign in (e.g. `you@co.com,partner@co.com`) |
| `ADMIN_EMAIL` | Optional fallback if `ADMIN_EMAILS` is unset (single admin) |
| `WORKSPACE_OWNER_USER_ID` | Optional. Pin workspace owner UUID when migrating existing data (copy from Supabase Auth → Users → UID) |
| `OPENAI_API_KEY` | OpenAI text generation |
| `GEMINI_API_KEY` | Gemini image generation |
| `CRON_SECRET` | Secures `/api/cron/publish` |
| `TOKEN_ENCRYPTION_KEY` | Encrypts social OAuth tokens at rest |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` in dev |

### Shared workspace

All allowlisted admins share one dataset (posts, brand, settings, Facebook connection, storage). Social and AI keys remain project-level env vars.

**Existing project with data:** set `WORKSPACE_OWNER_USER_ID` to the Supabase UID of the user who already owns your posts/brand/connections **before** other admins sign in.

**Fresh install:** set only `ADMIN_EMAILS`. The first allowlisted admin to log in becomes the workspace owner automatically.

**Add an admin:** create the user in Supabase Auth, add their email to `ADMIN_EMAILS`, redeploy.

**Remove an admin:** remove their email from `ADMIN_EMAILS`, redeploy, optionally disable/delete their Auth user.

Meta (optional — dev stub works without):

| Variable | Description |
|----------|-------------|
| `FACEBOOK_APP_ID` / `META_APP_ID` | Meta app ID |
| `FACEBOOK_APP_SECRET` / `META_APP_SECRET` | Meta app secret |

## Supabase Setup

### Auth

1. **Authentication → Providers → Google** — Enable and add Google Cloud OAuth credentials
2. **Authentication → URL Configuration**
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`
3. Disable public signups (admin allowlist only)
4. Create admin users manually OR sign in with Google using an email from `ADMIN_EMAILS`

Google Cloud redirect URI:

```
https://zbrltkrcwfktrglkxaha.supabase.co/auth/v1/callback
```

### Database

Migrations are applied via Supabase MCP. Schema includes: `profiles`, `settings`, `brand_profiles`, `posts`, `platforms`, `platform_connections`, `scheduled_jobs`, `publication_logs`, `ai_generations`, `workspace_settings`, `workspace_members`.

### Storage Buckets

`logos`, `images`, `videos`, `generated-images`, `brand-assets` — workspace-scoped paths: `{bucket}/{workspaceOwnerUserId}/filename` (all admins share the owner prefix).

### Cron (Scheduled Publishing)

Enable `pg_cron` and `pg_net`, then schedule (replace values):

```sql
SELECT cron.schedule(
  'publish-scheduled-posts',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_VERCEL_DOMAIN/api/cron/publish',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_CRON_SECRET',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Mirror `CRON_SECRET` in Vercel env vars.

## Project Structure

```
app/                  # Routes (login, dashboard, posts, settings, API)
components/           # UI + layout + shared
features/             # Feature modules (auth, brand, posts, integrations…)
services/             # AI, storage, scheduler, Supabase clients
lib/                  # Validations, auth helpers, errors
types/                # Database + app types
```

## Features

- **Dashboard** — Post stats, recent activity, upcoming schedule
- **Brand Profile** — Required before AI; drives all prompt generation
- **Posts** — CRUD, AI text tools, media upload/generation, scheduling
- **Settings** — Brand, AI prefs, app settings, social connections
- **Integrations** — Plugin architecture; Facebook & Instagram enabled
- **Scheduler** — Auto-publish via Supabase Cron → Vercel API route

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```

## E2E Test Checklist

- [ ] Sign in with Google (an `ADMIN_EMAILS` account)
- [ ] Unauthorized email rejected at `/auth/callback` and on protected routes
- [ ] Second admin sees same posts, brand, settings, and Facebook connection
- [ ] Email/password fallback login works
- [ ] Configure Brand Profile → `is_complete` becomes true
- [ ] AI text actions blocked until brand complete
- [ ] Create draft post, edit, duplicate, delete
- [ ] Upload image / generate AI image on edit page
- [ ] Connect Facebook/Instagram (Settings → Social Connections)
- [ ] Schedule post for future → status `scheduled`
- [ ] Publish Now → status `published` (or `failed` with log)
- [ ] Cron endpoint rejects without `CRON_SECRET`
- [ ] Cron endpoint publishes due posts
- [ ] Dark/light theme toggle works

## Deployment (Vercel)

1. Push repo and import in Vercel (root directory: `web`)
2. Add all env vars from `.env.example`
3. Set Supabase redirect URLs to production domain
4. Configure pg_cron with production URL + `CRON_SECRET`

## License

Private — shared-workspace internal tool.
