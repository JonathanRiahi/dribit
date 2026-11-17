/* Funnel check (17.11.2026): where do new people drop off? For every new person in Israel (first app_opened ever since FROM):
   saw the first screen -> started lesson 1 -> answered a question -> finished lesson 1 -> came back another day.
   Split by period (before / after 0.29.0 home-first, 13.11 12:05 Israel) and by how they arrived.
   Prints counts only (the Actions log is public). Team devices are left out (tools/team.js).
   Run: node tools/funnel-check.js  (or Actions > Funnel check). Env FROM 'YYYY-MM-DD HH:MM' Israel, LONG_FROM 'YYYY-MM-DD'. */
'use strict';

const API_KEY = (process.env.POSTHOG_API_KEY || '').trim();
const PH_API = (process.env.POSTHOG_API_HOST || 'https://eu.posthog.com').replace(/\/$/, '');
let PROJECT = (process.env.POSTHOG_PROJECT_ID || '').trim();
const FROM = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(process.env.FROM || '') ? process.env.FROM : '2026-11-10 00:00';
const LONG_FROM = /^\d{4}-\d{2}-\d{2}$/.test(process.env.LONG_FROM || '') ? process.env.LONG_FROM : '2026-10-27';
const HOME_FIRST = '2026-11-13 12:05';
const { loadTeam } = require('./team');

async function api(pathname, body) {
  const r = await fetch(PH_API + pathname, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok) throw new Error(`PostHog ${pathname} answered ${r.status}: ${(await r.text()).replace(/\s+/g, ' ').slice(0, 200)}`);
  return r.json();
}
async function hogql(query) {
  const j = await api(`/api/projects/${PROJECT}/query/`, { query: { kind: 'HogQLQuery', query }, refresh: 'force_blocking' });
  return j.results || [];
}
const IL = (x) => `toTimeZone(${x || 'timestamp'}, 'Asia/Jerusalem')`;
const CTRY = "if(toString(properties.$geoip_country_code) = 'IL', 'IL', 'abroad')";
const pct = (a, b) => (b ? `${a}/${b} (${Math.round((100 * a) / b)}%)` : `${a}/0`);
const print = (title, head, rows) => {
  console.log(`\n=== ${title} ===`);
  console.log('  ' + head.join(' | '));
  for (const r of rows) console.log('  ' + r.map((x) => (x === null || x === undefined ? '-' : String(x))).join(' | '));
};
const how = (src, ref) => (ref === 'lp_tiktok' ? 'link inside TikTok' : /^lp_.*google/.test(ref) ? 'Google app' : ref === 'lp_direct' ? 'typed dribit.app'
  : ref === 'lp_ig' ? 'Instagram' : src === 'homescreen' ? 'home screen icon' : ref === 'share' ? 'friend invite' : `other: ${src} ${ref}`);

(async () => {
  if (!API_KEY) throw new Error('POSTHOG_API_KEY is missing.');
  if (!PROJECT) PROJECT = String(((await api('/api/projects/')).results || [])[0].id);
  const now = await hogql(`SELECT toString(${IL('now()')}), toString(toDate(${IL('now()')}))`);
  const today = now[0][1];
  console.log(`Funnel check, new people since ${FROM} (Israel). Now: ${now[0][0]}`);
  const team = await loadTeam(hogql);
  const T = team.not();
  console.log(team.line());

  const FIRST = `
    SELECT person_id, min(timestamp) AS t0, argMin(toString(properties.source), timestamp) AS src,
      argMin(toString(properties.ref), timestamp) AS ref, argMin(${CTRY}, timestamp) AS c,
      argMin(toString(properties.in_app), timestamp) AS inapp
    FROM events WHERE event = 'app_opened' AND timestamp >= toDateTime('2026-09-01 00:00:00') AND ${T}
    GROUP BY person_id`;
  const perPerson = (from) => hogql(`
    SELECT toString(toDate(${IL('n.t0')})) AS d0, toString(${IL('n.t0')}) AS t0s, n.src, n.ref, n.c, n.inapp,
      max(e.event = 'start_screen_shown'), max(e.event = 'lesson_started'), max(e.event = 'step_viewed'),
      max(e.event = 'question_answered'), max(e.event = 'lesson_completed'),
      uniqIf(toString(e.properties.lesson_id), e.event = 'lesson_completed' AND toString(e.properties.mode) = 'lesson'),
      uniqIf(toString(e.properties.lesson_id), e.event = 'lesson_started'),
      arrayStringConcat(arraySort(groupUniqArrayIf(toString(toDate(${IL('e.timestamp')})), e.event = 'app_opened')), ','),
      max(e.event = 'status_set'), max(e.event = 'push_subscribed'), max(e.event = 'app_installed'),
      max(e.event = 'push_popup_shown'), max(e.event = 'install_popup_shown'), max(e.event = 'tour_started'),
      argMaxIf(toString(e.properties.lesson_id), e.timestamp, e.event = 'step_viewed'),
      argMaxIf(toInt(e.properties.step_index), e.timestamp, e.event = 'step_viewed'),
      argMaxIf(toString(e.properties.step_kind), e.timestamp, e.event = 'step_viewed'),
      argMaxIf(toInt(e.properties.step_count), e.timestamp, e.event = 'step_viewed'),
      argMax(e.event, e.timestamp),
      dateDiff('second', min(e.timestamp), maxIf(e.timestamp, toDate(${IL('e.timestamp')}) = toDate(${IL('n.t0')}))),
      minIf(toFloat(e.properties.duration_sec), e.event = 'lesson_completed')
    FROM events e INNER JOIN (SELECT * FROM (${FIRST}) WHERE t0 >= toDateTime('${from}:00', 'Asia/Jerusalem')) n ON e.person_id = n.person_id
    WHERE e.timestamp >= toDateTime('${from}:00', 'Asia/Jerusalem') - INTERVAL 1 HOUR
      AND e.event NOT IN ('reminder_sent', 'push_unsubscribed')
    GROUP BY e.person_id, n.t0, n.src, n.ref, n.c, n.inapp
    LIMIT 10000`); // HogQL returns only 100 rows without a LIMIT
  const K = ['d0', 't0', 'src', 'ref', 'c', 'inapp', 'shown', 'ls', 'sv', 'qa', 'lc', 'ndone', 'nstarted', 'days', 'status', 'push', 'inst',
    'pushPop', 'instPop', 'tour', 'lastLesson', 'lastStep', 'lastKind', 'stepCount', 'lastEvent', 'secsDay0', 'firstDur'];
  const obj = (r) => { const o = {}; K.forEach((k, i) => { o[k] = r[i]; }); o.ok = (k) => Number(o[k]) === 1; o.how = how(o.src, o.ref); return o; };
  const addDay = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const enrich = (o) => {
    const days = (o.days || '').split(',').filter(Boolean);
    o.d1 = days.includes(addDay(o.d0, 1));
    o.later = days.some((d) => d > o.d0);
    o.d1ok = addDay(o.d0, 1) < today; // the next day is over
    o.laterok = o.d0 < today;
    return o;
  };

  const all = (await perPerson(FROM)).map(obj).map(enrich);
  const il = all.filter((o) => o.c === 'IL');
  console.log(`\nNew people since ${FROM}: ${all.length} (Israel ${il.length}, abroad ${all.length - il.length}). Below: Israel only.`);

  const funnel = (xs) => {
    const n = xs.length, f = (k) => xs.filter((o) => o.ok(k)).length;
    const lc = xs.filter((o) => o.ok('lc'));
    const d1Base = xs.filter((o) => o.d1ok), laterBase = xs.filter((o) => o.laterok);
    return [n, pct(f('shown'), n), pct(f('ls'), n), pct(f('qa'), n), pct(f('lc'), n), pct(xs.filter((o) => Number(o.ndone) >= 2).length, n),
      pct(d1Base.filter((o) => o.d1).length, d1Base.length), pct(laterBase.filter((o) => o.later).length, laterBase.length),
      pct(lc.filter((o) => o.laterok && o.later).length, lc.filter((o) => o.laterok).length)];
  };
  const HEAD = ['group', 'new people', 'saw first screen', 'started a lesson', 'answered a question', 'finished lesson 1', 'finished 2+ lessons',
    'came back next day (D1, of those whose next day is over)', 'came back any later day', 'of finishers: came back later'];
  const before = il.filter((o) => o.t0 < HOME_FIRST), after = il.filter((o) => o.t0 >= HOME_FIRST);
  print('המשפך: חדשים בישראל', HEAD, [['all', ...funnel(il)], ['before 0.29 (one button)', ...funnel(before)], ['after 0.29 (home with path)', ...funnel(after)]]);

  const byHow = {};
  for (const o of il) (byHow[o.how] = byHow[o.how] || []).push(o);
  print('המשפך לפי דרך ההגעה (ישראל)', HEAD, Object.entries(byHow).sort((a, b) => b[1].length - a[1].length).map(([k, xs]) => [k, ...funnel(xs)]));
  const typed = (xs) => xs.filter((o) => o.how === 'typed dribit.app' || o.how === 'Google app');
  print('רק מי שהקליד dribit.app או חיפש בגוגל (= TikTok אורגני), לפני ואחרי 0.29', HEAD,
    [['before 0.29', ...funnel(typed(before))], ['after 0.29', ...funnel(typed(after))]]);
  const byInApp = {};
  for (const o of il) (byInApp[o.inapp || 'none'] = byInApp[o.inapp || 'none'] || []).push(o);
  print('המשפך לפי דפדפן בתוך אפליקציה (in_app)', HEAD, Object.entries(byInApp).map(([k, xs]) => [k, ...funnel(xs)]));

  // where the starters who did not finish stopped
  const quit = {};
  for (const o of il.filter((x) => x.ok('ls') && !x.ok('lc'))) {
    const k = `lesson ${o.lastLesson} | step ${o.lastStep === null ? '-' : Number(o.lastStep) + 1} of ${o.stepCount} | ${o.lastKind}`;
    quit[k] = (quit[k] || 0) + 1;
  }
  print('התחילו שיעור ולא סיימו: הצעד האחרון שראו', ['where', 'people'], Object.entries(quit).sort((a, b) => b[1] - a[1]));
  const nost = {};
  for (const o of il.filter((x) => !x.ok('ls'))) nost[o.lastEvent] = (nost[o.lastEvent] || 0) + 1;
  print('לא התחילו שיעור: האירוע האחרון', ['last event', 'people'], Object.entries(nost).sort((a, b) => b[1] - a[1]));
  const secs = (xs) => { const b = { '0-9s': 0, '10-59s': 0, '1-5m': 0, '5m+': 0 }; for (const o of xs) { const s = Number(o.secsDay0) || 0; b[s < 10 ? '0-9s' : s < 60 ? '10-59s' : s < 300 ? '1-5m' : '5m+']++; } return Object.entries(b); };
  print('לא התחילו שיעור: כמה זמן היו ביום הראשון', ['time', 'people'], secs(il.filter((x) => !x.ok('ls'))));

  // the finishers: what happened after lesson 1, and who came back
  const fin = il.filter((o) => o.ok('lc'));
  const cnt = (xs, k) => xs.filter((o) => o.ok(k)).length;
  print('סיימו שיעור 1: מה קרה אחר כך', ['finishers', 'answered status question', 'saw push popup', 'turned on push', 'saw install popup', 'installed', 'tour', 'started a 2nd lesson', 'finished 2+'],
    [[fin.length, cnt(fin, 'status'), cnt(fin, 'pushPop'), cnt(fin, 'push'), cnt(fin, 'instPop'), cnt(fin, 'inst'), cnt(fin, 'tour'),
      fin.filter((o) => Number(o.nstarted) >= 2).length, fin.filter((o) => Number(o.ndone) >= 2).length]]);
  const lessonsDay = {};
  for (const o of fin) { const k = Number(o.ndone) >= 5 ? '5+' : String(o.ndone); lessonsDay[k] = (lessonsDay[k] || 0) + 1; }
  print('סיימו שיעור 1: כמה שיעורים סיימו בסך הכל', ['lessons', 'people'], Object.entries(lessonsDay).sort());
  const fl = {};
  for (const o of fin.filter((x) => x.laterok && !x.later)) fl[o.lastEvent] = (fl[o.lastEvent] || 0) + 1;
  print('סיימו ולא חזרו: האירוע האחרון שלהם', ['last event', 'people'], Object.entries(fl).sort((a, b) => b[1] - a[1]));
  print('חזרה לפי הפעלת תזכורות (מסיימים)', ['push on', 'finishers (later day possible)', 'came back later'],
    [true, false].map((p) => { const xs = fin.filter((o) => o.laterok && o.ok('push') === p); return [p ? 'yes' : 'no', xs.length, xs.filter((o) => o.later).length]; }));
  print('חזרה לפי התקנה (מסיימים)', ['installed / home icon', 'finishers (later day possible)', 'came back later'],
    [true, false].map((p) => { const xs = fin.filter((o) => o.laterok && (o.ok('inst') || o.src === 'homescreen') === p); return [p ? 'yes' : 'no', xs.length, xs.filter((o) => o.later).length]; }));

  // per day of arrival
  const byDay = {};
  for (const o of il) (byDay[o.d0] = byDay[o.d0] || []).push(o);
  print('לפי יום ההגעה (ישראל)', ['day', ...HEAD.slice(1)], Object.entries(byDay).sort().map(([d, xs]) => [d, ...funnel(xs)]));

  // landing page visitors in the same days (most TikTok in-app visits lose landing_view; app_opened is the real count)
  print('dribit.app (ישראל) באותם ימים', ['day', 'landing visitors', 'tapped the start button on the landing'], await hogql(`
    SELECT toDate(${IL()}) AS d, uniqIf(distinct_id, event = 'landing_view'), uniqIf(distinct_id, event = 'landing_cta')
    FROM events WHERE event IN ('landing_view', 'landing_cta') AND timestamp >= toDateTime('${FROM}:00', 'Asia/Jerusalem') AND ${CTRY} = 'IL' AND ${T}
    GROUP BY d ORDER BY d`));

  // longer history by week, for a bigger D1 base
  const long = (await perPerson(`${LONG_FROM} 00:00`)).map(obj).map(enrich).filter((o) => o.c === 'IL');
  const wk = {};
  for (const o of long) { const d = new Date(o.d0 + 'T12:00:00Z'); const w = addDay(o.d0, -((d.getUTCDay() + 7) % 7)); (wk[w] = wk[w] || []).push(o); }
  print(`לפי שבוע הגעה מאז ${LONG_FROM} (שבוע מתחיל ביום א', ישראל)`, ['week of', ...HEAD.slice(1)], Object.entries(wk).sort().map(([d, xs]) => [d, ...funnel(xs)]));
  print(`כל התקופה מאז ${LONG_FROM} (ישראל)`, HEAD, [['all', ...funnel(long)]]);
  const finL = long.filter((o) => o.ok('lc') && o.laterok);
  print(`מאז ${LONG_FROM}: חזרה בקרב מסיימים, לפי כמה שיעורים סיימו בסך הכל`, ['lessons finished', 'people', 'came back later'],
    ['1', '2', '3+'].map((k) => { const xs = finL.filter((o) => (k === '3+' ? Number(o.ndone) >= 3 : String(o.ndone) === k)); return [k, xs.length, xs.filter((o) => o.later).length]; }));
})().catch((e) => { console.error(String((e && e.message) || e)); process.exit(1); });
