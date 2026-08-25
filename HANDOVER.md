# ACMS — Anticoagulation Management System
## Handover document — 24 August 2026 (updated 25 August 2026 — see §11, §12, §13)

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

---

## 12. Second session — 25 August 2026: intake form fixes + theme + home page

Follow-up round after the requester reviewed the intake form and flagged several things.
Applied directly against the live Supabase project again.

**12.1 Indication** — "Other" now reveals a free-text box (`patients.indication_detail`,
was already a column, just not wired into the form). Dropdown labels show abbreviations
in caps: "AF – Nonvalvular", "VTE – DVT", etc. (`INDICATION_OPTIONS` /
`formatIndication()` in `lib/types.ts`).

**12.2 Target INR** — Intake now asks for a single value instead of low/high. Range is
auto-derived as **±0.5** (e.g. 2.5 → 2.0–3.0 — the requester's choice over a tighter
±0.25 or no auto-range). New `target_inr_history` table records every change with an
effective date; `patients.target_inr_low/high` always holds the current range for quick
reads. `calculateRosendaalTTR`/`calculatePINRR` in `lib/calculators/rosendaal.ts` were
changed to take a list of time-bound ranges instead of one fixed range, so TTR is
computed against whichever target was actually in force on each day — a change made at
a later visit doesn't get retroactively applied to earlier days. Existing patients were
backfilled with one history row each (dated to intake) so nothing broke.

A control to update the target INR ("Update at this visit") lives in Dosing → Metrics,
below the metric cards, with the change history listed underneath.

**12.3 Risk class** — Removed from the intake form. The column and sidebar chip still
exist; there's now an edit path via the sidebar (§13.1).

**12.4 Notes** — Added a free-text field to intake, writing to `patients.notes` (column
already existed, wasn't in the form).

**12.5 Theme** — Accent color changed from blue to a "blood red" (`--text-accent`,
`--border-accent`, `--fill-accent` in `app/globals.css`). Kept a separate `--text-info`
/ `--bg-info` (blue-grey) for the "in progress" appointment status specifically, so it
doesn't visually read as urgent/danger next to the new red accent.

The "faded" form controls were a real bug, not a design choice: Tailwind's preflight
strips native input/select/textarea styling, and the intake form never set its own —
so every field had zero visible border in most browsers. Added base styles for
`input`/`select`/`textarea` (border, background, padding, red focus ring) in
`globals.css`, applying everywhere, not just the intake form.

**12.6 Persistent header** — Added a slim header in `app/layout.tsx` on every page:
brand name + "← Back to queue", always visible rather than only at the bottom of the
patient chart.

**12.7 Home page** — Rebuilt with, per the requester's picks:
- **Defaulted patients** — flagged when the latest encounter's `next_appt_date` is in
  the past (new `patient_followup_status` DB view, latest encounter per patient).
- **Upcoming checks due** — same view, `next_appt_date` within the next 7 days. There's
  no separate "lab due" tracking yet, so this uses next appointment as the proxy — flag
  if that's not accurate enough.
- **Patient search** — client-side filter by name/MRN (`components/home/PatientSearch.tsx`),
  since ~300–400 patients is small enough that fetching them all and filtering in the
  browser is simpler than adding server-side search for now.

**12.8 Not done from this round**
- Appointment check-in UI (still gap 2, §8).
- Visual shading of historical target ranges on the INR graph (12.2).

**12.9 Delivery note** — Same as §11.7: applied to the live Supabase project directly,
packaged as a zip, not pushed to GitHub (no write access in this session).

---

## 13. Third session — 25 August 2026: full edit capability + engine-computed HAS-BLED

Requester reviewed a live patient chart and asked for everything editable, Contacts to
lock after save (not always-open), and HAS-BLED to be computed from clinical variables
rather than entered as a raw number, with all quality measures plotted over time.

**13.1 Editable everything except name / MRN / DOB** — those three stay read-only by
design (identity fields, backend-only change). Everything else now has a save path:
- **Sidebar** (`PatientDetailsSidebar`) — Edit button reveals a form for phone, address,
  weight, height, indication (+ free text), anticoagulant type, risk class, start date.
  New action: `updatePatientDetails`.
- **Labs tab** — add/edit/delete individual `lab_results` rows directly (test name,
  value, unit, date). New actions: `addLabResult`, `updateLabResult`, `deleteLabResult`.
- **Dosing → History** — "+ Add visit" creates a new `encounters` row; each existing row
  has an Edit button that expands an inline form (dose, room, next appointment, notes).
  New actions: `addEncounter`, `updateEncounter`.
- The old disabled "Save" button at the bottom of the chart is gone — editing now
  happens at the section it belongs to (this matches the pattern already used for
  Drugs/Events/Reminders), so one global button no longer made sense.

**13.2 Contacts locks after save** — Was always an open textarea. Now: view mode shows
the saved text read-only with an Edit button; Edit mode shows the textarea + Save/Cancel.
Starts in edit mode only if nothing's been saved yet (first use).

**13.3 HAS-BLED computed, not entered** — New `lib/calculators/has-bled.ts`. The
clinician never types a score. Of the 9 HAS-BLED components:
- **Elderly** (age > 65) — derived from date of birth.
- **Labile INR** — derived from this patient's own computed TTR (< 60%).
- **Drugs predisposing to bleeding** — derived by scanning the active medications list
  for antiplatelets/NSAIDs (aspirin, clopidogrel, ibuprofen, etc. — keyword list is in
  the calculator file, easy to extend).
- The other 6 (hypertension, abnormal renal function, abnormal liver function, stroke
  history, bleeding history/predisposition, alcohol excess) aren't derivable from
  structured data in this system, so those are asked for as plain checkboxes — nothing
  else.

New action `addHasBledAssessment` pulls the patient's DOB, active medications, INR
readings, and target INR history server-side, computes the three auto factors, combines
them with the checkbox inputs, and writes score + full component breakdown to
`scoring_tool_results.components` (jsonb — was already in the schema, just unused).
Assessment panel lives in Dosing → Metrics for **both** warfarin and NOAC patients
(bleeding risk isn't warfarin-specific), with history shown underneath.

**13.4 Quality measures plotted over time** — Dosing → Graph now shows, for warfarin
patients: TTR, PINRR, and CV-INR as their own trend lines, each point computed
*cumulatively up to that visit* (not one end-of-course number applied retroactively).
New functions `computeRollingTtr`, `computeRollingPinrr` in `rosendaal.ts` and
`computeRollingVariability` in `inr-variability.ts`. HAS-BLED-over-time was already
plotted from the previous session and now has real data behind it via 13.3.

Still plain SVG sparklines, still the accepted shortcut from gap 5 (§5) — multiple
small multiples stacked vertically rather than one combined multi-axis chart. If a
combined chart with a shared time axis is wanted, that's real charting-library work
(Chart.js/Recharts are in `package.json` unused, per gap 5), not a quick follow-up.

**13.5 Not done from this round**
- No delete for encounters (add/edit only — deleting a visit felt like it wanted a
  confirmation step this round didn't have time for; flag if it's actually needed).
- HAS-BLED drug-interaction keyword list is a reasonable starting set, not a validated
  formulary check — extend `ANTIPLATELET_NSAID_KEYWORDS` in `has-bled.ts` as needed.
- Quality-measure trend lines are separate small charts, not overlaid on one graph with
  the INR line.

**13.6 Delivery note** — Same as before: applied directly to the live Supabase project,
verified with real calculator runs against Siti Nur Aisyah's actual data (not just
typecheck), packaged as a zip, not pushed to GitHub.

## 9. Who to ask

Everything above was built collaboratively with Claude across sessions on 24–25 August
2026 — full reasoning and back-and-forth is in that conversation history if context on
*why* a decision was made is needed later.
