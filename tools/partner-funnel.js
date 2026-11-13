/* Partner funnel (13.11.2026, 0.30): how many people get from the lessons to the trading-account offers (Interactive,
   Meitav), per place in the app. Seen -> opened an offer -> tapped the link. Prints counts only (the Actions log is public).
   An account actually opened is not in PostHog: it happens on the company's site, so only their reports can say it.
   Same secrets as tools/leak-check.js. Run: node tools/partner-funnel.js  (or Actions > Partner funnel > Run workflow) */
'use strict';

const API_KEY = (process.env.POSTHOG_API_KEY || '').trim();
const PH_API = (process.env.POSTHOG_API_HOST || 'https://eu.posthog.com').replace(/\/$/, '');
const SINCE = /^\d{4}-\d{2}-\d{2}$/.test(process.env.SINCE || '') ? process.env.SINCE : '2026-10-26';
let PROJECT = (process.env.POSTHOG_PROJECT_ID || '').trim();
const { loadTeam } = require('./team');
let T = '1 = 1';

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
  for (const r of rows) console.log('  ' + r.map((x) => (x === null || x === undefined ? '-' : String(x))).join(' | '));
};
const FROM = () => `timestamp >= toDateTime('${SINCE} 00:00:00', 'Asia/Jerusalem') AND ${T}`;

// the place of every partner event. "seen" has a different event per place:
//   unit_sheet  = partner_card_viewed (the comparison on the unit-5 page)
//   lesson_done = partner_offer_viewed (5.2 done screen, after "כן, בקרוב")
//   profile     = partner_profile_viewed with open = true (locked = the card without names or links)
//   done_teaser = partner_teaser_viewed (0.30: the small card on the done screen of 0.5, 4.4, 5.3, 5.1, 5.5), then
//                 partner_teaser_tapped opens the sheet with the offers
const PLACE = `multiIf(
  event = 'partner_card_viewed', 'unit_sheet',
  event = 'partner_offer_viewed', toString(properties.place),
  event = 'partner_profile_viewed', if(toString(properties.open) = 'true', 'profile', 'profile_locked'),
  event IN ('partner_teaser_viewed', 'partner_teaser_tapped'), 'done_teaser',
  toString(properties.place))`;
const PEVENTS = "('partner_card_viewed', 'partner_offer_viewed', 'partner_profile_viewed', 'partner_teaser_viewed', 'partner_teaser_tapped', 'partner_offer_opened', 'partner_more_opened', 'partner_selfcheck', 'partner_terms_clicked', 'partner_link_clicked')";
const SEEN = "event IN ('partner_card_viewed', 'partner_offer_viewed', 'partner_profile_viewed', 'partner_teaser_viewed')";

(async () => {
  if (!API_KEY) throw new Error('POSTHOG_API_KEY is missing.');
  if (!PROJECT) PROJECT = String(((await api('/api/projects/')).results || [])[0].id);
  const now = await hogql(`SELECT toString(toTimeZone(now(), 'Asia/Jerusalem'))`);
  console.log(`Partner funnel since ${SINCE} (Israel time). Now: ${now[0] && now[0][0]}`);
  const team = await loadTeam(hogql);
  T = team.not();
  console.log(team.line());
  console.log('Opening an account happens on the company site: PostHog only sees the tap on the link. The real number comes from their reports.');

  print('לפי מקום: ראו -> פתחו כרטיס -> בדיקה "כן, יש" -> לחצו על הקישור (אנשים)', ['place', 'saw', 'tapped the teaser', 'opened an offer', 'self-check yes', 'self-check no', 'tapped the link'], await hogql(`
    SELECT ${PLACE} AS place,
      uniqIf(person_id, ${SEEN}), uniqIf(person_id, event = 'partner_teaser_tapped'), uniqIf(person_id, event = 'partner_offer_opened'),
      uniqIf(person_id, event = 'partner_selfcheck' AND toString(properties.answer) = 'yes'),
      uniqIf(person_id, event = 'partner_selfcheck' AND toString(properties.answer) = 'no'),
      uniqIf(person_id, event = 'partner_link_clicked')
    FROM events WHERE event IN ${PEVENTS} AND ${FROM()}
    GROUP BY place ORDER BY 2 DESC`));

  print('לחיצות על הקישור לפי גוף ומקום', ['partner', 'place', 'lesson', 'people', 'taps'], await hogql(`
    SELECT toString(properties.partner_id), toString(properties.place), toString(properties.lesson_id), uniq(person_id), count()
    FROM events WHERE event = 'partner_link_clicked' AND ${FROM()}
    GROUP BY 1, 2, 3 ORDER BY 4 DESC`));

  print('הכרטיס במסך הסיום (0.30) לפי שיעור', ['lesson', 'saw', 'tapped', 'opened an offer', 'tapped the link'], await hogql(`
    SELECT l, uniqIf(pid, ev = 'partner_teaser_viewed'), uniqIf(pid, ev = 'partner_teaser_tapped'),
      uniqIf(pid, ev = 'partner_offer_opened'), uniqIf(pid, ev = 'partner_link_clicked') FROM (
      SELECT person_id AS pid, event AS ev, toString(properties.lesson_id) AS l FROM events
      WHERE event IN ('partner_teaser_viewed', 'partner_teaser_tapped') AND ${FROM()}
      UNION ALL
      SELECT person_id, event, toString(properties.lesson_id) FROM events
      WHERE event IN ('partner_offer_opened', 'partner_link_clicked') AND toString(properties.place) = 'done_teaser' AND ${FROM()})
    GROUP BY l ORDER BY 2 DESC`));

  // how far people get on the path: of everyone who finished one lesson, how many finished the lessons that lead to an offer
  print('כמה אנשים מגיעים לשיעורים שמובילים להטבה (סיימו לפחות פעם אחת)', ['lesson', 'people'], await hogql(`
    SELECT l, uniq(person_id) FROM (
      SELECT person_id, 'any lesson' AS l FROM events WHERE event = 'lesson_completed' AND ${FROM()}
      UNION ALL
      SELECT person_id, toString(properties.lesson_id) FROM events WHERE event = 'lesson_completed'
        AND toString(properties.lesson_id) IN ('0.5', '0.3', '4.4', '5.3', '5.1', '5.2', '5.5') AND ${FROM()})
    GROUP BY l ORDER BY 2 DESC`));

  print('אנשים שראו הטבה כלשהי / לחצו על קישור כלשהו, לפי שבוע', ['week from', 'saw any offer', 'tapped any link'], await hogql(`
    SELECT toString(toStartOfWeek(toTimeZone(timestamp, 'Asia/Jerusalem'), 1)) AS w,
      uniqIf(person_id, ${SEEN} AND NOT (event = 'partner_profile_viewed' AND toString(properties.open) != 'true')),
      uniqIf(person_id, event = 'partner_link_clicked')
    FROM events WHERE event IN ${PEVENTS} AND ${FROM()}
    GROUP BY w ORDER BY w`));

  print('קישור ישיר לשיעור (?go=, 0.30): מי נכנס ומה עשה', ['go', 'lesson', 'people', 'new people', 'started that lesson', 'finished it', 'saw the teaser', 'tapped a link'], await hogql(`
    SELECT g.go, g.l, count(), countIf(g.ret = 'false'), sum(x.ls), sum(x.lc), sum(x.tv), sum(x.pl) FROM
      (SELECT person_id, argMin(toString(properties.go), timestamp) AS go, argMin(toString(properties.lesson_id), timestamp) AS l,
          argMin(toString(properties.returning), timestamp) AS ret
        FROM events WHERE event = 'deep_link_opened' AND ${FROM()} GROUP BY person_id) g
    LEFT JOIN
      (SELECT e.person_id AS pid,
          max(if(e.event = 'lesson_started' AND toString(e.properties.from) = 'deep_link', 1, 0)) AS ls,
          max(if(e.event = 'lesson_completed' AND toString(e.properties.lesson_id) = '0.5', 1, 0)) AS lc,
          max(if(e.event = 'partner_teaser_viewed', 1, 0)) AS tv,
          max(if(e.event = 'partner_link_clicked', 1, 0)) AS pl
        FROM events e WHERE e.event IN ('lesson_started', 'lesson_completed', 'partner_teaser_viewed', 'partner_link_clicked') AND ${team.not('e.')}
          AND e.timestamp >= toDateTime('${SINCE} 00:00:00', 'Asia/Jerusalem')
        GROUP BY e.person_id) x ON g.person_id = x.pid
    GROUP BY g.go, g.l ORDER BY 3 DESC`));
})().catch((e) => { console.error(String((e && e.message) || e)); process.exit(1); });
