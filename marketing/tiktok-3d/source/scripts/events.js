// prints JSON: {total, cuts:[...], pops:[...]} for a spec
global.window = {}; require('./spec_' + process.argv[2] + '.js');
let t = 0; const cuts = [], pops = [];
for (const s of window.SPEC.scenes) {
  if (t > 0 && s.flash !== false) cuts.push(+t.toFixed(3));   // no whoosh on a seamless (no-flash) cut
  const at = s.at || ((s.cards || s.items) ? (s.cards || s.items).map((_, k) => 0.3 + k * 0.6) : []);
  at.forEach(a => pops.push(+(t + a).toFixed(3)));
  (s.taps || []).forEach(([a]) => pops.push(+(t + a).toFixed(3)));
  if (s.hl) pops.push(+(t + s.hl.at).toFixed(3));
  if (s.type === 'end') pops.push(+(t + 0.3).toFixed(3));
  t += s.dur;
}
console.log(JSON.stringify({ total: +t.toFixed(3), cuts, pops }));
