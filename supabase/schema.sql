-- Nudge — Supabase schema
-- Run this in the Supabase SQL editor to set up the database

-- Days (one row per calendar day)
create table if not exists days (
  id            uuid primary key default gen_random_uuid(),
  date          date not null unique,
  raw_transcript text,
  parsed_summary text,
  created_at    timestamptz default now()
);

-- Nudges (one row per action item extracted from a voice dump)
create table if not exists nudges (
  id                      uuid primary key default gen_random_uuid(),
  day_id                  uuid references days(id) on delete cascade,
  title                   text not null,
  type                    text not null check (type in ('nudge', 'task', 'habit', 'context')),
  category                text not null default 'other' check (category in ('health','work','content','personal','finance','other')),
  scheduled_for           timestamptz not null,
  recurrence              text check (recurrence in ('hourly','daily','every_2h','every_90m','weekly')),
  recurrence_window_start time,
  recurrence_window_end   time,
  nudge_copy              text,
  status                  text not null default 'pending' check (status in ('pending','fired','done','snoozed','missed')),
  snoozed_until           timestamptz,
  completed_at            timestamptz,
  created_at              timestamptz default now()
);

-- Habits (permanent recurring habits — set once, run daily)
create table if not exists habits (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  frequency   text not null default 'daily' check (frequency in ('daily','weekdays','weekends')),
  time_window text not null default '08:00-22:00',
  nudge_tone  text not null default 'gentle' check (nudge_tone in ('gentle','firm','blunt')),
  active      boolean not null default true,
  created_at  timestamptz default now()
);

-- Completions (log of every completed nudge — used for streaks)
create table if not exists completions (
  id           uuid primary key default gen_random_uuid(),
  nudge_id     uuid references nudges(id) on delete cascade,
  completed_at timestamptz default now(),
  note         text
);

-- Settings (key/value store for user preferences)
create table if not exists settings (
  key   text primary key,
  value text not null
);

-- Enable Realtime on nudges table
alter publication supabase_realtime add table nudges;

-- Indexes for common queries
create index if not exists nudges_scheduled_for_idx on nudges(scheduled_for);
create index if not exists nudges_status_idx on nudges(status);
create index if not exists nudges_day_id_idx on nudges(day_id);
create index if not exists days_date_idx on days(date);
