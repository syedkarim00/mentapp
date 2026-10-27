-- Aggregate storage keeps each hangout update atomic. Versions prevent lost votes.
create table public.hangouts (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  state jsonb not null,
  version bigint not null default 0,
  created_at timestamptz not null default now()
);
alter table public.hangouts enable row level security;
revoke all on public.hangouts from anon, authenticated;
grant all on public.hangouts to service_role;

create table public.rate_limits (key text primary key, window_start timestamptz not null, count integer not null);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;
create function public.mentapp_rate_limit(bucket_key text, max_requests integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare requests integer;
begin
  delete from rate_limits where window_start < now() - interval '2 minutes';
  insert into rate_limits(key,window_start,count) values(bucket_key,date_trunc('minute',now()),1)
  on conflict(key) do update set
    count = case when rate_limits.window_start = date_trunc('minute',now()) then rate_limits.count + 1 else 1 end,
    window_start = date_trunc('minute',now())
  returning count into requests;
  return requests <= max_requests;
end;
$$;
revoke all on function public.mentapp_rate_limit(text,integer) from public, anon, authenticated;
grant execute on function public.mentapp_rate_limit(text,integer) to service_role;
