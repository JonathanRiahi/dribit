/* Promo check (25.11.2026): did the TikTok paid promotion of 24-25.11 bring people? Counts only (the Actions log is public).
   Paid clicks land on dribit.app; iPhones go on to the App Store (landing-6), the rest open the web app.
   Same secrets as tools/traffic-check.js. Run: Actions > Promo check, or a push to its branch. */
'use strict';
const API_KEY = (process.env.POSTHOG_API_KEY || '').trim();
const PH_API = 'https://eu.posthog.com';
let PROJECT = (process.env.POSTHOG_PROJECT_ID || '').trim();
const FROM = /^\d{4}-\d{2}-\d{2}$/.test(process.env.FROM || '') ? process.env.FROM : '2026-11-24';
const BASE = /^\d{4}-\d{2}-\d{2}$/.test(process.env.BASE || '') ? process.env.BASE : '2026-11-15';
const { loadTeam } = require('./team');
async function api(p, body) {
  const r = await fetch(PH_API + p, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`PostHog ${p} answered ${r.status}: ${(await r.text()).replace(/\s+/g, ' ').slice(0, 300)}`);
  return r.json();
}
const hogql = async (query) => ((await api(`/api/projects/${PROJECT}/query/`, { query: { kind: 'HogQLQuery', query }, refresh: 'force_blocking' })).results || []);
const IL = "toTimeZone(timestamp, 'Asia/Jerusalem')";
const CTRY = "if(toString(properties.$geoip_country_code) = 'IL', 'IL', 'abroad')";
const print = (title, head, rows) => {
  console.log(`\n=== ${title} ===`); console.log('  ' + head.join(' | '));
  for (const r of rows) console.log('  ' + r.map((x) => (x === null || x === undefined ? '-' : String(x))).join(' | '));
};
const safe = async (title, head, q) => { try { print(title, head, await hogql(q)); } catch (e) { console.log(`\n=== ${title} === FAILED: ${e.message}`); } };
(async () => {
  if (!PROJECT) PROJECT = String(((await api('/api/projects/')).results || [])[0].id);
  const team = await loadTeam(hogql); const T = team.not(); console.log(team.line());
  const LV = `event = 'landing_view' AND timestamp >= toDateTime('${BASE} 00:00:00', 'Asia/Jerusalem') AND ${T}`;
  await safe('dribit.app landing_view per day: country, platform, paid, where it sent them', ['day', 'country', 'platform', 'paid', 'to', 'in_app', 'visitors'], `
    SELECT toDate(${IL}) AS d, ${CTRY} AS c, toString(properties.platform), toString(properties.paid), toString(properties.to), toString(properties.in_app), uniq(distinct_id)
    FROM events WHERE ${LV} AND toDate(${IL}) >= toDate('${FROM}') GROUP BY d, c, 3, 4, 5, 6 ORDER BY d, c, 7 DESC LIMIT 500`);
  await safe('paid landing_view per hour (Israel): when the promo ran', ['day', 'hour', 'IL ios', 'IL android', 'IL other', 'abroad'], `
    SELECT toDate(${IL}) AS d, toHour(${IL}) AS h,
      uniqIf(distinct_id, ${CTRY} = 'IL' AND toString(properties.platform) = 'ios'),
      uniqIf(distinct_id, ${CTRY} = 'IL' AND toString(properties.platform) = 'android'),
      uniqIf(distinct_id, ${CTRY} = 'IL' AND toString(properties.platform) NOT IN ('ios', 'android')),
      uniqIf(distinct_id, ${CTRY} = 'abroad')
    FROM events WHERE ${LV} AND (toString(properties.paid) = 'true' OR toString(properties.in_app) = 'tiktok') AND toDate(${IL}) >= toDate('${FROM}')
    GROUP BY d, h ORDER BY d, h LIMIT 500`);
  await safe('paid landing_view: utm / campaign', ['country', 'source', 'utm_campaign', 'utm_content', 'visitors'], `
    SELECT ${CTRY}, toString(properties.source), toString(properties.utm_campaign), toString(properties.utm_content), uniq(distinct_id)
    FROM events WHERE ${LV} AND toString(properties.paid) = 'true' AND toDate(${IL}) >= toDate('${FROM}') GROUP BY 1, 2, 3, 4 ORDER BY 5 DESC LIMIT 50`);
  // new people per day by first surface/source, with lesson start and finish (baseline vs promo days)
  const FIRST = `SELECT person_id, min(timestamp) AS t0, argMin(toString(properties.source), timestamp) AS src,
      argMin(toString(properties.ref), timestamp) AS ref, argMin(${CTRY}, timestamp) AS c
    FROM events WHERE event = 'app_opened' AND timestamp >= toDateTime('2026-10-01 00:00:00') AND ${T} GROUP BY person_id`;
  await safe(`new IL app people per day since ${BASE}: how they came, started / finished a lesson`, ['day', 'how', 'new', 'started lesson', 'finished lesson', 'finished 2+'], `
    SELECT toDate(toTimeZone(n.t0, 'Asia/Jerusalem')) AS d,
      multiIf(n.src = 'ios', 'App Store app', n.ref = 'lp_tiktok', 'TikTok in-app link (web)', n.src = 'android', 'Android app', startsWith(coalesce(n.ref, ''), 'lp_'), concat('web ', n.ref), concat('other ', n.src)) AS how,
      count(), countIf(s > 0), countIf(f > 0), countIf(f > 1)
    FROM (SELECT n.person_id AS pid, any(n.t0) AS t0, any(n.src) AS src, any(n.ref) AS ref,
            countIf(e.event = 'lesson_started') AS s, uniqIf(toString(e.properties.lesson_id), e.event = 'lesson_completed') AS f
          FROM events e INNER JOIN (${FIRST}) n ON e.person_id = n.person_id
          WHERE n.c = 'IL' AND n.t0 >= toDateTime('${BASE} 00:00:00', 'Asia/Jerusalem') AND e.timestamp >= toDateTime('${BASE} 00:00:00', 'Asia/Jerusalem') AND ${team.not('e.')}
          GROUP BY n.person_id) AS n
    GROUP BY d, how ORDER BY d, how LIMIT 500`);
  await safe(`App Store app first opens per hour since ${FROM} (IL)`, ['day', 'hour', 'new App Store app people'], `
    SELECT toDate(toTimeZone(t0, 'Asia/Jerusalem')) AS d, toHour(toTimeZone(t0, 'Asia/Jerusalem')), count()
    FROM (${FIRST}) WHERE src = 'ios' AND c = 'IL' AND t0 >= toDateTime('${FROM} 00:00:00', 'Asia/Jerusalem') GROUP BY d, 2 ORDER BY d, 2 LIMIT 200`);
})().catch((e) => { console.error(e.message); process.exit(1); });
