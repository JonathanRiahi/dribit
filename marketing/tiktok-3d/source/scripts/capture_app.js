// node capture_app.js outdir : screenshots of the real app (served on :8766) at 1170x2532, analytics blocked
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, serviceWorkers: 'block', locale: 'he-IL' });
  await ctx.route(/posthog|i\.posthog|eu\.i\.posthog|googletagmanager|google-analytics/, r => r.abort());
  const p = await ctx.newPage();
  p.on('pageerror', e => console.error('pageerror', e.message));
  await ctx.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    const today = new Date(); const dk = d => d.toISOString().slice(0, 10);
    const days = {}; for (let i = 0; i < 6; i++) { const d = new Date(today); d.setDate(d.getDate() - i); days[dk(d)] = 60; }
    localStorage.setItem('dribit.progress.v1', JSON.stringify({ v: 3, onboarded: true, status: 'sadir', xp: 1450, streak: 6, bestStreak: 6, lastDay: dk(new Date(today.getTime() - 864e5)), days, lessons: {}, firstDay: dk(new Date(today.getTime() - 6 * 864e5)), installSeen: true, installHidden: true }));
  });
  await p.goto('http://127.0.0.1:8766/index.html'); await p.waitForTimeout(1500);
  const closeSheets = async () => { for (let k = 0; k < 4; k++) { const open = await p.evaluate(() => { const bt = [...document.querySelectorAll('#sheet [data-act="close-sheet"]')].find(b => b.offsetParent !== null && b.innerText.trim()); if (bt) { bt.click(); return true; } const sc = document.querySelector('#sheet .scrim'); if (sc && sc.offsetParent !== null) { sc.click(); return true; } return false; }); if (!open) break; await p.waitForTimeout(500); } };
  await closeSheets();
  console.log('SHEET:', await p.evaluate(() => { const s = document.querySelector('#sheet'); return s ? s.innerText.replace(/\n+/g, ' | ').slice(0, 400) + ' || btns: ' + [...s.querySelectorAll('button,[data-act]')].map(b => (b.getAttribute('data-act') || '') + ':' + b.innerText.trim()).join(' ; ') : 'none'; }));
  await p.screenshot({ path: out + '/home.png' });
  await p.click('button.node[data-id="0.1"]'); await p.waitForTimeout(800);
  for (let i = 0; i < 14; i++) {
    const txt = await p.evaluate(() => document.body.innerText);
    await p.screenshot({ path: out + '/step' + i + '.png' });
    if (txt.includes('מה זה אומר?')) { console.log('question at step', i); break; }
    const btns = await p.$$eval('button', bs => bs.filter(b => b.offsetParent !== null && b.innerText.trim()).map(b => b.innerText.trim()));
    const pick = btns.find(x => /^(התחל|להתחיל|מתחילים|יאללה|המשך|הבא|קדימה|לשאלות|הבנתי|ממשיכים)/.test(x));
    console.log('step', i, 'pick:', pick, '| last buttons:', JSON.stringify(btns.slice(-4)));
    if (!pick) break;
    await p.getByRole('button', { name: pick, exact: true }).last().click(); await p.waitForTimeout(800);
  }
  await p.getByText('שאתה חייב כסף לבנק').first().click(); await p.waitForTimeout(400);
  await p.screenshot({ path: out + '/q_pick.png' });
  const btns = await p.$$eval('button', bs => bs.filter(b => b.offsetParent).map(b => b.innerText.trim()));
  console.log('buttons at q:', JSON.stringify(btns));
  const chk = btns.find(x => /בדיקה|לבדוק/.test(x)); if (chk) { await p.getByRole('button', { name: chk }).last().click(); await p.waitForTimeout(2200); }
  await p.screenshot({ path: out + '/q_ok.png' });
  console.log((await p.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ').slice(0, 400));
  await b.close();
})();
