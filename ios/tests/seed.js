// Test builds only. Puts a made-up progress on the simulator and reloads, so the workflow can open the app in a known
// state: `window.__seed` = 'ask' (one lesson done yesterday: the reminder question comes up) or 'reminder' (reminder on).
(async function () {
  var N = window.DribitNative;
  if (!N) return;
  function key(o) { var d = new Date(); d.setDate(d.getDate() + o); var m = d.getMonth() + 1, day = d.getDate(); return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day; }
  var mode = window.__seed || 'ask', days = {};
  days[key(-1)] = 60;
  var state = {
    v: 3, onboarded: true, status: 'sadir', goalXp: 50, sound: true, share: false, startUnit: null, uid: 'simulatortest', firstDay: key(-3), contentV: 0,
    xp: 60, streak: 1, bestStreak: 1, lastDay: key(-1), lostStreak: null, days: days, lessons: { '0.2': { done: true, best: 100, plays: 1 } },
    missions: {}, mistakes: {}, answered: 6, correct: 6, inProgress: null, ratings: {}, intent: {}, amount: {}, installHidden: false, installSeen: false,
    importedAt: null, ref: null, calc: null, reminder: mode === 'reminder' ? { on: true, native: true, hour: 18, since: key(-1) } : null, reminderNo: null,
    daysOff: 0, offLevel: 0, offSince: key(-3), offUsed: [], inviteOffDay: null, giftPending: false, giftGot: false, offIntroSeen: true, offRetro: 0,
    tools: { seen: [], introSeen: true, check: null, growth: null, fees: null, plan: null }, skins: { id: 'forest', seen: [], introSeen: true },
    checks: { start: null, done: {} }, energy: { n: 5, at: 0, seen: true }
  };
  if (mode === 'reminder') await N.call('debug.log', { text: 'seed provisional = ' + JSON.stringify(await N.call('debug.provisional')) });
  var json = JSON.stringify(state);
  localStorage.setItem('dribit.progress.v1', json);
  window.addEventListener('pagehide', function () { localStorage.setItem('dribit.progress.v1', json); }); // the page leaving must not put its own back
  await N.call('debug.log', { text: 'seed ' + mode + ' = saved' });
  location.reload();
})();
