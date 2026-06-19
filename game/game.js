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

// ─── Enemy Definitions ───────────────────────────────────────────────────────
const EDEFS = [
  { id:'ant_s',    color:'#ff4422', edge:'#aa1100', r:12, hp:20,  depthSpd:0.000100, dmg:8,  drop:0.12 },
  { id:'ant_m',    color:'#ff4422', edge:'#aa1100', r:21, hp:60,  depthSpd:0.000100, dmg:15, drop:0.15 },
  { id:'ant_l',    color:'#dd2200', edge:'#880000', r:36, hp:200, depthSpd:0.000100, dmg:30, drop:0.28 },
  { id:'spider_s', color:'#cc44ff', edge:'#7700aa', r:12, hp:25,  depthSpd:0.000100, dmg:8,  drop:0.12 },
  { id:'spider_m', color:'#cc44ff', edge:'#7700aa', r:22, hp:80,  depthSpd:0.000100, dmg:18, drop:0.18 },
  { id:'spider_l', color:'#aa22ee', edge:'#550088', r:38, hp:250, depthSpd:0.000100, dmg:35, drop:0.28 },
  { id:'bee_s',    color:'#ffcc00', edge:'#aa7700', r:10, hp:15,  depthSpd:0.000100, dmg:6,  drop:0.10 },
  { id:'bee_m',    color:'#ffcc00', edge:'#aa7700', r:17, hp:50,  depthSpd:0.000100, dmg:12, drop:0.15 },
  { id:'bee_l',    color:'#ffaa00', edge:'#885500', r:30, hp:160, depthSpd:0.000100, dmg:25, drop:0.25 },
];

const PU_TYPES = ['atk', 'spd', 'bsr'];
const PU_COLOR = { atk:'#ff4444', spd:'#44aaff', bsr:'#44ff44' };
const PU_LABEL = { atk:'ATK ↑',   spd:'SPD ↑',   bsr:'BRS ↑'  };

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
    case 'powerup':  [0,0.10,0.20].forEach((d,i)=>beep({ f:[440,550,660][i], dur:0.15, vol:0.15, delay:d })); break;
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
for (const type of ['atk', 'spd', 'bsr']) {
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
let roundBanner   = { text:'ROUND 1', timer:2500, color:'#ffdd00' };
let bgScroll      = 0;
let defenseHp     = INIT_DEFENSE;
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
  const rect = canvas.getBoundingClientRect();
  const tx = (e.touches[0].clientX - rect.left) * (W / rect.width);
  if (tx < W * 0.38)      tryLaneMove(-1);
  else if (tx > W * 0.62) tryLaneMove(+1);
}, { passive: false });
canvas.addEventListener('touchend', e => {
  e.preventDefault();
  if (gstate === 'gameover') resetGame();
}, { passive: false });
canvas.addEventListener('click', () => { resume(); if (gstate === 'gameover') resetGame(); });

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
  { type:'round', num:1, dur:60000, phases:[
    { until:20000, batch:1, pool:'s' },
    { until:40000, batch:2, pool:'s' },
    { until:60000, batch:2, pool:'s' },
  ]},
  { type:'round', num:2, dur:60000, phases:[
    { until:20000, batch:1, pool:'s' },
    { until:40000, batch:2, pool:'s' },
    { until:60000, batch:2, pool:'s' },
  ]},
  { type:'wave', waveNum:1, dur:30000, pool:'s'   },
  { type:'round', num:3, dur:60000, phases:[
    { until:20000, batch:1, pool:'s'  },
    { until:40000, batch:2, pool:'s'  },
    { until:60000, batch:3, pool:'sm' },
  ]},
  { type:'round', num:4, dur:60000, phases:[
    { until:20000, batch:1, pool:'s'  },
    { until:40000, batch:2, pool:'s'  },
    { until:60000, batch:3, pool:'sm' },
  ]},
  { type:'wave', waveNum:2, dur:30000, pool:'sm'  },
  { type:'round', num:5, dur:60000, phases:[
    { until:20000, batch:1, pool:'s'   },
    { until:40000, batch:2, pool:'sm'  },
    { until:60000, batch:3, pool:'sml' },
  ]},
  { type:'round', num:6, dur:60000, phases:[
    { until:20000, batch:1, pool:'s'   },
    { until:40000, batch:2, pool:'sm'  },
    { until:60000, batch:3, pool:'sml' },
  ]},
];

function getPool(key) {
  if (key === 's')   return EDEFS.filter(d => d.id.endsWith('_s'));
  if (key === 'sm')  return EDEFS.filter(d => !d.id.endsWith('_l'));
  return EDEFS;
}

// ─── Spawn ────────────────────────────────────────────────────────────────────
function spawnEnemy(pool) {
  const def = pool[Math.floor(Math.random() * pool.length)];
  const li  = Math.floor(Math.random() * 3);
  enemies.push({
    ...def, laneIndex: li, laneX: LANE_X[li],
    depth: 0.05, currentHp: def.hp, hitFx: 0,
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
  roundBanner={ text:'ROUND 1', timer:2500, color:'#ffdd00' };
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
    roundIdx++;
    roundTimer = 0;
    spawnTmr   = 0;
    if (roundIdx < ROUNDS.length) {
      const next = ROUNDS[roundIdx];
      roundBanner = next.type === 'round'
        ? { text:`ROUND ${next.num}`, timer:2500, color:'#ffdd00' }
        : { text:'WAVE!!',            timer:2500, color:'#ff4444' };
    } else {
      roundBanner = { text:'ALL CLEAR!', timer:5000, color:'#44ff88' };
    }
    rd = roundIdx < ROUNDS.length ? ROUNDS[roundIdx] : null;
  }

  if (rd) {
    const isWave   = rd.type === 'wave';
    const interval = isWave ? 300 : 700;
    spawnTmr += dt;
    if (spawnTmr >= interval) {
      spawnTmr -= interval;
      let batch, pool;
      if (isWave) {
        batch = 3;
        pool  = getPool(rd.pool);
      } else {
        const ph = rd.phases.find(p => roundTimer <= p.until) || rd.phases[rd.phases.length - 1];
        batch = ph.batch;
        pool  = getPool(ph.pool);
      }
      for (let i = 0; i < batch && enemies.length < 120; i++) spawnEnemy(pool);
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
      if (Math.random() < e.drop && dropRd?.type !== 'wave') {
        powerups.push({ laneIndex:e.laneIndex, laneX:e.laneX,
          depth:0.05, type:PU_TYPES[Math.floor(Math.random()*3)], life:600,
          animFrame:0, animTimer:0 });
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
      switch (p.type) {
        case 'atk': pl.atk  = Math.min(pl.atk  + 5,  500); break;
        case 'spd': pl.bspd = Math.min(pl.bspd + 5,  100); break;
        case 'bsr': pl.burst = Math.min(parseFloat((pl.burst + 0.1).toFixed(1)), 10); break;
      }
      pl.notif = { type: p.type, t: 130 };
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
      ctx.fillStyle='#ff2200'; ctx.fillRect(es.x-esr, es.y-esr-6, esr*2*(e.currentHp/e.hp), 3);
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
  ctx.fillStyle=hr>0.6?'#44ee44':hr>0.3?'#eeee44':'#ee4444';
  ctx.fillRect(hx, hy+16, 120*hr, 14);
  ctx.strokeStyle='#555'; ctx.lineWidth=1; ctx.strokeRect(hx, hy+16, 120, 14);
  ctx.fillStyle='#fff'; ctx.font='9px monospace';
  ctx.fillText(`HP ${pl.hp}/${pl.maxHp}`, hx+2, hy+27);

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
  ctx.fillStyle=dr>0.6?'#4488ff':dr>0.3?'#ffaa44':'#ff4444';
  ctx.fillRect(hx, hy+60, 120*dr, 12);
  ctx.strokeStyle='#555'; ctx.lineWidth=1; ctx.strokeRect(hx, hy+60, 120, 12);
  ctx.fillStyle='#fff'; ctx.font='9px monospace';
  ctx.fillText(`${defenseHp}/${INIT_DEFENSE}`, hx+2, hy+71);

  // ── ラウンド情報（上中央） ──
  const cx=W/2;
  const curRd = roundIdx < ROUNDS.length ? ROUNDS[roundIdx] : null;
  const rdLabel = curRd
    ? (curRd.type === 'wave' ? `WAVE ${curRd.waveNum}` : `ROUND ${curRd.num}`)
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
    ctx.save();
    ctx.globalAlpha = Math.min(1, pl.notif.t / 30);
    if (notifImg?.complete && notifImg.naturalWidth) {
      const ns = 160;
      ctx.drawImage(notifImg, W/2 - ns/2, H/2 - ns - 20, ns, ns);
    } else {
      ctx.fillStyle='#ffff44'; ctx.shadowColor='#ff8800'; ctx.shadowBlur=20;
      ctx.font='bold 20px monospace'; ctx.textAlign='center';
      ctx.fillText(PU_LABEL[pl.notif.type], W/2, H/2-60);
    }
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
  ctx.fillText('RADAR', rcx, rcy+rr+11);
}

// ─── Screens ─────────────────────────────────────────────────────────────────
function drawLoading() {
  ctx.fillStyle='rgba(0,0,0,0.80)'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#fff'; ctx.font='bold 22px monospace'; ctx.textAlign='center';
  ctx.textBaseline='middle'; ctx.fillText('LOADING...', W/2, H/2);
}
function drawGameOver() {
  ctx.fillStyle='rgba(0,0,0,0.78)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle='#ff2222'; ctx.shadowColor='#ff0000'; ctx.shadowBlur=36;
  ctx.font='bold 48px monospace'; ctx.fillText('GAME OVER', W/2, H/2-80);
  ctx.shadowBlur=0;
  const goRd = roundIdx < ROUNDS.length ? ROUNDS[roundIdx] : null;
  const goRdLabel = goRd
    ? (goRd.type === 'wave' ? `WAVE ${goRd.waveNum}` : `ROUND ${goRd.num}`)
    : 'ALL CLEAR!';
  ctx.fillStyle='#aaa'; ctx.font='14px monospace';
  ctx.fillText(`到達: ${goRdLabel}`, W/2, H/2-20);
  ctx.fillStyle='#ff3333'; ctx.font='bold 28px monospace';
  ctx.fillText(`撃破数: ${(INIT_ENEMIES-enemyCount).toLocaleString()}`, W/2, H/2+16);
  ctx.fillStyle='#88ccff'; ctx.font='13px monospace';
  ctx.fillText(`ATK:${pl.atk}  SPD:${pl.bspd}  BRS:${pl.burst}`, W/2, H/2+44);
  if (Math.floor(Date.now()/500)%2===0) {
    ctx.fillStyle='#ffff44'; ctx.font='14px monospace';
    ctx.fillText('タップでリトライ', W/2, H/2+88);
  }
}

// ─── Debug ────────────────────────────────────────────────────────────────────
let paused = false;
let enemySpeedMult = 1.0;

function toggleDebug() {
  const p = document.getElementById('dbgPanel');
  p.style.display = p.style.display === 'none' ? 'flex' : 'none';
}
function togglePause() {
  paused = !paused;
  document.getElementById('dbgPauseBtn').textContent = paused ? '▶ RESUME' : '⏸ PAUSE';
}
function dbgAtk(v)  { pl.atk  = Math.max(1, Math.min(500, pl.atk  + v)); }
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
window.addEventListener('keydown', e => { if (e.key === 'd' || e.key === 'D') toggleDebug(); });

// ─── Main Loop ────────────────────────────────────────────────────────────────
function loop(ts) {
  const dt=Math.min(ts-lastTs,50); lastTs=ts;
  if (gstate==='loading' && loaded>=toLoad) gstate='playing';
  if (gstate==='playing' && !paused) update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(ts=>{ lastTs=ts; requestAnimationFrame(loop); });
