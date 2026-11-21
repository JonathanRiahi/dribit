/* Deep check (21.11.2026): everything PostHog can tell about new people in Israel since FROM, in one run.
   Lessons, steps, questions, retention, time, hours, features (friends, reminders, tools, battery, skins, partner).
   Prints counts only, never an id or a free text (the Actions log is public). Team devices are left out (tools/team.js).
   Run: node tools/deep-check.js (Actions > Deep check). Env FROM 'YYYY-MM-DD HH:MM' Israel. */
'use strict';

const API_KEY = (process.env.POSTHOG_API_KEY || '').trim();
const PH_API = (process.env.POSTHOG_API_HOST || 'https://eu.posthog.com').replace(/\/$/, '');
let PROJECT = (process.env.POSTHOG_PROJECT_ID || '').trim();
const FROM = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(process.env.FROM || '') ? process.env.FROM : '2026-11-13 12:05';
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
  for (const r of rows) console.log('  ' + r.map((x) => (x === null || x === undefined ? '-' : String(x))).join(' | '));
};
async function section(title, head, query) {
  try { print(title, head, await hogql(query)); } catch (e) { console.log(`\n=== ${title} === FAILED: ${String(e.message || e).slice(0, 300)}`); }
}
const IL = (x) => `toTimeZone(${x || 'timestamp'}, 'Asia/Jerusalem')`;
const D = (x) => `toDate(${IL(x)})`;

(async () => {
  if (!API_KEY) throw new Error('POSTHOG_API_KEY is missing.');
  if (!PROJECT) PROJECT = String(((await api('/api/projects/')).results || [])[0].id);
  const now = await hogql(`SELECT toString(${IL('now()')})`);
  console.log(`Deep check, new people in Israel since ${FROM} (Israel). Now: ${now[0][0]}`);
  const team = await loadTeam(hogql);
  console.log(team.line());
  const T = team.not();

  // new people: first app_opened ever on/after FROM, first open in Israel
  const NEWP = `SELECT person_id AS pid, t0 FROM (
      SELECT person_id, min(timestamp) AS t0, argMin(toString(properties.$geoip_country_code), timestamp) AS c
      FROM events WHERE event = 'app_opened' AND timestamp >= toDateTime('2026-09-01 00:00:00') AND ${T} GROUP BY person_id)
    WHERE t0 >= toDateTime('${FROM}:00', 'Asia/Jerusalem') AND c = 'IL'`;
  const EV = `events e INNER JOIN (${NEWP}) n ON e.person_id = n.pid`;
  const W = `e.timestamp >= toDateTime('${FROM}:00', 'Asia/Jerusalem') - INTERVAL 1 HOUR`;
  const day = `dateDiff('day', ${D('n.t0')}, ${D('e.timestamp')})`;

  await section('מי הם: מכשיר ואפליקציה', ['App Store app?', 'platform', 'people'], `
    SELECT nat, plat, count() FROM (
      SELECT e.person_id, argMin(if(toString(e.properties.native) != '', 'app', 'web'), e.timestamp) AS nat,
        argMin(toString(e.properties.platform), e.timestamp) AS plat
      FROM ${EV} WHERE ${W} AND e.event = 'app_opened' GROUP BY e.person_id)
    GROUP BY nat, plat ORDER BY count() DESC LIMIT 100`);
  await section('מי הם: סטטוס שבחרו', ['status', 'people'], `
    SELECT s, count() FROM (SELECT e.person_id, toString(argMax(e.properties.status, e.timestamp)) AS s FROM ${EV}
      WHERE ${W} AND e.event = 'status_set' GROUP BY e.person_id) GROUP BY s ORDER BY count() DESC LIMIT 100`);
  await section('כוונה להשקיע (invest_intent)', ['lesson', 'answer', 'people'], `
    SELECT toString(e.properties.lesson_id), toString(e.properties.answer), count(DISTINCT e.person_id) FROM ${EV}
    WHERE ${W} AND e.event = 'invest_intent' GROUP BY 1, 2 ORDER BY 1, 3 DESC LIMIT 100`);

  // the per-person base
  const PP = `
    SELECT e.person_id AS pid, any(n.t0) AS t0,
      uniqIf(toString(e.properties.lesson_id), e.event = 'lesson_completed' AND toString(e.properties.mode) = 'lesson') AS ndone,
      uniqIf(toString(e.properties.lesson_id), e.event = 'lesson_completed' AND toString(e.properties.mode) = 'lesson' AND ${day} = 0) AS ndone0,
      groupUniqArray(${day}) AS days,
      max(${day}) AS lastday,
      dateDiff('day', ${D('any(n.t0)')}, ${D('now()')}) AS age,
      max(e.event = 'native_reminder_on' OR e.event = 'push_subscribed') AS rem,
      max(e.event = 'social_registered') AS soc,
      max(e.event = 'tour_finished') AS tour,
      max(e.event = 'energy_empty') AS empty,
      max(e.event = 'group_joined' OR e.event = 'group_created') AS grp,
      max(e.event = 'tool_opened') AS tool,
      countIf(e.event = 'app_opened') AS opens,
      uniqIf(${day}, e.event = 'lesson_completed') AS lessondays
    FROM ${EV} WHERE ${W} GROUP BY e.person_id LIMIT 10000`;

  await section('כמה שיעורים כל אחד סיים (חדשים)', ['lessons finished', 'people', 'came back another day', 'avg days active'], `
    SELECT multiIf(ndone = 0, '0', ndone = 1, '1', ndone = 2, '2', ndone <= 4, '3-4', ndone <= 9, '5-9', '10+') AS b, count(),
      countIf(length(days) > 1), round(avg(length(days)), 1)
    FROM (${PP}) GROUP BY b ORDER BY b LIMIT 100`);
  await section('חזרה: כמה ימים שונים היו באפליקציה', ['active days', 'people'], `
    SELECT multiIf(length(days) >= 5, '5+', toString(length(days))) AS k, count() FROM (${PP}) GROUP BY k ORDER BY k LIMIT 100`);
  await section('חזרה לפי יום: D1 / D2 / D3 / D7 / D14 (רק מי שהיום הזה כבר עבר אצלו)', ['day', 'base', 'came back that day', 'came back that day or later'], `
    SELECT k, countIf(age > k), countIf(age > k AND has(days, k)), countIf(age > k AND lastday >= k)
    FROM (${PP}) ARRAY JOIN [1, 2, 3, 7, 14] AS k GROUP BY k ORDER BY k LIMIT 100`);
  await section('חזרה (יום אחר) לפי מה שעשו', ['group', 'did it', 'of them came back', 'did not', 'of them came back'], `
    SELECT 'reminder on', countIf(rem AND age > 0), countIf(rem AND age > 0 AND length(days) > 1), countIf(NOT rem AND age > 0), countIf(NOT rem AND age > 0 AND length(days) > 1) FROM (${PP})
    UNION ALL SELECT 'friends registered', countIf(soc AND age > 0), countIf(soc AND age > 0 AND length(days) > 1), countIf(NOT soc AND age > 0), countIf(NOT soc AND age > 0 AND length(days) > 1) FROM (${PP})
    UNION ALL SELECT 'group joined/created', countIf(grp AND age > 0), countIf(grp AND age > 0 AND length(days) > 1), countIf(NOT grp AND age > 0), countIf(NOT grp AND age > 0 AND length(days) > 1) FROM (${PP})
    UNION ALL SELECT 'tour finished', countIf(tour AND age > 0), countIf(tour AND age > 0 AND length(days) > 1), countIf(NOT tour AND age > 0), countIf(NOT tour AND age > 0 AND length(days) > 1) FROM (${PP})
    UNION ALL SELECT 'battery ran out', countIf(empty AND age > 0), countIf(empty AND age > 0 AND length(days) > 1), countIf(NOT empty AND age > 0), countIf(NOT empty AND age > 0 AND length(days) > 1) FROM (${PP})
    UNION ALL SELECT 'opened a tool', countIf(tool AND age > 0), countIf(tool AND age > 0 AND length(days) > 1), countIf(NOT tool AND age > 0), countIf(NOT tool AND age > 0 AND length(days) > 1) FROM (${PP})
    UNION ALL SELECT '3+ lessons on day 0', countIf(ndone0 >= 3 AND age > 0), countIf(ndone0 >= 3 AND age > 0 AND length(days) > 1), countIf(ndone0 < 3 AND age > 0), countIf(ndone0 < 3 AND age > 0 AND length(days) > 1) FROM (${PP})
    UNION ALL SELECT '1+ lesson on day 0', countIf(ndone0 >= 1 AND age > 0), countIf(ndone0 >= 1 AND age > 0 AND length(days) > 1), countIf(ndone0 < 1 AND age > 0), countIf(ndone0 < 1 AND age > 0 AND length(days) > 1) FROM (${PP})
    LIMIT 100`);
  await section('מי שחזר: מה עשה בימים שאחרי (אנשים)', ['returned people', 'started a lesson after day 0', 'finished a lesson after day 0', 'came from a notification (push_clicked)', 'lessons finished after day 0 (sum)'], `
    SELECT count(), countIf(ls > 0), countIf(lc > 0), countIf(pc > 0), sum(lc) FROM (
      SELECT e.person_id, countIf(e.event = 'lesson_started' AND ${day} > 0) AS ls, countIf(e.event = 'lesson_completed' AND ${day} > 0) AS lc,
        countIf(e.event = 'push_clicked') AS pc, max(${day}) AS md
      FROM ${EV} WHERE ${W} GROUP BY e.person_id HAVING md > 0) LIMIT 10`);

  await section('זמן ביום הראשון (מהאירוע הראשון לאחרון)', ['time', 'people', 'finished a lesson'], `
    SELECT b, count(), countIf(lc) FROM (
      SELECT e.person_id, dateDiff('second', min(e.timestamp), max(e.timestamp)) AS s, max(e.event = 'lesson_completed') AS lc
      FROM ${EV} WHERE ${W} AND ${day} = 0 GROUP BY e.person_id)
    ARRAY JOIN [multiIf(s < 10, '0-9s', s < 60, '10-59s', s < 180, '1-3m', s < 600, '3-10m', s < 1800, '10-30m', '30m+')] AS b
    GROUP BY b ORDER BY b LIMIT 100`);
  await section('שעה ביום (ישראל): פתיחות של חדשים ביום הראשון / פתיחות בימי חזרה', ['hour', 'first-day opens (people)', 'return-day opens (people)'], `
    SELECT toHour(${IL('e.timestamp')}) AS h, uniqIf(e.person_id, ${day} = 0), uniqIf(e.person_id, ${day} > 0)
    FROM ${EV} WHERE ${W} AND e.event = 'app_opened' GROUP BY h ORDER BY h LIMIT 100`);
  await section('יום בשבוע (ישראל, 1 = שני)', ['weekday', 'new people', 'return opens (people)'], `
    SELECT toDayOfWeek(${IL('e.timestamp')}) AS w, uniqIf(e.person_id, ${day} = 0 AND e.event = 'app_opened'), uniqIf(e.person_id, ${day} > 0 AND e.event = 'app_opened')
    FROM ${EV} WHERE ${W} GROUP BY w ORDER BY w LIMIT 100`);

  // lessons
  await section('שיעורים: התחילו (פעם ראשונה) / סיימו / זמן / דיוק / דירוג', ['lesson', 'started', 'finished', 'finish %', 'median sec', 'avg accuracy', 'paused or exited', 'rated (avg)'], `
    SELECT l, st, fin, round(100 * fin / greatest(st, 1)), med, acc, pe, rt FROM (
      SELECT toString(e.properties.lesson_id) AS l,
        uniqIf(e.person_id, e.event = 'lesson_started' AND toString(e.properties.replay) != 'true') AS st,
        uniqIf(e.person_id, e.event = 'lesson_completed' AND toString(e.properties.mode) = 'lesson') AS fin,
        round(quantileIf(0.5)(toFloat(e.properties.duration_sec), e.event = 'lesson_completed')) AS med,
        round(avgIf(toFloat(e.properties.accuracy), e.event = 'lesson_completed'), 2) AS acc,
        uniqIf(e.person_id, e.event IN ('lesson_paused', 'lesson_exited')) AS pe,
        concat(toString(uniqIf(e.person_id, e.event = 'lesson_rated')), ' (', toString(round(avgIf(toFloat(e.properties.rating), e.event = 'lesson_rated'), 1)), ')') AS rt
      FROM ${EV} WHERE ${W} AND e.event IN ('lesson_started', 'lesson_completed', 'lesson_paused', 'lesson_exited', 'lesson_rated') GROUP BY l)
    WHERE st > 0 OR fin > 0 ORDER BY st DESC LIMIT 100`);
  await section('איזה שיעור היה הראשון (onboarding_done) ואיזה אחריו', ['first lesson', 'people'], `
    SELECT toString(e.properties.first_lesson_id), count(DISTINCT e.person_id) FROM ${EV} WHERE ${W} AND e.event = 'onboarding_done' GROUP BY 1 ORDER BY 2 DESC LIMIT 100`);
  await section('סדר השיעורים שסיימו (שיעור 1, 2, 3 של כל אחד)', ['position', 'lesson', 'people'], `
    SELECT pos, l, count() FROM (
      SELECT e.person_id, arrayMap(x -> x.2, arraySort(x -> x.1, groupArrayIf((e.timestamp, toString(e.properties.lesson_id)), e.event = 'lesson_completed' AND toString(e.properties.mode) = 'lesson'))) AS seq
      FROM ${EV} WHERE ${W} GROUP BY e.person_id)
    ARRAY JOIN arrayEnumerate(arraySlice(arrayDistinct(seq), 1, 4)) AS pos, arraySlice(arrayDistinct(seq), 1, 4) AS l
    GROUP BY pos, l ORDER BY pos, count() DESC LIMIT 100`);
  await section('מסך הסיום: "השיעור הבא" הוצג / נלחץ', ['lesson', 'shown', 'tapped next'], `
    SELECT toString(e.properties.lesson_id) AS l, uniqIf(e.person_id, e.event = 'done_next_shown'), uniqIf(e.person_id, e.event = 'done_next_tapped')
    FROM ${EV} WHERE ${W} AND e.event IN ('done_next_shown', 'done_next_tapped') GROUP BY l ORDER BY 2 DESC LIMIT 100`);

  // steps in the most started lessons
  await section('צעד אחרי צעד (פעם ראשונה): כמה אנשים ראו כל צעד', ['lesson', 'steps', 'people per step (step 1, 2, 3 ...)'], `
    SELECT l, max(sc), arrayStringConcat(arrayMap(i -> toString(countIf(mx >= i)), range(0, toUInt32(max(sc)))), ' ') FROM (
      SELECT e.person_id, toString(e.properties.lesson_id) AS l, max(toInt(e.properties.step_index)) AS mx, max(toInt(e.properties.step_count)) AS sc
      FROM ${EV} WHERE ${W} AND e.event = 'step_viewed' AND toString(e.properties.mode) = 'lesson' GROUP BY e.person_id, l)
    GROUP BY l HAVING count() >= 4 ORDER BY count() DESC LIMIT 100`);
  await section('איפה עזבו באמצע שיעור (הצעד האחרון של מי שלא סיים)', ['lesson', 'step', 'kind', 'people'], `
    SELECT l, st + 1, k, count() FROM (
      SELECT e.person_id, toString(e.properties.lesson_id) AS l, argMax(toInt(e.properties.step_index), e.timestamp) AS st,
        argMax(toString(e.properties.step_kind), e.timestamp) AS k, max(e.event = 'lesson_completed') AS done
      FROM ${EV} WHERE ${W} AND e.event IN ('step_viewed', 'lesson_completed') AND toString(e.properties.mode) = 'lesson' GROUP BY e.person_id, l)
    WHERE NOT done GROUP BY l, st, k ORDER BY count() DESC LIMIT 25`);

  // questions
  await section('שאלות: נכון בניסיון הראשון (רק שאלות עם 4+ אנשים, הכי קשות קודם)', ['lesson', 'question', 'type', 'people', 'right first try %', 'most picked option (pos) when wrong'], `
    SELECT l, q, t, n, round(100 * ok / n), wrongpos FROM (
      SELECT toString(e.properties.lesson_id) AS l, toString(e.properties.question_id) AS q, any(toString(e.properties.question_type)) AS t,
        uniq(e.person_id) AS n, uniqIf(e.person_id, toString(e.properties.correct) = 'true') AS ok,
        topKIf(1)(toString(e.properties.option_index), toString(e.properties.correct) != 'true') AS wrongpos
      FROM ${EV} WHERE ${W} AND e.event = 'question_answered' AND toString(e.properties.retry) != 'true' AND toString(e.properties.review) != 'true'
        AND toString(e.properties.mode) = 'lesson' GROUP BY l, q)
    WHERE n >= 4 ORDER BY ok / n ASC LIMIT 30`);
  await section('שאלות: סיכום', ['answers (first try)', 'right %', 'questions with under 50% right'], `
    SELECT sum(n), round(100 * sum(ok) / sum(n)), countIf(ok / n < 0.5 AND n >= 4) FROM (
      SELECT toString(e.properties.question_id) AS q, uniq(e.person_id) AS n, uniqIf(e.person_id, toString(e.properties.correct) = 'true') AS ok
      FROM ${EV} WHERE ${W} AND e.event = 'question_answered' AND toString(e.properties.retry) != 'true' AND toString(e.properties.review) != 'true' GROUP BY q) LIMIT 5`);
  await section('מילון: מילים שנפתחו', ['term', 'people'], `
    SELECT toString(e.properties.term), uniq(e.person_id) FROM ${EV} WHERE ${W} AND e.event = 'term_opened' GROUP BY 1 ORDER BY 2 DESC LIMIT 20`);

  // first screen
  await section('המסך הראשון: כמה שניות עד לחיצה / עד עזיבה', ['what', '0-4s', '5-9s', '10-29s', '30-59s', '60s+'], `
    SELECT e.event, countIf(s < 5), countIf(s >= 5 AND s < 10), countIf(s >= 10 AND s < 30), countIf(s >= 30 AND s < 60), countIf(s >= 60) FROM (
      SELECT e.person_id, e.event, min(toFloat(e.properties.seconds)) AS s FROM ${EV} WHERE ${W} AND ${day} = 0 AND e.event IN ('start_screen_tapped', 'start_screen_left') GROUP BY e.person_id, e.event) e
    GROUP BY e.event LIMIT 10`);

  // features
  await section('כל האירועים של חדשים: כמה אנשים / כמה פעמים', ['event', 'people', 'times'], `
    SELECT e.event, uniq(e.person_id), count() FROM ${EV} WHERE ${W} GROUP BY e.event ORDER BY 2 DESC LIMIT 200`);
  await section('תזכורות: הצעה, תשובה, התראה שנלחצה', ['event', 'from / placement / state', 'people', 'times'], `
    SELECT e.event, concat(toString(e.properties.from), ' / ', toString(e.properties.placement), ' / ', toString(e.properties.state), ' / native=', toString(e.properties.native)),
      uniq(e.person_id), count()
    FROM ${EV} WHERE ${W} AND e.event IN ('push_popup_shown', 'push_asked', 'push_declined', 'push_denied', 'push_failed', 'push_subscribed', 'native_reminder_on', 'native_reminder_off', 'push_clicked')
    GROUP BY 1, 2 ORDER BY 1, 3 DESC LIMIT 100`);
  await section('כלים: נפתחו / שומשו', ['tool', 'opened (people)', 'used (people)', 'locked tapped (people)'], `
    SELECT toString(e.properties.tool_id) AS t, uniqIf(e.person_id, e.event = 'tool_opened'), uniqIf(e.person_id, e.event = 'tool_used'), uniqIf(e.person_id, e.event = 'tool_locked_tapped')
    FROM ${EV} WHERE ${W} AND e.event IN ('tool_opened', 'tool_used', 'tool_locked_tapped') GROUP BY t ORDER BY 2 DESC LIMIT 100`);
  await section('חברים וקבוצות', ['event', 'people', 'times'], `
    SELECT e.event, uniq(e.person_id), count() FROM ${EV} WHERE ${W}
      AND (e.event LIKE 'group_%' OR e.event LIKE 'social_%' OR e.event LIKE 'friend%' OR e.event IN ('nick_set', 'share_clicked', 'share_completed', 'share_failed', 'invite_reward'))
    GROUP BY 1 ORDER BY 2 DESC LIMIT 100`);
  await section('שיתוף: מאיפה', ['from', 'clicked (people)', 'completed (people)'], `
    SELECT toString(e.properties.from), uniqIf(e.person_id, e.event = 'share_clicked'), uniqIf(e.person_id, e.event = 'share_completed')
    FROM ${EV} WHERE ${W} AND e.event IN ('share_clicked', 'share_completed') GROUP BY 1 ORDER BY 2 DESC LIMIT 100`);
  await section('סוללה, רצף, ימי חופש, רמות, סקינים', ['event', 'people', 'times'], `
    SELECT e.event, uniq(e.person_id), count() FROM ${EV} WHERE ${W}
      AND e.event IN ('energy_empty', 'energy_refill', 'streak_lost', 'day_off_used', 'day_off_earned', 'days_off_intro_seen', 'level_up', 'skin_unlocked', 'skin_set', 'skin_locked_tapped',
        'practice_started', 'practice_completed', 'repair_started', 'repair_completed', 'daily_check_opened', 'daily_check_done', 'mission_completed', 'goal_set', 'review_asked')
    GROUP BY 1 ORDER BY 2 DESC LIMIT 100`);
  await section('סוללה נגמרה: באיזה שיעור / כמה שיעורים סיימו לפני', ['from', 'lessons done before (avg)', 'people'], `
    SELECT toString(e.properties.from), '-', uniq(e.person_id) FROM ${EV} WHERE ${W} AND e.event = 'energy_empty' GROUP BY 1 LIMIT 50`);
  await section('רמה הכי גבוהה שהגיעו', ['level', 'people'], `
    SELECT lv, count() FROM (SELECT e.person_id, max(toInt(e.properties.level)) AS lv FROM ${EV} WHERE ${W} AND e.event = 'level_up' GROUP BY e.person_id) GROUP BY lv ORDER BY lv LIMIT 50`);
  await section('מסכים שראו (tools/friends/profile/about...)', ['event', 'people'], `
    SELECT e.event, uniq(e.person_id) FROM ${EV} WHERE ${W} AND (e.event LIKE '%_viewed' OR e.event LIKE '%_opened') GROUP BY 1 ORDER BY 2 DESC LIMIT 60`);
  await section('משוב: כמה שלחו ודירוג (בלי הטקסט)', ['context', 'people', 'avg rating'], `
    SELECT toString(e.properties.context), uniq(e.person_id), round(avg(toFloat(e.properties.rating)), 1) FROM ${EV} WHERE ${W} AND e.event = 'feedback_sent' GROUP BY 1 LIMIT 50`);
  await section('גרסאות אפליקציה אצל החדשים', ['app_version', 'people'], `
    SELECT toString(e.properties.app_version), uniq(e.person_id) FROM ${EV} WHERE ${W} AND e.event = 'app_opened' GROUP BY 1 ORDER BY 1 DESC LIMIT 30`);
})().catch((e) => { console.error(String((e && e.message) || e)); process.exit(1); });
