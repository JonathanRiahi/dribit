// Contrast check for every color, light and dark (WCAG). node tools/skins/check-skins.js: prints ratios, exits 1 on a failure.
const c=require('./color.js'),P=require('./palette.js'),{BASE,tint}=require('./neutrals.js');
const f=x=>x.toFixed(2);
function stops(arr,n=20){const o=[];for(let i=0;i<arr.length-1;i++)for(let j=0;j<=n;j++)o.push(c.mix(arr[i],arr[i+1],j/n));return o;}
const FIXED={light:{'gold-ink':'#8C6107','ok-ink':'#157541','bad-ink':'#A3302A','q-teal-ink':'#0B6B59','q-violet-ink':'#5B34B0','q-blue-ink':'#1D56A3','q-coral-ink':'#B4441F'},
 dark:{'gold-ink':'#F5C04A','ok-ink':'#35C274','bad-ink':'#EE6A61','q-teal-ink':'#5FD3B6','q-violet-ink':'#BCA3FF','q-blue-ink':'#8DB9F7','q-coral-ink':'#FFA586'}};
let fails=[],report={};
for(const s of P){report[s.id]={};
 for(const mode of ['light','dark']){
  const k=s[mode],N=tint(s,mode),r={};
  const T=(name,fg,bg,min=4.5)=>{const v=c.cr(fg,bg);r[name]=+f(v);if(v<min)fails.push(`${s.id} ${mode} ${name} ${f(v)} < ${min}`);};
  T('onBrand/brand',k.on,k.brand);
  T('brand/bg',k.brand,N.bg);T('brand/surface',k.brand,N.surface);T('brand/soft',k.brand,k.soft);T('brand/example-bg',k.brand,N['example-bg']);
  T('brand/surface-2',k.brand,N['surface-2'],3);
  T('white/deep',(mode==='light'&&s.id==='gold')?'#FFFFFF':'#FFFFFF',k.deep);
  T('ink/soft',N.ink,k.soft);T('ink-2/soft',N['ink-2'],k.soft);
  T('ink/bg',N.ink,N.bg);T('ink-2/bg',N['ink-2'],N.bg);T('ink-2/surface',N['ink-2'],N.surface);T('ink-2/surface-2',N['ink-2'],N['surface-2']);
  r['ink-3/bg']=+f(c.cr(N['ink-3'],N.bg));r['ink-3/surface']=+f(c.cr(N['ink-3'],N.surface));
  T('brand/bg nontext',k.brand,N.bg,3);
  T('onBrand along invite brand→b2',k.on,stops([k.brand,k.b2]).reduce((m,x)=>c.cr(k.on,x)<c.cr(k.on,m)?x:m));
  r['min onBrand/invite']=+f(Math.min(...stops([k.brand,k.b2]).map(x=>c.cr(k.on,x))));
  if(k.img){const m=Math.min(...stops(k.img).map(x=>c.cr(k.on,x)));r['min onBrand/img']=+f(m);if(m<4.5)fails.push(`${s.id} ${mode} onBrand on img ${f(m)}`);}
  if(k.mark){const m=Math.min(...stops(k.mark).map(x=>c.cr(x,N.bg)));r['min mark/bg']=+f(m);if(m<4.5)fails.push(`${s.id} ${mode} logo on bg ${f(m)}`);}
  // fixed accent inks on the (tinted) neutrals must not drop below what they have on the default neutrals (or 4.5)
  for(const [fn,fc] of Object.entries(FIXED[mode]))for(const bgk of ['bg','surface','surface-2','example-bg']){
   const now=c.cr(fc,N[bgk]),was=c.cr(fc,BASE[mode][bgk]);
   if(now<4.5&&now<was-0.05)fails.push(`${s.id} ${mode} ${fn}/${bgk} ${f(now)} (default ${f(was)})`);}
  r.neutrals=N;report[s.id][mode]=r;
 }}
// the generated block in styles.css must match gen-skins.js
const G=require('./gen-skins.js'),css=require('fs').readFileSync(require('path').join(__dirname,'../../styles.css'),'utf8');
if(css.indexOf(G.css())<0)fails.push('styles.css: the color block differs from gen-skins.js output (run node tools/skins/gen-skins.js --write)');
module.exports={report,fails};
if(require.main===module){
 for(const s of P)for(const m of ['light','dark']){const r=report[s.id][m];const {neutrals,...rest}=r;console.log(s.id,m,JSON.stringify(rest));}
 console.log('\nFAILS:',fails.length?'\n'+fails.join('\n'):'none');
 process.exit(fails.length?1:0);
}
