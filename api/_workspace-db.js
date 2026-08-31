import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const connectionString =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL_UNPOOLED;

const rawSql = neon(connectionString);

// neon()'s tag function resolves to a plain rows array; wrap it so the
// rest of the codebase can keep using the familiar `{ rows }` shape.
const sql = async (strings, ...values) => {
  const rows = await rawSql(strings, ...values);
  return { rows };
};

const TEAM_SEED = [
  { division: '클리닉사업본부', teams: ['국내사업팀', '디자인팀'] },
  { division: '글로벌비즈니스본부', teams: ['해외사업팀'] },
  { division: '신사업본부', teams: ['연구개발팀', '상품유통팀'] },
  { division: '경영관리본부', teams: ['경영관리팀', '임원비서'] }
];

let schemaReady = null;

export function ensureSchema() {
  if (!schemaReady) schemaReady = initSchema();
  return schemaReady;
}

async function initSchema() {
  await sql`CREATE TABLE IF NOT EXISTS divisions (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    division_id INTEGER REFERENCES divisions(id),
    UNIQUE(name, division_id)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    team_id INTEGER REFERENCES teams(id),
    role TEXT NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id),
    author_id INTEGER REFERENCES users(id),
    type TEXT NOT NULL,
    scope TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    due_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS visibility_grants (
    id SERIAL PRIMARY KEY,
    viewer_team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    target_team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE(viewer_team_id, target_team_id)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS busy_periods (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    repeat_monthly BOOLEAN NOT NULL DEFAULT false,
    note TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  const { rows: existingTeams } = await sql`SELECT id FROM teams LIMIT 1`;
  if (existingTeams.length === 0) {
    for (const group of TEAM_SEED) {
      const { rows } = await sql`
        INSERT INTO divisions (name) VALUES (${group.division})
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `;
      const divisionId = rows[0].id;
      for (const teamName of group.teams) {
        await sql`
          INSERT INTO teams (name, division_id) VALUES (${teamName}, ${divisionId})
          ON CONFLICT (name, division_id) DO NOTHING
        `;
      }
    }
  }
}

export function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var is not set');
  return jwt.sign({ uid: user.id }, secret, { expiresIn: '30d' });
}

export function verifyToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

export function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}

export function setAuthCookie(req, res, token) {
  const isLocal = (req.headers.host || '').includes('localhost');
  const parts = [
    `ws_token=${token}`,
    'HttpOnly',
    'Path=/',
    'Max-Age=2592000',
    'SameSite=Lax'
  ];
  if (!isLocal) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearAuthCookie(req, res) {
  const isLocal = (req.headers.host || '').includes('localhost');
  const parts = ['ws_token=', 'HttpOnly', 'Path=/', 'Max-Age=0', 'SameSite=Lax'];
  if (!isLocal) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export async function getAuthUser(req) {
  const cookies = parseCookies(req);
  const token = cookies.ws_token;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || !payload.uid) return null;
  const { rows } = await sql`
    SELECT id, username, name, role, team_id FROM users WHERE id = ${payload.uid}
  `;
  return rows[0] || null;
}

export function sendJson(res, status, obj) {
  res.status(status).json(obj);
}

export async function canViewTeam(user, teamId) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.team_id === teamId) return true;
  const { rows } = await sql`
    SELECT 1 FROM visibility_grants WHERE viewer_team_id = ${user.team_id} AND target_team_id = ${teamId}
  `;
  return rows.length > 0;
}

export { sql };
