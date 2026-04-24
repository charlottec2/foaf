alter table public.gathers add column if not exists tags text[] not null default '{}';
