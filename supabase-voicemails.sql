-- Voicemails table
create table if not exists voicemails (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null default 'acme_tire',
  caller_number text not null,
  recording_url text not null,
  recording_sid text not null unique,
  call_sid text not null,
  duration integer,
  status text not null default 'new',
  transcript text,
  ai_summary text,
  ai_customer_name text,
  ai_vehicle text,
  ai_issue text,
  ai_urgency text,
  created_at timestamptz not null default now()
);

-- Index for fast unread count queries
create index if not exists voicemails_status_idx on voicemails (status);
create index if not exists voicemails_created_at_idx on voicemails (created_at desc);

-- Row-level security
alter table voicemails enable row level security;

-- Allow service role full access (used by backend API routes)
create policy "Service role full access"
  on voicemails
  for all
  to service_role
  using (true)
  with check (true);
