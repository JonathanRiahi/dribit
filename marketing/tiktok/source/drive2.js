// usage: node drive.js outdir '["click:יאללה, מתחילים","shot:a", ...]'
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const out = process.argv[2], steps = JSON.parse(process.argv[3]);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: {width: 390, height: 844}, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'he-IL', colorScheme: 'dark', serviceWorkers: 'block',
    userAgent: 'Mozilla/5.0 (Linux; U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36' });
  await ctx.route(/posthog/, r => r.abort());
  const p = await ctx.newPage();
  await p.goto('http://localhost:8123/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  for (const s of steps) {
    const [cmd, ...rest] = s.split(':'); const arg = rest.join(':');
    try {
      if (cmd === 'click') { await p.getByText(arg, { exact: false }).filter({ visible: true }).first().click({ timeout: 3000 }); await p.waitForTimeout(700); }
      else if (cmd === 'exact') { await p.getByRole('button', { name: arg, exact: true }).filter({ visible: true }).first().click({ timeout: 3000 }); await p.waitForTimeout(700); }
      else if (cmd === 'css') { await p.locator(arg).filter({ visible: true }).first().click({ timeout: 3000 }); await p.waitForTimeout(700); }
      else if (cmd === 'shot') await p.screenshot({ path: `${out}/${arg}.png` });
      else if (cmd === 'inject') { await p.evaluate(() => { const K='dribit.progress.v1'; const st=JSON.parse(localStorage.getItem(K)); const ids=['2.1','2.2','2.3','3.1','3.2','1.3','4.1','4.2','4.3','4.4','6.4','6.3','4.5','4.6','6.5','1.2','3.3','5.3','5.1','5.2','5.5','1.1','1.4','6.1','6.2','7.1','7.2','7.3','5.4','7.4','7.5','8.1']; ids.forEach(i=>{st.lessons[i]={done:true,best:95,plays:1,fastest:300}; st.missions[i]={steps:[true,true,true],done:true};}); st.xp=1450; st.streak=6; st.bestStreak=6; const d=new Date(); const k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); st.lastDay=k; st.days[k]=60; localStorage.setItem(K, JSON.stringify(st)); }); await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(800); }
      else if (cmd === 'wait') await p.waitForTimeout(+arg);
      else if (cmd === 'js') console.log(JSON.stringify(await p.evaluate(arg)));
      else if (cmd === 'scroll') { await p.evaluate(y => { const el = document.scrollingElement; el.scrollBy(0, +y); document.querySelectorAll('*').forEach(e=>{ if (e.scrollHeight>e.clientHeight+20 && getComputedStyle(e).overflowY.match(/auto|scroll/)) e.scrollBy(0,+y); }); }, arg); await p.waitForTimeout(400); }
    } catch (e) { console.log('FAIL', s, e.message.split('\n')[0]); }
    if (cmd === 'click' || cmd === 'css' || cmd === 'list') {
      const btns = await p.$$eval('button, a, [role=button]', els => els.filter(e=>e.offsetParent).map(e => e.innerText.trim().replace(/\s+/g,' ').slice(0,40)).filter(Boolean));
      console.log(s, '=>', JSON.stringify(btns));
    }
  }
  await b.close();
})();
