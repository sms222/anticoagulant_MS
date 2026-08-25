# ACMS — Anticoagulation Management System
## Handover document — 24 August 2026 (updated 25 August 2026 — see §11, §12, §13, §14, §15, §16)

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
2. ~~Appointment creation has no UI.~~ **Fixed 25 Aug 2026** — full scheduling +
   check-in workflow built. See §15.
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

---

## 14. Fourth session — 25 August 2026: full edit rollout, Documents dropped, layout widened

**14.1 Drugs / Events / Reminders — edit added.** All three previously only supported
add/delete (plus discontinue for meds, toggle-done for reminders). Each row now has an
Edit button that expands the same field set used for adding, pre-filled. New actions:
`updateMedication`, `updateClinicalEvent`, `updateReminder`.

**14.2 Documents dropped.** Removed the tab, the DB table (`patient_documents`) is left
in place with its data untouched but nothing in the app reads or writes to it anymore —
not dropped outright in case there's something in it already. In its place: a new
top-level **Notes** tab, patient-level free text (`patients.notes` — was already a
column, used at intake, just never surfaced in the chart itself), same lock-after-save
pattern as Contacts. Links get pasted in as plain text; there's still no real file
storage (see §11.2's original reasoning — governance sign-off, not a technical
shortcut). This sits at the top level (own tab), not nested under Dosing, per the
request to "push notes to the upper row."

**14.3 Risk class removed entirely.** Sidebar chip gone, edit form field gone. The
`risk_class` column stays in the DB (harmless, unused) in case it's wanted back later —
nothing was dropped structurally, just unhooked from the UI.

**14.4 Weight/height tracked like INR.** New `biometrics_history` table, same pattern
as `target_inr_history`: `patients.weight_kg`/`height_cm` stay as the current values
(used directly by anything that needs them, e.g. future Cockcroft-Gault work),
`biometrics_history` is the change log. New `BiometricsPanel` in Dosing → Metrics
("Update at this visit") for both warfarin and NOAC patients — weight/height matter for
renal function either way. Existing patients backfilled with one entry each, dated to
intake, so nothing showed up empty.

**14.5 Labs — filterable and orderable.** Added a Test dropdown (built from whatever
test names actually exist in this patient's data, not a hardcoded list — defaults to
"INR" when present) and an Oldest first/Newest first order toggle. Previously it was
always all-tests, newest-first, no way to change either.

**14.6 Layout widened for desktop/tablet landscape.** Per the request — this is a clinic
tool used on desktop and tablet landscape, not mobile — removed the 900px page cap
(now 1440px) on the home page and patient chart, widened the intake form (640→760px),
widened the patient chart's sidebar (180→260px) and content padding, and bumped metric
card grid minimums so more columns show per row on a wide screen. No responsive/mobile
work was done or attempted — explicitly out of scope per the request.

**14.7 Not done from this round**
- Audit trail — explicitly held back pending confirmation on scope (which tables/edits
  to log), detail level (simple who+when vs full old→new diffs per field), and who can
  see it (existing `audit_log` table's RLS already restricts it to a `developer` role —
  confirm whether that's still right). The table and RLS policy already exist and were
  never used; nothing here blocks building it once scoped.
- `patient_documents` table not dropped, just unused — a future call on whether to
  actually delete it or leave it as dead weight.

**14.8 Delivery note** — Same as every round: applied directly to the live Supabase
project (migration for `biometrics_history`), verified against real demo-patient data
via direct SQL queries (not just typecheck — confirmed the backfill produced correct
rows, confirmed no existing data was disturbed), full `next build` passed clean,
packaged as a zip, not pushed to GitHub (no write access this session).

---

## 15. Fifth session — 25 August 2026: dashboard rebuild + real check-in workflow

Requester shared a mockup for the home page and asked for three things: track which
pharmacist saw each patient, redesign the dashboard to match the mockup, and show room
assignment on the queue. Confirmed scope on three ambiguous points before building
(appointment type categories, what the two placeholder alert types should mean, and
whether to build the full check-in state machine) — answers below.

**15.1 Seen-by pharmacist.** New `encounters.seen_by` (FK to `profiles`). Shows as a
"Seen by" column in Dosing → History, and gets set automatically when a dashboard
appointment is marked completed (see 15.4). Also addable/editable directly from the
existing "+ Add visit" / row-edit forms in the patient chart.

**15.2 Room + pharmacist on the queue.** `appointments.pharmacist_id` (new FK to
`profiles`) alongside the `room` column that already existed. When an appointment is
`with_pharmacist`, the dashboard row shows "Meeting {pharmacist} in {room}" directly
under the patient's name.

**15.3 Appointment type.** New `appointment_type` enum
(`routine_followup` / `telephone_followup` / `urgent_walkin` — the requester's own
categories, not the mockup's original four) on `appointments`, set at scheduling time.
Drives the dashboard's pie chart (plain CSS `conic-gradient`, no charting library —
same reasoning as the plain-SVG sparklines elsewhere: avoids the SSR/hydration issue
already documented in gap 5, §5).

**15.4 Full check-in workflow — the state machine requested.**
`appointment_status` enum grew three new values: `scheduled`, `checked_in`,
`with_pharmacist` (Postgres enums can only grow, not shrink in place — the old
`waiting`/`in_progress` values still technically exist but the app no longer writes
them; existing demo rows were migrated onto the new values). Flow:
`scheduled` → **Check In** → `checked_in` → **Start Visit** (assign room + pharmacist
inline) → `with_pharmacist` → **Mark Completed** → `completed` (or **No-show** at the
first step). New actions in `app/actions/appointments.ts`:
`checkInAppointment`, `startVisit`, `completeAppointment`, `markNoShow`,
`createAppointment`.

**Mark Completed does real work, not just a status flip** — it also creates (or
updates, if one's already linked) a minimal `encounters` row: today's date, room,
seen_by. This is what makes 15.1 actually populate without the pharmacist doing double
entry. The pharmacist still goes into the patient chart afterward to fill in
dose/notes/labs — this only closes the loop between "today's queue" and "the visit
exists in the chart."

**15.5 Appointment creation UI — closes a gap that's been open since session 1.**
New `/appointments/new` page (patient, date/time, room, pharmacist, type). This was
gap 2 in §8/§5 ("Appointment creation has no UI") since the very first handover;
resolved as a side effect of building the check-in workflow, not a separate ask.

**15.6 Dashboard rebuild.** New `components/home/Dashboard.tsx` (client component,
same one-big-file pattern as `PatientChart.tsx`), `app/page.tsx` now just fetches data
and hands it off. Sections, matching the mockup's layout: Today's Overview (stat
counts), High Priority Alerts, Appointments Status (pie chart), Quick Search, Mini
Calendar, Today's Appointments table (the queue + check-in actions), Upcoming
Appointments. Left nav has only two real destinations — Dashboard and a new
`/patients` list page — Reports/Messages/Settings from the mockup were **not** built
as fake links; see 15.8.

High Priority Alerts, per the requester's answer:
- **INR > 4.0** — real, computed from each active patient's latest INR reading.
- **Defaulted follow-up** — real, reusing the `patient_followup_status` view from
  session 2 (folded into this panel rather than dropped, since it already existed and
  the mockup didn't call for removing it).
- **Overdue dose adjustments** / **New referrals pending review** — explicit
  placeholders, greyed out, labeled "not tracked yet." Nothing invented here; these
  wait on the requester deciding whether they're wanted at all, per their answer.

Theme: red accent throughout (`--text-accent`/`--fill-accent`, already established in
session 2), light/bright background, matching the request directly — no dark mode
detour.

**15.7 New query functions** (`lib/supabase/queries.ts`): `getTodaysAppointments`
(rewritten — now returns a flat, fully-typed `TodaysAppointment[]` instead of `any[]`,
joins patient + pharmacist + latest INR), `getHighInrAlerts`, `getPharmacists`,
`getCurrentPharmacist` (reads the logged-in Supabase Auth session). New DB view
`patient_latest_inr` (same `distinct on` pattern as `patient_followup_status`) backs
both the alerts panel and the queue's "Last INR" column.

**15.8 Not done from this round**
- Reports, Messages, Settings from the mockup's left nav — not built. Adding nav items
  that go nowhere felt worse than leaving them out; flag if any of the three are
  actually wanted and what they should do.
- No room master list — `room` is still free text on both `appointments` and
  `encounters`, same as before. If double-booking a room becomes a real problem, that's
  worth a dedicated `rooms` table with actual scheduling conflict checks — not
  attempted here.
- Mini calendar is decorative — shows the current month with today highlighted, doesn't
  filter the queue by date. Wiring it up (pick a date → see that day's appointments) is
  a real feature, not a follow-on of what was asked.
- "Log INR Result" quick action in the left nav routes to `/patients` (search first,
  then use that patient's Labs tab) rather than a dedicated flow — there's no sensible
  "log a result" entry point without a patient already selected.

**15.9 Delivery note** — Two-step migration (enum values, then columns/data
migration, since Postgres won't let you use a newly-added enum value in the same
transaction that added it on all versions — split it to be safe rather than assume the
project's PG version). **Replayed the exact `completeAppointment` server action logic
by hand in SQL** against the live demo patient (create test appointment → check in →
start visit → create encounter with seen_by → link encounter_id → mark completed →
confirm the seen-by join resolves to a real name) before trusting the code path, then
deleted the test rows and confirmed row counts matched the pre-session baseline exactly
(2 appointments, 5 encounters). Full `next build` clean. Packaged as a zip, not pushed
to GitHub.

---

## 16. Sixth session — 25 August 2026: dark-mode bug, unicode corruption, calendar, footer, date/time format

Requester reported the dashboard rendering black and asked for five fixes/additions.
Two further asks (a non-persisting demo mode, and a full patient-page redesign against
a second mockup) were deliberately **not** built this round — see 16.6.

**16.1 Dark screen — root cause found.** `app/globals.css` had a
`@media (prefers-color-scheme: dark)` block left over from before the "bright theme"
request in session 2. It silently overrode every color variable whenever the viewer's
OS/browser was set to dark mode — which is exactly what was happening. Removed
entirely, with a comment explaining why, so it doesn't get re-added by accident later.
The app is now always light regardless of system preference.

**16.2 Interactive calendar.** `getTodaysAppointments` became `getAppointmentsForDate(date)`
(kept as a thin wrapper for backward compatibility). `app/page.tsx` now reads a `?date=`
search param and re-fetches server-side for that date. Calendar cells in
`components/home/Dashboard.tsx` are real links (`/?date=YYYY-MM-DD`), the queue table
retitles to show which date is being viewed, and the "Upcoming Appointments" panel
(which only makes sense relative to *now*) correctly disables itself and says so when
viewing any date other than today, rather than showing misleading data.

**16.3 Unicode escape corruption — real bug, and a real incident while fixing it.**
Every file built across this whole project used `\uXXXX`-style escape sequences for
em-dashes, middle dots, and a couple of emoji icons. Something in the write/transport
path was double-escaping these, so the browser was rendering literal text like
`⚠️` instead of the actual character — this was very likely happening
**everywhere** those escapes were used, not just the one alert icon the requester
happened to notice. Root-caused and fixed by replacing every `\uXXXX` escape across
`app/`, `components/`, and `lib/` with the actual literal Unicode character, using a
script that correctly reassembles surrogate pairs (the naive version doesn't, and
silently mangles emoji).

**Incident during the fix:** the first version of that script crashed
(`UnicodeEncodeError`) partway through re-writing `components/home/Dashboard.tsx` —
Python had already truncated the file to 0 bytes via `open(..., 'w')` before the crash,
since the encode error happened at write time, not before. This was caught immediately
by checking file sizes against expectations post-fix. `Dashboard.tsx` was rebuilt from
scratch, this time using plain ASCII (`-`, `!`, `#`) instead of any escaped or literal
special characters, specifically to avoid this whole class of failure recurring. Every
other touched file's byte count was checked against its pre-fix size to confirm nothing
else was silently damaged the same way — none were.

**16.4 Footer.** `app/layout.tsx` is now an async server component (fetches
`getCurrentPharmacist()`). Every page shows, at the bottom: who's logged in and their
raw user ID, and below that "Developed by Shamin Mohd Saffian · shamin@ukm.edu.my ·
Version 1.0", exactly as specified.

**16.5 Date/time display format.** New `lib/format.ts`:
`formatDateDisplay()` renders any stored ISO date as `DD/MM/YY` for display only — the
underlying stored values are untouched (still ISO, still what sorting/comparisons use).
Applied across the patient chart (History, Labs, Target INR/biometrics/HAS-BLED
history lists, sidebar, DOB) and the dashboard's alerts. `TIME_OPTIONS` is a 15-minute-
increment array (07:00–19:00); the appointment-scheduling time field is now a `<select>`
built from it instead of a native free-text time input, since a clinic books to a
schedule, not an arbitrary minute. Native `<input type="date">` fields (patient DOB
entry, visit dates, etc.) were **not** converted to a custom DD/MM/YY picker — the
browser's own date picker already renders in a locale-appropriate format, and building
a fully custom date-picker component was judged out of proportion to the ask; flag if
that's actually wanted.

**16.6 Explicitly not built this round — need requester input first**
- **Demo mode with two non-persisting patients, empty production DB.** This needs an
  architecture decision (most likely: a fully separate client-only version of the app —
  no server actions, all state local, resets on refresh) before any code gets written.
  Also unresolved: whether to delete the two seeded demo patients
  (Siti Nur Aisyah, Tan Wei Ming) from the live database now, or only once a demo mode
  exists to replace them for testing purposes.
- **Patient page redesign** against the requester's second mockup (a denser,
  more-at-a-glance layout vs. today's tabbed interface). The requester explicitly asked
  for a proposal and their approval before this gets built, so nothing was built —
  next step is presenting a plan that keeps every feature from §11–§15 intact.

**16.7 Delivery note** — Verified against live Supabase: confirmed appointment/encounter
row counts unchanged from the session-start baseline (2 appointments, 5 encounters)
after all query/data-shape changes. Full `next build` clean. Packaged as a zip, not
pushed to GitHub.

---

## 17. Seventh session — 25 August 2026: branding, KPI reports, lab panels, NOAC dosing, CHA2DS2-VASc

Seven-item request. Two items from it — a non-persisting demo mode and the patient-page
redesign — are still outstanding from the prior session and weren't addressed here;
see §16.6, unchanged.

**17.1 Rebranded.** "ACMS" → "UKM AMS" everywhere it appeared (header, login, signup),
full name "UKM Anticoagulant Management System" in the page title and signup subtitle.

**17.2 Footer no longer requires scrolling.** Header and footer are now
`position: fixed` to the viewport (`app/layout.tsx`), with the content area between
them as the only scrollable region (`overflow-y: auto`, height calculated from the two
fixed bars). The footer is now always visible without scrolling on every page,
regardless of how much content that page has. Genuinely one caveat worth being upfront
about: this doesn't make a data-dense page like the dashboard fit in one screen with
zero scrolling — the *footer* no longer requires scrolling to reach, but the dashboard
content itself can still scroll internally if it's taller than the viewport. Making the
dashboard itself fit one screen with no internal scroll would mean cutting information
density, which cuts against several other things that got added this session and last.

**17.3 Reports page.** New `/reports`, added as a real left-nav destination (not a
placeholder). `getClinicReportData()` in `queries.ts` computes, live, from actual data
(not seeded/fake numbers):
- **Workload:** active patient count, new enrollments (30d), appointments this
  week/month, no-show rate (30d), appointment-type mix (30d), per-pharmacist workload
  (30d).
- **Quality:** clinic-wide average TTR (each warfarin patient's own Rosendaal
  calculation, averaged), % of patients at TTR ≥65% (a commonly-cited "good
  control" benchmark in the literature — flagged in-page as something to confirm
  against the clinic's own target, not asserted as objectively correct), average PINRR,
  % of latest INR readings > 4.0.
- **Risk/safety:** bleeding and clotting event counts (90d), average and
  high-risk-share for both HAS-BLED and CHA2DS2-VASc across active patients.

The page includes an explicit "why these KPIs" note and says outright what's *not*
built: trend-over-time charts (everything here is a snapshot as of today) and any
risk-adjustment (a clinic with sicker patients will score worse on some of these
without that being a quality failure). This was a "determine what's useful and
suggest" ask, not a fully-specified spec — treat the KPI selection itself as a
first draft to react to, not a finished product.

**17.4 Lab panels: Renal / Hematology / Hepatic / Coagulation.** New
`LAB_TEST_CATALOG` in `lib/types.ts` — INR, PT, aPTT (Coagulation); serum
creatinine, eGFR (Renal Function); hemoglobin, hematocrit, platelet count
(Hematology); AST, ALT, bilirubin (Hepatic Function). The Labs tab's test-name field
is now a categorized `<select>` (`<optgroup>` per category) that auto-fills a sensible
default unit, and there's a Category filter alongside the existing Test filter.

**Real gap found and fixed while building this:** the Labs tab was only ever being
handed INR and creatinine results from the patient page (`getLabResults(id, "INR")` /
`getLabResults(id, "Serum creatinine")`, called explicitly). The new categories would
have been addable via the form but then **invisible** in the tab afterward, since
nothing fetched them. Fixed by fetching all of a patient's labs
(`getLabResults(patient.id)`, no filter) and passing that through instead.

**17.5 NOAC dosing reference, with real sources.** Before writing any of this, searched
for and read actual manufacturer prescribing information / FDA labeling for all four
NOACs rather than working from memory, per the standing instruction not to assert
clinical dosing without a verifiable source. `NOAC_DOSING` in `lib/types.ts`, sourced
to:
- Rivaroxaban — Xarelto FDA label (accessdata.fda.gov)
- Apixaban — Eliquis Dosing Guide (eliquis.com)
- Dabigatran — Pradaxa FDA label (boehringer-ingelheim.com); flagged explicitly
  that the commonly-used 110mg reduced dose is **not** part of the US label the source
  is drawn from — it's used in most other markets including Malaysia's NPRA
  label, which is why the dosing box calls that distinction out rather than presenting
  110mg as if it were FDA-sourced too.
- Edoxaban — Savaysa FDA label (DailyMed)

Displayed automatically in the patient sidebar for NOAC patients only, matching
whichever drug they're actually on, each with a source link and an explicit
"verify against the current Malaysian package insert" caveat — this is reference
information, not a substitute for checking the actual local product insert.

**17.6 Sortable patient list.** New `components/patients/PatientListTable.tsx`,
replacing the old search-only `/patients` page. Columns: Name, MRN, Age, Start date,
Last appointment, Next appointment, Target INR, Drug — click any header to sort,
click again to reverse. New `getPatientListRows()` query joins each patient against
`patient_followup_status` for last/next appointment dates.

**17.7 CHA2DS2-VASc, and comorbidities as the shared source of truth.** New
`patients.comorbidities` (text array, checklist), `ethnicity`, `smoking_status`
(explicitly optional per the request), `alcohol_excess` columns. New
`lib/calculators/cha2ds2-vasc.ts` — same "engine computes, never enter a raw
score" philosophy as HAS-BLED: CHF, hypertension, diabetes, stroke/TIA history, and
vascular disease all read from the comorbidities checklist; age brackets and female-sex
point are derived automatically from DOB and the existing sex field. **HAS-BLED was
refactored** (`hasBledInputsFromComorbidities()` in `has-bled.ts`) to read
hypertension, abnormal renal/hepatic function, stroke history, and bleeding history
from the *same* comorbidities list instead of a separate 6-checkbox form — a
pharmacist now records comorbidities once and both scores compute from it, rather than
re-entering overlapping clinical facts twice. Both scoring panels in Dosing →
Metrics are now one-click "Recalculate" buttons with no form at all. Verified the
actual math, not just that it compiles: ran `calculateHasBled` and
`calculateCha2ds2Vasc` via `tsx` against Siti Nur Aisyah's real DOB/sex with a test set
of comorbidities (hypertension, stroke history, diabetes) and confirmed HAS-BLED=2,
CHA2DS2-VASc=5 — both match hand-calculation before the test data was reverted.

**17.8 Process note on the unicode-escape bug (see §16.3).** It recurred **five
separate times** during this session — old habit of typing `—`-style escapes
in generated code, which is exactly the pattern that caused the original bug. Each time
was caught with a targeted grep-and-fix immediately after the edit that introduced it,
before it could compound. Did one final project-wide sweep
(`grep -rlP '\\\\u[0-9a-fA-F]{4}'` across `app/`, `components/`, `lib/`) before
packaging and confirmed zero remaining instances, including one in `lib/format.ts`
that had been sitting since the file was first created last session and was only
caught by this final sweep, not by any per-edit check.

**17.9 Not done this round**
- Demo mode and the patient-page redesign — both still pending from §16.6,
  unchanged.
- Reports page has no date-range picker (fixed 7/30/90-day windows) and no
  trend-over-time view — both real features, not attempted here.
- No PDF/print export of the reports page for actually handing to a department head.

**17.10 Delivery note** — Verified against live Supabase: ran the real calculator
functions against real patient data (not just typechecked), confirmed patient/
appointment/encounter/lab/scoring row counts unchanged from baseline after all test
data was reverted (2 patients, 2 appointments, 5 encounters, 9 lab results, 3 scoring
results). Full `next build` clean, all routes including the new `/reports` compiling.
Packaged as a zip, not pushed to GitHub.

## 9. Who to ask

Everything above was built collaboratively with Claude across sessions on 24–25 August
2026 — full reasoning and back-and-forth is in that conversation history if context on
*why* a decision was made is needed later.
