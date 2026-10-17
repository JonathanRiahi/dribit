#!/usr/bin/env node
/* Dribit daily reminder sender. GitHub Actions runs it every day (.github/workflows/reminders.yml).
   1. Reads the push subscriptions from PostHog: the app records push_subscribed and push_unsubscribed events.
   2. Skips people who finished a lesson today (Israel time) and people who already got today's reminder.
   3. Sends one short Web Push message to everyone else; the app's service worker shows it.
   4. Records reminder_sent per person, and push_unsubscribed for subscriptions the push service reports as gone.
   5. Discharge timeline: people who saved a release month in the app (discharge_month_set) get three one-time messages,
      two months before, in the release month and after the money came in; that day they get no daily reminder.
   Needs: POSTHOG_API_KEY (a PostHog personal API key with query:read) and VAPID_PRIVATE_KEY (the pair of
   reminders.vapidPublicKey in config.js). Optional: POSTHOG_PROJECT_ID, DRY_RUN=1 (count only), FORCE=1 (ignore the
   hour), SEND_HOUR, TODAY=YYYY-MM-DD (tests), POSTHOG_API_HOST, POSTHOG_INGEST_HOST. The log never contains endpoints or keys. */
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
const SITE = 'https://jonathanriahi.github.io/dribit/';
const DRY = flag('DRY_RUN');
const FORCE = flag('FORCE');
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

// the three discharge messages (the app's calendar file carries the long versions of the same three)
const DISCHARGE = {
  pre: 'הפיקדון מתקרב. עוד חודשיים בערך משתחררים: 3 שיעורים קצרים לפני ההחלטה.',
  month: 'החודש משתחררים! המענק נכנס עד 60 יום אחרי. יש כבר תוכנית לכל שקל?',
  post: 'הכסף הגיע? הנה מה עושים ב-60 הימים הראשונים.'
};

function israelNow() {
  const parts = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short'
  }).formatToParts(new Date()).forEach((p) => { parts[p.type] = p.value; });
  const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const date = /^\d{4}-\d{2}-\d{2}$/.test(process.env.TODAY || '') ? process.env.TODAY : `${parts.year}-${parts.month}-${parts.day}`;
  return { date, hour: +parts.hour % 24, minute: +parts.minute, weekday: days[parts.weekday] || 0 };
}
// which discharge milestone a release month ('YYYY-MM') makes due on a date: two months before (from the 1st), the release
// month (from the 1st), after the money came in (from the 15th of the next month); each stays due for 30 days
const utcDay = (y, m, d) => Date.UTC(y, m - 1, d);
function dueMilestone(month, today) {
  const m = /^(\d{4})-(\d{2})$/.exec(month || ''), tm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today || '');
  if (!m || !tm) return null;
  const y = +m[1], mo = +m[2], T = utcDay(+tm[1], +tm[2], +tm[3]), DAY = 864e5;
  const starts = { pre: utcDay(y, mo - 2, 1), month: utcDay(y, mo, 1), post: utcDay(y, mo + 1, 15) };
  for (const id of ['post', 'month', 'pre']) if (T >= starts[id] && T < starts[id] + 30 * DAY) return id;
  return null;
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
  console.log(`Israel time ${t.date} ${two(t.hour)}:${two(t.minute)}${DRY ? ' (dry run)' : ''}`);
  if (!FORCE && t.hour !== SEND_HOUR && t.hour !== SEND_HOUR + 1) {
    console.log(`Reminders go out at ${two(SEND_HOUR)}:00. Nothing to do now.`);
    return;
  }
  if (!API_KEY) throw new Error('Missing the POSTHOG_API_KEY secret (a PostHog personal API key with query:read).');
  if (!VAPID_PUBLIC) throw new Error('config.js has no reminders.vapidPublicKey.');
  if (!DRY && !VAPID_PRIVATE) throw new Error('Missing the VAPID_PRIVATE_KEY secret.');
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

  // 2. the discharge timeline: the newest discharge_month_set per person (an empty month = deleted); a milestone goes out
  //    once per person, month and milestone, so a changed month starts its own three
  const monthRows = await hogql("SELECT distinct_id, properties.month FROM events WHERE event = 'discharge_month_set' AND timestamp > now() - INTERVAL 400 DAY ORDER BY timestamp DESC LIMIT 10000");
  const months = new Map();
  for (const [uid, month] of monthRows) if (uid && !months.has(uid)) months.set(uid, month || null);
  const sentRows = await hogql("SELECT distinct_id, properties.milestone, properties.month FROM events WHERE event = 'discharge_reminder_sent' AND timestamp > now() - INTERVAL 400 DAY LIMIT 10000");
  const dischargeSent = new Set(sentRows.map(([uid, ms, month]) => `${uid}|${ms}|${month}`));
  const due = new Map();
  for (const [uid, month] of months) {
    const ms = month && dueMilestone(month, t.date);
    if (ms && !dischargeSent.has(`${uid}|${ms}|${month}`)) due.set(uid, { milestone: ms, month });
  }
  const dischargeTargets = all.filter((s) => due.has(s.uid));

  // 3. who already did something today (Israel time), and who already got a reminder today
  const minutes = t.hour * 60 + t.minute;
  const ids = async (where) => new Set((await hogql(`SELECT distinct_id FROM events WHERE ${where} AND timestamp > now() - INTERVAL ${minutes} MINUTE LIMIT 10000`)).map((r) => r[0]));
  const active = await ids("event IN ('lesson_completed', 'practice_completed', 'repair_completed')");
  const reminded = await ids("event = 'reminder_sent'");
  const daily = all.filter((s) => !due.has(s.uid));
  const targets = daily.filter((s) => !active.has(s.uid) && !reminded.has(s.uid));
  const counts = { subscriptions: all.length, skipped_active: daily.filter((s) => active.has(s.uid)).length, skipped_reminded: 0, sent: 0, gone: 0, failed: 0,
    discharge_due: dischargeTargets.length, discharge_sent: 0 };
  counts.skipped_reminded = daily.length - counts.skipped_active - targets.length;

  // 4. send: the daily message, and the discharge message to the people whose milestone is today
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
    console.log(`Would send "${MESSAGES[which]}" to ${targets.length} of ${all.length} subscriptions, and a discharge reminder to ${dischargeTargets.length}.`);
  } else {
    await inBatches(targets, (s) => send(s, payload, () => {
      counts.sent++;
      events.push({ event: 'reminder_sent', distinct_id: s.uid, properties: { weekday: t.weekday, message: which, push_service: host(s.endpoint) } });
    }));
    await inBatches(dischargeTargets, (s) => {
      const d = due.get(s.uid);
      const body = JSON.stringify({ title: 'דריבית', body: DISCHARGE[d.milestone], url: './?source=push&kind=discharge-' + d.milestone, tag: 'discharge' });
      return send(s, body, () => {
        counts.discharge_sent++;
        events.push({ event: 'discharge_reminder_sent', distinct_id: s.uid, properties: { milestone: d.milestone, month: d.month, push_service: host(s.endpoint) } });
      });
    });
  }
  events.push({ event: 'reminder_run', distinct_id: 'dribit-reminders', properties: Object.assign({ dry_run: DRY, weekday: t.weekday, $process_person_profile: false }, counts) });
  if (!DRY) await capture(events);
  console.log(JSON.stringify(counts));
}

main().catch((e) => { console.error(String((e && e.message) || e) + (e && e.cause ? ' (' + String(e.cause.message || e.cause) + ')' : '')); process.exit(1); });
