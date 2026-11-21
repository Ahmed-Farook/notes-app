-- Migration: Create Shared Notes Table for short shareable slugs (texo-notes.vercel.app/s/<slug>)
-- Run this in your Supabase Dashboard: SQL Editor -> New Query -> Run

create table if not exists public.shared_notes (
  slug text primary key,
  title text default '',
  content text default '',
  strokes text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Enable Row Level Security (RLS)
alter table public.shared_notes enable row level security;

-- Drop existing policies if any to allow safe rerun
drop policy if exists "Anyone can read shared notes" on public.shared_notes;
drop policy if exists "Anyone can create shared notes" on public.shared_notes;
drop policy if exists "Users can update their own shared notes" on public.shared_notes;

-- 1. Public read policy: Anyone can view a note using its short slug
create policy "Anyone can read shared notes"
  on public.shared_notes
  for select
  using (true);

-- 2. Public create policy: Anyone can generate a share link
create policy "Anyone can create shared notes"
  on public.shared_notes
  for insert
  with check (true);

-- 3. Update policy: Authenticated creators can update their shared notes if needed
create policy "Users can update their own shared notes"
  on public.shared_notes
  for update
  using (auth.uid() = user_id);
