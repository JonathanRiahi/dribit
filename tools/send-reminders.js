#!/usr/bin/env node
/* Dribit daily reminder sender. GitHub Actions runs it every day (.github/workflows/reminders.yml).
   1. Reads the push subscriptions from PostHog: the app records push_subscribed and push_unsubscribed events.
   2. Skips people who finished a lesson today (Israel time) and people who already got today's reminder.
   3. Sends one short Web Push message to everyone else; the app's service worker shows it.
   4. Records reminder_sent per person, and push_unsubscribed for subscriptions the push service reports as gone.
   GitHub starts scheduled runs late and creates only a few of them (17-19.10.2026: 4 of 30 slots, all late; on 19.10 the
   only one came at 23:17), so the main trigger is a daily workflow_dispatch at 18:04 Israel time with backup=true (a Claude
   scheduled task), and the cron every 10 minutes is the fallback. Either way the script sends only in the window: from
   SEND_HOUR until WINDOW_HOURS later (18:00 to 21:59 Israel time).
   At most one reminder a day per person: reminder_sent is recorded before the pushes go out (if PostHog does not take it,
   nothing is sent and the run fails), and the run does not end until PostHog shows it, so the next run, which the
   workflow's concurrency group holds until this one ends, skips those people. Queries skip PostHog's result cache.
   Needs: POSTHOG_API_KEY (a PostHog personal API key with query:read) and VAPID_PRIVATE_KEY (the pair of
   reminders.vapidPublicKey in config.js). Without them the run fails once a day (the first run in the window) with the
   reason, so the red mark in Actions shows reminders are not going out. Optional: POSTHOG_PROJECT_ID, DRY_RUN=1 (count only),
   FORCE=1 (ignore the hour), SEND_HOUR, WINDOW_HOURS, NOW=ISO time (tests), POLL_MS (tests), POSTHOG_API_HOST,
   POSTHOG_INGEST_HOST.
   ONLY_LATEST=1 is a test send (the only_latest box of a manual run): one message only to the person who used the app last,
   even if they already got today's reminder or finished a lesson today. If that person has no reminder turned on, nothing is
   sent to anyone and the run fails with the reason.
   EVERYONE=1 (the everyone box) sends one message right now to every subscription, even people already reminded or active
   today. MESSAGE (the message box) replaces the text of a test or everyone send: one line, at most 180 characters; a longer
   text, or a text without one of the two boxes, stops the run before anything is sent. Test and everyone sends do not count
   as the day's reminder, so the evening reminder still goes out.
   DIAGNOSE=1 (the diagnose box) sends nothing and records nothing. It prints, for each subscription and for everyone who
   used the app today, the last 3 days (Israel time): app opens, finished lessons, reminders and taps, plus today's runs.
   It answers "why didn't I get today's reminder". People show only as the first 8 characters of their PostHog person id
   (as in a PostHog export). Delete the run's log once read.
   Each day's reminder has its own notification tag (daily-<date>), so it pops up with a sound even when yesterday's
   reminder is still in the phone's notification list. With one tag for every day, the new one quietly replaced the old.
   The log never contains endpoints, distinct ids or keys. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const webpush = require('web-push');

const config = fs.readFileSync(path.join(__dirname, '..', 'config.js'), 'utf8');
const cfg = (key) => { const m = config.match(new RegExp(key + ":\\s*'([^']*)'")); return m ? m[1] : ''; };
const flag = (name) => /^(1|true|yes)$/i.test(process.env[name] || '');

const VAPID_PUBLIC = cfg('vapidPublicKey');
const PH_KEY = cfg('posthogKey');
const PH_INGEST = (process.env.POSTHOG_INGEST_HOST || cfg('host') || 'https://eu.i.posthog.com').replace(/\/$/, '');
const PH_API = (process.env.POSTHOG_API_HOST || PH_INGEST.replace('.i.posthog.com', '.posthog.com')).replace(/\/$/, '');
const APP_VERSION = cfg('version');
const SEND_HOUR = +(process.env.SEND_HOUR || (config.match(/reminders:[\s\S]*?hour:\s*(\d+)/) || [])[1] || 18);
const WINDOW_HOURS = +(process.env.WINDOW_HOURS || 4);
const SITE = 'https://jonathanriahi.github.io/dribit/';
const DRY = flag('DRY_RUN');
const FORCE = flag('FORCE');
const ONLY_LATEST = flag('ONLY_LATEST');
const EVERYONE = flag('EVERYONE') && !ONLY_LATEST;
const DIAGNOSE = flag('DIAGNOSE');
// the text of a test or everyone send: the message box of a manual run, one line, at most MESSAGE_MAX characters
const MESSAGE_MAX = 180;
const CUSTOM_MESSAGE = (process.env.MESSAGE || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
// the test goes to someone who just used the app; everyone includes people who already did today's lesson
const NOW_MESSAGE = CUSTOM_MESSAGE || (ONLY_LATEST ? 'השיעור של היום מחכה לך. כמה דקות וזה מאחוריך.' : 'יש לך כמה דקות? השיעור הבא בדריבית מחכה לך.');
const API_KEY = (process.env.POSTHOG_API_KEY || '').trim();
// this run's id on its daily reminder_sent events, to wait until PostHog shows them
const RUN = crypto.randomUUID();
const POLL_MS = +(process.env.POLL_MS || 10000);
const POLL_TRIES = 24; // about 4 minutes; timeout-minutes in the workflow leaves room for it
const VAPID_PRIVATE = (process.env.VAPID_PRIVATE_KEY || '').trim();

// one message per weekday (0 = Sunday), so a week of reminders does not repeat itself
const MESSAGES = [
  'יש לך כמה דקות? השיעור הבא מחכה.',
  'שיעור קצר היום שומר על הרצף.',
  'עוד שיעור אחד, ועוד צעד קדימה.',
  'הידע מצטבר כמו ריבית דריבית. היום זה הזמן.',
  'ערב טוב! נשארו כמה דקות לשיעור של היום.',
  'הנקודות של היום עדיין מחכות לך.',
  'מה לומדים היום? פותחים ורואים.'
];

function israelNow() {
  const parts = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short'
  }).formatToParts(process.env.NOW ? new Date(process.env.NOW) : new Date()).forEach((p) => { parts[p.type] = p.value; });
  const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: +parts.hour % 24, minute: +parts.minute, weekday: days[parts.weekday] || 0 };
}
const host = (url) => { try { return new URL(url).hostname; } catch (e) { return '?'; } };
const two = (n) => (n < 10 ? '0' : '') + n;

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
async function projectId() {
  if (PROJECT) return PROJECT;
  const j = await api('/api/projects/');
  const list = j.results || [];
  if (!list.length) throw new Error('PostHog listed no project for this key. Add the POSTHOG_PROJECT_ID secret (PostHog > Settings > Project).');
  return String(list[0].id);
}
// force_blocking: always compute, never answer from PostHog's cache (a cached answer would hide the reminders that a run
// a minute earlier recorded, and everyone would get a second one)
async function hogql(query) {
  const j = await api(`/api/projects/${PROJECT}/query/`, { query: { kind: 'HogQLQuery', query }, refresh: 'force_blocking' });
  return j.results || [];
}

// events are sent the way the app sends them: the public project key, distinct_id inside properties
// must: true throws when PostHog does not take the events (after 3 tries), so a run that cannot record who it reminded
// sends nothing and shows red
async function capture(list, must) {
  if (!list.length) return;
  if (!PH_KEY) { if (must) throw new Error('config.js has no posthogKey, so the run cannot record who it reminded. Nothing was sent.'); return; }
  const batch = list.map((e) => ({
    uuid: crypto.randomUUID(), event: e.event, timestamp: new Date().toISOString(),
    properties: Object.assign({ distinct_id: e.distinct_id, app_version: APP_VERSION, platform: 'sender' }, e.properties)
  }));
  let why = '';
  for (let i = 0; i < 3; i++) {
    if (i) await new Promise((r) => setTimeout(r, 2000 * i));
    try {
      const r = await fetch(`${PH_INGEST}/batch/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: PH_KEY, batch }) });
      if (r.ok) return;
      why = `HTTP ${r.status}`;
    } catch (e) { why = String((e && e.message) || e).slice(0, 100); }
  }
  if (must) throw new Error(`PostHog did not take the reminder records (${why}), so nothing was sent. The next run tries again.`);
  console.log(`PostHog did not accept the run's events (${why})`);
}

async function main() {
  const t = israelNow();
  console.log(`Israel time ${t.date} ${two(t.hour)}:${two(t.minute)}${DIAGNOSE ? ' (diagnose: nothing is sent)' : DRY ? ' (dry run)' : ''}${DIAGNOSE ? '' : ONLY_LATEST ? ' (test: only the person who used the app last)' : EVERYONE ? ' (everyone with reminders on, now)' : ''}`);
  if (ONLY_LATEST && flag('EVERYONE')) console.log('Both only_latest and everyone were ticked: sending only to the person who used the app last.');
  if (CUSTOM_MESSAGE && !ONLY_LATEST && !EVERYONE && !DIAGNOSE) throw new Error('The message box is used only with only_latest or everyone. Nothing was sent: run again with one of them ticked.');
  const len = Array.from(CUSTOM_MESSAGE).length;
  if (len > MESSAGE_MAX) throw new Error(`The message is ${len} characters, and the limit is ${MESSAGE_MAX}. Nothing was sent: shorten it and run again.`);
  const inWindow = t.hour >= SEND_HOUR && t.hour < SEND_HOUR + WINDOW_HOURS;
  if (!FORCE && !ONLY_LATEST && !EVERYONE && !DIAGNOSE && !inWindow) {
    console.log(`Reminders go out between ${two(SEND_HOUR)}:00 and ${two(SEND_HOUR + WINDOW_HOURS - 1)}:59. Nothing to do now.`);
    return;
  }
  const missing = [!API_KEY && 'POSTHOG_API_KEY (a PostHog personal API key with query:read)', !DRY && !DIAGNOSE && !VAPID_PRIVATE && 'VAPID_PRIVATE_KEY'].filter(Boolean);
  if (missing.length) {
    const msg = `No reminders were sent: missing the repository secret${missing.length > 1 ? 's' : ''} ${missing.join(' and ')}. Settings > Secrets and variables > Actions.`;
    // fail once a day (the first hour of the window, or a manual run) so Actions shows a red mark; later runs only warn
    if (FORCE || ONLY_LATEST || EVERYONE || DIAGNOSE || t.hour === SEND_HOUR) throw new Error(msg);
    console.log(`::warning::${msg}`);
    return;
  }
  if (!VAPID_PUBLIC) throw new Error('config.js has no reminders.vapidPublicKey.');
  if (!DRY && !DIAGNOSE) webpush.setVapidDetails(SITE, VAPID_PUBLIC, VAPID_PRIVATE);
  PROJECT = await projectId();

  // 1. the subscriptions: the newest push_subscribed or push_unsubscribed event per endpoint wins
  const rows = await hogql(
    "SELECT properties.endpoint, event, properties.p256dh, properties.auth, distinct_id, toString(toTimeZone(timestamp, 'Asia/Jerusalem')), " +
    'properties.from, substring(toString(person_id), 1, 8) FROM events ' +
    "WHERE event IN ('push_subscribed', 'push_unsubscribed') AND timestamp > now() - INTERVAL 400 DAY " +
    'ORDER BY timestamp DESC LIMIT 10000');
  const subs = new Map();
  for (const [endpoint, event, p256dh, auth, uid, at, from, person] of rows) {
    if (!endpoint || subs.has(endpoint)) continue;
    subs.set(endpoint, event === 'push_subscribed' && p256dh && auth ? { endpoint, p256dh, auth, uid, at, from, person } : null);
  }
  const all = [...subs.values()].filter(Boolean);
  if (DIAGNOSE) return diagnose(all, t);
  if (ONLY_LATEST) return onlyLatest(all, t);
  if (EVERYONE) {
    console.log(`Everyone with reminders on: ${all.length} subscription${all.length === 1 ? '' : 's'}.`);
    return sendNow(all, 'everyone', t);
  }

  // 2. who already did something today (the Israel calendar date, also right on the days the clock changes), and who
  // already got a reminder today
  const today = `toDate(toTimeZone(timestamp, 'Asia/Jerusalem')) = toDate('${t.date}') AND timestamp > now() - INTERVAL 2 DAY`;
  const ids = async (where) => new Set((await hogql(`SELECT distinct_id FROM events WHERE ${where} AND ${today} LIMIT 10000`)).map((r) => r[0]));
  const active = await ids("event IN ('lesson_completed', 'practice_completed', 'repair_completed')");
  // only the daily reminder counts (it has message, the weekday text); test and everyone sends do not
  const reminded = await ids("event = 'reminder_sent' AND properties.message IS NOT NULL");
  const targets = all.filter((s) => !active.has(s.uid) && !reminded.has(s.uid));
  const counts = { subscriptions: all.length, skipped_active: all.filter((s) => active.has(s.uid)).length, skipped_reminded: 0, sent: 0, gone: 0, failed: 0 };
  counts.skipped_reminded = all.length - counts.skipped_active - targets.length;

  // 3. record, then send the daily message
  const which = t.weekday % MESSAGES.length;
  // a tag per day: a new day's reminder pops up even if yesterday's is still in the notification list (one tag for every
  // day made the new one quietly replace the old one, with no sound or banner)
  const payload = JSON.stringify({ title: 'דריבית', body: MESSAGES[which], url: './?source=push', tag: 'daily-' + t.date });
  const events = [];
  const sentRecord = (s) => ({ event: 'reminder_sent', distinct_id: s.uid, properties: { weekday: t.weekday, message: which, push_service: host(s.endpoint), run: RUN } });
  const send = async (s, body, onSent) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 6 * 3600, urgency: 'normal' });
      onSent();
    } catch (e) {
      const code = e && e.statusCode;
      if (code === 404 || code === 410) {
        counts.gone++;
        events.push({ event: 'push_unsubscribed', distinct_id: s.uid, properties: { endpoint: s.endpoint, reason: 'gone', status: code, $set: { reminders: false } } });
      } else {
        counts.failed++;
        console.log(`push failed: HTTP ${code || '?'} via ${host(s.endpoint)}: ${String((e && e.message) || e).split('\n')[0].slice(0, 100)}`);
      }
    }
  };
  const inBatches = async (list, fn) => { for (let i = 0; i < list.length; i += 10) await Promise.all(list.slice(i, i + 10).map(fn)); };
  if (DRY) {
    console.log(`Would send "${MESSAGES[which]}" to ${targets.length} of ${all.length} subscriptions.`);
    await shown(); // checks that the wait query works, without waiting
  } else if (targets.length) {
    await capture(targets.map(sentRecord), true);
    await inBatches(targets, (s) => send(s, payload, () => { counts.sent++; }));
  }
  events.push({ event: 'reminder_run', distinct_id: 'dribit-reminders', properties: Object.assign({ dry_run: DRY, weekday: t.weekday, run: RUN, $process_person_profile: false }, counts) });
  if (!DRY) await capture(events);
  // hold the concurrency group until PostHog shows this run's reminder_sent, so the next run skips these people
  if (!DRY && targets.length) {
    for (let i = 0; ; i++) {
      const n = await shown();
      if (n >= targets.length) { console.log(`PostHog shows the ${n} reminder record${n === 1 ? '' : 's'} of this run.`); break; }
      if (i >= POLL_TRIES) { console.log(`::warning::PostHog shows only ${n} of ${targets.length} reminder records after ${Math.round(POLL_TRIES * POLL_MS / 1000)} s; a run right after this one could remind them again.`); break; }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }
  console.log(JSON.stringify(counts)); // last line, so the counts are easy to find in the log
}
// the diagnose box: what happened to each subscription, and to everyone who used the app today, in the last 3 days
async function diagnose(all, t) {
  const tz = "toString(toTimeZone(timestamp, 'Asia/Jerusalem'))";
  const rows = await hogql(
    `SELECT substring(toString(person_id), 1, 8), distinct_id, event, ${tz}, properties.platform, properties.standalone, ` +
    'properties.app_version, properties.message, properties.test, properties.everyone FROM events ' +
    "WHERE timestamp > now() - INTERVAL 4 DAY AND event IN ('app_opened', 'lesson_completed', 'practice_completed', " +
    "'repair_completed', 'reminder_sent', 'push_clicked', 'push_subscribed', 'push_unsubscribed') " +
    "AND distinct_id != 'dribit-reminders' ORDER BY timestamp LIMIT 10000");
  const runs = await hogql(
    `SELECT ${tz}, properties.sent, properties.skipped_active, properties.skipped_reminded, properties.failed, properties.gone, ` +
    "properties.dry_run, properties.only_latest, properties.everyone FROM events WHERE event = 'reminder_run' " +
    'AND timestamp > now() - INTERVAL 4 DAY ORDER BY timestamp LIMIT 500');
  const day = (n) => { const d = new Date(t.date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const days = [day(2), day(1), day(0)];
  const dm = (date) => date.slice(8, 10) + '.' + date.slice(5, 7);
  const hm = (at) => String(at || '').slice(11, 16);
  const service = (url) => {
    const h = host(url);
    return /apple\.com$/.test(h) ? 'iPhone/iPad (Apple push)' : /googleapis\.com$/.test(h) ? 'Android/Chrome (Google push)' :
      /mozilla/.test(h) ? 'Firefox (Mozilla push)' : /windows\.com$/.test(h) ? 'Windows push' : 'push service ' + h;
  };
  const done = { lesson_completed: 'lesson', practice_completed: 'practice', repair_completed: 'streak repair' };
  const evs = rows.map(([person, uid, event, at, platform, standalone, version, message, test, everyone]) =>
    ({ person, uid, event, at: String(at || ''), date: String(at || '').slice(0, 10), platform, standalone, version, message, test, everyone }));
  const dayLine = (list, date) => {
    const of = list.filter((e) => e.date === date);
    const parts = [];
    const opens = of.filter((e) => e.event === 'app_opened');
    if (opens.length) {
      const last = opens[opens.length - 1];
      const where = last.standalone === true || last.standalone === 'true' ? 'home-screen app' : last.standalone === false || last.standalone === 'false' ? 'browser' : '?';
      parts.push(`opened ${opens.length}x (last ${hm(last.at)}, ${last.platform || '?'}, ${where}, ${last.version || '?'})`);
    }
    of.filter((e) => done[e.event]).forEach((e) => parts.push(`finished a ${done[e.event]} ${hm(e.at)}`));
    of.filter((e) => e.event === 'reminder_sent').forEach((e) => parts.push(`${e.message != null && e.message !== '' ? 'daily reminder' : e.test ? 'test reminder' : e.everyone ? 'everyone send' : 'reminder'} sent ${hm(e.at)}`));
    of.filter((e) => e.event === 'push_clicked').forEach((e) => parts.push(`tapped a reminder ${hm(e.at)}`));
    of.filter((e) => e.event === 'push_subscribed').forEach((e) => parts.push(`turned reminders on ${hm(e.at)}`));
    of.filter((e) => e.event === 'push_unsubscribed').forEach((e) => parts.push(`reminders off ${hm(e.at)}`));
    return `    ${dm(date)}: ${parts.length ? parts.join('; ') : 'nothing'}`;
  };
  console.log(`Subscriptions with reminders on: ${all.length}`);
  const subUids = new Set(all.map((s) => s.uid));
  all.slice().sort((a, b) => String(a.at || '').localeCompare(String(b.at || ''))).forEach((s, i) => {
    const mine = evs.filter((e) => e.uid === s.uid);
    const person = s.person || (mine.find((e) => e.person) || {}).person || '?';
    console.log(`#${i + 1} person ${person}, ${service(s.endpoint)}, on since ${s.at ? dm(String(s.at).slice(0, 10)) + ' ' + hm(s.at) : '?'}${s.from ? ' (from ' + s.from + ')' : ''}`);
    days.forEach((d) => console.log(dayLine(mine, d)));
    const today = mine.filter((e) => e.date === t.date);
    const sent = today.find((e) => e.event === 'reminder_sent' && e.message != null && e.message !== '');
    const learned = today.filter((e) => done[e.event]);
    console.log('    today: ' + (sent ? `got the daily reminder at ${hm(sent.at)}` :
      learned.length ? `no daily reminder: finished a ${done[learned[0].event]} today at ${hm(learned[0].at)}, and people who already learned today get none` :
        'no daily reminder sent yet'));
  });
  const others = new Map();
  evs.filter((e) => e.date === t.date && e.event === 'app_opened' && !subUids.has(e.uid)).forEach((e) => {
    const k = e.person || e.uid;
    if (!others.has(k)) others.set(k, []);
    others.get(k).push(e);
  });
  console.log(`Used the app today without reminders on: ${others.size}`);
  [...others.entries()].forEach(([person, list]) => {
    const all3 = evs.filter((e) => (e.person || e.uid) === person);
    console.log(`  person ${String(person).slice(0, 8)}`);
    days.forEach((d) => console.log(dayLine(all3, d)));
  });
  console.log('Reminder runs (only runs that reached the sending step):');
  days.forEach((d) => {
    const of = runs.filter((r) => String(r[0] || '').slice(0, 10) === d);
    console.log(`  ${dm(d)}: ` + (of.length ? of.map(([at, sent, act, rem, failed, gone, dry, only, every]) =>
      `${hm(at)} ${dry === true || dry === 'true' ? 'dry run' : only === true || only === 'true' ? 'test' : every === true || every === 'true' ? 'everyone' : 'daily'}: sent ${sent || 0}` +
      (act != null ? `, skipped (learned today) ${act || 0}` : '') + (rem != null ? `, skipped (already reminded) ${rem || 0}` : '') +
      `, failed ${failed || 0}, gone ${gone || 0}`).join('; ') : 'none'));
  });
  console.log(JSON.stringify({ diagnose: true, subscriptions: all.length, used_today_without_reminders: others.size }));
}

// how many of this run's daily reminder_sent events PostHog shows
async function shown() {
  const r = await hogql(`SELECT count() FROM events WHERE event = 'reminder_sent' AND properties.run = '${RUN}' AND timestamp > now() - INTERVAL 1 HOUR`);
  return +((r[0] || [])[0] || 0);
}

// the test send: one message to whoever used the app last (their newest event in the last 7 days, not counting this script's own)
async function onlyLatest(all, t) {
  const rows = await hogql(
    "SELECT distinct_id, argMax(event, timestamp), dateDiff('minute', max(timestamp), now()) FROM events " +
    "WHERE timestamp > now() - INTERVAL 7 DAY AND event NOT IN ('reminder_sent', 'reminder_run') " +
    "AND coalesce(properties.platform, '') != 'sender' AND distinct_id != 'dribit-reminders' " +
    'GROUP BY distinct_id ORDER BY max(timestamp) DESC LIMIT 1000');
  if (!rows.length) throw new Error('Nobody used the app in the last 7 days, so there is no one to send the test to.');
  const subscribed = new Set(all.map((s) => s.uid));
  const ago = (m) => (m < 1 ? 'less than a minute' : m === 1 ? '1 minute' : `${m} minutes`) + ' ago';
  const [uid, lastEvent, minutes] = rows[0];
  const mine = all.filter((s) => s.uid === uid);
  console.log(`The person who used the app last: "${lastEvent}" ${ago(+minutes)}, ${mine.length} reminder subscription${mine.length === 1 ? '' : 's'}.`);
  if (!mine.length) {
    const next = rows.find((r) => subscribed.has(r[0]));
    throw new Error('Nothing was sent: the person who used the app last has no reminder turned on (Profile > reminder switch, on that phone).' +
      (next ? ` The most recent person with reminders on was last active ${ago(+next[2])}.` : ' Nobody has reminders on.'));
  }
  return sendNow(mine, 'test', t);
}

// a send outside the daily rules (test or everyone): NOW_MESSAGE to each subscription in the list. Each run has its own
// notification tag, so it shows (and sounds) as a new notification instead of quietly replacing an earlier one; the link
// carries kind, so a tap on it is not counted as a tap on the daily reminder. An everyone send waits up to 12 hours for a
// phone that is off (soldiers hand phones in); a test, 1 hour.
async function sendNow(list, kind, t) {
  const counts = { [kind === 'test' ? 'only_latest' : 'everyone']: true, subscriptions: list.length, sent: 0, gone: 0, failed: 0 };
  const events = [];
  if (DRY) {
    console.log(`Would send "${NOW_MESSAGE}" to ${list.length} subscription${list.length === 1 ? '' : 's'}.`);
  } else {
    const payload = JSON.stringify({ title: 'דריבית', body: NOW_MESSAGE, url: './?source=push&kind=' + kind, tag: kind + '-' + Date.now() });
    const ttl = kind === 'test' ? 3600 : 12 * 3600;
    const one = async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: ttl, urgency: 'high' });
        counts.sent++;
        events.push({ event: 'reminder_sent', distinct_id: s.uid, properties: { [kind === 'test' ? 'test' : 'everyone']: true, custom_text: !!CUSTOM_MESSAGE, weekday: t.weekday, push_service: host(s.endpoint) } });
      } catch (e) {
        const code = e && e.statusCode;
        if (code === 404 || code === 410) {
          counts.gone++;
          events.push({ event: 'push_unsubscribed', distinct_id: s.uid, properties: { endpoint: s.endpoint, reason: 'gone', status: code, $set: { reminders: false } } });
        } else {
          counts.failed++;
          console.log(`push failed: HTTP ${code || '?'} via ${host(s.endpoint)}: ${String((e && e.message) || e).split('\n')[0].slice(0, 100)}`);
        }
      }
    };
    for (let i = 0; i < list.length; i += 10) await Promise.all(list.slice(i, i + 10).map(one));
    events.push({ event: 'reminder_run', distinct_id: 'dribit-reminders', properties: Object.assign({ dry_run: false, weekday: t.weekday, $process_person_profile: false }, counts) });
    await capture(events);
  }
  console.log(JSON.stringify(counts));
  if (!DRY && list.length && !counts.sent) throw new Error('The message did not go out (see above).');
}

main().catch((e) => { console.error(String((e && e.message) || e) + (e && e.cause ? ' (' + String(e.cause.message || e.cause) + ')' : '')); process.exit(1); });
