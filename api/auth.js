import bcrypt from 'bcryptjs';
import {
  ensureSchema,
  sql,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  getAuthUser,
  sendJson
} from './_workspace-db.js';

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const action = req.method === 'GET' ? req.query.action : req.body?.action;

    if (action === 'me') {
      const user = await getAuthUser(req);
      if (!user) return sendJson(res, 200, { user: null });
      return sendJson(res, 200, { user: await userWithTeam(user) });
    }

    if (action === 'login' && req.method === 'POST') {
      const { username, password } = req.body || {};
      if (!username || !password) return sendJson(res, 400, { error: '아이디와 비밀번호를 입력해주세요.' });
      const { rows } = await sql`SELECT * FROM users WHERE username = ${username}`;
      const row = rows[0];
      if (!row) return sendJson(res, 401, { error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
      const ok = await bcrypt.compare(password, row.password_hash);
      if (!ok) return sendJson(res, 401, { error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
      const token = signToken(row);
      setAuthCookie(req, res, token);
      return sendJson(res, 200, { user: await userWithTeam(row) });
    }

    if (action === 'logout' && req.method === 'POST') {
      clearAuthCookie(req, res);
      return sendJson(res, 200, { ok: true });
    }

    if (action === 'bootstrap_admin' && req.method === 'POST') {
      const { key, username, password, name } = req.body || {};
      if (!process.env.SETUP_SECRET || key !== process.env.SETUP_SECRET) {
        return sendJson(res, 403, { error: '설정 키가 올바르지 않습니다.' });
      }
      if (!username || !password || !name) {
        return sendJson(res, 400, { error: '아이디, 비밀번호, 이름을 모두 입력해주세요.' });
      }
      const hash = await bcrypt.hash(password, 10);
      const { rows } = await sql`
        INSERT INTO users (username, password_hash, name, role, team_id)
        VALUES (${username}, ${hash}, ${name}, 'admin', NULL)
        ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin', name = EXCLUDED.name
        RETURNING id, username, name, role, team_id
      `;
      return sendJson(res, 200, { user: rows[0] });
    }

    return sendJson(res, 400, { error: 'Unknown action' });
  } catch (e) {
    return sendJson(res, 500, { error: e.message });
  }
}

async function userWithTeam(user) {
  const { password_hash, ...safeUser } = user;
  if (!user.team_id) return { ...safeUser, team_name: null, division_name: null };
  const { rows } = await sql`
    SELECT t.name AS team_name, d.name AS division_name
    FROM teams t LEFT JOIN divisions d ON d.id = t.division_id
    WHERE t.id = ${user.team_id}
  `;
  return { ...safeUser, team_name: rows[0]?.team_name || null, division_name: rows[0]?.division_name || null };
}
