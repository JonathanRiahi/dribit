// node render.js outdir fps [t1,t2,...]   (no times = full video)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const [out, fps, times] = [process.argv[2], +process.argv[3], process.argv[4] ? JSON.parse(process.argv[4]) : null];
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await p.goto('file://' + __dirname + '/engine3.html?s=' + process.argv[5]); await p.waitForFunction(() => window.READY);
  await p.evaluate(() => document.fonts.ready);
  const end = await p.evaluate(() => SPEC.total);
  const list = times || Array.from({ length: Math.round(end * fps) }, (_, i) => i / fps);
  let n = 0;
  for (const t of list) {
    await p.evaluate(t => render(t), t);
    const name = times ? `${process.argv[5]}_${String(t.toFixed(2)).padStart(5,'0')}` : String(n).padStart(4, '0');
    await p.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 93 });
    n++;
  }
  await b.close();
})();
