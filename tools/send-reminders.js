#!/usr/bin/env node
/* Dribit daily reminder sender. GitHub Actions runs it every day (.github/workflows/reminders.yml).
   1. Reads the push subscriptions from PostHog: the app records push_subscribed and push_unsubscribed events.
   2. Skips people who finished a lesson today (Israel time) and people who already got today's reminder.
   3. Sends one short Web Push message to everyone else; the app's service worker shows it.
   4. Records reminder_sent per person, and push_unsubscribed for subscriptions the push service reports as gone.
   GitHub starts scheduled runs late (often by an hour or more, see 17.10.2026), so the workflow runs every half hour in the
   evening and the script sends in a window: from SEND_HOUR until WINDOW_HOURS later (18:00 to 21:59 Israel time). Each person
   still gets at most one reminder a day, because people with reminder_sent today are skipped.
   Needs: POSTHOG_API_KEY (a PostHog personal API key with query:read) and VAPID_PRIVATE_KEY (the pair of
   reminders.vapidPublicKey in config.js). Without them the run fails once a day (the first run in the window) with the
   reason, so the red mark in Actions shows reminders are not going out. Optional: POSTHOG_PROJECT_ID, DRY_RUN=1 (count only),
   FORCE=1 (ignore the hour), SEND_HOUR, WINDOW_HOURS, NOW=ISO time (tests), POSTHOG_API_HOST, POSTHOG_INGEST_HOST.
   ONLY_LATEST=1 is a test send (the only_latest box of a manual run): one message only to the person who used the app last,
   even if they already got today's reminder or finished a lesson today. If that person has no reminder turned on, nothing is
   sent to anyone and the run fails with the reason.
   EVERYONE=1 (the everyone box) sends one message right now to every subscription, even people already reminded or active
   today. MESSAGE (the message box) replaces the text of a test or everyone send: one line, at most 180 characters; a longer
   text, or a text without one of the two boxes, stops the run before anything is sent. Test and everyone sends do not count
   as the day's reminder, so the evening reminder still goes out.
   The log never contains endpoints, ids or keys. */
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
// the text of a test or everyone send: the message box of a manual run, one line, at most MESSAGE_MAX characters
const MESSAGE_MAX = 180;
const CUSTOM_MESSAGE = (process.env.MESSAGE || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
// the test goes to someone who just used the app; everyone includes people who already did today's lesson
const NOW_MESSAGE = CUSTOM_MESSAGE || (ONLY_LATEST ? 'השיעור של היום מחכה לך. כמה דקות וזה מאחוריך.' : 'יש לך כמה דקות? השיעור הבא בדריבית מחכה לך.');
const API_KEY = (process.env.POSTHOG_API_KEY || '').trim();
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
async function hogql(query) {
  const j = await api(`/api/projects/${PROJECT}/query/`, { query: { kind: 'HogQLQuery', query } });
  return j.results || [];
}

// events are sent the way the app sends them: the public project key, distinct_id inside properties
async function capture(list) {
  if (!list.length || !PH_KEY) return;
  const batch = list.map((e) => ({
    uuid: crypto.randomUUID(), event: e.event, timestamp: new Date().toISOString(),
    properties: Object.assign({ distinct_id: e.distinct_id, app_version: APP_VERSION, platform: 'sender' }, e.properties)
  }));
  const r = await fetch(`${PH_INGEST}/batch/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: PH_KEY, batch }) });
  if (!r.ok) console.log(`PostHog did not accept the run's events (${r.status})`);
}

async function main() {
  const t = israelNow();
  console.log(`Israel time ${t.date} ${two(t.hour)}:${two(t.minute)}${DRY ? ' (dry run)' : ''}${ONLY_LATEST ? ' (test: only the person who used the app last)' : EVERYONE ? ' (everyone with reminders on, now)' : ''}`);
  if (ONLY_LATEST && flag('EVERYONE')) console.log('Both only_latest and everyone were ticked: sending only to the person who used the app last.');
  if (CUSTOM_MESSAGE && !ONLY_LATEST && !EVERYONE) throw new Error('The message box is used only with only_latest or everyone. Nothing was sent: run again with one of them ticked.');
  const len = Array.from(CUSTOM_MESSAGE).length;
  if (len > MESSAGE_MAX) throw new Error(`The message is ${len} characters, and the limit is ${MESSAGE_MAX}. Nothing was sent: shorten it and run again.`);
  const inWindow = t.hour >= SEND_HOUR && t.hour < SEND_HOUR + WINDOW_HOURS;
  if (!FORCE && !ONLY_LATEST && !EVERYONE && !inWindow) {
    console.log(`Reminders go out between ${two(SEND_HOUR)}:00 and ${two(SEND_HOUR + WINDOW_HOURS - 1)}:59. Nothing to do now.`);
    return;
  }
  const missing = [!API_KEY && 'POSTHOG_API_KEY (a PostHog personal API key with query:read)', !DRY && !VAPID_PRIVATE && 'VAPID_PRIVATE_KEY'].filter(Boolean);
  if (missing.length) {
    const msg = `No reminders were sent: missing the repository secret${missing.length > 1 ? 's' : ''} ${missing.join(' and ')}. Settings > Secrets and variables > Actions.`;
    // fail once a day (the first hour of the window, or a manual run) so Actions shows a red mark; later runs only warn
    if (FORCE || ONLY_LATEST || EVERYONE || t.hour === SEND_HOUR) throw new Error(msg);
    console.log(`::warning::${msg}`);
    return;
  }
  if (!VAPID_PUBLIC) throw new Error('config.js has no reminders.vapidPublicKey.');
  if (!DRY) webpush.setVapidDetails(SITE, VAPID_PUBLIC, VAPID_PRIVATE);
  PROJECT = await projectId();

  // 1. the subscriptions: the newest push_subscribed or push_unsubscribed event per endpoint wins
  const rows = await hogql(
    "SELECT properties.endpoint, event, properties.p256dh, properties.auth, distinct_id FROM events " +
    "WHERE event IN ('push_subscribed', 'push_unsubscribed') AND timestamp > now() - INTERVAL 400 DAY " +
    'ORDER BY timestamp DESC LIMIT 10000');
  const subs = new Map();
  for (const [endpoint, event, p256dh, auth, uid] of rows) {
    if (!endpoint || subs.has(endpoint)) continue;
    subs.set(endpoint, event === 'push_subscribed' && p256dh && auth ? { endpoint, p256dh, auth, uid } : null);
  }
  const all = [...subs.values()].filter(Boolean);
  if (ONLY_LATEST) return onlyLatest(all, t);
  if (EVERYONE) {
    console.log(`Everyone with reminders on: ${all.length} subscription${all.length === 1 ? '' : 's'}.`);
    return sendNow(all, 'everyone', t);
  }

  // 2. who already did something today (Israel time), and who already got a reminder today
  const minutes = t.hour * 60 + t.minute;
  const ids = async (where) => new Set((await hogql(`SELECT distinct_id FROM events WHERE ${where} AND timestamp > now() - INTERVAL ${minutes} MINUTE LIMIT 10000`)).map((r) => r[0]));
  const active = await ids("event IN ('lesson_completed', 'practice_completed', 'repair_completed')");
  // only the daily reminder counts (it has message, the weekday text); test and everyone sends do not
  const reminded = await ids("event = 'reminder_sent' AND properties.message IS NOT NULL");
  const targets = all.filter((s) => !active.has(s.uid) && !reminded.has(s.uid));
  const counts = { subscriptions: all.length, skipped_active: all.filter((s) => active.has(s.uid)).length, skipped_reminded: 0, sent: 0, gone: 0, failed: 0 };
  counts.skipped_reminded = all.length - counts.skipped_active - targets.length;

  // 3. send the daily message
  const which = t.weekday % MESSAGES.length;
  const payload = JSON.stringify({ title: 'דריבית', body: MESSAGES[which], url: './?source=push', tag: 'daily' });
  const events = [];
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
  } else {
    await inBatches(targets, (s) => send(s, payload, () => {
      counts.sent++;
      events.push({ event: 'reminder_sent', distinct_id: s.uid, properties: { weekday: t.weekday, message: which, push_service: host(s.endpoint) } });
    }));
  }
  events.push({ event: 'reminder_run', distinct_id: 'dribit-reminders', properties: Object.assign({ dry_run: DRY, weekday: t.weekday, $process_person_profile: false }, counts) });
  if (!DRY) await capture(events);
  console.log(JSON.stringify(counts));
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
