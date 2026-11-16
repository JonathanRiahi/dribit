/* Person check (16.11.2026): what one anonymous app user did, e.g. the person behind a feedback email ("מזהה ב-PostHog").
   Input: DISTINCT_ID (the id in the feedback email / sheet). Prints how they arrived (source, ref, in-app browser, country),
   whether they added the app to the home screen, whether they turned on reminders, and their lessons, in Israel time.
   Prints no push endpoints or keys and no free text (the Actions log of this repository is public).
   Same secrets as the other reports. Run: Actions > Person check > Run workflow (distinct_id). */
'use strict';

const API_KEY = (process.env.POSTHOG_API_KEY || '').trim();
const PH_API = (process.env.POSTHOG_API_HOST || 'https://eu.posthog.com').replace(/\/$/, '');
const ID = (process.env.DISTINCT_ID || '').trim();
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
const print = (title, head, rows) => {
  console.log(`\n=== ${title} ===`);
  console.log('  ' + head.join(' | '));
  for (const r of rows) console.log('  ' + r.map((x) => (x === null || x === undefined || x === '' ? '-' : String(x))).join(' | '));
};
const TS = "toString(toTimeZone(timestamp, 'Asia/Jerusalem'))";
// only short, known, non-personal properties (never endpoint/keys/text)
const P = (k) => `toString(properties.${k})`;

(async () => {
  if (!API_KEY) throw new Error('POSTHOG_API_KEY is missing.');
  if (!/^[A-Za-z0-9-]{8,64}$/.test(ID)) throw new Error('DISTINCT_ID is missing or not an id.');
  if (!PROJECT) PROJECT = String(((await api('/api/projects/')).results || [])[0].id);
  const pr = await hogql(`SELECT DISTINCT toString(person_id) FROM events WHERE distinct_id = '${ID}' LIMIT 5`);
  if (!pr.length) { console.log('No events for this id.'); return; }
  const pids = pr.map((r) => `'${r[0]}'`).join(', ');
  const W = `toString(person_id) IN (${pids}) AND timestamp >= toDateTime('2026-09-01 00:00:00')`;
  const teamRow = await hogql(`SELECT argMax(toString(properties.on), timestamp) FROM events WHERE ${W} AND event = 'team_device'`);
  console.log(`Person check. Team device: ${teamRow.length && teamRow[0][0] === 'true' ? 'YES (Jonathan/Nehorai)' : 'no'}`);

  print('סיכום', ['first event', 'last event', 'events', 'days active', 'country', 'city', 'os', 'browser'], await hogql(`
    SELECT min(${TS}), max(${TS}), count(), uniq(toDate(toTimeZone(timestamp, 'Asia/Jerusalem'))),
      argMin(${P('$geoip_country_code')}, timestamp), argMin(${P('$geoip_city_name')}, timestamp),
      argMin(${P('$os')}, timestamp), argMin(${P('$browser')}, timestamp)
    FROM events WHERE ${W}`));

  print('איך הגיע: כל app_opened / landing_view', ['time IL', 'event', 'source', 'ref', 'first_ref', 'in_app', 'standalone', 'go', 'referrer domain'], await hogql(`
    SELECT ${TS}, event, ${P('source')}, ${P('ref')}, ${P('first_ref')}, ${P('in_app')}, ${P('standalone')}, ${P('go')}, ${P('$referring_domain')}
    FROM events WHERE ${W} AND event IN ('app_opened', 'landing_view', 'app_boot', 'landing_cta', 'deep_link_opened')
    ORDER BY timestamp LIMIT 40`));

  print('התקנה למסך הבית והתראות', ['time IL', 'event', 'method placement from state variant outcome permission', 'standalone', 'in_app'], await hogql(`
    SELECT ${TS}, event, concat(${P('method')}, ' ', ${P('placement')}, ' ', ${P('from')}, ' ', ${P('state')}, ' ', ${P('variant')}, ' ', ${P('outcome')}, ' ', ${P('permission')}),
      ${P('standalone')}, ${P('in_app')}
    FROM events WHERE ${W} AND (event LIKE 'install%' OR event LIKE 'app_install%' OR event LIKE 'push%' OR event LIKE 'reminder%'
      OR event IN ('pwa_installed', 'notifications_enabled'))
    ORDER BY timestamp LIMIT 60`));

  print('שיעורים', ['time IL', 'event', 'lesson', 'stars / rating', 'correct'], await hogql(`
    SELECT ${TS}, event, ${P('lesson_id')}, coalesce(nullIf(${P('stars')}, ''), nullIf(${P('rating')}, '')), ${P('correct')}
    FROM events WHERE ${W} AND event IN ('lesson_started', 'lesson_completed', 'lesson_rated', 'onboarding_done', 'status_set', 'feedback_sent', 'feedback_opened', 'social_registered')
    ORDER BY timestamp LIMIT 60`));

  print('status_set', ['time IL', 'status'], await hogql(`
    SELECT ${TS}, coalesce(nullIf(${P('status')}, ''), nullIf(${P('value')}, '')) FROM events WHERE ${W} AND event = 'status_set' ORDER BY timestamp LIMIT 5`));

  print('כל האירועים (שם, כמה פעמים, ראשון)', ['event', 'count', 'first IL'], await hogql(`
    SELECT event, count(), min(${TS}) FROM events WHERE ${W} GROUP BY event ORDER BY 3`));
})().catch((e) => { console.error(e.message); process.exit(1); });
