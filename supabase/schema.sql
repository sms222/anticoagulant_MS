-- ============================================================================
-- Anticoagulation Clinic Management — Supabase/Postgres Schema
-- "Seamus" project
-- ============================================================================
-- Design notes:
--  - AI (Groq) fields are OPTIONAL / nullable everywhere. Nothing in this
--    schema depends on the AI pipeline being approved or wired up.
--  - RLS is ON for every clinical table. Two roles to start: 'pharmacist'
--    (full clinical read/write, no export) and 'developer' (adds export/
--    research access). Extend later if per-pharmacist restriction is wanted.
--  - scoring_tool_results is a generic key-value time series so new bleeding/
--    stroke risk scores can be added without a migration.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. ENUMS
-- ---------------------------------------------------------------------------
create type anticoagulant_type as enum ('warfarin', 'rivaroxaban', 'apixaban', 'dabigatran', 'edoxaban', 'other');
create type indication_type as enum ('af_nonvalvular', 'af_valvular', 'mechanical_valve', 'vte_dvt', 'vte_pe', 'other');
create type sex_type as enum ('male', 'female');
create type patient_status as enum ('active', 'lapsed', 'deceased', 'transferred', 'discontinued');
create type bleeding_severity as enum ('major', 'crnm', 'minor'); -- ISTH classification
create type clinical_event_type as enum ('bleeding', 'clotting', 'hospitalization', 'other');
create type lab_source as enum ('manual', 'ems_screenshot_ai', 'ems_screenshot_manual');
create type adherence_phase as enum ('initiation', 'implementation', 'persistence'); -- ABC taxonomy, Vrijens et al. 2012
create type app_role as enum ('pharmacist', 'developer');
create type note_type as enum ('phone_call', 'sms_whatsapp', 'in_person', 'missed_appt', 'other');
create type risk_class as enum ('low', 'medium', 'high');
create type appointment_status as enum ('waiting', 'in_progress', 'completed', 'no_show', 'cancelled');

-- ---------------------------------------------------------------------------
-- 1. USERS / STAFF (extends Supabase auth.users)
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role app_role not null default 'pharmacist',
  created_at timestamptz not null default now()
);

-- New signups auto-get a profiles row (self-service signup, RLS checks against
-- this table). Fires after insert on auth.users.
create function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'pharmacist'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. PATIENTS
-- ---------------------------------------------------------------------------
create table patients (
  id uuid primary key default gen_random_uuid(),
  mrn text unique,                              -- hospital record number, if used
  name text not null,
  date_of_birth date,
  sex sex_type,
  weight_kg numeric(5,2),
  height_cm numeric(5,2),
  indication indication_type not null,
  indication_detail text,                       -- free text, e.g. valve type/position
  anticoagulant_type anticoagulant_type not null,
  target_inr_low numeric(3,1),                  -- null for NOAC/DOAC patients
  target_inr_high numeric(3,1),
  baseline_creatinine numeric(6,2),              -- for baseline CrCl
  status patient_status not null default 'active',
  intake_date date not null default current_date,
  education_status text,                        -- free text or coded, TBD
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  phone text,
  address text,
  risk_class risk_class,
  emergency_contact_info text                    -- free text: next of kin, phone, email (Contacts tab)
);

create index idx_patients_status on patients(status);
create index idx_patients_anticoag_type on patients(anticoagulant_type);

-- ---------------------------------------------------------------------------
-- 3. ENCOUNTERS (visit records)
-- ---------------------------------------------------------------------------
create table encounters (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  encounter_date date not null default current_date,
  pharmacist_id uuid references profiles(id),
  current_dose_mg numeric(6,2),                 -- weekly total or per-day, see dosing_schedule for detail
  dose_changed boolean not null default false,
  dose_change_reason text,
  missed_doses_since_last int default 0,
  new_meds_or_illness text,
  bleeding_symptoms_reported boolean not null default false,
  clotting_symptoms_reported boolean not null default false,
  next_appt_date date,
  cbc_reviewed boolean default false,
  renal_function_reviewed boolean default false, -- relevant for NOAC monitoring cadence
  notes text,
  -- AI scribe fields — nullable, populated only if governance clears the pipeline
  audio_transcript text,
  ai_soap_note jsonb,
  ai_pipeline_used boolean not null default false,
  created_at timestamptz not null default now(),
  room text,
  visit_start_time time,
  visit_end_time time
);

create index idx_encounters_patient on encounters(patient_id, encounter_date desc);
create index idx_encounters_next_appt on encounters(next_appt_date);

-- ---------------------------------------------------------------------------
-- 4. LAB RESULTS
-- ---------------------------------------------------------------------------
create table lab_results (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  encounter_id uuid references encounters(id) on delete set null,
  test_name text not null,                      -- 'INR','SCr','TT','Hb','Platelets','LFT_ALT', etc.
  result_value numeric(10,3) not null,
  unit text,
  test_date date not null,
  source lab_source not null default 'manual',
  ai_extraction_confidence numeric(3,2),         -- null unless source involved AI OCR
  confirmed_by_pharmacist boolean not null default true, -- per agreed rule: AI extraction always human-confirmed before save
  created_at timestamptz not null default now()
);

create index idx_labs_patient_test on lab_results(patient_id, test_name, test_date);

-- ---------------------------------------------------------------------------
-- 5. DOSING SCHEDULE (per-day-of-week dose, versioned — warfarin can vary by day)
-- ---------------------------------------------------------------------------
create table dosing_schedules (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  encounter_id uuid references encounters(id) on delete set null,
  effective_from date not null,
  mon_mg numeric(5,2), tue_mg numeric(5,2), wed_mg numeric(5,2), thu_mg numeric(5,2),
  fri_mg numeric(5,2), sat_mg numeric(5,2), sun_mg numeric(5,2),
  created_at timestamptz not null default now()
);

create index idx_dosing_patient on dosing_schedules(patient_id, effective_from desc);

-- ---------------------------------------------------------------------------
-- 6. CLINICAL EVENTS (bleeding / clotting / hospitalization)
-- ---------------------------------------------------------------------------
create table clinical_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  encounter_id uuid references encounters(id) on delete set null,
  event_type clinical_event_type not null,
  bleeding_severity bleeding_severity,           -- populated only if event_type = 'bleeding'
  event_date date not null,
  description text not null,
  inr_at_event numeric(4,2),
  outcome text,
  created_at timestamptz not null default now()
);

create index idx_events_patient on clinical_events(patient_id, event_date desc);
create index idx_events_type on clinical_events(event_type);

-- ---------------------------------------------------------------------------
-- 7. ADHERENCE (ABC taxonomy — Vrijens et al. 2012, no proprietary scale)
-- ---------------------------------------------------------------------------
create table adherence_assessments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  encounter_id uuid references encounters(id) on delete set null,
  phase adherence_phase not null,
  assessment_date date not null default current_date,
  response_summary text,                         -- free text from consult, structured questions TBD
  concern_flagged boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_adherence_patient on adherence_assessments(patient_id, assessment_date desc);

-- ---------------------------------------------------------------------------
-- 8. SCORING TOOLS — generic, extensible (HAS-BLED, ATRIA, HEMORR2HAGES,
--    ORBIT, ABH, RE-LY, A4C, and future tools) with defined prediction horizon
-- ---------------------------------------------------------------------------
create table scoring_tool_definitions (
  id uuid primary key default gen_random_uuid(),
  tool_name text unique not null,                -- 'HAS-BLED','ATRIA','ORBIT', etc.
  tool_category text,                             -- 'bleeding_risk','stroke_risk','warfarin_suitability'
  prediction_horizon_days int,                    -- defined horizon per tool, required for valid AUROC scoring
  source_citation text,
  is_active boolean not null default true
);

create table scoring_tool_results (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  encounter_id uuid references encounters(id) on delete set null,
  tool_id uuid not null references scoring_tool_definitions(id),
  score_date date not null default current_date,
  score_value numeric(6,2) not null,
  components jsonb,                               -- individual sub-criteria that produced the score
  created_at timestamptz not null default now()
);

create index idx_scoring_patient_tool on scoring_tool_results(patient_id, tool_id, score_date);

-- ---------------------------------------------------------------------------
-- 9. CONTACT / CLINICAL NOTES LOG
-- ---------------------------------------------------------------------------
create table contact_log (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  pharmacist_id uuid references profiles(id),
  note_type note_type not null,
  note_date timestamptz not null default now(),
  content text not null
);

create index idx_contact_log_patient on contact_log(patient_id, note_date desc);

-- ---------------------------------------------------------------------------
-- 10a. APPOINTMENTS (today's clinic queue — home page)
-- ---------------------------------------------------------------------------
create table appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  encounter_id uuid references encounters(id) on delete set null,
  scheduled_date date not null,
  scheduled_time time not null,
  room text,
  status appointment_status not null default 'waiting',
  checked_in_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_appointments_date on appointments(scheduled_date, scheduled_time);

-- ---------------------------------------------------------------------------
-- 10b. MEDICATIONS (Drugs tab — structured concomitant medication list)
-- ---------------------------------------------------------------------------
create table medications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  drug_name text not null,
  dose text not null,               -- free text, e.g. '500mg' — pharmacy dosing isn't always a clean number
  frequency text not null,          -- free text, e.g. 'OD','BD','PRN'
  route text,
  indication text,
  start_date date not null default current_date,
  stop_date date,                   -- null = still active
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_medications_patient on medications(patient_id, active);

-- ---------------------------------------------------------------------------
-- 10c. REMINDERS (Reminders tab — freeform per-patient task list)
-- ---------------------------------------------------------------------------
create table reminders (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  task text not null,
  due_date date,
  completed boolean not null default false,
  completed_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_reminders_patient on reminders(patient_id, completed, due_date);

-- ---------------------------------------------------------------------------
-- 10d. PATIENT DOCUMENTS (Documents tab — link/metadata list, no file bytes;
--      real upload needs Supabase Storage + the same governance sign-off as
--      the AI pipeline, see §6 in HANDOVER.md)
-- ---------------------------------------------------------------------------
create table patient_documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  label text not null,
  url text not null,
  added_by uuid references profiles(id),
  added_at timestamptz not null default now()
);

create index idx_patient_documents_patient on patient_documents(patient_id, added_at desc);

-- ---------------------------------------------------------------------------
-- 11. AUDIT LOG (who changed what, when — needed given clinical data + RLS)
-- ---------------------------------------------------------------------------
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  table_name text not null,
  record_id uuid not null,
  action text not null,                           -- 'insert','update','delete'
  changed_fields jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table patients enable row level security;
alter table encounters enable row level security;
alter table lab_results enable row level security;
alter table dosing_schedules enable row level security;
alter table clinical_events enable row level security;
alter table adherence_assessments enable row level security;
alter table scoring_tool_results enable row level security;
alter table scoring_tool_definitions enable row level security;
alter table contact_log enable row level security;
alter table audit_log enable row level security;
alter table appointments enable row level security;
alter table medications enable row level security;
alter table reminders enable row level security;
alter table patient_documents enable row level security;

-- All authenticated staff (pharmacist or developer) can read/write clinical
-- tables. Tighten later to per-clinic-team if you ever run multiple sites.
create policy staff_full_access on patients for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));

-- Repeat the same pattern for each clinical table.
create policy staff_full_access on encounters for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));

create policy staff_full_access on lab_results for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));

create policy staff_full_access on dosing_schedules for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));

create policy staff_full_access on clinical_events for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));

create policy staff_full_access on adherence_assessments for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));

create policy staff_read_scoring on scoring_tool_results for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));

create policy staff_read_scoring_defs on scoring_tool_definitions for select
  using (exists (select 1 from profiles where id = auth.uid()));

create policy staff_full_access on contact_log for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));

-- Audit log: developer role only (pharmacists shouldn't see/edit the audit trail)
create policy developer_only_audit on audit_log for select
  using (exists (select 1 from profiles where id = auth.uid() and role = 'developer'));

create policy staff_full_access on appointments for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));

create policy staff_full_access on medications for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));

create policy staff_full_access on reminders for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));

create policy staff_full_access on patient_documents for all
  using (exists (select 1 from profiles where id = auth.uid()))
  with check (exists (select 1 from profiles where id = auth.uid()));

-- ============================================================================
-- SEED: scoring tool definitions (fill in exact horizons/citations later)
-- ============================================================================
insert into scoring_tool_definitions (tool_name, tool_category, prediction_horizon_days, source_citation) values
  ('HAS-BLED', 'bleeding_risk', 365, null),
  ('ATRIA', 'bleeding_risk', 365, null),
  ('HEMORR2HAGES', 'bleeding_risk', 365, null),
  ('ORBIT', 'bleeding_risk', 365, null),
  ('ABH', 'bleeding_risk', 365, null),
  ('RE-LY', 'bleeding_risk', 365, null),
  ('A4C', 'bleeding_risk', 365, null);
-- NOTE: prediction_horizon_days set to 365 as a placeholder for every tool.
-- You flagged that each tool needs its own designed horizon (some are 1yr,
-- some 2yr) — confirm the correct horizon per tool from its original
-- validation paper before this goes near real AUROC calculations.
