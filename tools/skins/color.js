// WCAG 2.x contrast + OKLCH helpers (no deps)
function hex2rgb(h){h=h.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);}
function rgb2hex(c){return '#'+c.map(v=>Math.round(Math.min(1,Math.max(0,v))*255).toString(16).padStart(2,'0')).join('').toUpperCase();}
function lin(v){return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);}
function delin(v){return v<=0.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-0.055;}
function lum(h){const [r,g,b]=hex2rgb(h).map(lin);return 0.2126*r+0.7152*g+0.0722*b;}
function cr(a,b){const x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);}
function mix(a,b,t){const A=hex2rgb(a),B=hex2rgb(b);return rgb2hex(A.map((v,i)=>v+(B[i]-v)*t));}
function toOklab(h){const [r,g,b]=hex2rgb(h).map(lin);
 const l=Math.cbrt(0.4122214708*r+0.5363325363*g+0.0514459929*b),m=Math.cbrt(0.2119034982*r+0.6806995451*g+0.1073969566*b),s=Math.cbrt(0.0883024619*r+0.2817188376*g+0.6299787005*b);
 return [0.2104542553*l+0.7936177850*m-0.0040720468*s,1.9779984951*l-2.4285922050*m+0.4505937099*s,0.0259040371*l+0.7827717662*m-0.8086757660*s];}
function fromOklab([L,a,b]){const l=Math.pow(L+0.3963377774*a+0.2158037573*b,3),m=Math.pow(L-0.1055613458*a-0.0638541728*b,3),s=Math.pow(L-0.0894841775*a-1.2914855480*b,3);
 return [4.0767416621*l-3.3077115913*m+0.2309699292*s,-1.2684380046*l+2.6097574011*m-0.3413193965*s,-0.0041960863*l-0.7034186147*m+1.7076147010*s];}
function toLch(h){const [L,a,b]=toOklab(h);return [L,Math.hypot(a,b),(Math.atan2(b,a)*180/Math.PI+360)%360];}
function inGamut(c){return c.every(v=>v>=-1e-4&&v<=1+1e-4);}
function fromLch(L,C,H){let c=C;for(let i=0;i<60;i++){const r=fromOklab([L,c*Math.cos(H*Math.PI/180),c*Math.sin(H*Math.PI/180)]);if(inGamut(r))return rgb2hex(r.map(delin));c*=0.95;}return rgb2hex(fromOklab([L,0,0]).map(delin));}
module.exports={hex2rgb,rgb2hex,lum,cr,mix,toLch,fromLch};
