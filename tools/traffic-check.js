/* Traffic check (9.11.2026): did a TikTok video change visits? Visits to dribit.app and new app people,
   per day and per hour (Israel time), Israel vs abroad. Prints counts only (the Actions log is public).
   Same secrets as tools/leak-check.js. Run: node tools/traffic-check.js  (or Actions > Traffic check) */
'use strict';

const API_KEY = (process.env.POSTHOG_API_KEY || '').trim();
const PH_API = (process.env.POSTHOG_API_HOST || 'https://eu.posthog.com').replace(/\/$/, '');
const SINCE = /^\d{4}-\d{2}-\d{2}$/.test(process.env.SINCE || '') ? process.env.SINCE : '2026-11-02';
const HOURS_FROM = /^\d{4}-\d{2}-\d{2}$/.test(process.env.HOURS_FROM || '') ? process.env.HOURS_FROM : '2026-11-06';
let PROJECT = (process.env.POSTHOG_PROJECT_ID || '').trim();

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
const IL = "toTimeZone(timestamp, 'Asia/Jerusalem')";
const PAID = "(properties.$current_url LIKE '%ttclid%' OR properties.$current_url LIKE '%utm_%')";
const CTRY = "if(toString(properties.$geoip_country_code) = 'IL', 'IL', 'abroad')";
const print = (title, head, rows) => {
  console.log(`\n=== ${title} ===`);
  console.log('  ' + head.join(' | '));
  for (const r of rows) console.log('  ' + r.map((x) => (x === null || x === undefined ? '-' : String(x))).join(' | '));
};

// first app_opened ever per person (new app people)
const FIRST_OPEN = `
  SELECT person_id, min(timestamp) AS t0,
    argMin(toString(properties.source), timestamp) AS src, argMin(toString(properties.ref), timestamp) AS ref,
    argMin(${CTRY}, timestamp) AS c
  FROM events WHERE event = 'app_opened' AND timestamp >= toDateTime('2026-10-01 00:00:00')
  GROUP BY person_id`;

(async () => {
  if (!API_KEY) throw new Error('POSTHOG_API_KEY is missing.');
  if (!PROJECT) PROJECT = String(((await api('/api/projects/')).results || [])[0].id);
  const now = await hogql(`SELECT toString(toTimeZone(now(), 'Asia/Jerusalem'))`);
  console.log(`Traffic check, days since ${SINCE}, hours since ${HOURS_FROM} (Israel time). Now: ${now[0] && now[0][0]}`);

  print('לפי יום: dribit.app', ['day', 'visitors IL organic', 'IL paid', 'abroad', 'app_boot IL', 'all $pageview people IL'], await hogql(`
    SELECT toDate(${IL}) AS d,
      uniqIf(distinct_id, event = 'landing_view' AND ${CTRY} = 'IL' AND NOT ${PAID}),
      uniqIf(distinct_id, event = 'landing_view' AND ${CTRY} = 'IL' AND ${PAID}),
      uniqIf(distinct_id, event = 'landing_view' AND ${CTRY} = 'abroad'),
      uniqIf(distinct_id, event = 'app_boot' AND ${CTRY} = 'IL'),
      uniqIf(person_id, event = '$pageview' AND ${CTRY} = 'IL')
    FROM events WHERE timestamp >= toDateTime('${SINCE} 00:00:00') - INTERVAL 3 HOUR
      AND event IN ('landing_view', 'app_boot', '$pageview') AND toDate(${IL}) >= toDate('${SINCE}')
    GROUP BY d ORDER BY d`));

  print('לפי יום: אפליקציה', ['day', 'app people IL (any open)', 'new app people IL', 'new IL via dribit.app (ref lp_)', 'new abroad', 'lesson started IL people', 'lesson completed IL people'], await hogql(`
    SELECT x.d, x.a, coalesce(n.ni, 0), coalesce(n.nl, 0), coalesce(n.na, 0), x.ls, x.lc FROM
      (SELECT toDate(${IL}) AS d,
          uniqIf(person_id, event = 'app_opened' AND ${CTRY} = 'IL') AS a,
          uniqIf(person_id, event = 'lesson_started' AND ${CTRY} = 'IL') AS ls,
          uniqIf(person_id, event = 'lesson_completed' AND ${CTRY} = 'IL') AS lc
        FROM events WHERE timestamp >= toDateTime('${SINCE} 00:00:00') - INTERVAL 3 HOUR
          AND event IN ('app_opened', 'lesson_started', 'lesson_completed') AND toDate(${IL}) >= toDate('${SINCE}')
        GROUP BY d) x
    LEFT JOIN
      (SELECT toDate(toTimeZone(t0, 'Asia/Jerusalem')) AS d, countIf(c = 'IL') AS ni,
          countIf(c = 'IL' AND startsWith(coalesce(ref, ''), 'lp_')) AS nl, countIf(c = 'abroad') AS na
        FROM (${FIRST_OPEN}) GROUP BY d) n ON x.d = n.d
    ORDER BY x.d`));

  print(`לפי שעה (ישראל) מ-${HOURS_FROM}`, ['day', 'hour', 'dribit.app visitors IL', 'abroad', 'new app people IL', 'app people IL (any open)'], await hogql(`
    SELECT x.d, x.h, x.v, x.ab, coalesce(n.ni, 0), x.a FROM
      (SELECT toDate(${IL}) AS d, toHour(${IL}) AS h,
          uniqIf(distinct_id, event = 'landing_view' AND ${CTRY} = 'IL') AS v,
          uniqIf(distinct_id, event = 'landing_view' AND ${CTRY} = 'abroad') AS ab,
          uniqIf(person_id, event = 'app_opened' AND ${CTRY} = 'IL') AS a
        FROM events WHERE timestamp >= toDateTime('${HOURS_FROM} 00:00:00') - INTERVAL 3 HOUR
          AND event IN ('landing_view', 'app_opened') AND toDate(${IL}) >= toDate('${HOURS_FROM}')
        GROUP BY d, h) x
    LEFT JOIN
      (SELECT toDate(toTimeZone(t0, 'Asia/Jerusalem')) AS d, toHour(toTimeZone(t0, 'Asia/Jerusalem')) AS h, countIf(c = 'IL') AS ni
        FROM (${FIRST_OPEN}) GROUP BY d, h) n ON x.d = n.d AND x.h = n.h
    WHERE x.v > 0 OR x.ab > 0 OR x.a > 0
    ORDER BY x.d, x.h`));

  print(`אנשים חדשים באפליקציה מ-${HOURS_FROM}: מאיפה`, ['day', 'country', 'source', 'ref', 'people'], await hogql(`
    SELECT toDate(toTimeZone(t0, 'Asia/Jerusalem')) AS d, c, src, ref, count()
    FROM (${FIRST_OPEN}) WHERE t0 >= toDateTime('${HOURS_FROM} 00:00:00') - INTERVAL 3 HOUR
    GROUP BY d, c, src, ref ORDER BY d, 5 DESC`));

  print(`ביקורים ב-dribit.app מ-${HOURS_FROM}: מקור והפניה`, ['day', 'country', 'source', 'referrer domain', 'in_app', 'visitors'], await hogql(`
    SELECT toDate(${IL}) AS d, ${CTRY}, toString(properties.source), toString(properties.$referring_domain), toString(properties.in_app), uniq(distinct_id)
    FROM events WHERE event = 'landing_view' AND timestamp >= toDateTime('${HOURS_FROM} 00:00:00') - INTERVAL 3 HOUR
    GROUP BY d, 2, 3, 4, 5 ORDER BY d, 6 DESC`));
  // where the new people stop: everyone whose first app open is after NEW_FROM (Israel time)
  const NEW_FROM = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(process.env.NEW_FROM || '') ? process.env.NEW_FROM : '2026-11-09 19:00';
  const NEWP = `SELECT person_id, c FROM (${FIRST_OPEN}) WHERE t0 >= toDateTime('${NEW_FROM}:00', 'Asia/Jerusalem')`;
  const PER = `
    SELECT e.person_id AS pid, n.c AS c,
      max(if(e.event = 'onboarding_done', 1, 0)) AS ob, max(if(e.event = 'lesson_started', 1, 0)) AS ls,
      max(if(e.event = 'step_viewed', 1, 0)) AS sv, maxIf(toInt(e.properties.step_index), e.event = 'step_viewed') AS maxstep,
      max(if(e.event = 'question_answered', 1, 0)) AS qa, max(if(e.event = 'lesson_completed', 1, 0)) AS lc,
      dateDiff('second', min(e.timestamp), max(e.timestamp)) AS secs,
      argMinIf(toString(e.properties.in_app), e.timestamp, e.event = 'app_opened') AS inapp,
      argMinIf(toString(e.properties.$os), e.timestamp, e.event = 'app_opened') AS os,
      count() AS nev
    FROM events e INNER JOIN (${NEWP}) n ON e.person_id = n.person_id
    WHERE e.timestamp >= toDateTime('${NEW_FROM}:00', 'Asia/Jerusalem') - INTERVAL 1 HOUR
    GROUP BY e.person_id, n.c`;
  print(`אנשים חדשים מאז ${NEW_FROM}: איפה עוצרים`, ['country', 'people', 'onboarding_done (tapped start)', 'lesson_started', 'saw a lesson step', 'answered a question', 'lesson_completed'], await hogql(`
    SELECT c, count(), sum(ob), sum(ls), sum(sv), sum(qa), sum(lc) FROM (${PER}) GROUP BY c ORDER BY c`));
  print(`אנשים חדשים מאז ${NEW_FROM} (ישראל): כמה זמן היו באפליקציה`, ['time from first to last event', 'people', 'tapped start'], await hogql(`
    SELECT multiIf(secs < 5, '0-4s', secs < 15, '5-14s', secs < 60, '15-59s', secs < 300, '1-5m', '5m+') AS b, count(), sum(ob)
    FROM (${PER}) WHERE c = 'IL' GROUP BY b ORDER BY b`));
  print(`אנשים חדשים מאז ${NEW_FROM} (ישראל): עד איזה צעד בשיעור`, ['max step index', 'people'], await hogql(`
    SELECT if(sv = 0, 'no step', toString(maxstep)) AS k, count() FROM (${PER}) WHERE c = 'IL' GROUP BY k ORDER BY k`));
  print(`אנשים חדשים מאז ${NEW_FROM} (ישראל): דפדפן ומערכת`, ['in_app', 'os', 'people', 'tapped start', 'events (sum)'], await hogql(`
    SELECT inapp, os, count(), sum(ob), sum(nev) FROM (${PER}) WHERE c = 'IL' GROUP BY inapp, os ORDER BY 3 DESC`));
  print(`אנשים חדשים מאז ${NEW_FROM} (ישראל): אילו אירועים שלחו`, ['event', 'people', 'count'], await hogql(`
    SELECT e.event, uniq(e.person_id), count() FROM events e INNER JOIN (${NEWP}) n ON e.person_id = n.person_id
    WHERE n.c = 'IL' AND e.timestamp >= toDateTime('${NEW_FROM}:00', 'Asia/Jerusalem') - INTERVAL 1 HOUR
    GROUP BY e.event ORDER BY 2 DESC LIMIT 30`));
})().catch((e) => { console.error(String((e && e.message) || e)); process.exit(1); });
