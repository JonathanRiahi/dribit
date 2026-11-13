const c=require('./color.js');
const BASE={
 light:{bg:'#F2F6F1',surface:'#FFFFFF','surface-2':'#E6EEE5',line:'#D3DFD4',ink:'#12302A','ink-2':'#4E655E','ink-3':'#7A8E87','example-bg':'#EEF5F1',lock:'#CBD5CC','lock-deep':'#A9B6AB'},
 dark:{bg:'#0C1714',surface:'#14221E','surface-2':'#1C2E29',line:'#26392F',ink:'#E7F1EC','ink-2':'#A9BDB5','ink-3':'#7C9188','example-bg':'#1A2C27',lock:'#2A3A35','lock-deep':'#1E2B27'}};
// tint every neutral to the skin hue, keeping OKLCH lightness and chroma (light surface stays white)
function tint(skin,mode){
 const out={...BASE[mode]};
 if(skin.id==='forest')return out;
 const hue=skin.hue!=null?skin.hue:c.toLch(skin.light.brand)[2];
 for(const k of Object.keys(out)){
  if(mode==='light'&&k==='surface')continue;
  const [L,C]=c.toLch(BASE[mode][k]);
  const k2=(k.startsWith('ink')&&skin.inkChroma)?skin.inkChroma:1;
  out[k]=c.fromLch(L,C*k2,hue);
 }
 return out;
}
module.exports={BASE,tint};
