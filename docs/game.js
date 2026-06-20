// =============================================
//  EDF MINI GAME  —  Portrait 9:16  (405×720)
// =============================================
'use strict';

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

// ─── Canvas (portrait 9:16) ──────────────────────────────────────────────────
const W = 405, H = 720;
canvas.width = W; canvas.height = H;

function resize() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width  = (W * s) + 'px';
  canvas.style.height = (H * s) + 'px';
}
resize();
window.addEventListener('resize', resize);

// ─── Pseudo-3D Perspective ───────────────────────────────────────────────────
const VP   = { x: W / 2, y: Math.round(H * 0.30) };  // 消失点 (画面上30%)
const GY   = H - 80;                                   // 地面Y (プレイヤー足元)
const ROAD = 185;                                      // レーン半幅 (depth=1時)

function proj(laneX, depth) {
  return {
    x: VP.x + laneX * ROAD * depth,
    y: VP.y + (GY - VP.y) * depth,
  };
}
function projR(baseR, depth) { return Math.max(1.5, baseR * depth * 2.0); }

// ─── Lane System ─────────────────────────────────────────────────────────────
const LANE_X    = [-0.58, 0.0, 0.58];
const LANE_NAME = ['A', 'B', 'C'];
function laneScreenX(li) { return VP.x + LANE_X[li] * ROAD; }

// ─── Constants ────────────────────────────────────────────────────────────────
const PLAYER_H       = 120;
const PLAYER_WALK_W  = Math.round(300 * (PLAYER_H / 480)); // 75px
const SHOOT_MS       = 280;
const LANE_SWITCH_CD = 220;
const INIT_ATK       = 10;
const INIT_BSPD      = 20;
const INIT_BCNT      = 1;
const INIT_HP        = 1000;
const INIT_DEFENSE   = 1000;
const INIT_ENEMIES   = 10_000_000;

// ─── TGS ブース情報（イベント当日に変更） ────────────────────────────────────
const TGS_HALL  = '●';   // 例: '1'
const TGS_BOOTH = '●●';  // 例: '東1ホール N12'

// ─── GameOver ボタン ──────────────────────────────────────────────────────────
let goBtn1 = null; // 証明書ボタン
let goBtn2 = null; // リトライボタン

function atkStars(v) {
  if (v < 20) return 1; if (v < 40) return 2;
  if (v < 60) return 3; if (v < 80) return 4; return 5;
}
function brsStars(v) {
  if (v < 2) return 1; if (v < 4) return 2;
  if (v < 6) return 3; if (v < 8) return 4; return 5;
}

// ─── Enemy Definitions ───────────────────────────────────────────────────────
const EDEFS = [
  { id:'ant_s',    color:'#ff4422', edge:'#aa1100', r:12, hp:10,   depthSpd:0.000125, dmg:8,  dropMin:0.05, dropMax:0.10 },
  { id:'ant_m',    color:'#ff4422', edge:'#aa1100', r:21, hp:600,  depthSpd:0.000080, dmg:15, dropMin:0.10, dropMax:0.20 },
  { id:'ant_l',    color:'#dd2200', edge:'#880000', r:36, hp:1200, depthSpd:0.000040, dmg:30, dropMin:0.20, dropMax:0.30 },
  { id:'spider_s', color:'#cc44ff', edge:'#7700aa', r:12, hp:15,   depthSpd:0.000100, dmg:8,  dropMin:0.05, dropMax:0.15 },
  { id:'spider_m', color:'#cc44ff', edge:'#7700aa', r:22, hp:800,  depthSpd:0.000060, dmg:18, dropMin:0.15, dropMax:0.25 },
  { id:'spider_l', color:'#aa22ee', edge:'#550088', r:38, hp:1600, depthSpd:0.000030, dmg:35, dropMin:0.25, dropMax:0.35 },
  { id:'bee_s',    color:'#ffcc00', edge:'#aa7700', r:10, hp:10,   depthSpd:0.000150, dmg:6,  dropMin:0.05, dropMax:0.10 },
  { id:'bee_m',    color:'#ffcc00', edge:'#aa7700', r:17, hp:500,  depthSpd:0.000090, dmg:12, dropMin:0.10, dropMax:0.20 },
  { id:'bee_l',    color:'#ffaa00', edge:'#885500', r:30, hp:1000, depthSpd:0.000045, dmg:25, dropMin:0.20, dropMax:0.30 },
];

const PU_TYPES = ['atk', 'spd', 'bsr'];
const PU_COLOR = { atk:'#ff4444', spd:'#44aaff', bsr:'#44ff44', dwn:'#aa00ff' };
const PU_LABEL = { atk:'ATK ↑', spd:'SPD ↑', bsr:'BRS ↑', atk_max:'ATK MAX!', spd_max:'SPD MAX!', bsr_max:'BRS MAX!', dwn:'DWN ↓' };

// ─── Audio ───────────────────────────────────────────────────────────────────
const AC = new (window.AudioContext || window['webkitAudioContext'])();

function beep({ type='square', f=440, f2=f, dur=0.1, vol=0.18, delay=0 }) {
  const t = AC.currentTime + delay;
  const o = AC.createOscillator(), g = AC.createGain();
  o.connect(g); g.connect(AC.destination);
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.start(t); o.stop(t + dur);
}
function snd(name) {
  if (AC.state === 'suspended') return;
  switch (name) {
    case 'shoot':    beep({ type:'sawtooth', f:480, f2:100, dur:0.07, vol:0.14 }); break;
    case 'die_s':    beep({ f:580, f2:160, dur:0.10, vol:0.10 }); break;
    case 'die_m':    beep({ type:'square', f:240, f2:55, dur:0.22, vol:0.18 }); break;
    case 'die_l':    beep({ type:'sawtooth', f:110, f2:25, dur:0.48, vol:0.30 }); break;
    case 'powerup':     [0,0.10,0.20].forEach((d,i)=>beep({ f:[440,550,660][i], dur:0.15, vol:0.15, delay:d })); break;
    case 'powerdown':   [0,0.10,0.20].forEach((d,i)=>beep({ f:[660,550,440][i], dur:0.15, vol:0.22, delay:d })); break;
    case 'dwn_warning': [0,0.15,0.30,0.45,0.60].forEach((d,i)=>beep({ f:i%2===0?920:660, dur:0.14, vol:0.28, delay:d })); break;
    case 'damage':   beep({ type:'square', f:75, dur:0.14, vol:0.25 }); break;
    case 'gameover': beep({ type:'sawtooth', f:170, f2:38, dur:1.6, vol:0.30 }); break;
    case 'lanemove': beep({ type:'sine', f:660, f2:880, dur:0.06, vol:0.08 }); break;
  }
}

// ─── Images ──────────────────────────────────────────────────────────────────
const imgs = {};
let loaded = 0, toLoad = 0;
function loadImg(key, src) {
  toLoad++;
  const el = new Image();
  el.onload = el.onerror = () => loaded++;
  el.src = src;
  imgs[key] = el;
}
loadImg('bg', 'assets/images/bg.png');
loadImg('barricade',         'assets/images/barricade_normal.png');
loadImg('barricade_damaged', 'assets/images/barricade_damaged.png');
loadImg('fx_barricade_hit',   'assets/images/fx_barricade_hit.png');
loadImg('fx_barricade_hit_2', 'assets/images/fx_barricade_hit_2.png');
loadImg('fx_hit_player',      'assets/images/fx_hit_player.png');
loadImg('fx_hit_bullet',      'assets/images/fx_hit_bullet.png');
loadImg('notif_atk', 'assets/images/notif_atk.png');
loadImg('notif_spd', 'assets/images/notif_spd.png');
loadImg('notif_bsr', 'assets/images/notif_bsr.png');
loadImg('notif_atk_max', 'assets/images/ui/atk_max.png');
loadImg('notif_spd_max', 'assets/images/ui/spd_max.png');
loadImg('notif_bsr_max', 'assets/images/ui/brs_max.png');
loadImg('edf_icon',         'assets/images/edf_icon.png');
loadImg('cert_count_frame', 'assets/images/cert_count_frame.png');
loadImg('cert_rank_bar',    'assets/images/cert_rank_bar.png');
loadImg('cert_stamp',       'assets/images/cert_stamp.png');
loadImg('cert_bg',          'assets/images/cert_bg.png');
for (let i = 1; i <= 4; i++) {
  loadImg(`wc${i}`, `assets/images/player/walk_c_${i}.png`);
  loadImg(`wb${i}`, `assets/images/player/walk_b_${i}.png`);
  for (const t of ['ant_s','ant_m','ant_l','spider_s','spider_m','spider_l','bee_s','bee_m','bee_l']) {
    loadImg(`${t}_w${i}`, `assets/images/${t}_walk_${i}.png`);
  }
}
for (const t of ['ant_s','ant_m','ant_l','spider_s','spider_m','spider_l','bee_s','bee_m','bee_l']) {
  for (let i = 1; i <= 2; i++) {
    loadImg(`${t}_d${i}`, `assets/images/${t}_die_${i}.png`);
  }
}
loadImg('hit1', 'assets/images/hit_1.png');
loadImg('hit2', 'assets/images/hit_2.png');
for (const type of ['atk', 'spd', 'bsr', 'dwn']) {
  loadImg(`item_${type}_fall1`, `assets/images/item_${type}_fall_1.png`);
  loadImg(`item_${type}_fall2`, `assets/images/item_${type}_fall_2.png`);
  loadImg(`item_${type}_land`,  `assets/images/item_${type}_land.png`);
}

// ─── Game State ───────────────────────────────────────────────────────────────
let gstate      = 'loading';
let lastTs      = 0;
let gameMs      = 0;
let enemyCount  = INIT_ENEMIES;
let spawnTmr    = 0;
let radarAng    = 0;
let roundIdx      = 0;
let roundTimer    = 0;
let roundBanner   = { text:'ROUND 1', timer:1500, color:'#ffdd00' };
let bgScroll      = 0;
let defenseHp     = INIT_DEFENSE;
let loopCount     = 0;   // LAST WAVE 通過回数
let hpBonus       = 0;   // LAST WAVE ごとに +2000
let gameResult    = 'defeat'; // 'defeat' | 'victory'
let dwnWarning    = 0;   // ATK MAX in STAGE∞ → 2秒警告タイマー(ms)
// barricadeHitFx removed

const pl = {
  lane:     1,
  screenX:  W / 2,
  hp:       INIT_HP, maxHp: INIT_HP,
  atk:      INIT_ATK, bspd: INIT_BSPD, bcnt: INIT_BCNT,
  frm:      0, frmTmr: 0, shootTmr: 0,
  laneCd:   0, damageFx: 0, notif: null,
  burst: 1, burstLeft: 0, burstTimer: 0, burstToggle: false,
};

let bullets   = [];
let enemies   = [];
let powerups  = [];
let particles = [];
let splashes  = [];

// ─── Input ───────────────────────────────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', e => { keys[e.key] = true;  resume(); });
window.addEventListener('keyup',   e => { keys[e.key] = false; });

canvas.addEventListener('touchstart', e => {
  e.preventDefault(); resume();
  if (gstate === 'gameover') return;
  const rect = canvas.getBoundingClientRect();
  const tx = (e.touches[0].clientX - rect.left) * (W / rect.width);
  const ty = (e.touches[0].clientY - rect.top)  * (H / rect.height);
  // レーダー（右上）タップ → PAUSE
  if (gstate === 'playing' && tx > W - 94 && ty < 99) { togglePause(); return; }
  // バリケードエリア（画面下部）タップ
  if (gstate === 'playing' && ty > H - 70) {
    const isMob = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (!isMob && tx > W * 0.68) {  // デスクトップのみ右バリケード → DEBUG
      if (typeof toggleDebug === 'function') toggleDebug();
      return;
    }
    // 左・右端はそのまま通常の移動処理へ（中央バリケードPAUSEは廃止）
  }
  if (paused) return;
  if (tx < W * 0.38)      tryLaneMove(-1);
  else if (tx > W * 0.62) tryLaneMove(+1);
}, { passive: false });
canvas.addEventListener('touchend', e => {
  e.preventDefault();
  if (gstate === 'gameover') {
    const rect = canvas.getBoundingClientRect();
    const tx = (e.changedTouches[0].clientX - rect.left) * (W / rect.width);
    const ty = (e.changedTouches[0].clientY - rect.top)  * (H / rect.height);
    handleGoTap(tx, ty);
  }
}, { passive: false });
canvas.addEventListener('click', e => {
  resume();
  const rect = canvas.getBoundingClientRect();
  const tx = (e.clientX - rect.left) * (W / rect.width);
  const ty = (e.clientY - rect.top)  * (H / rect.height);
  if (gstate === 'gameover') { handleGoTap(tx, ty); return; }
  if (gstate === 'playing' && tx > W - 94 && ty < 99) { togglePause(); return; }
  if (gstate === 'playing' && ty > H - 70 && tx > W * 0.68) {
    if (typeof toggleDebug === 'function') toggleDebug();
  }
});
function handleGoTap(tx, ty) {
  const hit = b => b && tx >= b.x && tx <= b.x+b.w && ty >= b.y && ty <= b.y+b.h;
  if (hit(goBtn1)) shareToX();
  else if (hit(goBtn2)) resetGame();
}

function resume() { if (AC.state === 'suspended') AC.resume(); }

// ─── Utilities ────────────────────────────────────────────────────────────────
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function rnd(a, b)         { return a + Math.random() * (b - a); }

function tryLaneMove(dir) {
  if (pl.laneCd > 0) return;
  const next = clamp(pl.lane + dir, 0, 2);
  if (next === pl.lane) return;
  pl.lane   = next;
  pl.laneCd = LANE_SWITCH_CD;
  snd('lanemove');
}

function drawStar(cx, cy, pts, ro, ri) {
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const a = i * Math.PI / pts - Math.PI / 2;
    const r = i % 2 === 0 ? ro : ri;
    i === 0 ? ctx.moveTo(cx+r*Math.cos(a), cy+r*Math.sin(a))
            : ctx.lineTo(cx+r*Math.cos(a), cy+r*Math.sin(a));
  }
  ctx.closePath();
}
function rrect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

// 線分(ax,ay)-(bx,by) と 円(cx,cy,r) の交差判定（貫通防止用）
function segCircleHit(ax, ay, bx, by, cx, cy, r) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx*dx + dy*dy;
  if (lenSq === 0) return Math.hypot(ax-cx, ay-cy) < r;
  const t = Math.max(0, Math.min(1, ((cx-ax)*dx + (cy-ay)*dy) / lenSq));
  return Math.hypot(ax + t*dx - cx, ay + t*dy - cy) < r;
}

// ─── Round System ─────────────────────────────────────────────────────────────
const ROUNDS = [
  // index 0
  { type:'round', num:1, dur:60000, phases:[
    { until:20000, batch:2, pool:'s',   interval:500 },
    { until:40000, batch:2, pool:'s',   interval:500 },
    { until:60000, batch:2, pool:'sm',  interval:500 },
  ]},
  // index 1
  { type:'round', num:2, dur:60000, phases:[
    { until:20000, batch:3, pool:'s',   interval:400 },
    { until:40000, batch:3, pool:'sm',  interval:400 },
    { until:60000, batch:3, pool:'sm',  interval:400 },
  ]},
  // index 2
  { type:'wave', waveNum:1, label:'WAVE 1', dur:30000, pool:'sm',  interval:300, batch:2, hpMult:1.25 },
  // index 3
  { type:'round', num:3, dur:60000, phases:[
    { until:20000, batch:3, pool:'sm',  interval:400 },
    { until:40000, batch:3, pool:'sm',  interval:400 },
    { until:60000, batch:3, pool:'sml', interval:400 },
  ]},
  // index 4
  { type:'round', num:4, dur:60000, phases:[
    { until:20000, batch:4, pool:'sm',  interval:300 },
    { until:40000, batch:4, pool:'sml', interval:300 },
    { until:60000, batch:4, pool:'sml', interval:300 },
  ]},
  // index 5
  { type:'wave', waveNum:2, label:'WAVE 2', dur:30000, pool:'sml', interval:200, batch:5, hpMult:3.0 },
  // index 6
  { type:'round', num:5, dur:60000, phases:[
    { until:20000, batch:4, pool:'sml', interval:200 },
    { until:40000, batch:4, pool:'sml', interval:200 },
    { until:60000, batch:4, pool:'sml', interval:200 },
  ]},
  // index 7 ― LAST Wave 後は Round 3（index=3）に戻ってループ
  { type:'wave', label:'LAST WAVE', dur:30000, pool:'l', interval:200, batch:5, loopTo:3, hpMult:5.0 },
];

function getPool(key) {
  if (key === 's')   return EDEFS.filter(d => d.id.endsWith('_s'));
  if (key === 'sm')  return EDEFS.filter(d => !d.id.endsWith('_l'));
  if (key === 'l')   return EDEFS.filter(d => d.id.endsWith('_l'));
  return EDEFS; // 'sml'
}

// ─── Spawn ────────────────────────────────────────────────────────────────────
function spawnEnemy(pool, hpMult = 1, maxMultOverride = null) {
  const def = pool[Math.floor(Math.random() * pool.length)];
  const li  = Math.floor(Math.random() * 3);
  const atkCap = loopCount > 0 ? 500 : 100;
  const maxed = (pl.atk >= atkCap ? 1 : 0) + (pl.bspd >= 100 ? 1 : 0) + (pl.burst >= 10 ? 1 : 0);
  const maxMult = maxMultOverride !== null ? maxMultOverride
    : (maxed >= 3 ? 5 : maxed >= 2 ? 7.5 : maxed >= 1 ? 5 : 1);
  const totalHp = Math.round(def.hp * hpMult * maxMult) + hpBonus;
  enemies.push({
    ...def, laneIndex: li, laneX: LANE_X[li],
    depth: 0.05, hp: totalHp, currentHp: totalHp, hitFx: 0,
    animFrame: 0, animTimer: 0,
    dying: false, dieFrame: 0, dieTimer: 0,
  });
}

// ─── Fire ─────────────────────────────────────────────────────────────────────
function getLanesToFire() {
  if (pl.bcnt >= 3) return [0, 1, 2];
  if (pl.bcnt === 2) {
    const adj = pl.lane > 0 ? pl.lane - 1 : pl.lane + 1;
    return [pl.lane, adj];
  }
  return [pl.lane];
}

function fire() {
  const gunSY    = GY - PLAYER_H * 0.90;
  const gunDepth = clamp((gunSY - VP.y) / (GY - VP.y), 0.01, 1.0);
  const spd      = 0.38 + pl.bspd * 0.030;
  for (const li of getLanesToFire()) {
    const LANE_GUN_X = [-10, 0, 10]; // A=左10px, B=なし, C=右10px
    const startSX = VP.x + LANE_X[li] * ROAD * gunDepth + LANE_GUN_X[li];
    const dx = VP.x - startSX, dy = VP.y - gunSY;
    const len = Math.hypot(dx, dy);
    bullets.push({ sx:startSX, sy:gunSY, vx:dx/len*spd, vy:dy/len*spd, dmg:pl.atk, laneIndex:li });
  }
  snd('shoot');
}

// ─── Particles ────────────────────────────────────────────────────────────────
function burst(sx, sy, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = rnd(1,5);
    particles.push({ x:sx, y:sy, vx:Math.cos(a)*s, vy:Math.sin(a)*s-1,
      r:rnd(2,5), color, life:1, decay:rnd(0.025,0.055) });
  }
}

// ─── Reset ────────────────────────────────────────────────────────────────────
function resetGame() {
  Object.assign(pl, {
    lane:1, screenX:W/2, hp:INIT_HP,
    atk:INIT_ATK, bspd:INIT_BSPD, bcnt:INIT_BCNT,
    frm:0, frmTmr:0, shootTmr:0,
    laneCd:0, damageFx:0, notif:null,
    burst:1, burstLeft:0, burstTimer:0, burstToggle:false,
  });
  bullets=[]; enemies=[]; powerups=[]; particles=[]; splashes=[];
  enemyCount=INIT_ENEMIES; spawnTmr=0; gameMs=0;
  roundIdx=0; roundTimer=0; bgScroll=0;
  defenseHp=INIT_DEFENSE;
  loopCount=0; hpBonus=0; gameResult='defeat'; dwnWarning=0;
  roundBanner={ text:'ROUND 1', timer:1500, color:'#ffdd00' };
  gstate='playing';
}

// ─── Update ───────────────────────────────────────────────────────────────────
function update(dt) {
  gameMs += dt;
  radarAng = (radarAng + 1.4 * (dt / 16.7)) % 360;
  bgScroll = (bgScroll + 0.000100 * enemySpeedMult * dt) % 1;

  if (pl.laneCd > 0) pl.laneCd -= dt;
  if (keys['ArrowLeft']  || keys['a'] || keys['A']) tryLaneMove(-1);
  if (keys['ArrowRight'] || keys['d'] || keys['D']) tryLaneMove(+1);

  const targetX = laneScreenX(pl.lane);
  pl.screenX += (targetX - pl.screenX) * Math.min(1, 0.022 * dt);

  const moving = Math.abs(pl.screenX - targetX) > 3;
  pl.frmTmr += dt;
  if (pl.frmTmr >= (moving ? 110 : 180)) { pl.frmTmr=0; pl.frm=(pl.frm+1)%4; }

  pl.shootTmr += dt;
  if (pl.shootTmr >= SHOOT_MS) {
    pl.shootTmr = 0;
    // 0.5刻みバースト：端数は交互に切り上げ/切り捨て
    const frac = pl.burst % 1;
    const shots = frac > 0
      ? (pl.burstToggle ? Math.ceil(pl.burst) : Math.floor(pl.burst))
      : pl.burst;
    if (frac > 0) pl.burstToggle = !pl.burstToggle;
    fire();
    pl.burstLeft = shots - 1;
    pl.burstTimer = 0;
  }
  if (pl.burstLeft > 0) {
    pl.burstTimer += dt;
    if (pl.burstTimer >= 28) {
      pl.burstTimer -= 28;
      pl.burstLeft--;
      fire();
    }
  }

  if (pl.damageFx > 0) pl.damageFx -= dt;

  // ─── ラウンド進行 ─────────────────────────────────────────────────────────
  roundTimer += dt;
  if (roundBanner) {
    roundBanner.timer -= dt;
    if (roundBanner.timer <= 0) roundBanner = null;
  }
  let rd = roundIdx < ROUNDS.length ? ROUNDS[roundIdx] : null;
  if (rd && roundTimer >= rd.dur) {
    if (rd.loopTo !== undefined) {
      // LAST WAVE 通過：HP ボーナス加算・ループカウント増加
      hpBonus   += 2000;
      loopCount++;
      roundIdx = rd.loopTo;
    } else {
      roundIdx++;
    }
    roundTimer = 0;
    spawnTmr   = 0;
    if (roundIdx < ROUNDS.length) {
      // LAST WAVE 後はすべて「STAGE ∞」表示
      const bannerText  = loopCount > 0 ? 'STAGE ∞'
        : ROUNDS[roundIdx].type === 'round' ? `ROUND ${ROUNDS[roundIdx].num}`
        : (ROUNDS[roundIdx].label || 'WAVE!!');
      const bannerColor = loopCount > 0 ? '#44ffaa'
        : ROUNDS[roundIdx].type === 'round' ? '#ffdd00' : '#ff4444';
      roundBanner = { text:bannerText, timer:1500, color:bannerColor };
    } else {
      roundBanner = { text:'ALL CLEAR!', timer:5000, color:'#44ff88' };
    }
    rd = roundIdx < ROUNDS.length ? ROUNDS[roundIdx] : null;
  }

  if (rd) {
    const isWave = rd.type === 'wave';
    let interval, batch, pool;
    if (isWave) {
      interval = rd.interval || 300;
      batch    = rd.batch    || 3;
      pool     = getPool(rd.pool);
    } else {
      const ph = rd.phases.find(p => roundTimer <= p.until) || rd.phases[rd.phases.length - 1];
      interval = ph.interval || 700;
      batch    = ph.batch;
      pool     = getPool(ph.pool);
    }
    const atkCap2 = loopCount > 0 ? 500 : 100;
    const maxed2 = (pl.atk >= atkCap2 ? 1 : 0) + (pl.bspd >= 100 ? 1 : 0) + (pl.burst >= 10 ? 1 : 0);
    if (rd.type === 'wave' && rd.waveNum === 1) {
      // WAVE 1 専用
      if      (maxed2 >= 3) { batch = 3; interval = 250; }
      else if (maxed2 >= 2) { batch = 2; interval = 250; }
      else if (maxed2 >= 1) { batch = 2; interval = 275; }
    } else if (rd.type === 'round' && rd.num === 1) {
      // Round 1 専用
      if      (maxed2 >= 3) { batch = 2; interval = 350; }
      else if (maxed2 >= 2) { batch = 2; interval = 400; }
      else if (maxed2 >= 1) { batch = 2; interval = 450; }
    } else if (rd.type === 'round' && rd.num === 2) {
      // Round 2 専用
      if      (maxed2 >= 3) { batch = 3; interval = 350; }
      else if (maxed2 >= 2) { batch = 2; interval = 400; }
      else if (maxed2 >= 1) { batch = 2; interval = 450; }
    } else {
      if      (maxed2 >= 3) { batch = Math.ceil(batch * 2.5); interval = Math.min(interval, 100); }
      else if (maxed2 >= 2) { batch = Math.ceil(batch * 2.0); interval = Math.min(interval, 200); }
      else if (maxed2 >= 1) { batch = Math.ceil(batch * 1.5); interval = Math.min(interval, 250); }
    }
    spawnTmr += dt;
    if (spawnTmr >= interval) {
      spawnTmr -= interval;
      const wm = rd.hpMult || 1;
      // Round1 / Round2 / WAVE1 は maxMult を専用値に固定
      let mmOvr = null;
      const isEarlyStage = (rd.type === 'round' && (rd.num === 1 || rd.num === 2))
                        || (rd.type === 'wave'  && rd.waveNum === 1);
      if (isEarlyStage) {
        if      (maxed2 >= 3) mmOvr = 2.0;
        else if (maxed2 >= 2) mmOvr = 1.75;
        else if (maxed2 >= 1) mmOvr = 1.5;
      }
      for (let i = 0; i < batch && enemies.length < 120; i++) spawnEnemy(pool, wm, mmOvr);
    }
  }

  // 弾の移動（前フレーム位置を保存してトンネリング検出に使う）
  bullets = bullets.filter(b => {
    b.prevSx = b.sx; b.prevSy = b.sy;
    b.sx += b.vx * dt; b.sy += b.vy * dt;
    return b.sy > VP.y - 5;
  });

  // 敵の移動・死亡アニメーション
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.dying) {
      e.dieTimer += dt;
      if (e.dieTimer >= 240) {
        e.dieTimer = 0; e.dieFrame++;
        if (e.dieFrame >= 2) enemies.splice(i, 1);
      }
      continue;
    }
    e.depth += e.depthSpd * enemySpeedMult * dt;
    if (e.hitFx > 0) e.hitFx -= dt;
    e.animTimer += dt;
    const aniRate = Math.max(80, 260 - e.depth * 160);
    if (e.animTimer >= aniRate) { e.animTimer = 0; e.animFrame = (e.animFrame + 1) % 4; }
  }

  // 同一レーン追い越し禁止（手前の敵に追いついたら速度を合わせる）
  for (let li = 0; li < 3; li++) {
    const lane = enemies
      .filter(e => !e.dying && e.laneIndex === li)
      .sort((a, b) => b.depth - a.depth); // 手前（depth大）→奥（depth小）
    for (let k = 1; k < lane.length; k++) {
      const front = lane[k - 1];
      const back  = lane[k];
      const minGap = (front.r + back.r) * 0.001;
      if (back.depth > front.depth - minGap) {
        back.depth = front.depth - minGap;
      }
    }
  }

  // 弾-敵 衝突（線分×円で貫通防止、最手前の敵を優先）
  for (let j = bullets.length - 1; j >= 0; j--) {
    const b = bullets[j];
    let hitI = -1, hitDepth = -1;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.dying || b.laneIndex !== e.laneIndex) continue;
      const ep = proj(e.laneX, e.depth);
      const er = projR(e.r, e.depth);
      if (segCircleHit(b.prevSx, b.prevSy, b.sx, b.sy, ep.x, ep.y, er + 6)) {
        if (e.depth > hitDepth) { hitDepth = e.depth; hitI = i; }
      }
    }
    if (hitI < 0) continue;
    const e = enemies[hitI];
    e.currentHp -= b.dmg;
    e.hitFx = 80;
    bullets.splice(j, 1);
    if (imgs['fx_hit_bullet']?.complete && imgs['fx_hit_bullet'].naturalWidth) {
      for (let bi = 0; bi < 4; bi++) {
        const a = Math.random()*Math.PI*2, s = rnd(1,5);
        particles.push({ x:b.sx, y:b.sy, vx:Math.cos(a)*s, vy:Math.sin(a)*s-1,
          r:rnd(2,5), imgKey:'fx_hit_bullet', life:1, decay:rnd(0.025,0.055) });
      }
    } else {
      burst(b.sx, b.sy, '#ffdd44', 4);
    }
    if (e.currentHp <= 0) {
      e.r > 30 ? snd('die_l') : e.r > 18 ? snd('die_m') : snd('die_s');
      enemyCount = Math.max(0, enemyCount - 1);
      const dropRd = roundIdx < ROUNDS.length ? ROUNDS[roundIdx] : null;
      const _atkMax = loopCount > 0 ? 500 : 100;
      const _prog = ((pl.atk - INIT_ATK) / (_atkMax - INIT_ATK)
                   + (pl.bspd - INIT_BSPD) / (100 - INIT_BSPD)
                   + (pl.burst - INIT_BCNT) / (10 - INIT_BCNT)) / 3;
      const _dropRate = loopCount > 0
        ? e.dropMin
        : (_prog >= 0.5 ? (e.dropMin + e.dropMax) / 2 : rnd(e.dropMin, e.dropMax));
      if (Math.random() < _dropRate && dropRd?.type !== 'wave') {
        const atkMax = _atkMax;
        const avail = PU_TYPES.filter(t =>
          (t==='atk' ? pl.atk  < atkMax :
           t==='spd' ? pl.bspd < 100 :
                       pl.burst < 10));
        if (avail.length > 0) {
          powerups.push({ laneIndex:e.laneIndex, laneX:e.laneX,
            depth:0.05, type:avail[Math.floor(Math.random()*avail.length)], life:600,
            animFrame:0, animTimer:0 });
        }
      }
      // STAGE∞でATK MAXの時、DWNアイテムをdropMax率でスポーン
      if (loopCount > 0 && pl.atk >= 500 && Math.random() < e.dropMax && dropRd?.type !== 'wave') {
        powerups.push({ laneIndex:e.laneIndex, laneX:e.laneX,
          depth:0.05, type:'dwn', life:600, animFrame:0, animTimer:0 });
      }
      e.dying = true; e.dieFrame = 0; e.dieTimer = 0;
    }
  }

  // 敵-プレイヤー 衝突
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.dying) continue;
    const ep = proj(e.laneX, e.depth);
    const er = projR(e.r, e.depth);
    if (Math.hypot(ep.x - pl.screenX, ep.y - (GY - 35)) < er + 26) {
      pl.hp -= e.dmg; pl.damageFx = 300;
      for (let hi = 0; hi < 6; hi++) {
        const a = Math.random()*Math.PI*2, s = rnd(1,5);
        particles.push({ x:pl.screenX, y:GY-55, vx:Math.cos(a)*s, vy:Math.sin(a)*s-1,
          r:rnd(2,5), imgKey:'fx_hit_player', life:1, decay:rnd(0.025,0.055) });
      }
      snd('damage'); enemies.splice(i, 1);
      if (pl.hp <= 0) { pl.hp=0; gstate='gameover'; snd('gameover'); }
      continue;
    }
    if (e.depth > 1.10) {
      const defDmg = e.r > 30 ? 150 : e.r > 18 ? 60 : 30;
      defenseHp = Math.max(0, defenseHp - defDmg);
      snd('damage');
      const BOFS = [-18, 0, 18];
      const bsx = laneScreenX(e.laneIndex) + BOFS[e.laneIndex];
      const fxKey = Math.random() < 0.5 ? 'fx_barricade_hit' : 'fx_barricade_hit_2';
      splashes.push({ x:bsx, y:H-56, imgKey:fxKey, life:500, maxLife:500 });
      enemies.splice(i, 1);
      if (defenseHp <= 0) { defenseHp=0; gstate='gameover'; snd('gameover'); }
      continue;
    }
  }

  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.depth += 0.00025 * dt; p.life--;
    p.animTimer += dt;
    if (p.animTimer >= 300) { p.animTimer = 0; p.animFrame = (p.animFrame + 1) % 2; }
    const ps = proj(p.laneX, p.depth);
    if (Math.hypot(ps.x - pl.screenX, ps.y - (GY - 40)) < 44) {
      if (p.type === 'dwn') {
        pl.atk   = Math.max(INIT_ATK,  pl.atk  - 5);
        pl.bspd  = Math.max(INIT_BSPD, pl.bspd - 5);
        pl.burst = Math.max(INIT_BCNT, parseFloat((pl.burst - 1).toFixed(1)));
        pl.notif = { type:'dwn', t:180 };
        snd('powerdown'); powerups.splice(i, 1); continue;
      }
      const atkCapPu = loopCount > 0 ? 500 : 100;
      const wasAtkMax = pl.atk >= atkCapPu;
      switch (p.type) {
        case 'atk': pl.atk  = Math.min(pl.atk  + 5,  atkCapPu); break;
        case 'spd': pl.bspd = Math.min(pl.bspd + 5,  100); break;
        case 'bsr': pl.burst = Math.min(parseFloat((pl.burst + 0.5).toFixed(1)), 10); break;
      }
      // ATKがSTAGE∞で初めてMAX到達 → 2秒警告
      if (p.type === 'atk' && loopCount > 0 && !wasAtkMax && pl.atk >= 500 && dwnWarning <= 0) {
        dwnWarning = 2000;
        snd('dwn_warning');
      }
      const hitMax = (p.type==='atk' && pl.atk>=atkCapPu) ||
                     (p.type==='spd' && pl.bspd>=100) ||
                     (p.type==='bsr' && pl.burst>=10);
      pl.notif = { type: hitMax ? `${p.type}_max` : p.type, t: hitMax ? 220 : 130 };
      snd('powerup'); powerups.splice(i, 1); continue;
    }
    if (p.life <= 0 || p.depth > 1.05) powerups.splice(i, 1);
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x+=p.vx; p.y+=p.vy; p.vy+=0.12; p.life-=p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
  if (pl.notif) { pl.notif.t--; if (pl.notif.t<=0) pl.notif=null; }
  for (let i = splashes.length - 1; i >= 0; i--) {
    splashes[i].life -= dt;
    if (splashes[i].life <= 0) splashes.splice(i, 1);
  }

  // 1万撃破で地球防衛成功
  if (INIT_ENEMIES - enemyCount >= 10000) {
    gameResult = 'victory';
    gstate = 'gameover';
    snd('gameover');
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────
function render() {
  const bg = imgs['bg'];
  if (bg?.complete && bg.naturalWidth) {
    ctx.drawImage(bg, 0, 0, W, H);
  } else {
    ctx.fillStyle='#0a0a14'; ctx.fillRect(0,0,W,H);
  }
  ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.fillRect(0,0,W,H);
  drawEnvWaves();
  drawEnvFire();

  drawGround();

  if (pl.damageFx > 0) {
    ctx.fillStyle=`rgba(255,0,0,${pl.damageFx/300*0.28})`; ctx.fillRect(0,0,W,H);
  }

  for (const p of particles) {
    ctx.save(); ctx.globalAlpha=Math.max(0,p.life);
    if (p.imgKey) {
      const pi = imgs[p.imgKey];
      if (pi?.complete && pi.naturalWidth) {
        const s = p.r * 2;
        ctx.drawImage(pi, p.x - s/2, p.y - s/2, s, s);
      }
    } else {
      ctx.fillStyle=p.color;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  for (const p of powerups) {
    const ps   = proj(p.laneX, p.depth);
    const psr  = projR(18, p.depth);
    const disp = psr * 3.8;
    const a    = p.life > 60 ? 1 : p.life / 60;
    // depth 0.50 以上で着地フレーム（画面中間で着地）
    const frameKey = p.depth >= 0.50
      ? `item_${p.type}_land`
      : `item_${p.type}_fall${p.animFrame + 1}`;
    const im = imgs[frameKey];
    ctx.save();
    ctx.globalAlpha = a;
    if (im?.complete && im.naturalWidth) {
      ctx.drawImage(im, ps.x - disp/2, ps.y - disp/2, disp, disp);
    } else {
      // フォールバック：星形
      ctx.fillStyle = PU_COLOR[p.type]; ctx.shadowColor = PU_COLOR[p.type]; ctx.shadowBlur = 12;
      drawStar(ps.x, ps.y, 5, 12, 6); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff'; ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.type.toUpperCase(), ps.x, ps.y);
    }
    ctx.restore();
  }

  const sorted = [...enemies].sort((a,b)=>a.depth-b.depth);
  for (const e of sorted) {
    const es  = proj(e.laneX, e.depth);
    const esr = projR(e.r, e.depth);
    const fogA = Math.max(0, (0.45 - e.depth) / 0.45);

    // スプライト画像キーを取得（蟻・蜘蛛 6種 walk/die 対応）
    const SPRITE_IDS = ['ant_s','ant_m','ant_l','spider_s','spider_m','spider_l','bee_s','bee_m','bee_l'];
    let spriteKey = null;
    if (SPRITE_IDS.includes(e.id)) {
      spriteKey = e.dying
        ? `${e.id}_d${e.dieFrame + 1}`
        : `${e.id}_w${e.animFrame + 1}`;
    }
    const spriteImg = spriteKey ? imgs[spriteKey] : null;
    const hasSprite = spriteImg?.complete && spriteImg.naturalWidth > 0;

    ctx.save();

    if (hasSprite) {
      // ── スプライト描画 ──
      const dispSize = esr * 2.8;  // 当たり半径より少し大きく表示
      ctx.globalAlpha = fogA > 0 ? Math.max(0.15, 1 - fogA * 0.85) : 1;
      ctx.drawImage(spriteImg, es.x - dispSize/2, es.y - dispSize/2, dispSize, dispSize);
      // 被弾エフェクト（dying中は非表示）
      if (e.hitFx > 0) {
        const hitImg = imgs[e.hitFx > 40 ? 'hit1' : 'hit2'];
        if (hitImg?.complete && hitImg.naturalWidth) {
          const hs = esr * 3.2;
          ctx.globalAlpha = (e.hitFx / 80) * 0.9;
          ctx.drawImage(hitImg, es.x - hs/2, es.y - hs/2, hs, hs);
        }
      }
    } else {
      // ── 丸のフォールバック（dying中は非表示）──
      if (!e.dying) {
        if (e.hitFx > 0) ctx.globalAlpha = 0.42;
        ctx.fillStyle   = e.hitFx > 0 ? '#fff' : e.color;
        ctx.strokeStyle = e.edge; ctx.lineWidth = Math.max(1, 2*e.depth);
        ctx.beginPath(); ctx.arc(es.x, es.y, esr, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      }
    }

    // HP バー（dying中は非表示）
    if (e.currentHp < e.hp && !e.dying) {
      ctx.globalAlpha = 1;
      ctx.fillStyle='#222'; ctx.fillRect(es.x-esr, es.y-esr-6, esr*2, 3);
      ctx.fillStyle='#00dd44'; ctx.fillRect(es.x-esr, es.y-esr-6, esr*2*(e.currentHp/e.hp), 3);
    }


    // 遠景フォグ
    if (fogA > 0) {
      ctx.globalAlpha = fogA * 0.55; ctx.fillStyle = 'rgba(0,0,12,1)';
      ctx.beginPath(); ctx.arc(es.x, es.y, esr+1, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  for (const b of bullets) {
    ctx.save();
    ctx.translate(b.sx, b.sy);
    ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);

    const tipLen  = 7;   // 弾頭の長さ
    const caseLen = 6;   // 薬莢の長さ
    const w       = 2.6; // 幅の半分

    // 薬莢（真鍮色）
    const cg = ctx.createLinearGradient(-w, 0, w, 0);
    cg.addColorStop(0,    '#6b4400');
    cg.addColorStop(0.38, '#ffc830');
    cg.addColorStop(0.62, '#ffe680');
    cg.addColorStop(1,    '#6b4400');
    ctx.fillStyle = cg;
    ctx.fillRect(-w, 0, w * 2, caseLen);

    // 弾頭（シルバー）
    const pg = ctx.createLinearGradient(-w, 0, w, 0);
    pg.addColorStop(0,    '#444');
    pg.addColorStop(0.38, '#bbb');
    pg.addColorStop(0.62, '#eee');
    pg.addColorStop(1,    '#444');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.moveTo(-w,  0);
    ctx.lineTo( w,  0);
    ctx.lineTo( 0, -tipLen);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  drawPlayer();
  drawBarricades();
  drawSplashes();
  drawHUD();

  if (gstate==='loading')  drawLoading();
  if (gstate==='gameover') drawGameOver();
  if (gstate==='playing' && paused) drawPause();
  if (gstate==='playing' && dwnWarning > 0) drawDwnWarning();
}

function drawPause() {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 20;
  ctx.fillStyle = '#ffdd44'; ctx.font = 'bold 48px monospace';
  ctx.fillText('⏸', W/2, H/2 - 24);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 18px sans-serif';
  ctx.fillText('PAUSE', W/2, H/2 + 22);
  ctx.fillStyle = '#aaa'; ctx.font = '12px sans-serif';
  ctx.fillText('バリケードをタップして再開', W/2, H/2 + 50);
  ctx.restore();
}

function drawDwnWarning() {
  ctx.save();
  ctx.fillStyle = 'rgba(60,0,100,0.88)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  // 警告ヘッダー
  ctx.font = 'bold 32px monospace';
  ctx.fillStyle = '#ff2222';
  ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 24;
  ctx.fillText('⚠  WARNING  ⚠', W/2, H/2 - 130);
  ctx.shadowBlur = 0;

  // DWNアイテム プレビュー
  const dwnIm = imgs['item_dwn_fall1'];
  const disp = 80;
  if (dwnIm?.complete && dwnIm.naturalWidth) {
    ctx.drawImage(dwnIm, W/2 - disp/2, H/2 - 90, disp, disp);
  } else {
    ctx.fillStyle = '#aa00ff'; ctx.shadowColor = '#aa00ff'; ctx.shadowBlur = 20;
    drawStar(W/2, H/2 - 50, 5, 32, 16); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px monospace';
    ctx.fillText('DWN', W/2, H/2 - 50);
  }

  // 日本語テキスト
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 24px sans-serif';
  ctx.fillText('偽の救援物資落下中！', W/2, H/2 + 20);
  ctx.fillText('パワーダウン要注意！', W/2, H/2 + 56);

  // 英語テキスト
  ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 17px monospace';
  ctx.fillText('Fake Supply Drop Incoming!', W/2, H/2 + 100);
  ctx.fillText('Power-Down Trap Ahead!', W/2, H/2 + 126);

  // カウントダウンバー
  const prog = dwnWarning / 2000;
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(40, H/2 + 158, W - 80, 8);
  ctx.fillStyle = '#aa00ff';
  ctx.fillRect(40, H/2 + 158, (W - 80) * prog, 8);

  ctx.restore();
}

// ─── Ground ───────────────────────────────────────────────────────────────────
function drawGround() {
  ctx.save();
  const activeLX=LANE_X[pl.lane], lw=ROAD*0.38;
  const grad=ctx.createLinearGradient(0,VP.y,0,GY);
  grad.addColorStop(0,'rgba(0,200,255,0.00)');
  grad.addColorStop(1,'rgba(0,200,255,0.10)');
  ctx.fillStyle=grad; ctx.beginPath();
  const tl=proj(activeLX-lw/ROAD,0.04), tr=proj(activeLX+lw/ROAD,0.04);
  const br=proj(activeLX+lw/ROAD,1.00), bl=proj(activeLX-lw/ROAD,1.00);
  ctx.moveTo(tl.x,tl.y); ctx.lineTo(tr.x,tr.y);
  ctx.lineTo(br.x,br.y); ctx.lineTo(bl.x,bl.y);
  ctx.closePath(); ctx.fill();

  ctx.strokeStyle='rgba(140,110,70,0.18)'; ctx.lineWidth=1;
  for (const lx of [-1,-0.29,0.29,1]) {
    const far=proj(lx,0.04), near=proj(lx,1.00);
    ctx.beginPath(); ctx.moveTo(far.x,far.y); ctx.lineTo(near.x,near.y); ctx.stroke();
  }
  // bgScroll は速度同期のため残存（ライン描画は非表示）
  ctx.restore();
}

// ─── Player ──────────────────────────────────────────────────────────────────
function drawPlayer() {
  const fi = pl.frm + 1;
  const dw = PLAYER_WALK_W;
  const dx = pl.screenX - dw / 2, dy = GY - PLAYER_H;

  // レーンB: wb（銃正面）、レーンC: wc（銃左上）、レーンA: wcをX反転（銃右上）
  const key = pl.lane === 1 ? `wb${fi}` : `wc${fi}`;
  const im  = imgs[key];

  if (im?.complete && im.naturalWidth) {
    if (pl.lane === 0) {
      // Aレーン: Cレーン画像を水平反転して描画（銃が右上向きになる）
      ctx.save();
      ctx.translate(pl.screenX, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(im, -dw / 2, dy, dw, PLAYER_H);
      ctx.restore();
    } else {
      ctx.drawImage(im, dx, dy, dw, PLAYER_H);
    }
  } else {
    ctx.fillStyle='#44aa44'; ctx.fillRect(dx, dy+20, dw, PLAYER_H-20);
  }
}

// ─── Barricades ──────────────────────────────────────────────────────────────
function drawBarricades() {
  const isDamaged = defenseHp < INIT_DEFENSE / 2;
  const img = isDamaged ? imgs['barricade_damaged'] : imgs['barricade'];
  const bw = 92, bh = 56;
  const laneOffset = [-18, 0, 18];
  for (let li = 0; li < 3; li++) {
    const cx = laneScreenX(li) + laneOffset[li];
    const bx = cx - bw / 2;
    const ty = H - bh - 4;
    if (img?.complete && img.naturalWidth) {
      ctx.drawImage(img, bx, ty, bw, bh);
    } else {
      ctx.fillStyle = isDamaged ? '#554433' : '#886644';
      ctx.fillRect(bx, ty, bw, bh);
    }
  }
  // 右バリケード：デスクトップのみDBGヒント
  const isMob = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (!isMob) {
    const dbgX = laneScreenX(2) + laneOffset[2];
    ctx.save();
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#88ff88';
    ctx.font = '11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('DBG', dbgX, H - 30);
    ctx.restore();
  }
}

// ─── 環境エフェクト（炎・波）────────────────────────────────────────────────────
function drawFireZone(zx, zy, zw, zh) {
  const t = envFireTime;
  const cols = Math.ceil(zw / 14);
  for (let i = 0; i < cols; i++) {
    const cx  = zx + (zw / cols) * (i + 0.5);
    const fh  = zh * (0.35 + 0.60 * Math.abs(Math.sin(t * 1.4 + i * 1.1)));
    const fy  = zy + zh - fh;
    const fw  = (zw / cols) * 1.1;
    const flk = Math.sin(t * 3.2 + i * 0.9) * 5;
    const grad = ctx.createLinearGradient(cx, fy + fh, cx, fy);
    grad.addColorStop(0,    'rgba(255,140,0,0.85)');
    grad.addColorStop(0.35, 'rgba(255,60,0,0.55)');
    grad.addColorStop(0.70, 'rgba(255,220,0,0.25)');
    grad.addColorStop(1,    'rgba(255,255,100,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx + flk, fy + fh * 0.5, fw * 0.5, fh * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnvFire() {
  if (!dbgFireWave) return;
  ctx.save();
  // 左側ビル群
  drawFireZone(0,   28, 142, 210);
  // 右側ビル群
  drawFireZone(263, 28, 142, 210);
  // 奥中央ビル群
  drawFireZone(148, 28, 109, 150);
  ctx.restore();
}

function drawWaveZone(wx, wy, ww, wh) {
  const t = envFireTime;
  const rows = 7;
  for (let r = 0; r < rows; r++) {
    const y     = wy + (wh / rows) * r;
    const amp   = 3 + r * 0.8;
    const freq  = 0.055 - r * 0.004;
    const spd   = 1.4 - r * 0.12;
    const alpha = Math.max(0.12, 0.50 - r * 0.05);
    ctx.strokeStyle = `rgba(120,190,240,${alpha})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let px = wx; px <= wx + ww; px += 2) {
      const py = y + Math.sin(px * freq + t * spd) * amp;
      px === wx ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

function drawEnvWaves() {
  if (!dbgFireWave) return;
  ctx.save();
  // 左水面
  drawWaveZone(0,   288, 142, 130);
  // 右水面
  drawWaveZone(263, 288, 142, 130);
  ctx.restore();
}

// ─── Splashes ────────────────────────────────────────────────────────────────
function drawSplashes() {
  for (const sp of splashes) {
    const img = imgs[sp.imgKey];
    if (!img?.complete || !img.naturalWidth) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, sp.life / sp.maxLife);
    const size = 110;
    ctx.drawImage(img, sp.x - size / 2, sp.y - size / 2, size, size);
    ctx.restore();
  }
}

// ─── HUD (縦型レイアウト) ─────────────────────────────────────────────────────
function drawHUD() {

  // ── HP バー（左上） ──
  const hx=6, hy=8;
  ctx.fillStyle='#88ff88'; ctx.font='bold 11px monospace'; ctx.textAlign='left';
  ctx.fillText('♟ EDF-007', hx, hy+10);
  const hr=pl.hp/pl.maxHp;
  ctx.fillStyle='#333'; ctx.fillRect(hx, hy+16, 120, 14);
  ctx.fillStyle=hr>=0.5?'#2266ff':hr>=0.25?'#ff8800':'#ff2200';
  ctx.fillRect(hx, hy+16, 120*hr, 14);
  ctx.strokeStyle='#555'; ctx.lineWidth=1; ctx.strokeRect(hx, hy+16, 120, 14);

  // ── 防衛力ゲージ（HP バーの下） ──
  const dr = defenseHp / INIT_DEFENSE;
  // 逆向き♟ DEFENSE ラベル（1行スペース空けて配置）
  ctx.font='bold 11px monospace'; ctx.fillStyle='#aaccff';
  const pw = ctx.measureText('♟').width;
  ctx.save();
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.translate(hx + pw/2, hy + 49);
  ctx.rotate(Math.PI);
  ctx.fillText('♟', 0, 0);
  ctx.restore();
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  ctx.fillText('DEFENSE', hx + pw + 2, hy + 54);
  ctx.fillStyle='#333'; ctx.fillRect(hx, hy+60, 120, 12);
  ctx.fillStyle=dr>=0.5?'#eedd00':dr>=0.25?'#ff8800':'#ff2200';
  ctx.fillRect(hx, hy+60, 120*dr, 12);
  ctx.strokeStyle='#555'; ctx.lineWidth=1; ctx.strokeRect(hx, hy+60, 120, 12);

  // ── MAX バッジ（DEFENCE ゲージ下） ──
  const atkCap = loopCount > 0 ? 500 : 100;
  const maxBadges = [
    { label:'ATK', color:'#ff5544', show: pl.atk  >= atkCap },
    { label:'SPD', color:'#44aaff', show: pl.bspd >= 100 },
    { label:'BRS', color:'#44ff66', show: pl.burst >= 10 },
  ];
  const iconSz = 52, iconGap = 4, iconY = hy + 78;
  const maxImgKeys = ['notif_atk_max', 'notif_spd_max', 'notif_bsr_max'];
  const iconExtraY = [0, 0, 14]; // BRS MAX を14px下にずらす
  maxBadges.forEach(({ show }, i) => {
    if (!show) return;
    const im = imgs[maxImgKeys[i]];
    if (!im?.complete || !im.naturalWidth) return;
    ctx.drawImage(im, hx, iconY + i * (iconSz + iconGap) + iconExtraY[i], iconSz, iconSz);
  });

  // ── ラウンド情報（上中央） ──
  const cx=W/2;
  const curRd = roundIdx < ROUNDS.length ? ROUNDS[roundIdx] : null;
  const rdLabel = loopCount > 0
    ? 'STAGE ∞'
    : curRd
      ? (curRd.type === 'wave' ? (curRd.label || `WAVE ${curRd.waveNum}`) : `ROUND ${curRd.num}`)
      : 'ALL CLEAR!';
  ctx.fillStyle='rgba(0,0,0,0.80)'; rrect(cx-66,8,132,44,5); ctx.fill();
  ctx.strokeStyle='#ffaa00'; ctx.lineWidth=2; rrect(cx-66,8,132,44,5); ctx.stroke();
  ctx.fillStyle='#ffdd00'; ctx.font='bold 13px monospace'; ctx.textAlign='center';
  ctx.fillText(rdLabel, cx, 24);
  ctx.fillStyle='#ffffff'; ctx.font='bold 11px monospace';
  ctx.fillText(`${(INIT_ENEMIES - enemyCount).toLocaleString()} 匹撃破`, cx, 44);

  // ── レーダー（右上） ──
  drawRadar();

  // ── レーンインジケーター（下中央） ──
  drawLaneIndicator();

  // ── ラウンドバナー ──
  if (roundBanner && roundBanner.timer > 0) {
    const alpha = Math.min(1, roundBanner.timer / 500);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, H/2 - 55, W, 80);
    ctx.fillStyle = roundBanner.color;
    ctx.shadowColor = roundBanner.color;
    ctx.shadowBlur = 28;
    ctx.font = 'bold 42px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(roundBanner.text, W/2, H/2 - 18);
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  }

  // ── パワーアップ通知 ──
  if (pl.notif) {
    const notifImg = imgs[`notif_${pl.notif.type}`];
    const isMax = pl.notif.type.endsWith('_max');
    ctx.save();
    ctx.globalAlpha = Math.min(1, pl.notif.t / 30);
    if (notifImg?.complete && notifImg.naturalWidth) {
      const ns = isMax ? 210 : 160;
      const notifY = (pl.notif.type === 'spd' || pl.notif.type === 'spd_max') ? 115 : 120;
      ctx.drawImage(notifImg, W/2 - ns/2, notifY, ns, ns);
    } else {
      ctx.fillStyle='#ffff44'; ctx.shadowColor='#ff8800'; ctx.shadowBlur=20;
      ctx.font='bold 20px monospace'; ctx.textAlign='center';
      ctx.fillText(PU_LABEL[pl.notif.type], W/2, 160);
    }
    ctx.restore();
  }

  // ── ← → 移動ボタン ──
  if (gstate === 'playing') {
    const bm = 38, by = H - 90;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,160,40,0.80)';
    ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(255,130,0,0.9)'; ctx.shadowBlur = 10;
    // 左矢印
    const lx = bm;
    ctx.beginPath();
    ctx.moveTo(lx+16, by-16); ctx.lineTo(lx, by); ctx.lineTo(lx+16, by+16);
    ctx.stroke();
    // 右矢印
    const rx = W - bm;
    ctx.beginPath();
    ctx.moveTo(rx-16, by-16); ctx.lineTo(rx, by); ctx.lineTo(rx-16, by+16);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// ─── Lane Indicator ──────────────────────────────────────────────────────────
function drawLaneIndicator() {
}

// ─── Radar ────────────────────────────────────────────────────────────────────
function drawRadar() {
  const rcx=W-50, rcy=55, rr=44;
  ctx.save();
  ctx.fillStyle='rgba(0,18,0,0.88)';
  ctx.beginPath(); ctx.arc(rcx,rcy,rr,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(0,255,60,0.18)'; ctx.lineWidth=1;
  [rr*0.35,rr*0.68].forEach(cr=>{ctx.beginPath();ctx.arc(rcx,rcy,cr,0,Math.PI*2);ctx.stroke();});
  ctx.beginPath(); ctx.moveTo(rcx-rr,rcy); ctx.lineTo(rcx+rr,rcy);
  ctx.moveTo(rcx,rcy-rr); ctx.lineTo(rcx,rcy+rr); ctx.stroke();

  const sw=radarAng*Math.PI/180;
  ctx.save(); ctx.beginPath(); ctx.arc(rcx,rcy,rr-2,0,Math.PI*2); ctx.clip();
  ctx.fillStyle='rgba(0,255,60,0.12)';
  ctx.beginPath(); ctx.moveTo(rcx,rcy); ctx.arc(rcx,rcy,rr,sw-0.9,sw); ctx.closePath(); ctx.fill();
  const typeColor = id => id.startsWith('ant') ? '#ff3333' : id.startsWith('spider') ? '#4488ff' : '#ffdd00';
  for (const e of enemies) {
    const bx=rcx+LANE_X[e.laneIndex]*rr*0.82;
    const by=rcy+(e.depth-0.5)*rr*1.85;
    ctx.fillStyle=typeColor(e.id); ctx.globalAlpha=0.90;
    ctx.beginPath(); ctx.arc(bx,by,e.r>30?3.5:e.r>18?2.5:1.5,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
  const pty=rcy+rr*0.76;
  ctx.globalAlpha=1; ctx.fillStyle='#00ff44';
  ctx.beginPath(); ctx.moveTo(rcx,pty-5); ctx.lineTo(rcx-3,pty+4); ctx.lineTo(rcx+3,pty+4);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#00ff44'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(rcx,rcy,rr,0,Math.PI*2); ctx.stroke();
  ctx.restore();
  ctx.fillStyle='#00ff44'; ctx.font='8px monospace'; ctx.textAlign='center';
  ctx.fillText(paused ? '▶ RESUME' : 'RADAR', rcx, rcy+rr+11);
}

// ─── Screens ─────────────────────────────────────────────────────────────────
function drawLoading() {
  ctx.fillStyle='rgba(0,0,0,0.80)'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#fff'; ctx.font='bold 22px monospace'; ctx.textAlign='center';
  ctx.textBaseline='middle'; ctx.fillText('LOADING...', W/2, H/2);
}
function drawGameOver() {
  ctx.fillStyle='rgba(0,0,0,0.90)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign='center'; ctx.textBaseline='middle';
  const cx = W/2;
  const isVictory = gameResult === 'victory';

  // メインメッセージ
  if (isVictory) {
    ctx.shadowColor='#44ff88'; ctx.shadowBlur=24;
    ctx.fillStyle='#44ff88'; ctx.font='bold 22px sans-serif';
    ctx.fillText('地球防衛成功！！', cx, 100);
    ctx.shadowBlur=0;
    ctx.fillStyle='#88ffcc'; ctx.font='bold 16px sans-serif';
    ctx.fillText('EARTH DEFENSE SUCCESS', cx, 130);
    ctx.fillStyle='#ffdd44'; ctx.font='bold 28px monospace';
    ctx.shadowColor='#ffdd44'; ctx.shadowBlur=16;
    ctx.fillText('ALL CLEAR', cx, 164);
    ctx.shadowBlur=0;
  } else {
    ctx.shadowColor='#ffaa00'; ctx.shadowBlur=20;
    ctx.fillStyle='#ffdd44'; ctx.font='bold 18px sans-serif';
    ctx.fillText('諸君の勇気ある行動に感謝する！', cx, 110);
    ctx.shadowBlur=0;
    ctx.fillStyle='#ffaa55'; ctx.font='12px sans-serif';
    ctx.fillText('I thank you for your courageous', cx, 136);
    ctx.fillText('actions, soldiers!', cx, 154);
  }

  // 区切り線
  ctx.strokeStyle='#554422'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(30,182); ctx.lineTo(375,182); ctx.stroke();

  // 到達ラウンド・撃破数
  const goRd = roundIdx < ROUNDS.length ? ROUNDS[roundIdx] : null;
  const goRdLabel = isVictory ? '地球防衛成功'
    : loopCount > 0 ? 'STAGE ∞'
    : goRd ? (goRd.type==='wave' ? (goRd.label || `WAVE ${goRd.waveNum}`) : `ROUND ${goRd.num}`)
    : 'ALL CLEAR!';
  const defeated = INIT_ENEMIES - enemyCount;
  ctx.fillStyle='#aaa'; ctx.font='13px monospace';
  ctx.fillText(`到達: ${goRdLabel}`, cx, 206);
  ctx.fillStyle='#ff9955'; ctx.font='bold 28px monospace';
  ctx.fillText(`${defeated.toLocaleString()} 匹撃破`, cx, 232);

  // 区切り線
  ctx.strokeStyle='#554422';
  ctx.beginPath(); ctx.moveTo(30,256); ctx.lineTo(375,256); ctx.stroke();

  // 能力ランク（星）
  ctx.fillStyle='#88ccff'; ctx.font='13px sans-serif';
  ctx.fillText('能力ランク', cx, 278);
  const s1=atkStars(pl.atk), s2=atkStars(pl.bspd), s3=brsStars(pl.burst);
  const stars = (n) => '★'.repeat(n)+'☆'.repeat(5-n);
  ctx.textAlign='left';
  const rx=80;
  ctx.fillStyle='#ff8888'; ctx.font='bold 14px monospace'; ctx.fillText('ATK', rx, 305);
  ctx.fillStyle='#ffdd44'; ctx.font='18px sans-serif'; ctx.fillText(stars(s1), rx+44, 305);
  ctx.fillStyle='#88aaff'; ctx.font='bold 14px monospace'; ctx.fillText('SPD', rx, 330);
  ctx.fillStyle='#ffdd44'; ctx.font='18px sans-serif'; ctx.fillText(stars(s2), rx+44, 330);
  ctx.fillStyle='#88ff88'; ctx.font='bold 14px monospace'; ctx.fillText('BRS', rx, 355);
  ctx.fillStyle='#ffdd44'; ctx.font='18px sans-serif'; ctx.fillText(stars(s3), rx+44, 355);
  ctx.textAlign='center';

  // 区切り線
  ctx.strokeStyle='#554422';
  ctx.beginPath(); ctx.moveTo(30,375); ctx.lineTo(375,375); ctx.stroke();

  // ボタン1: 証明書
  const b1x=W/2-145, b1y=392, b1w=290, b1h=78;
  goBtn1={x:b1x, y:b1y, w:b1w, h:b1h};
  ctx.fillStyle='rgba(20,60,160,0.92)'; ctx.beginPath();
  roundedRect(ctx,b1x,b1y,b1w,b1h,8); ctx.fill();
  ctx.strokeStyle='#5599ff'; ctx.lineWidth=2;
  roundedRect(ctx,b1x,b1y,b1w,b1h,8); ctx.stroke();
  ctx.fillStyle='#ffffff'; ctx.font='bold 14px sans-serif';
  ctx.fillText('次の任務に就く為、証明書を発行', cx, b1y+20);
  ctx.fillStyle='#aaddff'; ctx.font='11px sans-serif';
  ctx.fillText('Next Mission Certificate Issued', cx, b1y+40);
  ctx.fillStyle='#ffff88'; ctx.font='bold 11px sans-serif';
  ctx.fillText('▶ X (Twitter) へ投稿', cx, b1y+61);

  // ボタン2: リトライ
  const b2x=W/2-145, b2y=488, b2w=290, b2h=60;
  goBtn2={x:b2x, y:b2y, w:b2w, h:b2h};
  ctx.fillStyle='rgba(150,30,30,0.92)'; ctx.beginPath();
  roundedRect(ctx,b2x,b2y,b2w,b2h,8); ctx.fill();
  ctx.strokeStyle='#ff6644'; ctx.lineWidth=2;
  roundedRect(ctx,b2x,b2y,b2w,b2h,8); ctx.stroke();
  ctx.fillStyle='#ffffff'; ctx.font='bold 14px sans-serif';
  ctx.fillText('引き続き前線で戦う', cx, b2y+20);
  ctx.fillStyle='#ffbbaa'; ctx.font='11px sans-serif';
  ctx.fillText('Continue Fighting on the Front Lines', cx, b2y+42);
}

function roundedRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x+r, y);
  c.lineTo(x+w-r, y); c.arcTo(x+w, y, x+w, y+r, r);
  c.lineTo(x+w, y+h-r); c.arcTo(x+w, y+h, x+w-r, y+h, r);
  c.lineTo(x+r, y+h); c.arcTo(x, y+h, x, y+h-r, r);
  c.lineTo(x, y+r); c.arcTo(x, y, x+r, y, r);
  c.closePath();
}

// ─── Certificate & Share ─────────────────────────────────────────────────────
function makeCertificate() {
  const cc = document.createElement('canvas');
  cc.width = 405; cc.height = 720;
  const c = cc.getContext('2d');
  const defeated = INIT_ENEMIES - enemyCount;
  const s1=atkStars(pl.atk), s2=atkStars(pl.bspd), s3=brsStars(pl.burst);
  const stars = n => '★'.repeat(n)+'☆'.repeat(5-n);
  const goRd = roundIdx < ROUNDS.length ? ROUNDS[roundIdx] : null;
  const rdLbl = gameResult === 'victory' ? '地球防衛成功'
    : loopCount > 0 ? 'STAGE ∞'
    : goRd ? (goRd.type==='wave' ? (goRd.label||`WAVE ${goRd.waveNum}`) : `ROUND ${goRd.num}`) : 'ALL CLEAR!';

  // 画像ヘルパー
  const di = (key,x,y,w,h) => {
    const im=imgs[key]; if(im?.complete&&im.naturalWidth) c.drawImage(im,x,y,w,h);
  };

  // 背景（cert_bg.png があれば紙テクスチャ、なければ暗色単色）
  c.fillStyle='#07070f'; c.fillRect(0,0,405,720);
  di('cert_bg', 0, 0, 405, 720);

  c.textAlign='center'; c.textBaseline='middle';

  // ── ヘッダー ──
  c.fillStyle='#ffdd44'; c.font='bold 20px sans-serif';
  c.fillText('地球防衛軍 作戦報告書', 202, 44);
  c.fillStyle='#aa8833'; c.font='10px sans-serif';
  c.fillText('EARTH DEFENSE FORCE  MISSION REPORT', 202, 64);
  c.strokeStyle='#554422'; c.lineWidth=1;
  c.beginPath(); c.moveTo(28,76); c.lineTo(377,76); c.stroke();

  // ── EDFアイコン（500×390 → 140×109 で縦横比維持）──
  di('edf_icon', 202-70, 82, 140, 109);

  // ── 兵士ID ──
  c.fillStyle='#88ff88'; c.font='bold 14px monospace';
  c.fillText('♟ EDF-007', 202, 205);
  c.fillStyle='#888'; c.font='11px sans-serif';
  c.fillText(`到達: ${rdLbl}`, 202, 223);
  c.strokeStyle='#332211'; c.lineWidth=1;
  c.beginPath(); c.moveTo(28,235); c.lineTo(377,235); c.stroke();

  // ── 撃破数 ──
  c.fillStyle='#ffaa44'; c.font='bold 13px sans-serif';
  c.fillText('作戦撃破数', 202, 253);
  di('cert_count_frame', 12, 261, 381, 152);
  c.fillStyle='#ffffff'; c.font='bold 40px monospace';
  c.fillText(defeated.toLocaleString(), 202, 337);

  c.strokeStyle='#554422'; c.lineWidth=1;
  c.beginPath(); c.moveTo(28,421); c.lineTo(377,421); c.stroke();

  // ── 能力ランク ──
  c.fillStyle='#88ccff'; c.font='bold 13px sans-serif';
  c.fillText('能力ランク  ABILITY RANK', 202, 441);

  const rows=[
    {label:'ATK', color:'#ff9988', n:s1},
    {label:'SPD', color:'#88aaff', n:s2},
    {label:'BRS', color:'#88ff88', n:s3},
  ];
  rows.forEach((row,i)=>{
    const ry=459+i*54;
    di('cert_rank_bar', 32, ry, 341, 48);
    c.fillStyle=row.color; c.font='bold 15px monospace'; c.textAlign='right';
    c.fillText(row.label, 148, ry+24);
    c.fillStyle='#ffdd44'; c.font='22px sans-serif'; c.textAlign='left';
    c.fillText(stars(row.n), 162, ry+24);
  });
  c.textAlign='center';

  c.strokeStyle='#554422'; c.lineWidth=1;
  c.beginPath(); c.moveTo(28,625); c.lineTo(377,625); c.stroke();

  // ── 認定スタンプ ──
  c.save(); c.globalAlpha=0.82;
  di('cert_stamp', 202-48, 621, 96, 96);
  c.restore();

  // ── フッターテキスト ──
  c.fillStyle='#665522'; c.font='10px sans-serif';
  c.fillText('地球防衛軍 作戦司令部 認定  /  EDF OPERATIONS CERTIFIED', 202, 683);
  c.fillStyle='#2a2a3a'; c.font='10px sans-serif';
  c.fillText('#EDF  #D3P  #TGS2026', 202, 699);

  return cc;
}

async function shareToX() {
  const defeated = INIT_ENEMIES - enemyCount;
  const tweetText =
    `D3Pブース 第${TGS_HALL}ホール ${TGS_BOOTH}の最前線基地へ応援求む！` +
    ` ${defeated.toLocaleString()}匹撃破！ #EDF #D3P #TGS2026`;
  const cc = makeCertificate();
  cc.toBlob(async blob => {
    const file = new File([blob], 'edf_certificate.png', { type:'image/png' });
    if (navigator.canShare?.({ files:[file] })) {
      try { await navigator.share({ text:tweetText, files:[file] }); return; } catch(e){}
    }
    // フォールバック: 画像ダウンロード → Twitter Intent
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download='edf_certificate.png'; a.click();
    URL.revokeObjectURL(url);
    setTimeout(() => {
      window.open('https://x.com/intent/tweet?text='+encodeURIComponent(tweetText), '_blank');
    }, 600);
  }, 'image/png');
}

// ─── Debug ────────────────────────────────────────────────────────────────────
let paused = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
let enemySpeedMult = 1.0;
let dbgFireWave = false;
let envFireTime  = 0;

function toggleDebug() {
  const p = document.getElementById('dbgPanel');
  p.style.display = p.style.display === 'flex' ? 'none' : 'flex';
}
function togglePause() {
  paused = !paused;
  document.getElementById('dbgPauseBtn').textContent = paused ? '▶ RESUME' : '⏸ PAUSE';
  const bgm = document.getElementById('bgm');
  if (bgm) { paused ? bgm.pause() : bgm.play().catch(()=>{}); }
}
function dbgGameOver() { if (gstate==='playing') { pl.hp=0; gstate='gameover'; snd('gameover'); } }
function dbgVictory()  { gameResult='victory'; gstate='gameover'; snd('gameover'); }
function dbgAtk(v)  { const cap = loopCount > 0 ? 500 : 100; pl.atk = Math.max(1, Math.min(cap, pl.atk + v)); }
function dbgLoop()  { loopCount = 1; hpBonus = 2000; pl.atk = Math.min(pl.atk, 100); }
function dbgDwn()   { dwnWarning = 2000; snd('dwn_warning'); }
function dbgSpd(v)  { pl.bspd = Math.max(1, Math.min(200, pl.bspd + v)); }
function dbgSpawn(id) {
  if (gstate !== 'playing') return;
  const def = EDEFS.find(d => d.id === id);
  if (!def) return;
  const li = Math.floor(Math.random() * 3);
  enemies.push({ ...def, laneIndex:li, laneX:LANE_X[li],
    depth:0.05, currentHp:def.hp, hitFx:0,
    animFrame:0, animTimer:0, dying:false, dieFrame:0, dieTimer:0 });
}
function dbgBurst(n) { pl.burst = n; pl.burstLeft = 0; }
function dbgEnemySpd(mult) {
  enemySpeedMult = mult;
  document.getElementById('dbgSpdLabel').textContent = mult + 'x';
  document.getElementById('dbgSpdVal').textContent = (0.000100 * mult).toFixed(6);
}
function toggleFireWave() {
  dbgFireWave = !dbgFireWave;
  const btn = document.getElementById('dbgFireWaveBtn');
  if (btn) btn.textContent = dbgFireWave ? '🔥 炎・波 ON' : '🔥 炎・波 OFF';
}
window.addEventListener('keydown', e => { if (e.key === 'd' || e.key === 'D') toggleDebug(); });

// ─── Main Loop ────────────────────────────────────────────────────────────────
function loop(ts) {
  const dt=Math.min(ts-lastTs,50); lastTs=ts;
  envFireTime += dt * 0.001;
  if (gstate==='loading' && loaded>=toLoad) gstate='playing';
  if (gstate==='playing' && !paused) {
    if (dwnWarning > 0) { dwnWarning = Math.max(0, dwnWarning - dt); }
    else update(dt);
  }
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(ts=>{ lastTs=ts; requestAnimationFrame(loop); });
