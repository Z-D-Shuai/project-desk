// Ported directly from the user supplied 光暗滑块-修复版本.html. Geometry, OKLab ramps, dot pairs, drawing, pointer sampling and spring are retained.
export function mountDayNight(root,{initial=1,onCommit=()=>{},onPreview=()=>{}}={}){

/* ------------------------------------------------------------------ *
 *  光暗开关
 *  轨道里是夜与昼，按键是一块磨砂玻璃；月亮与太阳共用统一的圆角点阵图形语言。
 *  指针按下后按键完全跟手，任何位置都可停住：无级调节，只有松手
 *  才决定去往哪一端。键盘方向键可直达两端。
 * ------------------------------------------------------------------ */

var $ = function(id){ return root.querySelector('[data-sky="'+id+'"]'); };
var stage = $('stage'), cv = $('cv'), btn = $('sw');
var glowWarm = $('glowWarm'), glowCool = $('glowCool');
var ctx = cv.getContext('2d');

/* ---------- 几何（组件坐标 440×280，画布四周留 90 给光晕） ---------- */
var CW = 620, CH = 460, OX = 90, OY = 90;
var TW = 320, TH = 164, TX = 60, TY = 58, TR = 58;
var KS = 140, KR = 46, KIN = 12;
var TRAVEL = TW - KS - KIN * 2;          // 156
var KX0 = TX + KIN, KY0 = TY + KIN;      // 72, 70
var KRELC = KIN + KS / 2;                // 82，相对轨道
var SP = 5.6, DS = 3.7;                  // 点阵间距、点的大小
var DOT_N = 15;

/* ---------- 小工具 ---------- */
function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function lerp(a,b,u){ return a+(b-a)*u; }
function smoothstep(a,b,x){ var u=clamp((x-a)/(b-a),0,1); return u*u*(3-2*u); }
function smootherstep(a,b,x){ var u=clamp((x-a)/(b-a),0,1); return u*u*u*(u*(u*6-15)+10); }
function rgba(c,a){ if (a === undefined) a = 1; return 'rgba('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+','+clamp(a,0,1)+')'; }
function rgbCss(c){ return 'rgb('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+')'; }
function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------- OKLab 颜色 ---------- */
function srgb2lin(c){ return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function lin2srgb(c){ return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }
function hex2rgb(h){
  h = h.replace('#','');
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function rgb2oklab(rgb){
  var r = srgb2lin(rgb[0]/255), g = srgb2lin(rgb[1]/255), b = srgb2lin(rgb[2]/255);
  var l = Math.cbrt(0.4122214708*r + 0.5363325363*g + 0.0514459929*b);
  var m = Math.cbrt(0.2119034982*r + 0.6806995451*g + 0.1073969566*b);
  var s = Math.cbrt(0.0883024619*r + 0.2817188376*g + 0.6299787005*b);
  return [0.2104542553*l + 0.7936177850*m - 0.0040720468*s,
          1.9779984951*l - 2.4285922050*m + 0.4505937099*s,
          0.0259040371*l + 0.7827717662*m - 0.8086757660*s];
}
function oklab2lin(L,a,b){
  var l = Math.pow(L + 0.3963377774*a + 0.2158037573*b, 3);
  var m = Math.pow(L - 0.1055613458*a - 0.0638541728*b, 3);
  var s = Math.pow(L - 0.0894841775*a - 1.2914855480*b, 3);
  return [ 4.0767416621*l - 3.3077115913*m + 0.2309699292*s,
          -1.2684380046*l + 2.6097574011*m - 0.3413193965*s,
          -0.0041960863*l - 0.7034186147*m + 1.7076147010*s];
}
function oklab2rgb(L,a,b){
  L = clamp(L,0,1);
  var lin = oklab2lin(L,a,b), i, m;
  var bad = false;
  for (i=0;i<3;i++){ if (lin[i] < -0.0006 || lin[i] > 1.0006) bad = true; }
  if (bad){
    var lo = 0, hi = 1;
    for (i=0;i<18;i++){
      m = (lo+hi)/2;
      var t = oklab2lin(L, a*m, b*m);
      if (t[0] >= -0.0006 && t[0] <= 1.0006 && t[1] >= -0.0006 && t[1] <= 1.0006 &&
          t[2] >= -0.0006 && t[2] <= 1.0006) lo = m; else hi = m;
    }
    lin = oklab2lin(L, a*lo, b*lo);
  }
  return [clamp(lin2srgb(clamp(lin[0],0,1)),0,1)*255,
          clamp(lin2srgb(clamp(lin[1],0,1)),0,1)*255,
          clamp(lin2srgb(clamp(lin[2],0,1)),0,1)*255];
}
function mkRamp(list){
  return list.map(function(s){ return { t:s[0], lab:rgb2oklab(hex2rgb(s[1])) }; });
}
function ramp(stops,t){
  t = clamp(t,0,1);
  if (t <= stops[0].t) return oklab2rgb(stops[0].lab[0],stops[0].lab[1],stops[0].lab[2]);
  for (var i=1;i<stops.length;i++){
    var b = stops[i];
    if (t <= b.t){
      var a = stops[i-1];
      var u = (t - a.t) / ((b.t - a.t) || 1);
      return oklab2rgb(lerp(a.lab[0],b.lab[0],u), lerp(a.lab[1],b.lab[1],u), lerp(a.lab[2],b.lab[2],u));
    }
  }
  var z = stops[stops.length-1];
  return oklab2rgb(z.lab[0],z.lab[1],z.lab[2]);
}
function mixLab(A,B,u){ return oklab2rgb(lerp(A[0],B[0],u), lerp(A[1],B[1],u), lerp(A[2],B[2],u)); }

/* ---------- 色板：夜 → 昼，多段插值，避开死灰 ---------- */
var P = {
  page:   mkRamp([[0,'#0d1015'],[.16,'#12161d'],[.38,'#33363b'],[.60,'#7c7d7c'],[.80,'#c3c0ba'],[1,'#dcd9d4']]),
  track:  mkRamp([[0,'#07090c'],[.20,'#0b0d11'],[.44,'#4a4c50'],[.66,'#b3b1ad'],[.86,'#dad7d2'],[1,'#e5e2dd']]),
  trackHi:mkRamp([[0,'#0b0d11'],[.20,'#101318'],[.44,'#56585b'],[.66,'#bcbab5'],[.86,'#e9e7e2'],[1,'#f6f4f0']]),
  trackLo:mkRamp([[0,'#050608'],[.20,'#080a0d'],[.44,'#424447'],[.66,'#a3a19d'],[.86,'#d8d5cf'],[1,'#dedbd4']]),
  knobHi: mkRamp([[0,'#1f232b'],[.24,'#33373e'],[.46,'#7c7e81'],[.70,'#dcd9d3'],[1,'#fffaf2']]),
  knobLo: mkRamp([[0,'#0b0d11'],[.24,'#171a20'],[.46,'#5f6165'],[.70,'#b6b4af'],[1,'#f2ede4']]),
  edge:   mkRamp([[0,'#7d95ff'],[.30,'#a9c2ff'],[.52,'#ffffff'],[.74,'#ffc472'],[1,'#ff8f1f']])
};
var DOT_LIGHT = rgb2oklab(hex2rgb('#f6f4ec'));
var DOT_DARK  = rgb2oklab(hex2rgb('#232529'));
var WHITE = [255,255,255];

/* ---------- 状态 ---------- */
var t = initial, target = initial, vel = 0, springing = false;
var dragging = false, press = 0, pressTarget = 0;
var checked = initial>=.5;
var scale = 1, dpr = 1, lastTs = 0, rafId = 0;
var twTimer = 0, twinkleOn = false;
var reduced = false;
try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(e){}

checked = t >= 0.5;
btn.setAttribute('aria-checked', checked ? 'true' : 'false');

/* ---------- 路径工具 ---------- */
function rrPath(x,y,w,h,r){
  var p = new Path2D();
  p.moveTo(x+r,y);
  p.arcTo(x+w,y,x+w,y+h,r);
  p.arcTo(x+w,y+h,x,y+h,r);
  p.arcTo(x,y+h,x,y,r);
  p.arcTo(x,y,x+w,y,r);
  p.closePath();
  return p;
}
function addRR(p,x,y,w,h,r){
  p.moveTo(x+r,y);
  p.arcTo(x+w,y,x+w,y+h,r);
  p.arcTo(x+w,y+h,x,y+h,r);
  p.arcTo(x,y+h,x,y,r);
  p.arcTo(x,y,x+w,y,r);
  p.closePath();
}

/* 圆角矩形周长上的点，u=0 在上边中点，顺时针 */
function perimPoint(u, x, y, w, h, r){
  var segs = [
    { k:'l', x0:x+w/2, y0:y,     x1:x+w-r, y1:y,     len:w/2-r },
    { k:'a', cx:x+w-r, cy:y+r,   a0:-Math.PI/2, a1:0, len:Math.PI*r/2 },
    { k:'l', x0:x+w,   y0:y+r,   x1:x+w,   y1:y+h-r, len:h-2*r },
    { k:'a', cx:x+w-r, cy:y+h-r, a0:0, a1:Math.PI/2,  len:Math.PI*r/2 },
    { k:'l', x0:x+w-r, y0:y+h,   x1:x+r,   y1:y+h,   len:w-2*r },
    { k:'a', cx:x+r,   cy:y+h-r, a0:Math.PI/2,  a1:Math.PI, len:Math.PI*r/2 },
    { k:'l', x0:x,     y0:y+h-r, x1:x,     y1:y+r,   len:h-2*r },
    { k:'a', cx:x+r,   cy:y+r,   a0:Math.PI,    a1:Math.PI*1.5, len:Math.PI*r/2 },
    { k:'l', x0:x+r,   y0:y,     x1:x+w/2, y1:y,     len:w/2-r }
  ];
  var total = 0, i;
  for (i=0;i<segs.length;i++) total += segs[i].len;
  var dist = ((u % 1) + 1) % 1 * total, acc = 0;
  for (i=0;i<segs.length;i++){
    var s = segs[i];
    if (dist <= acc + s.len || i === segs.length-1){
      var f = s.len > 0 ? clamp((dist - acc) / s.len, 0, 1) : 0;
      if (s.k === 'l') return { x:lerp(s.x0,s.x1,f), y:lerp(s.y0,s.y1,f) };
      var a = lerp(s.a0,s.a1,f);
      return { x:s.cx + Math.cos(a)*r, y:s.cy + Math.sin(a)*r };
    }
    acc += s.len;
  }
  return { x:x+w/2, y:y };
}

/* ---------- 影子精灵（预模糊，逐帧只改变透明度） ---------- */
function sprite(w,h,draw){
  var S = 2, c = document.createElement('canvas');
  c.width = Math.round(w*S); c.height = Math.round(h*S);
  var g = c.getContext('2d');
  g.scale(S,S);
  draw(g);
  return c;
}
var trackShadow = sprite(540,380,function(g){
  g.shadowColor = 'rgba(0,0,0,1)';
  g.shadowBlur = 46; g.shadowOffsetY = 20;
  g.fillStyle = '#000';
  var p = rrPath(110, 96, TW, TH, TR);
  g.fill(p);
});
var knobShadow = sprite(320,320,function(g){
  g.shadowColor = 'rgba(0,0,0,1)';
  g.shadowBlur = 38; g.shadowOffsetY = 15;
  g.fillStyle = '#000';
  var p = rrPath(90, 80, KS, KS, KR);
  g.fill(p);
});

/* 噪点 */
var noisePattern = (function(){
  var n = document.createElement('canvas'); n.width = n.height = 96;
  var g = n.getContext('2d');
  var img = g.createImageData(96,96), d = img.data;
  var rnd = mulberry32(99);
  for (var i=0;i<d.length;i+=4){
    var v = 128 + (rnd()*2-1)*26;
    d[i] = d[i+1] = d[i+2] = v; d[i+3] = 255;
  }
  g.putImageData(img,0,0);
  return ctx.createPattern(n,'repeat');
})();

/* ---------- 点阵：月亮 ⇄ 太阳 ---------- */
function buildMoon(){
  var pts = [], x, y;
  /*
   * 月亮：用两个相交圆构成完整、厚实的弯月。
   * 外圆略向左，内圆向右偏移，让月牙开口朝右；
   * 不再保留原先低透明度的“残点”，轮廓会更干净。
   */
  var outerX = 6.5, outerY = 7.0, outerR = 6.2;
  var cutX = 9.6, cutY = 7.0, cutR = 5.4;
  for (y=0;y<DOT_N;y++){
    for (x=0;x<DOT_N;x++){
      var ox = x-outerX, oy = y-outerY;
      var cx = x-cutX, cy = y-cutY;
      var insideOuter = ox*ox + oy*oy <= outerR*outerR;
      var insideCut = cx*cx + cy*cy <= cutR*cutR;
      if (insideOuter && !insideCut){
        pts.push({ x:x, y:y, a:1 });
      }
    }
  }

  /* 一枚克制的四向微光，作为夜间识别点 */
  var star = [
    [12,3,1],
    [12,2,.48],[12,4,.48],
    [11,3,.48],[13,3,.48]
  ];
  for (var i=0;i<star.length;i++){
    pts.push({ x:star[i][0], y:star[i][1], a:star[i][2], star:true });
  }
  return pts;
}
function buildSun(){
  var pts = [], seen = {}, x, y, i;
  function add(x,y,a){
    var k = x+','+y;
    if (seen[k]) return;
    seen[k] = 1;
    pts.push({ x:x, y:y, a:(a==null?1:a) });
  }

  /*
   * 太阳与月亮共用同一套点阵语言：
   * 相同网格、相同圆角方点、相同点距与透明度。
   * 中心是完整的圆形日盘，外围为八方向的短点阵光芒。
   */
  var sunR = 2.45;
  for (y=0;y<DOT_N;y++){
    for (x=0;x<DOT_N;x++){
      var dx = x-7, dy = y-7;
      if (dx*dx + dy*dy <= sunR*sunR) add(x,y,1);
    }
  }

  /* 八向光芒全部由与月牙完全相同的圆角点构成 */
  var rays = [
    [7,3],[7,2],[7,1],
    [10,4],[11,3],[12,2],
    [11,7],[12,7],[13,7],
    [10,10],[11,11],[12,12],
    [7,11],[7,12],[7,13],
    [4,10],[3,11],[2,12],
    [3,7],[2,7],[1,7],
    [4,4],[3,3],[2,2]
  ];
  for (i=0;i<rays.length;i++) add(rays[i][0],rays[i][1],1);
  return pts;
}
function sortAngle(a){
  return a.slice().sort(function(p,q){
    return Math.atan2(p.y-7,p.x-7) - Math.atan2(q.y-7,q.x-7);
  });
}
var PAIRS = (function(){
  var M = sortAngle(buildMoon()), S = sortAngle(buildSun());
  var n = Math.max(M.length, S.length), rnd = mulberry32(20241114);
  var out = [];
  for (var i=0;i<n;i++){
    var m = M[i], s = S[i];
    out.push({
      mx: m ? m.x : null, my: m ? m.y : null, ma: m ? m.a : 0, star: m ? !!m.star : false,
      sx: s ? s.x : null, sy: s ? s.y : null, sa: s ? s.a : 0,
      d: rnd()*0.25,
      rot: 0.75 + rnd()*0.85,
      jx: (rnd()*2-1)*2.2,
      jy: (rnd()*2-1)*2.2,
      ph: rnd()*6.283
    });
  }
  return out;
})();

/* ---------- 每帧颜色 ---------- */
var C = {};
function colors(tt){
  C.page    = ramp(P.page, tt);
  C.track   = ramp(P.track, tt);
  C.trackHi = ramp(P.trackHi, tt);
  C.trackLo = ramp(P.trackLo, tt);
  C.knobHi  = ramp(P.knobHi, tt);
  C.knobLo  = ramp(P.knobLo, tt);
  C.edge    = ramp(P.edge, tt);
  C.dot     = mixLab(DOT_LIGHT, DOT_DARK, smoothstep(0.487, 0.497, tt));
  C.dotLab  = rgb2oklab(C.dot);
}

/* ---------- 灯（边缘光）位置 ---------- */
function lightU(){
  var e = 1 - Math.pow(1 - t, 2.2);
  return 0.60 + 0.53 * e;
}
function knobX(){ return KX0 + t*TRAVEL; }
function knobCX(){ return knobX() + KS/2; }
function knobCY(){ return KY0 + KS/2; }
function lightPoint(){
  var u = lightU();
  return perimPoint(u, knobX()-1.5, KY0-1.5, KS+3, KS+3, KR+1.5);
}

/* ---------- 画 ---------- */
function conicLight(cx, cy, rgb, u0, half, boost){
  var g;
  if (ctx.createConicGradient){
    g = ctx.createConicGradient(-Math.PI/2, cx, cy);
    var N = 96;
    for (var i=0;i<=N;i++){
      var u = i/N, d = u-u0;
      d -= Math.round(d);
      var f = Math.abs(d)/half;
      var a = Math.exp(-2.6*f*f) * boost;
      g.addColorStop(u, rgba(rgb, a));
    }
    return g;
  }
  var ang = -Math.PI/2 + u0*Math.PI*2;
  var dx = Math.cos(ang), dy = Math.sin(ang);
  g = ctx.createLinearGradient(cx-dx*KS*0.55, cy-dy*KS*0.55, cx+dx*KS*0.55, cy+dy*KS*0.55);
  g.addColorStop(0, rgba(rgb,0));
  g.addColorStop(.5, rgba(rgb, boost*0.9));
  g.addColorStop(1, rgba(rgb,0));
  return g;
}

function drawTrack(){
  var trackP = rrPath(TX,TY,TW,TH,TR);

  /* 影子 */
  ctx.save();
  ctx.globalAlpha = 0.56*(1-t) + 0.34*t;
  ctx.drawImage(trackShadow, TX-110, TY-96, 540, 380);
  ctx.restore();

  /* 主体 */
  var g = ctx.createLinearGradient(0,TY,0,TY+TH);
  g.addColorStop(0, rgba(C.trackHi));
  g.addColorStop(.42, rgba(C.track));
  g.addColorStop(1, rgba(C.trackLo));
  ctx.fillStyle = g;
  ctx.fill(trackP);

  /* 内凹 */
  ctx.save();
  ctx.clip(trackP);
  var sh = ctx.createLinearGradient(0,TY,0,TY+64);
  sh.addColorStop(0, 'rgba(0,0,0,'+(0.08+0.12*(1-t))+')');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(TX,TY,TW,70);

  var bev = ctx.createLinearGradient(0,TY,0,TY+TH);
  bev.addColorStop(0, 'rgba(0,0,0,'+(0.08+0.14*(1-t))+')');
  bev.addColorStop(.35, 'rgba(0,0,0,0)');
  bev.addColorStop(.70, 'rgba(255,255,255,0)');
  bev.addColorStop(1, 'rgba(255,255,255,'+(0.08+0.22*t)+')');
  ctx.lineWidth = 3;
  ctx.strokeStyle = bev;
  ctx.stroke(trackP);
  ctx.restore();

  /* 外圈一线光 */
  var rim = ctx.createLinearGradient(0,TY,0,TY+TH);
  var ra = 0.03 + 0.05*t;
  rim.addColorStop(0, 'rgba(255,255,255,'+(ra*0.9)+')');
  rim.addColorStop(.55, 'rgba(255,255,255,'+(ra*0.20)+')');
  rim.addColorStop(1, 'rgba(255,255,255,'+(ra*1.05)+')');
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = rim;
  ctx.stroke(trackP);

  /* 边缘光落在轨道底面的反光 */
  var lp = lightPoint();
  ctx.save();
  ctx.clip(trackP);
  ctx.globalCompositeOperation = 'lighter';
  var fy = Math.min(lp.y + 26, TY+TH-14);
  var fg = ctx.createRadialGradient(lp.x, fy, 4, lp.x, fy, 215);
  fg.addColorStop(0, rgba(C.edge, 0.13 + 0.09*(1-t)));
  fg.addColorStop(.36, rgba(C.edge, 0.055));
  fg.addColorStop(1, rgba(C.edge, 0));
  ctx.fillStyle = fg;
  ctx.fillRect(TX,TY,TW,TH);
  ctx.restore();
}

function drawKnob(){
  var kx = knobX(), ky = KY0, cx = kx+KS/2, cy = ky+KS/2;
  var knobP = rrPath(kx,ky,KS,KS,KR);

  /* 投影 */
  ctx.save();
  var sa = (0.58*(1-t) + 0.36*t) * (1 + 0.18*press);
  ctx.globalAlpha = clamp(sa,0,1);
  ctx.drawImage(knobShadow, kx-90, ky-80+press*4, 320, 320);
  ctx.restore();

  /* 玻璃主体 */
  var g = ctx.createLinearGradient(0,ky,0,ky+KS);
  g.addColorStop(0, rgba(C.knobHi));
  g.addColorStop(.52, rgba(C.knobLo));
  g.addColorStop(1, rgba(C.knobLo));
  ctx.fillStyle = g;
  ctx.fill(knobP);

  var lp = lightPoint();

  ctx.save();
  ctx.clip(knobP);

  /* 边缘光的染色 */
  var tint = ctx.createRadialGradient(lp.x, lp.y, 6, lp.x, lp.y, 152);
  tint.addColorStop(0, rgba(C.edge, 0.24 + 0.20*(1-t)));
  tint.addColorStop(.55, rgba(C.edge, 0.05 + 0.07*(1-t)));
  tint.addColorStop(1, rgba(C.edge, 0));
  ctx.fillStyle = tint;
  ctx.fillRect(kx,ky,KS,KS);

  /* 下半层的暗，玻璃厚度 */
  var bot = ctx.createLinearGradient(0,ky+KS*0.62,0,ky+KS);
  bot.addColorStop(0, 'rgba(0,0,0,0)');
  bot.addColorStop(1, 'rgba(0,0,0,'+(0.05 + 0.05*t)+')');
  ctx.fillStyle = bot;
  ctx.fillRect(kx,ky,KS,KS);

  /* 上半的白色光泽 */
  var gloss = ctx.createLinearGradient(0,ky,0,ky+KS*0.62);
  gloss.addColorStop(0, 'rgba(255,255,255,'+(0.08+0.30*t)+')');
  gloss.addColorStop(.55, 'rgba(255,255,255,'+(0.015+0.06*t)+')');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.fillRect(kx,ky,KS,KS*0.62);

  /* 内倒角 */
  var bev = ctx.createLinearGradient(0,ky,0,ky+KS);
  bev.addColorStop(0, 'rgba(255,255,255,'+(0.08+0.18*t)+')');
  bev.addColorStop(.5, 'rgba(255,255,255,0)');
  bev.addColorStop(1, 'rgba(0,0,0,'+(0.06+0.08*t)+')');
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = bev;
  ctx.stroke(knobP);

  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(0,0,0,'+(0.05 + 0.07*t)+')';
  ctx.stroke(knobP);

  ctx.restore();

  /* 外沿高光 */
  ctx.save();
  ctx.lineWidth = 1.15;
  ctx.strokeStyle = 'rgba(255,255,255,'+(0.12 + 0.38*t)+')';
  ctx.stroke(knobP);
  ctx.restore();

  return { kx:kx, ky:ky, cx:cx, cy:cy, knobP:knobP, lp:lp };
}

function drawEdgeLight(knob){
  var cx = knob.cx, cy = knob.cy;
  var u0 = lightU();
  var half = 0.22 + 0.06*(1-t);
  var boost = 0.55 + 0.45*(1-t);
  var lp = knob.lp;

  var lpPath = rrPath(knob.kx-0.5, knob.ky-0.5, KS+1, KS+1, KR+0.5);
  var grad = conicLight(cx, cy, C.edge, u0, half, 1);
  var coreRGB = mixLab(rgb2oklab(C.edge), rgb2oklab([255,255,255]), 0.92);
  var coreGrad = conicLight(cx, cy, coreRGB, u0, half*0.92, 1);

  ctx.save();
  if (t < 0.62) ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  var layers = [[64,0.012],[46,0.022],[33,0.040],[23,0.070],[16,0.115],[10,0.230],[5.2,0.400]];
  for (var i=0;i<layers.length;i++){
    ctx.globalAlpha = layers[i][1] * boost;
    ctx.strokeStyle = grad;
    ctx.lineWidth = layers[i][0];
    ctx.stroke(lpPath);
  }

  ctx.globalAlpha = 0.90;
  ctx.strokeStyle = coreGrad;
  ctx.lineWidth = 2.2;
  ctx.stroke(lpPath);

  ctx.globalAlpha = 0.55 + 0.2*(1-t);
  ctx.strokeStyle = coreGrad;
  ctx.lineWidth = 1.0;
  ctx.stroke(lpPath);

  var hot = conicLight(cx, cy, [255,250,238], u0, half*0.30, 1);
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = hot;
  ctx.lineWidth = 1.7;
  ctx.stroke(lpPath);

  /* 光点外的柔光 */
  var bloom = ctx.createRadialGradient(lp.x, lp.y, 0, lp.x, lp.y, 72);
  bloom.addColorStop(0, rgba(C.edge, 0.18*boost));
  bloom.addColorStop(.38, rgba(C.edge, 0.09*boost));
  bloom.addColorStop(1, rgba(C.edge, 0));
  ctx.globalAlpha = 1;
  ctx.fillStyle = bloom;
  ctx.fillRect(lp.x-72, lp.y-72, 144, 144);

  ctx.restore();
}

function drawDots(knob, now){
  var cx = knob.cx, cy = knob.cy;
  var tt = clamp(t,0,1);
  var wave = Math.sin(Math.PI*tt);
  var sc = 1 - 0.15*wave;
  var buckets = {};
  var night = 1 - smoothstep(0.05,0.4,tt);

  if (night > 0.01){
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var gl = ctx.createRadialGradient(cx,cy,2,cx,cy,76);
    gl.addColorStop(0, 'rgba(186,212,255,'+(0.13*night)+')');
    gl.addColorStop(1, 'rgba(186,212,255,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(cx-76,cy-76,152,152);
    ctx.restore();
  }

  for (var i=0;i<PAIRS.length;i++){
    var p = PAIRS[i];
    var e = smootherstep(0,1, clamp((tt - p.d)/(1 - p.d), 0, 1));
    var hasM = p.mx !== null, hasS = p.sx !== null;
    var gx, gy;
    if (hasM && hasS){ gx = lerp(p.mx,p.sx,e); gy = lerp(p.my,p.sy,e); }
    else if (hasM){ gx = p.mx; gy = p.my; }
    else { gx = p.sx; gy = p.sy; }

    if (wave > 0.0001){
      var ang = wave * p.rot;
      var ca = Math.cos(ang), sn = Math.sin(ang);
      var rx = gx-7, ry = gy-7;
      gx = 7 + rx*ca - ry*sn + p.jx*wave;
      gy = 7 + rx*sn + ry*ca + p.jy*wave;
    }

    var a;
    if (hasM && hasS) a = lerp(p.ma, p.sa, e);
    else if (hasM) a = p.ma * (1-e);
    else a = p.sa * e;

    if (p.star){
      var tw = 0.82 + 0.18*Math.sin(now*0.0022 + p.ph);
      var starFade = 1 - smoothstep(0.02,0.20,tt);

      /*
       * 星点只在夜间作为星光闪烁。
       * 点阵变形时，星点对应的目标太阳点必须继续显现；
       * 不能把整条配对轨迹一起淡出，否则太阳会缺少一段光芒。
       */
      if (hasM && hasS){
        a = lerp(p.ma * starFade * tw, p.sa, e);
      } else if (hasM){
        a *= starFade * tw;
      }
    }
    if (a < 0.012) continue;

    var sz = DS*sc;
    var px = cx + (gx-7)*SP, py = cy + (gy-7)*SP;
    var key = Math.round(a*22)/22;
    var path = buckets[key];
    if (!path){ path = new Path2D(); buckets[key] = path; }
    addRR(path, px-sz/2, py-sz/2, sz, sz, Math.min(1.1, sz*0.2));
  }

  var keys = Object.keys(buckets);
  for (var k=0;k<keys.length;k++){
    var al = parseFloat(keys[k]);
    ctx.fillStyle = rgba(C.dot, al);
    ctx.fill(buckets[keys[k]]);
  }

}

function drawGrain(){
  ctx.save();
  ctx.beginPath();
  var p = rrPath(TX,TY,TW,TH,TR);
  ctx.clip(p);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = noisePattern;
  ctx.fillRect(TX,TY,TW,TH);
  ctx.restore();
}

function updateAmbient(lp){
  var gx = 0.42*lp.x + 0.58*knobCX();
  var gy = 0.42*lp.y + 0.58*(KY0 + KS/2);
  var sx = OX + gx, sy = OY + gy;
  var w = smoothstep(0.30,0.95,t), c = 1 - smoothstep(0.08,0.68,t);
  var dip = 0.40 + 0.60*Math.abs(2*t-1);
  w *= dip; c *= dip;
  glowWarm.style.transform = 'translate3d(' + (sx-250) + 'px,' + (sy-250) + 'px,0)';
  glowCool.style.transform = 'translate3d(' + (sx-250) + 'px,' + (sy-250) + 'px,0)';
  glowWarm.style.opacity = (w*0.72).toFixed(3);
  glowCool.style.opacity = (c*0.72).toFixed(3);
}

function render(now){
  root.dataset.skyPosition=t.toFixed(4);root.dataset.skyDragging=String(dragging);
  colors(t);

  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,CW,CH);
  ctx.save();
  ctx.translate(OX,OY);

  drawTrack();
  var knob = drawKnob();
  drawEdgeLight(knob);
  drawDots(knob, now);
  drawGrain();

  ctx.restore();

  updateAmbient(knob.lp);
  onPreview(clamp(t,0,1),mixLab(rgb2oklab([36,34,31]),rgb2oklab([247,242,235]),clamp(t,0,1)));
  const mini=root.querySelector('[data-sky="mini"]');if(mini){const mg=mini.getContext('2d');mg.clearRect(0,0,mini.width,mini.height);mg.drawImage(cv,(OX+TX-6)*dpr,(OY+TY-6)*dpr,(TW+12)*dpr,(TH+12)*dpr,0,0,mini.width,mini.height);}
  updateThemeColor();
}

var lastPage = '', themeMeta = null;
function updateThemeColor(){
  if (!themeMeta) return;
  var c = rgbCss(C.page);
  if (c !== lastPage){ themeMeta.setAttribute('content', c); lastPage = c; }
}

/* ---------- 弹簧 ---------- */
function stepSpring(dt){
  if(reduced){t=target;vel=0;springing=false;return;}
  var w = 10;
  var n = Math.max(1, Math.ceil(dt/(1/240)));
  var h = dt/n;
  for (var i=0;i<n;i++){
    vel += (-w*w*(t-target) - 2*w*vel) * h;
    t += vel * h;
  }
  if (Math.abs(t-target) < 0.0005 && Math.abs(vel) < 0.004){
    t = target; vel = 0; springing = false;
  }
}

/* ---------- 循环 ---------- */
var inFrame=false;
function frame(now){
  inFrame=true;rafId = 0;
  var dt = lastTs ? Math.min(0.12, (now-lastTs)/1000) : 0.016;
  lastTs = now;

  var active = false;
  if (springing){ stepSpring(dt); active = true; }
  if (Math.abs(press-pressTarget) > 0.002){
    press += (pressTarget-press) * (1 - Math.exp(-14*dt));
    active = true;
    if (Math.abs(press-pressTarget) <= 0.002) press = pressTarget;
  } else press = pressTarget;

  render(now);

  if (active || dragging) schedule();
  else startTwinkle();
  inFrame=false;
}
function schedule(){
  if (!rafId){
    if(!inFrame)lastTs = performance.now();
    rafId = requestAnimationFrame(frame);
  }
}

/* 夜里星星轻轻闪，用一个慢一点的节拍 */
function startTwinkle(){
  if (reduced || document.hidden || !root.open || t > 0.30){ stopTwinkle(); return; }
  twinkleOn = true;
  if (!twTimer){
    twTimer = setTimeout(function(){
      twTimer = 0;
      if (!twinkleOn || document.hidden) return;
      render(performance.now());
      startTwinkle();
    }, 90);
  }
}
function stopTwinkle(){
  twinkleOn = false;
  if (twTimer){ clearTimeout(twTimer); twTimer = 0; }
}

/* ---------- 状态提交 ---------- */
function commitState(){
  var s = target >= 0.5;
  if (s !== checked){
    checked = s;
    btn.setAttribute('aria-checked', s ? 'true' : 'false');
    onCommit(s?'light':'dark');
    try { btn.dispatchEvent(new Event('change', { bubbles:true })); } catch(e){}
  } else {
    btn.setAttribute('aria-checked', checked ? 'true' : 'false');
  }
}

/* ---------- 拖动 ---------- */
var pointerId = null, grab = 0, startX = 0, startY = 0, movedPx = 0, samples = [], pressedKnob = false, outsidePress = false;

function localX(e){
  var r = btn.getBoundingClientRect();
  return (e.clientX - r.left) / (r.width / TW);
}
function localY(e){
  var r = btn.getBoundingClientRect();
  return (e.clientY - r.top) / (r.height / TH);
}

function tFromTrackX(x){
  return clamp((x - KRELC) / TRAVEL, 0, 1);
}

function onDown(e){
  if (dragging){
    if (e.pointerId !== pointerId) return;
  }
  if (e.pointerType === 'mouse' && e.button !== 0) return;

  var x = localX(e), y = localY(e);
  var kx = KIN + t*TRAVEL;
  var onKnob = x >= kx && x <= kx + KS && y >= KIN && y <= KIN + KS;
  pressedKnob = onKnob;

  dragging = true;
  pointerId = e.pointerId;
  startX = x; startY = y; movedPx = 0;
  samples = [];
  springing = false; vel = 0;

  springing = false; vel = 0;
  if (onKnob){
    grab = x - (KRELC + t*TRAVEL);
    outsidePress = false;
  } else {
    grab = 0;
    outsidePress = true;   // 先在原地按住，滑动过了阈值才接管
  }
  pressTarget = 1;
  if (e.pointerId !== undefined){
    try { btn.setPointerCapture(e.pointerId); } catch(err){}
  }
  btn.classList.add('dragging');
  stopTwinkle();
  schedule();
}

function onMove(e){
  if (!dragging || e.pointerId !== pointerId) return;
  var x = localX(e), y = localY(e);
  var dx = x - startX, dy = y - startY;
  movedPx = Math.max(movedPx, Math.sqrt(dx*dx + dy*dy));

  if (outsidePress){
    if (movedPx < 4){ schedule(); return; }
    outsidePress = false;
    grab = 0;
    samples = [];
  }

  var center = clamp(x - grab, KRELC, KRELC + TRAVEL);
  t = clamp((center - KRELC) / TRAVEL, 0, 1);
  target = t;

  var now = performance.now();
  samples.push({ t: t, ms: now });
  while (samples.length > 2 && now - samples[0].ms > 110) samples.shift();

  schedule();
}

function releaseSamples(){
  if (samples.length < 2) return 0;
  var a = samples[0], b = samples[samples.length-1];
  if (performance.now() - b.ms > 90) return 0;
  var dt = (b.ms - a.ms) / 1000;
  if (dt < 0.012) return 0;
  return clamp((b.t - a.t) / dt, -3, 3);
}

function onUp(e){
  if (!dragging || e.pointerId !== pointerId) return;
  var v = releaseSamples();
  var tap = movedPx < 4;

  if(tap){target=checked?0:1;}else{target=(t+v*0.06)>=0.5?1:0;}

  dragging = false;
  pointerId = null;
  pressTarget = 0;
  btn.classList.remove('dragging');
  vel = 0;
  springing = true;
  commitState();
  schedule();
  cleanupCapture(e);
}

function onCancel(e){
  if (!dragging || e.pointerId !== pointerId) return;
  dragging = false;
  pointerId = null;
  pressTarget = 0;
  btn.classList.remove('dragging');
  target = t >= 0.5 ? 1 : 0;
  springing = true;
  commitState();
  schedule();
  cleanupCapture(e);
}

function cleanupCapture(e){
  try { if (btn.hasPointerCapture(e.pointerId)) btn.releasePointerCapture(e.pointerId); } catch(err){}
}

btn.addEventListener('pointerdown', onDown);
btn.addEventListener('pointermove', onMove);
btn.addEventListener('pointerup', onUp);
btn.addEventListener('pointercancel', onCancel);
btn.addEventListener('lostpointercapture', function(e){
  if (dragging && e.pointerId === pointerId) onCancel(e);
});
btn.addEventListener('contextmenu', function(e){ e.preventDefault(); });
btn.addEventListener('dragstart', function(e){ e.preventDefault(); });

/* 键盘 */
btn.addEventListener('keydown', function(e){
  var k = e.key;
  if (k === ' ' || k === 'Spacebar' || k === 'Enter'){
    e.preventDefault();
    target = checked ? 0 : 1;
    springing = true;
    commitState();
    schedule();
  } else if (k === 'ArrowRight' || k === 'ArrowUp'){
    e.preventDefault();
    target = 1; springing = true; commitState(); schedule();
  } else if (k === 'ArrowLeft' || k === 'ArrowDown'){
    e.preventDefault();
    target = 0; springing = true; commitState(); schedule();
  } else if (k === 'Home' || k === 'End'){
    e.preventDefault();
    target = k === 'Home' ? 0 : 1; springing = true; commitState(); schedule();
  }
});

/* ---------- 尺寸 ---------- */
function layout(){
  var vw = window.innerWidth, vh = window.innerHeight;
  scale = root.open ? Math.min(.56, (Math.min(vw-48,320))/620) : .30;
  if (!isFinite(scale) || scale <= 0) scale = 0.5;
  stage.style.setProperty('--s', scale);

  var wantDpr = Math.min(window.devicePixelRatio || 1, 2.25);
  if (wantDpr !== dpr){
    dpr = wantDpr;
    cv.width = Math.round(CW*dpr);
    cv.height = Math.round(CH*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  render(performance.now());
}

window.addEventListener('resize', function(){ layout(); });
window.addEventListener('orientationchange', function(){ setTimeout(layout, 120); });
document.addEventListener('visibilitychange', function(){
  if (document.hidden){ stopTwinkle(); }
  else { stopTwinkle(); render(performance.now()); startTwinkle(); }
});

/* 页面颗粒：给大面积的渐变加一点抖动，压住色带 */
(function(){
  var c = document.createElement('canvas'); c.width = c.height = 128;
  var g = c.getContext('2d');
  var img = g.createImageData(128,128), d = img.data, rnd = mulberry32(4242);
  for (var i=0;i<d.length;i+=4){
    var v = rnd()*255; d[i] = d[i+1] = d[i+2] = v; d[i+3] = 255;
  }
  g.putImageData(img,0,0);
  var el = root.querySelector('[data-sky=grain]');
  if (el) el.style.backgroundImage = 'url(' + c.toDataURL() + ')';
})();

root.addEventListener('toggle',()=>{stopTwinkle();layout();if(root.open)startTwinkle();});
/* 初始化 */
layout();
render(performance.now());
if (t < 0.30) startTwinkle();


return {set(value,immediate=false){if(dragging)return;if(immediate){t=target=value;vel=0;springing=false;checked=value>=.5;btn.setAttribute('aria-checked',String(checked));render(performance.now());return;}target=value;checked=value>=.5;btn.setAttribute('aria-checked',String(checked));springing=true;schedule();},paint(){render(performance.now());}};
}
