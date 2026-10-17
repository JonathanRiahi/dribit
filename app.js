/* דריבית: אפליקציה ללימוד פיננסים שמתקינים למסך הבית (PWA).
   בלי שרת ובלי התחברות: התוכן מגיע מ-data/lessons.json וההתקדמות נשמרת במכשיר (localStorage).
   נתוני שימוש אנונימיים נשלחים ל-PostHog כשיש מפתח ב-config.js. */
(function () {
  'use strict';

  var CFG = window.DRIBIT_CONFIG;
  var P = CFG.points;
  var STORE_KEY = 'dribit.progress.v1';
  var QUEUE_KEY = 'dribit.events.v1';
  var HEB_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];
  var RESUME_DAYS = 14;
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
    dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>'
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
      uid: hex(12), firstDay: dayKey(), contentV: 0,
      xp: 0, streak: 0, bestStreak: 0, lastDay: null,
      lostStreak: null,  // { value, lastDay } when a long streak broke and can still be rescued
      days: {},          // 'YYYY-MM-DD' -> points that day
      lessons: {},       // lessonId -> { done, best, plays, fastest }
      missions: {},      // lessonId -> { steps: [bool], done: bool }
      mistakes: {},      // questionId -> times answered wrong (goes down when answered right)
      answered: 0, correct: 0,
      inProgress: null,  // the unfinished lesson, so the app reopens on the same screen
      ratings: {}, intent: {}, installHidden: false,
      reminder: null,    // { on, endpoint, hour, since } while the daily push reminder is on
      reminderNo: null   // { count, day } after "not now" on the reminder card
    };
  }
  function migrate(s) {
    var base = freshState();
    for (var k in base) if (!(k in s)) s[k] = base[k];
    if (s.actions) { // v1 kept a single checkbox per lesson
      Object.keys(s.actions).forEach(function (id) { if (s.actions[id]) s.missions[id] = { steps: [], done: true }; });
      delete s.actions;
    }
    var goals = CFG.goals.map(function (g) { return g.xp; });
    if (goals.indexOf(s.goalXp) < 0) s.goalXp = CFG.defaultGoal;
    s.v = 3;
    return s;
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
  // a missed day breaks the streak; a long one is kept aside so it can be rescued
  function checkStreakBreak() {
    if (!S.lastDay || !S.streak) return;
    var today = dayKey(), yday = dayKey(addDays(new Date(), -1));
    if (S.lastDay === today || S.lastDay === yday) return;
    if (S.streak >= CFG.streakRepair.minStreak) {
      S.lostStreak = { value: S.streak, lastDay: S.lastDay };
      track('streak_lost', { value: S.streak });
    }
    S.streak = 0;
    save();
  }
  function repairInfo() {
    var L = S.lostStreak;
    if (!L) return null;
    var missed = daysBetween(L.lastDay, dayKey()) - 1;
    if (missed > CFG.streakRepair.withinDays) { S.lostStreak = null; save(); return null; }
    if (!doneCount()) return null;
    return { value: L.value, daysLeft: CFG.streakRepair.withinDays - missed };
  }
  function todayXp() { return S.days[dayKey()] || 0; }
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
  }

  // levels: points turn into levels named after money amounts
  function levelIndex(xp) {
    var L = CFG.levels, i = 0;
    while (i + 1 < L.length && xp >= L[i + 1].min) i++;
    return i;
  }
  function levelInfo(xp) {
    var L = CFG.levels, i = levelIndex(xp), cur = L[i], next = L[i + 1];
    return {
      i: i, n: i + 1, amount: cur.amount, next: next ? next.amount : null,
      toNext: next ? next.min - xp : 0,
      pct: next ? (xp - cur.min) / (next.min - cur.min) : 1
    };
  }

  // ---------- Content ----------
  var DATA = null, UNITS = [], LESSONS = [], BY_ID = {}, QUESTIONS = {};
  // audience: which statuses see a lesson, screen or question (missing = everyone)
  function visible(x) { return !x.audience || !S.status || x.audience.indexOf(S.status) >= 0; }
  function indexContent() {
    UNITS = []; LESSONS = []; BY_ID = {}; QUESTIONS = {};
    DATA.units.forEach(function (u) {
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
        l.vScreens = l.screens.filter(visible);
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
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, ms);
    setTimeout(function () { t.remove(); }, ms + 400);
  }

  // ---------- Rendering ----------
  var root, view = 'home', session = null, sheetOpen = false, notesId = null, onboardStep = 0;
  var deferredInstall = null, pendingReload = false, pushBusy = false;
  // how the app was opened: 'homescreen' (the installed icon), 'push' (a tap on the reminder) or 'link'
  var OPEN_SOURCE = (function () { var m = /[?&]source=([\w-]+)/.exec(location.search); return m ? m[1] : 'link'; })();

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
    if (ignorePops > 0) { ignorePops--; return; }
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
    if (pendingReload && v !== 'lesson' && v !== 'done') { location.reload(); return; }
    render();
    if (v !== 'home') window.scrollTo(0, 0);
  }

  function setView(v) {
    view = v;
    closeSheet(true);
    if (v === 'home') histBack(histDepth); else histEnter({ view: v });
    if (pendingReload && v !== 'lesson' && v !== 'done') { location.reload(); return; }
    render();
    if (v !== 'home') window.scrollTo(0, 0);
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
    var st = currentStreak();
    return '<header class="topbar gutter">' +
      '<div class="brandmark">' + esc(CFG.appName) + '</div>' +
      '<div class="stats">' +
        '<button class="stat flame' + (st ? '' : ' off') + '" data-act="explain" data-what="streak" aria-label="רצף: ' + st + ' ימים">' + ICON.flame + st + '</button>' +
        '<button class="stat xp" data-act="explain" data-what="points" aria-label="נקודות: ' + S.xp + '">' + ICON.coin + fmt(S.xp) + '</button>' +
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
    var rs = reminderCardState();
    // one ask at a time: while the reminder card is due, the install card waits
    if (canInstall() && !S.installHidden && !rs) {
      html += '<div class="card install-card"><div class="rc-head"><span class="rc-ic">' + ICON.phone + '</span><div>' +
        '<b>להתקין את ' + esc(CFG.appName) + ' בטלפון</b><span>אייקון במסך הבית, נפתח במסך מלא ועובד גם בלי אינטרנט.</span></div></div>' +
        '<div class="row"><button class="btn" data-act="install">להתקנה</button><button class="btn text" data-act="install-hide">לא עכשיו</button></div></div>';
    }
    if (rs) {
      html += '<div class="card reminder-card"><div class="rc-head"><span class="rc-ic">' + ICON.bell + '</span><div>' +
        '<b>תזכורת יומית ב-' + hourLabel() + '</b><span>' + (rs === 'install'
          ? 'באייפון תזכורות עובדות רק מהאפליקציה המותקנת במסך הבית.'
          : 'הודעה קצרה רק בימים שעוד לא עשית שיעור. אפשר לכבות בפרופיל.') + '</span></div></div>' +
        '<div class="row"><button class="btn" data-act="' + (rs === 'install' ? 'install' : 'reminder-on') + '" data-from="home">' +
          (rs === 'install' ? 'איך מתקינים' : 'להפעיל') + '</button><button class="btn text" data-act="reminder-later">לא עכשיו</button></div></div>';
    }
    if (CFG.pilot) {
      html += '<button class="pilot-bar" data-act="feedback" data-ctx="home">' + ICON.chat + '<span><b>גרסת ניסיון.</b> ספרו לנו מה לשפר</span>' + ICON.chevron + '</button>';
    }
    return html;
  }

  function renderPath() {
    var cur = currentLesson();
    var r = levelInfo(S.xp);
    var html = homeCards();
    html += '<button class="rank-strip" data-act="explain" data-what="points">' +
      '<span class="rank-badge">' + ICON.coins + '</span>' +
      '<span class="rank-txt"><b>שלב ' + r.n + ' · ' + esc(r.amount) + '</b><span>' + (r.next ? 'עוד ' + fmt(r.toNext) + ' נקודות לשלב ' + esc(r.next) : 'השלב הגבוה ביותר') + '</span></span>' +
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
      (rec && rec.done ? '<span class="chip ok">' + ICON.check + 'השיא שלך: ' + rec.best + '% נכונות</span>' : '') + '</div>' +
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
    openSheet('<div class="eyebrow">יחידה ' + u.n + '</div><h3>' + esc(u.title) + '</h3><ul class="lesson-list">' + rows + '</ul>', 'tall');
  }

  function explainSheet(what) {
    var r = levelInfo(S.xp);
    if (what === 'points') {
      var ladder = CFG.levels.map(function (k, i) {
        return '<li class="' + (i === r.i ? 'me' : i < r.i ? 'past' : '') + '"><b>' + esc(k.amount) + '</b><span>' + fmt(k.min) + ' נק׳</span></li>';
      }).join('');
      openSheet('<h3>נקודות ושלבים</h3>' +
        '<p class="lead">כל תשובה נכונה ומשימה מוסיפות נקודות. הנקודות מעלות אותך בשלבים, מ-100 ₪ ועד מיליון, וממלאות את היעד היומי.</p>' +
        '<ul class="rules">' +
          '<li><span>תשובה נכונה בניסיון הראשון</span><b>' + plus(P.correct) + '</b></li>' +
          '<li><span>שאלת חזרה או תרגול</span><b>' + plus(P.review) + '</b></li>' +
          '<li><span>סיום שיעור</span><b>' + plus(P.lessonDone) + '</b></li>' +
          '<li><span>שיעור בלי אף טעות</span><b>' + plus(P.perfect) + '</b></li>' +
          '<li><span>מסיימים בזמן שכתוב בתחילת השיעור</span><b>' + plus(P.speed) + '</b></li>' +
          '<li><span>משימה מחוץ לאפליקציה</span><b>' + plus(P.mission) + '</b></li>' +
        '</ul>' +
        '<div class="eyebrow">השלבים · את/ה בשלב ' + r.n + '</div><ol class="ladder">' + ladder + '</ol>' +
        '<button class="btn" data-act="close-sheet">הבנתי</button>', 'tall');
    } else if (what === 'streak') {
      var st = currentStreak(), R = CFG.streakRepair;
      openSheet('<h3>' + (st ? 'רצף של ' + plural(st, 'יום אחד', 'ימים') : 'אין רצף כרגע') + '</h3>' +
        '<p class="lead">כל יום שבו עושים לפחות שיעור אחד או תרגול מוסיף יום לרצף. יום בלי למידה שובר אותו.</p>' +
        '<p class="lead">רצף של ' + R.minStreak + ' ימים ומעלה שנשבר אפשר להציל עד ' + R.withinDays + ' ימים אחרי, במבחן של ' + R.questions + ' שאלות (' + R.toPass + ' נכונות לפחות).</p>' +
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

  function legalSheet() {
    var p = CFG.partner;
    openSheet('<h3>חשוב לדעת</h3>' +
      '<p class="lead">' + esc(CFG.appName) + ' מלמדת חינוך פיננסי כללי. זה לא ייעוץ השקעות ולא המלצה לפעולה מסוימת. לפני החלטה על הכסף שלך כדאי לבדוק מול גורם מוסמך.</p>' +
      '<p class="lead">' + esc(CFG.examplesNote) + ' סכומים רשמיים, כמו הפיקדון והמענק, מופיעים עם התאריך שבו נבדקו.</p>' +
      (p && p.enabled ? '<p class="lead">' + esc(p.disclosure) + '</p>' : '') +
      '<p class="fine">כדי לשפר את האפליקציה נשלחים נתוני שימוש בלי שם, טלפון או מייל. אפשר לכבות את זה בפרופיל.</p>' +
      '<button class="btn" data-act="close-sheet">הבנתי</button>');
  }

  function installSheet() {
    var steps = IS_IOS
      ? ['פותחים את הקישור בספארי (לא מתוך אינסטגרם או טיקטוק).',
         'לוחצים על כפתור השיתוף ' + ICON.share + ' בתחתית המסך.',
         'גוללים ובוחרים "הוספה למסך הבית" ' + ICON.addHome + '.',
         'לוחצים "הוספה". האייקון של ' + esc(CFG.appName) + ' יופיע במסך הבית.']
      : ['פותחים את הקישור בכרום.',
         'לוחצים על ' + ICON.dots + ' בפינה של המסך.',
         'בוחרים "התקנת אפליקציה" או "הוספה למסך הבית".',
         'מאשרים. האייקון של ' + esc(CFG.appName) + ' יופיע במסך הבית.'];
    openSheet('<h3>התקנה ב' + (IS_IOS ? 'אייפון' : 'אנדרואיד') + '</h3>' +
      '<ol class="install-steps">' + steps.map(function (s, i) { return '<li><span class="num-badge">' + (i + 1) + '</span><span>' + s + '</span></li>'; }).join('') + '</ol>' +
      '<p class="fine">ההתקדמות נשמרת בטלפון. אחרי ההתקנה פותחים את ' + esc(CFG.appName) + ' רק מהאייקון.</p>' +
      '<button class="btn" data-act="close-sheet">הבנתי</button>', 'tall');
  }

  var fbRating = 0;
  function feedbackSheet(ctx, lessonId) {
    fbRating = 0;
    var faces = ['😣', '🙁', '😐', '🙂', '🤩'];
    openSheet('<h3>מה דעתך?</h3>' +
      '<p class="lead">כל מילה עוזרת: מה לא היה ברור, מה חסר, מה אהבת.</p>' +
      '<div class="faces" role="group" aria-label="דירוג מ-1 עד 5">' + faces.map(function (f, i) {
        return '<button class="face" data-act="fb-rate" data-v="' + (i + 1) + '" aria-pressed="false" aria-label="' + (i + 1) + ' מתוך 5">' + f + '</button>';
      }).join('') + '</div>' +
      '<textarea id="fb-text" rows="4" maxlength="1500" placeholder="למשל: השאלה על דמי ניהול לא הייתה ברורה"></textarea>' +
      '<button class="btn" data-act="feedback-send" data-ctx="' + esc(ctx || '') + '" data-id="' + esc(lessonId || '') + '">שליחה</button>' +
      '<button class="btn text" data-act="close-sheet">ביטול</button>', 'tall');
  }

  function levelUpSheet() {
    var r = levelInfo(S.xp);
    sfx.level();
    confetti(true);
    track('level_up', { level: r.n });
    openSheet('<div class="level-up"><div class="lvl-coin">' + ICON.coins + '</div>' +
      '<div class="eyebrow">עלית שלב</div><h3>שלב ' + r.n + ' · ' + esc(r.amount) + '</h3>' +
      '<p class="lead">' + (r.next ? 'הבא בתור: ' + esc(r.next) + '. עוד ' + fmt(r.toNext) + ' נקודות.' : 'הגעת לשלב הגבוה ביותר.') + '</p></div>' +
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
          m: st.m ? { a: st.m.a, b: st.m.b, matched: st.m.matched, mistakes: st.m.mistakes } : null
        };
      })
    };
    save();
  }
  function restoreSession(ip) {
    var l = BY_ID[ip.lessonId];
    if (!shown(l) || !ip.steps || Date.now() - ip.savedAt > RESUME_DAYS * 864e5) return null;
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
      if (x.order) st.order = x.order;
      if (x.o) st.o = x.o;
      if (x.m && st.m) { st.m.a = x.m.a; st.m.b = x.m.b; st.m.matched = x.m.matched; st.m.mistakes = x.m.mistakes; }
      steps.push(st);
    });
    if (!ok || !steps.length) return null;
    var s = newSession('lesson', l, steps);
    s.idx = Math.min(ip.idx || 0, steps.length - 1);
    s.combo = ip.combo || 0; s.maxCombo = ip.maxCombo || 0;
    s.firstTry = ip.firstTry || 0; s.firstTryRight = ip.firstTryRight || 0; s.reviewRight = ip.reviewRight || 0;
    s.xp = ip.xp || 0; s.activeMs = ip.activeMs || 0;
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
          '<article class="explain-card"><h2>' + esc(st.s.title) + '</h2><p>' + esc(st.s.body) + '</p>' +
            (st.s.example ? '<div class="example"><span class="eyebrow">דוגמה</span><p>' + esc(st.s.example) + '</p></div>' : '') +
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
      fix + '<p>' + esc(q.explanation) + '</p></div></div>' +
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
    track('question_answered', {
      mode: session.mode, lesson_id: session.lesson ? session.lesson.id : st.q.lessonId, question_id: st.q.id,
      question_type: st.q.type, correct: right, retry: st.retry, review: st.review
    });
    save();
  }

  // after a right answer: sparkles, floating points and combo cheers
  function celebrate(st) {
    if (!st.right) return;
    var target = root.querySelector('.opt.right') || root.querySelector('.order-slots') || root.querySelector('.verdict .badge');
    burst(target);
    if (st.gain) floatText(target, '+' + st.gain);
    if ([3, 5, 8, 12, 20].indexOf(session.combo) >= 0) {
      setTimeout(function () { sfx.combo(session.combo); }, 220);
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
    awardXp(s.xp);
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
    if (s.levelUp) setTimeout(function () { if (view === 'done' && !sheetOpen) levelUpSheet(); }, 1500);
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

  function partnerCard(l) {
    var p = CFG.partner;
    if (!p || !p.enabled || !p.url || !p.name || (p.lessons || []).indexOf(l.id) < 0) return '';
    if (!session.partnerSeen) { session.partnerSeen = true; track('partner_viewed', { partner: p.name, lesson_id: l.id }); }
    return '<div class="partner"><div class="eyebrow">שותף · תוכן ממומן</div><b>' + esc(p.name) + '</b><p>' + esc(p.text) + '</p>' +
      '<a class="btn ghost" href="' + esc(p.url) + '" target="_blank" rel="noopener sponsored" data-act="partner" data-id="' + esc(l.id) + '">לאתר של ' + esc(p.name) + '</a>' +
      '<p class="fine">' + esc(p.disclosure) + '</p></div>';
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
        '<div class="progress-row"><span>' + esc(r.amount) + '</span><span class="bar gold"><i data-w="' + Math.round(r.pct * 100) + '" style="width:' + Math.round(s.pctBefore * 100) + '%"></i></span><span>' + (r.next ? esc(r.next) : '') + '</span></div>' +
        '<p class="fine">' + (r.next ? 'עוד ' + fmt(r.toNext) + ' נקודות לשלב הבא. ' : '') + 'היעד היומי: ' + fmt(todayXp()) + ' מתוך ' + fmt(S.goalXp) + '. <button class="link" data-act="explain" data-what="points">איך מקבלים נקודות?</button></p>' +
      '</div>';
    if (s.mode === 'repair' && !s.passed && repairInfo()) html += '<button class="btn gold" data-act="repair">לנסות שוב</button>';
    if (l) {
      html += '<div class="takeaway remember"><div class="eyebrow">משפט לזכור</div><p>' + esc(l.remember) + '</p></div>' +
        ratingRow(l) + intentCard(l) + partnerCard(l) + missionCard(l, true);
    }
    html += legalLine(false) + '<div class="spacer"></div><button class="btn" data-act="home">המשך</button></div>';
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
    openSheet('<div class="eyebrow">משימה · ' + esc(l.title) + ' · ' + ICON.clock + (m.minutes || 10) + ' דקות</div>' +
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
        (s.example ? '<div class="example"><span class="eyebrow">דוגמה</span><p>' + esc(s.example) + '</p></div>' : '') + '</article>';
    }).join('');
    return '<div class="notes u' + l.unit.id + '"><div class="player-top gutter"><button class="icon-btn" data-act="notes-close" aria-label="חזרה">' + ICON.back + '</button>' +
      '<div class="notes-title"><span class="eyebrow">יחידה ' + l.unit.n + ' · שיעור ' + l.n + '</span><b>' + esc(l.title) + '</b></div></div>' +
      '<div class="stage gutter">' + screens +
      '<div class="takeaway remember"><div class="eyebrow">משפט לזכור</div><p>' + esc(l.remember) + '</p></div>' +
      missionCard(l, true) +
      (l.source ? '<p class="source">מקורות: ' + esc(l.source) + '</p>' : '') +
      legalLine(false) +
      '<button class="btn" data-act="restart" data-id="' + esc(l.id) + '">לתרגל את השיעור שוב</button></div></div>';
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
  function weekChart() {
    var days = [], names = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
    for (var i = 6; i >= 0; i--) { var d = addDays(new Date(), -i); days.push({ n: names[d.getDay()], xp: S.days[dayKey(d)] || 0 }); }
    var max = Math.max(S.goalXp * 1.25, Math.max.apply(null, days.map(function (d) { return d.xp; })));
    var W = 320, H = 150, top = 18, bottom = 24, bw = 28, gap = (W - bw * 7) / 6;
    var y = function (v) { return top + (H - top - bottom) * (1 - v / max); };
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="נקודות בשבעת הימים האחרונים">';
    var gy = y(S.goalXp).toFixed(1);
    svg += '<line class="goal-line" x1="0" x2="' + W + '" y1="' + gy + '" y2="' + gy + '"/>';
    // oldest day on the right, today on the left (Hebrew reading order)
    days.forEach(function (d, i) {
      var x = W - bw - i * (bw + gap);
      var h = Math.max(4, (H - top - bottom) - (y(d.xp) - top));
      var cls = d.xp === 0 ? 'bar zero' : d.xp >= S.goalXp ? 'bar met' : 'bar';
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
        '<span class="rank-txt"><span class="eyebrow">השלב שלך</span><b>שלב ' + r.n + ' · ' + esc(r.amount) + '</b>' +
        '<span class="bar gold"><i style="width:' + Math.round(r.pct * 100) + '%"></i></span>' +
        '<span class="fine">' + (r.next ? 'עוד ' + fmt(r.toNext) + ' נקודות לשלב ' + esc(r.next) : 'השלב הגבוה ביותר') + '</span></span></button>' +
      '<div class="stat-grid">' +
        statBox(ICON.flame, 'var(--flame)', currentStreak(), 'ימים ברצף') +
        statBox(ICON.coin, 'var(--gold)', fmt(S.xp), 'נקודות') +
        statBox(ICON.book, 'var(--brand)', doneCount() + '/' + LESSONS.length, 'שיעורים') +
        statBox(ICON.target, 'var(--brand)', missionsDone, 'משימות בוצעו') +
        statBox(ICON.trophy, 'var(--gold)', S.bestStreak, 'שיא רצף') +
        statBox(ICON.check, 'var(--ok)', acc + '%', 'תשובות נכונות') +
      '</div>' +
      '<div class="card week"><h2>השבוע שלי</h2>' + weekChart() + '<p class="fine">הקו המקווקו הוא היעד היומי.</p></div>' +
      '<div class="card"><h2>המצב שלי</h2><p class="fine">קובע אילו שיעורים מופיעים במסלול.</p><div class="seg two">' + statusButtons('status', S.status) + '</div></div>' +
      '<div class="card"><h2>יעד יומי</h2><div class="seg">' + goals + '</div></div>' +
      '<div class="card"><div class="toggle-row"><h2 id="sound-l">צלילים ורטט</h2><button class="switch" role="switch" aria-labelledby="sound-l" aria-checked="' + S.sound + '" data-act="sound"></button></div></div>' +
      reminderRow() +
      (canInstall() ? '<div class="card"><h2>התקנה בטלפון</h2><p>אייקון במסך הבית, מסך מלא, ועובד גם בלי אינטרנט.</p><button class="btn ghost" data-act="install">איך מתקינים</button></div>' : '') +
      '<div class="card"><h2>משוב</h2><p>מה לא היה ברור? מה חסר? כל הערה עוזרת.</p><button class="btn ghost" data-act="feedback" data-ctx="profile">לכתוב משוב</button></div>' +
      '<div class="card"><h2>על ' + esc(CFG.appName) + '</h2><p>' + esc(CFG.disclaimer) + '. לפני החלטה על הכסף שלך כדאי לבדוק מול גורם מוסמך. ' + esc(CFG.examplesNote) + '</p>' +
        '<div class="toggle-row"><span id="share-l">שליחת נתוני שימוש אנונימיים</span><button class="switch" role="switch" aria-labelledby="share-l" aria-checked="' + S.share + '" data-act="share"></button></div>' +
        '<p class="fine">ההתקדמות נשמרת רק במכשיר הזה. גרסה ' + esc(CFG.version) + '.</p>' +
        '<button class="btn text" data-act="reset">איפוס ההתקדמות</button></div>' +
      '</div>';
  }
  function statBox(icon, color, val, label) {
    return '<div class="stat-box"><span style="color:' + color + '">' + icon + '</span><div><b>' + val + '</b><span>' + label + '</span></div></div>';
  }

  // ---------- Welcome ----------
  var pickedGoal = CFG.defaultGoal, pickedStatus = null;
  function renderWelcome() {
    var art = CFG.images && CFG.images.welcome ? '<div class="welcome-art"><img src="' + esc(CFG.images.welcome) + '" alt=""></div>' : '';
    var onlyStatus = S.onboarded && !S.status;
    if (onlyStatus) onboardStep = 1;
    if (onboardStep === 0) {
      var questions = LESSONS.reduce(function (n, l) { return n + l.vQuestions.length; }, 0);
      return '<div class="welcome gutter">' +
        '<div class="logo">' + esc(CFG.appName) + '</div>' +
        '<p class="tag">' + esc(CFG.tagline) + '</p>' + art +
        '<ul class="promises">' +
          '<li><b>' + UNITS.length + ' יחידות, ' + LESSONS.length + ' שיעורים</b><span>תקציב, כסף מהשחרור, משכורת ראשונה, השקעות ומלכודות.</span></li>' +
          '<li><b>' + fmt(questions) + ' שאלות עם סיפורים</b><span>מצבים אמיתיים של אנשים בגילך. בלי חישובים.</span></li>' +
          '<li><b>משימה אמיתית בסוף כל שיעור</b><span>10 דקות בחוץ, וכסף שנשאר אצלך.</span></li>' +
        '</ul>' +
        '<div class="spacer"></div>' +
        '<button class="btn gold" data-act="onboard-next">יאללה, מתחילים</button>' +
        '<p class="fine center">' + esc(CFG.disclaimer) + '.</p></div>';
    }
    if (onboardStep === 1) {
      var cur = pickedStatus || S.status;
      return '<div class="welcome gutter">' +
        (onlyStatus ? '' : '<button class="icon-btn back-top" data-act="onboard-back" aria-label="אחורה">' + ICON.back + '</button>') +
        '<h1 class="q-prompt">מה המצב שלך?</h1>' +
        '<p class="lead">ככה נדע אילו שיעורים להראות. למשל, שיעורים על פיקדון ומענק שחרור מופיעים רק למי ששירת. אפשר לשנות בפרופיל.</p>' +
        '<div class="goal-pick">' + CFG.statuses.map(function (s) {
          return '<button class="btn ' + (cur === s.id ? '' : 'ghost') + ' goal-opt" data-act="pick-status" data-v="' + s.id + '" aria-pressed="' + (cur === s.id) + '">' +
            '<span><b>' + esc(s.label) + '</b><small>' + esc(s.note) + '</small></span></button>';
        }).join('') + '</div>' +
        '<div class="spacer"></div>' +
        '<button class="btn gold" data-act="' + (onlyStatus ? 'begin-status' : 'onboard-status') + '"' + (cur ? '' : ' disabled') + '>' + (onlyStatus ? 'שומרים' : 'המשך') + '</button></div>';
    }
    var goals = CFG.goals.map(function (g) {
      return '<button class="btn ' + (pickedGoal === g.xp ? '' : 'ghost') + ' goal-opt" data-act="pick-goal" data-xp="' + g.xp + '" aria-pressed="' + (pickedGoal === g.xp) + '">' +
        '<span><b>' + g.label + '</b><small>' + g.xp + ' נקודות ביום</small></span><span class="note">' + g.note + '</span></button>';
    }).join('');
    var avg = LESSONS.length ? Math.round(LESSONS.reduce(function (n, l) { return n + maxLessonPoints(l); }, 0) / LESSONS.length) : 0;
    return '<div class="welcome gutter">' +
      '<button class="icon-btn back-top" data-act="onboard-back" aria-label="אחורה">' + ICON.back + '</button>' +
      '<h1 class="q-prompt">מה היעד היומי?</h1>' +
      '<p class="lead">שיעור אחד שווה עד ' + avg + ' נקודות בערך. אפשר לשנות את זה מתי שרוצים.</p>' +
      '<div class="goal-pick">' + goals + '</div>' +
      '<div class="spacer"></div>' +
      '<button class="btn gold" data-act="begin">קבענו</button></div>';
  }

  function setStatus(v) {
    var changed = S.status !== v;
    S.status = v;
    indexContent();
    if (S.inProgress && !shown(BY_ID[S.inProgress.lessonId])) S.inProgress = null;
    save();
    if (changed) track('status_set', { status: v, $set: { status: v } });
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
    metaPut('uid', S.uid);
    track('push_subscribed', { endpoint: j.endpoint, p256dh: keys.p256dh, auth: keys.auth, hour: RCFG.hour, from: from, $set: { reminders: true } });
    flush();
  }
  function enableReminder(from) {
    var st = pushState();
    if (st === 'install') { installSheet(); return; }
    if (st === 'denied') { toast(ICON.bell + '<b>ההתראות חסומות.</b> מאפשרים אותן בהגדרות הדפדפן', '', 2600); return; }
    if (st !== 'off' || pushBusy) return;
    pushBusy = true;
    track('push_asked', { from: from });
    askNotify().then(function (perm) {
      if (perm !== 'granted') { track('push_denied', { from: from, permission: perm }); throw { quiet: perm }; }
      return swReady();
    }).then(subscribePush).then(function (sub) {
      pushBusy = false;
      saveSubscription(sub, from);
      render();
      toast(ICON.bell + '<b>סגור.</b> תזכורת כל יום ב-' + hourLabel(), 'info', 2600);
    }).catch(function (e) {
      pushBusy = false;
      if (e && e.quiet) {
        render();
        if (e.quiet === 'denied') toast(ICON.bell + '<b>ההתראות חסומות.</b> אפשר לאפשר אותן בהגדרות', '', 2600);
        return;
      }
      track('push_failed', { from: from, error: String((e && e.name) || e).slice(0, 60) });
      toast(ICON.bell + '<b>לא הצלחתי להפעיל תזכורת</b> בדפדפן הזה', '', 2600);
    });
  }
  function disableReminder(reason) {
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
    var daily = 'הודעה אחת ביום ב-' + hourLabel() + ', רק אם עוד לא עשית שיעור.';
    var note = st === 'install' ? 'באייפון זה עובד רק מהאפליקציה המותקנת במסך הבית.'
      : st === 'denied' ? 'ההתראות חסומות. מאפשרים אותן בהגדרות הדפדפן או הטלפון ופותחים שוב.'
      : (st === 'off' && !S.share) ? 'התזכורת נשלחת לפי נתוני השימוש. כדי להפעיל אותה מדליקים את השיתוף למטה.'
      : daily;
    var ctrl = (st === 'on' || (st === 'off' && S.share))
      ? '<button class="switch" role="switch" aria-labelledby="rem-l" aria-checked="' + (st === 'on') + '" data-act="reminder-toggle"></button>' : '';
    return '<div class="card"><div class="toggle-row"><h2 id="rem-l">תזכורת יומית</h2>' + ctrl + '</div><p class="fine">' + note + '</p>' +
      (st === 'install' ? '<button class="btn ghost" data-act="install">איך מתקינים</button>' : '') + '</div>';
  }

  // ---------- Install and updates ----------
  function installFlow() {
    track('install_clicked', { method: deferredInstall ? 'prompt' : IS_IOS ? 'ios_steps' : 'steps' });
    if (deferredInstall) {
      var p = deferredInstall;
      deferredInstall = null;
      p.prompt();
      if (p.userChoice) p.userChoice.then(function (c) { track('install_choice', { outcome: c.outcome }); render(); });
      return;
    }
    installSheet();
  }

  function registerSW() {
    if (IN_FRAME || !('serviceWorker' in navigator)) return;
    var local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (location.protocol !== 'https:' && !local) return;
    var had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(function () { /* offline mode unavailable */ });
    // a tap on the reminder while the app is already open (the worker brings it to the front)
    navigator.serviceWorker.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'push-click') track('push_clicked', { app_open: true });
    });
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!had) return;
      // a new version is ready: reload now on the home screen, otherwise at the next screen change
      if (view === 'home' && !sheetOpen) location.reload(); else pendingReload = true;
    });
  }

  // ---------- Events ----------
  function onClick(e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act'), id = el.getAttribute('data-id');
    switch (act) {
      case 'nav': setView(el.getAttribute('data-to')); break;
      case 'preview': sfx.tap(); previewSheet(id); break;
      case 'unit': unitSheet(id); break;
      case 'explain': explainSheet(el.getAttribute('data-what')); break;
      case 'legal': legalSheet(); break;
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
        awardXp(P.mission);
        save();
        track('mission_completed', { lesson_id: id });
        closeSheet(true);
        render();
        if (levelIndex(S.xp) > before) { levelUpSheet(); break; }
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
      case 'status': setStatus(el.getAttribute('data-v')); render(); break;
      case 'pick-status': pickedStatus = el.getAttribute('data-v'); sfx.tap(); render(); break;
      case 'onboard-status': if (pickedStatus) { onboardStep = 2; histPush({ onboard: 2 }); render(); window.scrollTo(0, 0); } break;
      case 'begin-status': if (pickedStatus) { setStatus(pickedStatus); setView('home'); } break;
      case 'pick-goal': pickedGoal = +el.getAttribute('data-xp'); sfx.tap(); render(); break;
      case 'onboard-next': onboardStep = 1; histPush({ onboard: 1 }); render(); window.scrollTo(0, 0); break;
      case 'onboard-back': if (HIST && histDepth > 0) history.back(); else { onboardStep = Math.max(0, onboardStep - 1); render(); } break;
      case 'begin':
        S.onboarded = true; S.goalXp = pickedGoal;
        setStatus(pickedStatus);
        track('onboarding_done', { goal_xp: pickedGoal, $set: { status: S.status, goal_xp: pickedGoal } });
        setView('home');
        break;
      case 'sound': S.sound = !S.sound; save(); render(); if (S.sound) sfx.right(0); break;
      case 'share':
        if (S.share) { if (S.reminder && S.reminder.on) disableReminder('analytics_off'); track('analytics_off', {}); flush(); }
        S.share = !S.share; save(); render();
        break;
      case 'install': installFlow(); break;
      case 'install-hide': S.installHidden = true; save(); render(); break;
      case 'reminder-on': enableReminder(el.getAttribute('data-from') || 'home'); break;
      case 'reminder-later':
        S.reminderNo = { count: ((S.reminderNo && S.reminderNo.count) || 0) + 1, day: dayKey() };
        save(); track('push_declined', { count: S.reminderNo.count }); render();
        break;
      case 'reminder-toggle':
        if (pushState() === 'on') { disableReminder('user'); render(); toast(ICON.bell + '<b>התזכורת כבויה</b>', '', 1800); }
        else enableReminder('profile');
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
        var ctx = el.getAttribute('data-ctx'), lid = el.getAttribute('data-id');
        track('feedback_sent', { rating: fbRating || null, text: text, context: ctx, lesson_id: lid || null });
        flush();
        if (!(CFG.analytics && CFG.analytics.posthogKey)) {
          var msg = 'משוב על ' + CFG.appName + (fbRating ? ' (' + fbRating + '/5)' : '') + (lid && BY_ID[lid] ? ' · שיעור "' + BY_ID[lid].title + '"' : '') + ':\n' + text;
          window.open('https://wa.me/' + ((CFG.feedback && CFG.feedback.whatsapp) || '') + '?text=' + encodeURIComponent(msg), '_blank');
        }
        openSheet('<h3>תודה!</h3><p class="lead">המשוב הגיע. ככה ' + esc(CFG.appName) + ' משתפרת.</p><button class="btn" data-act="close-sheet">סגירה</button>');
        sfx.pair();
        break;
      }
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
      case 'partner': track('partner_clicked', { partner: CFG.partner.name, lesson_id: id }); flush(); break;
      case 'reset':
        openSheet('<h3>לאפס את כל ההתקדמות?</h3><p class="lead">הנקודות, הרצף, השיעורים והמשימות יימחקו מהמכשיר הזה.</p>' +
          '<div class="row"><button class="btn ghost" data-act="close-sheet">ביטול</button><button class="btn bad" data-act="reset-confirm">לאפס</button></div>');
        break;
      case 'reset-confirm': {
        var uid = S.uid;
        if (S.reminder && S.reminder.on) disableReminder('reset');
        closeSheet(true); S = freshState(); S.uid = uid; onboardStep = 0; pickedStatus = null; session = null;
        track('progress_reset', {});
        save(); indexContent(); setView('home');
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
    } else if (e.key === 'Enter' && (typing || !e.target.closest('button'))) {
      e.preventDefault();
      if (st.kind === 'screen' || st.checked) next(); else check();
    }
  }

  function onVisibility() {
    if (document.visibilityState === 'hidden') {
      if (view === 'lesson' && session) {
        clockStop();
        snapshot();
        if (session.mode === 'lesson') track('lesson_paused', { lesson_id: session.lesson.id, step_index: session.idx, step_count: stepCount() });
      }
      flush();
    } else {
      if (view === 'lesson' && session) clockStart();
      else if (view === 'home' && !sheetOpen) render(); // a new day may have started
    }
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
    if (HIST) {
      try { history.scrollRestoration = 'manual'; } catch (e) { /* ignore */ }
      histReplace({ view: 'home' });
      window.addEventListener('popstate', onPop);
    }
    window.addEventListener('pagehide', function () { if (view === 'lesson') { clockStop(); snapshot(); } flush(); });
    window.addEventListener('online', flush);
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; });
    window.addEventListener('appinstalled', function () { track('app_installed', {}); S.installHidden = true; save(); if (view === 'home') render(); });
    // iOS starts audio only from a touch
    document.addEventListener('touchstart', function unlock() { if (S.sound) audio(); document.removeEventListener('touchstart', unlock); }, { passive: true });
    checkStreakBreak();
    track('app_opened', {
      returning: S.onboarded, lessons_done: doneCount(), xp: S.xp, streak: currentStreak(), source: OPEN_SOURCE, reminders: !!(S.reminder && S.reminder.on),
      $set: { status: S.status, goal_xp: S.goalXp, standalone: isStandalone() }, $set_once: { first_day: S.firstDay }
    });
    if (OPEN_SOURCE === 'push') track('push_clicked', { app_open: false });
    if (S.onboarded && S.status && S.inProgress) {
      var s = restoreSession(S.inProgress);
      if (s) {
        session = s;
        view = 'lesson';
        histEnter({ view: 'lesson' });
        track('lesson_resumed', { lesson_id: s.lesson.id, step_index: s.idx, step_count: s.steps.length, on_open: true });
      } else { S.inProgress = null; save(); }
    }
    render();
    if (view === 'lesson') toast(ICON.play + '<b>ממשיכים מאיפה שהפסקת</b>', 'info', 2000);
    registerSW();
    syncPush();
    flush();
  }

  if (window.LESSONS_DATA) boot(window.LESSONS_DATA);
  else fetch('data/lessons.json').then(function (r) { return r.json(); }).then(boot).catch(function () {
    document.getElementById('app').innerHTML = '<p class="gutter" style="padding-block:40px">לא הצלחתי לטעון את השיעורים. בודקים חיבור לאינטרנט ופותחים שוב.</p>';
  });
})();
