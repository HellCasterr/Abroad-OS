create extension if not exists pgcrypto;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '', email text, nationality text, degree text,
  institution text, graduation_year integer, cgpa numeric(4,2),
  aps_status text not null default 'unknown', aps_reference text,
  dmat_score text, moi_status text not null default 'unknown',
  ielts_status text not null default 'not_booked', ielts_test_date date,
  ielts_score text, timezone text not null default 'Asia/Kolkata',
  preferences jsonb not null default '{}'::jsonb, facts_status text not null default 'user_reported',
  notification_email text, email_enabled boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.programmes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  institution text not null, title text not null, country text, intake text,
  official_url text, admission_route text, status text not null default 'verification_required',
  paused boolean not null default false, funding_tier text, eligibility_status text not null default 'unknown',
  fit_score integer check (fit_score between 0 and 100), notes text,
  created_at timestamptz not null default now(), unique(user_id,institution,title,intake)
);

create table public.scholarships (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, funder text, country text, official_url text, programme_id uuid references public.programmes(id) on delete set null,
  coverage text, stipend text, status text not null default 'verification_required', eligibility_status text not null default 'unknown',
  nomination_required boolean, automatically_considered boolean,
  created_at timestamptz not null default now(), unique(user_id,name)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  programme_id uuid not null references public.programmes(id) on delete cascade,
  status text not null default 'saved', status_evidence text not null default 'user_reported',
  official_id text, submitted_at timestamptz, submitted_date date, payment_status text not null default 'unknown',
  confirmation_document_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,programme_id),
  check(status in ('saved','researching','preparing','missing_documents','ready_for_review','ready_to_pay','payment_attempted','submitted','under_review','interview','offer','conditional_offer','rejected','waitlisted','accepted','declined','deferred','paused')),
  check(payment_status in ('unknown','not_required','awaiting','attempted','failed','confirmed','refunded'))
);

create table public.scholarship_applications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  scholarship_id uuid not null references public.scholarships(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  status text not null default 'saved', status_evidence text not null default 'user_reported',
  submitted_at timestamptz, award_confirmed boolean not null default false,
  created_at timestamptz not null default now(), unique(user_id,scholarship_id)
);

create table public.sources (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  programme_id uuid references public.programmes(id) on delete cascade,
  scholarship_id uuid references public.scholarships(id) on delete cascade,
  url text not null, title text, authority text not null default 'official_unreviewed',
  monitor_enabled boolean not null default false, last_checked_at timestamptz, last_hash text,
  etag text, last_modified text, last_error text, next_check_at timestamptz,
  created_at timestamptz not null default now(), unique(user_id,url),
  check (programme_id is not null or scholarship_id is not null)
);

create table public.source_snapshots (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  content_hash text not null, excerpt text, response_status integer,
  candidate jsonb, checked_at timestamptz not null default now(),
  unique(source_id,content_hash)
);

create table public.deadlines (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  programme_id uuid references public.programmes(id) on delete cascade,
  scholarship_id uuid references public.scholarships(id) on delete cascade,
  source_id uuid references public.sources(id) on delete set null,
  kind text not null, label text not null, date_local date not null,
  time_local time, timezone text, instant_utc timestamptz,
  status text not null default 'needs_review', evidence_excerpt text,
  verified_at timestamptz, academic_cycle text, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (kind in ('admission','scholarship','reference','language','fee','uni_assist','interview','deposit','result','visa','housing','other')),
  check (status in ('needs_review','verified','conflict','historical','unavailable')),
  check ((time_local is null and instant_utc is null) or (time_local is not null and timezone is not null and instant_utc is not null)),
  check (programme_id is not null or scholarship_id is not null)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, details text, due_at timestamptz, priority integer not null default 2 check(priority between 1 and 4),
  status text not null default 'open' check(status in ('open','done','snoozed')),
  programme_id uuid references public.programmes(id) on delete set null,
  scholarship_id uuid references public.scholarships(id) on delete set null,
  deadline_id uuid references public.deadlines(id) on delete set null,
  recurrence text, completed_at timestamptz, evidence text,
  created_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  body text not null, tags text[] not null default '{}', programme_id uuid references public.programmes(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, category text not null, storage_path text not null unique,
  mime_type text not null, size_bytes bigint not null, sha256 text not null,
  version integer not null default 1, replaces_id uuid references public.documents(id) on delete set null,
  issue_date date, expiry_date date, tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  check (split_part(storage_path,'/',1)=user_id::text)
);

alter table public.applications add constraint application_confirmation_document_fk foreign key (confirmation_document_id) references public.documents(id) on delete set null;

create table public.document_requirements (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  programme_id uuid references public.programmes(id) on delete cascade,
  scholarship_id uuid references public.scholarships(id) on delete cascade,
  label text not null, accepted_formats text[], max_bytes bigint,
  deadline_id uuid references public.deadlines(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  status text not null default 'missing', notes text,
  check (programme_id is not null or scholarship_id is not null)
);

create table public.drafts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  programme_id uuid references public.programmes(id) on delete set null,
  scholarship_id uuid references public.scholarships(id) on delete set null,
  kind text not null, title text not null, content text not null,
  version integer not null default 1, parent_id uuid references public.drafts(id) on delete set null,
  status text not null default 'draft', evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  description text not null, category text not null, amount numeric(12,2) not null,
  currency text not null, status text not null default 'planned', paid_at timestamptz,
  receipt_document_id uuid references public.documents(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  dedupe_key text not null, title text not null, body text not null,
  severity text not null default 'info', read_at timestamptz, source_url text,
  created_at timestamptz not null default now(), unique(user_id,dedupe_key)
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  dedupe_key text not null, subject text not null, body text not null, recipient text not null,
  status text not null default 'queued', provider_id text, error text,
  attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,dedupe_key)
);

create table public.job_runs (
  id uuid primary key default gen_random_uuid(), job_key text not null unique, job_type text not null,
  status text not null default 'running', started_at timestamptz not null default now(), finished_at timestamptz,
  items_checked integer not null default 0, changes_found integer not null default 0,
  error text, attempts integer not null default 1
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  action text not null, entity text not null, entity_id uuid, before_data jsonb, after_data jsonb,
  created_at timestamptz not null default now()
);

create table public.calendar_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_refresh_token text not null, expires_at timestamptz, connected_at timestamptz not null default now()
);

create index on public.deadlines(user_id,date_local,status);
create index on public.tasks(user_id,status,due_at);
create index on public.sources(monitor_enabled,next_check_at);
create index on public.alerts(user_id,created_at desc);
create index on public.documents(user_id,category);
create index on public.notification_deliveries(status,next_attempt_at);

-- Every private table carries its owner. The service-role worker is used only on trusted server routes.
do $$ declare t text; begin
  foreach t in array array['profiles','programmes','scholarships','applications','scholarship_applications','sources','tasks','notes','documents','document_requirements','drafts','expenses','alerts'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy owner_all on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',t);
  end loop;
end $$;

-- Generated evidence, verified deadlines, integrations, deliveries, and audit history are server-owned.
do $$ declare t text; begin
  foreach t in array array['source_snapshots','deadlines','notification_deliveries','audit_logs','calendar_connections'] loop
    execute format('alter table public.%I enable row level security',t);
  end loop;
end $$;
create policy snapshots_owner_read on public.source_snapshots for select to authenticated using (user_id=(select auth.uid()));
create policy deadlines_owner_read on public.deadlines for select to authenticated using (user_id=(select auth.uid()));
create policy deliveries_owner_read on public.notification_deliveries for select to authenticated using (user_id=(select auth.uid()));
create policy audit_owner_read on public.audit_logs for select to authenticated using (user_id=(select auth.uid()));

alter table public.job_runs enable row level security;
-- Cron run metadata is shown through a server API; no direct client write access.

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('private-documents','private-documents',false,15728640,
  array['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;

create policy document_owner_read on storage.objects for select to authenticated
using (bucket_id='private-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy document_owner_insert on storage.objects for insert to authenticated
with check (bucket_id='private-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy document_owner_delete on storage.objects for delete to authenticated
using (bucket_id='private-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);

create function public.audit_application_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status or new.payment_status is distinct from old.payment_status then
    insert into public.audit_logs(user_id,action,entity,entity_id,before_data,after_data)
    values(new.user_id,'status_change','application',new.id,to_jsonb(old),to_jsonb(new));
  end if;
  return new;
end $$;
create trigger application_audit after update on public.applications for each row execute function public.audit_application_change();

-- A client cannot assign a confirmed state without evidence of an official confirmation.
create function public.require_submission_evidence() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status in ('submitted','under_review','interview','offer','conditional_offer','rejected','waitlisted','accepted')
    and new.status_evidence not in ('user_confirmed','official_document') then
    raise exception 'Submission status needs explicit confirmation evidence';
  end if;
  if new.payment_status = 'confirmed' and new.status_evidence <> 'official_document' then
    raise exception 'Payment confirmation needs attached official evidence';
  end if;
  return new;
end $$;
create trigger submission_evidence before insert or update on public.applications for each row execute function public.require_submission_evidence();

-- Foreign keys alone do not enforce tenant ownership of linked records.
create function public.require_owned_links() returns trigger language plpgsql security definer set search_path = '' as $$
declare field text; table_name text; linked uuid; owned boolean; body jsonb;
begin
  body := to_jsonb(new);
  for field,table_name in select * from (values
    ('programme_id','programmes'),('scholarship_id','scholarships'),('application_id','applications'),
    ('source_id','sources'),('deadline_id','deadlines'),('document_id','documents'),
    ('confirmation_document_id','documents'),('receipt_document_id','documents'),
    ('replaces_id','documents'),('parent_id','drafts')) as links(field,table_name)
  loop
    if body ? field and body->>field is not null then
      linked := (body->>field)::uuid;
      execute format('select exists(select 1 from public.%I where id=$1 and user_id=$2)',table_name)
        into owned using linked,new.user_id;
      if not owned then raise exception 'Linked % must belong to current owner',field; end if;
    end if;
  end loop;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['applications','scholarship_applications','sources','source_snapshots','deadlines','tasks','notes','documents','document_requirements','drafts','expenses'] loop
    execute format('create trigger owner_links before insert or update on public.%I for each row execute function public.require_owned_links()',t);
  end loop;
end $$;
