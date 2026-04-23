-- Optional: helpful extension for uuid generation
create extension if not exists pgcrypto;

-- Drop old tables if you want a fully fresh start
drop table if exists public.drink_events cascade;
drop table if exists public.room_members cascade;
drop table if exists public.rooms cascade;
drop table if exists public.players cascade;

-- =========================
-- PLAYERS
-- =========================
create table public.players (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null,
  display_name text not null check (char_length(trim(display_name)) >= 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- ROOMS
-- =========================
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (char_length(trim(code)) >= 4),
  created_by_player_id uuid not null references public.players(id) on delete cascade,
  host_member_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- ROOM MEMBERS
-- =========================
create table public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  total_drinks integer not null default 0 check (total_drinks >= 0),
  water_count integer not null default 0 check (water_count >= 0),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, player_id)
);

-- add host_member_id foreign key after room_members exists
alter table public.rooms
add constraint rooms_host_member_id_fkey
foreign key (host_member_id) references public.room_members(id) on delete set null;

-- =========================
-- DRINK EVENTS
-- =========================
create table public.drink_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  room_member_id uuid not null references public.room_members(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  event_type text not null check (event_type in ('beer', 'shot', 'cocktail', 'water', 'undo')),
  amount integer not null default 1 check (amount >= 0),
  created_at timestamptz not null default now()
);

-- =========================
-- INDEXES
-- =========================
create index room_members_room_id_idx on public.room_members(room_id);
create index room_members_player_id_idx on public.room_members(player_id);
create index drink_events_room_id_idx on public.drink_events(room_id);
create index drink_events_player_id_idx on public.drink_events(player_id);
create index drink_events_room_member_id_idx on public.drink_events(room_member_id);

-- =========================
-- UPDATED_AT TRIGGER
-- =========================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_players_updated_at
before update on public.players
for each row
execute function public.set_updated_at();

create trigger set_rooms_updated_at
before update on public.rooms
for each row
execute function public.set_updated_at();

create trigger set_room_members_updated_at
before update on public.room_members
for each row
execute function public.set_updated_at();

-- =========================
-- ENABLE RLS
-- =========================
alter table public.players enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.drink_events enable row level security;

-- =========================
-- POLICIES
-- =========================

-- PLAYERS
create policy "read players"
on public.players
for select
using (true);

create policy "insert own player"
on public.players
for insert
with check (auth.uid() = auth_user_id);

create policy "update own player"
on public.players
for update
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

-- ROOMS
create policy "read rooms"
on public.rooms
for select
using (true);

create policy "signed in create rooms"
on public.rooms
for insert
with check (auth.uid() is not null);

create policy "signed in update rooms"
on public.rooms
for update
using (auth.uid() is not null)
with check (auth.uid() is not null);

-- ROOM MEMBERS
create policy "read room members"
on public.room_members
for select
using (true);

create policy "signed in insert room members"
on public.room_members
for insert
with check (auth.uid() is not null);

create policy "signed in update room members"
on public.room_members
for update
using (auth.uid() is not null)
with check (auth.uid() is not null);

-- DRINK EVENTS
create policy "read drink events"
on public.drink_events
for select
using (true);

create policy "signed in insert drink events"
on public.drink_events
for insert
with check (auth.uid() is not null);

create policy "signed in delete drink events"
on public.drink_events
for delete
using (auth.uid() is not null);


alter table public.room_members
add column if not exists total_points integer not null default 0 check (total_points >= 0);

alter table public.drink_events
add column if not exists points integer not null default 0;