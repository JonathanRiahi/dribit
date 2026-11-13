/* Landing leak check (3.11.2026): of the people who reach dribit.app, how many really saw the page, how fast they
   left, where they came from (paid TikTok clicks carry ttclid), and how many of them opened the app.
   Prints counts only (the Actions log of this repository is public). Same secrets as tools/retention-report.js.
   Run: node tools/leak-check.js   (or Actions > Leak check > Run workflow) */
'use strict';

const API_KEY = (process.env.POSTHOG_API_KEY || '').trim();
const PH_API = (process.env.POSTHOG_API_HOST || 'https://eu.posthog.com').replace(/\/$/, '');
const SINCE = /^\d{4}-\d{2}-\d{2}$/.test(process.env.SINCE || '') ? process.env.SINCE : '2026-10-25';
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
const DAY = "toDate(toTimeZone(timestamp, 'Asia/Jerusalem'))";
let WHEN = `timestamp >= toDateTime('${SINCE} 00:00:00')`; // + not the team (tools/team.js), added once it is loaded
const { loadTeam } = require('./team');
const PAID = "(properties.$current_url LIKE '%ttclid%' OR properties.$current_url LIKE '%utm_%')";
const print = (title, head, rows) => {
  console.log(`\n=== ${title} ===`);
  console.log('  ' + head.join(' | '));
  for (const r of rows) console.log('  ' + r.map((x) => (x === null || x === undefined ? '-' : String(x))).join(' | '));
};

(async () => {
  if (!API_KEY) throw new Error('POSTHOG_API_KEY is missing.');
  if (!PROJECT) PROJECT = String(((await api('/api/projects/')).results || [])[0].id);
  console.log(`Leak check since ${SINCE} (Israel days).`);
  const team = await loadTeam(hogql);
  const WHEN0 = WHEN;
  WHEN = `${WHEN0} AND ${team.not()}`;
  console.log(team.line());

  // 1. per day: landing visitors, paid-looking visitors, tapped start, app opens that came from dribit.app (ref lp_...)
  print('לפי יום', ['day', 'landing visitors', 'paid (ttclid/utm)', 'tapped start', 'app opens ref lp_ (people)', 'of them new (returning=false)'],
    await hogql(`
      SELECT d,
        uniqIf(distinct_id, event = 'landing_view'),
        uniqIf(distinct_id, event = 'landing_view' AND ${PAID}),
        uniqIf(distinct_id, event = 'landing_cta' AND properties.cta IN ('start_now', 'joined_try', 'footer_try')),
        uniqIf(person_id, event = 'app_opened' AND startsWith(coalesce(toString(properties.ref), ''), 'lp_')),
        uniqIf(person_id, event = 'app_opened' AND startsWith(coalesce(toString(properties.ref), ''), 'lp_') AND toString(properties.returning) IN ('false', '0'))
      FROM (SELECT ${DAY} AS d, event, distinct_id, person_id, properties FROM events
            WHERE ${WHEN} AND event IN ('landing_view', 'landing_cta', 'app_opened'))
      GROUP BY d ORDER BY d`));

  // 2. who the visitors are (landing-4 = the one-button page since 2.11)
  const dims = [
    ['source', 'properties.source'], ['in_app browser', 'properties.in_app'], ['platform', 'properties.platform'],
    ['country (geoip)', 'properties.$geoip_country_code'], ['landing version', 'properties.landing_version'],
    ['page fits the screen', 'properties.fits'], ['paid link', `if(${PAID}, 'paid', 'organic')`]
  ];
  for (const [label, expr] of dims) {
    print(`מבקרים לפי ${label}`, [label, 'visitors', 'tapped start'], await hogql(`
      SELECT k, uniqIf(distinct_id, ev = 'landing_view'), uniqIf(distinct_id, ev = 'landing_cta' AND cta IN ('start_now', 'joined_try', 'footer_try'))
      FROM (SELECT distinct_id, event AS ev, toString(properties.cta) AS cta,
              any(if(event = 'landing_view', toString(${expr}), NULL)) OVER (PARTITION BY distinct_id) AS k
            FROM events WHERE ${WHEN} AND event IN ('landing_view', 'landing_cta'))
      GROUP BY k ORDER BY 2 DESC LIMIT 15`));
  }

  // 3. how long they stayed: the first landing_leave per visitor (no leave event = the phone never told us)
  print('כמה זמן נשארו בדף (מבקר, פעם ראשונה)', ['stay', 'visitors', 'paid'], await hogql(`
    SELECT multiIf(s IS NULL, 'no leave event', s < 2, '0-1s', s < 4, '2-3s', s < 10, '4-9s', s < 30, '10-29s', '30s+') AS b,
      count(), countIf(paid = 1)
    FROM (SELECT distinct_id,
            minIf(toFloat(properties.seconds), event = 'landing_leave') AS s0,
            if(countIf(event = 'landing_leave') = 0, NULL, s0) AS s,
            max(if(event = 'landing_view' AND ${PAID}, 1, 0)) AS paid
          FROM events WHERE ${WHEN} AND event IN ('landing_view', 'landing_leave')
          GROUP BY distinct_id HAVING countIf(event = 'landing_view') > 0)
    GROUP BY b ORDER BY b`));

  // 4. people who opened the app from dribit.app: did the app load, did they start / finish lesson 1
  print('מי שפתח את האפליקציה מ-dribit.app', ['ref', 'people', 'lesson_started', 'lesson_completed'], await hogql(`
    SELECT r, uniq(person_id), uniqIf(person_id, started = 1), uniqIf(person_id, done = 1)
    FROM (SELECT person_id,
            argMinIf(toString(properties.ref), timestamp, event = 'app_opened' AND startsWith(coalesce(toString(properties.ref), ''), 'lp_')) AS r,
            max(if(event = 'lesson_started', 1, 0)) AS started, max(if(event = 'lesson_completed', 1, 0)) AS done
          FROM events WHERE ${WHEN} AND properties.app_version IS NOT NULL
          GROUP BY person_id HAVING countIf(event = 'app_opened' AND startsWith(coalesce(toString(properties.ref), ''), 'lp_')) > 0)
    GROUP BY r ORDER BY 2 DESC`));

  // 4b. paid clicks: from Israel or abroad, and how long they stayed
  print('קליקים ממומנים מול אורגני, ישראל מול חו"ל', ['paid', 'country', 'visitors', 'tapped start', 'left <4s', 'no leave event'], await hogql(`
    SELECT paid, il, count(), countIf(tap = 1), countIf(s IS NOT NULL AND s < 4), countIf(s IS NULL)
    FROM (SELECT distinct_id,
            max(if(event = 'landing_view' AND ${PAID}, 'paid', 'organic')) AS paid,
            any(if(event = 'landing_view', if(toString(properties.$geoip_country_code) = 'IL', 'IL', 'abroad'), NULL)) AS il,
            max(if(event = 'landing_cta' AND toString(properties.cta) IN ('start_now', 'joined_try', 'footer_try'), 1, 0)) AS tap,
            if(countIf(event = 'landing_leave') = 0, NULL, minIf(toFloat(properties.seconds), event = 'landing_leave')) AS s
          FROM events WHERE ${WHEN} AND event IN ('landing_view', 'landing_cta', 'landing_leave')
          GROUP BY distinct_id HAVING countIf(event = 'landing_view') > 0)
    GROUP BY paid, il ORDER BY paid, il`));

  // 6. landing-5 (from 3.11): dribit.app opens the app by itself. visit → the app page arrived → the app loaded → lesson
  print('landing-5: מהביקור ועד השיעור', ['country', 'visits', 'app page arrived (app_boot)', 'app loaded (app_opened)', 'lesson started', 'lesson completed'], await hogql(`
    SELECT il, count(), countIf(boot = 1), countIf(has(opened, lp)), countIf(has(started, lp)), countIf(has(done, lp))
    FROM (SELECT distinct_id AS lp, max(if(event = 'app_boot', 1, 0)) AS boot,
            any(if(event = 'landing_view', if(toString(properties.$geoip_country_code) = 'IL', 'IL', 'abroad'), NULL)) AS il
          FROM events WHERE ${WHEN} AND event IN ('landing_view', 'app_boot')
          GROUP BY distinct_id HAVING countIf(event = 'landing_view' AND properties.landing_version = 'landing-5') > 0) v
    CROSS JOIN (SELECT groupUniqArrayIf(l, event = 'app_opened') AS opened, groupUniqArrayIf(l, event = 'lesson_started') AS started,
            groupUniqArrayIf(l, event = 'lesson_completed') AS done
          FROM (SELECT event, person_id, any(if(event = 'app_opened', toString(properties.landing_id), NULL)) OVER (PARTITION BY person_id) AS l
                FROM events WHERE ${WHEN} AND event IN ('app_opened', 'lesson_started', 'lesson_completed')) WHERE l IS NOT NULL AND l != '') a
    GROUP BY il ORDER BY il`));

  // 5. which event names exist (to catch a renamed or missing event)
  print('אירועים מאז', ['event', 'count'], await hogql(`SELECT event, count() FROM events WHERE ${WHEN} GROUP BY event ORDER BY 2 DESC LIMIT 40`));
})().catch((e) => { console.error(String((e && e.message) || e)); process.exit(1); });
