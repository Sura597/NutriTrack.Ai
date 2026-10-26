# NutriTrack AI

An AI-assisted daily calorie and nutrition tracker for Indian users. Log meals by photo, text or voice, confirm what the app understood, and see calories, macros, trends and low-cost food ideas in ₹.

The product name is configurable (`NEXT_PUBLIC_APP_NAME`).

> **Estimates, not medical advice.** Calorie and nutrient values are estimates. The app is not a medical device and does not diagnose, treat or give clinical dietary advice. Targets are withheld for under-18s who choose weight loss and for users who flag pregnancy/breastfeeding, a medical condition or an eating-disorder history; those users are asked to speak to a clinician or dietitian.

## What's in the box

| Area | Details |
|---|---|
| Auth | Email + password, email one-time code / magic link, phone SMS OTP (needs an SMS provider), password reset, sign out, account deletion |
| Onboarding & profile | Age, height, weight, activity, goal, diet, allergies, budget; BMI and Mifflin-St Jeor targets with safety rails; editable custom targets |
| Dashboard | Calorie ring, protein/carbs/fat, micronutrients where data exists, four meal sections, date navigation, **+ Log Food** |
| Logging | Photo, text or voice; always reviewed and editable before saving; search and manual entry |
| Nutrition data | Database-first (85 Indian foods seeded, with aliases and household units); AI only for what the table can't resolve; AI output is schema-validated and treated as untrusted |
| Eat Healthy on a Budget | `/foods`: protein-per-rupee ranking, diet and allergen filtering, filter chips, adjustable local price percentage |
| Insights | `/insights`: today / 7 days / 30 days, trend charts with target lines, top foods, calories by meal, weight tracking |
| Security | RLS on every user table, private storage bucket, server-only secrets, per-user AI quota, Zod validation on every route |

Stack: Next.js (App Router) · TypeScript · Tailwind CSS · Lucide · Recharts · Zod · Supabase (Postgres, Auth, Storage) · Vitest · Playwright.

## Quick start (local)

Requirements: Node 20.9+ (22 recommended), npm, a free Supabase project.

```bash
git clone <your-repo-url> nutritrack-ai && cd nutritrack-ai
npm install
cp .env.example .env.local      # then fill in values (see below)
npm run dev                     # http://localhost:3000
```

Without Supabase variables the app starts and shows a **/setup** page; `/api/*` returns a JSON 503 explaining what's missing.

## 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings → API**: copy the Project URL, the `anon`/publishable key, and the `service_role` key into `.env.local`. The service-role key is server-only (used for account deletion and storage cleanup). Never prefix it with `NEXT_PUBLIC_` and never commit it.
3. **Apply the migrations**, in order, from `supabase/migrations/` (0001 → 0007):
   - Easiest: open **SQL Editor** and run each file in order; or
   - With the CLI: `npx supabase login && npx supabase link --project-ref <ref> && npx supabase db push`.
4. **Authentication → Providers → Email**: enabled by default. Decide whether to require email confirmation (recommended on).
5. **Authentication → URL Configuration**: set **Site URL** to your app URL and add redirect URLs:
   - `http://localhost:3000/**`
   - `https://<your-vercel-domain>/**`
6. **Email OTP / magic link**: the default email templates send a link. To send a 6-digit code as well, add `{{ .Token }}` to the *Magic Link* and *Confirm signup* templates. Supabase's built-in email sender is heavily rate-limited; configure custom SMTP (Resend, SES, Postmark…) before real users.
7. **Phone OTP (optional)**: **Authentication → Providers → Phone** requires a paid SMS provider (e.g. Twilio, MessageBird, Vonage) and, for India, DLT registration of your sender ID/templates. The phone tabs are in the UI but won't work until this is configured. Email auth works without it.
8. **Storage**: migration 0003 creates the private `food-images` bucket with per-user folder policies. Nothing else to do.

## 2. Configure AI (optional but recommended)

Text/voice logging works without AI for foods in the table (rotis, dal, rice, idli…). AI covers unrecognised foods and is **required** for photo analysis.

```env
AI_PROVIDER=anthropic          # or: openai (any OpenAI-compatible endpoint via AI_BASE_URL)
AI_API_KEY=...
AI_MODEL=...                   # must be vision-capable for photos
AI_DAILY_LIMIT_PER_USER=30     # rolling 24h cap per user
```

The adapter lives in `src/lib/ai/provider.ts` behind an `AIProvider` interface; add a provider by implementing it. API keys are read only on the server. Output is validated with Zod and sanity-checked, and the meal total is always recomputed by the server.

`AI_PROVIDER=mock` exists for local development and tests only. It is refused in production builds and its output is labelled as demo data in the UI.

AI usage costs money and is billed by your AI provider. The per-user quota and 5 MB upload limit exist to bound it.

## 3. Environment variables

See `.env.example`. Summary:

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | Public by design; RLS protects data |
| `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_URL` | browser + server | Branding / absolute URLs |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Account deletion, storage cleanup |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`, `AI_TIMEOUT_MS`, `AI_DAILY_LIMIT_PER_USER` | **server only** | See above |
| `FOOD_IMAGE_BUCKET`, `MAX_UPLOAD_MB` | server | Defaults `food-images`, `5` |

## 4. Scripts

```bash
npm run dev          # development server
npm run build        # production build
npm start            # serve the production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # unit + integration tests (Vitest)
npm run test:e2e     # Playwright (see Testing)
node scripts/seed/generate.mjs   # regenerate seed migrations 0004/0005 from scripts/seed/foods.mjs
```

## 5. Testing

- **Unit and integration (`npm test`)**: no Supabase project needed. Integration tests run the real SQL migrations, RLS policies and RPCs in an in-memory Postgres (PGlite) with small stand-ins for Supabase's `auth`/`storage` schemas. API route tests run real route handlers against a stubbed Supabase client: 401 on every route, Zod validation, upload limits and magic-byte checks.
- **End-to-end (`npm run test:e2e`)**: Playwright.
  - `smoke.spec.ts` needs nothing: signed-out redirects, JSON 401/503, public legal pages.
  - `core-flow.spec.ts` (sign in → onboarding → text log → edit → delete → insights/foods → sign out) **needs a real, confirmed test account** and is skipped unless you set `E2E_EMAIL` and `E2E_PASSWORD`. Use a throwaway account on a dev project.
  - If Playwright's own browser isn't installed: `npx playwright install chromium`, or set `E2E_CHROMIUM_PATH` to an existing Chromium binary.

Limits of the automated tests: they don't exercise real Supabase Auth (email delivery, SMS), real AI providers, or the browser UI against a live database. Do the smoke-test checklist below on every new environment.

## 6. Deploy

### GitHub

```bash
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

`.env*` files are git-ignored (only `.env.example` is tracked).

### Vercel

1. **Add New → Project**, import the GitHub repo (framework: Next.js, defaults are fine).
2. **Settings → Environment Variables**: add every variable from the table above for *Production* (and *Preview* if you want preview deployments to work). Server-only keys must not have the `NEXT_PUBLIC_` prefix.
3. Set `NEXT_PUBLIC_APP_URL` to your production URL, then add that URL to Supabase's redirect URLs (step 1.5).
4. Deploy. Later changes: push to `main` and Vercel redeploys. Changing an env var requires a redeploy.
5. **Database changes** are *not* deployed by Vercel. Apply new files in `supabase/migrations/` yourself (SQL Editor or `supabase db push`) before or with the code that needs them.

Scaling notes: Vercel Hobby limits function duration; photo analysis sets `maxDuration = 60`, which may need a paid plan. The in-DB AI quota works across serverless instances.

## 7. Smoke-test checklist (run after every deploy)

- [ ] `/` loads; `/dashboard` redirects to sign-in when signed out
- [ ] Sign up with email, confirm via the email, land in onboarding
- [ ] Finish onboarding; dashboard shows targets (or the "no targets" notice for flagged profiles)
- [ ] **+ Log Food → Text**: "2 roti and 1 bowl dal" → review → save → appears under the right meal; ring and macros update
- [ ] Edit the meal (change quantity) and delete it
- [ ] With AI configured: text with an unlisted food, and a photo; both show "estimated by AI" and need confirmation
- [ ] `/foods` filters change the list; changing the price % saves and re-prices
- [ ] `/insights` shows ranges, charts and the table view; add and delete a weight entry
- [ ] Sign out and sign back in; reload keeps the session
- [ ] A second account cannot see the first account's meals (by URL or API)
- [ ] Delete account removes data and signs out

## 8. Data, privacy and maintenance

- **Photos** are stored in a private bucket under `<user_id>/…`, served via short-lived signed URLs, and can be turned off in the profile (then the photo is analysed and discarded). Deleting a meal deletes its photo. Deleting the account removes the user's photos and rows.
- **Orphaned photos** (e.g. an upload whose meal was never saved) are removed when analysis fails or the user discards the review, but a closed browser tab can leave one behind. To list candidates older than a day that no meal references, run in the SQL Editor:

  ```sql
  select o.name, o.created_at
  from storage.objects o
  where o.bucket_id = 'food-images'
    and o.created_at < now() - interval '1 day'
    and not exists (select 1 from public.food_logs l where l.image_path = o.name);
  ```

  Review the list, then delete via the Storage UI or the Storage API (Supabase blocks direct `delete from storage.objects`).
- **Sensitive flags** (pregnancy, medical condition, eating-disorder history) are used only to withhold prescriptive targets and are never sent to AI providers.
- **Prices** in `food_price_estimates` are rough, non-live estimates seeded for 61 foods in a `default` region. Add rows for other regions and set `profiles.region`; users can nudge prices with a personal percentage. Update them periodically; they are not market data.
- The food table is a curated starter set (85 items), not a full national database. Values are typical per-serving figures; see `scripts/seed/foods.mjs` for sources and edit it to improve accuracy.

## 9. Project layout

```
src/app/            routes (pages + /api route handlers)
src/components/     UI (ui/, auth/, dashboard/, log-food/, foods/, insights/, profile/)
src/lib/            nutrition math, AI adapter, analysis pipeline, data access, validation
supabase/migrations SQL: schema, RLS, storage, seeds, RPCs, insight functions
scripts/seed        generators for the seed migrations
tests/              unit, integration (PGlite), e2e (Playwright)
```

## 10. Known limitations

- Phone OTP requires a paid SMS provider and DLT setup; untested here.
- Voice input uses the browser's Web Speech API (Chrome/Edge/Safari support varies; Firefox does not). The transcript is editable and goes through the same text pipeline.
- Calorie estimates from photos are inherently rough; portions are the biggest source of error.
- The app has a light theme only.
- Micronutrient totals cover only foods that carry that data and are shown with that caveat.
