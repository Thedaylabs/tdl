const API_AUTH = '/api/auth';
const API_WS = '/api/workspace';
const WS_BASE = '/사내워크스페이스';

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin'
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '요청에 실패했어요.');
  return data;
}

async function requireAuth() {
  try {
    const { user } = await fetchJSON(`${API_AUTH}?action=me`);
    if (!user) { location.href = `${WS_BASE}/login.html`; return null; }
    return user;
  } catch {
    location.href = `${WS_BASE}/login.html`;
    return null;
  }
}

function renderNav(user, active, teams) {
  const myTeam = teams ? teams.find(t => t.id === user.team_id) : null;
  const links = [
    { href: `${WS_BASE}/index.html`, label: '홈', key: 'home' }
  ];
  if (user.team_id) links.push({ href: `${WS_BASE}/team.html?team=${user.team_id}`, label: '내 팀 게시판', key: 'myteam' });
  if (user.role === 'admin') links.push({ href: `${WS_BASE}/admin.html`, label: '관리자', key: 'admin' });

  const linksHtml = links.map(l =>
    `<a class="nav-link${l.key === active ? ' active' : ''}" href="${l.href}">${l.label}</a>`
  ).join('');

  document.getElementById('navbar').innerHTML = `
    <div class="nav-left">
      <div class="nav-brand">더데이랩스 워크스페이스</div>
      <div class="nav-links">${linksHtml}</div>
    </div>
    <div class="nav-right">
      <span class="nav-user-name">${escapeHtml(user.name)}</span>
      <span class="nav-user-team">${escapeHtml(myTeam ? myTeam.name : (user.role === 'admin' ? '관리자' : '미배정'))}</span>
      <button class="btn btn-sm btn-ghost" id="logoutBtn">로그아웃</button>
    </div>
  `;
  document.getElementById('logoutBtn').onclick = async () => {
    await fetchJSON(`${API_AUTH}?action=logout`, { method: 'POST', body: { action: 'logout' } });
    location.href = `${WS_BASE}/login.html`;
  };
}

// ---- 바쁜 기간 계산 ----
function dayOfMonth(dateStr) { return Number(dateStr.slice(8, 10)); }

function isBusyOn(period, date) {
  const d = new Date(date);
  if (period.repeat_monthly) {
    const startDay = dayOfMonth(period.start_date);
    const endDay = dayOfMonth(period.end_date);
    const today = d.getDate();
    if (startDay <= endDay) return today >= startDay && today <= endDay;
    return today >= startDay || today <= endDay;
  }
  const ymd = d.toISOString().slice(0, 10);
  return ymd >= period.start_date.slice(0, 10) && ymd <= period.end_date.slice(0, 10);
}

function findBusyToday(busyPeriods, teamId) {
  const today = new Date();
  return (busyPeriods || []).find(p => p.team_id === teamId && isBusyOn(p, today)) || null;
}

// ---- 모달 ----
function closeModal() {
  const el = document.getElementById('modalRoot');
  if (el) el.remove();
}

function showModal(innerHtml) {
  closeModal();
  const root = document.createElement('div');
  root.id = 'modalRoot';
  root.className = 'modal-overlay';
  root.innerHTML = `<div class="modal" style="max-width:480px;">${innerHtml}</div>`;
  document.body.appendChild(root);
  root.addEventListener('click', e => { if (e.target === root) closeModal(); });
}

function confirmModal({ title, body, confirmText = '등록', cancelText = '취소', danger = false }) {
  return new Promise(resolve => {
    closeModal();
    const root = document.createElement('div');
    root.id = 'modalRoot';
    root.className = 'modal-overlay';
    root.innerHTML = `
      <div class="modal">
        <div class="modal-icon">⏰</div>
        <div class="modal-title">${escapeHtml(title)}</div>
        <div class="modal-body">${body}</div>
        <div class="modal-actions">
          <button class="btn" id="modalCancel">${escapeHtml(cancelText)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="modalConfirm">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(root);
    root.addEventListener('click', e => { if (e.target === root) { closeModal(); resolve(false); } });
    document.getElementById('modalCancel').onclick = () => { closeModal(); resolve(false); };
    document.getElementById('modalConfirm').onclick = () => { closeModal(); resolve(true); };
  });
}

function toast(msg, kind = 'info') {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  const el = document.createElement('div');
  el.className = `toast${kind === 'error' ? ' error' : ''}`;
  el.textContent = msg;
  wrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 200);
  }, 2600);
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function fmtDate(str) {
  if (!str) return '';
  return str.slice(0, 10);
}

function fmtDateTime(str) {
  if (!str) return '';
  const d = new Date(str);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
