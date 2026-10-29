// Admin əməliyyatları: istifadəçi yaratma / dəyişmə / silmə
// Service-role açarı YALNIZ burada (Netlify mühit dəyişənində) saxlanılır.

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const DOMAIN = process.env.EMAIL_DOMAIN || 'mekteb.app';
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

const json = (code, obj) => ({
  statusCode: code,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(obj),
});

async function verifyAdmin(token) {
  if (!token) return null;
  const r = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: KEY, Authorization: 'Bearer ' + token },
  });
  if (!r.ok) return null;
  const u = await r.json();
  const p = await fetch(`${SB_URL}/rest/v1/profiles?id=eq.${u.id}&select=role,active`, { headers: H });
  const rows = await p.json();
  if (rows[0] && rows[0].role === 'admin' && rows[0].active) return u;
  return null;
}

const errMsg = (j) => (j && (j.msg || j.message || j.error_description || j.error)) || 'Naməlum xəta';

async function createUser(u) {
  const username = String(u.username || u.utis_code || '').trim().toLowerCase();
  const password = String(u.password || '');
  const role = u.role === 'admin' ? 'admin' : 'school';
  if (!username) return { ok: false, error: 'Login boşdur', username };
  if (!/^[a-z0-9._-]+$/.test(username))
    return { ok: false, error: 'Login yalnız latın hərfi, rəqəm, . _ - ola bilər', username };
  if (password.length < 6) return { ok: false, error: 'Parol ən azı 6 simvol olmalıdır', username };

  const r = await fetch(`${SB_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ email: `${username}@${DOMAIN}`, password, email_confirm: true }),
  });
  const j = await r.json();
  if (!r.ok) return { ok: false, error: errMsg(j), username };

  const pr = await fetch(`${SB_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify({
      id: j.id,
      username,
      role,
      school_name: u.school_name || null,
      utis_code: u.utis_code ? String(u.utis_code).trim() : null,
      director_name: u.director_name || null,
    }),
  });
  if (!pr.ok) {
    await fetch(`${SB_URL}/auth/v1/admin/users/${j.id}`, { method: 'DELETE', headers: H });
    return { ok: false, error: errMsg(await pr.json().catch(() => ({}))), username };
  }
  return { ok: true, id: j.id, username, password };
}

async function updateUser(b) {
  const { id } = b;
  if (!id) return { ok: false, error: 'id yoxdur' };
  const authBody = {};
  if (b.username) {
    const un = String(b.username).trim().toLowerCase();
    if (!/^[a-z0-9._-]+$/.test(un)) return { ok: false, error: 'Login yalnız latın hərfi, rəqəm, . _ - ola bilər' };
    authBody.email = `${un}@${DOMAIN}`;
    authBody.email_confirm = true;
  }
  if (b.password) {
    if (String(b.password).length < 6) return { ok: false, error: 'Parol ən azı 6 simvol olmalıdır' };
    authBody.password = String(b.password);
  }
  if (Object.keys(authBody).length) {
    const r = await fetch(`${SB_URL}/auth/v1/admin/users/${id}`, {
      method: 'PUT', headers: H, body: JSON.stringify(authBody),
    });
    if (!r.ok) return { ok: false, error: errMsg(await r.json().catch(() => ({}))) };
  }
  const patch = {};
  ['school_name', 'utis_code', 'director_name'].forEach((k) => {
    if (b[k] !== undefined) patch[k] = b[k] === '' ? null : String(b[k]).trim();
  });
  if (b.username) patch.username = String(b.username).trim().toLowerCase();
  if (b.role) patch.role = b.role === 'admin' ? 'admin' : 'school';
  if (typeof b.active === 'boolean') patch.active = b.active;
  if (Object.keys(patch).length) {
    const pr = await fetch(`${SB_URL}/rest/v1/profiles?id=eq.${id}`, {
      method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(patch),
    });
    if (!pr.ok) return { ok: false, error: errMsg(await pr.json().catch(() => ({}))) };
  }
  if (typeof b.active === 'boolean') {
    // deaktiv edilən istifadəçinin mövcud sessiyası da işləməsin
    await fetch(`${SB_URL}/auth/v1/admin/users/${id}`, {
      method: 'PUT', headers: H, body: JSON.stringify({ ban_duration: b.active ? 'none' : '876000h' }),
    });
  }
  return { ok: true };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST lazımdır' });
  if (!SB_URL || !KEY) return json(500, { error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY təyin edilməyib' });

  const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '');
  const admin = await verifyAdmin(token);
  if (!admin) return json(403, { error: 'İcazə yoxdur' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Yanlış JSON' }); }

  try {
    if (body.action === 'create') {
      const list = Array.isArray(body.users) ? body.users.slice(0, 25) : [];
      const results = [];
      for (const u of list) results.push(await createUser(u));
      return json(200, { results });
    }
    if (body.action === 'update') {
      return json(200, await updateUser(body));
    }
    if (body.action === 'delete') {
      if (body.id === admin.id) return json(400, { error: 'Özünüzü silə bilməzsiniz' });
      const r = await fetch(`${SB_URL}/auth/v1/admin/users/${body.id}`, { method: 'DELETE', headers: H });
      if (!r.ok) return json(400, { error: errMsg(await r.json().catch(() => ({}))) });
      return json(200, { ok: true });
    }
    return json(400, { error: 'Naməlum əməliyyat' });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
