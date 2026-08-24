# ACMS — Anticoagulation Management System
## Handover document — 24 August 2026 (updated 25 August 2026 — see §11)

For: UKM / Hospital Canselor Tuanku Muhriz anticoagulation clinic pharmacy team
Owner: Shamin Mohd Saffian

---

## 1. What this is

A clinic management system for ~300–400 warfarin/NOAC patients, replacing the earlier
Flask/Streamlit/SQLite prototype. Tracks patients, visits, labs, dosing history, bleeding
risk scores, and today's appointment queue.

**Live URL:** `https://acms-hctm.vercel.app`
**GitHub:** https://github.com/sms222/anticoagulant_MS
**Login:** `/login` (self-service signup at `/signup`)

---

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend/backend | Next.js 15 (App Router) | Server components fetch data directly, no separate API layer needed yet |
| Database | Supabase (Postgres) | Row-level security, real concurrent multi-user access — SQLite couldn't do this |
| Hosting | Vercel | Auto-deploys on push to `main` on GitHub |
| Auth | Supabase Auth (email/password) | Self-service signup, session cookies via middleware |
| AI (Groq — Whisper + vision OCR) | **Not connected** | See §6 |

Supabase project ID: `krleqdlvsqoxhdfbbhhi` (org "Shamin", region ap-southeast-1/Singapore)

---

## 3. What's actually working right now

- Login / signup (`/login`, `/signup`) — new signups auto-get a `profiles` row via a DB
  trigger, which is what the RLS policies check against.
- Home page (`/`) — today's appointment queue (time, room, status) + full active patient
  list. Click any row to open that patient's chart.
- Add patient (`/patients/new`) — real form, writes to Supabase, redirects to the new
  patient's chart.
- Patient chart (`/patients/[id]`) — matches the agreed mockup:
  - Sidebar: risk class, phone, age/weight/height, diagnosis, target INR range,
    anticoagulant, start date
  - Top tabs: **all seven are now functional** — Dosing, Labs, Contacts, Drugs, Events,
    Reminders, Documents. See §11 for what each does and what's still deliberately
    deferred (real file upload for Documents).
  - Dosing sub-tabs: **Metrics** (real computed numbers, not mockup placeholders),
    **Graph** (INR/HAS-BLED/CrCl trend, plain SVG sparklines — see §7), **History**
    (visit table with a real in-range color bar per visit), **Notes** (full consultation
    notes per visit).
  - **Metrics panel branches on `anticoagulant_type`**: warfarin patients get
    TTR/PINRR/CV-INR/SD-INR/HAS-BLED; NOAC patients get creatinine/HAS-BLED instead —
    INR-quality metrics don't apply to a drug with no routine level monitoring.
  - Back to list / Print work. **Save is intentionally disabled** — no edit-and-persist
    flow exists yet, so the button says so rather than silently doing nothing.
- Two fictional demo patients seeded: Siti Nur Aisyah binti Rahman (warfarin) and Tan Wei
  Ming (apixaban), each with encounters, labs, and HAS-BLED history.

---

## 4. Database schema

Full schema: `supabase/schema.sql` in the repo. Tables: `patients`, `encounters`,
`lab_results`, `dosing_schedules`, `clinical_events`, `adherence_assessments` (ABC
taxonomy), `scoring_tool_definitions` + `scoring_tool_results` (generic, extensible —
new bleeding/stroke scores don't need a migration), `contact_log`, `audit_log`,
`appointments`, `profiles`.

Added after the initial schema (not yet reflected in `schema.sql` — see §8):
`encounters.room`, `encounters.visit_start_time/end_time`; `patients.phone`,
`patients.address`, `patients.risk_class`; the `appointments` table entirely.

RLS is on for every clinical table — any authenticated row in `profiles` gets full
read/write. Not yet scoped per-pharmacist; that's a future refinement, not urgent for a
5-person team.

---

## 5. Known real gaps (not hidden, tracked here on purpose)

1. ~~`schema.sql` in the repo is stale.~~ **Fixed 25 Aug 2026** — `schema.sql` now
   matches the live database, including the four new tables from §11.
2. **Appointment creation has no UI.** The queue on the home page only shows rows already
   in `appointments` — right now that's two rows I inserted by hand as demo data. No
   scheduling or check-in workflow exists.
3. ~~Contacts / Drugs / Events / Reminders / Documents tabs are empty shells.~~ **Fixed 25
   Aug 2026** — all five are wired up. See §11.
4. **Groq AI pipeline (audio scribe + lab screenshot OCR) is not built.** Blocked on
   hospital IT / ethics committee sign-off for sending patient audio and lab images to a
   third-party US API — this was flagged early and intentionally not built around.
5. **Graphs are plain SVG, not Chart.js**, despite `recharts`/chart libraries being in
   `package.json`. Functional but visually plainer than the original mockups — a
   deliberate shortcut to avoid an SSR/hydration debugging detour, not a limitation of
   the stack.
6. **No production/demo separation.** The "demo" data (Siti Nur Aisyah, Tan Wei Ming) and
   any real future patient data live in the same Supabase project and Vercel deployment.
   Fine for now since everything in it is fictional; will need a second Supabase + Vercel
   project before this handles real patients.
7. **RLS treats every logged-in pharmacist identically** — no per-user restriction, no
   admin-vs-pharmacist distinction beyond the `role` column existing unused.
8. **Vercel project renamed to "acms"** but the old URL
   `anticoagulation-management-system.vercel.app` still resolves (Vercel keeps it as an
   alias). Remove it under Settings → Domains if you want it gone.

---

## 6. Data governance — read this before connecting Groq

The original spec (from a Gemini-drafted plan) called for sending patient audio
consultations and lab screenshots to Groq's API for transcription and OCR. **This has
not been cleared with hospital IT or an ethics committee.** All AI-related fields in the
schema (`encounters.audio_transcript`, `ai_soap_note`, `lab_results.source =
'ems_screenshot_ai'`) exist and are nullable/optional by design, so nothing depends on
this pipeline being connected. Do not wire up `groq-sdk` calls with real patient data
until that approval exists.

If/when it's cleared: Groq's model lineup changes frequently — verify current model IDs
in the Groq console rather than trusting anything written earlier in this project's
history (`llama-3.3-70b-versatile` and `llama-3.2-11b-vision-preview`, named in the
original spec, were already deprecated by the time this was built).

---

## 7. Environment variables

| Variable | Where it lives | Sensitivity |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel env vars | Public, fine to expose |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel env vars | Public by design — RLS is what protects data, not secrecy of this key |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env vars, marked Sensitive | **Secret** — bypasses RLS entirely. Get from Supabase dashboard → Project Settings → API. Never commit this or paste it into chat. |
| `GROQ_API_KEY` | Not set | Leave unset until §6 is resolved |
| `AI_PIPELINE_ENABLED` | `.env.example`, defaults `false` | Leave false until §6 is resolved |

All data reads currently go through the service-role client (`lib/supabase/server.ts`)
in trusted server-only code — this is standard practice for server components, not a
shortcut, but it does mean the app doesn't yet distinguish *which* pharmacist is doing
what at the database level (see gap 7 above).

---

## 8. Immediate next steps, in order

1. ~~Pull the live schema from Supabase and reconcile it into `supabase/schema.sql`.~~ Done.
2. Build appointment creation / check-in UI — the queue is currently read-only.
3. ~~Decide what Contacts/Drugs/Reminders/Documents actually need to store.~~ Done — see §11.
4. ~~Wire the `Events` tab to the existing `clinical_events` table.~~ Done.
5. Build the actual edit/save flow for encounters (the disabled Save button) — still
   disabled; nothing in §11 touches this.
6. Revisit Chart.js/Recharts for the Graph tab once there's time to debug SSR hydration
   properly.
7. **New from this session:** get real patient documents into `patient_documents`, or
   decide the link-list approach (§11.5) is good enough long-term.
8. **New from this session:** now that `medications` data exists, consider a drug-
   interaction flag (e.g. warfarin + NSAID/antibiotic) on the Metrics panel.

---

## 11. This session — 25 August 2026: all five placeholder tabs wired up

Every tab in the patient chart is now functional. RLS follows the same pattern as every
other clinical table (`staff_full_access`: any authenticated row in `profiles` gets full
read/write) — no new security model introduced.

**11.1 Contacts** — Single free-text column, `patients.emergency_contact_info`. Opens
pre-filled with a next-of-kin / phone / email template (`EMERGENCY_CONTACT_TEMPLATE` in
`lib/types.ts`) on first use, editable and saved as plain text.

**11.2 Drugs** — New `medications` table: drug name, dose, frequency, route,
indication, start/stop date, active flag. Add form + discontinue (sets `active=false`,
stamps `stop_date`) + delete.

**11.3 Events** — Wired the existing `clinical_events` table (was already in the
schema, unused) to the tab: add/list/delete bleeding (ISTH severity), clotting,
hospitalization, or other events.

**11.4 Reminders** — New `reminders` table: freeform task + optional due date +
completed flag. Overdue open items are flagged in red. No notifications — a checklist,
not an alerting system.

**11.5 Documents** — New `patient_documents` table: **link/metadata list, not file
storage.** Stores a label + URL to where the document already lives (hospital EMR,
shared drive), not the file itself. Real upload needs a Supabase Storage bucket and,
per §6, the same governance sign-off already blocking the Groq pipeline — not something
to build ahead of that approval. Flagged to and agreed with the requester as this
session's scope.

**11.6 Not touched this session** — the disabled `Save` button on encounters/dosing
(gap 5, §8), appointment creation UI (gap 2, §8), and the plain-SVG Graph tab (gap 5,
§5).

**11.7 Delivery note** — Built and applied directly against the live Supabase project
(`krleqdlvsqoxhdfbbhhi`) via migration. Code changes were packaged as a zip for manual
review and push to `main` — no GitHub write access was available in this session, so
nothing was pushed automatically. Diff the zip against the repo before pushing.

## 9. Who to ask

Everything above was built collaboratively with Claude across sessions on 24–25 August
2026 — full reasoning and back-and-forth is in that conversation history if context on
*why* a decision was made is needed later.
