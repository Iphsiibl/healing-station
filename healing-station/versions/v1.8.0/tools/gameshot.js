/* ============================================================
 * 摸鱼游戏厅 · 离线像素渲染器
 * ------------------------------------------------------------
 * 用途：把游戏画面直接渲染成 PNG 文件，方便在没有浏览器的环境里
 *       快速打磨画风（比开浏览器截图快几十倍）。
 *
 * 原理：游戏里的所有绘制最终都落在 ctx.fillRect 上（我们刻意不使用
 *       路径、渐变、字体），所以这里实现一个极小的软件光栅器就够了：
 *       fillRect + 全局偏移（震屏）+ 透明度混合。
 *       再用 Node 内置的 zlib 手写一个 PNG 编码器输出图片。
 *
 * 用法：
 *   node tools/gameshot.js                 # 四款游戏各出一张
 *   node tools/gameshot.js mole            # 只出某一款
 *   node tools/gameshot.js mole 120 out.png
 * ============================================================ */
'use strict';

var fs = require('fs');
var path = require('path');
var zlib = require('zlib');
var vm = require('vm');

var ROOT = path.resolve(__dirname, '..');
var GAMES_DIR = path.join(ROOT, 'games');

/* ------------------------------------------------------------
 * 颜色解析：#rgb / #rrggbb / rgb(...) / rgba(...)
 * ------------------------------------------------------------ */
function parseColor(c) {
  if (typeof c !== 'string') return [0, 0, 0, 1];
  var s = c.trim().toLowerCase();
  if (s.charAt(0) === '#') {
    var h = s.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) return [0, 0, 0, 1];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  var m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    var p = m[1].split(',');
    return [
      Math.round(parseFloat(p[0]) || 0),
      Math.round(parseFloat(p[1]) || 0),
      Math.round(parseFloat(p[2]) || 0),
      p.length > 3 ? parseFloat(p[3]) : 1
    ];
  }
  return [0, 0, 0, 1];
}

/* ------------------------------------------------------------
 * 迷你软件画布
 * ------------------------------------------------------------ */
function makeCtx(w, h) {
  var buf = new Uint8ClampedArray(w * h * 4);
  var st = { fill: '#000000', alpha: 1, ox: 0, oy: 0 };
  var stack = [];

  function blend(x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    var i = (y * w + x) * 4;
    if (a >= 1) {
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
      return;
    }
    var da = buf[i + 3] / 255;
    var oa = a + da * (1 - a);
    if (oa <= 0) { buf[i + 3] = 0; return; }
    buf[i] = (r * a + buf[i] * da * (1 - a)) / oa;
    buf[i + 1] = (g * a + buf[i + 1] * da * (1 - a)) / oa;
    buf[i + 2] = (b * a + buf[i + 2] * da * (1 - a)) / oa;
    buf[i + 3] = oa * 255;
  }

  var ctx = {
    canvas: { width: w, height: h },
    imageSmoothingEnabled: false,
    get fillStyle() { return st.fill; },
    set fillStyle(v) { st.fill = v; },
    get globalAlpha() { return st.alpha; },
    set globalAlpha(v) { st.alpha = typeof v === 'number' ? v : 1; },
    fillRect: function (x, y,ww,hh) {
      var col = parseColor(st.fill);
      var a = col[3] * st.alpha;
      if (a <= 0) return;
      var x0 = Math.round(x + st.ox), y0 = Math.round(y + st.oy);
      var x1 = x0 + Math.round(ww), y1 = y0 + Math.round(hh);
      for (var yy = y0; yy < y1; yy++) {
        for (var xx = x0; xx < x1; xx++) blend(xx, yy, col[0], col[1], col[2], a);
      }
    },
    clearRect: function () {},
    save: function () { stack.push({ fill: st.fill, alpha: st.alpha, ox: st.ox, oy: st.oy }); },
    restore: function () { var s = stack.pop(); if (s) { st.fill = s.fill; st.alpha = s.alpha; st.ox = s.ox; st.oy = s.oy; } },
    translate: function (x, y) { st.ox += x | 0; st.oy += y | 0; },
    strokeRect: function () {},
    beginPath: function () {}, closePath: function () {}, moveTo: function () {},
    lineTo: function () {}, fill: function () {}, stroke: function () {},
    arc: function () {}, ellipse: function () {}, drawImage: function () {},
    measureText: function (t) { return { width: String(t).length * 6 }; },
    createLinearGradient: function () { return { addColorStop: function () {} }; }
  };
  ctx._buffer = buf;
  return ctx;
}

/* ------------------------------------------------------------
 * PNG 编码器（零依赖，用 Node 自带 zlib）
 * ------------------------------------------------------------ */
var CRC_TABLE = (function () {
  var t = new Int32Array(256);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  var c = -1;
  for (var i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  var len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  var body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  var crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(buf, w, h, scale) {
  scale = scale || 1;
  var outW = w * scale, outH = h * scale;
  var raw = Buffer.alloc((outW * 4 + 1) * outH);
  var p = 0;
  for (var y = 0; y < outH; y++) {
    raw[p++] = 0;                       // filter: None
    var sy = (y / scale) | 0;
    for (var x = 0; x < outW; x++) {
      var sx = (x / scale) | 0;
      var i = (sy * w + sx) * 4;
      raw[p++] = buf[i]; raw[p++] = buf[i + 1]; raw[p++] = buf[i + 2]; raw[p++] = buf[i + 3];
    }
  }
  var ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(outW, 0);
  ihdr.writeUInt32BE(outH, 4);
  ihdr[8] = 8;    // bit depth
  ihdr[9] = 6;    // RGBA
  var png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
  return png;
}

/* ------------------------------------------------------------
 * 沙箱：加载像素内核 + 素材 + 四款游戏
 * ------------------------------------------------------------ */
function bootGame(id, opts) {
  opts = opts || {};
  var def = null;
  var rafQueue = [];
  var listeners = {};

  var sandbox = {
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Date: Date,
    Math: Math,
    JSON: JSON,
    localStorage: {
      _d: {},
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
      setItem: function (k, v) { this._d[k] = String(v); },
      removeItem: function (k) { delete this._d[k]; }
    },
    requestAnimationFrame: function (fn) { rafQueue.push(fn); return rafQueue.length; },
    cancelAnimationFrame: function () {},
    addEventListener: function (type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener: function () {}
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  var ctxObj = vm.createContext(sandbox);

  var files = ['pixel.js', 'sprites.js', 'game-mole.js', 'game-dodge.js', 'game-match3.js', 'game-fish.js'];
  for (var i = 0; i < files.length; i++) {
    var code = fs.readFileSync(path.join(GAMES_DIR, files[i]), 'utf8');
    vm.runInContext(code, ctxObj, { filename: files[i] });
  }

  def = sandbox.HS_GAMES.get(id);
  if (!def) throw new Error('未注册的游戏：' + id);

  var W = def.width, H = def.height;
  var ctx2d = makeCtx(W, H);
  var canvas = {
    width: W, height: H, style: {},
    getContext: function () { return ctx2d; },
    addEventListener: function () {},
    removeEventListener: function () {},
    getBoundingClientRect: function () { return { left: 0, top: 0, width: W, height: H }; },
    parentNode: { getBoundingClientRect: function () { return { width: W * 2, height: H * 2 }; } }
  };

  var stage = sandbox.HS_GAMES.createStage(canvas, id, { seed: opts.seed || 12345 });
  stage.start();

  return {
    sandbox: sandbox,
    stage: stage,
    ctx2d: ctx2d,
    W: W, H: H,
    /* 推进 n 帧（每帧 1/60 秒） */
    step: function (n, onFrame) {
      for (var k = 0; k < n; k++) {
        var ts = (k + 1) * (1000 / 60);
        var q = rafQueue.splice(0, rafQueue.length);
        for (var j = 0; j < q.length; j++) q[j](ts);
        if (onFrame) onFrame(k, stage);
      }
    },
    /* 模拟点击（逻辑坐标） */
    click: function (x, y) {
      if (stage.game.pointer) {
        stage.game.pointer('down', x, y, { clientX: x, clientY: y, preventDefault: function () {} });
        stage.game.pointer('up', x, y, { clientX: x, clientY: y, preventDefault: function () {} });
      }
    },
    move: function (x, y) {
      if (stage.game.pointer) stage.game.pointer('move', x, y, { clientX: x, clientY: y });
    }
  };
}

/* ------------------------------------------------------------
 * 主流程
 * ------------------------------------------------------------ */
function shoot(id, frames, outFile, scale, onFrame) {
  var g = bootGame(id, {});
  g.step(frames, onFrame);
  var png = encodePNG(g.ctx2d._buffer, g.W, g.H, scale || 3);
  fs.writeFileSync(outFile, png);
  return { file: outFile, bytes: png.length, W: g.W, H: g.H };
}

function main() {
  var args = process.argv.slice(2);
  var ids = args.length && args[0] !== 'all' ? [args[0]] : ['mole', 'dodge', 'match3', 'fish'];
  var frames = args.length > 1 ? parseInt(args[1], 10) : 90;
  var outDir = path.join(ROOT, '.shots');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var out = args.length > 2 && ids.length === 1
      ? args[2]
      : path.join(outDir, id + '.png');
    var r = shoot(id, frames, out, 3);
    console.log('✓ ' + id + '  ' + r.W + '×' + r.H + '  →  ' + r.file + '  (' + r.bytes + ' bytes)');
  }
}

if (require.main === module) main();

module.exports = { bootGame: bootGame, makeCtx: makeCtx, encodePNG: encodePNG, shoot: shoot };
