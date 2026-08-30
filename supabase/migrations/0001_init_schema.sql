-- 0001_init_schema.sql
-- Core relational schema: clinics, customers, sessions, messages, action plans.
-- Knowledge base / pgvector tables are in 0002_pgvector_and_rag.sql.

create extension if not exists "pgcrypto"; -- gen_random_uuid()

create table if not exists clinics (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    created_at timestamptz not null default now()
);

create table if not exists customers (
    id uuid primary key default gen_random_uuid(),
    clinic_id uuid not null references clinics(id) on delete cascade,

    name text not null,
    email text,
    phone text,

    treatment text not null,
    provider text,

    consultation_status text,   -- e.g. 'completed', 'no_show', 'scheduled'
    purchase_status text,       -- e.g. 'purchased', 'not_purchased'

    amount_spent numeric(10, 2) not null default 0,

    last_visit date,
    rebooked boolean not null default false,

    satisfaction_score numeric(3, 1),

    notes text,

    created_at timestamptz not null default now()
);

create index if not exists customers_clinic_id_idx on customers(clinic_id);
create index if not exists customers_treatment_idx on customers(treatment);
create index if not exists customers_last_visit_idx on customers(last_visit);
create index if not exists customers_rebooked_idx on customers(rebooked);

create table if not exists coaching_sessions (
    id uuid primary key default gen_random_uuid(),
    clinic_id uuid not null references clinics(id) on delete cascade,

    title text,

    started_at timestamptz not null default now(),
    ended_at timestamptz,

    summary text,
    key_findings jsonb,
    action_plan jsonb
);

create index if not exists coaching_sessions_clinic_id_idx on coaching_sessions(clinic_id);

create table if not exists messages (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references coaching_sessions(id) on delete cascade,

    role text not null check (role in ('user', 'assistant', 'system')),
    content text not null,

    input_mode text not null default 'chat' check (input_mode in ('chat', 'voice')),

    -- structured evidence/insights/recommendations attached to assistant messages;
    -- see docs/AI_AGENT.md for the response schema this stores.
    evidence jsonb,

    created_at timestamptz not null default now()
);

create index if not exists messages_session_id_idx on messages(session_id);
