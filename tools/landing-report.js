/* Landing page report: how many people came (from TikTok and elsewhere), how far down they scrolled, and how many
   signed up. Reads PostHog with a HogQL query, the same way tools/send-reminders.js does.
   Prints only counts: never a phone, email, name or person id (the Actions log of this repository is public).
   Needs: POSTHOG_API_KEY (personal API key with query:read). Optional: POSTHOG_PROJECT_ID, SINCE (YYYY-MM-DD, default
   2026-10-25, the day the current landing page went live), POSTHOG_API_HOST.
   Run: node tools/landing-report.js   (or Actions > Landing report > Run workflow) */
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

// events the landing page sends (landing/index.html). The app never sends these names.
const LANDING = `('landing_view','landing_stamp','landing_quiz','landing_cta','landing_scroll','landing_form_start','landing_seen_form','landing_leave','waitlist_signup')`;
const WHEN = `timestamp >= toDateTime('${SINCE} 00:00:00')`;
const TT = `(properties.source = 'tiktok' OR properties.in_app = 'tiktok')`;
const has = (cond) => `max(if(${cond}, 1, 0))`;

// one row per visitor (one browser = one visitor), with each step they reached
const PER_VISITOR = `
  SELECT distinct_id,
    ${has(`event = 'landing_view' AND ${TT}`)} AS tt,
    ${has(`event = 'landing_view'`)} AS viewed,
    ${has(`event = 'landing_scroll' AND toInt(properties.depth) >= 25`)} AS d25,
    ${has(`event = 'landing_stamp' AND properties.station = 'pikadon'`)} AS s_pikadon,
    ${has(`event = 'landing_scroll' AND toInt(properties.depth) >= 50`)} AS d50,
    ${has(`event = 'landing_stamp' AND properties.station = 'race'`)} AS s_race,
    ${has(`event = 'landing_scroll' AND toInt(properties.depth) >= 75`)} AS d75,
    ${has(`event = 'landing_quiz'`)} AS quiz,
    ${has(`event = 'landing_seen_form'`)} AS seen_form,
    ${has(`event = 'landing_scroll' AND toInt(properties.depth) >= 100`)} AS d100,
    ${has(`event = 'landing_form_start'`)} AS form_start,
    ${has(`event = 'waitlist_signup'`)} AS signed,
    ${has(`event = 'landing_cta' AND properties.cta IN ('joined_try', 'footer_try')`)} AS to_app,
    dateDiff('second', min(timestamp), max(timestamp)) AS secs,
    count() AS n
  FROM events
  WHERE event IN ${LANDING} AND ${WHEN}
  GROUP BY distinct_id`;

const STEPS = [
  ['viewed', 'נכנסו לדף'],
  ['d25', 'גללו 25% מהדף (חדש)'],
  ['s_pikadon', 'עברו את תחנה 1: על מה מותר להוציא את הפיקדון'],
  ['d50', 'גללו 50% מהדף (חדש)'],
  ['s_race', 'סיימו את תחנה 2: המרוץ של מאיה ועומר'],
  ['quiz', 'ענו על שאלת המס (תחנה 3)'],
  ['d75', 'גללו 75% מהדף (חדש)'],
  ['seen_form', 'הגיעו לטופס ההרשמה (חדש)'],
  ['d100', 'גללו עד הסוף (חדש)'],
  ['form_start', 'התחילו למלא את הטופס (חדש)'],
  ['signed', 'השאירו פרטים'],
  ['to_app', 'לחצו לפתוח את האפליקציה']
];

function table(title, rows) {
  const base = rows[0] ? rows[0][1] : 0;
  console.log(`\n${title}`);
  for (const [label, n] of rows) {
    const pct = base ? ` (${Math.round((100 * n) / base)}%)` : '';
    console.log(`  ${String(n).padStart(5)}${pct.padEnd(7)}  ${label}`);
  }
}

(async () => {
  if (!API_KEY) throw new Error('POSTHOG_API_KEY is missing (a PostHog personal API key with query:read).');
  if (!PROJECT) {
    const list = (await api('/api/projects/')).results || [];
    if (!list.length) throw new Error('PostHog listed no project for this key. Add POSTHOG_PROJECT_ID.');
    PROJECT = String(list[0].id);
  }
  console.log(`Landing report since ${SINCE} (dates in UTC). Includes your own visits and test signups.`);
  console.log('Steps marked (חדש) are measured only from the version that adds them (landing-2.4); before that they show 0.');

  const sums = STEPS.map(([k]) => `sum(${k})`).join(', ');
  const agg = await hogql(`
    SELECT tt, ${sums}, quantile(0.5)(if(n > 1, secs, 0)), countIf(n = 1)
    FROM (${PER_VISITOR}) WHERE viewed = 1 GROUP BY tt ORDER BY tt DESC`);
  const byGroup = { 1: null, 0: null };
  for (const r of agg) byGroup[r[0]] = r;
  for (const [g, title] of [[1, 'מטיקטוק (הלינק בביו או הדפדפן של טיקטוק)'], [0, 'מכל מקום אחר']]) {
    const r = byGroup[g];
    if (!r) { console.log(`\n${title}: אין כניסות`); continue; }
    table(`=== ${title} ===`, STEPS.map(([, label], i) => [label, r[1 + i]]));
    console.log(`  זמן חציוני בדף (מהאירוע הראשון לאחרון): ${r[1 + STEPS.length]} שניות`);
    console.log(`  יצאו בלי לעשות כלום אחרי הכניסה: ${r[2 + STEPS.length]}`);
  }

  const src = await hogql(`
    SELECT coalesce(properties.source, '?'), coalesce(properties.in_app, '-'), count(DISTINCT distinct_id)
    FROM events WHERE event = 'landing_view' AND ${WHEN}
    GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 30`);
  console.log('\n=== כניסות לפי מקור (source / דפדפן בתוך אפליקציה) ===');
  for (const [s, a, n] of src) console.log(`  ${String(n).padStart(5)}  ${s} / ${a}`);

  const days = await hogql(`
    SELECT toDate(timestamp), count(DISTINCT distinct_id),
      count(DISTINCT if(${TT}, distinct_id, NULL))
    FROM events WHERE event = 'landing_view' AND ${WHEN}
    GROUP BY 1 ORDER BY 1`);
  console.log('\n=== כניסות לפי יום: כולם / מטיקטוק ===');
  for (const [d, all, tt] of days) console.log(`  ${d}  ${String(all).padStart(4)} / ${tt}`);

  const signups = await hogql(`
    SELECT coalesce(properties.source, '?'), count(DISTINCT distinct_id)
    FROM events WHERE event = 'waitlist_signup' AND ${WHEN} GROUP BY 1 ORDER BY 2 DESC`);
  console.log('\n=== הרשמות לפי מקור ===');
  for (const [s, n] of signups) console.log(`  ${String(n).padStart(5)}  ${s}`);

  const plat = await hogql(`
    SELECT coalesce(properties.platform, '?'), count(DISTINCT distinct_id)
    FROM events WHERE event = 'landing_view' AND ${WHEN} AND ${TT} GROUP BY 1 ORDER BY 2 DESC`);
  console.log('\n=== מטיקטוק לפי מכשיר ===');
  for (const [p, n] of plat) console.log(`  ${String(n).padStart(5)}  ${p}`);
})().catch((e) => { console.error(String((e && e.message) || e)); process.exit(1); });
