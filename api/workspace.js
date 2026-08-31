import bcrypt from 'bcryptjs';
import { ensureSchema, sql, getAuthUser, sendJson, canViewTeam } from './_workspace-db.js';

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const action = req.method === 'GET' ? req.query.action : req.body?.action;
    const user = await getAuthUser(req);
    if (!user) return sendJson(res, 401, { error: '로그인이 필요합니다.' });

    const isAdmin = user.role === 'admin';
    const requireAdmin = () => {
      if (!isAdmin) throw httpError(403, '관리자만 사용할 수 있어요.');
    };

    switch (action) {
      // ---- 공용: 공지사항 ----
      case 'list_notices': {
        const { rows } = await sql`
          SELECT p.*, u.name AS author_name FROM posts p
          JOIN users u ON u.id = p.author_id
          WHERE p.type = 'notice' AND p.scope = 'company'
          ORDER BY p.created_at DESC
        `;
        return sendJson(res, 200, { posts: rows });
      }
      case 'create_notice': {
        const { title, content } = req.body || {};
        if (!title) throw httpError(400, '제목을 입력해주세요.');
        const { rows } = await sql`
          INSERT INTO posts (team_id, author_id, type, scope, title, content)
          VALUES (NULL, ${user.id}, 'notice', 'company', ${title}, ${content || ''})
          RETURNING *
        `;
        return sendJson(res, 200, { post: rows[0] });
      }
      case 'delete_notice':
      case 'delete_event': {
        const { id } = req.body || {};
        const { rows } = await sql`SELECT * FROM posts WHERE id = ${id}`;
        const post = rows[0];
        if (!post) throw httpError(404, '게시물을 찾을 수 없어요.');
        if (!isAdmin && post.author_id !== user.id) throw httpError(403, '작성자만 삭제할 수 있어요.');
        await sql`DELETE FROM posts WHERE id = ${id}`;
        return sendJson(res, 200, { ok: true });
      }

      // ---- 공용: 사내 일정 ----
      case 'list_events': {
        const { rows } = await sql`
          SELECT p.*, u.name AS author_name FROM posts p
          JOIN users u ON u.id = p.author_id
          WHERE p.type = 'event' AND p.scope = 'company'
          ORDER BY p.due_date ASC NULLS LAST, p.created_at DESC
        `;
        return sendJson(res, 200, { posts: rows });
      }
      case 'create_event': {
        const { title, content, due_date } = req.body || {};
        if (!title) throw httpError(400, '제목을 입력해주세요.');
        const { rows } = await sql`
          INSERT INTO posts (team_id, author_id, type, scope, title, content, due_date)
          VALUES (NULL, ${user.id}, 'event', 'company', ${title}, ${content || ''}, ${due_date || null})
          RETURNING *
        `;
        return sendJson(res, 200, { post: rows[0] });
      }

      // ---- 팀/본부 목록 ----
      case 'list_teams': {
        const { rows } = await sql`
          SELECT t.id, t.name, t.division_id, d.name AS division_name
          FROM teams t LEFT JOIN divisions d ON d.id = t.division_id
          ORDER BY d.id, t.id
        `;
        return sendJson(res, 200, { teams: rows });
      }
      case 'list_divisions': {
        const { rows } = await sql`SELECT * FROM divisions ORDER BY id`;
        return sendJson(res, 200, { divisions: rows });
      }

      // ---- 팀 게시판 (업무일지 / 할일) ----
      case 'list_posts': {
        const teamId = Number(req.query.team_id);
        const type = req.query.type;
        if (!teamId || !['log', 'task'].includes(type)) throw httpError(400, '잘못된 요청이에요.');
        if (!(await canViewTeam(user, teamId))) throw httpError(403, '이 팀 게시판을 볼 수 있는 권한이 없어요.');
        const { rows } = await sql`
          SELECT p.*, u.name AS author_name FROM posts p
          JOIN users u ON u.id = p.author_id
          WHERE p.team_id = ${teamId} AND p.type = ${type}
          ORDER BY p.created_at DESC
        `;
        return sendJson(res, 200, { posts: rows });
      }
      case 'create_post': {
        const { team_id, type, title, content, due_date } = req.body || {};
        const teamId = Number(team_id);
        if (!teamId || !['log', 'task'].includes(type) || !title) throw httpError(400, '잘못된 요청이에요.');
        if (!(await canViewTeam(user, teamId))) throw httpError(403, '이 팀 게시판에 글을 쓸 권한이 없어요.');
        const { rows } = await sql`
          INSERT INTO posts (team_id, author_id, type, scope, title, content, due_date, status)
          VALUES (${teamId}, ${user.id}, ${type}, 'team', ${title}, ${content || ''}, ${due_date || null}, 'open')
          RETURNING *
        `;
        return sendJson(res, 200, { post: rows[0] });
      }
      case 'update_post_status': {
        const { id, status } = req.body || {};
        if (!['open', 'done'].includes(status)) throw httpError(400, '잘못된 상태예요.');
        const { rows } = await sql`SELECT * FROM posts WHERE id = ${id}`;
        const post = rows[0];
        if (!post) throw httpError(404, '게시물을 찾을 수 없어요.');
        if (!isAdmin && post.author_id !== user.id && post.team_id !== user.team_id) {
          throw httpError(403, '이 게시물을 수정할 권한이 없어요.');
        }
        const { rows: updated } = await sql`
          UPDATE posts SET status = ${status}, updated_at = now() WHERE id = ${id} RETURNING *
        `;
        return sendJson(res, 200, { post: updated[0] });
      }
      case 'delete_post': {
        const { id } = req.body || {};
        const { rows } = await sql`SELECT * FROM posts WHERE id = ${id}`;
        const post = rows[0];
        if (!post) throw httpError(404, '게시물을 찾을 수 없어요.');
        if (!isAdmin && post.author_id !== user.id && post.team_id !== user.team_id) {
          throw httpError(403, '이 게시물을 삭제할 권한이 없어요.');
        }
        await sql`DELETE FROM posts WHERE id = ${id}`;
        return sendJson(res, 200, { ok: true });
      }

      // ---- 바쁜 업무 기간 (읽기: 전원, 쓰기: 관리자) ----
      case 'list_busy': {
        const { rows } = await sql`
          SELECT b.*, t.name AS team_name FROM busy_periods b
          JOIN teams t ON t.id = b.team_id
          ORDER BY b.start_date DESC
        `;
        return sendJson(res, 200, { busy_periods: rows });
      }
      case 'upsert_busy': {
        requireAdmin();
        const { id, team_id, title, start_date, end_date, repeat_monthly, note } = req.body || {};
        if (!team_id || !title || !start_date || !end_date) throw httpError(400, '필수 항목을 입력해주세요.');
        if (id) {
          const { rows } = await sql`
            UPDATE busy_periods SET team_id = ${team_id}, title = ${title}, start_date = ${start_date},
              end_date = ${end_date}, repeat_monthly = ${!!repeat_monthly}, note = ${note || ''}
            WHERE id = ${id} RETURNING *
          `;
          return sendJson(res, 200, { busy_period: rows[0] });
        }
        const { rows } = await sql`
          INSERT INTO busy_periods (team_id, title, start_date, end_date, repeat_monthly, note, created_by)
          VALUES (${team_id}, ${title}, ${start_date}, ${end_date}, ${!!repeat_monthly}, ${note || ''}, ${user.id})
          RETURNING *
        `;
        return sendJson(res, 200, { busy_period: rows[0] });
      }
      case 'delete_busy': {
        requireAdmin();
        const { id } = req.body || {};
        await sql`DELETE FROM busy_periods WHERE id = ${id}`;
        return sendJson(res, 200, { ok: true });
      }

      // ---- 관리자: 계정 관리 ----
      case 'list_users': {
        requireAdmin();
        const { rows } = await sql`
          SELECT u.id, u.username, u.name, u.role, u.team_id, t.name AS team_name
          FROM users u LEFT JOIN teams t ON t.id = u.team_id
          ORDER BY u.id
        `;
        return sendJson(res, 200, { users: rows });
      }
      case 'create_user': {
        requireAdmin();
        const { username, password, name, team_id, role } = req.body || {};
        if (!username || !password || !name) throw httpError(400, '필수 항목을 입력해주세요.');
        const hash = await bcrypt.hash(password, 10);
        const { rows } = await sql`
          INSERT INTO users (username, password_hash, name, team_id, role)
          VALUES (${username}, ${hash}, ${name}, ${team_id || null}, ${role === 'admin' ? 'admin' : 'member'})
          RETURNING id, username, name, role, team_id
        `;
        return sendJson(res, 200, { user: rows[0] });
      }
      case 'update_user': {
        requireAdmin();
        const { id, name, team_id, role } = req.body || {};
        const { rows: existingRows } = await sql`SELECT * FROM users WHERE id = ${id}`;
        const existing = existingRows[0];
        if (!existing) throw httpError(404, '사용자를 찾을 수 없어요.');
        const nextName = name !== undefined ? name : existing.name;
        const nextTeamId = team_id !== undefined ? (team_id || null) : existing.team_id;
        const nextRole = role !== undefined ? role : existing.role;
        const { rows } = await sql`
          UPDATE users SET name = ${nextName}, team_id = ${nextTeamId}, role = ${nextRole}
          WHERE id = ${id}
          RETURNING id, username, name, role, team_id
        `;
        return sendJson(res, 200, { user: rows[0] });
      }
      case 'reset_password': {
        requireAdmin();
        const { id, password } = req.body || {};
        if (!password) throw httpError(400, '새 비밀번호를 입력해주세요.');
        const hash = await bcrypt.hash(password, 10);
        await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${id}`;
        return sendJson(res, 200, { ok: true });
      }
      case 'delete_user': {
        requireAdmin();
        const { id } = req.body || {};
        if (Number(id) === user.id) throw httpError(400, '본인 계정은 삭제할 수 없어요.');
        await sql`DELETE FROM users WHERE id = ${id}`;
        return sendJson(res, 200, { ok: true });
      }

      // ---- 관리자: 팀/본부 관리 ----
      case 'create_team': {
        requireAdmin();
        const { name, division_id } = req.body || {};
        if (!name || !division_id) throw httpError(400, '필수 항목을 입력해주세요.');
        const { rows } = await sql`
          INSERT INTO teams (name, division_id) VALUES (${name}, ${division_id})
          ON CONFLICT (name, division_id) DO NOTHING RETURNING *
        `;
        return sendJson(res, 200, { team: rows[0] || null });
      }
      case 'create_division': {
        requireAdmin();
        const { name } = req.body || {};
        if (!name) throw httpError(400, '이름을 입력해주세요.');
        const { rows } = await sql`
          INSERT INTO divisions (name) VALUES (${name})
          ON CONFLICT (name) DO NOTHING RETURNING *
        `;
        return sendJson(res, 200, { division: rows[0] || null });
      }

      // ---- 관리자: 팀별 열람 권한 ----
      case 'list_grants': {
        requireAdmin();
        const { rows } = await sql`
          SELECT g.id, g.viewer_team_id, g.target_team_id,
            vt.name AS viewer_team_name, tt.name AS target_team_name
          FROM visibility_grants g
          JOIN teams vt ON vt.id = g.viewer_team_id
          JOIN teams tt ON tt.id = g.target_team_id
          ORDER BY g.id
        `;
        return sendJson(res, 200, { grants: rows });
      }
      case 'add_grant': {
        requireAdmin();
        const { viewer_team_id, target_team_id } = req.body || {};
        if (!viewer_team_id || !target_team_id) throw httpError(400, '팀을 선택해주세요.');
        if (Number(viewer_team_id) === Number(target_team_id)) throw httpError(400, '같은 팀은 선택할 수 없어요.');
        const { rows } = await sql`
          INSERT INTO visibility_grants (viewer_team_id, target_team_id)
          VALUES (${viewer_team_id}, ${target_team_id})
          ON CONFLICT (viewer_team_id, target_team_id) DO NOTHING RETURNING *
        `;
        return sendJson(res, 200, { grant: rows[0] || null });
      }
      case 'remove_grant': {
        requireAdmin();
        const { id } = req.body || {};
        await sql`DELETE FROM visibility_grants WHERE id = ${id}`;
        return sendJson(res, 200, { ok: true });
      }

      // ---- 관리자: 전체 게시글 모니터링 ----
      case 'admin_list_all_posts': {
        requireAdmin();
        const { rows } = await sql`
          SELECT p.*, u.name AS author_name, t.name AS team_name FROM posts p
          JOIN users u ON u.id = p.author_id
          LEFT JOIN teams t ON t.id = p.team_id
          WHERE p.scope = 'team'
          ORDER BY p.created_at DESC
          LIMIT 300
        `;
        return sendJson(res, 200, { posts: rows });
      }

      default:
        return sendJson(res, 400, { error: 'Unknown action' });
    }
  } catch (e) {
    const status = e.status || 500;
    return sendJson(res, status, { error: e.message });
  }
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
