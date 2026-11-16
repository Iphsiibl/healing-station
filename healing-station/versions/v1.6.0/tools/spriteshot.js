/* ============================================================
 * 素材一览表：把所有角色 / 物件渲染成一张 PNG，方便肉眼检查画风
 * 用法：node tools/spriteshot.js [输出路径] [放大倍数]
 * ============================================================ */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var gs = require('./gameshot.js');

var ROOT = path.resolve(__dirname, '..');
var sandbox = {
  console: console, Math: Math, Date: Date, JSON: JSON,
  localStorage: null
};
sandbox.window = sandbox;
vm.createContext(sandbox);
['games/pixel.js', 'games/sprites.js'].forEach(function (rel) {
  var code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  vm.runInContext(code, sandbox, { filename: rel });
});

var SPR = sandbox.HS_SPR;
var PAL = sandbox.HS_PIX.PAL;

var ITEMS = [
  ['WORKER', SPR.WORKER, SPR.MAP.worker],
  ['CAT', SPR.CAT, SPR.MAP.cat],
  ['BOSS_CALM', SPR.BOSS_CALM, SPR.MAP.boss],
  ['BOSS_SUSP', SPR.BOSS_SUSPICIOUS, SPR.MAP.boss],
  ['BOSS_ANGRY', SPR.BOSS_ANGRY, SPR.MAP.boss],
  ['CUP', SPR.CUP, SPR.MAP.cup],
  ['DONUT', SPR.DONUT, SPR.MAP.donut],
  ['FISH', SPR.FISH, SPR.MAP.fish],
  ['CACTUS', SPR.CACTUS, SPR.MAP.cactus],
  ['MONITOR', SPR.MONITOR, SPR.MAP.monitor],
  ['PLANT', SPR.PLANT, SPR.MAP.plant],
  ['KEYBOARD', SPR.KEYBOARD, SPR.MAP.keyboard],
  ['BELL', SPR.BELL, SPR.MAP.bell],
  ['BOAT', SPR.BOAT, SPR.MAP.boat],
  ['PAPER', SPR.PAPER, SPR.MAP.paper]
];

/* 一格 64×64，按 4 列排布 */
var CELL = 64, COLS = 5;
var rows = Math.ceil(ITEMS.length / COLS);
var W = COLS * CELL, H = rows * CELL + 30;
var ctx = gs.makeCtx(W, H);

/* 背景 */
ctx.fillStyle = PAL.paper;
ctx.fillRect(0, 0, W, H);
ctx.fillStyle = PAL.paper2;
for (var gy = 0; gy < H; gy += 16) ctx.fillRect(0, gy, W, 1);

ITEMS.forEach(function (it, idx) {
  var cx = (idx % COLS) * CELL, cy = ((idx / COLS) | 0) * CELL + 26;
  /* 格子底 */
  ctx.fillStyle = (idx % 2) ? PAL.paper : PAL.paper2;
  ctx.fillRect(cx + 1, cy + 1, CELL - 2, CELL - 2);
  ctx.fillStyle = PAL.paper3;
  ctx.fillRect(cx + 1, cy + 1, CELL - 2, 1);
  ctx.fillRect(cx + 1, cy + 1, 1, CELL - 2);
  /* 素材 */
  SPR.sprite(ctx, it[1], cx + (CELL - it[1][0].length) / 2, cy + (CELL - it[1].length) / 2, it[2], 1);
});

/* 顶部标题条 */
ctx.fillStyle = PAL.ink;
ctx.fillRect(0, 0, W, 22);
ctx.fillStyle = PAL.butter;
for (var i = 0; i < W; i += 4) ctx.fillRect(i, 20, 2, 2);

var out = process.argv[2] || path.join(ROOT, '.shots', 'sprites.png');
if (!fs.existsSync(path.dirname(out))) fs.mkdirSync(path.dirname(out), { recursive: true });
var scale = parseInt(process.argv[3] || '4', 10);
var png = gs.encodePNG(ctx._buffer, W, H, scale);
fs.writeFileSync(out, png);
console.log('✓ 素材表 ' + W + '×' + H + ' ×' + scale + ' → ' + out + ' (' + png.length + ' bytes)');
