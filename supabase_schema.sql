-- =====================================================================
-- MƏKTƏB MƏLUMAT PORTALI — Supabase SQL
-- Supabase > SQL Editor > New query > hamısını yapışdırın > Run
-- =====================================================================

-- 1) İSTİFADƏÇİ PROFİLLƏRİ (hər məktəb direktoru + 2 admin)
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null,
  role          text not null default 'school' check (role in ('admin','school')),
  school_name   text,
  utis_code     text,
  director_name text,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists profiles_role_idx on public.profiles(role);

-- 2) CƏDVƏL FORMALARI (admin qurur)
create table if not exists public.forms (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  multi_row   boolean not null default true,   -- true: məktəb bir neçə sətir doldura bilər
  is_open     boolean not null default true,   -- false: doldurma bağlıdır
  position    int not null default 0,
  created_at  timestamptz not null default now()
);

-- 3) FORMANIN SÜTUNLARI
create table if not exists public.form_fields (
  id         uuid primary key default gen_random_uuid(),
  form_id    uuid not null references public.forms(id) on delete cascade,
  label      text not null,
  field_type text not null default 'text' check (field_type in ('text','number','date','select','textarea')),
  options    text[] not null default '{}',
  required   boolean not null default false,
  position   int not null default 0
);
create index if not exists form_fields_form_idx on public.form_fields(form_id);

-- 4) MƏKTƏBLƏRİN DOLDURDUĞU SƏTİRLƏR
create table if not exists public.submissions (
  id         uuid primary key default gen_random_uuid(),
  form_id    uuid not null references public.forms(id) on delete cascade,
  school_id  uuid not null references public.profiles(id) on delete cascade,
  row_no     int not null default 0,
  data       jsonb not null default '{}'::jsonb,   -- { "<field_id>": "dəyər" }
  updated_at timestamptz not null default now()
);
create index if not exists submissions_form_idx   on public.submissions(form_id);
create index if not exists submissions_school_idx on public.submissions(school_id);

-- 5) KÖMƏKÇİ FUNKSİYALAR
create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'admin' and active)
$$;

create or replace function public.is_active() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and active)
$$;

create or replace function public.form_is_open(fid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce((select is_open from public.forms where id = fid), false)
$$;

-- 6) SƏTİR SƏVİYYƏSİNDƏ TƏHLÜKƏSİZLİK (RLS)
alter table public.profiles    enable row level security;
alter table public.forms       enable row level security;
alter table public.form_fields enable row level security;
alter table public.submissions enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- forms
drop policy if exists forms_select on public.forms;
create policy forms_select on public.forms for select to authenticated
  using (public.is_active());
drop policy if exists forms_admin_all on public.forms;
create policy forms_admin_all on public.forms for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- form_fields
drop policy if exists fields_select on public.form_fields;
create policy fields_select on public.form_fields for select to authenticated
  using (public.is_active());
drop policy if exists fields_admin_all on public.form_fields;
create policy fields_admin_all on public.form_fields for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- submissions: məktəb yalnız öz sətirlərini görür/dəyişir (forma açıqdırsa)
drop policy if exists sub_school_select on public.submissions;
create policy sub_school_select on public.submissions for select to authenticated
  using (school_id = auth.uid() and public.is_active());
drop policy if exists sub_school_insert on public.submissions;
create policy sub_school_insert on public.submissions for insert to authenticated
  with check (school_id = auth.uid() and public.is_active() and public.form_is_open(form_id));
drop policy if exists sub_school_update on public.submissions;
create policy sub_school_update on public.submissions for update to authenticated
  using (school_id = auth.uid() and public.is_active() and public.form_is_open(form_id))
  with check (school_id = auth.uid() and public.is_active() and public.form_is_open(form_id));
drop policy if exists sub_school_delete on public.submissions;
create policy sub_school_delete on public.submissions for delete to authenticated
  using (school_id = auth.uid() and public.is_active() and public.form_is_open(form_id));
drop policy if exists sub_admin_all on public.submissions;
create policy sub_admin_all on public.submissions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- 7) İLK 2 ADMİNİ YARATMAQ
-- a) Supabase > Authentication > Users > Add user > "Create new user"
--    Email: admin1@mekteb.app   Parol: (özünüz seçin)   ✔ Auto Confirm User
--    Email: admin2@mekteb.app   Parol: (özünüz seçin)   ✔ Auto Confirm User
-- b) Sonra aşağıdakı sətri ayrıca işə salın:
--
-- insert into public.profiles (id, username, role, school_name)
-- select id, split_part(email,'@',1), 'admin', 'Administrator'
-- from auth.users
-- where email in ('admin1@mekteb.app','admin2@mekteb.app');
--
-- Login səhifəsində istifadəçi adı: admin1  /  admin2
-- (Digər 383 istifadəçini admin paneldən Excel ilə toplu yükləyəcəksiniz.)
-- =====================================================================
