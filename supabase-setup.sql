create table if not exists public.bases (
    id text primary key,
    type text not null check (type in ('victim', 'killer')),
    name text not null,
    owner text,
    proxy text,
    proxy2 text,
    rotation_enabled boolean not null default true,
    tpa_delay integer not null default 16,
    extra_info text,
    panel1 text,
    panel2 text,
    panel3 text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.victim_stats (
    base_id text primary key references public.bases(id) on delete cascade,
    joined integer not null default 0,
    killed integer not null default 0,
    banned integer not null default 0,
    queue integer not null default 0,
    active_bot text,
    active_hearts integer not null default 0,
    target_display text,
    note text,
    updated_at timestamptz not null default now()
);

create table if not exists public.victim_hearts (
    id bigint generated always as identity primary key,
    base_id text not null references public.bases(id) on delete cascade,
    nick text not null,
    hearts integer not null default 0,
    created_at timestamptz not null default now(),
    unique (base_id, nick)
);

create table if not exists public.killer_bots (
    id bigint generated always as identity primary key,
    base_id text not null references public.bases(id) on delete cascade,
    username text not null,
    owner text,
    assigned_victim text,
    status text not null default 'Offline',
    is_hitting boolean not null default false,
    auto_reconnect boolean not null default false,
    color text,
    created_at timestamptz not null default now(),
    unique (base_id, username)
);

create table if not exists public.system_logs (
    id bigint generated always as identity primary key,
    message text not null,
    created_by uuid,
    created_at timestamptz not null default now()
);

create table if not exists public.web_logs (
    id bigint generated always as identity primary key,
    message text not null,
    created_by uuid,
    created_at timestamptz not null default now()
);

create table if not exists public.command_queue (
    id bigint generated always as identity primary key,
    base_id text not null references public.bases(id) on delete cascade,
    username text,
    command text not null,
    payload jsonb not null default '{}'::jsonb,
    status text not null default 'pending',
    created_by uuid,
    processed_at timestamptz,
    created_at timestamptz not null default now()
);

alter table public.bases enable row level security;
alter table public.victim_stats enable row level security;
alter table public.victim_hearts enable row level security;
alter table public.killer_bots enable row level security;
alter table public.system_logs enable row level security;
alter table public.web_logs enable row level security;
alter table public.command_queue enable row level security;

drop policy if exists "heartfarm authenticated select bases" on public.bases;
create policy "heartfarm authenticated select bases" on public.bases for select to authenticated using (true);
drop policy if exists "heartfarm authenticated write bases" on public.bases;
create policy "heartfarm authenticated write bases" on public.bases for all to authenticated using (true) with check (true);

drop policy if exists "heartfarm authenticated select victim_stats" on public.victim_stats;
create policy "heartfarm authenticated select victim_stats" on public.victim_stats for select to authenticated using (true);
drop policy if exists "heartfarm authenticated write victim_stats" on public.victim_stats;
create policy "heartfarm authenticated write victim_stats" on public.victim_stats for all to authenticated using (true) with check (true);

drop policy if exists "heartfarm authenticated select victim_hearts" on public.victim_hearts;
create policy "heartfarm authenticated select victim_hearts" on public.victim_hearts for select to authenticated using (true);
drop policy if exists "heartfarm authenticated write victim_hearts" on public.victim_hearts;
create policy "heartfarm authenticated write victim_hearts" on public.victim_hearts for all to authenticated using (true) with check (true);

drop policy if exists "heartfarm authenticated select killer_bots" on public.killer_bots;
create policy "heartfarm authenticated select killer_bots" on public.killer_bots for select to authenticated using (true);
drop policy if exists "heartfarm authenticated write killer_bots" on public.killer_bots;
create policy "heartfarm authenticated write killer_bots" on public.killer_bots for all to authenticated using (true) with check (true);

drop policy if exists "heartfarm authenticated select system_logs" on public.system_logs;
create policy "heartfarm authenticated select system_logs" on public.system_logs for select to authenticated using (true);
drop policy if exists "heartfarm authenticated write system_logs" on public.system_logs;
create policy "heartfarm authenticated write system_logs" on public.system_logs for all to authenticated using (true) with check (true);

drop policy if exists "heartfarm authenticated select web_logs" on public.web_logs;
create policy "heartfarm authenticated select web_logs" on public.web_logs for select to authenticated using (true);
drop policy if exists "heartfarm authenticated write web_logs" on public.web_logs;
create policy "heartfarm authenticated write web_logs" on public.web_logs for all to authenticated using (true) with check (true);

drop policy if exists "heartfarm authenticated select command_queue" on public.command_queue;
create policy "heartfarm authenticated select command_queue" on public.command_queue for select to authenticated using (true);
drop policy if exists "heartfarm authenticated write command_queue" on public.command_queue;
create policy "heartfarm authenticated write command_queue" on public.command_queue for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table public.bases;
alter publication supabase_realtime add table public.victim_stats;
alter publication supabase_realtime add table public.victim_hearts;
alter publication supabase_realtime add table public.killer_bots;
alter publication supabase_realtime add table public.system_logs;
alter publication supabase_realtime add table public.web_logs;
alter publication supabase_realtime add table public.command_queue;
