# Məktəb Məlumat Portalı — quraşdırma

## 1) Supabase
1. supabase.com → New project.
2. SQL Editor → `supabase_schema.sql` faylının məzmununu yapışdırıb Run edin.
3. Authentication → Providers → Email: "Confirm email" söndürülə bilər (istifadəçilər admin tərəfindən yaradılır).
4. Authentication → Users → Add user → Create new user (Auto Confirm ✔):
   - admin1@mekteb.app
   - admin2@mekteb.app
5. SQL faylının sonundakı (şərhdə olan) `insert into public.profiles ... ` sorğusunu şərhdən çıxarıb Run edin.
6. Project Settings → API: **Project URL**, **anon public** və **service_role** açarlarını götürün.

## 2) Kodda 2 dəyər
`public/index.html` faylının əvvəlində:
- SUPABASE_URL
- SUPABASE_ANON_KEY

## 3) Netlify
Qovluğu GitHub-a yükləyin → Netlify → Add new site → Import from Git (build komandası boş, publish `public`).
Və ya CLI: `npm i -g netlify-cli && netlify deploy --prod`.

Site settings → Environment variables:
- SUPABASE_URL = Project URL
- SUPABASE_SERVICE_ROLE_KEY = service_role açarı  (GİZLİ saxlayın, heç yerə yazmayın)

Dəyişəndən sonra yenidən deploy edin.

## 4) İstifadə
1. admin1 / admin2 ilə daxil olun.
2. "Cədvəl formaları" → cədvəl və sütunları qurun.
3. "İstifadəçilər" → "Şablonu yüklə" → 383 məktəb (Məktəb adı, UTİS, Direktor) doldurun → "Excel-dən toplu yüklə".
   Login = UTİS kodu, parol avtomatik yaranır və login-parol Excel-i yüklənir.
4. Yuxarıdakı "Hamısını Excel-ə export et" — bütün cədvəllər bir vərəqdə.
