// Dribit social server (0.31): groups with a weekly leaderboard, and refer-a-friend. A Cloudflare Worker with a D1
// database, on Cloudflare's free plan (100,000 requests a day; past that, requests fail until the next day and nothing
// is billed). The app works without it: lessons, points and progress never depend on this server.
//
// No login. On first use the app registers and gets an id and a secret; it sends "Authorization: Bearer <id>.<secret>".
// The database keeps only the SHA-256 of the secret. Stored per person: a chosen nickname, points, this week's points,
// streak, lessons done, who invited them (an id) and how many friends they brought. No name, phone, email or IP.
//
// Endpoints (JSON):
//   GET  /                      health
//   GET  /v1/stats              totals (team devices left out)
//   POST /v1/register           { ref?, team?, nick?, xp, week, weekXp, streak, lessons } -> { token, me }
//   POST /v1/sync               { xp, week, weekXp, streak, lessons, team? } -> { me }
//   POST /v1/nick               { nick } -> { me }
//   POST /v1/groups             { name } -> { group }            create (and join)
//   GET  /v1/groups/CODE        -> { group }                     the board for a member, the name and size for anyone
//   POST /v1/groups/CODE/join   -> { group }
//   POST /v1/groups/CODE/leave  -> { ok }
//   POST /v1/groups/CODE/kick   { user } -> { group }            the creator removes someone
// Errors: { error: 'code' } with a 4xx status. The app shows its own Hebrew text per code.

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I: codes are read aloud and typed
const LIMITS = {
  groupSize: 50,        // members in one group
  groupsPerUser: 5,     // groups one person is in
  createPerDay: 3,      // groups one person creates in a day
  registerPerDay: 40,   // new registrations from one network in a day (a base or a school shares one address)
  maxXp: 10000000, maxWeekXp: 50000, maxStreak: 3650, maxLessons: 1000
};
const DAY = 86400000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

class Fail extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

function json(body, status) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, CORS) });
}

function randomCode(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  let s = '';
  for (let i = 0; i < n; i++) s += ALPHA[b[i] % ALPHA.length]; // 256 % 32 = 0: no bias
  return s;
}
function randomHex(bytes) {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}
async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, '0')).join('');
}
// constant-time compare of two hex strings of the same length
function same(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function int(x, max) {
  const n = Math.floor(Number(x));
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0;
}
function cleanCode(x) {
  const s = String(x || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length >= 4 && s.length <= 8 ? s : '';
}

// ----- weeks: Sunday to Saturday, Israel time -----
function ilParts(ms) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
  const p = {};
  for (const x of f.formatToParts(new Date(ms))) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day, wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
}
function weekKey(ms) {
  const p = ilParts(ms);
  const sunday = new Date(Date.UTC(p.y, p.m - 1, p.d) - p.wd * DAY);
  return sunday.toISOString().slice(0, 10);
}
function isWeek(x) { return typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x); }

// ----- names -----
// a nickname or group name: letters (any language), digits, spaces and a few marks. No links, no phone numbers,
// and a short list of words a group of 19-year-olds will try first.
const BAD = ['זונה', 'שרמוט', 'כוסאמ', 'כוס אמ', 'כוסעמק', 'זין של', 'מזדיי', 'לזיין', 'חרא', 'מניאק', 'קוקסינ', 'נאצי', 'היטלר',
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'nigg', 'porn', 'sex', 'nazi', 'hitler'];
function cleanName(x, min, max) {
  if (typeof x !== 'string') return null;
  const s = x.normalize('NFC').replace(/[‎‏‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim();
  if (s.length < min || s.length > max) return null;
  if (!/^[\p{L}\p{N} _.'"\-׳״]+$/u.test(s)) return null;
  if (/\d{5,}/.test(s.replace(/[\s\-.]/g, ''))) return null; // a phone number
  if (/(www|http|\.com|\.co\b|\.il\b)/i.test(s)) return null;
  const flat = s.toLowerCase().replace(/[\s_.'"\-׳״]/g, '');
  if (BAD.some((w) => flat.includes(w.replace(/\s/g, '')))) return null;
  return s;
}

// ----- limits -----
async function hit(env, key, max, ms) {
  const now = Date.now();
  const row = await env.DB.prepare('SELECT n, until FROM limits WHERE k = ?').bind(key).first();
  if (row && row.until > now) {
    if (row.n >= max) return false;
    await env.DB.prepare('UPDATE limits SET n = n + 1 WHERE k = ?').bind(key).run();
    return true;
  }
  await env.DB.prepare('INSERT INTO limits (k, n, until) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = 1, until = excluded.until').bind(key, now + ms).run();
  return true;
}
async function netKey(req, what) {
  const ip = req.headers.get('CF-Connecting-IP') || 'local';
  // a daily salt, so the stored key cannot be matched to an address later
  return what + ':' + (await sha256(ip + '|' + new Date().toISOString().slice(0, 10) + '|dribit')).slice(0, 20);
}

// ----- people -----
async function auth(req, env, need) {
  const h = req.headers.get('Authorization') || '';
  const m = /^Bearer ([A-Z0-9]{10})\.([a-f0-9]{48})$/.exec(h);
  if (!m) { if (need) throw new Fail(401, 'auth'); return null; }
  const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(m[1]).first();
  if (!u || !same(u.secret, await sha256(m[2]))) { if (need) throw new Fail(401, 'auth'); return null; }
  return u;
}

// the person's numbers from the app. The week's points are the app's own count for this week (it has them per day);
// a sync from another week (a phone with the wrong date, a sync just after midnight on Saturday) adds nothing to it.
function scores(body, now) {
  const week = weekKey(now);
  return {
    xp: int(body.xp, LIMITS.maxXp),
    streak: int(body.streak, LIMITS.maxStreak),
    lessons: int(body.lessons, LIMITS.maxLessons),
    week: week,
    weekXp: isWeek(body.week) && body.week === week ? Math.min(int(body.weekXp, LIMITS.maxWeekXp), int(body.xp, LIMITS.maxXp)) : 0
  };
}

async function saveScores(env, u, sc, now, team) {
  const stmts = [];
  // a new week: last week's points are kept for "last week's winner"
  if (u.week && u.week !== sc.week && u.week_xp > 0) {
    stmts.push(env.DB.prepare('INSERT OR REPLACE INTO weeks (user, week, xp) VALUES (?, ?, ?)').bind(u.id, u.week, u.week_xp));
  }
  stmts.push(env.DB.prepare('UPDATE users SET xp = ?, streak = ?, lessons = ?, week = ?, week_xp = ?, seen = ?' + (team == null ? '' : ', team = ' + (team ? 1 : 0)) + ' WHERE id = ?')
    .bind(sc.xp, sc.streak, sc.lessons, sc.week, sc.weekXp, now, u.id));
  // a friend counts for the person who invited them once they finished a lesson, once
  if (u.invited_by && !u.counted && sc.lessons >= 1) {
    stmts.push(env.DB.prepare('UPDATE users SET counted = 1 WHERE id = ? AND counted = 0').bind(u.id));
    stmts.push(env.DB.prepare('UPDATE users SET friends = friends + 1 WHERE id = ?').bind(u.invited_by));
  }
  await env.DB.batch(stmts);
}

async function me(env, id) {
  const u = await env.DB.prepare('SELECT id, nick, ref, friends, invited_by, counted, xp, week, week_xp FROM users WHERE id = ?').bind(id).first();
  if (!u) throw new Fail(401, 'auth');
  const week = weekKey(Date.now());
  const groups = (await env.DB.prepare(
    'SELECT g.code, g.name, g.owner, (SELECT COUNT(*) FROM members x WHERE x.code = g.code) AS size, ' +
    '(SELECT COUNT(*) FROM members y JOIN users v ON v.id = y.user WHERE y.code = g.code AND v.week = ? AND v.week_xp > ?) AS ahead ' +
    'FROM members m JOIN groups g ON g.code = m.code WHERE m.user = ? ORDER BY m.joined'
  ).bind(week, u.week === week ? u.week_xp : 0, id).all()).results;
  const friends = (await env.DB.prepare('SELECT nick FROM users WHERE invited_by = ? AND counted = 1 ORDER BY seen DESC LIMIT 20').bind(id).all()).results;
  let inviter = null;
  if (u.invited_by) {
    const iv = await env.DB.prepare('SELECT nick FROM users WHERE id = ?').bind(u.invited_by).first();
    inviter = { nick: (iv && iv.nick) || null };
  }
  return {
    id: u.id, nick: u.nick, ref: u.ref, friends: u.friends, friendNicks: friends.map((f) => f.nick || null),
    invitedBy: inviter, counted: !!u.counted, week: week, weekXp: u.week === week ? u.week_xp : 0,
    groups: groups.map((g) => ({ code: g.code, name: g.name, size: g.size, rank: g.ahead + 1, owner: g.owner === id }))
  };
}

async function board(env, code, viewer) {
  const g = await env.DB.prepare('SELECT code, name, owner, created FROM groups WHERE code = ?').bind(code).first();
  if (!g) throw new Fail(404, 'no_group');
  const now = Date.now(), week = weekKey(now), prev = weekKey(now - 7 * DAY);
  const rows = (await env.DB.prepare(
    'SELECT u.id, u.nick, u.xp, u.streak, u.lessons, u.week, u.week_xp, w.xp AS prev_xp, m.joined FROM members m ' +
    'JOIN users u ON u.id = m.user LEFT JOIN weeks w ON w.user = u.id AND w.week = ? WHERE m.code = ?'
  ).bind(prev, code).all()).results;
  const member = !!viewer && rows.some((r) => r.id === viewer.id);
  const out = { code: g.code, name: g.name, size: rows.length, member: member, week: week };
  if (!member) return out;
  const people = rows.map((r) => ({
    id: r.id, nick: r.nick || 'בלי כינוי', me: r.id === viewer.id, owner: r.id === g.owner,
    week: r.week === week ? r.week_xp : 0, prev: r.week === prev ? r.week_xp : (r.prev_xp || 0),
    xp: r.xp, streak: r.streak, lessons: r.lessons, joined: r.joined
  }));
  people.sort((a, b) => b.week - a.week || b.xp - a.xp || a.joined - b.joined);
  // last week's winner: the most points that week, only if someone earned any
  const won = people.filter((p) => p.prev > 0).sort((a, b) => b.prev - a.prev || a.joined - b.joined)[0] || null;
  out.owner = g.owner === viewer.id;
  out.people = people.map((p, i) => ({ id: p.id, nick: p.nick, me: p.me, owner: p.owner, rank: i + 1, week: p.week, xp: p.xp, streak: p.streak, lessons: p.lessons }));
  out.lastWinner = won ? { nick: won.nick, xp: won.prev, me: won.me } : null;
  return out;
}

async function readBody(req) {
  if (req.method !== 'POST') return {};
  const t = await req.text();
  if (t.length > 4000) throw new Fail(413, 'too_big');
  if (!t) return {};
  try { const b = JSON.parse(t); return b && typeof b === 'object' && !Array.isArray(b) ? b : {}; } catch (e) { throw new Fail(400, 'bad_json'); }
}

async function newRef(env) {
  for (let i = 0; i < 6; i++) {
    const r = randomCode(6);
    if (!(await env.DB.prepare('SELECT 1 FROM users WHERE ref = ?').bind(r).first())) return r;
  }
  throw new Fail(500, 'busy');
}

async function route(req, env) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const now = Date.now();

  if (path === '/' && req.method === 'GET') return json({ ok: true, name: 'dribit-social', week: weekKey(now) });

  if (path === '/v1/stats' && req.method === 'GET') {
    const r = await env.DB.prepare(
      'SELECT (SELECT COUNT(*) FROM users WHERE team = 0) AS people, (SELECT COUNT(*) FROM users WHERE team = 0 AND nick IS NOT NULL) AS with_nick, ' +
      '(SELECT COUNT(*) FROM users WHERE team = 0 AND invited_by IS NOT NULL) AS came_from_link, ' +
      '(SELECT COUNT(*) FROM users WHERE team = 0 AND counted = 1) AS friends_counted, (SELECT COUNT(*) FROM groups) AS groups, ' +
      '(SELECT COUNT(*) FROM members) AS memberships, (SELECT COUNT(*) FROM users WHERE team = 0 AND seen > ?) AS active_7d'
    ).bind(now - 7 * DAY).first();
    return json(r);
  }

  const body = await readBody(req);

  if (path === '/v1/register' && req.method === 'POST') {
    if (!(await hit(env, await netKey(req, 'reg'), LIMITS.registerPerDay, DAY))) throw new Fail(429, 'slow_down');
    const id = randomCode(10), secret = randomHex(24), ref = await newRef(env);
    const sc = scores(body, now);
    let inviter = null;
    const rc = cleanCode(body.ref);
    if (rc) inviter = await env.DB.prepare('SELECT id FROM users WHERE ref = ?').bind(rc).first();
    const nick = body.nick == null ? null : cleanName(body.nick, 2, 16);
    await env.DB.prepare('INSERT INTO users (id, secret, nick, ref, invited_by, xp, streak, lessons, week, week_xp, team, created, seen) VALUES (?, ?, ?, ?, ?, 0, 0, 0, NULL, 0, ?, ?, ?)')
      .bind(id, await sha256(secret), nick, ref, inviter ? inviter.id : null, body.team ? 1 : 0, now, now).run();
    const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
    await saveScores(env, u, sc, now, null);
    return json({ token: id + '.' + secret, me: await me(env, id) });
  }

  if (path === '/v1/sync' && req.method === 'POST') {
    const u = await auth(req, env, true);
    await saveScores(env, u, scores(body, now), now, body.team == null ? null : !!body.team);
    return json({ me: await me(env, u.id) });
  }

  if (path === '/v1/nick' && req.method === 'POST') {
    const u = await auth(req, env, true);
    const nick = cleanName(body.nick, 2, 16);
    if (!nick) throw new Fail(400, 'bad_nick');
    await env.DB.prepare('UPDATE users SET nick = ?, seen = ? WHERE id = ?').bind(nick, now, u.id).run();
    return json({ me: await me(env, u.id) });
  }

  if (path === '/v1/groups' && req.method === 'POST') {
    const u = await auth(req, env, true);
    if (!u.nick) throw new Fail(400, 'need_nick');
    const name = cleanName(body.name, 2, 24);
    if (!name) throw new Fail(400, 'bad_name');
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM members WHERE user = ?').bind(u.id).first();
    if (n.n >= LIMITS.groupsPerUser) throw new Fail(409, 'too_many_groups');
    if (!(await hit(env, 'create:' + u.id, LIMITS.createPerDay, DAY))) throw new Fail(429, 'slow_down');
    let code = '';
    for (let i = 0; i < 6 && !code; i++) {
      const c = randomCode(6);
      if (!(await env.DB.prepare('SELECT 1 FROM groups WHERE code = ?').bind(c).first())) code = c;
    }
    if (!code) throw new Fail(500, 'busy');
    await env.DB.batch([
      env.DB.prepare('INSERT INTO groups (code, name, owner, created) VALUES (?, ?, ?, ?)').bind(code, name, u.id, now),
      env.DB.prepare('INSERT INTO members (code, user, joined) VALUES (?, ?, ?)').bind(code, u.id, now)
    ]);
    return json({ group: await board(env, code, u) });
  }

  const gm = /^\/v1\/groups\/([A-Za-z0-9]{4,8})(\/(join|leave|kick))?$/.exec(path);
  if (gm) {
    const code = cleanCode(gm[1]), action = gm[3] || '';
    if (!action && req.method === 'GET') {
      const u = await auth(req, env, false);
      return json({ group: await board(env, code, u) });
    }
    if (req.method !== 'POST') throw new Fail(405, 'method');
    const u = await auth(req, env, true);
    const g = await env.DB.prepare('SELECT code, owner FROM groups WHERE code = ?').bind(code).first();
    if (!g) throw new Fail(404, 'no_group');
    if (action === 'join') {
      if (!u.nick) throw new Fail(400, 'need_nick');
      const already = await env.DB.prepare('SELECT 1 FROM members WHERE code = ? AND user = ?').bind(code, u.id).first();
      if (!already) {
        const size = await env.DB.prepare('SELECT COUNT(*) AS n FROM members WHERE code = ?').bind(code).first();
        if (size.n >= LIMITS.groupSize) throw new Fail(409, 'group_full');
        const mine = await env.DB.prepare('SELECT COUNT(*) AS n FROM members WHERE user = ?').bind(u.id).first();
        if (mine.n >= LIMITS.groupsPerUser) throw new Fail(409, 'too_many_groups');
        await env.DB.prepare('INSERT OR IGNORE INTO members (code, user, joined) VALUES (?, ?, ?)').bind(code, u.id, now).run();
      }
      return json({ group: await board(env, code, u), joined: !already });
    }
    if (action === 'leave') {
      await env.DB.prepare('DELETE FROM members WHERE code = ? AND user = ?').bind(code, u.id).run();
      const left = await env.DB.prepare('SELECT user FROM members WHERE code = ? ORDER BY joined LIMIT 1').bind(code).first();
      // the last one out closes the group; a creator who leaves hands it to the longest member
      if (!left) await env.DB.prepare('DELETE FROM groups WHERE code = ?').bind(code).run();
      else if (g.owner === u.id) await env.DB.prepare('UPDATE groups SET owner = ? WHERE code = ?').bind(left.user, code).run();
      return json({ ok: true });
    }
    if (action === 'kick') {
      if (g.owner !== u.id) throw new Fail(403, 'not_owner');
      const who = typeof body.user === 'string' && /^[A-Z0-9]{10}$/.test(body.user) ? body.user : '';
      if (!who || who === u.id) throw new Fail(400, 'bad_user');
      await env.DB.prepare('DELETE FROM members WHERE code = ? AND user = ?').bind(code, who).run();
      return json({ group: await board(env, code, u) });
    }
  }
  throw new Fail(404, 'not_found');
}

export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      const res = await route(req, env);
      // now and then, old abuse counters go
      if (Math.random() < 0.02) ctx.waitUntil(env.DB.prepare('DELETE FROM limits WHERE until < ?').bind(Date.now()).run().catch(() => {}));
      return res;
    } catch (e) {
      if (e instanceof Fail) return json({ error: e.code }, e.status);
      console.error(e && e.stack || e);
      return json({ error: 'server' }, 500);
    }
  }
};

// for the tests (node): the pure helpers
export { weekKey, cleanName, cleanCode, scores };
