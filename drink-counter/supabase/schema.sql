create extension if not exists pgcrypto;

drop table if exists public.drink_events cascade;
drop table if exists public.room_members cascade;
drop table if exists public.rooms cascade;
drop table if exists public.players cascade;

create table public.players (
  id uuid primary key default gen_random_uuid(),
  device_key text unique not null,
  display_name text not null check (char_length(trim(display_name)) >= 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (char_length(trim(code)) >= 4),
  name text not null default 'Party Room',
  is_active boolean not null default true,
  host_member_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  role text not null default 'member' check (role in ('host', 'member')),
  total_drinks integer not null default 0 check (total_drinks >= 0),
  water_count integer not null default 0 check (water_count >= 0),
  total_points integer not null default 0,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, player_id)
);

alter table public.rooms
add constraint rooms_host_member_id_fkey
foreign key (host_member_id) references public.room_members(id) on delete set null;

create table public.drink_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  member_id uuid not null references public.room_members(id) on delete cascade,
  actor_name text not null,
  drink_type text not null check (drink_type in ('beer', 'shot', 'cocktail', 'water')),
  delta integer not null,
  points integer not null default 0,
  created_at timestamptz not null default now()
);

create index room_members_room_id_idx on public.room_members(room_id);
create index room_members_player_id_idx on public.room_members(player_id);
create index drink_events_room_id_idx on public.drink_events(room_id);
create index drink_events_member_id_idx on public.drink_events(member_id);

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

alter table public.players enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.drink_events enable row level security;

create policy "public read players" on public.players for select using (true);
create policy "public insert players" on public.players for insert with check (true);
create policy "public update players" on public.players for update using (true) with check (true);

create policy "public read rooms" on public.rooms for select using (true);
create policy "public insert rooms" on public.rooms for insert with check (true);
create policy "public update rooms" on public.rooms for update using (true) with check (true);

create policy "public read room_members" on public.room_members for select using (true);
create policy "public insert room_members" on public.room_members for insert with check (true);
create policy "public update room_members" on public.room_members for update using (true) with check (true);

create policy "public read drink_events" on public.drink_events for select using (true);
create policy "public insert drink_events" on public.drink_events for insert with check (true);
create policy "public delete drink_events" on public.drink_events for delete using (true);