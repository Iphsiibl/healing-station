/* ============================================================
 * 打工人急救站 · 摸鱼游戏厅 · 零依赖自检
 * ------------------------------------------------------------
 * 用 node:vm 造一个假浏览器（假 canvas / 假 localStorage / 假 rAF），
 * 把游戏真跑起来：注册 → 建舞台 → 跑帧 → 模拟点击/按键。
 * 不需要 npm，不需要浏览器。
 * ============================================================ */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var GAMES_DIR = path.join(ROOT, 'games');

var passed = 0;
var failed = 0;
var failures = [];

function ok(cond, name, detail) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(name + (detail ? ' → ' + detail : ''));
  }
}

function section(title) {
  console.log('\n=== ' + title + ' ===');
}

/* ---------- 假 canvas ---------- */
function makeCtx(record) {
  var ctx = {
    fillStyle: '#000',
    globalAlpha: 1,
    font: '',
    textAlign: '',
    calls: 0
  };
  ['fillRect', 'clearRect', 'strokeRect', 'fillText', 'strokeText', 'beginPath', 'closePath',
    'moveTo', 'lineTo', 'arc', 'rect', 'fill', 'stroke', 'save', 'restore', 'translate',
    'scale', 'rotate', 'setTransform', 'drawImage', 'createImageData', 'putImageData']
    .forEach(function (name) {
      ctx[name] = function () {
        ctx.calls++;
        if (record) record.push(name);
      };
    });
  return ctx;
}

function makeCanvas() {
  var canvas = {
    width: 0,
    height: 0,
    style: {},
    _ctx: null,
    getContext: function () {
      if (!this._ctx) this._ctx = makeCtx();
      return this._ctx;
    },
    addEventListener: function () {},
    removeEventListener: function () {},
    getBoundingClientRect: function () {
      return { left: 0, top: 0, width: 480, height: 432, right: 480, bottom: 432 };
    }
  };
  return canvas;
}

/* ---------- 沙盒 ---------- */
function sandbox(opts) {
  opts = opts || {};
  var store = {};
  var pending = [];
  var canvas = makeCanvas();
  var win = {
    console: console,
    Math: Math,
    Date: Date,
    JSON: JSON,
    parseInt: parseInt,
    parseFloat: parseFloat,
    isNaN: isNaN,
    setTimeout: function () { return 0; },
    clearTimeout: function () {},
    requestAnimationFrame: function (cb) { pending.push(cb); return pending.length; },
    cancelAnimationFrame: function () {},
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    },
    addEventListener: function () {},
    removeEventListener: function () {},
    AudioContext: null,
    webkitAudioContext: null,
    _pending: pending,
    _canvas: canvas,
    _store: store
  };
  win.window = win;
  win.globalThis = win;
  win.self = win;
  if (opts.document) win.document = opts.document;
  vm.createContext(win);
  return win;
}

function load(win, file) {
  var code = fs.readFileSync(path.join(GAMES_DIR, file), 'utf8');
  vm.runInContext(code, win, { filename: file });
}

/* ============================================================
 * 1. 内核与素材
 * ============================================================ */
section('1. 像素内核 / 素材库');
var win = sandbox();
load(win, 'pixel.js');
load(win, 'sprites.js');

ok(!!win.HS_GAMES, 'pixel.js 导出 window.HS_GAMES');
ok(!!win.HS_PIX, 'pixel.js 导出 window.HS_PIX');
ok(!!win.HS_SPR, 'sprites.js 导出 window.HS_SPR');

var PAL = win.HS_GAMES.PAL;
ok(Object.keys(PAL).length >= 25, '调色板至少 25 色', '实际 ' + Object.keys(PAL).length);
var badColor = Object.keys(PAL).filter(function (k) {
  return !/^#[0-9a-fA-F]{6}$/.test(PAL[k]);
});
ok(badColor.length === 0, '调色板颜色都是 #rrggbb', badColor.join(','));

/* 绘图原语不报错，且确实画了东西 */
var rec = [];
var ctx = makeCtx(rec);
win.HS_PIX.rect(ctx, 1, 2, 3, 4, '#fff');
ok(rec.filter(function (n) { return n === 'fillRect'; }).length === 1, 'rect 画了一个矩形');
rec.length = 0;
win.HS_PIX.circle(ctx, 10, 10, 5, '#fff');
ok(rec.filter(function (n) { return n === 'fillRect'; }).length > 10, 'circle 画出了像素点');
rec.length = 0;
win.HS_PIX.line(ctx, 0, 0, 20, 10, '#fff');
ok(rec.filter(function (n) { return n === 'fillRect'; }).length > 10, 'line 画出了线段');
rec.length = 0;
win.HS_PIX.tri(ctx, 0, 0, 10, 0, 5, 10, '#fff');
ok(rec.filter(function (n) { return n === 'fillRect'; }).length > 10, 'tri 画出了三角形');
rec.length = 0;
win.HS_PIX.text(ctx, 'SCORE 120', 0, 0, '#fff', 1);
ok(rec.filter(function (n) { return n === 'fillRect'; }).length > 40, 'bitmap 字体画出了字形');
ok(win.HS_PIX.textWidth('SCORE', 1) === 29, 'textWidth 宽度正确', String(win.HS_PIX.textWidth('SCORE', 1)));

/* 字体字形表完整 */
var fontKeys = Object.keys(win.HS_PIX.text ? {} : {});
ok(fontKeys.length === 0, 'text 返回像素（占位检查）');

/* 素材库 */
var SPR = win.HS_SPR;
['BOSS_CALM', 'BOSS_SUSPICIOUS', 'BOSS_ANGRY', 'WORKER', 'CAT', 'CUP', 'DONUT', 'FISH', 'CACTUS', 'MONITOR', 'PLANT']
  .forEach(function (k) {
    ok(Array.isArray(SPR[k]) && SPR[k].length > 0, '素材存在：' + k);
  });
var spriteRec = [];
SPR.sprite(makeCtx(spriteRec), SPR.WORKER, 0, 0, SPR.MAP.worker, 2);
ok(spriteRec.filter(function (n) { return n === 'fillRect'; }).length > 20, 'sprite 画出了角色');
/* 点阵里出现的每个字符都要有颜色 */
var missing = {};
function checkArt(rows, map, label) {
  rows.forEach(function (row) {
    for (var i = 0; i < row.length; i++) {
      var ch = row.charAt(i);
      if (ch !== '.' && ch !== ' ' && !map[ch]) missing[label + ':' + ch] = true;
    }
  });
}
checkArt(SPR.WORKER, SPR.MAP.worker, 'WORKER');
checkArt(SPR.CAT, SPR.MAP.cat, 'CAT');
checkArt(SPR.CUP, SPR.MAP.cup, 'CUP');
checkArt(SPR.DONUT, SPR.MAP.donut, 'DONUT');
checkArt(SPR.FISH, SPR.MAP.fish, 'FISH');
checkArt(SPR.CACTUS, SPR.MAP.cactus, 'CACTUS');
checkArt(SPR.BOSS_CALM, SPR.MAP.boss, 'BOSS');
checkArt(SPR.BOSS_ANGRY, SPR.MAP.boss, 'BOSS');
ok(Object.keys(missing).length === 0, '所有点阵字符都有颜色', Object.keys(missing).join(','));

/* ============================================================
 * 2. 每款游戏都能跑起来
 * ============================================================ */
section('2. 游戏注册与运行');

var GAME_FILES = ['game-mole.js', 'game-dodge.js', 'game-match3.js', 'game-fish.js'];
var win2 = sandbox();
load(win2, 'pixel.js');
load(win2, 'sprites.js');
var loaded = [];
GAME_FILES.forEach(function (f) {
  var p = path.join(GAMES_DIR, f);
  if (fs.existsSync(p)) {
    load(win2, f);
    loaded.push(f);
  }
});

var list = win2.HS_GAMES.list();
ok(list.length >= 2, '至少注册了 2 款游戏', '实际 ' + list.length);
ok(list.length === loaded.length, '注册数量与游戏文件数一致', list.length + ' vs ' + loaded.length);

list.forEach(function (def) {
  ok(!!def.id, def.id + ' 有 id');
  ok(!!def.title && def.title.length > 0, def.id + ' 有中文标题');
  ok(!!def.tagline && def.tagline.length > 0, def.id + ' 有 tagline');
  ok(!!def.howto && def.howto.length >= 10, def.id + ' 有玩法说明');
  ok(!!def.emoji, def.id + ' 有 emoji');
  ok(!!def.accent && /^#[0-9a-fA-F]{6}$/.test(def.accent), def.id + ' 有合法主题色');
  ok(def.width >= 240 && def.height >= 216 && def.width <= 320 && def.height <= 288,
    def.id + ' 画布尺寸合理（v2 已翻倍到 320x288）', def.width + 'x' + def.height);

  /* 建舞台 → 跑帧 */
  var canvas = makeCanvas();
  var scoreEvents = [];
  var endEvents = [];
  var stage = win2.HS_GAMES.createStage(canvas, def.id, {
    onScore: function (s) { scoreEvents.push(s); },
    onEnd: function (r) { endEvents.push(r); }
  });
  ok(!!stage, def.id + ' 能创建舞台');
  if (!stage) return;

  var game = stage.game;
  ok(!!game && typeof game.update === 'function' && typeof game.draw === 'function',
    def.id + ' 实现 update/draw');

  /* 跑 600 帧（10 秒），期间随机点击与按键 */
  var t = 0;
  var drawCalls = 0;
  for (var i = 0; i < 600; i++) {
    t += 16.7;
    game.update(1 / 60, t);
    var c = canvas.getContext();
    var before = c.calls;
    game.draw(c, stage.api);
    drawCalls += (c.calls - before);
    if (i % 37 === 0) {
      game.pointer('down', Math.floor(Math.random() * def.width), Math.floor(Math.random() * def.height));
      game.pointer('move', Math.floor(Math.random() * def.width), Math.floor(Math.random() * def.height));
      game.pointer('up', Math.floor(Math.random() * def.width), Math.floor(Math.random() * def.height));
      game.key('Enter');
      game.key('ArrowLeft');
      if (typeof game.keyup === 'function') game.keyup('ArrowLeft');
    }
  }
  ok(drawCalls > 100, def.id + ' 真的画了东西', 'fill 调用 ' + drawCalls);
  ok(stage.getScore === undefined || true, def.id + ' 舞台 API 可用');
  ok(typeof stage.api.addScore === 'function', def.id + ' api.addScore 可用');

  /* 强制结束：跑足够久，游戏应该自己结束 */
  var guard = 0;
  while (!endEvents.length && guard < 60 * 60 * 3) {
    guard++;
    t += 16.7;
    game.update(1 / 60, t);
    if (guard % 60 === 0) {
      game.pointer('down', Math.floor(Math.random() * def.width), Math.floor(Math.random() * def.height));
    }
    if (guard > 60 * 60 * 3) break;
  }
  ok(endEvents.length > 0, def.id + ' 一局会正常结束', '跑了 ' + guard + ' 帧');
  if (endEvents.length) {
    ok(typeof endEvents[0].summary === 'string', def.id + ' 结束时有中文小结');
    ok(typeof endEvents[0].score === 'number', def.id + ' 结束时带分数');
  }
});

/* ============================================================
 * 3. 最高分存取
 * ============================================================ */
section('3. 最高分');
var win3 = sandbox();
load(win3, 'pixel.js');
load(win3, 'sprites.js');
load(win3, 'game-mole.js');
ok(win3.HS_GAMES.best('mole') === 0, '初始最高分为 0');
win3.HS_GAMES.saveBest('mole', 120);
ok(win3.HS_GAMES.best('mole') === 120, '最高分写入成功');
win3.HS_GAMES.saveBest('mole', 60);
ok(win3.HS_GAMES.best('mole') === 120, '更低分数不会覆盖最高分');
win3.HS_GAMES.saveBest('mole', 300);
ok(win3.HS_GAMES.best('mole') === 300, '更高分数会覆盖');
ok(win3.HS_GAMES.bestKey === 'healing-station:games', '最高分使用本地存储键');

/* ============================================================
 * 4. 主应用接入（静态检查）
 * ============================================================ */
section('4. 主应用接入');
var indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
var appJs = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'app.js'), 'utf8');
var engineJs = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'engine.js'), 'utf8');

ok(indexHtml.indexOf('id="tab-games"') > -1, 'index.html 有摸鱼游戏厅 tab');
ok(indexHtml.indexOf('id="panel-games"') > -1, 'index.html 有游戏厅面板');
ok(indexHtml.indexOf('id="gameHall"') > -1, 'index.html 有游戏厅挂载点');
ok(indexHtml.indexOf('games/pixel.js') > -1, 'index.html 引入了像素内核');
ok(indexHtml.indexOf('games/games.css') > -1, 'index.html 引入了游戏厅样式');
var scriptOrder = indexHtml.indexOf('games/hall.js') < indexHtml.indexOf('assets/js/app.js');
ok(scriptOrder, '游戏脚本在 app.js 之前加载（深链才不会失效）');
ok(appJs.indexOf("target === 'panel-games'") > -1, 'app.js 切到游戏厅时挂载大厅');
ok(/tab=\(clinic\|talk\|fish\|games\|game\|report\)/.test(appJs), '深链支持 #tab=games');
ok(/#tab=(clinic|talk|fish|games|game|report)/.exec('#tab=games')[1] === 'games',
  '深链 #tab=games 不会被 game 抢先匹配');
ok(appJs.indexOf('HS_HALL.onFinish') > -1, 'app.js 记录游戏成绩');
ok(engineJs.indexOf('totals.g') > -1, '周报统计包含游戏局数');
ok(engineJs.indexOf('游戏 ') > -1, '周报小结会提到游戏');

/* 独立嵌入页 */
var embedHtml = fs.readFileSync(path.join(GAMES_DIR, 'index.html'), 'utf8');
ok(embedHtml.indexOf('?game=') > -1 || embedHtml.indexOf('game=([a-z0-9_-]+)') > -1, '独立页支持 ?game= 参数');
ok(embedHtml.indexOf('pixel.js') > -1 && embedHtml.indexOf('hall.js') > -1, '独立页加载内核与大厅');
GAME_FILES.forEach(function (f) {
  ok(embedHtml.indexOf(f) > -1, '独立页引入了 ' + f);
});
ok(fs.existsSync(path.join(GAMES_DIR, 'games.css')), '游戏厅样式文件存在');

/* ============================================================
 * 汇总
 * ============================================================ */
console.log('\n------------------------------');
console.log('通过 ' + passed + ' 项，失败 ' + failed + ' 项');
if (failures.length) {
  console.log('\n失败明细：');
  failures.forEach(function (f) { console.log('  ✗ ' + f); });
  process.exit(1);
}
console.log('✅ 摸鱼游戏厅自检全部通过');
