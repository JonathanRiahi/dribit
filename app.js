/* דריבית: אפליקציה ללימוד פיננסים שמתקינים למסך הבית (PWA).
   בלי שרת ובלי התחברות: התוכן מגיע מ-data/lessons.json וההתקדמות נשמרת במכשיר (localStorage).
   נתוני שימוש אנונימיים נשלחים ל-PostHog כשיש מפתח ב-config.js. */
(function () {
  'use strict';

  var CFG = window.DRIBIT_CONFIG;
  var P = CFG.points;
  // days off for the streak (config.daysOff): read by migrate(), so it is set before the state loads
  var DO = CFG.daysOff || { enabled: false, maxHeld: 0, perLevel: 0, invite: 0, inviteEveryDays: 7, friendGift: 0, minStreak: 2 };
  var STORE_KEY = 'dribit.progress.v1';
  var QUEUE_KEY = 'dribit.events.v1';
  var HEB_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];
  var RESUME_DAYS = 14;
  var AWAY_HOME_MS = 15 * 1000;  // back after longer than this in the background, and the app starts on home again (Jonathan, 18.10)
  var OPEN_AWAY_MS = 10 * 60 * 1000;  // back after this long counts as a new open for the install and notifications popups (19.10)
  var AWAY_KEEP_MS = 10 * 60 * 1000;  // ...but a trip out and back (a sheet, a practice run, a link or share the app opened) keeps its screen this long
  // content v5 reordered unit 5: old lesson id -> new lesson id
  var LESSON_MOVES_V5 = { '5.1': '5.3', '5.2': '5.4', '5.3': '5.1', '5.4': '5.5' };

  // ---------- Icons ----------
  var ICON = {
    flame: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c.6 3.2-1 5-2.4 6.7C8.2 10.4 7 12 7 14.4 7 17.5 9.2 20 12 20s5-2.4 5-5.4c0-1.8-.7-3.2-1.6-4.3-.3 1.3-1 2.2-2 2.6.5-3.5-.4-7.3-1.4-10.9z"/><path d="M12 22c-4 0-7-3.1-7-7.3 0-3.3 1.8-5.5 3.2-7.2C9.5 5.9 10.6 4.6 10.3 2l-.1-.9.9.3C15.7 3 19 7.7 19 14.7 19 18.9 16 22 12 22z" opacity=".35"/></svg>',
    coin: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="2"/></svg>',
    coins: '<svg viewBox="0 0 24 24" fill="currentColor"><ellipse cx="9" cy="5.5" rx="6" ry="2.5"/><path d="M3 5.5v3c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-3c0 1.4-2.7 2.5-6 2.5S3 6.9 3 5.5z" opacity=".7"/><path d="M3 9.5v3c0 1.4 2.7 2.5 6 2.5.7 0 1.4 0 2-.1v-3c-.6.1-1.3.1-2 .1-3.3 0-6-1.1-6-2.5z" opacity=".55"/><ellipse cx="16" cy="12.5" rx="5.5" ry="2.4"/><path d="M10.5 12.5V16c0 1.3 2.5 2.4 5.5 2.4s5.5-1.1 5.5-2.4v-3.5c0 1.3-2.5 2.4-5.5 2.4s-5.5-1.1-5.5-2.4z" opacity=".7"/><path d="M10.5 17v2.6c0 1.3 2.5 2.4 5.5 2.4s5.5-1.1 5.5-2.4V17c0 1.3-2.5 2.4-5.5 2.4s-5.5-1.1-5.5-2.4z" opacity=".55"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.2l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 10V7a5 5 0 0110 0v3h1a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8a2 2 0 012-2h1zm2 0h6V7a3 3 0 00-6 0v3z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    // in RTL "back" points right
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4.5A2.5 2.5 0 016.5 2H20v17H6.5a1.5 1.5 0 000 3H20H6.5A2.5 2.5 0 014 19.5z"/></svg>',
    path: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="7" cy="5" r="3"/><circle cx="17" cy="12" r="3"/><circle cx="7" cy="19" r="3"/><path d="M8 7.5l7 3M15 13.5l-7 3" stroke="currentColor" stroke-width="2"/></svg>',
    dumbbell: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1.5" y="8" width="4" height="8" rx="1.2"/><rect x="5" y="5.5" width="3.5" height="13" rx="1.2"/><rect x="15.5" y="5.5" width="3.5" height="13" rx="1.2"/><rect x="18.5" y="8" width="4" height="8" rx="1.2"/><rect x="8" y="10.8" width="8" height="2.4"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4.5"/><path d="M3 21c.8-4.4 4.4-7 9-7s8.2 2.6 9 7z"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h12v2h3v3a4 4 0 01-4 4h-.4A5 5 0 0113 15.9V18h3v3H8v-3h3v-2.1A5 5 0 017.4 12H7a4 4 0 01-4-4V5h3zm0 4H5v1a2 2 0 001.2 1.8A5 5 0 016 8zm12 0v1c0 .6 0 1.2-.2 1.8A2 2 0 0019 8V7z"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 2L4 13.5h6.5L9.5 22 20 9.5h-6.6z"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 3.5h16A2.5 2.5 0 0122.5 6v10a2.5 2.5 0 01-2.5 2.5H9.5L4 22.5v-4A2.5 2.5 0 011.5 16V6A2.5 2.5 0 014 3.5z"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7.5 7.5L12 3l4.5 4.5"/><path d="M5 11v8a2 2 0 002 2h10a2 2 0 002-2v-8"/></svg>',
    addHome: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 1.5h8A2.5 2.5 0 0118.5 4v16a2.5 2.5 0 01-2.5 2.5H8A2.5 2.5 0 015.5 20V4A2.5 2.5 0 018 1.5zm0 3V18h8V4.5zm4 15a1.1 1.1 0 100 2.2 1.1 1.1 0 000-2.2z"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>',
    rescue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a1.5 1.5 0 011.5 1.5v.9A6 6 0 0118 10v4.2l1.7 2.3a1 1 0 01-.8 1.6H5.1a1 1 0 01-.8-1.6L6 14.2V10a6 6 0 014.5-5.6v-.9A1.5 1.5 0 0112 2zm-2.5 17.5h5a2.5 2.5 0 01-5 0z"/></svg>',
    dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
    // a beach umbrella: a day off for the streak
    dayoff: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5A9.5 9.5 0 002.5 12H11v7.25a1.25 1.25 0 01-2.5 0v-.75h-2v.75a3.25 3.25 0 006.5 0V12h8.5A9.5 9.5 0 0012 2.5z"/></svg>',
    ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></svg>'
  };

  // ---------- Utils ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function dayKey(d) {
    d = d || new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function daysBetween(a, b) {
    var pa = a.split('-'), pb = b.split('-');
    return Math.round((new Date(+pb[0], pb[1] - 1, +pb[2]) - new Date(+pa[0], pa[1] - 1, +pa[2])) / 864e5);
  }
  function parseDay(k) { var p = k.split('-'); return new Date(+p[0], p[1] - 1, +p[2]); }
  function isDayKey(x) { return typeof x === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(x); }
  function fmt(n) { return Number(n).toLocaleString('he-IL'); }
  function plural(n, one, many) { return n === 1 ? one : fmt(n) + ' ' + many; }
  // keeps "+10" and "55 / 100" in the right order inside Hebrew text
  function ltr(s) { return '<bdi dir="ltr">' + s + '</bdi>'; }
  function plus(n) { return ltr('+' + n); }
  function clock(ms) { var s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function hex(n) {
    try {
      var b = new Uint8Array(n); crypto.getRandomValues(b);
      return Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    } catch (e) {
      var s = ''; while (s.length < n * 2) s += Math.random().toString(16).slice(2); return s.slice(0, n * 2);
    }
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var h = hex(16);
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-' + ((parseInt(h[16], 16) & 3) | 8).toString(16) + h.slice(17, 20) + '-' + h.slice(20, 32);
  }
  function reducedMotion() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  var IN_FRAME = (function () { try { return window.self !== window.top; } catch (e) { return true; } })();
  var IS_IOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var IS_ANDROID = /android/i.test(navigator.userAgent);
  function isStandalone() {
    try { return !!(window.matchMedia('(display-mode: standalone)').matches || navigator.standalone); } catch (e) { return false; }
  }

  // ---------- Progress (saved on the device) ----------
  function freshState() {
    return {
      v: 3, onboarded: false, status: null, goalXp: CFG.defaultGoal, sound: true, share: true,
      startUnit: null,   // the unit the path opens with (config.startUnit by status); null = the file order
      uid: hex(12), firstDay: dayKey(), contentV: 0,
      xp: 0, streak: 0, bestStreak: 0, lastDay: null,
      lostStreak: null,  // { value, lastDay } when a long streak broke and can still be rescued
      days: {},          // 'YYYY-MM-DD' -> points that day
      lessons: {},       // lessonId -> { done, best, plays, fastest }
      missions: {},      // lessonId -> { steps: [bool], done: bool }
      mistakes: {},      // questionId -> times answered wrong (goes down when answered right)
      answered: 0, correct: 0,
      inProgress: null,  // the unfinished lesson, so the app reopens on the same screen
      ratings: {}, intent: {}, amount: {}, installHidden: false,
      installSeen: false, // the installed app was opened at least once (counted as app_installed)
      importedAt: null,   // the day a transfer code was pasted here
      ref: null,          // the ref= of the link this person first opened the app from (an invite link carries ref=share)
      calc: null,         // the discharge calculator's last input: { type, months, training, lone, at }
      reminder: null,    // { on, endpoint, hour, since } while the daily push reminder is on
      reminderNo: null,  // { count, day } after "not now" on the reminder card
      daysOff: 0,        // days off for the streak held now (config.daysOff.maxHeld at most)
      offLevel: 0,       // the highest level index already paid with a day off
      offSince: dayKey(), // days off cover only days missed from this date on
      offUsed: [],       // the days a day off covered (the last 30)
      inviteOffDay: null, // the day the last day off for sharing the link was given
      giftPending: false, // first opened from an invite link with no progress: the friend gift waits for lesson 1
      giftGot: false,    // the friend gift was given
      offIntroSeen: true, // the one-time "חדש" sheet about days off was shown
      offRetro: 0        // days off given at the update for levels already passed
    };
  }
  // what a transfer code carries to another browser or phone. Never the reminder (it belongs to this browser),
  // the open lesson or the event queue.
  var TRANSFER_KEYS = ['v', 'uid', 'status', 'startUnit', 'goalXp', 'sound', 'share', 'firstDay', 'contentV', 'xp', 'streak',
    'bestStreak', 'lastDay', 'lostStreak', 'days', 'lessons', 'missions', 'mistakes', 'answered', 'correct', 'ratings', 'intent', 'amount', 'ref', 'calc',
    'daysOff', 'offLevel', 'offSince', 'offUsed', 'inviteOffDay', 'giftPending', 'giftGot', 'offIntroSeen', 'offRetro'];
  function migrate(s) {
    // before 0.9 there were no days off: checked before the defaults below fill offLevel in
    var needsOff = !('offLevel' in s);
    var base = freshState();
    for (var k in base) if (!(k in s)) s[k] = base[k];
    if (s.actions) { // v1 kept a single checkbox per lesson
      Object.keys(s.actions).forEach(function (id) { if (s.actions[id]) s.missions[id] = { steps: [], done: true }; });
      delete s.actions;
    }
    var goals = CFG.goals.map(function (g) { return g.xp; });
    if (goals.indexOf(s.goalXp) < 0) s.goalXp = CFG.defaultGoal;
    // 0.8.1 had a discharge timeline (month, calendar file); 0.9 removed it
    delete s.dischargeMonth; delete s.dischargeIcs; delete s.dischargeNo;
    // 0.9: each level passed so far is paid with a day off (up to maxHeld); they cover missed days from today on.
    // The state stays v 3 so older builds and their transfer codes keep working; the check is on the key, not on v.
    if (needsOff) {
      s.offLevel = levelIndex(s.xp || 0);
      s.daysOff = DO.enabled ? Math.min(DO.maxHeld, s.offLevel * DO.perLevel) : 0;
      s.offRetro = s.daysOff;
      s.offSince = dayKey();
      s.offIntroSeen = !(s.xp > 0);
    }
    var top = levelIndex(+s.xp || 0);
    if (!(s.offLevel >= 0) || s.offLevel > top) s.offLevel = top;
    s.offLevel = Math.floor(s.offLevel);
    s.daysOff = Math.max(0, Math.min(Math.floor(+s.daysOff || 0), DO.maxHeld || 0));
    if (!Array.isArray(s.offUsed)) s.offUsed = [];
    s.offUsed = s.offUsed.filter(isDayKey).slice(-30);
    if (!isDayKey(s.offSince)) s.offSince = dayKey();
    if (s.inviteOffDay != null && !isDayKey(s.inviteOffDay)) s.inviteOffDay = null;
    if (s.offSince > dayKey()) s.offSince = dayKey();
    cleanState(s);
    s.v = 3;
    return s;
  }
  // stored and imported progress is untrusted: every field keeps only values of the right shape, so nothing odd reaches
  // the page or a date function (review of 0.9, 18.10)
  function num0(x) { return typeof x === 'number' && isFinite(x) && x >= 0 ? x : 0; }
  function okKey(k) { return typeof k === 'string' && /^[\w.-]{1,40}$/.test(k); }
  function okWord(x) { return typeof x === 'string' && /^[\w-]{1,20}$/.test(x); }
  function cleanMap(m, fix, keyOk) {
    var out = {};
    if (m && typeof m === 'object' && !Array.isArray(m)) {
      Object.keys(m).forEach(function (k) { if ((keyOk || okKey)(k)) { var v = fix(m[k]); if (v != null) out[k] = v; } });
    }
    return out;
  }
  function isRec(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function cleanState(s) {
    ['xp', 'streak', 'bestStreak', 'answered', 'correct'].forEach(function (k) { s[k] = num0(s[k]); });
    s.contentV = Math.floor(num0(s.contentV));
    if (typeof s.uid !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(s.uid)) s.uid = hex(12);
    if (!CFG.statuses.some(function (st) { return st.id === s.status; })) s.status = null;
    if (s.startUnit != null && !(typeof s.startUnit === 'number' && isFinite(s.startUnit)) && !okKey(s.startUnit)) s.startUnit = null;
    if (typeof s.sound !== 'boolean') s.sound = true;
    if (typeof s.share !== 'boolean') s.share = true;
    if (!isDayKey(s.firstDay)) s.firstDay = dayKey();
    if (s.lastDay != null && !isDayKey(s.lastDay)) { s.lastDay = null; s.streak = 0; }
    s.lostStreak = isRec(s.lostStreak) && isDayKey(s.lostStreak.lastDay) && num0(s.lostStreak.value) > 0
      ? { value: num0(s.lostStreak.value), lastDay: s.lostStreak.lastDay } : null;
    if (s.ref != null && !(typeof s.ref === 'string' && /^[\w-]{1,40}$/.test(s.ref))) s.ref = null;
    // calcState checks the type against config later (config is not read yet when the saved state loads)
    s.calc = isRec(s.calc) ? { type: okWord(s.calc.type) ? s.calc.type : null, months: num0(s.calc.months), training: num0(s.calc.training),
      trainingEdited: s.calc.trainingEdited === true, lone: s.calc.lone === true, at: num0(s.calc.at) } : null;
    s.days = cleanMap(s.days, function (v) { return num0(v); }, isDayKey);
    s.lessons = cleanMap(s.lessons, function (r) {
      return isRec(r) ? { done: r.done === true, best: num0(r.best), plays: num0(r.plays), fastest: num0(r.fastest) || null } : null;
    });
    s.missions = cleanMap(s.missions, function (m) {
      return isRec(m) ? { steps: Array.isArray(m.steps) ? m.steps.slice(0, 20).map(function (x) { return x === true; }) : [], done: m.done === true } : null;
    });
    s.mistakes = cleanMap(s.mistakes, function (v) { return Math.floor(num0(v)); });
    ['ratings', 'intent', 'amount'].forEach(function (k) { s[k] = cleanMap(s[k], function (v) { return okWord(v) ? v : null; }); });
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) return migrate(JSON.parse(raw));
    } catch (e) { /* storage blocked: progress lives only for this visit */ }
    return freshState();
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
  }
  var S = load();

  function currentStreak() {
    if (!S.lastDay) return 0;
    var today = dayKey(), yday = dayKey(addDays(new Date(), -1));
    return (S.lastDay === today || S.lastDay === yday) ? S.streak : 0;
  }
  // a missed day breaks the streak, unless there are enough days off to cover every missed day; a long streak that
  // breaks is kept aside so it can be rescued
  var offToast = null;
  function checkStreakBreak() {
    if (!S.lastDay || !S.streak || !isDayKey(S.lastDay)) return;
    var today = dayKey(), yday = dayKey(addDays(new Date(), -1));
    if (S.lastDay === today || S.lastDay === yday) return;
    var missed = daysBetween(S.lastDay, today) - 1;
    if (missed > 0 && useDaysOff(missed)) return;
    if (S.streak >= CFG.streakRepair.minStreak) {
      S.lostStreak = { value: S.streak, lastDay: S.lastDay };
      track('streak_lost', { value: S.streak, gap_days: missed, days_off_held: S.daysOff });
    }
    S.streak = 0;
    save();
  }
  // all or nothing: only past days, only from offSince on, only from a streak of minStreak. The streak is kept, not grown.
  function useDaysOff(missed) {
    if (!DO.enabled || S.streak < DO.minStreak || S.daysOff < missed) return false;
    var first = dayKey(addDays(parseDay(S.lastDay), 1));
    if (first < S.offSince) return false;
    for (var i = 1; i <= missed; i++) S.offUsed.push(dayKey(addDays(parseDay(S.lastDay), i)));
    S.offUsed = S.offUsed.slice(-30);
    S.daysOff -= missed;
    S.lastDay = dayKey(addDays(new Date(), -1));
    offToast = { used: missed, left: S.daysOff, streak: S.streak };
    track('day_off_used', { count: missed, streak: S.streak, held_after: S.daysOff });
    save();
    return true;
  }
  function repairInfo() {
    var L = S.lostStreak;
    if (!L || !isDayKey(L.lastDay)) return null;
    var missed = daysBetween(L.lastDay, dayKey()) - 1;
    if (missed > CFG.streakRepair.withinDays) { S.lostStreak = null; save(); return null; }
    if (!doneCount()) return null;
    return { value: L.value, daysLeft: CFG.streakRepair.withinDays - missed };
  }
  function todayXp() { return Number(S.days[dayKey()]) || 0; }
  function awardXp(n) {
    checkStreakBreak();
    var today = dayKey();
    S.xp += n;
    S.days[today] = (S.days[today] || 0) + n;
    if (S.lastDay !== today) {
      S.streak = (S.lastDay === dayKey(addDays(new Date(), -1))) ? S.streak + 1 : 1;
      S.lastDay = today;
      S.bestStreak = Math.max(S.bestStreak, S.streak);
    }
    return grantLevelDaysOff();
  }
  // every new level pays one day off for the streak (up to maxHeld); returns what was added, for the level-up sheet
  function grantLevelDaysOff() {
    var lvl = levelIndex(S.xp), gained = lvl - S.offLevel;
    if (gained <= 0) return null;
    S.offLevel = lvl;
    if (!DO.enabled) return null;
    var want = gained * DO.perLevel, before = S.daysOff;
    S.daysOff = Math.min(DO.maxHeld, before + want);
    var g = { added: S.daysOff - before, held: S.daysOff, atCap: S.daysOff - before < want };
    track('day_off_earned', { source: 'level', added: g.added, held: g.held, at_cap: g.atCap, level: lvl + 1 });
    return g;
  }

  // levels: points turn into levels ("שלב N מתוך 11"); each new level pays a day off for the streak
  // days off cover a streak only from minStreak days on: said wherever the app promises them
  function minStreakNote() { return DO.minStreak > 1 ? ' (מרצף של ' + DO.minStreak + ' ימים ומעלה)' : ''; }
  function levelIndex(xp) {
    var L = CFG.levels, i = 0;
    while (i + 1 < L.length && xp >= L[i + 1].min) i++;
    return i;
  }
  function levelInfo(xp) {
    var L = CFG.levels, i = levelIndex(xp), cur = L[i], next = L[i + 1];
    return {
      i: i, n: i + 1, total: L.length, name: cur.name || '', last: !next,
      toNext: next ? next.min - xp : 0,
      pct: next ? (xp - cur.min) / (next.min - cur.min) : 1
    };
  }
  function levelLabel(r) { return 'שלב ' + r.n + ' מתוך ' + r.total + (r.name ? ' · ' + r.name : ''); }
  // the line under a level: how far the next one is, and what it brings (nothing to promise when the days off are full)
  function nextLevelLine(r) {
    if (r.last) return 'השלב האחרון. כל הכבוד';
    return 'עוד ' + fmt(r.toNext) + ' נקודות לשלב ' + (r.n + 1) + (DO.enabled && S.daysOff < DO.maxHeld ? ', ואיתו יום חופש לרצף' : '');
  }
  // "יום חופש אחד" / "2 ימי חופש"
  function daysOffText(n) { return n === 1 ? 'יום חופש אחד לרצף' : fmt(n) + ' ימי חופש לרצף'; }

  // ---------- Content ----------
  var DATA = null, UNITS = [], LESSONS = [], BY_ID = {}, QUESTIONS = {}, SOURCES = Object.create(null);
  // official pages behind fact questions (lessons.json "sources", a question's "src"): https only, on these sites only
  var SOURCE_HOST = /^https:\/\/([a-z0-9-]+\.)*(kolzchut\.org\.il|gov\.il|boi\.org\.il|tase\.co\.il)\//i;
  function cleanSources(raw) {
    var out = Object.create(null);
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(raw).forEach(function (k) {
      var x = raw[k];
      if (k !== '__proto__' && x && typeof x.url === 'string' && SOURCE_HOST.test(x.url) && typeof x.site === 'string' && typeof x.title === 'string') out[k] = x;
    });
    return out;
  }
  function srcOf(q) { return q && typeof q.src === 'string' && Object.prototype.hasOwnProperty.call(SOURCES, q.src) ? SOURCES[q.src] : null; }
  // audience: which statuses see a lesson, screen or question (missing = everyone)
  function visible(x) { return !x.audience || !S.status || x.audience.indexOf(S.status) >= 0; }
  // the calculator screen exists only while the calculator is switched on in config
  function screenShown(s) { return visible(s) && (s.type !== 'calculator' || calcEnabled()); }
  // the units in path order: the start unit (by status) first, then the file order; an unknown id changes nothing
  function orderedUnits(startId) {
    var units = DATA.units.slice();
    if (startId == null) return units;
    for (var i = 1; i < units.length; i++) if (String(units[i].id) === String(startId)) { units.unshift(units.splice(i, 1)[0]); break; }
    return units;
  }
  // the first lesson a status would get, with its length, without touching the live index (the welcome screen)
  function firstLessonFor(status) {
    var aud = function (x) { return !x.audience || x.audience.indexOf(status) >= 0; };
    var units = orderedUnits(CFG.startUnit && CFG.startUnit[status] != null ? CFG.startUnit[status] : null);
    for (var i = 0; i < units.length; i++) {
      var ls = units[i].lessons.filter(aud);
      if (!ls.length) continue;
      var l = ls[0];
      var scr = l.screens.filter(function (s) { return aud(s) && (s.type !== 'calculator' || calcEnabled()); });
      return { lesson: l, minutes: Math.max(3, Math.round((scr.length * 45 + l.questions.filter(aud).length * 30) / 60)) };
    }
    return null;
  }
  function indexContent() {
    UNITS = []; LESSONS = []; BY_ID = {}; QUESTIONS = {}; SOURCES = cleanSources(DATA.sources);
    orderedUnits(S.startUnit).forEach(function (u) {
      u.lessons.forEach(function (l) {
        l.unit = u;
        if (!l.mission) l.mission = { title: l.action, why: '', minutes: 10, steps: [], done: '' };
        l.questions.forEach(function (q) { q.lessonId = l.id; QUESTIONS[q.id] = q; });
        BY_ID[l.id] = l;
      });
      var vis = u.lessons.filter(visible);
      if (!vis.length) return;
      u.vis = vis;
      u.n = UNITS.length + 1;
      UNITS.push(u);
      vis.forEach(function (l, i) {
        l.n = i + 1;
        l.order = LESSONS.length;
        l.vScreens = l.screens.filter(screenShown);
        l.vQuestions = l.questions.filter(visible);
        LESSONS.push(l);
      });
    });
  }
  function shown(l) { return !!l && LESSONS.indexOf(l) >= 0; }
  function migrateContent() {
    var v = DATA.version || 0;
    if ((S.contentV || 0) < 5 && v >= 5) {
      ['lessons', 'missions'].forEach(function (key) {
        var out = {};
        Object.keys(S[key]).forEach(function (id) { out[LESSON_MOVES_V5[id] || id] = S[key][id]; });
        S[key] = out;
      });
      S.inProgress = null;
    }
    if ((S.contentV || 0) < 6 && v >= 6) S.inProgress = null;
    // v9 replaced every mission with a short one (18.10): ticks on an unfinished mission belonged to the old steps
    if ((S.contentV || 0) < 9 && v >= 9) {
      Object.keys(S.missions).forEach(function (id) { var m = S.missions[id]; if (isRec(m) && !m.done) m.steps = []; });
    }
    // v10 reordered the lessons (19.10: stock and bond before index). An unfinished lesson that now sits
    // after the next lesson in the path is dropped, so "להמשיך" never skips ahead of the path.
    if ((S.contentV || 0) < 10 && v >= 10 && S.inProgress) {
      var ipl = BY_ID[S.inProgress.lessonId], cur = currentLesson();
      if (ipl && cur && !isDone(ipl.id) && shown(ipl) && ipl.order > cur.order) S.inProgress = null;
    }
    // v11 (19.10, Shahar's feedback): question Q10 in 2.1 turned from true/false into four options, so a saved answer
    // to it no longer fits. A saved session that holds it (2.1 itself, or a later lesson that picked it as its review
    // question) starts over. 2.1 also gained a screen for soldiers, so its saved screen numbers point elsewhere.
    if ((S.contentV || 0) < 11 && v >= 11 && S.inProgress && (S.inProgress.lessonId === '2.1' ||
        (S.inProgress.steps || []).some(function (x) { return x && x.k === 'q' && x.id === 'Q10'; }))) S.inProgress = null;
    S.contentV = v;
    save();
  }
  function isDone(id) { return !!(S.lessons[id] && S.lessons[id].done); }
  function currentLesson() {
    for (var i = 0; i < LESSONS.length; i++) if (!isDone(LESSONS[i].id)) return LESSONS[i];
    return null;
  }
  function isUnlocked(l) {
    var cur = currentLesson();
    return isDone(l.id) || (cur && cur.id === l.id);
  }
  function doneCount() { return LESSONS.filter(function (l) { return isDone(l.id); }).length; }
  function missionState(id) { return S.missions[id] || { steps: [], done: false }; }
  function openMissions() { return LESSONS.filter(function (l) { return isDone(l.id) && !missionState(l.id).done; }); }
  function maxLessonPoints(l) {
    return l.vQuestions.length * P.correct + P.lessonDone + P.perfect + P.speed;
  }
  function lessonMinutes(l) {
    return Math.max(3, Math.round((l.vScreens.length * 45 + l.vQuestions.length * 30) / 60));
  }

  // ---------- Usage data (PostHog) ----------
  // Events wait in a queue on the device and are sent in batches, so nothing is lost offline
  // or before an analytics key exists. Each event has a uuid, so a resend is not counted twice.
  var EQ = (function () { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch (e) { return []; } })();
  var flushTimer = null, flushing = false;
  function saveQueue() { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(EQ)); } catch (e) { /* ignore */ } }
  function track(event, props) {
    if (!S.share) return;
    var p = {
      distinct_id: S.uid, app_version: CFG.version, content_version: DATA ? DATA.version : null,
      status: S.status, standalone: isStandalone(), platform: IS_IOS ? 'ios' : IS_ANDROID ? 'android' : 'other'
    };
    for (var k in props || {}) p[k] = props[k];
    EQ.push({ uuid: uuid(), event: event, properties: p, timestamp: new Date().toISOString() });
    if (EQ.length > 600) EQ = EQ.slice(-600);
    saveQueue();
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 2000);
  }
  function flush() {
    var key = CFG.analytics && CFG.analytics.posthogKey;
    if (!key || !EQ.length || flushing || navigator.onLine === false) return;
    var batch = EQ.slice(0, 100);
    var body = JSON.stringify({ api_key: key, batch: batch });
    flushing = true;
    try {
      fetch(CFG.analytics.host.replace(/\/$/, '') + '/batch/', {
        // text/plain keeps it a simple request (no CORS preflight), so keepalive also works when the app closes
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: body, keepalive: body.length < 60000
      }).then(function (r) {
        if (!r.ok) return;
        var sent = {};
        batch.forEach(function (e) { sent[e.uuid] = 1; });
        EQ = EQ.filter(function (e) { return !sent[e.uuid]; });
        saveQueue();
        if (EQ.length) setTimeout(flush, 500);
      }).catch(function () { /* offline: try again later */ }).then(function () { flushing = false; });
    } catch (e) { flushing = false; }
  }

  // ---------- Sound and effects ----------
  var actx = null;
  function audio() {
    if (!S.sound) return null;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      return actx;
    } catch (e) { return null; }
  }
  function note(freq, at, dur, type, vol, slideTo) {
    var a = audio();
    if (!a) return;
    try {
      var t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
      o.type = type || 'triangle';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(a.destination);
      o.start(t); o.stop(t + dur + 0.03);
    } catch (e) { /* no audio */ }
  }
  function buzz(p) { try { if (S.sound && navigator.vibrate) navigator.vibrate(p); } catch (e) { /* ignore */ } }
  var sfx = {
    tap: function () { note(640, 0, 0.05, 'sine', 0.05); },
    right: function (combo) {
      var up = Math.min(combo || 0, 8) * 25;
      note(784 + up, 0, 0.1, 'triangle', 0.16);
      note(1175 + up, 0.08, 0.16, 'triangle', 0.15);
      note(2350 + up, 0.17, 0.12, 'sine', 0.05);
      buzz(18);
    },
    wrong: function () { note(220, 0, 0.14, 'square', 0.05, 180); note(160, 0.12, 0.22, 'square', 0.05, 120); buzz([40, 30, 40]); },
    pair: function () { note(988, 0, 0.08, 'triangle', 0.12); note(1319, 0.06, 0.1, 'triangle', 0.1); },
    combo: function (n) {
      [523, 659, 784, 1047, 1319, 1568].slice(0, Math.min(6, 2 + Math.floor(n / 2))).forEach(function (f, i) { note(f, i * 0.07, 0.13, 'square', 0.045); });
    },
    coin: function () { note(1568, 0, 0.05, 'square', 0.03); note(2093, 0.035, 0.07, 'square', 0.028); },
    done: function () {
      [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36]].forEach(function (x) { note(x[0], x[1], 0.24, 'triangle', 0.15); });
      [1047, 1319, 1568].forEach(function (f) { note(f, 0.5, 0.6, 'sine', 0.05); });
      buzz([30, 40, 30]);
    },
    level: function () {
      [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach(function (f, i) { note(f, i * 0.09, 0.2, 'triangle', 0.14); });
      [1047, 1319, 1568, 2093].forEach(function (f) { note(f, 0.8, 1, 'sine', 0.05); });
      buzz([40, 50, 40, 50, 90]);
    },
    streak: function () { note(300, 0, 0.35, 'sawtooth', 0.035, 900); note(900, 0.3, 0.3, 'triangle', 0.1, 1300); }
  };

  function center(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  function floatText(el, text) {
    if (!el) return;
    var c = center(el), s = document.createElement('div');
    s.className = 'float-pts';
    s.textContent = text;
    s.style.left = c.x + 'px'; s.style.top = c.y + 'px';
    document.body.appendChild(s);
    setTimeout(function () { s.remove(); }, 1100);
  }
  function burst(el) {
    if (!el || reducedMotion()) return;
    var c = center(el), w = document.createElement('div');
    w.className = 'burst';
    w.style.left = c.x + 'px'; w.style.top = c.y + 'px';
    var html = '';
    for (var i = 0; i < 14; i++) {
      html += '<i style="--a:' + Math.round(i * 360 / 14 + Math.random() * 12) + 'deg;--d:' + Math.round(48 + Math.random() * 46) + 'px;--c:var(' + ['--gold', '--ok', '--flame', '--q-accent'][i % 4] + ')"></i>';
    }
    w.innerHTML = html;
    document.body.appendChild(w);
    setTimeout(function () { w.remove(); }, 900);
  }
  function toast(html, cls, ms) {
    ms = ms || 1700;
    var old = document.querySelector('.toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.className = 'toast' + (cls ? ' ' + cls : '');
    t.setAttribute('role', 'status');
    t.innerHTML = String(html).replace(/<\/b><span>/g, '</b> <span>');
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, ms);
    setTimeout(function () { t.remove(); }, ms + 400);
  }

  // ---------- Rendering ----------
  var root, view = 'home', session = null, sheetOpen = false, notesId = null, onboardStep = 0;
  var deferredInstall = null, pendingReload = false, pushBusy = false;
  // how the app was opened: source 'homescreen' (the installed icon), 'push' (a tap on the reminder), 'ics' (a calendar
  // reminder) or 'link'; ref (an invite link carries ref=share); kind (which reminder, when a message says)
  function openParams() {
    var q = location.search || '';
    var get = function (k) { var m = new RegExp('[?&]' + k + '=([\\w-]+)').exec(q); return m ? m[1] : null; };
    var ref = get('ref');
    return { source: get('source') || 'link', ref: ref && ref.length <= 40 ? ref : null, kind: get('kind') };
  }
  // the same address loaded again in the same tab is not a new open: source 'update' (a reload the app made for a new
  // version) or 'reload' (pull to refresh, the phone reloading the app), with no ref or kind. The address itself keeps
  // its parameters: a friend who moves from WhatsApp's browser to Safari still brings ?ref=share.
  var RELOAD_KIND = (function () {
    try {
      var here = String(location.href).split('#')[0];
      var upd = sessionStorage.getItem('dribit.reload'), seen = sessionStorage.getItem('dribit.opened');
      sessionStorage.removeItem('dribit.reload');
      sessionStorage.setItem('dribit.opened', here);
      return upd === '1' ? 'update' : seen === here ? 'reload' : null;
    } catch (e) { return null; }
  })();
  var OPEN = RELOAD_KIND ? { source: RELOAD_KIND, ref: null, kind: null } : openParams(), OPEN_SOURCE = OPEN.source, OPEN_REF = OPEN.ref, OPEN_KIND = OPEN.kind;
  function reloadForUpdate() {
    try {
      sessionStorage.setItem('dribit.reload', '1');
      if (openAsked) sessionStorage.setItem('dribit.asked', '1'); // the popup of this open already showed
    } catch (e) { /* ignore */ }
    location.reload();
  }

  // ---------- Browser history ----------
  // Home is the root entry. Any other view, and any open sheet, is one entry above it, so the phone's
  // back button (or the browser's) returns to home or closes the sheet, and forward re-enters the view.
  var HIST = (function () { try { return !!(window.history && history.pushState); } catch (e) { return false; } })();
  var histDepth = 0, topIsSheet = false, ignorePops = 0;
  function histPush(state) {
    if (!HIST) return;
    state.depth = histDepth + 1;
    try { history.pushState(state, ''); histDepth++; } catch (e) { /* ignore */ }
  }
  function histReplace(state) {
    if (!HIST) return;
    state.depth = histDepth;
    try { history.replaceState(state, ''); } catch (e) { /* ignore */ }
  }
  function histBack(n) {
    if (!HIST || n <= 0) return;
    histDepth -= n;
    ignorePops++;
    try { history.go(-n); } catch (e) { ignorePops--; }
  }
  function histEnter(state) {
    // a view sits one entry above home (a second view replaces the first, and a view opened from a sheet
    // takes the sheet's entry); a sheet always gets an entry of its own, so back closes just the sheet
    if (state.sheet || histDepth === 0) histPush(state); else histReplace(state);
    topIsSheet = !!state.sheet;
  }
  function leaveSession(reason) {
    if (!session) return;
    if (session.mode === 'lesson') {
      snapshot();
      track('lesson_exited', { lesson_id: session.lesson.id, step_index: session.idx, step_count: stepCount(), step_kind: step().kind === 'screen' ? 'screen' : 'question', reason: reason });
    } else track(session.mode + '_exited', { step_index: session.idx, step_count: stepCount(), reason: reason });
    clockStop();
    session = null;
  }
  function onPop(e) {
    if (ignorePops > 0) {
      ignorePops--;
      // a sheet closed on home: a new version that waited for it loads now (the history step is done)
      if (!ignorePops && pendingReload && !pushBusy && view === 'home' && !sheetOpen) reloadForUpdate();
      return;
    }
    var st = (e && e.state) || {};
    histDepth = st.depth || 0;
    topIsSheet = false; // a sheet entry reached by forward shows its view without the sheet
    if (sheetOpen) closeSheet(true);
    if (!S.onboarded || !S.status) { onboardStep = st.onboard || 0; render(); window.scrollTo(0, 0); return; }
    var v = st.view || 'home';
    if (v === 'notes' && !(notesId && BY_ID[notesId])) v = 'home';
    if ((v === 'lesson' || v === 'done') && !session) v = 'home';
    if (v === view) return; // only a sheet was closed
    if (view === 'lesson' && session) leaveSession('back');
    if (view === 'done') session = null;
    view = v;
    if (pendingReload && !pushBusy && v !== 'lesson' && v !== 'done') { reloadForUpdate(); return; }
    render();
    if (v !== 'home') window.scrollTo(0, 0); else maybeAsk();
  }

  function setView(v) {
    view = v;
    closeSheet(true);
    if (v === 'home') { topIsSheet = false; histBack(histDepth); } else histEnter({ view: v });
    if (pendingReload && !pushBusy && v !== 'lesson' && v !== 'done') { reloadForUpdate(); return; }
    render();
    if (v !== 'home') window.scrollTo(0, 0); else maybeAsk();
  }

  function render() {
    if (!S.onboarded || !S.status) { root.innerHTML = renderWelcome(); return; }
    if (view === 'lesson' && session) { root.innerHTML = renderPlayer(); afterPlayerRender(); return; }
    if (view === 'done' && session) { root.innerHTML = renderDone(); return; }
    if (view === 'notes' && notesId && BY_ID[notesId]) { root.innerHTML = renderNotes(BY_ID[notesId]); return; }
    var body = view === 'practice' ? renderPractice() : view === 'missions' ? renderMissions()
      : view === 'profile' ? renderProfile() : renderPath();
    root.innerHTML = renderTopbar() + '<main class="screen gutter">' + body + '</main>' + renderLegalBar() + renderNav();
    if (view === 'home') revealCurrent();
    if (view === 'home' && offToast && !sheetOpen) showOffToast();
  }
  function showOffToast() {
    var o = offToast;
    offToast = null;
    toast(ICON.dayoff + '<b>הרצף של ' + plural(o.streak, 'יום אחד', 'ימים') + ' נשמר</b><span>' +
      (o.used === 1 ? 'השתמשנו ביום חופש אחד לרצף.' : 'השתמשנו ב-' + o.used + ' ימי חופש לרצף.') +
      (o.left === 0 ? ' לא נשארו עוד.' : o.left === 1 ? ' נשאר עוד אחד.' : ' נשארו עוד ' + o.left + '.') + '</span>', 'info', 3600);
  }
  // the next lesson is what people came for: bring it into view, unless a resume, repair or reminder card leads
  // the page; then the page starts at that card (the previous screen may have been scrolled down)
  function revealCurrent() {
    var lead = root.querySelector('.resume-card, .repair-card, .reminder-card');
    if (lead) {
      var lr = lead.getBoundingClientRect();
      if (lr.top < 0 || lr.bottom > window.innerHeight) window.scrollTo(0, 0);
      return;
    }
    var cur = root.querySelector('.node-wrap.current');
    if (!cur) return;
    var r = cur.getBoundingClientRect();
    if (r.top < 96 || r.bottom > window.innerHeight * 0.72) {
      try { cur.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { cur.scrollIntoView(); }
    }
  }

  function goalRing(size) {
    var pct = Math.min(1, todayXp() / S.goalXp), c = 2 * Math.PI * 11;
    return '<svg class="goal-ring" viewBox="0 0 30 30" style="width:' + size + 'px;height:' + size + 'px" aria-hidden="true">' +
      '<circle class="track" cx="15" cy="15" r="11" fill="none" stroke-width="4"/>' +
      '<circle class="fill" cx="15" cy="15" r="11" fill="none" stroke-width="4" stroke-linecap="round" ' +
      'stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - pct)).toFixed(1) + '" transform="rotate(-90 15 15)"/></svg>';
  }

  function renderTopbar() {
    var st = currentStreak(), k = DO.enabled ? S.daysOff : 0;
    return '<header class="topbar gutter">' +
      '<div class="brandmark">' + esc(CFG.appName) + '</div>' +
      '<div class="stats">' +
        '<button class="stat flame' + (st ? '' : ' off') + '" data-act="explain" data-what="streak" aria-label="' + (st ? 'רצף: ' + plural(st, 'יום אחד', 'ימים') : 'אין רצף') + (k ? '. ימי חופש לרצף: ' + k : '') + '">' +
          ICON.flame + st + (k ? '<i class="off-badge" aria-hidden="true">' + ICON.dayoff + k + '</i>' : '') + '</button>' +
        '<button class="stat xp" data-act="explain" data-what="points" aria-label="נקודות: ' + S.xp + '. בשביל מה הן?">' + ICON.coin + fmt(S.xp) + '</button>' +
        '<button class="stat goal" data-act="explain" data-what="goal" aria-label="יעד יומי: ' + todayXp() + ' מתוך ' + S.goalXp + '">' + goalRing(28) + '</button>' +
      '</div></header>';
  }

  function renderLegalBar() {
    return '<button class="legal-bar" data-act="legal">' + ICON.info + '<span>' + esc(CFG.disclaimer) + '</span></button>';
  }

  function renderNav() {
    var pending = openMissions().length;
    function b(id, icon, label, badge) {
      return '<button data-act="nav" data-to="' + id + '"' + (view === id ? ' aria-current="page"' : '') + '>' +
        '<span class="ic">' + icon + (badge ? '<i class="badge">' + badge + '</i>' : '') + '</span>' + label + '</button>';
    }
    return '<nav class="nav"><div class="nav-inner">' +
      b('home', ICON.path, 'מסלול') + b('practice', ICON.dumbbell, 'תרגול') +
      b('missions', ICON.target, 'משימות', pending) + b('profile', ICON.user, 'פרופיל') +
      '</div></nav>';
  }

  function unitImg(u) { return CFG.images && CFG.images.units && CFG.images.units[u.id]; }

  function canInstall() { return !isStandalone() && !IN_FRAME; }
  var INSTALL = CFG.install || { afterLessons: 1, showOnDone: true };
  // the install card: outside the installed app, after the first finished lesson, until "not now"
  function installCard(placement) {
    if (!canInstall() || S.installHidden || doneCount() < INSTALL.afterLessons) return '';
    var text = placement === 'done'
      ? 'סיימת שיעור ראשון. עכשיו הזמן: אייקון במסך הבית, מסך מלא, ועובד גם בלי אינטרנט.'
      : 'אייקון במסך הבית, נפתח במסך מלא ועובד גם בלי אינטרנט.';
    if (IS_IOS) text += ' באייפון, מה שעשית בספארי לא עובר לבד לאפליקציה. בהוראות יש קוד העברה.';
    return '<div class="card install-card"><div class="rc-head"><span class="rc-ic">' + ICON.phone + '</span><div>' +
      '<b>להתקין את ' + esc(CFG.appName) + ' בטלפון</b><span>' + text + '</span></div></div>' +
      '<div class="row"><button class="btn" data-act="install" data-placement="' + placement + '">להתקנה</button>' +
      '<button class="btn text" data-act="install-hide" data-placement="' + placement + '">לא עכשיו</button></div></div>';
  }

  function homeCards() {
    var html = '';
    var ip = S.inProgress, l = ip && BY_ID[ip.lessonId];
    if (l && shown(l)) {
      var pct = Math.round(ip.idx / Math.max(1, ip.steps.length) * 100);
      html += '<button class="resume-card u' + l.unit.id + '" data-act="start" data-id="' + esc(l.id) + '">' +
        '<span class="r-ic">' + ICON.play + '</span>' +
        '<span class="r-txt"><span class="eyebrow">להמשיך מאיפה שהפסקת</span><b>' + esc(l.title) + '</b>' +
        '<span class="bar"><i style="width:' + pct + '%"></i></span></span></button>';
    }
    var rep = repairInfo();
    if (rep) {
      html += '<div class="card repair-card"><div class="rc-head"><span class="rc-ic">' + ICON.rescue + '</span><div>' +
        '<b>הרצף של ' + fmt(rep.value) + ' ימים נשבר</b>' +
        '<span>אפשר להציל אותו ' + (rep.daysLeft > 0 ? 'עוד ' + plural(rep.daysLeft + 1, 'יום אחד', 'ימים') : 'רק היום') + ': ' + CFG.streakRepair.questions + ' שאלות, ' + CFG.streakRepair.toPass + ' נכונות לפחות.</span></div></div>' +
        '<button class="btn gold" data-act="repair">להציל את הרצף</button></div>';
    }
    // one ask at a time: resume, then the streak rescue, then the reminder, then the install card
    if (!html) {
      var rs = reminderCardState();
      if (rs) {
        html += '<div class="card reminder-card"><div class="rc-head"><span class="rc-ic">' + ICON.bell + '</span><div>' +
          '<b>תזכורת יומית בערב</b><span>' + (rs === 'install'
            ? 'באייפון תזכורות עובדות רק מהאפליקציה המותקנת במסך הבית.'
            : 'הודעה קצרה רק בימים שעוד לא עשית שיעור. אפשר לכבות בפרופיל.') + '</span></div></div>' +
          '<div class="row"><button class="btn" data-act="' + (rs === 'install' ? 'install' : 'reminder-on') + '" data-from="home" data-placement="home">' +
            (rs === 'install' ? 'איך מתקינים' : 'להפעיל') + '</button><button class="btn text" data-act="reminder-later">לא עכשיו</button></div></div>';
      } else html += installCard('home');
    }
    return html;
  }
  // the invite and feedback bars live on the profile, not on home (Jonathan, 18.10)
  function inviteBar(from) {
    if (!INVITE.enabled || doneCount() < INVITE.afterLessons) return '';
    var o = inviteOffState(), tail = S.status === 'civ' ? 'לשלוח לחברים בוואטסאפ' : 'לשלוח לחבר׳ה מהיחידה';
    return '<button class="invite-bar" data-act="invite" data-from="' + from + '">' + ICON.share + '<span>' + (!o.on
      ? '<b>ללמוד ביחד מחזיק יותר.</b> ' + tail
      : (DO.friendGift ? '<b>חבר חדש מהקישור מקבל ' + daysOffText(DO.friendGift).replace(' אחד', '') + '.</b> ' : '<b>ללמוד ביחד מחזיק יותר.</b> ') +
        (o.ready ? 'ויום אחד גם לך, על השיתוף' : o.full ? tail : 'יום החופש הבא שלך על שיתוף: ' + (o.wait === 1 ? 'מחר' : 'בעוד ' + o.wait + ' ימים'))) +
      '</span>' + ICON.chevron + '</button>';
  }
  function pilotBar(ctx) {
    return CFG.pilot ? '<button class="pilot-bar" data-act="feedback" data-ctx="' + ctx + '">' + ICON.chat + '<span><b>גרסת ניסיון.</b> ספרו לנו מה לשפר</span>' + ICON.chevron + '</button>' : '';
  }

  function renderPath() {
    var cur = currentLesson();
    var r = levelInfo(S.xp);
    var html = homeCards();
    html += '<button class="rank-strip" data-act="explain" data-what="points">' +
      '<span class="rank-badge">' + ICON.coins + '</span>' +
      '<span class="rank-txt"><b>' + esc(levelLabel(r)) + '</b><span>' + nextLevelLine(r) + '</span></span>' +
      '<span class="bar gold"><i style="width:' + Math.round(r.pct * 100) + '%"></i></span></button>';
    var st = currentStreak(), today = todayXp();
    if (cur && st > 0 && today === 0) {
      html += '<p class="nudge warn">' + ICON.flame + '<span>הרצף של ' + plural(st, 'יום אחד', 'ימים') + ' מחכה לשיעור של היום.</span></p>';
    } else if (cur && today > 0 && today < S.goalXp) {
      html += '<p class="nudge">' + ICON.target + '<span>עוד ' + fmt(S.goalXp - today) + ' נקודות ליעד היומי.</span></p>';
    }
    UNITS.forEach(function (u) {
      var done = u.vis.filter(function (l) { return isDone(l.id); }).length;
      var img = unitImg(u);
      html += '<section class="unit u' + u.id + '">' +
        '<button class="unit-banner" data-act="unit" data-id="' + u.id + '"><span class="txt"><span class="eyebrow">יחידה ' + u.n + '</span>' +
        '<h2>' + esc(u.title) + '</h2><span class="meta">' + done + ' מתוך ' + u.vis.length + ' שיעורים</span>' +
        '<span class="ubar"><i style="width:' + Math.round(done / u.vis.length * 100) + '%"></i></span></span>' +
        '<span class="art' + (img ? ' pic' : '') + '">' + (img ? '<img src="' + esc(img) + '" alt="">' : u.n) + '</span></button>' +
        '<div class="path">';
      u.vis.forEach(function (l, i) {
        var state = isDone(l.id) ? 'done' : (cur && cur.id === l.id ? 'current' : 'locked');
        var dx = Math.round(Math.sin(i * 1.1) * 70);
        var icon = state === 'done' ? ICON.check : state === 'current' ? ICON.star : ICON.lock;
        var tip = S.inProgress && S.inProgress.lessonId === l.id ? 'להמשיך' : doneCount() ? 'המשך כאן' : 'מתחילים';
        html += '<div class="node-wrap ' + state + '" style="--dx:' + dx + 'px">' +
          (state === 'current' ? '<div class="start-tip">' + tip + '</div>' : '') +
          '<button class="node ' + state + '" data-act="preview" data-id="' + esc(l.id) + '" aria-label="' + esc(l.title) + '">' + icon + '</button>' +
          '<div class="node-label">' + esc(l.title) + '</div></div>';
      });
      var unitDone = done === u.vis.length;
      html += '<div class="unit-end' + (unitDone ? ' won' : '') + '">' + ICON.trophy + '<span>' + (unitDone ? 'סיימת את היחידה' : 'סוף יחידה ' + u.n) + '</span></div>';
      html += '</div></section>';
    });
    html += '<p class="course-end">' + (cur ? 'עוד ' + (LESSONS.length - doneCount()) + ' שיעורים עד סוף הקורס' : 'סיימת את כל הקורס. כל הכבוד!') + '</p>';
    if (CFG.about) html += '<p class="fine center about-link"><button class="legal-line" data-act="about" data-from="home_bottom">' + ICON.user + esc(CFG.about.link) + '</button></p>';
    return html;
  }

  // ---------- Sheets ----------
  function openSheet(inner, cls) {
    closeSheet(true);
    var wrap = document.createElement('div');
    wrap.id = 'sheet';
    wrap.innerHTML = '<div class="scrim" data-act="close-sheet"></div><div class="sheet gutter' + (cls ? ' ' + cls : '') + '" role="dialog" aria-modal="true">' + inner + '</div>';
    document.body.appendChild(wrap);
    sheetOpen = true;
    if (topIsSheet) histReplace({ view: view, sheet: true }); else histEnter({ view: view, sheet: true });
    var btn = wrap.querySelector('.btn');
    if (btn) { try { btn.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }
  // keepEntry: the caller is about to reuse the sheet's history entry (a view change or another sheet)
  function closeSheet(keepEntry) {
    var s = document.getElementById('sheet');
    if (s) s.remove();
    var was = sheetOpen;
    sheetOpen = false;
    if (was && !keepEntry && topIsSheet) { topIsSheet = false; histBack(1); }
  }

  function pointsList(l) {
    return '<ul class="rules compact">' +
      '<li><span>כל תשובה נכונה</span><b>' + plus(P.correct) + '</b></li>' +
      '<li><span>סיום השיעור</span><b>' + plus(P.lessonDone) + '</b></li>' +
      '<li><span>שיעור בלי אף טעות</span><b>' + plus(P.perfect) + '</b></li>' +
      '<li><span>' + ICON.bolt + 'מסיימים תוך ' + lessonMinutes(l) + ' דקות, עם 80% נכונות</span><b>' + plus(P.speed) + '</b></li></ul>';
  }

  function previewSheet(id) {
    var l = BY_ID[id];
    if (!shown(l)) return;
    if (!isUnlocked(l)) {
      var cur = currentLesson();
      openSheet('<div class="eyebrow">יחידה ' + l.unit.n + ' · ' + esc(l.unit.title) + '</div>' +
        '<h3>' + esc(l.title) + '</h3>' +
        '<p class="lead">' + esc(l.what) + '</p>' +
        '<p class="lock-note">' + ICON.lock + '<span>נפתח אחרי "' + esc(cur ? cur.title : '') + '".</span></p>' +
        '<button class="btn ghost" data-act="close-sheet">הבנתי</button>');
      return;
    }
    var replay = isDone(l.id), rec = S.lessons[l.id];
    var ip = S.inProgress && S.inProgress.lessonId === l.id ? S.inProgress : null;
    var main = ip
      ? '<button class="btn" data-act="start" data-id="' + esc(l.id) + '">להמשיך (מסך ' + (ip.idx + 1) + ' מתוך ' + ip.steps.length + ')</button>' +
        '<button class="btn ghost" data-act="restart" data-id="' + esc(l.id) + '">להתחיל מההתחלה</button>'
      : '<button class="btn' + (replay ? ' gold' : '') + '" data-act="start" data-id="' + esc(l.id) + '">' + (replay ? 'לעשות שוב' : 'התחל שיעור') + '</button>';
    openSheet('<div class="eyebrow">יחידה ' + l.unit.n + ' · שיעור ' + l.n + '</div>' +
      '<h3>' + esc(l.title) + '</h3>' +
      '<p class="lead">' + esc(l.what) + '</p>' +
      '<div class="chips"><span class="chip">' + ICON.clock + 'כ-' + lessonMinutes(l) + ' דקות</span>' +
      '<span class="chip">' + l.vScreens.length + ' הסברים · ' + l.vQuestions.length + ' שאלות</span>' +
      (rec && rec.done ? '<span class="chip ok">' + ICON.check + 'השיא שלך: ' + (Number(rec.best) || 0) + '% נכונות</span>' : '') + '</div>' +
      '<div class="pts-box"><div class="pts-head">' + ICON.coin + '<b>נקודות בשיעור הזה</b><span>עד ' + maxLessonPoints(l) + '</span></div>' + pointsList(l) + '</div>' +
      main +
      (replay ? '<button class="btn text" data-act="notes" data-id="' + esc(l.id) + '">לקרוא שוב את ההסברים</button>' : ''), 'tall');
  }

  function unitSheet(uid) {
    var u = UNITS.filter(function (x) { return String(x.id) === String(uid); })[0];
    if (!u) return;
    var rows = u.vis.map(function (l) {
      var st = isDone(l.id) ? 'done' : isUnlocked(l) ? 'current' : 'locked';
      return '<li><button class="lesson-row ' + st + '" data-act="preview" data-id="' + esc(l.id) + '">' +
        '<span class="dot">' + (st === 'done' ? ICON.check : st === 'current' ? ICON.star : ICON.lock) + '</span>' +
        '<span class="t"><b>' + esc(l.title) + '</b><span>' + esc(l.what) + '</span></span>' + ICON.chevron + '</button></li>';
    }).join('');
    openSheet('<div class="eyebrow">יחידה ' + u.n + '</div><h3>' + esc(u.title) + '</h3><ul class="lesson-list">' + rows + '</ul>' + compareCard(u), 'tall');
  }

  function explainSheet(what) {
    var r = levelInfo(S.xp);
    if (what === 'points') {
      var rules = '<ul class="rules">' +
          '<li><span>תשובה נכונה בניסיון הראשון</span><b>' + plus(P.correct) + '</b></li>' +
          '<li><span>שאלת חזרה או תרגול</span><b>' + plus(P.review) + '</b></li>' +
          '<li><span>סיום שיעור</span><b>' + plus(P.lessonDone) + '</b></li>' +
          '<li><span>שיעור בלי אף טעות</span><b>' + plus(P.perfect) + '</b></li>' +
          '<li><span>מסיימים בזמן שכתוב בתחילת השיעור</span><b>' + plus(P.speed) + '</b></li>' +
          '<li><span>משימה מחוץ לאפליקציה</span><b>' + plus(P.mission) + '</b></li>' +
        '</ul>';
      openSheet('<h3>בשביל מה הנקודות?</h3>' +
        (DO.enabled
          ? '<p class="chain">נקודות ← שלב חדש ← יום חופש לרצף</p>' +
            '<p class="lead">כל שלב חדש נותן יום חופש לרצף. ' + (S.status === 'civ' ? 'מבחן, משמרת, טיול?' : 'שמירה, שטח, בסיס סגור?') +
              ' ביום בלי שיעור, יום חופש נכנס לבד והרצף לא נשבר' + minStreakNote() + '.</p>'
          : '<p class="lead">הנקודות מעלות אותך שלב וממלאות את היעד היומי.</p>') +
        '<div class="card tight points-now"><b>' + (r.last ? 'שלב ' + r.total + ' מתוך ' + r.total + ', השלב האחרון' : esc(levelLabel(r)) + ' · עוד ' + fmt(r.toNext) + ' נקודות לשלב הבא') + '</b>' +
          '<span class="bar gold"><i style="width:' + Math.round(r.pct * 100) + '%"></i></span>' +
          (DO.enabled ? '<p class="fine off-line">' + ICON.dayoff + '<span>ימי חופש לרצף: ' + S.daysOff + ' (אפשר לשמור עד ' + DO.maxHeld + ')</span></p>' : '') + '</div>' +
        '<div class="eyebrow">איך מקבלים נקודות</div>' + rules +
        (DO.enabled && DO.invite ? '<p class="fine">עוד יום חופש לרצף: משתפים קישור לחבר, פעם ' + (DO.inviteEveryDays === 7 ? 'בשבוע' : 'ב-' + DO.inviteEveryDays + ' ימים') + '.' +
          (DO.friendGift ? ' חבר חדש מקבל ' + DO.friendGift + ' ימי חופש.' : '') + '</p>' : '') +
        '<p class="fine">הנקודות ממלאות גם את היעד היומי (העיגול למעלה).</p>' +
        '<button class="btn" data-act="close-sheet">הבנתי</button>', 'tall');
    } else if (what === 'streak') {
      var st = currentStreak(), R = CFG.streakRepair;
      var repairLine = 'רצף של ' + R.minStreak + ' ימים ומעלה שנשבר אפשר להציל עד ' + R.withinDays + ' ימים אחרי, במבחן של ' + R.questions + ' שאלות (' + R.toPass + ' נכונות לפחות).';
      openSheet('<h3>' + (st ? 'רצף של ' + plural(st, 'יום אחד', 'ימים') : 'אין רצף כרגע') + '</h3>' +
        '<p class="lead">כל יום שבו עושים לפחות שיעור אחד או תרגול מוסיף יום לרצף. יום בלי למידה שובר אותו' + (DO.enabled ? ', אלא אם יש לך יום חופש לרצף.' : '.') + '</p>' +
        (DO.enabled
          ? (S.daysOff > 0
            ? '<p class="lead off-line">' + ICON.dayoff + '<span>ימי חופש לרצף: ' + S.daysOff + ' מתוך ' + DO.maxHeld + '. ביום בלי שיעור אחד מהם נכנס לבד, מרצף של ' + DO.minStreak +
                ' ימים ומעלה. הוא שומר על הרצף ולא מוסיף לו. כמו קרן חירום, רק לרצף.</span></p>'
            : '<p class="lead">אין לך כרגע ימי חופש לרצף. מקבלים יום בכל שלב חדש' + (DO.invite ? ', ועוד יום כשמשתפים קישור לחבר (פעם בשבוע)' : '') + '.</p>')
          : '') +
        '<p class="lead">' + (DO.enabled ? 'הפסקה ארוכה ממה שיש לך? הרצף נשבר והימים נשארים אצלך. ' : '') + repairLine + '</p>' +
        '<p class="lead">השיא שלך: ' + plural(S.bestStreak, 'יום אחד', 'ימים') + '.</p>' +
        '<button class="btn" data-act="close-sheet">הבנתי</button>');
    } else if (what === 'goal') {
      var left = Math.max(0, S.goalXp - todayXp());
      var goals = CFG.goals.map(function (g) {
        return '<button data-act="goal" data-xp="' + g.xp + '" aria-pressed="' + (S.goalXp === g.xp) + '">' + g.label + '<small>' + g.xp + ' נק׳ · ' + g.note + '</small></button>';
      }).join('');
      openSheet('<h3>היעד היומי</h3>' +
        '<div class="goal-big">' + goalRing(64) + '<div><b>' + ltr(fmt(todayXp()) + ' / ' + fmt(S.goalXp)) + '</b><span>' + (left ? 'עוד ' + fmt(left) + ' נקודות היום' : 'עמדת ביעד היום') + '</span></div></div>' +
        '<div class="seg">' + goals + '</div>' +
        '<button class="btn" data-act="close-sheet">סגירה</button>');
    }
  }

  // ---------- Partners (config.partner) ----------
  // a partner is "live" only with the master switch on, a signed contract, approved wording, a name and an https link
  var partnerWarned = {};
  function partnerLive(p) { return !!(p && p.enabled && p.contractSigned && p.textApproved && p.name && /^https:\/\//.test(p.url || '')); }
  function livePartners(optionId) {
    var P = CFG.partner;
    if (!P || !P.enabled) return [];
    return (P.partners || []).filter(function (p) {
      if (!p || !p.enabled) return false;
      if (!partnerLive(p)) {
        if (!partnerWarned[p.id]) { partnerWarned[p.id] = true; console.warn('dribit: partner "' + p.id + '" is enabled but not live (needs contractSigned, textApproved, name and an https url)'); }
        return false;
      }
      return !optionId || p.optionId === optionId;
    });
  }
  function partnerById(id) { return ((CFG.partner && CFG.partner.partners) || []).filter(function (p) { return p && p.id === id; })[0] || null; }
  function partnerDisclosures() {
    var out = [];
    livePartners().forEach(function (p) { var d = p.disclosure || CFG.partner.disclosure; if (d && out.indexOf(d) < 0) out.push(d); });
    return out;
  }
  // the neutral three-options comparison on the unit page (never on the done screen, in lessons or in the home cards)
  var partnerCardSeen = false;
  function compareCard(u) {
    var P = CFG.partner;
    if (!P || !(P.showComparison || P.enabled) || String(u.id) !== String(P.unitId) || !(P.options || []).length) return '';
    var all = livePartners();
    var items = P.options.map(function (o) {
      var ps = all.filter(function (p) { return p.optionId === o.id; }), l = BY_ID[o.lessonId];
      return '<li class="cmp-opt"><b>' + esc(o.title) + '</b><p>' + esc(o.text) + '</p>' +
        (ps.length ? '<p class="cmp-partners">אפשר לפתוח אצל: ' + ps.map(function (p) {
          return '<a class="link" href="' + esc(p.url) + '" target="_blank" rel="noopener sponsored" data-act="partner-link" data-id="' + esc(p.id) + '" data-option="' + esc(o.id) + '">' + esc(p.name) + '</a>';
        }).join(', ') + '</p><p class="fine">זה לא דירוג. כדאי להשוות תעריפונים לפני שבוחרים.</p>' : '') +
        '<span class="chip ' + (ps.length ? 'gold' : 'plain') + '">' + esc(ps.length ? P.paidLine : P.unpaidLine) + '</span>' +
        (shown(l) ? '<button class="link" data-act="preview" data-id="' + esc(l.id) + '">לשיעור "' + esc(l.title) + '"</button>' : '') + '</li>';
    }).join('');
    if (!partnerCardSeen) { partnerCardSeen = true; track('partner_card_viewed', { unit_id: u.id, partners: all.length, comparison_only: !all.length }); }
    var disc = partnerDisclosures();
    return '<section class="compare"><div class="eyebrow">השוואה · לא המלצה</div><b>' + esc(P.title) + '</b><p class="lead">' + esc(P.intro) + '</p>' +
      '<ul class="cmp-list">' + items + '</ul>' +
      (disc.length ? '<p class="fine">' + disc.map(esc).join(' ') + '</p>' : '') +
      '<p class="fine">קודם קרן חירום, ורק אז כסף שלא יידרש בשנים הקרובות.</p></section>';
  }

  function legalSheet() {
    openSheet('<h3>חשוב לדעת</h3>' +
      '<p class="lead">' + esc(CFG.appName) + ' מלמדת חינוך פיננסי כללי. זה לא ייעוץ השקעות ולא המלצה לפעולה מסוימת. לפני החלטה על הכסף שלך כדאי לבדוק מול גורם מוסמך.</p>' +
      '<p class="lead">' + esc(CFG.examplesNote) + ' סכומים רשמיים, כמו הפיקדון והמענק, מופיעים עם התאריך שבו נבדקו.</p>' +
      partnerDisclosures().map(function (d) { return '<p class="lead">' + esc(d) + '</p>'; }).join('') +
      (CFG.about ? '<button class="link" data-act="about" data-from="legal">מי עומד מאחורי האפליקציה?</button>' : '') +
      '<p class="fine">כדי לשפר את האפליקציה נשלחים נתוני שימוש בלי שם, טלפון או מייל. אפשר לכבות את זה בפרופיל.</p>' +
      '<button class="btn" data-act="close-sheet">הבנתי</button>');
  }

  // "who we are and how we earn" (config.about): from the bottom of the path, the profile and "important to know"
  function fillIn(tpl, vars) { return esc(tpl || '').replace(/\{(\w+)\}/g, function (m, k) { return k in vars ? esc(vars[k]) : m; }); }
  function aboutSheet(from) {
    var a = CFG.about;
    if (!a) return;
    var rv = a.reviewer || {}, live = livePartners(), name = esc(CFG.appName);
    from = from || 'home_bottom';
    track('about_opened', { from: from, lessons_done: doneCount(), reviewer_named: !!rv.name, partner_enabled: !!(CFG.partner && CFG.partner.enabled), $set: { about_seen: true } });
    var paras = function (list) { return (list || []).map(function (t) { return '<p class="lead">' + esc(t) + '</p>'; }).join(''); };
    var reviewed = rv.name ? fillIn(a.reviewedBy, { name: rv.name, role: rv.role || '' }) : esc(a.notReviewed);
    var names = live.map(function (p) { return p.name; });
    var earn = !live.length ? esc(a.earnNow)
      : live.length === 1 ? fillIn(a.earnPartner, { partner: names[0] })
      : fillIn(a.earnPartners || a.earnPartner, { partners: names.join(', '), partner: names.join(', ') });
    var wa = waNumber();
    openSheet('<h3>' + esc(a.title) + '</h3>' +
      '<div class="eyebrow">מי עומד מאחורי ' + name + '</div>' + paras(a.who) +
      '<div class="eyebrow">מי בדק את התוכן</div><p class="lead">' + reviewed + '</p>' +
      '<div class="eyebrow">איך ' + name + ' מרוויחה</div><p class="lead">' + earn + '</p>' + paras(a.earnLater) +
      '<p class="fine">' + esc(a.privacy) + ' גרסה ' + esc(CFG.version) + '.</p>' +
      '<button class="btn ghost" data-act="feedback" data-ctx="about">לכתוב לנו</button>' +
      (wa ? '<p class="fine center"><a class="link" href="https://wa.me/' + esc(wa) + '?text=' + encodeURIComponent('היי, לגבי ' + CFG.appName + ' ' + CFG.version + ':') + '" target="_blank" rel="noopener">או בוואטסאפ' + (contactName() ? ', ל' + esc(contactName()) : '') + '</a></p>' : '') +
      '<button class="btn" data-act="close-sheet">הבנתי</button>', 'tall');
  }

  function hasProgress() { return S.xp > 0 || !!S.inProgress || doneCount() > 0; }
  function installBody() {
    var name = esc(CFG.appName);
    var steps = IS_IOS
      ? ['פותחים את הקישור בספארי, לא בתוך וואטסאפ, אינסטגרם או טיקטוק. אם הקישור נפתח בתוך וואטסאפ, לוחצים על סמל ספארי בפינה למטה.',
         'לוחצים על כפתור השיתוף ' + ICON.share + ' בתחתית המסך.',
         'גוללים ובוחרים "הוספה למסך הבית" ' + ICON.addHome + '.',
         'לוחצים "הוספה". האייקון של ' + name + ' יופיע במסך הבית.',
         'פותחים את ' + name + ' רק מהאייקון. אם יש קוד העברה, מדביקים אותו במסך הפתיחה ("יש לי קוד העברה").']
      : ['פותחים את הקישור בכרום.',
         'לוחצים על ' + ICON.dots + ' בפינה של המסך.',
         'בוחרים "התקנת אפליקציה" או "הוספה למסך הבית".',
         'מאשרים. האייקון של ' + name + ' יופיע במסך הבית.'];
    // iPhone: the installed app starts with its own empty storage, so progress made in Safari travels by code
    // a friend's gift waits for lesson 1 in this browser: installing before it would lose the gift
    var warn = IS_IOS ? '<p class="nudge warn">' + ICON.info + '<span>חשוב: באייפון האפליקציה המותקנת מתחילה מאפס. מה שעשית בספארי לא עובר לבד. ' +
      (S.giftPending && !hasProgress() ? 'יש לך מתנה מחבר, אז עושים קודם את השיעור הראשון כאן, ורק אז מתקינים עם קוד ההעברה.' : 'מתקינים קודם, ואז משחקים. כבר התחלת? מעתיקים את קוד ההעברה שלמטה ומדביקים אותו באפליקציה המותקנת.') + '</span></p>' : '';
    var code = IS_IOS && hasProgress()
      ? '<div class="transfer-box"><p><b>קוד העברה:</b> לוחצים "להעתיק קוד", ואחרי ההתקנה מדביקים אותו במסך הפתיחה של האפליקציה.</p>' +
        '<div class="row"><button class="btn ghost" data-act="export" data-method="copy" data-placement="sheet">להעתיק קוד</button>' +
        (navigator.share ? '<button class="btn ghost" data-act="export" data-method="share" data-placement="sheet">לשלוח לעצמי</button>' : '') + '</div></div>'
      : '';
    return warn +
      '<ol class="install-steps">' + steps.map(function (s, i) { return '<li><span class="num-badge">' + (i + 1) + '</span><span>' + s + '</span></li>'; }).join('') + '</ol>' + code +
      '<p class="fine">' + (IS_IOS ? 'אחרי ההתקנה פותחים את ' + name + ' רק מהאייקון. ההתקדמות נשמרת בטלפון, לא בענן.'
        : 'מתקינים מכרום, וההתקדמות מכרום נשארת. אחרי ההתקנה פותחים את ' + name + ' מהאייקון.') + '</p>';
  }
  function installSheet() {
    openSheet('<h3>התקנה ב' + (IS_IOS ? 'אייפון' : 'אנדרואיד') + '</h3>' + installBody() +
      '<button class="btn" data-act="close-sheet">הבנתי</button>', 'tall');
  }

  // ---------- Transfer code (progress moves to the installed app or another phone) ----------
  function b64url(str) { return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64url(str) { str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; return decodeURIComponent(escape(atob(str))); }
  function checksum(str) { var n = 0; for (var i = 0; i < str.length; i++) n = (n + str.charCodeAt(i)) % 65536; return ('000' + n.toString(16)).slice(-4); }
  function exportCode() {
    var sub = {};
    TRANSFER_KEYS.forEach(function (k) { if (k in S) sub[k] = S[k]; });
    var cut = dayKey(addDays(new Date(), -30)), days = {}, mistakes = {};
    Object.keys(S.days || {}).forEach(function (k) { if (k >= cut) days[k] = S.days[k]; });
    Object.keys(S.mistakes || {}).forEach(function (k) { if (S.mistakes[k] > 0) mistakes[k] = S.mistakes[k]; });
    sub.days = days; sub.mistakes = mistakes;
    var body = b64url(JSON.stringify(sub));
    return 'D1.' + body + '.' + checksum(body);
  }
  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  // a pasted code is untrusted input: prefix, checksum, JSON, then only known fields with sane values
  function parseCode(code) {
    code = String(code || '').trim();
    if (code.length > 60000) return { ok: false, reason: 'bad_fields' };
    var m = /^D1\.([A-Za-z0-9_-]+)\.([0-9a-f]{4})$/.exec(code);
    if (!m) return { ok: false, reason: 'bad_prefix' };
    if (checksum(m[1]) !== m[2]) return { ok: false, reason: 'bad_checksum' };
    var obj;
    try { obj = JSON.parse(unb64url(m[1])); } catch (e) { return { ok: false, reason: 'bad_json' }; }
    if (!isObj(obj) || obj.v !== 3) return { ok: false, reason: 'bad_fields' };
    if (!CFG.statuses.some(function (st) { return st.id === obj.status; })) return { ok: false, reason: 'bad_fields' };
    if (typeof obj.uid !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(obj.uid)) return { ok: false, reason: 'bad_fields' };
    var nums = ['goalXp', 'xp', 'streak', 'bestStreak', 'answered', 'correct'], i;
    for (i = 0; i < nums.length; i++) { var x = obj[nums[i]]; if (typeof x !== 'number' || !isFinite(x) || x < 0) return { ok: false, reason: 'bad_fields' }; }
    var maps = ['days', 'lessons', 'missions', 'mistakes', 'ratings', 'intent', 'amount'];
    for (i = 0; i < maps.length; i++) if (maps[i] in obj && !isObj(obj[maps[i]])) return { ok: false, reason: 'bad_fields' };
    var small = function (x, max) { return typeof x === 'number' && isFinite(x) && x >= 0 && x <= max; };
    var count = function (x) { return small(x, 1e7); };
    var bool = function (x) { return typeof x === 'boolean'; };
    var opt = function (x, f) { return x == null || f(x); };
    var each = function (k, valOk, keyOk) {
      return !(k in obj) || Object.keys(obj[k]).every(function (id) { return (keyOk || okKey)(id) && valOk(obj[k][id]); });
    };
    if (!each('days', count, isDayKey) || !each('mistakes', count) || !each('ratings', okWord) || !each('intent', okWord) || !each('amount', okWord) ||
      !each('lessons', function (r) { return isObj(r) && opt(r.done, bool) && opt(r.best, count) && opt(r.plays, count) && opt(r.fastest, function (x) { return typeof x === 'number' && isFinite(x) && x >= 0; }); }) ||
      !each('missions', function (m) { return isObj(m) && opt(m.done, bool) && opt(m.steps, function (a) { return Array.isArray(a) && a.length <= 20 && a.every(function (x) { return x == null || bool(x); }); }); }))
      return { ok: false, reason: 'bad_fields' };
    if (obj.lastDay != null && !isDayKey(obj.lastDay)) return { ok: false, reason: 'bad_fields' };
    if (obj.lostStreak != null && !(isObj(obj.lostStreak) && isDayKey(obj.lostStreak.lastDay) && count(obj.lostStreak.value))) return { ok: false, reason: 'bad_fields' };
    if (('firstDay' in obj && !isDayKey(obj.firstDay)) || ('contentV' in obj && !small(obj.contentV, 1000))) return { ok: false, reason: 'bad_fields' };
    if ('startUnit' in obj && obj.startUnit != null && !small(obj.startUnit, 1000) && !okKey(obj.startUnit)) return { ok: false, reason: 'bad_fields' };
    if (['sound', 'share'].some(function (k) { return k in obj && !bool(obj[k]); })) return { ok: false, reason: 'bad_fields' };
    var num = function (x) { return typeof x === 'number' && isFinite(x) && x >= 0; };
    if (obj.calc != null && !(isObj(obj.calc) && opt(obj.calc.type, okWord) && opt(obj.calc.months, num) && opt(obj.calc.training, num) && opt(obj.calc.at, num) &&
      opt(obj.calc.trainingEdited, bool) && opt(obj.calc.lone, bool))) return { ok: false, reason: 'bad_fields' };
    if (obj.ref != null && (typeof obj.ref !== 'string' || !/^[\w-]{1,40}$/.test(obj.ref))) obj.ref = null;
    if (('daysOff' in obj && !small(obj.daysOff, 30)) || ('offRetro' in obj && !small(obj.offRetro, 30)) ||
      ('offLevel' in obj && !small(obj.offLevel, CFG.levels.length - 1))) return { ok: false, reason: 'bad_fields' };
    if ('offUsed' in obj && !(Array.isArray(obj.offUsed) && obj.offUsed.length <= 30 && obj.offUsed.every(isDayKey))) return { ok: false, reason: 'bad_fields' };
    if ((obj.offSince != null && !isDayKey(obj.offSince)) || (obj.inviteOffDay != null && !isDayKey(obj.inviteOffDay))) return { ok: false, reason: 'bad_fields' };
    if (['giftPending', 'giftGot', 'offIntroSeen'].some(function (k) { return k in obj && typeof obj[k] !== 'boolean'; })) return { ok: false, reason: 'bad_fields' };
    var state = {};
    TRANSFER_KEYS.forEach(function (k) { if (k in obj) state[k] = obj[k]; });
    return { ok: true, reason: null, state: state };
  }
  function importProgress(code, source) {
    var r = parseCode(code);
    if (!r.ok) { track('progress_imported', { ok: false, reason: r.reason, source: source }); return r; }
    if (S.reminder && S.reminder.on) disableReminder('import');
    var seen = S.installSeen;
    S = migrate(r.state);
    offToast = null;
    S.onboarded = true; S.reminder = null; S.reminderNo = null; S.inProgress = null;
    S.installHidden = isStandalone(); S.installSeen = seen || isStandalone(); S.importedAt = dayKey();
    checkStreakBreak(); offToast = null;
    save(); indexContent(); migrateContent();
    track('progress_imported', { ok: true, reason: null, lessons_done: doneCount(), xp: S.xp, source: source, $set: { transferred: true } });
    pickedStatus = null; onboardStep = 0; session = null;
    setView('home');
    if (source === 'hash') { clearTimeout(askTimer); openAsked = true; } // a link with a code: the import toast is enough for this open
    toast(ICON.check + '<b>ההתקדמות עברה</b><span>' + plural(doneCount(), 'שיעור אחד', 'שיעורים') + ' ו-' + plural(S.xp, 'נקודה אחת', 'נקודות') + '</span>', 'info', 3200);
    return r;
  }
  // a link with a code (#p=) over existing progress: ask first, the code would replace everything here
  var pendingHash = null;
  function hashConfirm(code) {
    pendingHash = code;
    openSheet('<h3>להחליף את ההתקדמות?</h3><p class="lead">הקישור מביא התקדמות ממכשיר אחר. היא תחליף את מה שיש כאן: ' +
      plural(doneCount(), 'שיעור אחד', 'שיעורים') + ' ו-' + plural(S.xp, 'נקודה אחת', 'נקודות') + '.</p>' +
      '<div class="row"><button class="btn ghost" data-act="close-sheet">ביטול</button><button class="btn" data-act="hash-import">להחליף</button></div>');
  }
  function importSheet(source) {
    openSheet('<h3>ייבוא התקדמות</h3><p class="lead">מדביקים כאן את קוד ההעברה שהעתקת מהדפדפן או מהטלפון הקודם.</p>' +
      '<textarea id="imp-code" class="code-box" rows="4" placeholder="D1...." dir="ltr" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>' +
      '<p class="fine bad" id="imp-err" hidden>הקוד לא תקין. מעתיקים אותו שוב, מההתחלה ועד הסוף.</p>' +
      '<button class="btn" data-act="import-go" data-source="' + esc(source) + '">לייבא</button>' +
      '<button class="btn text" data-act="close-sheet">ביטול</button>', 'tall');
    var ta = document.getElementById('imp-code');
    if (ta) { try { ta.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }

  var fbRating = 0, fbMessage = '', waWarned = false;
  // the WhatsApp number for feedback: international digits only (050-1234567 -> 972501234567); '' = show the text for copying
  function waNumber() {
    var n = String((CFG.feedback && CFG.feedback.whatsapp) || '').replace(/\D/g, '').replace(/^00/, '');
    if (!n) return '';
    if (n.charAt(0) === '0' || n.length < 8 || n.length > 15) {
      if (!waWarned) { waWarned = true; console.warn('feedback.whatsapp must be international digits without + or a leading 0, e.g. 972501234567'); }
      return '';
    }
    return n;
  }
  // without an analytics key, or when usage-data sharing is off, feedback goes out by WhatsApp instead of PostHog
  function feedbackViaWhatsApp() { return !(CFG.analytics && CFG.analytics.posthogKey) || !S.share; }
  function contactName() { return (CFG.feedback && CFG.feedback.contactName) || ''; }
  // copies text from a click handler; done(ok) says whether the clipboard took it
  function copyText(text, done) {
    var fallback = function () {
      var ok = false;
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px;';
        document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, text.length);
        ok = !!document.execCommand('copy');
        ta.remove();
      } catch (e) { ok = false; }
      done(ok);
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
      else fallback();
    } catch (e) { fallback(); }
  }
  // when copying fails, the text is shown in the open sheet so it can be selected by hand
  function manualCopy(text, note, isCode) {
    var sh = document.querySelector('#sheet .sheet');
    if (!sh) { openSheet('<h3>' + (isCode ? 'קוד העברה' : 'ההודעה') + '</h3><button class="btn" data-act="close-sheet">סגירה</button>'); sh = document.querySelector('#sheet .sheet'); }
    if (!sh || sh.querySelector('.copy-box')) return;
    var p = document.createElement('p'); p.className = 'fine'; p.textContent = note;
    var ta = document.createElement('textarea'); ta.className = 'copy-box' + (isCode ? ' code-box' : ''); ta.setAttribute('readonly', ''); ta.rows = 4; ta.value = text;
    if (isCode) ta.setAttribute('dir', 'ltr');
    var btn = sh.querySelector('.btn');
    sh.insertBefore(p, btn); sh.insertBefore(ta, btn);
    try { ta.focus(); ta.select(); } catch (e) { /* ignore */ }
  }
  function feedbackSheet(ctx, lessonId) {
    fbRating = 0;
    var faces = ['😣', '🙁', '😐', '🙂', '🤩'];
    var note = '';
    if (feedbackViaWhatsApp()) {
      note = waNumber()
        ? 'המשוב נשלח בוואטסאפ' + (contactName() ? ' ל' + esc(contactName()) : '') + '. ההודעה תיפתח מוכנה, ונשאר רק ללחוץ שליחה.'
        : 'המשוב לא נשלח אוטומטית מהגרסה הזו. אחרי "שליחה" תוכלו להעתיק אותו ולשלוח לנו.';
      note = '<p class="fine">' + note + '</p>';
    }
    openSheet('<h3>מה דעתך?</h3>' +
      '<p class="lead">כל מילה עוזרת: מה לא היה ברור, מה חסר, מה אהבת.</p>' +
      '<div class="faces" role="group" aria-label="דירוג מ-1 עד 5">' + faces.map(function (f, i) {
        return '<button class="face" data-act="fb-rate" data-v="' + (i + 1) + '" aria-pressed="false" aria-label="' + (i + 1) + ' מתוך 5">' + f + '</button>';
      }).join('') + '</div>' +
      '<textarea id="fb-text" rows="4" maxlength="1500" placeholder="למשל: השאלה על דמי ניהול לא הייתה ברורה"></textarea>' + note +
      '<button class="btn" data-act="feedback-send" data-ctx="' + esc(ctx || '') + '" data-id="' + esc(lessonId || '') + '">שליחה</button>' +
      '<button class="btn text" data-act="close-sheet">ביטול</button>', 'tall');
  }

  // g: what grantLevelDaysOff() added on this level-up (null when days off are off)
  function levelUpSheet(g) {
    var r = levelInfo(S.xp);
    sfx.level();
    confetti(true);
    track('level_up', { level: r.n, day_off_added: g ? g.added : 0, held: S.daysOff });
    var gain = '';
    if (g && g.added) {
      gain = g.added > 1 ? 'קיבלת ' + g.added + ' ימי חופש לרצף. יש לך עכשיו ' + g.held + '.'
        : 'קיבלת יום חופש לרצף. יש לך עכשיו ' + (g.held === 1 ? 'יום חופש אחד.' : g.held + ' ימי חופש לרצף.');
    } else if (g && g.atCap) gain = 'יש לך כבר ' + DO.maxHeld + ' ימי חופש לרצף, המקסימום, אז הפעם לא נוסף עוד אחד.';
    openSheet('<div class="level-up"><div class="lvl-coin">' + (g && g.added ? ICON.dayoff : ICON.coins) + '</div>' +
      '<div class="eyebrow">עלית שלב</div><h3>' + esc(levelLabel(r)) + '</h3>' +
      (gain ? '<p class="lead">' + gain + '</p>' : '') +
      '<p class="fine">' + (r.last ? 'זה השלב האחרון. כל הכבוד.' : 'לשלב הבא: עוד ' + fmt(r.toNext) + ' נקודות.') + '</p></div>' +
      '<button class="btn gold" data-act="close-sheet">יאללה, ממשיכים</button>');
  }

  // ---------- Lesson session ----------
  function buildQuestionStep(q, opts) {
    opts = opts || {};
    var st = { kind: 'q', q: q, review: !!opts.review, retry: !!opts.retry, checked: false, sel: null, input: '', right: null };
    var idx;
    if (q.type === 'multipleChoice') st.order = shuffle(q.options.map(function (_, i) { return i; }));
    else if (q.type === 'trueFalse') st.order = [0, 1];
    else if (q.type === 'match') {
      idx = q.pairs.map(function (_, i) { return i; });
      st.m = { a: shuffle(idx), b: shuffle(idx), selA: null, selB: null, matched: [], mistakes: 0, flash: null };
    } else if (q.type === 'order') {
      idx = q.items.map(function (_, i) { return i; });
      var pool = shuffle(idx);
      for (var t = 0; t < 5 && pool.join() === idx.join(); t++) pool = shuffle(idx);
      st.o = { pool: pool, picked: [] };
    }
    return st;
  }

  function newSession(mode, lesson, steps) {
    return { mode: mode, lesson: lesson, steps: steps, idx: 0, combo: 0, maxCombo: 0,
      firstTry: 0, firstTryRight: 0, reviewRight: 0, xp: 0, activeMs: 0, tick: null, trackedIdx: -1 };
  }
  function step() { return session.steps[session.idx]; }

  function startLesson(id, restart) {
    var l = BY_ID[id];
    if (!shown(l)) return;
    if (!restart && S.inProgress && S.inProgress.lessonId === id) {
      var s = restoreSession(S.inProgress);
      if (s) {
        session = s;
        track('lesson_resumed', { lesson_id: l.id, step_index: s.idx, step_count: s.steps.length });
        setView('lesson');
        return;
      }
    }
    var steps = l.vScreens.map(function (sc, i) { return { kind: 'screen', s: sc, n: i, of: l.vScreens.length }; });
    l.vQuestions.forEach(function (q) { steps.push(buildQuestionStep(q)); });
    // one review question from an earlier finished lesson, for spaced repetition
    var pool = [];
    LESSONS.forEach(function (x) {
      if (x.order < l.order && isDone(x.id)) x.vQuestions.forEach(function (q) { if (q.type !== 'match') pool.push(q); });
    });
    if (pool.length) {
      pool = shuffle(pool).sort(function (a, b) { return (S.mistakes[b.id] || 0) - (S.mistakes[a.id] || 0); });
      steps.push(buildQuestionStep(pool[0], { review: true }));
    }
    session = newSession('lesson', l, steps);
    track('lesson_started', { lesson_id: l.id, unit_id: l.unit.id, lesson_title: l.title, replay: isDone(l.id), restart: !!restart });
    setView('lesson');
  }

  function startPractice(onlyMistakes) {
    var pool = [];
    LESSONS.forEach(function (l) {
      if (isDone(l.id)) l.vQuestions.forEach(function (q) { if (!onlyMistakes || S.mistakes[q.id] > 0) pool.push(q); });
    });
    if (!pool.length) return;
    pool = shuffle(pool).sort(function (a, b) { return (S.mistakes[b.id] || 0) - (S.mistakes[a.id] || 0); });
    var steps = shuffle(pool.slice(0, CFG.practiceSize)).map(function (q) { return buildQuestionStep(q, { review: true }); });
    session = newSession('practice', null, steps);
    track('practice_started', { mistakes_only: !!onlyMistakes, questions: steps.length });
    setView('lesson');
  }

  function startRepair() {
    var R = CFG.streakRepair, pool = [];
    LESSONS.forEach(function (l) {
      if (isDone(l.id)) l.vQuestions.forEach(function (q) { if (q.type !== 'match') pool.push(q); });
    });
    if (!pool.length || !S.lostStreak) return;
    var n = Math.min(R.questions, pool.length);
    var steps = shuffle(pool).slice(0, n).map(function (q) { return buildQuestionStep(q, { review: true }); });
    session = newSession('repair', null, steps);
    session.need = Math.ceil(n * R.toPass / R.questions);
    track('repair_started', { lost_streak: S.lostStreak.value, questions: n });
    setView('lesson');
  }

  // time counts only while the lesson is on screen
  function clockStart() { if (session && !session.tick) session.tick = Date.now(); }
  function clockStop() { if (session && session.tick) { session.activeMs += Date.now() - session.tick; session.tick = null; } }
  function elapsed() { return session ? session.activeMs + (session.tick ? Date.now() - session.tick : 0) : 0; }

  // the open lesson is saved after every step, so the app reopens exactly there
  function snapshot() {
    if (!session || session.mode !== 'lesson') return;
    S.inProgress = {
      lessonId: session.lesson.id, idx: session.idx, combo: session.combo, maxCombo: session.maxCombo,
      firstTry: session.firstTry, firstTryRight: session.firstTryRight, reviewRight: session.reviewRight,
      xp: session.xp, activeMs: elapsed(), savedAt: Date.now(),
      steps: session.steps.map(function (st) {
        if (st.kind === 'screen') return { k: 's', n: st.n };
        return {
          k: 'q', id: st.q.id, review: st.review, retry: st.retry, checked: st.checked, sel: st.sel, right: st.right,
          order: st.order || null, o: st.o || null, gain: st.gain || 0, praise: st.praise || '',
          m: st.m ? { a: st.m.a, b: st.m.b, matched: st.m.matched, mistakes: st.m.mistakes, wrong: st.m.wrong || [] } : null
        };
      })
    };
    save();
  }
  function restoreSession(ip) {
    var l = BY_ID[ip.lessonId];
    if (!shown(l) || !ip.steps || Date.now() - ip.savedAt > RESUME_DAYS * 864e5) return null;
    if (ip.steps.filter(function (x) { return x.k === 's'; }).length !== l.vScreens.length) return null;
    var steps = [], ok = true;
    ip.steps.forEach(function (x) {
      if (x.k === 's') {
        var sc = l.vScreens[x.n];
        if (!sc) { ok = false; return; }
        steps.push({ kind: 'screen', s: sc, n: x.n, of: l.vScreens.length });
        return;
      }
      var q = QUESTIONS[x.id];
      if (!q) { ok = false; return; }
      var st = buildQuestionStep(q, { review: x.review, retry: x.retry });
      st.checked = x.checked; st.sel = x.sel; st.right = x.right; st.gain = x.gain; st.praise = x.praise;
      if (x.order) { if (!st.order || x.order.length !== st.order.length) { ok = false; return; } st.order = x.order; } // a question whose options changed starts over
      if (x.o) st.o = x.o;
      if (x.m && st.m) { st.m.a = x.m.a; st.m.b = x.m.b; st.m.matched = x.m.matched; st.m.mistakes = x.m.mistakes; st.m.wrong = x.m.wrong || []; }
      steps.push(st);
    });
    if (!ok || !steps.length) return null;
    var s = newSession('lesson', l, steps);
    s.idx = Math.min(ip.idx || 0, steps.length - 1);
    s.combo = ip.combo || 0; s.maxCombo = ip.maxCombo || 0;
    s.firstTry = ip.firstTry || 0; s.firstTryRight = ip.firstTryRight || 0; s.reviewRight = ip.reviewRight || 0;
    s.xp = ip.xp || 0; s.activeMs = ip.activeMs || 0;
    s.trackedIdx = s.idx; // step_viewed was sent when this screen was first shown
    return s;
  }

  function stepCount() { return session.steps.length; }
  function playerTop() {
    var pct = Math.round(session.idx / stepCount() * 100);
    return '<div class="player-top gutter">' +
      '<button class="icon-btn" data-act="quit" aria-label="יציאה">' + ICON.x + '</button>' +
      '<button class="icon-btn" data-act="back" aria-label="אחורה"' + (session.idx === 0 ? ' disabled' : '') + '>' + ICON.back + '</button>' +
      '<div class="progress' + (session.combo >= 3 ? ' hot' : '') + '" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pct + '%"></i></div>' +
      '<div class="combo">' + (session.combo >= 3 ? ICON.flame + session.combo : '') + '</div></div>';
  }

  function unitOfStep(st) {
    if (session.lesson) return session.lesson.unit.id;
    var l = st.q && BY_ID[st.q.lessonId];
    return l ? l.unit.id : 1;
  }

  function legalLine(withExamples) {
    return '<button class="legal-line" data-act="legal">' + ICON.info + esc(CFG.disclaimer) + (withExamples ? ' · ' + esc(CFG.examplesNote) : '') + '</button>';
  }

  function renderPlayer() {
    var st = step();
    var cls = 'player u' + unitOfStep(st);
    if (st.kind === 'screen') {
      var dots = '';
      for (var i = 0; i < st.of; i++) dots += '<i class="' + (i === st.n ? 'on' : '') + '"></i>';
      return '<div class="' + cls + '">' + playerTop() +
        '<div class="stage gutter">' +
          '<div class="kicker">' + esc(session.lesson.title) + ' · הסבר ' + (st.n + 1) + ' מתוך ' + st.of + '</div>' +
          '<article class="explain-card' + (st.s.type === 'calculator' ? ' calc-screen' : '') + '"><h2>' + esc(st.s.title) + '</h2><p>' + esc(st.s.body) + '</p>' +
            (st.s.type === 'calculator' ? calcWidget('lesson') : st.s.example ? '<div class="example"><span class="eyebrow">דוגמה</span><p>' + esc(st.s.example) + '</p></div>' : '') +
          '</article>' +
          '<div class="dots" aria-hidden="true">' + dots + '</div>' +
          legalLine(false) +
        '</div>' +
        '<div class="player-foot gutter"><button class="btn" data-act="next">' + (st.n + 1 === st.of ? 'לשאלות' : 'המשך') + '</button></div></div>';
    }
    return '<div class="' + cls + ' qt' + (session.idx % 4) + '">' + playerTop() +
      '<div class="stage gutter">' + questionHead(st) + questionBody(st) + legalLine(true) + '</div>' + questionFoot(st) + '</div>';
  }

  function afterPlayerRender() {
    snapshot();
    if (session.trackedIdx !== session.idx) {
      session.trackedIdx = session.idx;
      var st = step();
      track('step_viewed', {
        mode: session.mode, lesson_id: session.lesson ? session.lesson.id : null,
        step_index: session.idx, step_count: stepCount(), step_kind: st.kind === 'screen' ? 'screen' : 'question',
        question_id: st.q ? st.q.id : null
      });
      if (st.kind === 'screen' && st.s.type === 'calculator') track('calculator_opened', { from: 'lesson', lesson_id: session.lesson ? session.lesson.id : null, has_estimate: !!(S.calc && S.calc.type) });
    }
    clockStart();
    focusPlayer();
  }

  function questionHead(st) {
    var q = st.q;
    var label = session.mode === 'repair' ? 'הצלת רצף · ' + (session.idx + 1) + ' מתוך ' + stepCount()
      : st.review ? 'חזרה' + (BY_ID[q.lessonId] && (!session.lesson || BY_ID[q.lessonId] !== session.lesson) ? ' · ' + esc(BY_ID[q.lessonId].title) : '')
      : st.retry ? 'עוד ניסיון'
      : q.type === 'trueFalse' ? 'נכון או לא נכון?'
      : q.type === 'match' ? 'התאמה'
      : q.type === 'order' ? 'סידור לפי הסדר'
      : q.type === 'numeric' ? 'חישוב'
      : 'בחרו את התשובה הנכונה';
    var peek = session.lesson && !st.review ? '<button class="peek" data-act="peek">' + ICON.book + 'להציץ בהסבר</button>' : '';
    return '<div class="q-head"><div class="kicker' + (st.review || st.retry ? ' review' : '') + '">' + label + '</div>' + peek + '</div>' +
      (q.scenario ? '<div class="scenario"><span class="sc-ic">' + ICON.user + '</span><p>' + esc(q.scenario) + '</p></div>' : '') +
      '<h2 class="q-prompt">' + esc(q.prompt) + '</h2>';
  }

  function questionBody(st) {
    var q = st.q;
    if (q.type === 'numeric') {
      var cls = st.checked ? (st.right ? ' right' : ' wrong') : '';
      return '<div class="num-wrap' + cls + '"><input id="num-' + esc(q.id) + '" class="num" type="text" inputmode="decimal" autocomplete="off" dir="ltr" ' +
        'placeholder="?" value="' + esc(st.input) + '"' + (st.checked ? ' disabled' : '') + ' aria-label="התשובה שלך">' +
        (q.unit ? '<span class="unit">' + esc(q.unit) + '</span>' : '') + '</div>';
    }
    if (q.type === 'match') {
      var m = st.m, done = function (i) { return m.matched.indexOf(i) >= 0; };
      var cell = function (side, i, text) {
        var c = 'tile-btn';
        if (done(i)) c += ' matched';
        else if ((side === 'a' ? m.selA : m.selB) === i) c += ' sel';
        if (m.flash && m.flash[side] === i) c += ' wrong';
        return '<button class="' + c + '" data-act="match" data-side="' + side + '" data-i="' + i + '"' + (done(i) || st.checked ? ' disabled' : '') + '>' + esc(text) + '</button>';
      };
      return '<div class="match"><div class="col">' + m.a.map(function (i) { return cell('a', i, q.pairs[i].a); }).join('') + '</div>' +
        '<div class="col">' + m.b.map(function (i) { return cell('b', i, q.pairs[i].b); }).join('') + '</div></div>';
    }
    if (q.type === 'order') {
      var o = st.o, slots = '';
      for (var i = 0; i < q.items.length; i++) {
        var it = o.picked[i];
        if (it === undefined) {
          slots += '<li class="slot empty"><span class="num-badge">' + (i + 1) + '</span></li>';
        } else {
          var sc = 'slot filled' + (st.checked ? (it === i ? ' right' : ' wrong') : '');
          slots += '<li><button class="' + sc + '" data-act="order-unpick" data-pos="' + i + '"' + (st.checked ? ' disabled' : '') + '>' +
            '<span class="num-badge">' + (i + 1) + '</span><span>' + esc(q.items[it]) + '</span></button></li>';
        }
      }
      var left = o.pool.filter(function (x) { return o.picked.indexOf(x) < 0; });
      var pool = left.map(function (x) {
        return '<button class="chip-btn" data-act="order-pick" data-i="' + x + '">' + esc(q.items[x]) + '</button>';
      }).join('');
      return '<ol class="order-slots">' + slots + '</ol>' +
        (pool && !st.checked ? '<div class="order-pool">' + pool + '</div>' : '');
    }
    var tf = q.type === 'trueFalse';
    var opts = st.order.map(function (oi, pos) {
      var c = 'opt';
      if (st.checked) {
        if (oi === q.correctIndex) c += ' right';
        else if (oi === st.sel) c += ' wrong';
      } else if (oi === st.sel) c += ' sel';
      return '<button class="' + c + '" data-act="pick" data-i="' + oi + '"' + (st.checked ? ' disabled' : '') + '>' +
        (tf ? '' : '<span class="key">' + HEB_LETTERS[pos] + '</span>') + '<span>' + esc(q.options[oi]) + '</span></button>';
    }).join('');
    return '<div class="options' + (tf ? ' tf' : '') + '">' + opts + '</div>';
  }

  function correctText(q) {
    if (q.type === 'numeric') return fmt(q.answer) + (q.unit ? ' ' + q.unit : '');
    if (q.type === 'match' || q.type === 'order') return '';
    return q.options[q.correctIndex];
  }

  // "מקור: כל זכות, פיקדון אישי..." under an explanation: one tap to check the fact on an official page (Shahar, 19.10)
  // whole: the link stands for several entries of one page (the notes list), so it carries the page's own name when it has one
  function srcLink(q, placement, lessonId, whole) {
    var x = srcOf(q);
    if (!x) return '';
    var title = whole && typeof x.page === 'string' && x.page ? x.page : x.title;
    return '<p class="q-src"><a href="' + esc(x.url) + '" target="_blank" rel="noopener" data-act="src" data-src="' + esc(q.src) + '" data-q="' + esc(q.id) +
      '" data-l="' + esc(lessonId || q.lessonId || '') + '" data-placement="' + placement + '">' + ICON.ext + '<span>מקור: ' + esc(x.site) + ', ' + esc(title) + '</span></a></p>';
  }
  function questionFoot(st) {
    var q = st.q;
    if (!st.checked) {
      if (q.type === 'match') return '<div class="player-foot gutter"><p class="hint center">בוחרים מושג ואז את ההסבר שלו.</p></div>';
      var ready = q.type === 'numeric' ? st.input.trim() !== ''
        : q.type === 'order' ? st.o.picked.length === q.items.length
        : st.sel !== null;
      var hint = q.type === 'order' ? '<p class="hint center">לוחצים על הצעדים לפי הסדר. לחיצה על צעד שנבחר מחזירה אותו.</p>' : '';
      return '<div class="player-foot gutter">' + hint + '<button class="btn" data-act="check"' + (ready ? '' : ' disabled') + '>בדיקה</button></div>';
    }
    var right = st.right, ct = correctText(q);
    var title = right ? st.praise : q.type === 'match' ? 'הותאם, עם ' + plural(st.m.mistakes, 'טעות אחת', 'טעויות') : 'לא בדיוק';
    var fix = '';
    if (!right && ct) fix = '<p>התשובה הנכונה: <span class="ans">' + esc(ct) + '</span></p>';
    if (!right && q.type === 'order') fix = '<p>הסדר הנכון:</p><ol class="ans-list">' + q.items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>';
    return '<div class="player-foot gutter ' + (right ? 'ok' : 'bad') + '">' +
      '<div class="verdict"><div class="badge">' + (right ? ICON.check : ICON.x) + '</div><div>' +
      '<h3>' + title + (st.gain ? ' <span class="gain">' + plus(st.gain) + '</span>' : '') + '</h3>' +
      fix + '<p>' + esc(q.explanation) + '</p>' + srcLink(q, 'answer') + '</div></div>' +
      '<button class="btn ' + (right ? 'ok' : 'bad') + '" data-act="next">המשך</button></div>';
  }

  var lastPraise = '';
  function praise() {
    var c = ['מצוין!', 'בול!', 'נכון!', 'יפה מאוד!', 'בדיוק!', 'אלוף!', 'וואו, נכון!'].filter(function (x) { return x !== lastPraise; });
    lastPraise = c[Math.floor(Math.random() * c.length)];
    return lastPraise;
  }

  function focusPlayer() {
    var num = root.querySelector('.num:not(:disabled)');
    if (num) { try { num.focus({ preventScroll: true }); } catch (e) { /* ignore */ } return; }
    var b = root.querySelector('.player-foot .btn:not(:disabled)');
    if (b) { try { b.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }

  function parseNum(s) {
    var t = String(s).replace(/[,\s₪%]/g, '').replace(/[^\d.\-]/g, '');
    return t === '' ? NaN : parseFloat(t);
  }

  function resolve(st, right) {
    st.checked = true;
    st.right = right;
    S.answered++;
    if (!st.retry) {
      session.firstTry++;
      if (right) session.firstTryRight++;
    }
    st.gain = 0;
    if (right) {
      S.correct++;
      session.combo++;
      session.maxCombo = Math.max(session.maxCombo, session.combo);
      st.gain = st.retry ? 0 : (st.review ? P.review : P.correct);
      session.xp += st.gain;
      if (st.review) session.reviewRight++;
      if (S.mistakes[st.q.id]) S.mistakes[st.q.id] = Math.max(0, S.mistakes[st.q.id] - 1);
      st.praise = praise();
      sfx.right(session.combo);
    } else {
      session.combo = 0;
      S.mistakes[st.q.id] = (S.mistakes[st.q.id] || 0) + 1;
      // a wrong answer comes back once at the end (not matching, and not in the streak rescue test)
      if (!st.retry && st.q.type !== 'match' && session.mode !== 'repair') session.steps.push(buildQuestionStep(st.q, { retry: true }));
      sfx.wrong();
    }
    // what was picked, so a popular wrong answer shows up in the data (positions and indexes only, no texts)
    var props = {
      mode: session.mode, lesson_id: session.lesson ? session.lesson.id : st.q.lessonId, question_id: st.q.id,
      question_type: st.q.type, correct: right, retry: st.retry, review: st.review,
      is_first_try: !st.retry && !st.review && !(session.lesson && isDone(session.lesson.id))
    };
    if (st.q.type === 'order') {
      var fw = -1;
      st.o.picked.forEach(function (x, i) { if (fw < 0 && x !== i) fw = i; });
      props.picked = st.o.picked.join(','); props.first_wrong_pos = fw;
    } else if (st.q.type === 'match') {
      props.mistakes = st.m.mistakes; props.wrong_pairs = (st.m.wrong || []).slice(0, 8).join(','); props.pair_count = st.q.pairs.length;
    } else if (st.q.options) {
      props.option_index = st.sel; props.option_pos = st.order ? st.order.indexOf(st.sel) : st.sel; props.option_count = st.q.options.length;
    }
    track('question_answered', props);
    save();
  }

  // after a right answer: sparkles, floating points and combo cheers
  function celebrate(st) {
    if (!st.right) return;
    var target = root.querySelector('.opt.right') || root.querySelector('.order-slots') || root.querySelector('.verdict .badge');
    burst(target);
    if (st.gain) floatText(target, '+' + st.gain);
    if ([3, 5, 8, 12, 20].indexOf(session.combo) >= 0) {
      var comboNow = session.combo; // the lesson can end before the timer (a fast "next" on the last question)
      setTimeout(function () { sfx.combo(comboNow); }, 220);
      toast(ICON.flame + '<b>' + session.combo + ' ברצף!</b><span>' + (session.combo >= 8 ? 'בלתי ניתן לעצירה' : session.combo >= 5 ? 'על הגל' : 'ממשיכים ככה') + '</span>', 'combo');
    }
  }

  function check() {
    var st = step();
    if (st.kind !== 'q' || st.checked) return;
    var q = st.q;
    if (q.type === 'numeric') {
      var inp = root.querySelector('.num');
      if (inp) st.input = inp.value;
      var v = parseNum(st.input);
      if (isNaN(v)) return;
      resolve(st, Math.abs(v - q.answer) <= (q.tolerance || 0));
    } else if (q.type === 'order') {
      if (st.o.picked.length !== q.items.length) return;
      resolve(st, st.o.picked.every(function (x, i) { return x === i; }));
    } else {
      if (st.sel === null) return;
      resolve(st, st.sel === q.correctIndex);
    }
    render();
    celebrate(st);
  }

  function pickMatch(side, i) {
    var st = step(), m = st.m;
    if (!m || st.checked || m.flash) return;
    if (side === 'a') m.selA = m.selA === i ? null : i; else m.selB = m.selB === i ? null : i;
    if (m.selA !== null && m.selB !== null) {
      if (m.selA === m.selB) {
        m.matched.push(m.selA); m.selA = m.selB = null; sfx.pair();
        if (m.matched.length === st.q.pairs.length) { resolve(st, m.mistakes === 0); render(); celebrate(st); return; }
      } else {
        m.mistakes++;
        (m.wrong = m.wrong || []).push(m.selA + '-' + m.selB);
        m.flash = { a: m.selA, b: m.selB };
        sfx.wrong();
        setTimeout(function () { m.flash = null; m.selA = m.selB = null; if (view === 'lesson') render(); }, 550);
      }
    } else sfx.tap();
    render();
  }

  function next() {
    session.idx++;
    if (session.idx >= stepCount()) return finish();
    render();
    window.scrollTo(0, 0);
  }
  function back() {
    if (session.idx > 0) { session.idx--; render(); window.scrollTo(0, 0); }
  }

  function finish() {
    clockStop();
    // a day may have passed during the lesson: apply a day off (or the break) first, so the done screen tells the truth
    checkStreakBreak();
    var s = session, l = s.lesson;
    var acc = s.firstTry ? Math.round(s.firstTryRight / s.firstTry * 100) : 100;
    var perfect = s.firstTry > 0 && s.firstTry === s.firstTryRight;
    var before = levelInfo(S.xp), goalBefore = todayXp() >= S.goalXp, streakBefore = currentStreak();
    s.acc = acc; s.time = elapsed(); s.bonus = 0; s.perfectBonus = 0; s.speedBonus = 0;
    s.pctBefore = before.pct;
    if (s.mode === 'lesson') {
      s.target = lessonMinutes(l) * 60000;
      s.bonus = P.lessonDone;
      s.perfectBonus = perfect ? P.perfect : 0;
      s.speedBonus = s.time <= s.target && acc >= 80 ? P.speed : 0;
      s.xp += s.bonus + s.perfectBonus + s.speedBonus;
      var rec = S.lessons[l.id] || { done: false, best: 0, plays: 0 };
      s.firstTime = !rec.done;
      rec.done = true; rec.plays++;
      rec.best = Math.max(rec.best, acc);
      rec.fastest = rec.fastest ? Math.min(rec.fastest, s.time) : s.time;
      S.lessons[l.id] = rec;
      S.inProgress = null;
      // a friend's gift: the first lesson of someone who opened the app from an invite link (before the points, so a
      // level-up on lesson 1 reports the right count)
      if (DO.enabled && s.firstTime && S.giftPending && doneCount() === 1) {
        var gb = S.daysOff;
        S.daysOff = Math.min(DO.maxHeld, S.daysOff + DO.friendGift);
        s.giftGiven = S.daysOff - gb;
        S.giftPending = false; S.giftGot = true;
        track('friend_gift_given', { held: S.daysOff, lesson_id: l.id });
        track('day_off_earned', { source: 'friend_gift', added: s.giftGiven, held: S.daysOff, at_cap: s.giftGiven < DO.friendGift });
      }
    }
    if (s.mode === 'repair') {
      s.passed = s.firstTryRight >= s.need;
      if (s.passed && S.lostStreak) {
        var lost = S.lostStreak.value, today = dayKey();
        if (S.lastDay === today) S.streak = lost + S.streak;
        else { S.streak = lost; S.lastDay = dayKey(addDays(new Date(), -1)); }
        S.lostStreak = null;
      }
    }
    s.levelGrant = awardXp(s.xp);
    s.perfect = perfect;
    s.levelUp = levelIndex(S.xp) > before.i;
    if (s.levelUp) s.pctBefore = 0;
    s.goalHit = !goalBefore && todayXp() >= S.goalXp;
    s.streakUp = currentStreak() > streakBefore;
    save();
    var props = { mode: s.mode, duration_sec: Math.round(s.time / 1000), accuracy: acc, points: s.xp, max_combo: s.maxCombo };
    if (s.mode === 'lesson') {
      props.lesson_id = l.id; props.unit_id = l.unit.id; props.perfect = perfect;
      props.speed_bonus = !!s.speedBonus; props.first_time = s.firstTime;
      track('lesson_completed', props);
    } else if (s.mode === 'repair') {
      props.passed = s.passed;
      track('repair_completed', props);
    } else track('practice_completed', props);
    sfx.done();
    setView('done');
    confetti(s.perfect || s.levelUp);
    countUp();
    if (s.streakUp) setTimeout(sfx.streak, 900);
    if (s.levelUp) setTimeout(function () { if (view === 'done' && !sheetOpen) levelUpSheet(s.levelGrant); }, 1500);
  }

  function countUp() {
    var el = root.querySelector('[data-count]');
    var bar = root.querySelector('[data-w]');
    if (bar) setTimeout(function () { bar.style.width = bar.getAttribute('data-w') + '%'; }, 80);
    if (!el) return;
    var to = +el.getAttribute('data-count');
    if (reducedMotion() || !to) { el.textContent = '+' + to; return; }
    var t0 = performance.now(), dur = Math.min(1300, 400 + to * 6), lastTick = 0;
    (function frame(t) {
      var p = Math.min(1, (t - t0) / dur), v = Math.round(to * (1 - Math.pow(1 - p, 3)));
      el.textContent = '+' + v;
      if (p < 1 && t - lastTick > 85) { sfx.coin(); lastTick = t; }
      if (p < 1) requestAnimationFrame(frame);
    })(t0);
  }

  function ratingRow(l) {
    if (S.ratings[l.id]) {
      return '<div class="rate done">' + ICON.check + '<span>תודה על הדירוג!</span>' +
        '<button class="link" data-act="feedback" data-ctx="lesson" data-id="' + esc(l.id) + '">לכתוב עוד משהו</button></div>';
    }
    return '<div class="rate"><b>איך היה השיעור?</b><div class="rate-btns">' +
      [['hard', 'לא ברור'], ['ok', 'בסדר'], ['great', 'מעולה']].map(function (r) {
        return '<button class="chip-btn" data-act="rate" data-v="' + r[0] + '" data-id="' + esc(l.id) + '">' + r[1] + '</button>';
      }).join('') + '</div></div>';
  }

  function intentCard(l) {
    if ((CFG.investIntentLessons || []).indexOf(l.id) < 0) return '';
    var a = S.intent[l.id];
    if (a) return '<div class="intent done">' + ICON.check + '<span>תודה! התשובה עוזרת לנו להבין מה מעניין אתכם.</span></div>';
    return '<div class="intent"><b>חושבים לפתוח תיק מסחר בזמן הקרוב?</b><span>זו לא המלצה. רק שאלה, כדי שנדע מה מעניין אתכם.</span><div class="rate-btns">' +
      [['soon', 'כן, בקרוב'], ['later', 'אולי בהמשך'], ['no', 'לא']].map(function (r) {
        return '<button class="chip-btn" data-act="intent" data-v="' + r[0] + '" data-id="' + esc(l.id) + '">' + r[1] + '</button>';
      }).join('') + '</div></div>';
  }

  // the anonymous follow-up after invest_intent: how much could you deposit this year (ranges only)
  function amountCard(l) {
    var bands = CFG.investAmountBands || [];
    if (!bands.length || (CFG.investIntentLessons || []).indexOf(l.id) < 0 || !S.intent[l.id] || livePartners().length) return '';
    if (S.amount[l.id]) return '<div class="intent done">' + ICON.check + '<span>תודה! זה נשאר אנונימי.</span></div>';
    return '<div class="intent"><b>כמה תוכלו להפקיד בשנה הקרובה?</b><span>אנונימי לגמרי, ולא קשור לשום הצעה. רק כדי שהשיעורים יתאימו לסכומים אמיתיים.</span><div class="rate-btns bands">' +
      bands.map(function (b) { return '<button class="chip-btn" data-act="amount" data-v="' + esc(b.id) + '" data-id="' + esc(l.id) + '">' + esc(b.label) + '</button>'; }).join('') +
      '</div><button class="link skip" data-act="amount" data-v="skip" data-id="' + esc(l.id) + '">מעדיפים לא לענות</button></div>';
  }

  function renderDone() {
    var s = session, l = s.lesson;
    var r = levelInfo(S.xp);
    var title = s.levelUp ? 'עלית לשלב ' + r.n + '!'
      : s.mode === 'practice' ? 'התרגול הושלם'
      : s.mode === 'repair' ? (s.passed ? 'הרצף ניצל!' : 'הפעם זה לא הספיק')
      : s.perfect ? 'שיעור מושלם!' : 'השיעור הושלם!';
    var sub = s.mode === 'repair'
      ? (s.passed ? 'רצף של ' + plural(currentStreak(), 'יום אחד', 'ימים') + '. ממשיכים מחר.' : s.firstTryRight + ' נכונות מתוך ' + stepCount() + '. צריך ' + s.need + '. אפשר לנסות שוב.')
      : s.goalHit ? 'עמדת ביעד היומי.' : s.streakUp ? 'רצף של ' + plural(currentStreak(), 'יום אחד', 'ימים') + '.' : 'עוד צעד בדרך.';
    var art = CFG.images && CFG.images.done;
    var correctPts = s.xp - s.bonus - s.perfectBonus - s.speedBonus;
    var rows = '<li><span>תשובות נכונות</span><b>' + plus(correctPts) + '</b></li>';
    if (s.giftGiven > 0) rows = '<li class="gift"><span>' + ICON.dayoff + 'מתנה מחבר</span><b>' + daysOffText(s.giftGiven) + '</b></li>' + rows;
    if (s.mode === 'lesson') {
      rows += '<li><span>סיום שיעור</span><b>' + plus(s.bonus) + '</b></li>' +
        '<li><span>בלי אף טעות</span><b>' + (s.perfectBonus ? plus(s.perfectBonus) : '<i>לא הפעם</i>') + '</b></li>' +
        '<li><span>' + ICON.bolt + 'מהירות: ' + ltr(clock(s.time)) + ' מתוך ' + ltr(clock(s.target)) + '</span><b>' + (s.speedBonus ? plus(s.speedBonus) : '<i>לא הפעם</i>') + '</b></li>';
    }
    var html = '<div class="done-wrap gutter' + (l ? ' u' + l.unit.id : '') + '">' +
      '<div class="done-hero">' + (art ? '<div class="done-art"><img src="' + esc(art) + '" alt=""></div>' : '') +
        '<div class="coin' + (art ? ' small' : '') + '" dir="ltr" data-count="' + s.xp + '">+0</div><h1>' + esc(title) + '</h1><p>' + sub + '</p></div>' +
      '<div class="tiles">' +
        '<div class="tile xp"><div class="t-label">נקודות</div><div class="t-val">' + s.xp + '</div></div>' +
        '<div class="tile acc"><div class="t-label">נכונות</div><div class="t-val">' + s.acc + '%</div></div>' +
        '<div class="tile time"><div class="t-label">זמן</div><div class="t-val">' + ltr(clock(s.time)) + '</div></div>' +
      '</div>' +
      '<div class="card tight"><ul class="rules">' + rows + '</ul>' +
        '<div class="progress-row"><span>שלב ' + r.n + '</span><span class="bar gold"><i data-w="' + Math.round(r.pct * 100) + '" style="width:' + Math.round(s.pctBefore * 100) + '%"></i></span><span>' + (r.last ? '' : 'שלב ' + (r.n + 1)) + '</span></div>' +
        '<p class="fine">' + (r.last ? '' : 'עוד ' + fmt(r.toNext) + ' נקודות לשלב הבא' + (DO.enabled && S.daysOff < DO.maxHeld ? ', ואיתו יום חופש לרצף. ' : '. ')) +
          'היעד היומי: ' + fmt(todayXp()) + ' מתוך ' + fmt(S.goalXp) + '. <button class="link" data-act="explain" data-what="points">בשביל מה הנקודות?</button></p>' +
      '</div>' +
      (DO.enabled && s.mode === 'lesson' && s.firstTime && doneCount() === 1
        ? '<p class="fine first-explainer">' + ICON.dayoff + '<span>הנקודות מעלות שלב, וכל שלב חדש נותן יום חופש לרצף: יום בלי שיעור שהרצף לא נשבר בו' + minStreakNote() + '.</span></p>' : '');
    if (s.mode === 'repair' && !s.passed && repairInfo()) html += '<button class="btn gold" data-act="repair">לנסות שוב</button>';
    if (l) {
      html += '<div class="takeaway remember"><div class="eyebrow">משפט לזכור</div><p>' + esc(l.remember) + '</p></div>' +
        ratingRow(l) + intentCard(l) + amountCard(l) + missionCard(l, true);
    }
    // iPhone: the install ask comes right after the first lesson, while the win is fresh (Android keeps the home card)
    if (s.mode === 'lesson' && s.firstTime && INSTALL.showOnDone && IS_IOS && doneCount() === INSTALL.afterLessons) {
      var ic = installCard('done');
      if (ic && !s.installShown) { s.installShown = true; track('install_card_shown', { placement: 'done', lessons_done: doneCount() }); }
      html += ic;
    }
    html += legalLine(false) + '<div class="spacer"></div>';
    // after a lesson (or a rescued streak), not after practice: the win is worth sending to friends
    if (INVITE.enabled && doneCount() >= INVITE.afterLessons && (s.mode === 'lesson' || (s.mode === 'repair' && s.passed))) {
      html += '<button class="btn ghost" data-act="invite" data-from="done" data-id="' + esc(l ? l.id : '') + '">' + ICON.share + 'להזמין חבר</button>';
      html += inviteNote();
    }
    html += '<button class="btn" data-act="home">המשך</button></div>';
    return html;
  }

  // ---------- Missions ----------
  function missionCard(l, big) {
    var m = l.mission, ms = missionState(l.id);
    var stepsDone = ms.steps.filter(Boolean).length;
    return '<button class="mission-card' + (ms.done ? ' done' : '') + (big ? ' big' : '') + '" data-act="mission" data-id="' + esc(l.id) + '">' +
      '<span class="m-ic">' + (ms.done ? ICON.check : ICON.target) + '</span>' +
      '<span class="m-txt"><span class="eyebrow">' + (big ? 'המשימה של השיעור' : esc(l.title)) + '</span>' +
      '<b>' + esc(m.title) + '</b>' +
      '<span class="m-meta">' + ICON.clock + (m.minutes || 10) + ' דק׳' +
        (ms.done ? ' · בוצע' : ' · ' + plus(P.mission) + ' נקודות' + (m.steps.length && stepsDone ? ' · ' + stepsDone + '/' + m.steps.length + ' שלבים' : '')) + '</span></span>' +
      ICON.chevron + '</button>';
  }

  function missionSheet(id) {
    var l = BY_ID[id], m = l.mission, ms = missionState(id);
    var steps = m.steps.map(function (s, i) {
      return '<li><label class="m-step" for="ms-' + esc(id) + '-' + i + '"><input type="checkbox" id="ms-' + esc(id) + '-' + i + '" data-act="mstep" data-id="' + esc(id) + '" data-i="' + i + '"' +
        (ms.steps[i] || ms.done ? ' checked' : '') + (ms.done ? ' disabled' : '') + '><span>' + esc(s) + '</span></label></li>';
    }).join('');
    var all = m.steps.every(function (_, i) { return ms.steps[i]; });
    var mins = m.minutes || 10;
    openSheet('<div class="eyebrow">משימה · ' + esc(l.title) + ' · ' + ICON.clock + (mins === 1 ? 'דקה' : mins + ' דקות') + '</div>' +
      '<h3>' + esc(m.title) + '</h3>' +
      (m.why ? '<p class="lead">' + esc(m.why) + '</p>' : '') +
      (steps ? '<ol class="m-steps">' + steps + '</ol>' : '') +
      (m.done ? '<p class="m-done-note">' + ICON.trophy + '<span>' + esc(m.done) + '</span></p>' : '') +
      (ms.done ? '<button class="btn ghost" data-act="close-sheet">המשימה בוצעה</button>'
        : '<button class="btn gold" data-act="mission-done" data-id="' + esc(id) + '"' + (all ? '' : ' disabled') + '>' + (all ? 'סיימתי את המשימה · ' + plus(P.mission) : 'מסמנים את כל השלבים כדי לסיים') + '</button>' +
          '<button class="btn text" data-act="close-sheet">אעשה אחר כך</button>'), 'tall');
  }

  function renderMissions() {
    var done = LESSONS.filter(function (l) { return isDone(l.id); });
    var open = done.filter(function (l) { return !missionState(l.id).done; });
    var closed = done.filter(function (l) { return missionState(l.id).done; });
    var html = '<div class="page"><h1>משימות</h1><p class="sub">כל שיעור נגמר במשימה קצרה בעולם האמיתי. כאן הידע הופך לכסף שנשאר אצלך.</p>';
    if (!done.length) {
      html += '<div class="card">' + img('empty', 'empty-art') + '<p class="empty">המשימה הראשונה נפתחת בסוף השיעור הראשון.</p>' +
        '<button class="btn" data-act="nav" data-to="home">לשיעור הראשון</button></div>';
      return html + '</div>';
    }
    html += '<div class="m-summary"><b>' + closed.length + '/' + done.length + '</b><span>משימות בוצעו</span><span class="bar"><i style="width:' + Math.round(closed.length / done.length * 100) + '%"></i></span></div>';
    if (open.length) html += '<h2 class="sec">מחכות לך</h2><div class="m-list">' + open.map(function (l) { return missionCard(l); }).join('') + '</div>';
    if (closed.length) html += '<h2 class="sec">בוצעו</h2><div class="m-list">' + closed.map(function (l) { return missionCard(l); }).join('') + '</div>';
    return html + '</div>';
  }

  // ---------- Notes (reread a finished lesson) ----------
  function renderNotes(l) {
    var screens = l.vScreens.map(function (s) {
      return '<article class="explain-card flat"><h2>' + esc(s.title) + '</h2><p>' + esc(s.body) + '</p>' +
        (s.type === 'calculator' ? '<button class="btn ghost" data-act="calc-open" data-from="notes">לפתוח את המחשבון</button>'
          : s.example ? '<div class="example"><span class="eyebrow">דוגמה</span><p>' + esc(s.example) + '</p></div>' : '') + '</article>';
    }).join('');
    return '<div class="notes u' + l.unit.id + '"><div class="player-top gutter"><button class="icon-btn" data-act="notes-close" aria-label="חזרה">' + ICON.back + '</button>' +
      '<div class="notes-title"><span class="eyebrow">יחידה ' + l.unit.n + ' · שיעור ' + l.n + '</span><b>' + esc(l.title) + '</b></div></div>' +
      '<div class="stage gutter">' + screens +
      '<div class="takeaway remember"><div class="eyebrow">משפט לזכור</div><p>' + esc(l.remember) + '</p></div>' +
      missionCard(l, true) + notesSources(l) +
      (l.source ? '<p class="source">מקורות: ' + esc(l.source) + '</p>' : '') +
      legalLine(false) +
      '<button class="btn" data-act="restart" data-id="' + esc(l.id) + '">לתרגל את השיעור שוב</button></div></div>';
  }

  // the official pages behind this lesson's questions, each once
  // the lesson's official pages, each page once (several glossary entries of one page share a link)
  function notesSources(l) {
    var pages = Object.create(null), order = [];
    l.vQuestions.forEach(function (q) {
      var x = srcOf(q);
      if (!x) return;
      var g = pages[x.url];
      if (!g) { g = pages[x.url] = { q: q, keys: [] }; order.push(x.url); }
      if (g.keys.indexOf(q.src) < 0) g.keys.push(q.src);
    });
    var links = order.map(function (u) { var g = pages[u]; return srcLink(g.q, 'notes', l.id, g.keys.length > 1); });
    return links.length ? '<div class="src-list"><h2 class="sec">לבדוק במקור</h2>' + links.join('') + '</div>' : '';
  }

  function peekSheet() {
    var l = session.lesson;
    var screens = l.vScreens.map(function (s) {
      return '<div class="peek-item"><b>' + esc(s.title) + '</b><p>' + esc(s.body) + '</p>' + (s.example ? '<p class="ex">' + esc(s.example) + '</p>' : '') + '</div>';
    }).join('');
    openSheet('<div class="eyebrow">' + esc(l.title) + '</div><h3>ההסברים של השיעור</h3>' + screens + '<button class="btn" data-act="close-sheet">חזרה לשאלה</button>', 'tall');
  }

  function quitSheet() {
    var lesson = session.mode === 'lesson';
    openSheet('<h3>' + (lesson ? 'לצאת מהשיעור?' : 'לצאת?') + '</h3><p class="lead">' +
      (lesson ? 'ההתקדמות נשמרת. בפעם הבאה ממשיכים מאותו מסך.' : session.mode === 'repair' ? 'המבחן לא יישמר, ואפשר להתחיל אותו שוב.' : 'התרגול הזה לא יישמר.') + '</p>' +
      '<div class="row"><button class="btn" data-act="close-sheet">להמשיך ללמוד</button>' +
      '<button class="btn ghost" data-act="quit-confirm">לצאת</button></div>');
  }

  // ---------- Practice ----------
  function img(key, cls) {
    var src = CFG.images && CFG.images[key];
    return src ? '<div class="' + cls + '"><img src="' + esc(src) + '" alt=""></div>' : '';
  }

  function renderPractice() {
    var done = doneCount();
    var mistakes = Object.keys(S.mistakes).filter(function (k) {
      var q = QUESTIONS[k];
      return S.mistakes[k] > 0 && q && isDone(q.lessonId) && shown(BY_ID[q.lessonId]) && visible(q);
    }).sort(function (a, b) { return S.mistakes[b] - S.mistakes[a]; });
    var html = '<div class="page"><h1>תרגול</h1>';
    if (!done) {
      html += '<div class="card">' + img('empty', 'empty-art') + '<p class="empty">סיימו את השיעור הראשון והתרגול ייפתח. כאן יחכו שאלות חזרה מכל מה שלמדת.</p>' +
        '<button class="btn" data-act="nav" data-to="home">לשיעור הראשון</button></div>';
    } else {
      var rep = repairInfo();
      if (rep) html += '<div class="card repair-card"><h2>הצלת הרצף</h2><p>הרצף של ' + fmt(rep.value) + ' ימים נשבר. ' + CFG.streakRepair.questions + ' שאלות, ' + CFG.streakRepair.toPass + ' נכונות לפחות, והוא חוזר.</p><button class="btn gold" data-act="repair">להציל את הרצף</button></div>';
      html += '<div class="card"><h2>תרגול מהיר</h2><p>' + CFG.practiceSize + ' שאלות מהשיעורים שסיימת. שאלות שטעית בהן מגיעות קודם. ' + P.review + ' נקודות לכל תשובה נכונה.</p>' +
        '<button class="btn gold" data-act="practice">התחל תרגול</button></div>';
      html += '<div class="card"><h2>תיקון טעויות</h2>' + (mistakes.length
        ? '<p>' + plural(mistakes.length, 'שאלה אחת', 'שאלות') + ' שעוד לא תוקנו.</p><ul class="mistake-list">' + mistakes.slice(0, 4).map(function (k) { return '<li>' + esc(QUESTIONS[k].prompt) + '</li>'; }).join('') + '</ul>' +
          '<button class="btn ghost" data-act="practice-mistakes">לתקן את הטעויות</button>'
        : '<p>אין כרגע טעויות פתוחות.</p>') + '</div>';
    }
    return html + '</div>';
  }

  // ---------- Profile ----------
  // learning days (points earned) in the last 7 days, today included: a day off is not a learning day
  function learned7() {
    var n = 0;
    for (var i = 0; i < 7; i++) if ((S.days[dayKey(addDays(new Date(), -i))] || 0) > 0) n++;
    return n;
  }
  function weekChart() {
    var days = [], names = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
    for (var i = 6; i >= 0; i--) {
      var d = addDays(new Date(), -i), k = dayKey(d);
      days.push({ n: names[d.getDay()], xp: Number(S.days[k]) || 0, off: S.offUsed.indexOf(k) >= 0 });
    }
    var max = Math.max(S.goalXp * 1.25, Math.max.apply(null, days.map(function (d) { return d.xp; })));
    var W = 320, H = 150, top = 18, bottom = 24, bw = 28, gap = (W - bw * 7) / 6;
    var y = function (v) { return top + (H - top - bottom) * (1 - v / max); };
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="נקודות וימי חופש לרצף בשבעת הימים האחרונים">';
    var gy = y(S.goalXp).toFixed(1);
    svg += '<line class="goal-line" x1="0" x2="' + W + '" y1="' + gy + '" y2="' + gy + '"/>';
    // oldest day on the right, today on the left (Hebrew reading order)
    days.forEach(function (d, i) {
      var x = W - bw - i * (bw + gap);
      if (!d.xp && d.off) {
        // a day off for the streak: a short blue bar with the umbrella, not a learning day
        svg += '<rect class="wbar off" x="' + x.toFixed(1) + '" y="' + (H - bottom - 22) + '" width="' + bw + '" height="22" rx="6"><title>יום חופש לרצף</title></rect>' +
          ICON.dayoff.replace('<svg ', '<svg class="off-ic" x="' + (x + bw / 2 - 8).toFixed(1) + '" y="' + (H - bottom - 22 - 20) + '" width="16" height="16" ') +
          '<text class="lbl" x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + d.n + '</text>';
        return;
      }
      var h = Math.max(4, (H - top - bottom) - (y(d.xp) - top));
      var cls = d.xp === 0 ? 'wbar zero' : d.xp >= S.goalXp ? 'wbar met' : 'wbar';
      svg += '<rect class="' + cls + '" x="' + x.toFixed(1) + '" y="' + (H - bottom - h).toFixed(1) + '" width="' + bw + '" height="' + h.toFixed(1) + '" rx="6"/>';
      if (d.xp) svg += '<text class="val" x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - bottom - h - 5).toFixed(1) + '" text-anchor="middle">' + d.xp + '</text>';
      svg += '<text class="lbl" x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + d.n + '</text>';
    });
    return svg + '</svg>';
  }

  function statusButtons(act, current) {
    return CFG.statuses.map(function (s) {
      return '<button data-act="' + act + '" data-v="' + s.id + '" aria-pressed="' + (current === s.id) + '">' + esc(s.label) + '<small>' + esc(s.note) + '</small></button>';
    }).join('');
  }

  function renderProfile() {
    var acc = S.answered ? Math.round(S.correct / S.answered * 100) : 0;
    var r = levelInfo(S.xp);
    var missionsDone = Object.keys(S.missions).filter(function (k) { return S.missions[k].done; }).length;
    var goals = CFG.goals.map(function (g) {
      return '<button data-act="goal" data-xp="' + g.xp + '" aria-pressed="' + (S.goalXp === g.xp) + '">' + g.label + '<small>' + g.xp + ' נק׳ · ' + g.note + '</small></button>';
    }).join('');
    return '<div class="page"><h1>ההתקדמות שלי</h1>' +
      '<button class="card rank-card" data-act="explain" data-what="points">' +
        '<span class="rank-badge big">' + ICON.coins + '</span>' +
        '<span class="rank-txt"><span class="eyebrow">השלב שלך</span><b>' + esc(levelLabel(r)) + '</b>' +
        '<span class="bar gold"><i style="width:' + Math.round(r.pct * 100) + '%"></i></span>' +
        '<span class="fine">' + nextLevelLine(r) + '</span></span></button>' +
      '<div class="stat-grid">' +
        statBox(ICON.flame, 'var(--flame)', currentStreak(), 'ימים ברצף') +
        statBox(ICON.coin, 'var(--gold)', fmt(S.xp), 'נקודות') +
        statBox(ICON.book, 'var(--brand)', doneCount() + '/' + LESSONS.length, 'שיעורים') +
        statBox(ICON.target, 'var(--brand)', missionsDone, 'משימות בוצעו') +
        (DO.enabled ? statBox(ICON.dayoff, 'var(--q-blue)', S.daysOff, 'ימי חופש לרצף') : statBox(ICON.trophy, 'var(--gold)', S.bestStreak, 'שיא רצף')) +
        statBox(ICON.check, 'var(--ok)', acc + '%', 'תשובות נכונות') +
      '</div>' +
      '<div class="card week"><h2>השבוע שלי</h2>' + weekChart() + '<p class="fine">ימי למידה ב-7 הימים האחרונים: ' + learned7() + ' מתוך 7. הקו המקווקו הוא היעד היומי.' +
        (weekHasOff() ? ' עמודה כחולה עם מטרייה: יום חופש לרצף, לא יום למידה.' : '') + '</p></div>' +
      inviteBar('profile') + pilotBar('profile') + calcCard() +
      '<div class="card"><h2>המצב שלי</h2><p class="fine">קובע אילו שיעורים מופיעים במסלול.</p><div class="seg two">' + statusButtons('status', S.status) + '</div></div>' +
      '<div class="card"><h2>יעד יומי</h2><div class="seg">' + goals + '</div><p class="fine">ברירת המחדל: שיעור אחד ביום. אפשר להעלות מתי שרוצים.</p></div>' +
      '<div class="card"><div class="toggle-row"><h2 id="sound-l">צלילים ורטט</h2><button class="switch" role="switch" aria-labelledby="sound-l" aria-checked="' + S.sound + '" data-act="sound"></button></div></div>' +
      reminderRow() +
      (canInstall() ? '<div class="card"><h2>התקנה בטלפון</h2><p>אייקון במסך הבית, מסך מלא, ועובד גם בלי אינטרנט.</p><button class="btn ghost" data-act="install" data-placement="profile">איך מתקינים</button></div>' : '') +
      '<div class="card transfer-card"><h2>להעביר התקדמות</h2><p>עוברים לאפליקציה המותקנת או לטלפון אחר? מעתיקים קוד, ומדביקים אותו שם במסך הפתיחה.</p>' +
        '<div class="row"><button class="btn ghost" data-act="export" data-method="copy" data-placement="profile">להעתיק קוד</button><button class="btn ghost" data-act="import" data-source="profile">יש לי קוד</button></div></div>' +
      (CFG.pilot ? '' : '<div class="card"><h2>משוב</h2><p>מה לא היה ברור? מה חסר? כל הערה עוזרת.</p><button class="btn ghost" data-act="feedback" data-ctx="profile">לכתוב משוב</button></div>') +
      '<div class="card"><h2>על ' + esc(CFG.appName) + '</h2><p>' + esc(CFG.disclaimer) + '. לפני החלטה על הכסף שלך כדאי לבדוק מול גורם מוסמך. ' + esc(CFG.examplesNote) + '</p>' +
        (CFG.about ? '<button class="btn ghost" data-act="about" data-from="profile">' + esc(CFG.about.title) + '</button>' : '') +
        '<div class="toggle-row"><span id="share-l">שיתוף נתוני שימוש אנונימיים</span><button class="switch" role="switch" aria-labelledby="share-l" aria-checked="' + S.share + '" data-act="share"></button></div>' +
        '<p class="fine">ההתקדמות נשמרת רק במכשיר הזה. גרסה ' + esc(CFG.version) + '.</p>' +
        '<button class="btn text" data-act="reset">איפוס ההתקדמות</button></div>' +
      '</div>';
  }
  function weekHasOff() {
    for (var i = 0; i < 7; i++) { var k = dayKey(addDays(new Date(), -i)); if (!(S.days[k] > 0) && S.offUsed.indexOf(k) >= 0) return true; }
    return false;
  }
  function statBox(icon, color, val, label) {
    return '<div class="stat-box"><span style="color:' + color + '">' + icon + '</span><div><b>' + val + '</b><span>' + label + '</span></div></div>';
  }

  // ---------- Welcome ----------
  // two screens: what the app is, then the status (which also picks the opening unit). The daily goal starts at the
  // default and lives in the profile.
  var pickedStatus = null;
  function renderWelcome() {
    var art = CFG.images && CFG.images.welcome ? '<div class="welcome-art"><img src="' + esc(CFG.images.welcome) + '" alt=""></div>' : '';
    var onlyStatus = S.onboarded && !S.status;
    if (onlyStatus) onboardStep = 1;
    if (onboardStep === 0) {
      return '<div class="welcome gutter">' +
        '<div class="logo">' + esc(CFG.appName) + '</div>' +
        '<p class="tag">' + esc(CFG.tagline) + '</p>' +
        (S.giftPending && DO.enabled && DO.friendGift
          ? '<p class="gift-banner">' + ICON.dayoff + '<span><b>חבר שלח לך מתנה: ' + DO.friendGift + ' ימי חופש לרצף.</b> אלה ימים שאפשר לפספס בלי שהרצף נשבר' + minStreakNote() + '. הם אצלך אחרי השיעור הראשון.' +
            (IS_IOS && !isStandalone() ? ' באייפון: עושים את השיעור הראשון כאן, ורק אז מוסיפים למסך הבית עם קוד ההעברה, והימים עוברים איתך.' : '') + '</span></p>'
          : '') + art +
        '<ul class="promises">' +
          '<li><b>מה עושים עם הכסף לפני שהוא נעלם</b><span>פיקדון, מענק שחרור, משכורת ראשונה: תוכנית לפני שהכסף מגיע לחשבון.</span></li>' +
          '<li><b>שיעורים של כמה דקות, בלי חישובים</b><span>סיפורים של אנשים בגילך, ושאלה קצרה אחרי כל הסבר.</span></li>' +
          '<li><b>משימה קצרה בסוף כל שיעור</b><span>דקה או שתיים בטלפון, כמו לבדוק כמה כסף יש בעו״ש.</span></li>' +
        '</ul>' +
        '<div class="spacer"></div>' +
        '<button class="btn gold" data-act="onboard-next">יאללה, מתחילים</button>' +
        '<p class="fine center"><button class="link" data-act="import">יש לי קוד העברה</button></p>' +
        '<p class="fine center">' + esc(CFG.disclaimer) + '.</p></div>';
    }
    var cur = pickedStatus || S.status;
    var op = cur && CFG.openers && CFG.openers[cur], fl = cur ? firstLessonFor(cur) : null;
    var opener = op ? '<div class="card opener"><h2>' + esc(op.headline) + '</h2><p class="lead">' + esc(op.promise) + '</p>' +
      (fl ? '<p class="fine">השיעור הראשון: ' + esc(fl.lesson.title) + ' · כ-' + fl.minutes + ' דקות</p>' : '') + '</div>' : '';
    return '<div class="welcome gutter">' +
      (onlyStatus ? '' : '<button class="icon-btn back-top" data-act="onboard-back" aria-label="אחורה">' + ICON.back + '</button>') +
      '<h1 class="q-prompt">מה המצב שלך?</h1>' +
      '<p class="lead">ככה נדע מאיפה להתחיל ואילו שיעורים להראות. אפשר לשנות בפרופיל.</p>' +
      '<div class="goal-pick">' + CFG.statuses.map(function (s) {
        return '<button class="btn ' + (cur === s.id ? '' : 'ghost') + ' goal-opt" data-act="pick-status" data-v="' + s.id + '" aria-pressed="' + (cur === s.id) + '">' +
          '<span><b>' + esc(s.label) + '</b><small>' + esc(s.note) + '</small></span></button>';
      }).join('') + '</div>' + opener +
      '<div class="spacer"></div>' +
      '<button class="btn gold" data-act="' + (onlyStatus ? 'begin-status' : 'onboard-status') + '"' + (cur ? '' : ' disabled') + '>' +
        (onlyStatus ? 'שומרים' : esc((op && op.cta) || 'יאללה, מתחילים')) + '</button></div>';
  }

  function setStatus(v, source) {
    var changed = S.status !== v;
    S.status = v;
    S.startUnit = (CFG.startUnit && CFG.startUnit[v] != null) ? CFG.startUnit[v] : null;
    indexContent();
    if (S.inProgress && !shown(BY_ID[S.inProgress.lessonId])) S.inProgress = null;
    save();
    if (changed) track('status_set', { status: v, start_unit_id: S.startUnit, source: source || 'profile', $set: { status: v, start_unit_id: S.startUnit } });
  }

  // ---------- Confetti ----------
  function confetti(big) {
    if (reducedMotion()) return;
    var c = document.createElement('canvas');
    c.className = 'confetti';
    document.body.appendChild(c);
    var ctx = c.getContext('2d'), dpr = window.devicePixelRatio || 1;
    c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.scale(dpr, dpr);
    var cs = getComputedStyle(document.documentElement);
    var colors = ['--gold', '--brand', '--ok', '--flame', '--q-violet', '--q-blue'].map(function (v) { return cs.getPropertyValue(v).trim() || '#F2B630'; });
    var parts = [], n = big ? 170 : 100;
    for (var i = 0; i < n; i++) {
      parts.push({ x: innerWidth / 2 + (big ? (Math.random() - 0.5) * innerWidth * 0.6 : 0), y: innerHeight * 0.3, vx: (Math.random() - 0.5) * (big ? 14 : 11), vy: -Math.random() * 12 - 3,
        r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, w: 6 + Math.random() * 6, h: 4 + Math.random() * 4, c: colors[i % colors.length] });
    }
    var t0 = performance.now();
    (function frame(t) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      parts.forEach(function (p) {
        p.vy += 0.32; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      });
      if (t - t0 < 2400) requestAnimationFrame(frame); else c.remove();
    })(t0);
  }

  // ---------- Daily reminder (Web Push) ----------
  // The phone subscribes with the public key from config, and the subscription is recorded as a PostHog event.
  // tools/send-reminders.js (run every day by GitHub Actions) reads those events and pushes a short message to
  // everyone who has not finished a lesson today. iPhones get notifications only from the installed app.
  var RCFG = CFG.reminders || {};
  function hourLabel() { return (RCFG.hour < 10 ? '0' : '') + RCFG.hour + ':00'; }
  function pushSupported() {
    return !!(RCFG.enabled && RCFG.vapidPublicKey && !IN_FRAME && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
  }
  // 'on' | 'off' | 'install' (iPhone outside the installed app) | 'denied' (blocked in the browser) | 'unsupported'
  function pushState() {
    if (S.reminder && S.reminder.on) return 'on';
    if (!RCFG.enabled || !RCFG.vapidPublicKey || IN_FRAME) return 'unsupported';
    if (IS_IOS && !isStandalone()) return 'install';
    if (!pushSupported()) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    return 'off';
  }
  function keyBytes(s) {
    var b64 = (s + '===').slice(0, s.length + (4 - s.length % 4) % 4).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(b64), out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function askNotify() {
    return new Promise(function (resolve) {
      var done = false;
      function fin(r) { if (!done) { done = true; resolve(r || 'default'); } }
      try {
        var p = Notification.requestPermission(fin);
        if (p && p.then) p.then(fin);
      } catch (e) { fin('denied'); }
    });
  }
  function swReady() {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error('no service worker')); }, 8000);
      navigator.serviceWorker.ready.then(function (reg) { clearTimeout(t); resolve(reg); }, function (e) { clearTimeout(t); reject(e); });
    });
  }
  function subscribePush(reg) {
    return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(RCFG.vapidPublicKey) });
  }
  // a tiny key-value store the service worker can read too (localStorage is out of its reach)
  function metaPut(k, v) {
    try {
      if (window.caches) caches.open('dribit-meta').then(function (c) { return c.put('./meta/' + k, new Response(String(v))); }).catch(function () { /* ignore */ });
    } catch (e) { /* ignore */ }
  }
  function saveSubscription(sub, from) {
    var j = (sub.toJSON && sub.toJSON()) || { endpoint: sub.endpoint }, keys = j.keys || {};
    S.reminder = { on: true, endpoint: j.endpoint, hour: RCFG.hour, since: dayKey() };
    S.reminderNo = null;
    save();
    notifNo(null);
    metaPut('uid', S.uid);
    track('push_subscribed', { endpoint: j.endpoint, p256dh: keys.p256dh, auth: keys.auth, hour: RCFG.hour, from: from, $set: { reminders: true } });
    flush();
  }
  // withShare: the profile switch also turns usage-data sharing on (the sender finds subscriptions there), but only
  // once the reminder is actually on
  function enableReminder(from, withShare) {
    var st = pushState();
    if (st === 'install') { installSheet(); return; }
    if (st === 'denied') { toast(ICON.bell + '<b>ההתראות חסומות.</b> מאפשרים אותן בהגדרות הדפדפן', '', 2600); return; }
    if (st !== 'off' || pushBusy) return;
    pushBusy = true;
    clearTimeout(askTimer);
    track('push_asked', { from: from });
    askNotify().then(function (perm) {
      if (perm !== 'granted') { track('push_denied', { from: from, permission: perm }); throw { quiet: perm }; }
      return swReady();
    }).then(subscribePush).then(function (sub) {
      pushBusy = false;
      if (withShare && !S.share) { S.share = true; save(); track('analytics_on', { from: from === 'popup' ? 'popup' : 'reminder' }); }
      saveSubscription(sub, from);
      render();
      toast(ICON.bell + '<b>סגור.</b> תזכורת כל ערב, החל מ-' + hourLabel(), 'info', 2600);
      reloadAfterPush();
    }).catch(function (e) {
      pushBusy = false;
      reloadAfterPush();
      if (e && e.quiet) {
        render();
        if (e.quiet === 'denied') toast(ICON.bell + '<b>ההתראות חסומות.</b> אפשר לאפשר אותן בהגדרות', '', 2600);
        return;
      }
      track('push_failed', { from: from, error: String((e && e.name) || e).slice(0, 60) });
      toast(ICON.bell + '<b>לא הצלחתי להפעיל תזכורת</b> בדפדפן הזה', '', 2600);
    });
  }
  // a new version that arrived while the reminder was being turned on loads once the answer has been on screen a moment
  function reloadAfterPush() {
    if (!pendingReload) return;
    setTimeout(function () { if (pendingReload && !pushBusy && view === 'home' && !sheetOpen) reloadForUpdate(); }, 2800);
  }
  function disableReminder(reason) {
    if (reason === 'user' || reason === 'analytics_off') notifNo('off'); // someone who turned it off is not asked again
    var endpoint = S.reminder && S.reminder.endpoint;
    S.reminder = null;
    save();
    track('push_unsubscribed', { endpoint: endpoint, reason: reason, $set: { reminders: false } });
    flush();
    if (!pushSupported()) return;
    swReady().then(function (reg) { return reg.pushManager.getSubscription(); })
      .then(function (sub) { if (sub) return sub.unsubscribe(); })
      .catch(function () { /* the sender drops the subscription on its first failed push */ });
  }
  // on open: keep the saved subscription in step with the browser (renewed endpoint, permission taken away)
  function syncPush() {
    if (!S.reminder || !S.reminder.on || !pushSupported()) return;
    if (Notification.permission !== 'granted') { disableReminder('permission'); return; }
    swReady().then(function (reg) {
      return reg.pushManager.getSubscription().then(function (sub) { return sub || subscribePush(reg); });
    }).then(function (sub) {
      if (sub.endpoint !== S.reminder.endpoint) saveSubscription(sub, 'renew'); else metaPut('uid', S.uid);
    }).catch(function () { /* keep the saved state */ });
  }
  // Two popups over home (Jonathan, 18.10 and 19.10), at most one per open (a fresh load, or a return after
  // OPEN_AWAY_MS away), a moment after home appears and after the last touch (so it does not slide up under a finger):
  // 1. "add to the home screen": on a phone, outside the installed app, at every open, until the app runs from the
  //    home screen. On iPhone it also unlocks notifications, so it comes first.
  // 2. "turn on notifications": at every open while they are off, after the first finished lesson, except for people
  //    who turned the reminder or usage sharing off themselves, and when the browser blocks notifications.
  var NOTIF_NO_KEY = 'dribit.notifNo.v1', ASKS_KEY = 'dribit.asks.v1';
  function notifRefused() { try { return !!localStorage.getItem(NOTIF_NO_KEY); } catch (e) { return true; } }
  function notifNo(why) { try { if (why) localStorage.setItem(NOTIF_NO_KEY, dayKey() + ' ' + why); else localStorage.removeItem(NOTIF_NO_KEY); } catch (e) { /* ignore */ } }
  function notifNoWhy() { try { return (localStorage.getItem(NOTIF_NO_KEY) || '').split(' ')[1] || ''; } catch (e) { return ''; } }
  function askCount(kind) {
    var c = {};
    try { c = JSON.parse(localStorage.getItem(ASKS_KEY) || '{}') || {}; } catch (e) { c = {}; }
    c[kind] = (+c[kind] || 0) + 1;
    try { localStorage.setItem(ASKS_KEY, JSON.stringify(c)); } catch (e) { /* ignore */ }
    return c[kind];
  }
  // a popup (or another sheet that owns this open) already showed. A reload the app makes for a new version is the
  // same open, so it keeps the flag (otherwise someone who just saw a popup would see one again right after it).
  var openAsked = (function () {
    try {
      var a = sessionStorage.getItem('dribit.asked');
      sessionStorage.removeItem('dribit.asked');
      return RELOAD_KIND === 'update' && a === '1';
    } catch (e) { return false; }
  })();
  function newOpen() { openAsked = false; }
  // stage 'welcome' (0.9.7, from the 15-20.10 data): a new person on a phone browser taps "יאללה, מתחילים" and is asked
  // first, before the status pick, while there is no progress to lose (on iPhone the home-screen app starts from zero).
  // stage 'home' (the default): the popup at every open, over home.
  function installAskState(stage) {
    if (!INSTALL.askEveryOpen || !canInstall() || !(IS_IOS || IS_ANDROID) || pushBusy) return null;
    if (stage === 'welcome') { if (!INSTALL.askBeforeStart || S.onboarded || hasProgress()) return null; }
    else if (!S.onboarded || !S.status) return null;
    if (IS_ANDROID && S.installSeen) return null; // Android shares storage with the installed app: it is on this phone
    if (IS_IOS && S.giftPending) return null;     // a friend's gift waits for lesson 1 here (installing now would lose it)
    return IS_IOS ? 'ios' : deferredInstall ? 'prompt' : 'steps';
  }
  function notifAskState() {
    if (!RCFG.askEveryOpen || !S.onboarded || !S.status || !doneCount() || pushBusy || notifRefused()) return null;
    var st = pushState();
    if (st === 'off') return 'off';
    return st === 'install' && !INSTALL.askEveryOpen ? 'install' : null; // iPhone in Safari: the install popup asks instead
  }
  var askTimer = null, lastTouchAt = 0, askOpenedAt = 0;
  function maybeAsk() {
    clearTimeout(askTimer);
    if (openAsked || view !== 'home' || sheetOpen || !(installAskState() || notifAskState())) return;
    askTimer = setTimeout(function tick() {
      var quiet = Date.now() - lastTouchAt;
      if (quiet < 700) { askTimer = setTimeout(tick, 700 - quiet); return; }
      if (openAsked || view !== 'home' || sheetOpen || document.visibilityState === 'hidden') return;
      if (installAskState()) installAskSheet(); else if (notifAskState()) notifAskSheet();
    }, 700);
  }
  function installAskSheet(stage) {
    stage = stage === 'welcome' ? 'welcome' : 'home';
    var st = installAskState(stage);
    if (!st) return;
    openAsked = true;
    track('install_popup_shown', { variant: st, n: askCount('install'), lessons_done: doneCount(), stage: stage });
    askOpenedAt = Date.now();
    var name = esc(CFG.appName), welcome = stage === 'welcome', tag = '" data-variant="' + st + '" data-stage="' + stage + '"';
    // welcome: compact (no icon, a short iPhone line) so both buttons fit on a small iPhone without scrolling
    openSheet((welcome ? '<div class="eyebrow">לפני שמתחילים</div>' : '<div class="ask-ic">' + ICON.addHome + '</div>') +
      '<h3>להוסיף את ' + name + ' למסך הבית</h3>' +
      '<p class="lead">' + (welcome && IS_IOS
        ? 'באייפון מה שעושים בספארי לא עובר לאפליקציה שבמסך הבית, אז כדאי להוסיף עכשיו ולהתחיל ישר משם.'
        : 'ככה ' + name + ' נפתחת מהאייקון, במסך מלא, כמו כל אפליקציה' + (RCFG.enabled ? ', ושולחת תזכורת יומית ששומרת על הרצף' : '') + '.') + '</p>' +
      (st === 'prompt' ? '<button class="btn gold" data-act="install-popup-go' + tag + '>להוסיף למסך הבית</button>'
        : installAskBody() + '<button class="btn gold" data-act="install-popup-go' + tag + '>מוסיפים עכשיו</button>') +
      '<button class="btn text" data-act="install-popup-later' + tag + '>' + (welcome ? 'להמשיך בדפדפן' : 'אחר כך') + '</button>' +
      (IS_IOS && !welcome ? '<p class="fine center">כבר במסך הבית? פותחים את ' + name + ' משם.</p>' : ''), welcome ? 'ask-welcome' : '');
  }
  // the status pick, the second welcome screen ("יאללה, מתחילים", or "להמשיך בדפדפן" in the install popup, which
  // passes viaSheet: the step takes the popup's history entry, so back returns to the first screen)
  function toStatusPick(viaSheet) {
    onboardStep = 1;
    if (viaSheet && topIsSheet) { closeSheet(true); topIsSheet = false; histReplace({ onboard: 1 }); }
    else { closeSheet(); histPush({ onboard: 1 }); }
    render(); window.scrollTo(0, 0);
  }
  // the popup's short version of the install steps (it shows at every open, so the buttons stay in sight)
  function installAskBody() {
    var name = esc(CFG.appName);
    var steps = IS_IOS
      ? ['לוחצים על כפתור השיתוף ' + ICON.share + ' בתחתית ספארי.',
         'בוחרים "הוספה למסך הבית" ' + ICON.addHome + ' ולוחצים "הוספה".',
         'מעכשיו פותחים את ' + name + ' רק מהאייקון.']
      : ['לוחצים על ' + ICON.dots + ' בפינה של כרום.',
         'בוחרים "התקנת אפליקציה" או "הוספה למסך הבית", ומאשרים.',
         'מעכשיו פותחים את ' + name + ' מהאייקון.'];
    // iPhone: the home-screen app starts with its own empty storage, so progress made here travels by code
    var code = IS_IOS && hasProgress()
      ? '<div class="transfer-box"><p><b>ההתקדמות לא עוברת לבד.</b> מעתיקים את קוד ההעברה, ובאפליקציה שבמסך הבית מדביקים אותו ב"יש לי קוד העברה".</p>' +
        '<div class="row"><button class="btn ghost" data-act="export" data-method="copy" data-placement="popup">להעתיק קוד</button>' +
        (navigator.share ? '<button class="btn ghost" data-act="export" data-method="share" data-placement="popup">לשלוח לעצמי</button>' : '') + '</div></div>'
      : '';
    return '<ol class="install-steps">' + steps.map(function (t, i) { return '<li><span class="num-badge">' + (i + 1) + '</span><span>' + t + '</span></li>'; }).join('') + '</ol>' + code +
      '<p class="fine">נפתח בתוך וואטסאפ, אינסטגרם או טיקטוק? פותחים קודם את הקישור ב' + (IS_IOS ? 'ספארי' : 'כרום') + '.</p>';
  }
  function notifAskSheet() {
    var st = notifAskState();
    if (!st) return;
    openAsked = true;
    // counts as one "not now" of the home reminder card, so the same ask does not wait under the popup
    // (turning the reminder on clears it)
    S.reminderNo = { count: ((S.reminderNo && S.reminderNo.count) || 0) + 1, day: dayKey() };
    save();
    if (root.querySelector('.reminder-card')) render();
    track('push_popup_shown', { state: st, n: askCount('notif'), lessons_done: doneCount() });
    askOpenedAt = Date.now();
    openSheet('<div class="ask-ic">' + ICON.bell + '</div>' + (st === 'install'
      ? '<h3>תזכורת יומית באייפון</h3><p class="lead">באייפון התראות עובדות רק מהאפליקציה שבמסך הבית. מוסיפים אותה פעם אחת, ושם מדליקים תזכורת.</p>' +
        '<button class="btn gold" data-act="install" data-placement="popup">איך מתקינים</button>'
      : '<h3>להדליק התראות?</h3><p class="lead">הודעה קצרה אחת בערב, רק בימים שעוד לא עשית שיעור. ככה הרצף לא נשבר.</p>' +
        (S.share ? '' : '<p class="fine">התזכורת עובדת דרך נתוני השימוש, ולכן הדלקה שלה מדליקה גם את שיתוף נתוני השימוש האנונימיים.</p>') +
        '<button class="btn gold" data-act="popup-reminder-on">להדליק התראות</button>') +
      '<button class="btn text" data-act="popup-later">לא עכשיו</button><p class="fine center">אפשר לשנות בכל רגע בפרופיל.</p>');
  }

  // the home card: after the first finished lesson, until it is turned on or declined twice (a week apart)
  function reminderCardState() {
    if (!doneCount() || !S.share) return null;
    var st = pushState();
    if (st !== 'off' && !(st === 'install' && S.installHidden)) return null;
    var no = S.reminderNo;
    if (no && (no.count >= 2 || daysBetween(no.day, dayKey()) < 7)) return null;
    return st;
  }
  function reminderRow() {
    var st = pushState();
    if (st === 'unsupported') return '';
    var daily = 'הודעה אחת בערב, החל מ-' + hourLabel() + ', רק אם עוד לא עשית שיעור באותו יום.';
    var note = st === 'install' ? 'באייפון זה עובד רק מהאפליקציה המותקנת במסך הבית.'
      : st === 'denied' ? 'ההתראות חסומות. מאפשרים אותן בהגדרות הדפדפן או הטלפון ופותחים שוב.'
      : (st === 'off' && !S.share) ? daily + ' התזכורת עובדת דרך נתוני השימוש, ולכן הדלקה שלה מדליקה גם את שיתוף נתוני השימוש האנונימיים.'
      : daily;
    var ctrl = (st === 'on' || st === 'off')
      ? '<button class="switch" role="switch" aria-labelledby="rem-l" aria-checked="' + (st === 'on') + '" data-act="reminder-toggle"></button>' : '';
    return '<div class="card"><div class="toggle-row"><h2 id="rem-l">תזכורת יומית</h2>' + ctrl + '</div><p class="fine">' + note + '</p>' +
      (st === 'install' ? '<button class="btn ghost" data-act="install" data-placement="profile">איך מתקינים</button>' : '') + '</div>';
  }

  // ---------- Install and updates ----------
  function installFlow(placement) {
    track('install_clicked', { method: deferredInstall ? 'prompt' : IS_IOS ? 'ios_steps' : 'steps', placement: placement, lessons_done: doneCount() });
    if (deferredInstall) {
      var p = deferredInstall;
      deferredInstall = null;
      p.prompt();
      if (p.userChoice) p.userChoice.then(function (c) { track('install_choice', { outcome: c.outcome }); render(); });
      return;
    }
    installSheet();
  }

  // ---------- Invite friends (config.invite) ----------
  var INVITE = CFG.invite || { enabled: false };
  if (INVITE.afterLessons == null) INVITE.afterLessons = 2;
  function inviteUrl() {
    var base = String(INVITE.url || '').trim() || (location.origin + location.pathname);
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + 'ref=share';
  }
  // the day off for sharing the link: once every inviteEveryDays days, and only while fewer than maxHeld are held
  function inviteOffState() {
    if (!DO.enabled || !DO.invite) return { on: false, ready: false, wait: 0, full: false };
    var wait = 0;
    if (S.inviteOffDay) {
      var since = daysBetween(S.inviteOffDay, dayKey());
      wait = since < 0 ? 0 : Math.max(0, DO.inviteEveryDays - since);
    }
    var full = S.daysOff >= DO.maxHeld;
    return { on: true, wait: wait, full: full, ready: !wait && !full };
  }
  // called when the share sheet finished or the WhatsApp link opened (never on cancel). It rewards sharing the link,
  // not a friend joining: the app cannot know that.
  function grantInviteOff(method) {
    var o = inviteOffState();
    if (!o.on) {
      if (method === 'native') toast(ICON.check + '<b>תודה!</b><span>ללמוד ביחד מחזיק יותר</span>', 'info', 2600);
      return;
    }
    var reason = o.wait ? 'weekly_cap' : o.full ? 'max_held' : 'ok';
    if (reason === 'ok') {
      S.daysOff = Math.min(DO.maxHeld, S.daysOff + DO.invite);
      S.inviteOffDay = dayKey();
      save();
      track('day_off_earned', { source: 'invite', added: DO.invite, held: S.daysOff, at_cap: false });
    }
    track('invite_reward', { given: reason === 'ok', reason: reason, method: method, held: S.daysOff });
    toast(ICON.dayoff + (reason === 'ok'
      ? '<b>נוסף לך יום חופש לרצף</b><span>על שיתוף הקישור. יש לך עכשיו ' + S.daysOff + '.</span>'
      : reason === 'weekly_cap'
        ? '<b>תודה ששיתפת!</b><span>יום חופש לרצף על שיתוף מקבלים פעם בשבוע. הבא ' + (o.wait === 1 ? 'מחר' : 'בעוד ' + o.wait + ' ימים') + '.</span>'
        : '<b>תודה ששיתפת!</b><span>יש לך כבר ' + DO.maxHeld + ' ימי חופש לרצף, המקסימום.</span>'), 'info', 4000);
    // the done screen is not redrawn (its count-up would start again): only its invite note changes
    if ((view === 'profile' || view === 'home') && !sheetOpen) render();
    else if (view === 'done' && root) { var note = root.querySelector('.invite-note'); if (note) note.outerHTML = inviteNote(); }
  }
  function inviteNote() {
    var io = inviteOffState();
    if (!io.on) return '';
    return '<p class="fine invite-note">' + (DO.friendGift ? 'חבר חדש שמתחיל מהקישור מקבל ' + DO.friendGift + ' ימי חופש לרצף אחרי השיעור הראשון.' : '') +
      (io.ready ? ' ולך: יום חופש לרצף על השיתוף.' : io.full ? '' : ' יום החופש הבא שלך על שיתוף: ' + (io.wait === 1 ? 'מחר.' : 'בעוד ' + io.wait + ' ימים.')) + '</p>';
  }
  // the last 7 days as 🔥 (learned), ⛱️ (day off) and ⚪, oldest first; it ends yesterday until something is learned today
  function weekGrid() {
    var end = todayXp() > 0 ? 0 : 1, out = '', any = false;
    for (var i = 6 + end; i >= end; i--) {
      var k = dayKey(addDays(new Date(), -i));
      if ((S.days[k] || 0) > 0) { out += '\uD83D\uDD25'; any = true; }
      else if (S.offUsed.indexOf(k) >= 0) out += '\u26F1\uFE0F';
      else out += '\u26AA';
    }
    return any ? out : '';
  }
  // the message, without the link (the link is added by the share sheet, or after the text in WhatsApp)
  function inviteText(from, lesson) {
    var st = currentStreak(), done = doneCount(), name = CFG.appName;
    var lines = [];
    if (from === 'done' && lesson) {
      lines.push('סיימתי עכשיו את השיעור "' + lesson.title + '" ב' + name + '.' + (st > 1 ? ' רצף של ' + st + ' ימים.' : ''));
      lines.push('כמה דקות ביום על כסף, בעברית, בלי חישובים.');
    } else {
      lines.push('סיימתי ' + plural(done, 'שיעור אחד', 'שיעורים') + ' ב' + name + (st > 1 ? ' ואני ברצף של ' + st + ' ימים' : '') + '.');
      lines.push(S.status === 'civ'
        ? 'שיעור קצר ביום על כסף: איך כסף גדל, להבין את השוק, משכורת ראשונה. בלי חישובים.'
        : 'שיעור קצר ביום על כסף: איך כסף גדל, מה עושים עם הכסף מהצבא, משכורת ראשונה. בלי חישובים.');
    }
    var grid = weekGrid();
    if (grid) lines.splice(1, 0, 'השבוע שלי: ' + grid + (grid.indexOf('\u26F1') >= 0 ? ' (\u26F1\uFE0F יום חופש לרצף)' : ''));
    if (DO.enabled && DO.friendGift) lines.push('מתחילים מהקישור? מקבלים ' + DO.friendGift + ' ימי חופש לרצף אחרי השיעור הראשון.');
    lines.push('באייפון: פותחים את הקישור בספארי, עושים את השיעור הראשון, ורק אז מוסיפים למסך הבית.');
    lines.push('בואו ללמוד ביחד:');
    return lines.join('\n');
  }
  function roundBox(x, l, t, w, h, r) {
    x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r);
    x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
  }
  // a square picture for the share sheet, drawn at once (the share must start inside the tap): streak or lessons,
  // the app name and the address. Fixed light colors (the share sheet has no theme), rtl text, no emoji. null = no picture.
  function inviteImage() {
    if (!INVITE.image || typeof File !== 'function') return null;
    try {
      var W = 1080, c = document.createElement('canvas'); c.width = W; c.height = W;
      var x = c.getContext('2d');
      if (!x) return null;
      var display = (document.fonts && document.fonts.check && document.fonts.check('600 40px Fredoka')) ? 'Fredoka, Assistant, system-ui, sans-serif' : 'Assistant, system-ui, sans-serif';
      var body = 'Assistant, system-ui, sans-serif';
      var st = currentStreak(), done = doneCount(), total = LESSONS.length;
      var big = st > 0 ? st : done, label = st > 0 ? 'ימים ברצף' : (done === 1 ? 'שיעור ראשון' : 'שיעורים');
      var sub = st > 0 ? done + ' מתוך ' + total + ' שיעורים' : 'מתוך ' + total + ' שיעורים בקורס';
      x.fillStyle = '#0E6E58'; x.fillRect(0, 0, W, W);
      x.fillStyle = '#F2F6F1'; roundBox(x, 64, 64, W - 128, W - 128, 56); x.fill();
      x.direction = 'rtl'; x.textAlign = 'right'; x.textBaseline = 'alphabetic';
      x.fillStyle = '#0E6E58'; x.font = '600 84px ' + display; x.fillText(CFG.appName, W - 140, 220);
      x.fillStyle = '#12302A'; x.font = '600 38px ' + body; x.fillText(CFG.tagline, W - 140, 290);
      x.direction = 'ltr'; x.textAlign = 'center';
      x.fillStyle = '#F2B630'; x.font = '600 300px ' + display; x.fillText(String(big), W / 2, 640);
      x.direction = 'rtl';
      x.fillStyle = '#12302A'; x.font = '700 64px ' + body; x.fillText(label, W / 2, 730);
      x.fillStyle = '#4E655E'; x.font = '600 42px ' + body; x.fillText(sub, W / 2, 800);
      x.direction = 'ltr'; x.fillStyle = '#0E6E58'; x.font = '700 40px ' + body;
      x.fillText(String(INVITE.url || location.host + location.pathname).replace(/^https?:\/\//, '').replace(/\/$/, ''), W / 2, 905);
      x.direction = 'rtl'; x.fillStyle = '#7A8E87'; x.font = '400 30px ' + body; x.fillText(CFG.disclaimer, W / 2, 965);
      var data = c.toDataURL('image/png').split(',')[1];
      if (!data) return null;
      var raw = atob(data), u8 = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i);
      return new File([u8], 'dribit.png', { type: 'image/png' });
    } catch (e) { return null; }
  }
  function waInvite(text, url) {
    var full = text + '\n' + url, w = null;
    markStepOut();
    try { w = window.open('https://wa.me/?text=' + encodeURIComponent(full), '_blank', 'noopener'); } catch (e) { w = null; }
    // with noopener some browsers return null even when the window opened, so only a thrown error counts as blocked
    return w !== false;
  }
  var sharing = false, sharingAt = 0;
  function invite(from, lessonId) {
    if (sharing && Date.now() - sharingAt < 4000) return;
    var l = lessonId && BY_ID[lessonId], url = inviteUrl(), text = inviteText(from, l);
    var file = null, data = { title: CFG.appName, text: text, url: url };
    try {
      if (navigator.share && navigator.canShare) {
        file = inviteImage();
        // with a picture, the link travels inside the text (some apps drop the url field when files are attached)
        if (file && navigator.canShare({ files: [file] })) data = { title: CFG.appName, text: text + '\n' + url, files: [file] }; else file = null;
      }
    } catch (e) { file = null; }
    var method = navigator.share ? 'native' : 'wa_link';
    var props = { from: from, method: method, with_image: !!file, lesson_id: l ? l.id : null, streak: currentStreak(), lessons_done: doneCount(), level: levelInfo(S.xp).n,
      days_off_held: S.daysOff, reward_ready: inviteOffState().ready };
    track('share_clicked', props);
    if (method === 'native' && sharing) {
      // the last share never finished: no second share sheet (it would fail), WhatsApp instead
      sharing = false;
      track('share_failed', { from: from, error: 'stuck', with_image: !!file });
      waInvite(text, url);
      grantInviteOff('wa_link');
      return;
    }
    if (method === 'native') {
      var p;
      sharing = true; sharingAt = Date.now();
      markStepOut();
      try { p = navigator.share(data); } catch (e) { p = Promise.reject(e); }
      p.then(function () {
        sharing = false;
        track('share_completed', props);
        grantInviteOff('native');
        flush();
      }, function (e) {
        sharing = false;
        // cancelled, or a share sheet already open: no WhatsApp fallback and no reward
        if (e && (e.name === 'AbortError' || e.name === 'InvalidStateError')) { stepOutAt = 0; return; }
        track('share_failed', { from: from, error: String((e && e.name) || e).slice(0, 60), with_image: !!file });
        waInvite(text, url);
        grantInviteOff('wa_link');
      });
      return;
    }
    waInvite(text, url);
    grantInviteOff('wa_link');
  }

  // ---------- Discharge calculator (config.calculator) ----------
  // An estimate of the personal deposit (pikadon) and the release grant from the service type and the months served.
  // The amounts per month live in config; the app never sends an amount to analytics, only bands.
  var CALC = CFG.calculator || { enabled: false };
  function calcEnabled() { return !!(CALC.enabled && CALC.tiers && CALC.tiers.length); }
  function calcTier(id) { return (CALC.tiers || []).filter(function (t) { return t.id === id; })[0] || null; }
  function calcMonths() { return CALC.months || { presets: [24, 32], min: 12, max: 32, default: 32 }; }
  // S.calc can come from a transfer code, so every field is rebuilt from a known shape before it reaches the page
  function calcState() {
    var M = calcMonths(), c = S.calc && typeof S.calc === 'object' ? S.calc : {};
    var months = Math.min(M.max, Math.max(M.min, Math.round(+c.months) || M.default));
    return { type: typeof c.type === 'string' && calcTier(c.type) ? c.type : null, months: months,
      // until the person changes it, training is the usual count for the type (4 combat, 2 support)
      training: c.trainingEdited === true ? Math.min(months, Math.max(0, Math.round(+c.training) || 0)) : Math.min(months, calcTrainingDefault(c.type)),
      trainingEdited: c.trainingEdited === true, lone: c.lone === true, at: +c.at || 0 };
  }
  // the usual training months for a service type (config.calculator.trainingDefault); a person can change them
  function calcTrainingDefault(type) { return Math.max(0, Math.round(+((CALC.trainingDefault || {})[type]) || 0)); }
  function calcHasTraining(type) { var t = calcTier(type), low = t && calcTier((CALC.trainingTier || {})[t.id]); return !!(t && low && low.id !== t.id); }
  // training months count at the lower tier (trainingTier); both sums are rounded to roundTo
  function calcEstimate(c) {
    var tier = c && calcTier(c.type);
    if (!tier) return null;
    var M = calcMonths(), m = Math.min(M.max, Math.max(M.min, Math.round(+c.months || M.default)));
    var tr = Math.min(m, Math.max(0, Math.round(+c.training || 0)));
    var low = calcTier((CALC.trainingTier || {})[tier.id]) || tier;
    if (low === tier) tr = 0;
    var pk = (m - tr) * tier.pikadon + tr * low.pikadon, gr = (m - tr) * tier.grant + tr * low.grant;
    if (c.lone && CALC.loneSoldier) { pk += m * (+CALC.loneSoldier.pikadon || 0); gr += m * (+CALC.loneSoldier.grant || 0); }
    var r = CALC.roundTo || 1;
    pk = Math.round(pk / r) * r; gr = Math.round(gr / r) * r;
    return { pikadon: pk, grant: gr, total: pk + gr, months: m, training: tr };
  }
  function calcBand(v) {
    var B = CALC.bands || [];
    for (var i = 0; i < B.length; i++) if (v < B[i]) return (i ? Math.round(B[i - 1] / 1000) : 0) + '-' + Math.round(B[i] / 1000) + 'k';
    return B.length ? Math.round(B[B.length - 1] / 1000) + 'k+' : 'all';
  }
  function monthsBand(m) { return m < 12 ? '<12' : m < 24 ? '12-23' : '24-32'; }
  function money(v) { return 'כ-' + ltr(fmt(v) + ' ₪'); }
  function calcWidget(ctx, moreOpen) {
    var c = calcState(), M = calcMonths(), est = calcEstimate(c);
    var tiers = (CALC.tiers || []).map(function (t) {
      return '<button data-act="calc-type" data-v="' + esc(t.id) + '" aria-pressed="' + (c.type === t.id) + '">' + esc(t.label) + (t.note ? '<small>' + esc(t.note) + '</small>' : '') + '</button>';
    }).join('');
    var notes = M.presetNotes || {};
    var presets = (M.presets || []).map(function (p) {
      return '<button class="chip-btn" data-act="calc-months-set" data-v="' + p + '" aria-pressed="' + (c.months === p) + '">' + p + ' חודשים' +
        (notes[p] ? '<small>' + esc(notes[p]) + '</small>' : '') + '</button>';
    }).join('');
    var tier = calcTier(c.type), low = tier && calcTier((CALC.trainingTier || {})[tier.id]);
    var stepper = function (act, val, min, max, small) {
      return '<div class="stepper' + (small ? ' small' : '') + '"><button data-act="' + act + '" data-d="-1" aria-label="פחות"' + (val <= min ? ' disabled' : '') + '>&minus;</button>' +
        '<b>' + val + '</b><button data-act="' + act + '" data-d="1" aria-label="עוד"' + (val >= max ? ' disabled' : '') + '>+</button></div>';
    };
    var result = est
      ? '<div class="calc-result">' +
          '<div class="calc-row"><span>פיקדון אישי</span><b>' + money(est.pikadon) + '</b><small>נעול לשש מטרות בחמש השנים הראשונות, מהיום ה-14 אחרי השחרור</small></div>' +
          '<div class="calc-row"><span>מענק שחרור</span><b>' + money(est.grant) + '</b><small>נכנס לחשבון הבנק עד 60 יום מהשחרור, לכל מטרה</small></div>' +
          '<div class="calc-row total"><span>ביחד</span><b>' + money(est.total) + '</b></div></div>'
      : '<div class="calc-result empty"><p>בוחרים סוג שירות, והסכומים יופיעו כאן.</p></div>';
    return '<div class="calc" data-ctx="' + esc(ctx) + '">' +
      '<div class="calc-field"><span class="eyebrow">סוג השירות</span><div class="seg">' + tiers + '</div></div>' +
      '<div class="calc-field"><span class="eyebrow">חודשי שירות</span>' + stepper('calc-months', c.months, M.min, M.max) + '<div class="chips">' + presets + '</div></div>' +
      (calcHasTraining(c.type) || CALC.loneSoldier
        ? '<details class="calc-more"' + (moreOpen ? ' open' : '') + '><summary>חודשי טירונות והכשרה: ' + (c.training || 0) + '</summary>' +
          (calcHasTraining(c.type)
            ? '<p class="fine">חודשי ההכשרה נספרים בדרך כלל בסוג נמוך יותר: ' + esc(tier.label) + ' מקבל/ת עליהם כמו ' + esc(low.label) + '. כבר הכנסנו את המספר הרגיל, ' +
                calcTrainingDefault(c.type) + ' חודשים, ואפשר לשנות.</p>' + stepper('calc-training', c.training || 0, 0, c.months, true)
            : '') +
          (CALC.loneSoldier ? '<label class="calc-check"><input type="checkbox" data-act="calc-lone"' + (c.lone ? ' checked' : '') + '><span>' + esc(CALC.loneSoldier.label || 'חייל/ת בודד/ה') + '</span></label>' : '') +
          '</details>'
        : '') + result +
      '<p class="fine">הערכה לפי הסכומים של משרד הביטחון לחודש שירות, נכון ל' + esc(CALC.asOf || '') + ' (נבדקו ב-' + esc(CALC.checked || '') + '). ' +
        'צריך לפחות ' + M.min + ' חודשי שירות, ונספרים עד ' + M.max + ' חודשים לחייל ועד 24 לחיילת. במסלולי הביניים והמפוצל של שירות לאומי-אזרחי הסכומים נמוכים יותר. ' +
        'הסכומים צמודים למדד. גם המחשבון הרשמי נותן הערכה, והסכום המדויק מופיע באזור האישי באתר האגף.</p>' +
      (CALC.officialUrl ? '<a class="btn ghost" href="' + esc(CALC.officialUrl) + '" target="_blank" rel="noopener" data-act="calc-official">למחשבון הרשמי</a>' : '') +
      (ctx === 'sheet' ? '<button class="btn" data-act="close-sheet">סגירה</button>' : '') + '</div>';
  }
  // the profile card (on home until 0.9.2; moved by Jonathan, 18.10): for soldiers, after the pikadon lesson; shows the last estimate
  function calcCard() {
    if (!calcEnabled() || (S.status !== 'sadir' && S.status !== 'pre') || !isDone('2.1')) return '';
    var est = calcEstimate(S.calc && calcState());
    return '<div class="card calc-card"><div class="rc-head"><span class="rc-ic">' + ICON.coins + '</span><div><b>כמה יהיה לך בשחרור?</b><span>' +
      (est ? 'ההערכה שלך: ' + money(est.pikadon) + ' פיקדון + ' + money(est.grant) + ' מענק' : 'פיקדון ומענק לפי סוג השירות והחודשים. האפליקציה מחשבת, לא אתם.') + '</span></div></div>' +
      (est ? '<p class="fine">לפי הסכומים ל' + esc(CALC.asOf || '') + '. הערכה בלבד.</p>' : '') +
      '<button class="btn' + (est ? ' ghost' : '') + '" data-act="calc-open" data-from="profile">' + (est ? 'לעדכן' : 'לחשב') + '</button></div>';
  }
  function calcSheetInner() {
    return '<h3>כמה יהיה לך בשחרור?</h3><p class="lead">פיקדון ומענק משוערים לפי סוג השירות והחודשים. האפליקציה מחשבת, לא אתם.</p>' + calcWidget('sheet');
  }
  function calcSheet(from) {
    if (!calcEnabled()) return;
    track('calculator_opened', { from: from || view, has_estimate: !!(S.calc && S.calc.type) });
    openSheet(calcSheetInner(), 'tall');
  }
  // an input change redraws the widget in place (sheet or lesson screen) and, 2.5 seconds after the last change, records one calculator_used
  var calcTimer = null, calcCtx = 'sheet';
  function calcRefresh() {
    var el = document.querySelector('#sheet .calc') || (root && root.querySelector('.calc'));
    if (!el) return;
    var more = el.querySelector('details');
    el.outerHTML = calcWidget(el.getAttribute('data-ctx') || 'sheet', !!(more && more.open));
  }
  function calcSet(fn) {
    var c = calcState(), M = calcMonths();
    fn(c);
    c.months = Math.min(M.max, Math.max(M.min, Math.round(+c.months || M.default)));
    c.training = Math.min(c.months, Math.max(0, Math.round(+c.training || 0)));
    c.at = Date.now();
    S.calc = c; save();
    calcCtx = document.querySelector('#sheet .calc') ? 'sheet' : 'lesson';
    sfx.tap();
    calcRefresh();
    // the profile card under the sheet shows the new estimate when the sheet closes
    var card = root && root.querySelector('.calc-card');
    if (card) card.outerHTML = calcCard();
    clearTimeout(calcTimer);
    calcTimer = setTimeout(function () {
      var est = calcEstimate(S.calc && calcState());
      if (!est) return;
      track('calculator_used', { from: calcCtx, service_type: S.calc.type, months_band: monthsBand(est.months), training_set: est.training > 0, training_edited: !!S.calc.trainingEdited, lone: !!S.calc.lone,
        pikadon_band: calcBand(est.pikadon), grant_band: calcBand(est.grant), total_band: calcBand(est.total), $set: { calc_total_band: calcBand(est.total) } });
    }, 2500);
  }

  function registerSW() {
    if (IN_FRAME || !('serviceWorker' in navigator)) return;
    var local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (location.protocol !== 'https:' && !local) return;
    // a page opened without a worker gets one claim from the first install: only that change is not an update.
    // With a worker already active (a hard reload), every change is a new version.
    var had = !!navigator.serviceWorker.controller;
    var reg = function () { navigator.serviceWorker.register('sw.js').catch(function () { /* offline mode unavailable */ }); };
    if (had) reg();
    else navigator.serviceWorker.getRegistration().then(function (r) { if (r && r.active) had = true; }, function () { /* ignore */ }).then(reg);
    // a tap on the reminder while the app is already open (the worker brings it to the front)
    navigator.serviceWorker.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'push-click') {
        var km = /[?&]kind=([\w-]+)/.exec(e.data.url || ''), kind = km ? km[1] : null;
        track('push_clicked', { app_open: true, kind: kind });
      }
    });
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!had) { had = true; return; }
      // a new version is ready: reload now on the home screen, otherwise at the next screen change
      if (view === 'home' && !sheetOpen && !pushBusy) reloadForUpdate(); else pendingReload = true;
    });
  }

  // ---------- Events ----------
  function onClick(e) {
    // the notifications popup ignores taps in its first moment (a tap meant for home that landed as it slid up)
    if (Date.now() - askOpenedAt < 450 && e.target.closest('#sheet') && document.querySelector('#sheet .ask-ic, #sheet .ask-welcome')) return;
    if (e.target.closest('a[target="_blank"]')) markStepOut(); // a link out (the official calculator, WhatsApp)
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act'), id = el.getAttribute('data-id');
    switch (act) {
      case 'nav': setView(el.getAttribute('data-to')); break;
      case 'preview': sfx.tap(); previewSheet(id); break;
      case 'unit': unitSheet(id); break;
      case 'explain': explainSheet(el.getAttribute('data-what')); break;
      case 'src': {
        var sx = srcOf({ src: el.getAttribute('data-src') });
        track('source_opened', { lesson_id: el.getAttribute('data-l') || '', question_id: el.getAttribute('data-q') || '', src: el.getAttribute('data-src') || '',
          host: sx ? sx.url.split('/')[2] : '', placement: el.getAttribute('data-placement') || '' });
        flush();
        if (view === 'lesson') setTimeout(focusPlayer, 0); // back from the page, Enter continues the lesson
        break; // the link itself opens the page
      }
      case 'legal': legalSheet(); break;
      case 'about': aboutSheet(el.getAttribute('data-from')); break;
      case 'invite': invite(el.getAttribute('data-from') || 'home', id); break;
      case 'calc-open': calcSheet(el.getAttribute('data-from') || view); break;
      case 'calc-type': calcSet(function (c) {
        c.type = el.getAttribute('data-v');
        if (!c.trainingEdited) c.training = calcTrainingDefault(c.type);
      }); break;
      case 'calc-months': calcSet(function (c) { c.months = c.months + (+el.getAttribute('data-d') || 0); }); break;
      case 'calc-months-set': calcSet(function (c) { c.months = +el.getAttribute('data-v'); }); break;
      case 'calc-training': calcSet(function (c) { c.training = (c.training || 0) + (+el.getAttribute('data-d') || 0); c.trainingEdited = true; }); break;
      case 'calc-lone': calcSet(function (c) { c.lone = !!el.checked; }); break;
      case 'calc-official': {
        var cw = el.closest('.calc');
        track('calculator_official_clicked', { from: cw ? cw.getAttribute('data-ctx') : null, has_estimate: !!calcEstimate(S.calc && calcState()) });
        flush();
        break; // no preventDefault: the link opens
      }
      case 'close-sheet': closeSheet(); break;
      case 'start': notesId = null; startLesson(id); break;
      case 'restart': notesId = null; startLesson(id, true); break;
      case 'notes': notesId = id; setView('notes'); break;
      case 'notes-close': notesId = null; setView('home'); break;
      case 'practice': startPractice(false); break;
      case 'practice-mistakes': startPractice(true); break;
      case 'repair': session = null; startRepair(); break;
      case 'pick':
        if (session && !step().checked) { step().sel = +el.getAttribute('data-i'); sfx.tap(); render(); }
        break;
      case 'order-pick': {
        var st = step();
        if (st.o && !st.checked) { st.o.picked.push(+el.getAttribute('data-i')); sfx.tap(); render(); }
        break;
      }
      case 'order-unpick': {
        var st2 = step();
        if (st2.o && !st2.checked) { st2.o.picked.splice(+el.getAttribute('data-pos'), 1); sfx.tap(); render(); }
        break;
      }
      case 'match': pickMatch(el.getAttribute('data-side'), +el.getAttribute('data-i')); break;
      case 'check': check(); break;
      case 'next': next(); break;
      case 'back': back(); break;
      case 'peek': peekSheet(); break;
      case 'quit': quitSheet(); break;
      case 'quit-confirm':
        leaveSession('quit');
        setView('home');
        break;
      case 'home': session = null; setView('home'); break;
      case 'mission': missionSheet(id); break;
      case 'mstep': {
        var ms = S.missions[id] || (S.missions[id] = { steps: [], done: false });
        ms.steps[+el.getAttribute('data-i')] = el.checked;
        save();
        if (el.checked) sfx.tap();
        var l = BY_ID[id], all = l.mission.steps.every(function (_, i) { return ms.steps[i]; });
        var btn = document.querySelector('[data-act="mission-done"]');
        if (btn) { btn.disabled = !all; btn.innerHTML = all ? 'סיימתי את המשימה · ' + plus(P.mission) : 'מסמנים את כל השלבים כדי לסיים'; }
        break;
      }
      case 'mission-done': {
        var m2 = S.missions[id] || (S.missions[id] = { steps: [], done: false });
        if (m2.done) break;
        var before = levelIndex(S.xp);
        m2.done = true;
        var grant = awardXp(P.mission);
        save();
        track('mission_completed', { lesson_id: id });
        closeSheet(true);
        render();
        if (levelIndex(S.xp) > before) { levelUpSheet(grant); break; }
        sfx.done();
        confetti();
        openSheet('<h3>משימה בוצעה</h3><p class="lead">' + plus(P.mission) + ' נקודות. זה החלק שבאמת משנה את המצב הכלכלי.</p>' +
          '<button class="btn" data-act="close-sheet">יופי</button>');
        break;
      }
      case 'goal':
        S.goalXp = +el.getAttribute('data-xp'); save();
        track('goal_set', { goal_xp: S.goalXp, $set: { goal_xp: S.goalXp } });
        render(); if (sheetOpen) explainSheet('goal');
        break;
      case 'status': setStatus(el.getAttribute('data-v'), el.getAttribute('data-source') || 'profile'); render(); break;
      case 'pick-status': {
        pickedStatus = el.getAttribute('data-v'); sfx.tap(); render();
        var fl = firstLessonFor(pickedStatus);
        track('opener_viewed', { status: pickedStatus, start_unit_id: CFG.startUnit && CFG.startUnit[pickedStatus] != null ? CFG.startUnit[pickedStatus] : null, first_lesson_id: fl ? fl.lesson.id : null });
        break;
      }
      case 'onboard-status': {
        if (!pickedStatus) break;
        S.onboarded = true;
        setStatus(pickedStatus, 'onboarding');
        var first = currentLesson();
        track('onboarding_done', {
          goal_xp: S.goalXp, goal_default: true, start_unit_id: S.startUnit, first_lesson_id: first ? first.id : null,
          $set: { status: S.status, goal_xp: S.goalXp, start_unit_id: S.startUnit }
        });
        setView('home');
        break;
      }
      case 'begin-status': if (pickedStatus) { setStatus(pickedStatus); setView('home'); } break;
      case 'onboard-next':
        if (!openAsked && installAskState('welcome')) { installAskSheet('welcome'); break; }
        toStatusPick(false);
        break;
      case 'onboard-back': if (HIST && histDepth > 0) history.back(); else { onboardStep = Math.max(0, onboardStep - 1); render(); } break;
      case 'sound': S.sound = !S.sound; save(); render(); if (S.sound) sfx.right(0); break;
      case 'share':
        if (S.share) { if (S.reminder && S.reminder.on) disableReminder('analytics_off'); else notifNo('share_off'); track('analytics_off', {}); flush(); }
        else if (notifNoWhy() === 'share_off') notifNo(null); // sharing back on: the popup may ask again
        S.share = !S.share; save(); render();
        break;
      case 'install': installFlow(el.getAttribute('data-placement') || (view === 'profile' ? 'profile' : 'home')); break;
      case 'install-hide':
        S.installHidden = true; save();
        track('install_declined', { placement: el.getAttribute('data-placement') || 'home', lessons_done: doneCount() });
        render();
        break;
      case 'export': {
        var code = exportCode(), method = el.getAttribute('data-method') || 'copy';
        var place = el.getAttribute('data-placement') || '';
        var exported = function (m) { track('progress_exported', { method: m, placement: place, lessons_done: doneCount(), xp: S.xp, code_len: code.length }); flush(); };
        if (method === 'share' && navigator.share) {
          navigator.share({ title: 'קוד העברה של ' + CFG.appName, text: code }).then(function () { exported('share'); }, function () { /* cancelled */ });
          break;
        }
        copyText(code, function (ok) {
          if (ok) { toast(ICON.check + '<b>הקוד הועתק.</b><span>מדביקים אותו באפליקציה המותקנת</span>', 'info', 2800); exported('copy'); }
          else { manualCopy(code, 'לא הצלחנו להעתיק אוטומטית. מסמנים את הקוד ומעתיקים ידנית:', true); exported('manual'); }
        });
        break;
      }
      case 'import': {
        var src = el.getAttribute('data-source') || 'welcome';
        if (src === 'profile' && hasProgress()) {
          openSheet('<h3>לייבא קוד?</h3><p class="lead">ההתקדמות במכשיר הזה תוחלף במה שבקוד.</p>' +
            '<div class="row"><button class="btn ghost" data-act="close-sheet">ביטול</button><button class="btn" data-act="import-confirm">לייבא</button></div>');
          break;
        }
        importSheet(src);
        break;
      }
      case 'import-confirm': importSheet('profile'); break;
      case 'hash-import': {
        var hcode = pendingHash;
        pendingHash = null;
        closeSheet(true);
        if (hcode && !importProgress(hcode, 'hash').ok) toast(ICON.x + '<b>הקוד לא תקין</b>', '', 2600);
        break;
      }
      case 'import-go': {
        var box = document.getElementById('imp-code'), err = document.getElementById('imp-err');
        var res = importProgress(box ? box.value : '', el.getAttribute('data-source') || 'welcome');
        if (!res.ok) {
          if (err) err.hidden = false;
          if (box) { box.classList.add('shake'); setTimeout(function () { box.classList.remove('shake'); }, 400); }
        }
        break;
      }
      case 'reminder-on': enableReminder(el.getAttribute('data-from') || 'home'); break;
      case 'popup-reminder-on': closeSheet(); enableReminder('popup', true); break;
      case 'popup-later': closeSheet(); track('push_declined', { count: S.reminderNo ? S.reminderNo.count : 1, from: 'popup' }); render(); break;
      case 'install-popup-go': {
        var ipPlace = el.getAttribute('data-stage') === 'welcome' ? 'welcome_popup' : 'open_popup';
        closeSheet();
        if (deferredInstall) installFlow(ipPlace);
        else track('install_clicked', { method: IS_IOS ? 'ios_steps' : 'steps', placement: ipPlace, lessons_done: doneCount() });
        break;
      }
      case 'install-popup-later': {
        var ipStage = el.getAttribute('data-stage') === 'welcome' ? 'welcome' : 'home';
        track('install_popup_later', { variant: el.getAttribute('data-variant') || '', stage: ipStage });
        // before the start: "להמשיך בדפדפן" goes on to the status pick
        if (ipStage === 'welcome' && !S.onboarded) { openAsked = true; toStatusPick(true); } else closeSheet(); // this open had its popup
        break;
      }
      case 'reminder-later':
        S.reminderNo = { count: ((S.reminderNo && S.reminderNo.count) || 0) + 1, day: dayKey() };
        save(); track('push_declined', { count: S.reminderNo.count }); render();
        break;
      case 'reminder-toggle':
        if (pushState() === 'on') { disableReminder('user'); render(); toast(ICON.bell + '<b>התזכורת כבויה</b>', '', 1800); }
        else enableReminder('profile', true);
        break;
      case 'feedback': feedbackSheet(el.getAttribute('data-ctx'), id); break;
      case 'fb-rate': {
        fbRating = +el.getAttribute('data-v');
        sfx.tap();
        document.querySelectorAll('.face').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.getAttribute('data-v') === fbRating)); });
        break;
      }
      case 'feedback-send': {
        var ta = document.getElementById('fb-text'), text = ta ? ta.value.trim() : '';
        if (!fbRating && !text) { if (ta) { ta.classList.add('shake'); setTimeout(function () { ta.classList.remove('shake'); }, 400); } break; }
        var ctx = el.getAttribute('data-ctx'), lid = el.getAttribute('data-id'), via = feedbackViaWhatsApp();
        track('feedback_sent', { rating: fbRating || null, text: text, context: ctx, lesson_id: lid || null, channel: via ? 'whatsapp' : 'posthog' });
        flush();
        if (!via) {
          openSheet('<h3>תודה!</h3><p class="lead">המשוב הגיע. ככה ' + esc(CFG.appName) + ' משתפרת.</p><button class="btn" data-act="close-sheet">סגירה</button>');
          sfx.pair();
          break;
        }
        // WhatsApp: the message opens ready to send; without a number (or when the browser blocks the popup) it is copied by hand
        fbMessage = 'משוב על ' + CFG.appName + ' ' + CFG.version + (fbRating ? ' (' + fbRating + '/5)' : '') + (lid && BY_ID[lid] ? ' · שיעור "' + BY_ID[lid].title + '"' : '') + ':\n' + text;
        var wa = waNumber(), opened = null;
        if (wa) { markStepOut(); try { opened = window.open('https://wa.me/' + wa + '?text=' + encodeURIComponent(fbMessage), '_blank'); } catch (e) { opened = null; } }
        var copyBtn = '<button class="btn" data-act="fb-copy">להעתיק את ההודעה</button><button class="btn text" data-act="close-sheet">סגירה</button>';
        if (wa && opened) openSheet('<h3>עוד לחיצה אחת</h3><p class="lead">וואטסאפ נפתח עם ההודעה מוכנה' + (contactName() ? ' ל' + esc(contactName()) : '') + '. לוחצים שם שליחה, וזהו.</p>' + copyBtn);
        else if (!wa) openSheet('<h3>תודה!</h3><p class="lead">עדיין אין מספר וואטסאפ בגרסה הזו. העתיקו את ההודעה ושלחו אותה למי שהעביר לכם את ' + esc(CFG.appName) + '.</p>' + copyBtn);
        else openSheet('<h3>הדפדפן חסם את וואטסאפ</h3><p class="lead">העתיקו את ההודעה ושלחו אותה בוואטסאפ למספר ' + ltr(esc(wa)) + '.</p>' + copyBtn);
        sfx.pair();
        break;
      }
      case 'fb-copy':
        copyText(fbMessage, function (ok) {
          if (ok) toast(ICON.check + '<b>הועתק</b>', 'info', 1600);
          else manualCopy(fbMessage, 'לא הצלחנו להעתיק אוטומטית. מסמנים את ההודעה ומעתיקים ידנית:');
        });
        break;
      case 'rate':
        S.ratings[id] = el.getAttribute('data-v'); save();
        track('lesson_rated', { lesson_id: id, rating: S.ratings[id] });
        sfx.pair(); render();
        if (S.ratings[id] === 'hard') feedbackSheet('lesson', id);
        break;
      case 'intent':
        S.intent[id] = el.getAttribute('data-v'); save();
        track('invest_intent', { lesson_id: id, answer: S.intent[id], $set: { invest_intent: S.intent[id] } });
        sfx.pair(); render();
        break;
      case 'amount': {
        var band = el.getAttribute('data-v');
        S.amount[id] = band; save();
        var ap = { lesson_id: id, band: band, skipped: band === 'skip', intent: S.intent[id] || null };
        if (band !== 'skip') ap.$set = { invest_amount: band };
        track('invest_amount', ap);
        sfx.pair(); render();
        break;
      }
      case 'partner-link': {
        var pp = partnerById(id);
        track('partner_link_clicked', { option_id: el.getAttribute('data-option'), partner_id: id, partner: pp ? pp.name : null, unit_id: CFG.partner && CFG.partner.unitId, $set: { partner_link_clicked: true } });
        flush();
        break; // no preventDefault: the link opens
      }
      case 'reset':
        openSheet('<h3>לאפס את כל ההתקדמות?</h3><p class="lead">הנקודות, הרצף, השיעורים והמשימות יימחקו מהמכשיר הזה.</p>' +
          '<div class="row"><button class="btn ghost" data-act="close-sheet">ביטול</button><button class="btn bad" data-act="reset-confirm">לאפס</button></div>');
        break;
      case 'reset-confirm': {
        var uid = S.uid;
        if (S.reminder && S.reminder.on) disableReminder('reset');
        closeSheet(true); S = freshState(); S.uid = uid; onboardStep = 0; pickedStatus = null; session = null;
        track('progress_reset', {});
        save(); indexContent(); migrateContent(); setView('home');
        break;
      }
    }
  }

  function onInput(e) {
    if (e.target.classList && e.target.classList.contains('num') && session) {
      var st = step();
      st.input = e.target.value;
      var btn = root.querySelector('[data-act="check"]');
      if (btn) btn.disabled = st.input.trim() === '';
    }
  }

  function onKey(e) {
    if (e.key === 'Escape' && sheetOpen) { closeSheet(); return; }
    if (view !== 'lesson' || !session || sheetOpen) return;
    var st = step();
    var typing = e.target.classList && e.target.classList.contains('num');
    if (st.kind === 'q' && !st.checked && st.order && /^[1-4]$/.test(e.key) && !typing) {
      var pos = +e.key - 1;
      if (pos < st.order.length) { st.sel = st.order[pos]; render(); }
    } else if (e.key === 'Enter' && (typing || !e.target.closest('button, a'))) {
      e.preventDefault();
      if (st.kind === 'screen' || st.checked) next(); else check();
    }
  }

  var hiddenAt = 0, swCheckedAt = 0, stepOutAt = 0, outByApp = false;
  // the app itself is about to send people out (a share, WhatsApp, a link): coming back is part of the same task
  function markStepOut() { stepOutAt = Date.now(); }
  function markHidden() {
    if (hiddenAt) return;
    hiddenAt = Date.now();
    outByApp = !!stepOutAt && hiddenAt - stepOutAt < 60 * 1000;
    stepOutAt = 0;
  }
  function onHidden() {
    markHidden();
    if (view === 'lesson' && session) {
      clockStop();
      snapshot();
      if (session.mode === 'lesson') track('lesson_paused', { lesson_id: session.lesson.id, step_index: session.idx, step_count: stepCount() });
    }
    flush();
  }
  function sheetHasText() {
    var t = document.querySelectorAll('#sheet textarea:not([readonly])');
    for (var i = 0; i < t.length; i++) if (t[i].value && t[i].value.trim()) return true;
    return false;
  }
  function onShown() {
    var away = hiddenAt ? Date.now() - hiddenAt : 0, byApp = outByApp;
    hiddenAt = 0; outByApp = false;
    if (away >= OPEN_AWAY_MS) newOpen();
    checkForUpdate();
    if (S.onboarded) checkStreakBreak();
    // back after a while: start on home, like a fresh open (an iPhone app kept in memory never reloads by itself).
    // An unfinished lesson waits in the "להמשיך" card. A trip out and back keeps its screen for up to 10 minutes:
    // a sheet outside a lesson (a mission, the calculator, a code to paste), a practice or rescue run (no card to
    // continue from), and a share or link the app opened. A sheet with typed text is never thrown away.
    var keep = byApp || (sheetOpen && view !== 'lesson') || (view === 'lesson' && session && session.mode !== 'lesson') ||
      (view === 'done' && !!root.querySelector('.done-wrap .intent:not(.done)')); // a one-time question still waiting
    var limit = keep ? AWAY_KEEP_MS : AWAY_HOME_MS;
    if (sheetOpen && sheetHasText()) limit = Infinity;
    if (away >= limit && S.onboarded && S.status && (view !== 'home' || sheetOpen)) {
      if (view === 'lesson' && session) leaveSession('away');
      else if (view === 'done') session = null;
      setView('home');
    }
    else if (view === 'lesson' && session) clockStart();
    else if (view === 'home' && !sheetOpen) {
      if (pendingReload && !pushBusy) { reloadForUpdate(); return; } // a new version arrived while a sheet was open
      render(); // a new day may have started
      maybeAsk();
    }
  }
  function onVisibility() {
    if (document.visibilityState === 'hidden') onHidden(); else onShown();
  }
  // a page restored from the back-forward cache may skip visibilitychange; pagehide already set hiddenAt
  function onPageShow(e) {
    if (e && e.persisted && hiddenAt && document.visibilityState !== 'hidden') onShown();
  }
  // the browser looks for a new version only when the app is opened from scratch; an app resumed from memory
  // has to ask (at most once a minute). A new version then reloads the app on home.
  function checkForUpdate() {
    if (IN_FRAME || !('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;
    if (Date.now() - swCheckedAt < 60 * 1000) return;
    swCheckedAt = Date.now();
    try {
      navigator.serviceWorker.getRegistration().then(function (r) { if (r) return r.update(); }).catch(function () { /* offline */ });
    } catch (e) { /* ignore */ }
  }

  // the one-time sheet for people who used the app before 0.9: what points are for now, and what they already got
  function daysOffIntro() {
    S.offIntroSeen = true; save();
    var k = S.offRetro || 0;
    track('days_off_intro_seen', { retro_days: k, held: S.daysOff });
    openSheet('<div class="eyebrow">חדש ב' + esc(CFG.appName) + '</div><h3>עכשיו יש לנקודות תפקיד</h3>' +
      '<p class="chain">נקודות ← שלב חדש ← יום חופש לרצף</p>' +
      '<p class="lead">כל שלב חדש נותן יום חופש לרצף: יום בלי שיעור שהרצף לא נשבר בו' + minStreakNote() + '. ' +
        (S.status === 'civ' ? 'מבחן, משמרת, טיול?' : 'שמירה, שטח, בסיס סגור?') + ' הוא נכנס לבד.</p>' +
      '<p class="lead off-line">' + ICON.dayoff + '<span><b>' + (k === 0 ? 'יום החופש הראשון לרצף מחכה לך בשלב 2.'
        : k === 1 ? 'על השלבים שכבר עברת קיבלת יום חופש אחד לרצף.'
        : 'על השלבים שכבר עברת קיבלת ' + k + ' ימי חופש לרצף' + (k >= DO.maxHeld ? ', המקסימום שאפשר לשמור.' : '.')) + '</b> ימי החופש שומרים על הרצף מהיום והלאה.</span></p>' +
      '<p class="fine">לשלבים כבר אין שמות של סכומי כסף. זה אף פעם לא היה כסף שלך, רק שם של שלב.</p>' +
      (DO.invite ? '<p class="fine">עוד יום חופש לרצף: משתפים קישור לחבר, פעם בשבוע.' + (DO.friendGift ? ' חבר חדש מקבל ' + DO.friendGift + ' ימי חופש.' : '') + '</p>' : '') +
      '<button class="btn" data-act="close-sheet">מעולה</button>');
  }

  function boot(data) {
    DATA = data;
    indexContent();
    migrateContent();
    root = document.getElementById('app');
    document.documentElement.lang = 'he';
    document.documentElement.dir = 'rtl';
    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('pointerdown', function () { lastTouchAt = Date.now(); }, { capture: true, passive: true });
    // no pinch zoom (Jonathan, 18.10): iPhone ignores user-scalable=no in the viewport, so the gesture is stopped here
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (t) {
      document.addEventListener(t, function (e) { e.preventDefault(); }, { passive: false });
    });
    if (HIST) {
      try { history.scrollRestoration = 'manual'; } catch (e) { /* ignore */ }
      histReplace({ view: 'home' });
      window.addEventListener('popstate', onPop);
    }
    window.addEventListener('pagehide', function () { markHidden(); if (view === 'lesson') { clockStop(); snapshot(); } flush(); });
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('online', flush);
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; });
    window.addEventListener('appinstalled', function () { track('app_installed', { method: 'appinstalled' }); S.installHidden = true; S.installSeen = true; save(); if (view === 'home') render(); });
    // iOS starts audio only from a touch
    document.addEventListener('touchstart', function unlock() { if (S.sound) audio(); document.removeEventListener('touchstart', unlock); }, { passive: true });
    checkStreakBreak();
    // iPhone has no appinstalled event: the first open from the home-screen icon is the install
    if (isStandalone() && !S.installSeen) {
      S.installSeen = true; S.installHidden = true; save();
      track('app_installed', { method: IS_IOS ? 'ios_first_standalone_open' : 'first_standalone_open', imported: !!S.importedAt });
    }
    if (OPEN_REF && !S.ref) { S.ref = OPEN_REF; save(); }
    // a friend's invite link on a fresh device: the gift waits for the first lesson (nothing for someone with progress)
    if (DO.enabled && DO.friendGift && OPEN_REF === 'share' && !S.giftPending && !S.giftGot && !S.xp && !doneCount()) { S.giftPending = true; save(); }
    if (S.giftPending && !S.onboarded) track('friend_gift_shown', { placement: 'welcome' });
    track('app_opened', {
      returning: S.onboarded, lessons_done: doneCount(), xp: S.xp, streak: currentStreak(), source: OPEN_SOURCE, ref: OPEN_REF, kind: OPEN_KIND,
      reminders: !!(S.reminder && S.reminder.on), days_off: S.daysOff, learned_days_7: learned7(),
      $set: { status: S.status, goal_xp: S.goalXp, standalone: isStandalone(), start_unit_id: S.startUnit, days_off: S.daysOff }, $set_once: { first_day: S.firstDay, first_ref: S.ref || 'none' }
    });
    if (OPEN_SOURCE === 'push') track('push_clicked', { app_open: false, kind: OPEN_KIND });
    // the app always opens on home; an unfinished lesson waits in the "להמשיך" card at the top (Jonathan, 18.10)
    if (S.inProgress && !(S.onboarded && S.status && restoreSession(S.inProgress))) { S.inProgress = null; save(); }
    // a transfer code can also arrive in the link (#p=D1....), for example pasted into the address bar
    var hashCode = /^#p=(.+)$/.exec(location.hash || '');
    // existing users meet days off once, over home; one sheet per open, so no toast that day (none can apply on update day)
    var showIntro = DO.enabled && !hashCode && S.onboarded && S.status && !S.offIntroSeen;
    if (showIntro) offToast = null;
    render();
    if (hashCode) {
      try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) { /* ignore */ }
      var hc = '';
      try { hc = decodeURIComponent(hashCode[1]); } catch (e) { hc = ''; }
      if (S.onboarded && hasProgress() && parseCode(hc).ok) hashConfirm(hc);
      else {
        var imp = importProgress(hc, 'hash');
        if (!imp.ok) toast(ICON.x + '<b>הקוד לא תקין</b>', '', 2600);
      }
    }
    if (showIntro && view === 'home' && !sheetOpen) { openAsked = true; daysOffIntro(); }
    else if (!hashCode && OPEN_SOURCE !== 'push') maybeAsk();
    registerSW();
    syncPush();
    flush();
  }

  if (window.LESSONS_DATA) boot(window.LESSONS_DATA);
  else fetch('data/lessons.json').then(function (r) { return r.json(); }).then(boot).catch(function () {
    document.getElementById('app').innerHTML = '<p class="gutter" style="padding-block:40px">לא הצלחתי לטעון את השיעורים. בודקים חיבור לאינטרנט ופותחים שוב.</p>';
  });
})();
