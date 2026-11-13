/* Retention report: of the new people who opened the app, how many came back the next day (D1) and a week later (D7).
   Split by where they came from: dribit.app (the landing page, mostly strangers from TikTok/Instagram), a friend's
   invite link, or anything else (the direct app link, mostly friends). Reads PostHog with HogQL, like landing-report.js.
   Prints only counts: never a phone, email, name or person id (the Actions log of this repository is public).

   Definitions (Israel time):
     new person  = the first day the app sent anything from this person is on or after SINCE
     day 0       = that first day
     D1          = used the app on day 0 + 1          D7  = used the app on day 0 + 7
     week 1      = used the app on any day 1..7       (with few people, this one moves first)
     "used"      = any event the app itself sends (app_opened, lesson_*, ...). Reminders sent by the server don't count.
   A person counts toward D1 only once day 1 is over, and toward D7 only once day 7 is over.

   Optional: CREATE_DASHBOARD=1 also creates (or refreshes) the PostHog dashboard "דריבית: מי חוזר" with Retention
   insights. That needs a personal API key with insight:write and dashboard:write; with read-only keys it prints how to
   build the same insights by hand.

   Needs: POSTHOG_API_KEY (personal API key with query:read). Optional: POSTHOG_PROJECT_ID, SINCE (YYYY-MM-DD, default
   2026-10-20), POSTHOG_API_HOST.
   Run: node tools/retention-report.js   (or Actions > Retention report > Run workflow) */
'use strict';

const API_KEY = (process.env.POSTHOG_API_KEY || '').trim();
const PH_API = (process.env.POSTHOG_API_HOST || 'https://eu.posthog.com').replace(/\/$/, '');
const SINCE = /^\d{4}-\d{2}-\d{2}$/.test(process.env.SINCE || '') ? process.env.SINCE : '2026-10-20';
const CREATE = /^(1|true|yes)$/i.test(process.env.CREATE_DASHBOARD || '');
let PROJECT = (process.env.POSTHOG_PROJECT_ID || '').trim();
const { loadTeam } = require('./team');

async function api(pathname, body, method) {
  const r = await fetch(PH_API + pathname, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok) {
    const err = new Error(`PostHog ${pathname} answered ${r.status}: ${(await r.text()).replace(/\s+/g, ' ').slice(0, 200)}`);
    err.status = r.status;
    throw err;
  }
  return r.json();
}
async function hogql(query) {
  const j = await api(`/api/projects/${PROJECT}/query/`, { query: { kind: 'HogQLQuery', query }, refresh: 'force_blocking' });
  return j.results || [];
}

const DAY = "toDate(toTimeZone(timestamp, 'Asia/Jerusalem'))";
// events the app sends carry app_version; the service worker's carry platform 'sw' (a push arriving is not a visit)
const APP_EVENT = "properties.app_version IS NOT NULL AND properties.app_version != '' AND coalesce(properties.platform, '') != 'sw'";
const COHORT = `multiIf(startsWith(ref0, 'lp_'), 'dribit.app', ref0 = 'share', 'קישור הזמנה מחבר', 'קישור ישיר / אחר')`;

// one row per person: first day, every day they used the app, first lesson day, and the ref of their first open
let PER_PERSON = `
  SELECT person_id,
    min(d) AS d0,
    groupUniqArray(d) AS days,
    minIf(d, event = 'lesson_completed') AS first_lesson,
    coalesce(argMinIf(ref, timestamp, event = 'app_opened' AND ref != ''), '') AS ref_open,
    any(pref) AS ref_person
  FROM (
    SELECT person_id, event, timestamp, ${DAY} AS d, coalesce(toString(properties.ref), '') AS ref,
      coalesce(toString(person.properties.first_ref), '') AS pref
    FROM events WHERE ${APP_EVENT} AND __T__)
  GROUP BY person_id`;

const pct = (n, of) => (of ? `${Math.round((100 * n) / of)}%` : '-');

(async () => {
  if (!API_KEY) throw new Error('POSTHOG_API_KEY is missing (a PostHog personal API key with query:read).');
  if (!PROJECT) {
    const list = (await api('/api/projects/')).results || [];
    if (!list.length) throw new Error('PostHog listed no project for this key. Add POSTHOG_PROJECT_ID.');
    PROJECT = String(list[0].id);
  }
  const [[today]] = await hogql(`SELECT toDate(toTimeZone(now(), 'Asia/Jerusalem'))`);
  console.log(`Retention report: new people since ${SINCE}, Israel time, today ${today}.`);
  const team = await loadTeam(hogql);
  PER_PERSON = PER_PERSON.replace('__T__', team.not());
  console.log(team.line());
  console.log('Test phones that were never marked still count. The friends pilot (paid week from 16.10) is before the default date.');

  const base = `
    SELECT person_id, d0, days, first_lesson, if(ref_person != '' AND ref_person != 'none', ref_person, ref_open) AS ref0
    FROM (${PER_PERSON}) WHERE d0 >= toDate('${SINCE}')`;
  const sums = `
    count() AS people,
    countIf(first_lesson = d0) AS lesson_day0,
    countIf(d0 + 1 < toDate('${today}')) AS can_d1, countIf(d0 + 1 < toDate('${today}') AND has(days, d0 + 1)) AS d1,
    countIf(d0 + 7 < toDate('${today}')) AS can_d7, countIf(d0 + 7 < toDate('${today}') AND has(days, d0 + 7)) AS d7,
    countIf(d0 + 7 < toDate('${today}') AND arrayExists(x -> x >= d0 + 1 AND x <= d0 + 7, days)) AS w1,
    countIf(arrayExists(x -> x > d0, days)) AS ever_back`;

  const show = (label, r) => {
    const [people, l0, cd1, d1, cd7, d7, w1, back] = r;
    console.log(`\n=== ${label} ===`);
    console.log(`  ${String(people).padStart(4)}  אנשים חדשים שפתחו את האפליקציה`);
    console.log(`  ${String(l0).padStart(4)}  סיימו שיעור ביום הראשון (${pct(l0, people)})`);
    console.log(`  ${String(d1).padStart(4)}  חזרו למחרת, D1 (${pct(d1, cd1)} מתוך ${cd1} שכבר עבר להם יום)`);
    console.log(`  ${String(w1).padStart(4)}  חזרו מתישהו בשבוע הראשון (${pct(w1, cd7)} מתוך ${cd7} שכבר עברו להם 7 ימים)`);
    console.log(`  ${String(d7).padStart(4)}  חזרו ביום השביעי, D7 (${pct(d7, cd7)} מתוך ${cd7})`);
    console.log(`  ${String(back).padStart(4)}  חזרו אי פעם אחרי היום הראשון (${pct(back, people)})`);
  };

  const all = await hogql(`SELECT ${sums} FROM (${base})`);
  if (all[0]) show('כולם', all[0]);
  const byCohort = await hogql(`SELECT ${COHORT} AS cohort, ${sums} FROM (${base}) GROUP BY cohort ORDER BY people DESC`);
  for (const r of byCohort) show(`מאיפה הגיעו: ${r[0]}`, r.slice(1));

  const byDay = await hogql(`
    SELECT d0, ${COHORT} AS cohort, count(), countIf(has(days, d0 + 1)), countIf(has(days, d0 + 7)), countIf(first_lesson = d0)
    FROM (${base}) GROUP BY d0, cohort ORDER BY d0, cohort`);
  console.log('\n=== לפי היום הראשון: אנשים / סיימו שיעור ביום 0 / חזרו למחרת / חזרו ביום 7 ===');
  for (const [d, c, n, d1, d7, l0] of byDay) console.log(`  ${d}  ${c.padEnd(18)} ${String(n).padStart(3)} / ${l0} / ${d1} / ${d7}`);

  // the landing page funnel since SINCE: visitors, tapped start, opened the app from dribit.app
  const lp = await hogql(`
    SELECT count(DISTINCT if(event = 'landing_view', distinct_id, NULL)),
      count(DISTINCT if(event = 'landing_cta' AND properties.cta IN ('start_now', 'joined_try', 'footer_try', 'auto_open'), distinct_id, NULL)),
      count(DISTINCT if(event = 'landing_cta' AND properties.cta = 'send_self', distinct_id, NULL))
    FROM events WHERE event IN ('landing_view', 'landing_cta') AND timestamp >= toDateTime('${SINCE} 00:00:00') AND ${team.not()}`);
  const fromLp = byCohort.find((r) => r[0] === 'dribit.app');
  if (lp[0]) {
    console.log('\n=== דף הנחיתה (dribit.app) ===');
    console.log(`  ${String(lp[0][0]).padStart(4)}  נכנסו לדף`);
    console.log(`  ${String(lp[0][1]).padStart(4)}  לחצו "להתחיל עכשיו", או נפתח להם לבד מ-landing-5 (${pct(lp[0][1], lp[0][0])})`);
    console.log(`  ${String(lp[0][2]).padStart(4)}  שלחו לעצמם קישור לוואטסאפ`);
    console.log(`  ${String(fromLp ? fromLp[1] : 0).padStart(4)}  פתחו את האפליקציה מהדף (אנשים חדשים)`);
  }

  if (CREATE) await dashboard();
})().catch((e) => { console.error(String((e && e.message) || e)); process.exit(1); });

// ---------- the PostHog dashboard ----------
const DASH_NAME = 'דריבית: מי חוזר';
const FROM_LP = [{ key: 'first_ref', value: 'lp_', operator: 'icontains', type: 'person' }];
function retention(period, intervals, props) {
  return {
    kind: 'InsightVizNode',
    source: {
      kind: 'RetentionQuery',
      dateRange: { date_from: period === 'Week' ? '-56d' : '-30d' },
      filterTestAccounts: false,
      properties: props || [],
      retentionFilter: {
        period, totalIntervals: intervals, retentionType: 'retention_first_time', retentionReference: 'total',
        targetEntity: { id: 'app_opened', name: 'app_opened', type: 'events' },
        returningEntity: { id: 'app_opened', name: 'app_opened', type: 'events' }
      }
    }
  };
}
const INSIGHTS = [
  { name: 'חוזרים לפי יום: כל האנשים החדשים', description: 'יום 0 = הפתיחה הראשונה. Day 1 = חזרו למחרת, Day 7 = חזרו אחרי שבוע.', query: retention('Day', 8) },
  { name: 'חוזרים לפי יום: רק מי שהגיע מ-dribit.app', description: 'first_ref מתחיל ב-lp_: נכנסו דרך דף הנחיתה (לרוב זרים מטיקטוק ואינסטגרם).', query: retention('Day', 8, FROM_LP) },
  { name: 'חוזרים לפי שבוע: כל האנשים החדשים', description: 'שבוע 0 = השבוע של הפתיחה הראשונה.', query: retention('Week', 5) },
  {
    name: 'דף הנחיתה: נכנסו ולחצו להתחיל', description: 'אנשים שונים ביום.',
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'TrendsQuery', dateRange: { date_from: '-30d' }, interval: 'day', filterTestAccounts: false,
        series: [
          { kind: 'EventsNode', event: 'landing_view', name: 'landing_view', custom_name: 'נכנסו לדף', math: 'dau' },
          { kind: 'EventsNode', event: 'landing_cta', name: 'landing_cta', custom_name: 'לחצו להתחיל', math: 'dau',
            properties: [{ key: 'cta', value: ['start_now'], operator: 'exact', type: 'event' }] },
          { kind: 'EventsNode', event: 'app_opened', name: 'app_opened', custom_name: 'פתחו את האפליקציה מהדף', math: 'dau',
            properties: [{ key: 'ref', value: 'lp_', operator: 'icontains', type: 'event' }] }
        ]
      }
    }
  },
  {
    name: 'אנשים חדשים ביום: סיימו שיעור ראשון', description: 'פתחו בפעם הראשונה (ראשון), ומתוכם סיימו שיעור.',
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'FunnelsQuery', dateRange: { date_from: '-30d' }, filterTestAccounts: false,
        funnelsFilter: { funnelWindowInterval: 1, funnelWindowIntervalUnit: 'day', funnelVizType: 'steps' },
        series: [
          { kind: 'EventsNode', event: 'app_opened', name: 'app_opened', custom_name: 'פתחו את האפליקציה' },
          { kind: 'EventsNode', event: 'onboarding_done', name: 'onboarding_done', custom_name: 'סיימו את הפתיחה' },
          { kind: 'EventsNode', event: 'lesson_completed', name: 'lesson_completed', custom_name: 'סיימו שיעור' }
        ]
      }
    }
  }
];

async function dashboard() {
  console.log('\n=== דשבורד ב-PostHog ===');
  try {
    const list = (await api(`/api/projects/${PROJECT}/dashboards/?limit=200`)).results || [];
    let dash = list.find((d) => d.name === DASH_NAME && !d.deleted);
    if (!dash) dash = await api(`/api/projects/${PROJECT}/dashboards/`, { name: DASH_NAME, description: 'נבנה מ-tools/retention-report.js. כמה אנשים חדשים חוזרים למחרת ואחרי שבוע.' });
    const have = (await api(`/api/projects/${PROJECT}/insights/?dashboards=[${dash.id}]&limit=100`)).results || [];
    for (const ins of INSIGHTS) {
      const old = have.find((i) => i.name === ins.name && !i.deleted);
      if (old) await api(`/api/projects/${PROJECT}/insights/${old.id}/`, { query: ins.query, description: ins.description }, 'PATCH');
      else await api(`/api/projects/${PROJECT}/insights/`, { name: ins.name, description: ins.description, query: ins.query, dashboards: [dash.id] });
      console.log(`  ${old ? 'עודכן' : 'נוצר'}: ${ins.name}`);
    }
    console.log(`  הדשבורד: ${PH_API}/project/${PROJECT}/dashboard/${dash.id}`);
  } catch (e) {
    if (e.status === 401 || e.status === 403) {
      console.log('  למפתח אין הרשאה ליצור דשבורד (צריך insight:write ו-dashboard:write). אפשר לבנות ידנית:');
      console.log('  PostHog > Product analytics > New insight > Retention:');
      console.log('    Performed event for the first time: app_opened. Came back to perform: app_opened. Period: Day, 8 intervals.');
      console.log('    לגרסה של dribit.app בלבד: Filters > Person property first_ref contains lp_');
      return;
    }
    throw e;
  }
}
