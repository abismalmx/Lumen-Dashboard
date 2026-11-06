# Lumen · Operations dashboard

A working MVP of an operations dashboard for a usage-based SaaS: revenue, customers and usage in one product, with real sign-in, a real Postgres schema and customers you can create, edit and delete.

**Live demo → https://abismalmx.github.io/Lumen-Dashboard/**

[![CI](https://github.com/abismalmx/Lumen-Dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/abismalmx/Lumen-Dashboard/actions/workflows/ci.yml)

The demo is the running app, not a recording of it. Every claim below is backed by code in this repository.

> The dashboard figures come from one deterministic sample ledger, so the KPIs, the chart, the plan mix and the tables always agree. The **customers** are real records: they can be created, edited and deleted, and they persist.

## What this demonstrates

| What a client needs to trust | What this repository proves |
|---|---|
| **A UI that holds up on every screen.** | Responsive and accessible interface, audited at 390, 820, 1024 and 1440 px: no horizontal scroll, touch targets of at least 32 px, no console errors. ARIA roles and labels on the chart, meters, filters and dialogs; ⌘K / Ctrl+K command palette, Escape to close, focus returns to the trigger. |
| **Real users, not a fake login screen.** | Email + password sign-in and sign-up through Supabase Auth (`src/lib/session.tsx`), plus a no-account "Explore the demo" path (`src/AuthScreen.tsx`). The session survives a reload and signing out works. |
| **A database where one account cannot read another account's rows.** | Postgres table owned by `auth.uid()` with Row Level Security: four policies (select, insert, update, delete) restrict every read and write to the signed-in user's own rows, and `anon` gets no privileges at all (`supabase/schema.sql`). |
| **Create / edit / delete that behaves when the save fails.** | One `CustomerRepo` interface (`src/lib/repo.ts`) with a local and a Postgres implementation behind it. Writes are optimistic: the screen updates first, and if the save fails the previous state is restored and a message is shown. |
| **Quality you can check yourself.** | 69 unit tests (Vitest) over the ledger invariants, chart path maths, formatters, the customer model and both repositories. CI runs typecheck, tests and the production build on every push and pull request. |
| **Delivery that ships without hand-holding.** | A push to `main` runs the tests and the production build and publishes the site to GitHub Pages (`.github/workflows/deploy.yml`). The live demo URL is the output of that pipeline. |
| **Code that survives the next feature.** | The screens only talk to the `CustomerRepo` interface, and the Supabase SDK is downloaded on demand, only when a backend is configured — a new backend is a new implementation, not a rewrite of the interface. |

## Try it in 60 seconds

1. **Open the demo:** <https://abismalmx.github.io/Lumen-Dashboard/>
2. **Get inside.** With no configuration the app opens straight into the dashboard — nothing to sign up for. If the deployed build was given a Supabase project, you get a sign-in screen instead: use **Explore the demo** for instant access, or **Create account** with an email and password.
3. **Prove it is real.** Go to **Customers** → **Add customer** → give it a name, an email and a plan → **Create customer**. Open the record, change its **Status**, then **Delete** it. Now reload the page: your record is still there — kept in your browser in demo mode, stored in your own Postgres rows in cloud mode.

Extra things to click: ⌘K / Ctrl+K opens the command palette, the charges table exports as CSV, and the views have deep links (`#/customers`, `#/usage`).

## Two modes

| | Demo (default) | Cloud (Supabase) |
|---|---|---|
| Sign-in | None, opens straight into the app | Email + password, or "Explore the demo" |
| Customers stored in | This browser (`localStorage`) | Postgres, one workspace per account |
| Isolation | Per browser | Row Level Security: a user can only read and write their own rows |
| Needs configuration | No | `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` |

The UI talks to a single `CustomerRepo` interface (`src/lib/repo.ts`), so both modes share all screen code. The Supabase SDK is loaded on demand and is not downloaded in demo mode.

**About the public demo:** the published build ships without a Supabase project, so it runs on local sample data in your browser. Cloud mode switches on the moment the build receives `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see [Deploy](#deploy)) — the interface does not change when it does.

## What's inside

- **Overview**: full-width revenue chart with the MRR figure as the centrepiece, a compact metric strip with trends, plan distribution and a filterable transactions table.
- **Customers**: search, status filters with live counts, sortable columns, usage meters and a detail panel with invoices (keyboard accessible, focus returns on close).
- **Usage**: requests heatmap by hour and weekday, per-model share, latency and price.
- **Command palette** (⌘K / Ctrl+K), CSV export, deep links (`#/customers`, `#/usage`) and a mobile bottom navigation.

## Backend

Schema and policies live in [`supabase/schema.sql`](supabase/schema.sql): `customers` table owned by `auth.uid()`, check constraints on plan, status and lengths, a unique `(owner_id, email)` index, and four RLS policies (select, insert, update, delete).

1. Create a project at supabase.com and run `supabase/schema.sql` in the SQL editor.
2. Copy `.env.example` to `.env` and fill in the project URL and anon key.
3. `npm run dev`. To enable it on the published site, set the same two names as repository **variables** (Settings → Secrets and variables → Actions → Variables).

The first sign-in seeds the account with the sample customers once (idempotent, safe under concurrent loads). Writes are optimistic and roll back with a message if the save fails.

## Design notes

- Warm near-black ground, amber accent, Instrument Serif for titles and hero figures, Geist for the interface, Geist Mono with tabular numerals for data. Fonts are self-hosted.
- Smooth monotone curves (no overshoot below the axis), depth through translucent borders and inner light, one entrance moment, `prefers-reduced-motion` respected.
- Audited at 390, 820, 1024 and 1440 px: no horizontal scroll, touch targets of at least 32 px, no console errors.

## Stack

React 18 · TypeScript · Tailwind CSS · Vite · lucide-react

Plus Vitest for the unit tests, Supabase (optional auth + Postgres backend) and GitHub Actions for CI and deploys.

## Run locally

```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm test         # unit tests (vitest)
npm run typecheck
npm run build    # production build in dist/
```

## Quality

- **Tests:** 69 unit tests across 5 files, covering the ledger invariants (MRR reconciles with new, churned and overage revenue), chart path maths, formatters, the customer model, the local repository and the Supabase repository (against a fake client). CI runs typecheck, tests and build on every push and pull request.
- **Browser checks:** the demo flow (add, persist across reload, change status, delete, restore) and the cloud flow were exercised in a real browser. The cloud flow ran against a hosted Supabase project: rejected credentials, sign-up, a seeded workspace of exactly 12 customers per account, create / update / delete persisting across reloads, sign-out, and isolation between two accounts (each sees only its own rows; confirmed in the database). Anonymous requests to the REST endpoint return 401.

## Deploy

Every push to `main` publishes the site — that is where the live demo comes from:

1. `.github/workflows/deploy.yml` runs `npm ci`, `npm test` and `npm run build`, then uploads the build as a Pages artifact.
2. `actions/deploy-pages` publishes it to GitHub Pages at `https://abismalmx.github.io/Lumen-Dashboard/`. The workflow can also be triggered manually.
3. The build uses relative asset paths (`base: "./"` in `vite.config.ts`) and hash URLs (`#/customers`, `#/usage`), so it works from a project sub-path without server rewrites.

To publish the cloud mode, add the two variables as repository **variables** (Settings → Secrets and variables → Actions → Variables): `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Leave them unset to publish the demo-only build. The anon key is public by design; Row Level Security is what protects the data.

CI (`.github/workflows/ci.yml`) runs separately on every push and pull request: typecheck, tests and build.

## Work with me

**Anthony Rios Licea** — Full-Stack Engineer · Fast MVPs & Web Apps

- GitHub: https://github.com/abismalmx
- Contra: [Anthony Rios Licea on Contra](https://contra.com/anthony_rios_licea_v3060dfy)

**About this project, honestly:** Lumen is a concept project I built on my own with sample data. It is not client work, the customers and the revenue figures are synthetic, and nothing in the dashboard should be read as a business result. What it does show is how I work: real authentication, a real database schema with row-level security, optimistic writes with rollback, a test suite that runs in CI, and a deploy pipeline that publishes the demo by itself.

If you need an MVP of this shape — admin panel, customer portal, internal tool, dashboard — send me the requirement and I will tell you what I can build, and what I would cut to fit it.
