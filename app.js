'use strict';

const DATA_URL = 'prisoners.json';
const REFRESH_MS = 5 * 60 * 1000;   // 每 5 分鐘重新讀取名單
const CELL_CAP = 12;                // 每間牢房最多 12 人
const TZ = 'Asia/Taipei';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const state = { data: null, query: '', inmates: [] };

/* ---------------- 時間格式 ---------------- */
const fmtFull = new Intl.DateTimeFormat('zh-TW', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const fmtShort = new Intl.DateTimeFormat('zh-TW', { timeZone: TZ, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const nowS = () => Date.now() / 1000;
const fmt = s => fmtFull.format(new Date(s * 1000));
const fmtS = s => fmtShort.format(new Date(s * 1000));
const pad = n => String(n).padStart(2, '0');

function remainText(sec) {
  if (sec <= 0) return '刑期已滿';
  sec = Math.floor(sec);
  const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return (d ? `${d} 天 ` : '') + `${pad(h)}:${pad(m)}:${pad(s)}`;
}
function shortRemain(sec) {
  if (sec <= 0) return '出獄中';
  if (sec < 3600) return `${Math.ceil(sec / 60)} 分`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} 小時`;
  return `${Math.floor(sec / 86400)} 天`;
}
function agoText(sec) {
  const d = nowS() - sec;
  if (d < 3600) return `${Math.max(1, Math.floor(d / 60))} 分鐘前`;
  if (d < 86400) return `${Math.floor(d / 3600)} 小時前`;
  return `${Math.floor(d / 86400)} 天前`;
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- 小人產生器（同一帳號永遠長一樣） ---------------- */
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (const ch of s.toLowerCase()) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const SKINS = ['#FFE3C8', '#F9D1A8', '#EDB98A', '#D69A6A', '#B5713F', '#8D5524'];
const HAIRS = ['#2B1B12', '#4A2F1B', '#7A4B2A', '#C58C4B', '#E8C27A', '#9AA0A6', '#D9534F', '#6C5CE7', '#00B894', '#FD79A8'];
const SUITS = [
  { a: '#FF9248', b: '#F57C2B' },  // 橘色囚服
  { a: '#FFFFFF', b: '#2D3436' },  // 黑白條紋
  { a: '#FFFFFF', b: '#2D3436' },
  { a: '#9ED4FF', b: '#3A8DDE' },
  { a: '#FFE08A', b: '#F0A04B' },
  { a: '#FFC2DC', b: '#E8649A' },
  { a: '#A6F0D4', b: '#2FB58A' },
];
const CASUAL = ['#FFFFFF', '#A29BFE', '#81ECEC', '#FAB1A0', '#FFEAA7', '#55EFC4', '#74B9FF'];
let svgSeq = 0;

function avatarSVG(user, mode = 'prisoner') {
  const h = hashStr(user), r = mulberry32(h);
  const pick = a => a[Math.floor(r() * a.length)];
  const skin = pick(SKINS), hair = pick(HAIRS), suit = pick(SUITS), casual = pick(CASUAL);
  const hairStyle = Math.floor(r() * 5), eyeStyle = Math.floor(r() * 3), mouthStyle = Math.floor(r() * 4), acc = Math.floor(r() * 7);
  const id = `s${h.toString(36)}_${++svgSeq}`;
  const free = mode === 'free';
  const top = free ? casual : `url(#${id})`;
  const pants = free ? '#4A69BD' : suit.b;
  const num = String(h % 10000).padStart(4, '0');
  const ink = '#2D3436';

  const hairs = [
    `<path d="M15 27 C14 11 50 11 49 27 C45 19 40 17 32 17 C24 17 19 19 15 27Z" fill="${hair}"/>`,
    `<path d="M15 25 L17 12 L23 17 L27 8 L32 15 L37 8 L41 17 L47 12 L49 25 C44 18 20 18 15 25Z" fill="${hair}"/>`,
    `<path d="M14 31 C11 9 53 9 50 31 L50 39 C47 30 47 22 32 20 C17 22 17 30 14 39Z" fill="${hair}"/>`,
    `<path d="M29 12 C29 5 37 6 34 12 C39 9 41 13 36 14 Z" fill="${hair}"/>`,
    `<circle cx="32" cy="9" r="6" fill="${hair}"/><path d="M15 26 C14 12 50 12 49 26 C44 18 20 18 15 26Z" fill="${hair}"/>`,
  ];
  const eyes = [
    `<circle cx="25.5" cy="29" r="2.4" fill="${ink}"/><circle cx="38.5" cy="29" r="2.4" fill="${ink}"/><circle cx="26.3" cy="28.2" r=".8" fill="#fff"/><circle cx="39.3" cy="28.2" r=".8" fill="#fff"/>`,
    `<path d="M23 30 Q25.5 27 28 30 M36 30 Q38.5 27 41 30" stroke="${ink}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    `<ellipse cx="25.5" cy="29" rx="3" ry="3.6" fill="${ink}"/><ellipse cx="38.5" cy="29" rx="3" ry="3.6" fill="${ink}"/><circle cx="26.5" cy="27.6" r="1.2" fill="#fff"/><circle cx="39.5" cy="27.6" r="1.2" fill="#fff"/>`,
  ];
  const mouths = [
    `<path d="M29 36 Q32 39.5 35 36" stroke="${ink}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
    `<path d="M29.5 37 H34.5" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>`,
    `<ellipse cx="32" cy="37.5" rx="1.8" ry="2.2" fill="${ink}"/>`,
    `<path d="M29 38.5 Q32 35.5 35 38.5" stroke="${ink}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  ];
  const accs = [
    '',
    `<g stroke="${ink}" stroke-width="1.3" fill="rgba(255,255,255,.3)"><circle cx="25.5" cy="29" r="4.3"/><circle cx="38.5" cy="29" r="4.3"/><path d="M29.8 29 H34.2"/></g>`,
    free ? '' : `<path d="M15 23 C15 7 49 7 49 23 Z" fill="url(#${id})"/><rect x="14" y="21" width="36" height="5" rx="2.5" fill="${suit.b}"/>`,
    `<g transform="rotate(-20 42 23)"><rect x="38" y="21.5" width="9" height="3.4" rx="1" fill="#FFEAA7" stroke="#E0C068" stroke-width=".5"/></g>`,
    `<path d="M27 34.6 Q29.5 32.6 32 34.6 Q34.5 32.6 37 34.6 Q34.5 35.9 32 35.1 Q29.5 35.9 27 34.6Z" fill="${hair}"/>`,
    `<path d="M46 19 Q48.5 23.5 46 25 Q43.5 23.5 46 19Z" fill="#74B9FF"/>`,
    '',
  ];
  const arms = free
    ? `<rect x="10" y="30" width="8" height="19" rx="4" fill="${top}" transform="rotate(-18 16 47)"/><rect x="46" y="30" width="8" height="19" rx="4" fill="${top}" transform="rotate(18 48 47)"/><circle cx="10" cy="30" r="3.8" fill="${skin}"/><circle cx="54" cy="30" r="3.8" fill="${skin}"/>`
    : `<rect x="12" y="45" width="8" height="18" rx="4" fill="${top}" transform="rotate(12 16 46)"/><rect x="44" y="45" width="8" height="18" rx="4" fill="${top}" transform="rotate(-12 48 46)"/><circle cx="12.5" cy="63" r="3.6" fill="${skin}"/><circle cx="51.5" cy="63" r="3.6" fill="${skin}"/>`;
  const chest = free
    ? `<path d="M32 59 l-4.2-4.2 a2.5 2.5 0 0 1 4.2-3.1 a2.5 2.5 0 0 1 4.2 3.1z" fill="#FF7675"/>`
    : `<rect x="24.5" y="50" width="15" height="7.5" rx="1.5" fill="#fff" stroke="${ink}" stroke-width=".6"/><text x="32" y="55.8" font-size="5.2" text-anchor="middle" font-family="monospace" font-weight="700" fill="${ink}">${num}</text>`;
  const chain = mode === 'lifer'
    ? `<path d="M40 76 Q48 82 53 77" stroke="#636E72" stroke-width="1.4" fill="none" stroke-dasharray="2 1.2"/><circle cx="56" cy="76" r="5.5" fill="${ink}"/><circle cx="54.2" cy="74.2" r="1.5" fill="#636E72"/>`
    : '';
  const mouth = free ? `<path d="M28 35.5 Q32 41.5 36 35.5 Z" fill="${ink}"/>` : mouths[mouthStyle];

  return `<svg viewBox="0 0 64 84" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<defs><pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${suit.a}"/><rect y="3" width="6" height="3" fill="${suit.b}"/></pattern></defs>
<ellipse cx="32" cy="81" rx="17" ry="3" fill="rgba(0,0,0,.16)"/>
<rect x="22" y="63" width="8" height="14" rx="3" fill="${pants}"/><rect x="34" y="63" width="8" height="14" rx="3" fill="${pants}"/>
<ellipse cx="25.5" cy="77.5" rx="5" ry="2.6" fill="${ink}"/><ellipse cx="38.5" cy="77.5" rx="5" ry="2.6" fill="${ink}"/>
${chain}${arms}
<rect x="18" y="43" width="28" height="25" rx="9" fill="${top}"/>${chest}
<circle cx="15.5" cy="29" r="3.2" fill="${skin}"/><circle cx="48.5" cy="29" r="3.2" fill="${skin}"/>
<circle cx="32" cy="28" r="17" fill="${skin}"/>
${hairs[hairStyle]}${eyes[eyeStyle]}
<ellipse cx="21.5" cy="34" rx="2.6" ry="1.6" fill="#FF7675" opacity=".5"/><ellipse cx="42.5" cy="34" rx="2.6" ry="1.6" fill="#FF7675" opacity=".5"/>
${mouth}${accs[acc]}
</svg>`;
}

/* ---------------- 監獄 ---------------- */
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const modeOf = p => (p.lifetime ? 'lifer' : 'prisoner');

function sorted() {
  const ps = state.data.prisoners;
  return {
    normal: ps.filter(p => !p.lifetime).sort((a, b) => a.end - b.end),
    lifers: ps.filter(p => p.lifetime).sort((a, b) => a.start - b.start),
  };
}

function renderJail() {
  const jail = $('#jail');
  jail.innerHTML = '';
  state.inmates = [];
  const { normal, lifers } = sorted();
  if (!normal.length && !lifers.length) {
    jail.innerHTML = '<div class="empty">🎉 監獄目前空無一人，大家都很乖！</div>';
    return;
  }
  chunk(normal, CELL_CAP).forEach((grp, i) => {
    const a = shortRemain(grp[0].end - nowS()), b = shortRemain(grp[grp.length - 1].end - nowS());
    const info = a === b ? `約 ${a}後出獄` : `${a} ～ ${b}後出獄`;
    jail.appendChild(makeCell(`第 ${i + 1} 房`, info, grp, i === 0 ? 'first' : ''));
  });
  chunk(lifers, CELL_CAP).forEach((grp, i) => {
    const name = lifers.length > CELL_CAP ? `終身監禁區 ${i + 1}` : '終身監禁區';
    jail.appendChild(makeCell(name, `${grp.length} 人・無期徒刑`, grp, 'lifer'));
  });
}

function makeCell(name, info, grp, cls) {
  const cell = document.createElement('div');
  cell.className = `cell ${cls}`;
  cell.innerHTML = `<div class="cell-head"><span class="cell-no">${esc(name)}</span><span class="cell-info">${esc(info)}</span></div>
    <div class="floor"></div><div class="bars"></div>${cls === 'first' ? '<div class="door" title="離出口最近">🚪<span>出口</span></div>' : ''}`;
  const floor = $('.floor', cell);
  grp.forEach(p => floor.appendChild(makeInmate(p)));
  return cell;
}

function makeInmate(p) {
  const el = document.createElement('div');
  el.className = 'inmate';
  el.dataset.user = p.user.toLowerCase();
  const timer = p.lifetime ? '∞' : shortRemain(p.end - nowS());
  el.innerHTML = `<div class="tag">${esc(p.user)}</div><div class="sprite">${avatarSVG(p.user, modeOf(p))}</div>
    <div class="timer" ${p.lifetime ? '' : `data-short-end="${p.end}"`}>${timer}</div>`;
  place(el, Math.random() * 78, Math.random() * 50);
  el.style.transitionDuration = '0s';
  el.addEventListener('click', () => openModal(p));
  state.inmates.push({ el, next: Date.now() + 500 + Math.random() * 3000 });
  return el;
}

function place(el, x, y) {
  el.style.left = `${x}%`;
  el.style.top = `${y}px`;
  el.style.zIndex = String(10 + Math.round(y));
}

function wander() {
  const t = Date.now();
  for (const m of state.inmates) {
    if (t < m.next) continue;
    const el = m.el, floor = el.parentElement;
    if (!floor || !floor.clientWidth) continue;
    const maxX = Math.max(0, 100 - (58 / floor.clientWidth) * 100);
    const curX = parseFloat(el.style.left) || 0;
    const nx = Math.max(0, Math.min(maxX, curX + (Math.random() - 0.5) * 55));
    const ny = Math.random() * 50;
    const dur = 1.2 + Math.abs(nx - curX) / 16;
    el.style.transitionDuration = `${dur}s`;
    el.classList.toggle('flip', nx < curX);
    el.classList.add('walking');
    place(el, nx, ny);
    clearTimeout(m.stop);
    m.stop = setTimeout(() => el.classList.remove('walking'), dur * 1000);
    m.next = t + dur * 1000 + 1500 + Math.random() * 5000;
  }
}

/* ---------------- 自由廣場 ---------------- */
function renderYard() {
  const yard = $('#yard');
  const rs = state.data.released || [];
  if (!rs.length) { yard.innerHTML = '<div class="yard-empty">最近 3 天沒有人出獄 🍃</div>'; return; }
  yard.innerHTML = '';
  rs.forEach(p => {
    const el = document.createElement('div');
    el.className = 'freeman';
    el.dataset.user = p.user.toLowerCase();
    el.innerHTML = `<div class="tag">${esc(p.user)}</div><div class="sprite">${avatarSVG(p.user, 'free')}</div><small>出獄 ${agoText(p.released_at)}</small>`;
    el.addEventListener('click', () => openFreeModal(p));
    yard.appendChild(el);
  });
}

/* ---------------- 排行榜 ---------------- */
function renderBoard() {
  const { normal, lifers } = sorted();
  const all = [...normal, ...lifers];
  const ol = $('#leaderboard');
  ol.innerHTML = all.map((p, i) => {
    const left = p.lifetime ? Infinity : p.end - nowS();
    const cls = ['row', p.lifetime ? 'life' : '', left < 86400 ? 'soon' : ''].join(' ');
    return `<li class="${cls}" data-i="${i}" data-user="${esc(p.user.toLowerCase())}">
      <span class="rank">${p.lifetime ? '∞' : i + 1}</span>
      <span class="mini">${avatarSVG(p.user, modeOf(p))}</span>
      <span class="who"><b>${esc(p.user)}</b><small>${p.lifetime ? '無期徒刑' : `${fmtS(p.end)} 出獄・刑期 ${p.days} 天`}</small></span>
      <span class="cd" ${p.lifetime ? '' : `data-end="${p.end}"`}>${p.lifetime ? '無期' : remainText(left)}</span></li>`;
  }).join('') || '<li class="row"><span></span><span></span><span class="who">目前沒有人</span></li>';
  $$('.row[data-i]', ol).forEach(li => li.addEventListener('click', () => {
    const p = all[+li.dataset.i];
    openModal(p);
    focusInmate(p.user);
  }));
}

function focusInmate(user) {
  const el = $(`.inmate[data-user="${CSS.escape(user.toLowerCase())}"]`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ---------------- 統計 ---------------- */
function renderStats() {
  const d = state.data;
  const soon = d.prisoners.filter(p => !p.lifetime && p.end - nowS() < 86400).length;
  $('#stat-total').textContent = d.prisoners.length;
  $('#stat-24h').textContent = soon;
  $('#stat-life').textContent = d.prisoners.filter(p => p.lifetime).length;
  $('#stat-updated').textContent = fmtS(d.generated_at);
  document.title = `(${d.prisoners.length}) HatePolitics 水桶監獄`;
}

/* ---------------- 詳細資料 ---------------- */
function openModal(p) {
  const served = p.lifetime ? null : Math.min(100, Math.max(0, (nowS() - p.start) / (p.end - p.start) * 100));
  $('#modal-body').innerHTML = `
    <div class="m-head"><div class="m-avatar">${avatarSVG(p.user, modeOf(p))}</div>
      <div><h3>${esc(p.user)}</h3><span class="chip ${p.lifetime ? 'chip-life' : ''}">${p.lifetime ? '無期徒刑' : `刑期 ${p.days} 天`}</span></div></div>
    <dl class="m-list">
      <dt>違規條文</dt><dd>${esc(p.reason || '—')}</dd>
      <dt>入獄時間</dt><dd>${fmt(p.start)}</dd>
      <dt>預計出獄</dt><dd>${p.lifetime ? '遙遙無期' : fmt(p.end)}</dd>
      <dt>剩餘刑期</dt><dd class="m-cd" ${p.lifetime ? '' : `data-end="${p.end}"`}>${p.lifetime ? '∞' : remainText(p.end - nowS())}</dd>
    </dl>
    ${served === null ? '' : `<div class="progress"><div style="width:${served.toFixed(1)}%"></div></div><div class="progress-lbl">已服刑 ${served.toFixed(1)}%</div>`}
    ${p.url ? `<a class="m-link" href="${esc(p.url)}" target="_blank" rel="noopener">📜 查看水桶公告：${esc(p.title)}</a>` : ''}`;
  $('#modal').hidden = false;
}

function openFreeModal(p) {
  $('#modal-body').innerHTML = `
    <div class="m-head"><div class="m-avatar">${avatarSVG(p.user, 'free')}</div>
      <div><h3>${esc(p.user)}</h3><span class="chip chip-free">已出獄 🎉</span></div></div>
    <dl class="m-list">
      <dt>出獄時間</dt><dd>${fmt(p.released_at)}（${agoText(p.released_at)}）</dd>
      <dt>原刑期</dt><dd>${p.days ? `${p.days} 天` : '—'}</dd>
      <dt>違規條文</dt><dd>${esc(p.reason || '—')}</dd>
    </dl>
    ${p.url ? `<a class="m-link" href="${esc(p.url)}" target="_blank" rel="noopener">📜 查看公告：${esc(p.title)}</a>` : ''}`;
  $('#modal').hidden = false;
}

function closeModal() { $('#modal').hidden = true; }

/* ---------------- 搜尋 ---------------- */
function applySearch() {
  const q = state.query.trim().toLowerCase();
  let hits = 0;
  $$('.inmate, .row[data-user], .freeman').forEach(el => {
    const hit = !!q && (el.dataset.user || '').includes(q);
    el.classList.toggle('match', hit);
    el.classList.toggle('dim', !!q && !hit);
    if (hit && el.classList.contains('inmate')) hits++;
  });
  const free = q ? $$('.freeman.match').length : 0;
  $('#search-hint').textContent = !q ? '' : hits ? `監獄裡找到 ${hits} 人${free ? `，自由廣場 ${free} 人` : ''}`
    : free ? `他已經出獄了（自由廣場 ${free} 人）` : '查無此人，可能不在監獄裡 😇';
  const first = $('.inmate.match');
  if (first && hits === 1) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ---------------- 每秒倒數 ---------------- */
function tick() {
  const n = nowS();
  $$('[data-end]').forEach(el => { el.textContent = remainText(+el.dataset.end - n); });
  $$('[data-short-end]').forEach(el => { el.textContent = shortRemain(+el.dataset.shortEnd - n); });
}

/* ---------------- 載入 ---------------- */
function render() {
  renderStats();
  renderJail();
  renderYard();
  renderBoard();
  applySearch();
}

async function load() {
  try {
    const r = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    state.data = await r.json();
    render();
  } catch (e) {
    if (!state.data) {
      $('#jail').innerHTML = `<div class="empty">😵 讀不到名單資料（${esc(e.message)}）<br><small>請在 web 資料夾執行 <code>python -m http.server 8000</code>，再開 http://localhost:8000 ，不要直接雙擊 HTML 檔。</small></div>`;
    }
  }
}

$('#search').addEventListener('input', e => { state.query = e.target.value; applySearch(); });
$('#modal-close').addEventListener('click', closeModal);
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

load();
setInterval(load, REFRESH_MS);
setInterval(tick, 1000);
setInterval(wander, 400);
