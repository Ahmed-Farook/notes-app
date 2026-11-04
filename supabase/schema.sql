-- Supabase Schema for Apple Notes Cross-Platform Sync
-- Paste this script into your Supabase Dashboard: SQL Editor -> New query -> Run

-- 1. Create Folders Table
create table if not exists public.folders (
  id text primary key,
  name text not null,
  icon text,
  is_system boolean default false,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz default now(),
  updated_at bigint not null
);

-- 2. Create Notes Table
create table if not exists public.notes (
  id text primary key,
  title text default '',
  content text default '',
  plain_text_preview text default '',
  folder_id text default 'default',
  is_pinned boolean default false,
  is_trash boolean default false,
  created_at bigint not null,
  updated_at bigint not null,
  user_id uuid references auth.users(id) on delete cascade default auth.uid()
);

-- 3. Enable Row Level Security (RLS)
alter table public.folders enable row level security;
alter table public.notes enable row level security;

-- Drop existing policies if any
drop policy if exists "Users can manage their own folders" on public.folders;
drop policy if exists "Users can manage their own notes" on public.notes;

-- 4. Create Policies so users only see & edit their own data
create policy "Users can manage their own folders"
  on public.folders
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their own notes"
  on public.notes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 5. Enable Realtime WebSockets for Notes & Folders
alter publication supabase_realtime add table public.folders;
alter publication supabase_realtime add table public.notes;
