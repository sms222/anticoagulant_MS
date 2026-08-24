# Anticoagulation Management System (AMS)

## Status: scaffold only

What's real and working:
- `supabase/schema.sql` — full DB schema (patients, encounters, labs, dosing
  schedule, clinical events, ABC-taxonomy adherence, extensible scoring-tool
  tables, contact log, audit log) with RLS policies.
- `lib/calculators/` — actual algorithms, not mocks: Rosendaal TTR, PINRR,
  INR variability (SD/CV), extreme-value rate, Cockcroft-Gault CrCl,
  clinic-wide metrics aggregator.
- Minimal Next.js app shell that builds and runs.

What's NOT built yet:
- View A/B/C dashboards (Center Dashboard, Patient Dashboard, Encounter/Lab
  Input) — only a placeholder home page exists.
- Auth wiring (Supabase Auth + `profiles` table exists in schema, not
  connected to any UI).
- AI Scribe and Vision OCR routes — deliberately not scaffolded yet.

## Before touching the AI pipeline

`AI_PIPELINE_ENABLED=false` in `.env.example` on purpose. Sending patient
audio and lab screenshots to a third-party API (Groq) needs hospital IT /
ethics committee sign-off first — confirm that before wiring up
`groq-sdk` calls, regardless of what's in `package.json`.

Also: verify the exact Groq model IDs in the Groq console before use — their
model lineup (especially vision models) changes on short notice and older
model names get deprecated.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in Supabase keys
# Run supabase/schema.sql against your Supabase project (SQL editor or CLI)
npm run dev
```

## Scoring tool horizons

`supabase/schema.sql` seeds HAS-BLED, ATRIA, HEMORR2HAGES, ORBIT, ABH,
RE-LY, A4C with a placeholder 365-day prediction horizon for all of them.
These need to be corrected per-tool from each tool's original validation
paper before any AUROC validation work is trusted.
