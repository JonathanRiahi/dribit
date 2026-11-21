/* Fault check (21.11.2026): looks for things that are broken or look wrong, not only for drop-off.
   Tracking gaps, errors the app reports, old versions still in use, steps where people get stuck, reminders that never
   arrive, and a compact journey of every new person. Prints counts only: never an id or a free text (the log is public).
   Team devices are left out (tools/team.js). Run: node tools/fault-check.js. Env SINCE 'YYYY-MM-DD', NEW_FROM 'YYYY-MM-DD HH:MM' (Israel). */
'use strict';

const API_KEY = (process.env.POSTHOG_API_KEY || '').trim();
const PH_API = (process.env.POSTHOG_API_HOST || 'https://eu.posthog.com').replace(/\/$/, '');
let PROJECT = (process.env.POSTHOG_PROJECT_ID || '').trim();
const SINCE = /^\d{4}-\d{2}-\d{2}$/.test(process.env.SINCE || '') ? process.env.SINCE : '2026-11-10';
const NEW_FROM = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(process.env.NEW_FROM || '') ? process.env.NEW_FROM : '2026-11-19 00:00';
const { loadTeam } = require('./team');

async function api(pathname, body) {
  const r = await fetch(PH_API + pathname, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok) throw new Error(`PostHog ${pathname} answered ${r.status}: ${(await r.text()).replace(/\s+/g, ' ').slice(0, 300)}`);
  return r.json();
}
async function hogql(query) {
  const j = await api(`/api/projects/${PROJECT}/query/`, { query: { kind: 'HogQLQuery', query }, refresh: 'force_blocking' });
  return j.results || [];
}
const print = (title, head, rows) => {
  console.log(`\n=== ${title} ===`);
  console.log('  ' + head.join(' | '));
  for (const r of rows) console.log('  ' + r.map((x) => (x === null || x === undefined || x === '' ? '-' : String(x))).join(' | '));
};
async function section(title, head, query) {
  try { print(title, head, await hogql(query)); } catch (e) { console.log(`\n=== ${title} === FAILED: ${String(e.message || e).slice(0, 300)}`); }
}
async function block(title, fn) {
  try { await fn(); } catch (e) { console.log(`\n=== ${title} === FAILED: ${String(e.message || e).slice(0, 300)}`); }
}
const IL = (x) => `toTimeZone(${x || 'timestamp'}, 'Asia/Jerusalem')`;
const D = (x) => `toDate(${IL(x)})`;
const P = (name) => `toString(properties.${name})`;
const med = (xs) => { if (!xs.length) return null; const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const q90 = (xs) => { if (!xs.length) return null; const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * 0.9))]; };

(async () => {
  if (!API_KEY) throw new Error('POSTHOG_API_KEY is missing.');
  if (!PROJECT) PROJECT = String(((await api('/api/projects/')).results || [])[0].id);
  const now = await hogql(`SELECT toString(${IL('now()')})`);
  console.log(`Fault check. Events since ${SINCE}, new people since ${NEW_FROM} (Israel). Now: ${now[0][0]}`);
  const team = await loadTeam(hogql);
  console.log(team.line());
  const T = team.not();
  const W = `timestamp >= toDateTime('${SINCE} 00:00:00', 'Asia/Jerusalem') AND ${T}`;
  const APP = `${P('app_version')} != '' AND event NOT IN ('landing_view', 'landing_cta', 'landing_leave', 'reminder_sent', 'reminder_run')`;

  // ---------- 1. volume and reach ----------
  await section('1. לפי יום: אנשים באפליקציה, חדשים, אירועים', ['day', 'people (any app event)', 'opened', 'finished a lesson', 'events', 'IL people', 'not IL people'], `
    SELECT toString(${D()}) AS d, uniq(person_id), uniqIf(person_id, event = 'app_opened'), uniqIf(person_id, event = 'lesson_completed'), count(),
      uniqIf(person_id, ${P('$geoip_country_code')} = 'IL'), uniqIf(person_id, ${P('$geoip_country_code')} != 'IL')
    FROM events WHERE ${W} AND ${APP} GROUP BY d ORDER BY d LIMIT 100`);
  await section('1b. פעילים: 24 שעות / 7 ימים / 30 ימים (כל מי שפתח)', ['DAU', 'WAU', 'MAU', 'people ever', 'finished a lesson ever', 'finished a lesson in the last 7 days'], `
    SELECT uniqIf(person_id, timestamp >= now() - INTERVAL 1 DAY), uniqIf(person_id, timestamp >= now() - INTERVAL 7 DAY), uniqIf(person_id, timestamp >= now() - INTERVAL 30 DAY),
      uniq(person_id), uniqIf(person_id, event = 'lesson_completed'), uniqIf(person_id, event = 'lesson_completed' AND timestamp >= now() - INTERVAL 7 DAY)
    FROM events WHERE timestamp >= toDateTime('2026-09-01 00:00:00') AND ${T} AND event IN ('app_opened', 'lesson_completed') LIMIT 5`);
  await section('1c. מדינה של הפתיחה הראשונה (חדשים)', ['country', 'new people'], `
    SELECT c, count() FROM (SELECT person_id, min(timestamp) AS t0, argMin(${P('$geoip_country_code')}, timestamp) AS c FROM events
      WHERE event = 'app_opened' AND timestamp >= toDateTime('2026-09-01 00:00:00') AND ${T} GROUP BY person_id)
    WHERE t0 >= toDateTime('${SINCE} 00:00:00', 'Asia/Jerusalem') GROUP BY c ORDER BY count() DESC LIMIT 30`);

  // ---------- 2. versions ----------
  await section('2. גרסאות ב-72 השעות האחרונות (האם אנשים תקועים על גרסה ישנה)', ['app_version', 'native', 'native_version', 'people', 'events'], `
    SELECT ${P('app_version')}, ${P('native')}, ${P('native_version')}, uniq(person_id), count() FROM events
    WHERE timestamp >= now() - INTERVAL 72 HOUR AND ${T} AND ${APP} GROUP BY 1, 2, 3 ORDER BY 1 DESC LIMIT 60`);
  await section('2b. מי שחזר: הגרסה בפתיחה האחרונה שלו מול היום שבו פתח', ['last open day', 'app_version', 'people'], `
    SELECT toString(d), v, count() FROM (SELECT person_id, max(${D()}) AS d, argMax(${P('app_version')}, timestamp) AS v FROM events
      WHERE ${W} AND event = 'app_opened' GROUP BY person_id) GROUP BY d, v ORDER BY d DESC, v DESC LIMIT 80`);
  await section('2c. platform / standalone / in_app / native (חדשים מאז NEW_FROM, לפי הפתיחה הראשונה)', ['platform', 'native', 'standalone', 'in_app', 'source', 'ref', 'people'], `
    SELECT pl, nat, sa, ia, src, rf, count() FROM (
      SELECT person_id, min(timestamp) AS t0, argMin(${P('platform')}, timestamp) AS pl, argMin(${P('native')}, timestamp) AS nat, argMin(${P('standalone')}, timestamp) AS sa,
        argMin(${P('in_app')}, timestamp) AS ia, argMin(${P('source')}, timestamp) AS src, argMin(${P('ref')}, timestamp) AS rf, argMin(${P('$geoip_country_code')}, timestamp) AS c
      FROM events WHERE event = 'app_opened' AND timestamp >= toDateTime('2026-09-01 00:00:00') AND ${T} GROUP BY person_id)
    WHERE t0 >= toDateTime('${NEW_FROM}:00', 'Asia/Jerusalem') GROUP BY 1, 2, 3, 4, 5, 6 ORDER BY count() DESC LIMIT 60`);
  await section('2d. מערכת הפעלה ודפדפן (לפי PostHog)', ['os', 'os version', 'browser', 'people'], `
    SELECT ${P('$os')}, ${P('$os_version')}, ${P('$browser')}, uniq(person_id) FROM events WHERE ${W} AND event = 'app_opened' GROUP BY 1, 2, 3 ORDER BY 4 DESC LIMIT 40`);

  // ---------- 3. errors the app itself reports ----------
  await section('3. אירועי תקלה ותוצאות (error / reason / outcome / permission / how / channel)', ['event', 'error', 'reason', 'outcome', 'permission', 'how', 'channel', 'ok', 'native', 'people', 'times'], `
    SELECT event, ${P('error')}, ${P('reason')}, ${P('outcome')}, ${P('permission')}, ${P('how')}, ${P('channel')}, ${P('ok')}, ${P('native')}, uniq(person_id), count() FROM events
    WHERE ${W} AND event IN ('push_failed', 'push_denied', 'share_failed', 'progress_imported', 'progress_import_skipped', 'contact_sent', 'feedback_sent', 'invite_reward', 'install_choice',
      'install_declined', 'push_unsubscribed', 'native_reminder_off', 'energy_empty', 'streak_lost', 'progress_reset', 'analytics_off', 'inapp_auto_stayed', 'inapp_open_steps', 'plan_copied', 'group_report_clicked')
    GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9 ORDER BY 1, 11 DESC LIMIT 120`);
  await section('3b. אירועים כפולים (אותו אדם, אותו אירוע, אותה אלפית שנייה)', ['event', 'extra copies'], `
    SELECT event, sum(c - 1) FROM (SELECT event, person_id, timestamp, count() AS c FROM events WHERE ${W} AND ${APP} GROUP BY event, person_id, timestamp HAVING c > 1)
    GROUP BY event ORDER BY 2 DESC LIMIT 40`);
  await section('3c. אירועים עם שעון לא הגיוני (עתיד, או לפני ספטמבר 2026)', ['kind', 'people', 'events'], `
    SELECT if(timestamp > now() + INTERVAL 10 MINUTE, 'future', 'before 2026-09'), uniq(person_id), count() FROM events
    WHERE (timestamp > now() + INTERVAL 10 MINUTE OR timestamp < toDateTime('2026-09-01 00:00:00')) AND ${P('app_version')} != '' GROUP BY 1 LIMIT 10`);
  await section('3d. כל שמות האירועים מאז SINCE (גם כאלה שהקוד כבר לא שולח)', ['event', 'people', 'times', 'last seen (IL)'], `
    SELECT event, uniq(person_id), count(), toString(max(${IL()})) FROM events WHERE ${W} GROUP BY event ORDER BY 2 DESC LIMIT 250`);

  // ---------- 4. consistency per person ----------
  await block('4. עקביות לכל אדם (חדשים מאז SINCE)', async () => {
    const rows = await hogql(`
      SELECT person_id, toString(min(${D()})), argMin(${P('app_version')}, timestamp), argMin(${P('native')}, timestamp), argMin(${P('$geoip_country_code')}, timestamp),
        max(event = 'app_opened'), max(event = 'start_screen_shown'), max(event = 'start_screen_tapped'), max(event = 'onboarding_done'), max(event = 'lesson_started'),
        max(event = 'step_viewed'), max(event = 'question_answered'), max(event = 'lesson_completed'), max(event = 'status_set'), max(event = 'done_next_shown'),
        max(event = 'push_popup_shown'), max(event = 'tour_started'), max(event = 'social_registered'), max(event = 'app_installed'), max(event = 'install_popup_shown' OR event = 'install_card_shown'),
        max(event = 'level_up'), max(event = 'partner_profile_viewed'), max(event = 'tools_viewed'), max(event = 'friends_viewed'), min(timestamp)
      FROM events WHERE timestamp >= toDateTime('2026-09-01 00:00:00') AND ${T} AND ${APP} GROUP BY person_id
      HAVING min(timestamp) >= toDateTime('${SINCE} 00:00:00', 'Asia/Jerusalem') LIMIT 20000`);
    const K = ['pid', 'd0', 'ver', 'nat', 'c', 'open', 'shown', 'tapped', 'onb', 'ls', 'sv', 'qa', 'lc', 'status', 'next', 'pushPop', 'tour', 'soc', 'inst', 'instAsk', 'lvl', 'partner', 'tools', 'friends'];
    const ppl = rows.map((r) => { const o = {}; K.forEach((k, i) => { o[k] = r[i]; }); return o; });
    const n = (f) => ppl.filter(f).length;
    const on = (k) => (o) => Number(o[k]) === 1;
    const not = (k) => (o) => Number(o[k]) !== 1;
    const both = (...fs) => (o) => fs.every((f) => f(o));
    print('4. עקביות: דברים שלא אמורים לקרות', ['check', 'people', 'out of'], [
      ['any app event but never app_opened', n(not('open')), ppl.length],
      ['app_opened but no start_screen_shown', n(both(on('open'), not('shown'))), n(on('open'))],
      ['lesson_started but no start_screen_tapped / onboarding_done', n(both(on('ls'), not('onb'))), n(on('ls'))],
      ['lesson_started but no step_viewed (lesson did not draw?)', n(both(on('ls'), not('sv'))), n(on('ls'))],
      ['step_viewed but no lesson_started', n(both(on('sv'), not('ls'))), n(on('sv'))],
      ['lesson_completed but no question_answered', n(both(on('lc'), not('qa'))), n(on('lc'))],
      ['lesson_completed but no status_set (status question missing?)', n(both(on('lc'), not('status'))), n(on('lc'))],
      ['status_set but no lesson_completed', n(both(on('status'), not('lc'))), n(on('status'))],
      ['lesson_completed but no done_next_shown', n(both(on('lc'), not('next'))), n(on('lc'))],
      ['lesson_completed but never asked about reminders', n(both(on('lc'), not('pushPop'))), n(on('lc'))],
      ['lesson_completed but no tour', n(both(on('lc'), not('tour'))), n(on('lc'))],
      ['tour but no lesson_completed', n(both(on('tour'), not('lc'))), n(on('tour'))],
      ['lesson_completed but no level_up', n(both(on('lc'), not('lvl'))), n(on('lc'))],
      ['lesson_completed but not registered for friends', n(both(on('lc'), not('soc'))), n(on('lc'))],
      ['registered for friends but no lesson_completed', n(both(on('soc'), not('lc'))), n(on('soc'))],
      ['App Store app (native) asked to install (should never)', n(both((o) => o.nat === 'ios' || o.nat === 'android', on('instAsk'))), n((o) => o.nat === 'ios' || o.nat === 'android')],
      ['App Store app without app_installed', n(both((o) => o.nat === 'ios', not('inst'))), n((o) => o.nat === 'ios')]
    ]);
    const byVer = {};
    for (const o of ppl) (byVer[o.ver] = byVer[o.ver] || []).push(o);
    print('4b. לפי הגרסה בפתיחה הראשונה: מה קרה למי שסיים שיעור', ['first version', 'new people', 'tapped start', 'finished', 'status', 'next shown', 'reminder asked', 'tour', 'friends reg'],
      Object.entries(byVer).sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([v, xs]) => { const f = (k) => xs.filter(on(k)).length; return [v, xs.length, f('onb'), f('lc'), f('status'), f('next'), f('pushPop'), f('tour'), f('soc')]; }));
  });

  // ---------- 5. steps: where people slow down or stop ----------
  await block('5. צעדים', async () => {
    const rows = await hogql(`
      SELECT person_id, ${P('lesson_id')}, toInt(properties.step_index), ${P('step_kind')}, ${P('question_id')}, toInt(properties.step_count), toUnixTimestamp(timestamp), event
      FROM events WHERE ${W} AND event IN ('step_viewed', 'lesson_completed', 'lesson_paused', 'lesson_exited') AND ${P('mode')} IN ('lesson', '') ORDER BY person_id, timestamp LIMIT 60000`);
    const runs = {}; // person|lesson -> ordered step views (first pass only)
    for (const [pid, l, idx, kind, qid, sc, ts, ev] of rows) {
      const k = pid + '|' + l;
      const r = (runs[k] = runs[k] || { l, steps: [], done: false, sc: 0 });
      if (ev === 'lesson_completed') { if (!r.done) { r.done = true; r.doneAt = ts; } continue; }
      if (ev !== 'step_viewed' || r.done) continue;
      r.sc = Math.max(r.sc, Number(sc) || 0);
      r.steps.push({ idx: Number(idx), kind, qid, ts: Number(ts) });
    }
    const perLesson = {};
    for (const r of Object.values(runs)) {
      if (!r.steps.length) continue;
      const L = (perLesson[r.l] = perLesson[r.l] || { people: 0, done: 0, sc: 0, step: {} });
      L.people++; if (r.done) L.done++; L.sc = Math.max(L.sc, r.sc);
      const seen = {};
      r.steps.forEach((s, i) => {
        const S = (L.step[s.idx] = L.step[s.idx] || { kind: s.kind, qid: s.qid, people: 0, dwell: [], last: 0, back: 0 });
        if (!seen[s.idx]) { seen[s.idx] = 1; S.people++; } else S.back++;
        const nx = r.steps[i + 1];
        const end = nx ? nx.ts : (r.done ? r.doneAt : null);
        if (end !== null && end - s.ts >= 0 && end - s.ts < 600) S.dwell.push(end - s.ts);
      });
      if (!r.done) { const last = r.steps[r.steps.length - 1]; L.step[last.idx].last++; }
    }
    const out = [];
    for (const [l, L] of Object.entries(perLesson).sort((a, b) => b[1].people - a[1].people)) {
      if (L.people < 4) continue;
      for (const i of Object.keys(L.step).map(Number).sort((a, b) => a - b)) {
        const S = L.step[i];
        out.push([l, `${i + 1}/${L.sc}`, S.kind, S.qid || '-', S.people, S.last, med(S.dwell), q90(S.dwell), S.back]);
      }
    }
    print('5. צעד אחרי צעד (שיעורים עם 4+ אנשים): כמה הגיעו, כמה עצרו שם, כמה שניות על הצעד', ['lesson', 'step', 'kind', 'question', 'people reached', 'stopped here (did not finish)', 'median sec', 'p90 sec', 'seen again (back / resume)'], out);
    print('5b. שיעורים: התחילו לראות צעדים / סיימו', ['lesson', 'people', 'finished', 'steps'], Object.entries(perLesson).sort((a, b) => b[1].people - a[1].people).map(([l, L]) => [l, L.people, L.done, L.sc]));
  });

  // ---------- 6. questions ----------
  await block('6. שאלות', async () => {
    const rows = await hogql(`
      SELECT person_id, ${P('lesson_id')}, ${P('question_id')}, ${P('question_type')}, ${P('correct')}, ${P('retry')}, ${P('review')}, ${P('option_index')}, ${P('mode')}, ${P('guess')}, toUnixTimestamp(timestamp)
      FROM events WHERE ${W} AND event = 'question_answered' ORDER BY person_id, timestamp LIMIT 60000`);
    const Q = {};
    const firstSeen = {};
    let total = 0, guesses = 0;
    for (const [pid, l, qid, type, correct, retry, review, opt, mode, guess] of rows) {
      total++; if (guess === 'true') guesses++;
      if (mode !== 'lesson') continue;
      const q = (Q[qid] = Q[qid] || { l, type, n: 0, ok: 0, wrong: {}, retries: 0, retryPeople: new Set() });
      const k = pid + '|' + qid;
      if (!firstSeen[k]) {
        firstSeen[k] = 1; q.n++;
        if (correct === 'true') q.ok++; else q.wrong[opt] = (q.wrong[opt] || 0) + 1;
      } else if (correct !== 'true') { q.retries++; q.retryPeople.add(pid); }
    }
    print('6. שאלות (5+ אנשים): נכון בפעם הראשונה, ואיזו תשובה שגויה בוחרים (אינדקס מ-0 לפי הסדר בתוכן)', ['lesson', 'question', 'type', 'people', 'right first try %', 'wrong picks: option=people', 'wrong again later (people)'],
      Object.entries(Q).filter(([, q]) => q.n >= 5).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n)
        .map(([id, q]) => [q.l, id, q.type, q.n, Math.round((100 * q.ok) / q.n), Object.entries(q.wrong).map(([o, c]) => `${o}=${c}`).join(' ') || '-', q.retryPeople.size]));
    print('6b. סך הכול תשובות', ['answers', 'of them marked guess (pair/tap games)'], [[total, guesses]]);
  });

  // ---------- 7. lesson completions ----------
  await section('7. סיומי שיעור: משך ודיוק (פעם ראשונה)', ['lesson', 'completions', 'min sec', 'median sec', 'max sec', 'under 45 sec', 'over 15 min', 'avg accuracy', 'perfect', 'speed bonus'], `
    SELECT ${P('lesson_id')}, count(), round(min(toFloat(properties.duration_sec))), round(quantile(0.5)(toFloat(properties.duration_sec))), round(max(toFloat(properties.duration_sec))),
      countIf(toFloat(properties.duration_sec) < 45), countIf(toFloat(properties.duration_sec) > 900), round(avg(toFloat(properties.accuracy))), countIf(${P('perfect')} = 'true'), countIf(${P('speed_bonus')} = 'true')
    FROM events WHERE ${W} AND event = 'lesson_completed' AND ${P('mode')} = 'lesson' AND ${P('first_time')} != 'false' GROUP BY 1 ORDER BY 2 DESC LIMIT 60`);
  await section('7b. הפסקה באמצע שיעור והמשך', ['lesson', 'paused (people)', 'exited (people)', 'resumed (people)', 'median days until resume'], `
    SELECT ${P('lesson_id')}, uniqIf(person_id, event = 'lesson_paused'), uniqIf(person_id, event = 'lesson_exited'), uniqIf(person_id, event = 'lesson_resumed'),
      round(quantileIf(0.5)(toFloat(properties.days_since), event = 'lesson_resumed'), 1)
    FROM events WHERE ${W} AND event IN ('lesson_paused', 'lesson_exited', 'lesson_resumed') GROUP BY 1 ORDER BY 2 DESC LIMIT 40`);
  await section('7c. דירוג שיעורים (הערכים כפי שנשלחו)', ['lesson', 'rating', 'people'], `
    SELECT ${P('lesson_id')}, ${P('rating')}, uniq(person_id) FROM events WHERE ${W} AND event = 'lesson_rated' GROUP BY 1, 2 ORDER BY 1, 3 DESC LIMIT 80`);
  await section('7d. עד כמה רחוק הגיעו: מספר השיעורים הכי גבוה (lessons_done) לכל אדם, כל הזמנים', ['lessons done', 'people'], `
    SELECT multiIf(m = 0, '00', m = 1, '01', m = 2, '02', m <= 4, '03-04', m <= 9, '05-09', m <= 19, '10-19', m <= 29, '20-29', '30+') AS b, count() FROM (
      SELECT person_id, max(toInt(properties.lessons_done)) AS m FROM events WHERE timestamp >= toDateTime('2026-09-01 00:00:00') AND ${T} AND event = 'app_opened' GROUP BY person_id)
    GROUP BY b ORDER BY b LIMIT 20`);

  // ---------- 8. the first screen ----------
  await section('8. המסך הראשון: הקשות לפני עזיבה (הקשה בלי כניסה לשיעור = נגעו במשהו אחר)', ['how left', 'taps', 'people', 'median seconds'], `
    SELECT ${P('how')}, multiIf(toInt(properties.taps) = 0, '0', toInt(properties.taps) = 1, '1', toInt(properties.taps) <= 3, '2-3', '4+'), uniq(person_id), round(quantile(0.5)(toFloat(properties.seconds)), 1)
    FROM events WHERE ${W} AND event = 'start_screen_left' AND ${P('returning')} != 'true' GROUP BY 1, 2 ORDER BY 1, 2 LIMIT 40`);
  await section('8b. המסך הראשון: מאיפה נכנסו לשיעור', ['from', 'screen', 'people', 'median seconds', 'median taps'], `
    SELECT ${P('from')}, ${P('screen')}, uniq(person_id), round(quantile(0.5)(toFloat(properties.seconds)), 1), round(quantile(0.5)(toFloat(properties.taps)))
    FROM events WHERE ${W} AND event = 'start_screen_tapped' GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 20`);

  // ---------- 9. journeys of new people ----------
  await block('9. מסלולים', async () => {
    const rows = await hogql(`
      SELECT e.person_id, e.event, toUnixTimestamp(e.timestamp), toString(e.properties.lesson_id), toString(e.properties.native), toString(e.properties.source), toString(e.properties.ref),
        toString(e.properties.in_app), toString(e.properties.app_version), toHour(${IL('e.timestamp')}), toString(${D('e.timestamp')}), toString(e.properties.platform)
      FROM events e INNER JOIN (SELECT person_id AS pid FROM (
          SELECT person_id, min(timestamp) AS t0, argMin(toString(properties.$geoip_country_code), timestamp) AS c FROM events
          WHERE event = 'app_opened' AND timestamp >= toDateTime('2026-09-01 00:00:00') AND ${T} GROUP BY person_id)
        WHERE t0 >= toDateTime('${NEW_FROM}:00', 'Asia/Jerusalem') AND c = 'IL') n ON e.person_id = n.pid
      WHERE e.timestamp >= toDateTime('${NEW_FROM}:00', 'Asia/Jerusalem') - INTERVAL 1 HOUR AND e.event NOT IN ('reminder_sent', 'reminder_run')
      ORDER BY e.person_id, e.timestamp LIMIT 60000`);
    const SHORT = { app_opened: 'OPEN', start_screen_shown: 'first', start_screen_still: null, start_screen_left: 'left', start_screen_tapped: 'tapStart', onboarding_done: null, lesson_started: 'L+', step_viewed: null,
      question_answered: null, lesson_completed: 'L✓', lesson_paused: 'pause', lesson_exited: 'exit', lesson_resumed: 'resume', status_set: 'status', push_popup_shown: 'remAsk', push_declined: 'remNo',
      push_asked: 'remYes?', native_reminder_on: 'remON', push_subscribed: 'remON', push_denied: 'remDenied', push_clicked: 'NOTIF-TAP', tour_started: 'tour', tour_finished: null, social_registered: null,
      tools_viewed: 'tools', friends_viewed: 'friends', partner_profile_viewed: 'profile', about_opened: 'about', tool_opened: 'tool', tool_used: null, done_next_shown: null, done_next_tapped: 'next',
      level_up: 'lvl', skin_unlocked: null, tool_unlocked: null, day_off_earned: null, app_installed: null, calculator_opened: 'calc', calculator_used: null, calculator_official_clicked: null,
      partner_teaser_viewed: 'offer', partner_teaser_tapped: 'offerTap', partner_link_clicked: 'LINK', share_clicked: 'share', lesson_rated: null, term_opened: null, energy_empty: 'EMPTY' };
    const people = {};
    for (const [pid, ev, ts, l, nat, src, ref, inapp, ver, hour, day, plat] of rows) {
      const p = (people[pid] = people[pid] || { first: Number(ts), hour, day0: day, nat, src, ref, inapp, ver, plat, days: new Set(), seq: [], done: 0, lessons: new Set(), last: Number(ts), steps: 0 });
      p.days.add(day); p.last = Number(ts);
      if (ev === 'step_viewed') p.steps++;
      if (ev === 'lesson_completed') { p.done++; p.lessons.add(l); }
      let s = Object.prototype.hasOwnProperty.call(SHORT, ev) ? SHORT[ev] : ev;
      if (!s) continue;
      if (ev === 'lesson_started' || ev === 'lesson_completed') s += l;
      if (ev === 'app_opened') { const dn = Math.round((Number(ts) - p.first) / 3600); s = dn >= 1 ? `OPEN(+${dn >= 24 ? Math.round(dn / 24) + 'd' : dn + 'h'},${src || '-'})` : `OPEN(${src || '-'})`; }
      const lastS = p.seq[p.seq.length - 1];
      if (lastS && lastS.s === s) lastS.n++; else p.seq.push({ s, n: 1 });
    }
    const list = Object.values(people).sort((a, b) => a.first - b.first);
    print(`9. המסלול של כל אדם חדש מאז ${NEW_FROM} (ישראל), בלי מזהים`, ['#', 'day', 'hour', 'how', 'version', 'days active', 'lessons', 'steps seen', 'minutes first to last', 'what happened, in order'],
      list.map((p, i) => [i + 1, p.day0.slice(5), p.hour, `${p.nat || p.plat}${p.inapp && p.inapp !== 'null' ? '/' + p.inapp : ''}${p.ref && p.ref !== 'null' ? '/' + p.ref : ''}`, p.ver, p.days.size, p.lessons.size, p.steps,
        Math.round((p.last - p.first) / 60), p.seq.map((x) => (x.n > 1 ? `${x.s}x${x.n}` : x.s)).join(' > ').slice(0, 700)]));
  });

  // ---------- 10. reminders ----------
  await section('10. תזכורות: מי מנוי, מה נשלח, מה נלחץ (מאז SINCE)', ['event', 'native', 'kind / reason / from', 'people', 'times', 'last (IL)'], `
    SELECT event, ${P('native')}, concat(${P('kind')}, ' / ', ${P('reason')}, ' / ', ${P('from')}), uniq(person_id), count(), toString(max(${IL()})) FROM events
    WHERE timestamp >= toDateTime('${SINCE} 00:00:00', 'Asia/Jerusalem') AND event IN ('push_subscribed', 'push_unsubscribed', 'native_reminder_on', 'native_reminder_off', 'push_clicked', 'reminder_sent', 'reminder_run', 'push_asked', 'push_denied', 'push_failed')
    GROUP BY 1, 2, 3 ORDER BY 1, 5 DESC LIMIT 80`);
  await section('10b. תזכורות שנשלחו מהשרת לפי יום', ['day', 'reminder_sent', 'people', 'reminder_run'], `
    SELECT toString(${D()}), countIf(event = 'reminder_sent'), uniqIf(person_id, event = 'reminder_sent'), countIf(event = 'reminder_run') FROM events
    WHERE timestamp >= toDateTime('${SINCE} 00:00:00', 'Asia/Jerusalem') AND event IN ('reminder_sent', 'reminder_run') GROUP BY 1 ORDER BY 1 LIMIT 60`);
  await section('10c. מצב התזכורות בפתיחה האחרונה של כל אדם (reminders על app_opened)', ['native', 'reminders', 'people', 'of them opened in the last 3 days'], `
    SELECT nat, r, count(), countIf(lastT >= now() - INTERVAL 3 DAY) FROM (
      SELECT person_id, argMax(${P('native')}, timestamp) AS nat, argMax(${P('reminders')}, timestamp) AS r, max(timestamp) AS lastT FROM events
      WHERE ${W} AND event = 'app_opened' AND ${P('source')} != 'resume' GROUP BY person_id) GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 20`);
  await section('10d. בקשת התזכורות: כמה פעמים אותו אדם נשאל', ['times asked', 'people', 'of them turned it on'], `
    SELECT multiIf(c = 1, '1', c = 2, '2', c <= 4, '3-4', '5+'), count(), countIf(on) FROM (
      SELECT person_id, countIf(event = 'push_popup_shown') AS c, max(event IN ('native_reminder_on', 'push_subscribed')) AS on FROM events
      WHERE ${W} AND event IN ('push_popup_shown', 'native_reminder_on', 'push_subscribed') GROUP BY person_id HAVING c > 0) GROUP BY 1 ORDER BY 1 LIMIT 10`);

  // ---------- 11. sessions and sources ----------
  await section('11. פתיחות: מקור (source) והפניה (ref)', ['source', 'ref', 'kind', 'native', 'people', 'opens'], `
    SELECT ${P('source')}, ${P('ref')}, ${P('kind')}, ${P('native')}, uniq(person_id), count() FROM events WHERE ${W} AND event = 'app_opened' GROUP BY 1, 2, 3, 4 ORDER BY 6 DESC LIMIT 50`);
  await section('11b. חזרה לאפליקציה שנשארה ברקע (resume): אחרי כמה זמן', ['away', 'opens', 'people'], `
    SELECT multiIf(toInt(properties.away_min) < 60, '10-59m', toInt(properties.away_min) < 360, '1-6h', toInt(properties.away_min) < 1440, '6-24h', '1d+'), count(), uniq(person_id)
    FROM events WHERE ${W} AND event = 'app_opened' AND ${P('source')} = 'resume' GROUP BY 1 ORDER BY 1 LIMIT 10`);

  // ---------- 12. tour, friends, features ----------
  await section('12. הסיור: איך נגמר ובאיזה צעד', ['screen', 'how', 'step', 'steps', 'people', 'times'], `
    SELECT ${P('screen')}, ${P('how')}, ${P('step')}, ${P('steps')}, uniq(person_id), count() FROM events WHERE ${W} AND event = 'tour_finished' GROUP BY 1, 2, 3, 4 ORDER BY 1, 6 DESC LIMIT 60`);
  await section('12b. חברים וקבוצות (כל הזמנים)', ['event', 'people', 'times'], `
    SELECT event, uniq(person_id), count() FROM events WHERE timestamp >= toDateTime('2026-11-01 00:00:00') AND ${T}
      AND (event LIKE 'group_%' OR event LIKE 'social_%' OR event LIKE 'friend%' OR event IN ('nick_set', 'share_clicked', 'share_completed', 'share_failed', 'invite_reward', 'unlock_all_reached'))
    GROUP BY 1 ORDER BY 2 DESC LIMIT 60`);
  await section('12c. שיתוף: מאיפה ואיך (כל הזמנים מאז 1.11)', ['from', 'method', 'event', 'people', 'times'], `
    SELECT ${P('from')}, ${P('method')}, event, uniq(person_id), count() FROM events WHERE timestamp >= toDateTime('2026-11-01 00:00:00') AND ${T} AND event IN ('share_clicked', 'share_completed', 'share_failed')
    GROUP BY 1, 2, 3 ORDER BY 5 DESC LIMIT 40`);
  await section('12d. פיצ\'רים שכמעט לא נוגעים בהם (מאז SINCE)', ['event', 'people', 'times'], `
    SELECT event, uniq(person_id), count() FROM events WHERE ${W} AND event IN ('daily_check_opened', 'daily_check_done', 'practice_started', 'practice_completed', 'repair_started', 'repair_completed',
      'mission_completed', 'goal_set', 'skin_set', 'skin_locked_tapped', 'tool_locked_tapped', 'term_opened', 'source_opened', 'calculator_used', 'calculator_official_clicked', 'plan_copied', 'invest_intent', 'invest_amount',
      'contact_opened', 'contact_sent', 'feedback_sent', 'review_asked', 'thanks_shown', 'thanks_tapped', 'energy_empty', 'energy_refill', 'day_off_used', 'streak_lost', 'days_off_intro_seen', 'tools_intro_seen', 'skins_intro_seen')
    GROUP BY 1 ORDER BY 2 DESC LIMIT 60`);
  await section('12e. רצף: הרצף הכי ארוך של כל אדם (streak על app_opened), כל הזמנים', ['max streak', 'people'], `
    SELECT multiIf(m = 0, '0', m = 1, '1', m = 2, '2', m <= 4, '3-4', m <= 9, '5-9', '10+') AS b, count() FROM (
      SELECT person_id, max(toInt(properties.streak)) AS m FROM events WHERE timestamp >= toDateTime('2026-09-01 00:00:00') AND ${T} AND event = 'app_opened' GROUP BY person_id) GROUP BY b ORDER BY b LIMIT 10`);

  // ---------- 13. cohorts ----------
  await block('13. קבוצות', async () => {
    const rows = await hogql(`
      SELECT person_id, toString(min(${D()})), argMin(${P('native')}, timestamp), argMin(${P('$geoip_country_code')}, timestamp), arrayStringConcat(arraySort(groupUniqArray(toString(${D()}))), ','),
        max(toInt(properties.lessons_done)), argMin(${P('platform')}, timestamp)
      FROM events WHERE timestamp >= toDateTime('2026-09-01 00:00:00') AND ${T} AND event = 'app_opened' GROUP BY person_id LIMIT 20000`);
    const today = now[0][0].slice(0, 10);
    const addDay = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
    const ppl = rows.filter((r) => r[3] === 'IL').map(([, d0, nat, , days, ld, plat]) => ({ d0, nat, plat, days: days.split(','), ld: Number(ld) || 0 }));
    const line = (xs) => {
      const base = (k) => xs.filter((o) => addDay(o.d0, k) < today);
      const ret = (k) => base(k).filter((o) => o.days.includes(addDay(o.d0, k))).length;
      const later = xs.filter((o) => o.d0 < today);
      return [xs.length, `${ret(1)}/${base(1).length}`, `${ret(3)}/${base(3).length}`, `${ret(7)}/${base(7).length}`, `${later.filter((o) => o.days.some((d) => d > o.d0)).length}/${later.length}`,
        xs.filter((o) => o.days.some((d) => d >= addDay(today, -6))).length, xs.filter((o) => o.ld >= 1).length, xs.filter((o) => o.ld >= 5).length];
    };
    const wk = {};
    for (const o of ppl) { const d = new Date(o.d0 + 'T12:00:00Z'); const w = addDay(o.d0, -d.getUTCDay()); (wk[w] = wk[w] || []).push(o); }
    const HEAD = ['group', 'new IL people', 'D1', 'D3', 'D7', 'any later day', 'active in the last 7 days', 'did 1+ lessons', 'did 5+ lessons'];
    print('13. לפי שבוע הגעה (כל הזמנים, ישראל)', HEAD, Object.entries(wk).sort().map(([w, xs]) => [w, ...line(xs)]));
    const kind = (o) => (o.nat === 'ios' ? 'App Store app' : o.nat === 'android' ? 'Play app' : `web ${o.plat}`);
    const bk = {};
    for (const o of ppl.filter((x) => x.d0 >= SINCE)) (bk[kind(o)] = bk[kind(o)] || []).push(o);
    print(`13b. אפליקציה מהחנות מול אתר (חדשים מאז ${SINCE})`, HEAD, Object.entries(bk).map(([k, xs]) => [k, ...line(xs)]));
    print('13c. כל הזמנים', HEAD, [['all IL', ...line(ppl)]]);
  });

  // ---------- 14. landing page and the App Store redirect ----------
  await section('14. dribit.app: ביקורים, לחיצות, לפי מערכת (מאז SINCE)', ['day', 'os', 'landing_view people', 'landing_cta people', 'landing_leave people'], `
    SELECT toString(${D()}), ${P('$os')}, uniqIf(distinct_id, event = 'landing_view'), uniqIf(distinct_id, event = 'landing_cta'), uniqIf(distinct_id, event = 'landing_leave')
    FROM events WHERE timestamp >= toDateTime('${NEW_FROM}:00', 'Asia/Jerusalem') - INTERVAL 3 DAY AND ${T} AND event IN ('landing_view', 'landing_cta', 'landing_leave') GROUP BY 1, 2 ORDER BY 1, 3 DESC LIMIT 80`);
  await section('14b. dribit.app: מאפיינים של landing_cta (לאן נשלחו)', ['to / target / store', 'platform', 'people'], `
    SELECT concat(${P('to')}, ' / ', ${P('target')}, ' / ', ${P('store')}, ' / ', ${P('auto')}), ${P('platform')}, uniq(distinct_id) FROM events
    WHERE timestamp >= toDateTime('${NEW_FROM}:00', 'Asia/Jerusalem') - INTERVAL 3 DAY AND ${T} AND event = 'landing_cta' GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 30`);
})().catch((e) => { console.error(String((e && e.message) || e)); process.exit(1); });
