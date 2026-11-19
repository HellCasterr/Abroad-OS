-- Chat history and proposed actions are server-written and readable only by their owner.
create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null,
  role text not null check(role in ('user','assistant')),
  content text not null,
  document_ids uuid[] not null default '{}',
  document_content_shared boolean not null default false,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  foreign key(thread_id,user_id) references public.chat_threads(id,user_id) on delete cascade,
  unique(id,user_id)
);

create table public.chat_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null,
  message_id uuid not null,
  kind text not null check(kind in ('task','note')),
  payload jsonb not null,
  status text not null default 'pending' check(status in ('pending','processing','approved','dismissed')),
  result_id uuid,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  foreign key(thread_id,user_id) references public.chat_threads(id,user_id) on delete cascade,
  foreign key(message_id,user_id) references public.chat_messages(id,user_id) on delete cascade
);

create index on public.chat_threads(user_id,updated_at desc);
create index on public.chat_messages(thread_id,created_at);
create index on public.chat_actions(message_id,status);

alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_actions enable row level security;
create policy chat_threads_owner_read on public.chat_threads for select to authenticated using(user_id=(select auth.uid()));
create policy chat_messages_owner_read on public.chat_messages for select to authenticated using(user_id=(select auth.uid()));
create policy chat_actions_owner_read on public.chat_actions for select to authenticated using(user_id=(select auth.uid()));
