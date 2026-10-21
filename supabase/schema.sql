-- Run this file in Supabase Dashboard → SQL Editor.
-- This creates the user profile and study-pack tables, keeps records linked to auth.users,
-- and enables RLS as an additional safeguard. Backend routes also enforce user ownership.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 24),
  full_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username));

create table if not exists public.study_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  source_url text,
  transcript text not null default '',
  notes text not null default '',
  roadmap text not null default '',
  questions text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists study_packs_user_id_created_at_idx
  on public.study_packs (user_id, created_at desc);

create or replace function public.handle_new_nhewron_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    'user_' || substr(replace(new.id::text, '-', ''), 1, 12),
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_nhewron_auth_user_created on auth.users;
create trigger on_nhewron_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_nhewron_user();

alter table public.profiles enable row level security;
alter table public.study_packs enable row level security;

drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile"
  on public.profiles for select to authenticated using (auth.uid() = id);
drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
  on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users can read their study packs" on public.study_packs;
create policy "Users can read their study packs"
  on public.study_packs for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can create their study packs" on public.study_packs;
create policy "Users can create their study packs"
  on public.study_packs for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update their study packs" on public.study_packs;
create policy "Users can update their study packs"
  on public.study_packs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their study packs" on public.study_packs;
create policy "Users can delete their study packs"
  on public.study_packs for delete to authenticated using (auth.uid() = user_id);

-- Do not expose the service-role key in frontend environment variables or browser code.

-- Saved Ron conversations, including video study sessions, scoped to each account.
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('ai', 'studio')),
  title text not null,
  source_url text,
  transcript text not null default '',
  summary text not null default '',
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_sessions_user_mode_updated_idx
  on public.chat_sessions (user_id, mode, updated_at desc);

alter table public.chat_sessions enable row level security;
drop policy if exists "Users can read their chat sessions" on public.chat_sessions;
create policy "Users can read their chat sessions"
  on public.chat_sessions for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can create their chat sessions" on public.chat_sessions;
create policy "Users can create their chat sessions"
  on public.chat_sessions for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update their chat sessions" on public.chat_sessions;
create policy "Users can update their chat sessions"
  on public.chat_sessions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their chat sessions" on public.chat_sessions;
create policy "Users can delete their chat sessions"
  on public.chat_sessions for delete to authenticated using (auth.uid() = user_id);

