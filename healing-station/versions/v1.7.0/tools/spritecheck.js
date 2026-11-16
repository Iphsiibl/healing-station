/* 素材自检：检查每张字符画的行宽是否一致、字符是否都在调色板里
 * 用法：node tools/spritecheck.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var sandbox = {
  console: console,
  Math: Math,
  Date: Date,
  JSON: JSON,
  module: { exports: {} },
  localStorage: null
};
sandbox.window = sandbox;
vm.createContext(sandbox);

function load(rel) {
  var code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  vm.runInContext(code, sandbox, { filename: rel });
}

load('games/pixel.js');
load('games/sprites.js');

var SPR = sandbox.HS_SPR;
var PAL = sandbox.HS_PIX.PAL;
var fails = 0, checks = 0;

function check(cond, msg) {
  checks++;
  if (!cond) { fails++; console.log('  ✗ ' + msg); }
}

var names = ['WORKER', 'CAT', 'BOSS_CALM', 'BOSS_SUSPICIOUS', 'BOSS_ANGRY',
  'CUP', 'DONUT', 'FISH', 'CACTUS', 'MONITOR', 'PLANT', 'KEYBOARD',
  'BELL', 'BOAT', 'PAPER'];

var MAP_FOR = {
  WORKER: 'worker', CAT: 'cat', BOSS_CALM: 'boss', BOSS_SUSPICIOUS: 'boss',
  BOSS_ANGRY: 'boss', CUP: 'cup', DONUT: 'donut', FISH: 'fish',
  CACTUS: 'cactus', MONITOR: 'monitor', PLANT: 'plant', KEYBOARD: 'keyboard',
  BELL: 'bell', BOAT: 'boat', PAPER: 'paper'
};

console.log('— 素材行宽 / 调色板检查 —');
names.forEach(function (n) {
  var rows = SPR[n];
  check(!!rows && Array.isArray(rows), n + ' 存在且是数组');
  if (!rows) return;
  var w = rows[0].length;
  var bad = [];
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].length !== w) bad.push(i + '(行宽' + rows[i].length + '≠' + w + ')');
  }
  check(bad.length === 0, n + ' 行宽一致：' + w + '，异常行 ' + (bad.length ? bad.join(',') : '无'));

  var map = SPR.MAP[MAP_FOR[n]];
  var unknown = {};
  for (var r = 0; r < rows.length; r++) {
    for (var c = 0; c < rows[r].length; c++) {
      var ch = rows[r].charAt(c);
      if (ch === '.' || ch === ' ') continue;
      if (!map[ch]) unknown[ch] = true;
    }
  }
  var uk = Object.keys(unknown);
  check(uk.length === 0, n + ' 字符都在调色板里' + (uk.length ? '，缺失：' + uk.join('') : ''));
});

console.log('— 老板三种表情差异 —');
function faceDiff(a, b) {
  var d = 0;
  for (var i = 0; i < a.length; i++) {
    for (var j = 0; j < a[i].length; j++) if (a[i][j] !== b[i][j]) d++;
  }
  return d;
}
check(faceDiff(SPR.BOSS_CALM, SPR.BOSS_ANGRY) >= 4, 'calm 与 angry 脸型差异足够（>=4 像素）');
check(faceDiff(SPR.BOSS_SUSPICIOUS, SPR.BOSS_ANGRY) >= 4, 'suspicious 与 angry 脸型差异足够（>=4 像素）');
check(faceDiff(SPR.BOSS_CALM, SPR.BOSS_SUSPICIOUS) >= 4, 'calm 与 suspicious 脸型差异足够（>=4 像素）');
check(SPR.BOSS_CALM.length === SPR.BOSS_ANGRY.length, '老板三种表情行数一致');

console.log('— 尺寸合理性（像素点够多） —');
var sizes = {
  WORKER: SPR.sizeOf(SPR.WORKER),
  CAT: SPR.sizeOf(SPR.CAT),
  BOSS: SPR.sizeOf(SPR.BOSS_CALM),
  CUP: SPR.sizeOf(SPR.CUP)
};
Object.keys(sizes).forEach(function (k) {
  var s = sizes[k];
  console.log('  · ' + k + ' = ' + s.w + '×' + s.h);
});
check(sizes.WORKER.w >= 18 && sizes.WORKER.h >= 20, '同事尺寸 ≥18×20');
check(sizes.BOSS.w >= 22 && sizes.BOSS.h >= 24, '老板尺寸 ≥22×24');
check(sizes.CAT.w >= 16, '猫尺寸 ≥16 宽');

console.log('\n检查项 ' + checks + '，失败 ' + fails);
process.exit(fails ? 1 : 0);
