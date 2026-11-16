/* ============================================================
 * 打工人急救站 · 摸鱼游戏厅 · 像素内核 v2
 * ------------------------------------------------------------
 * 设计原则：
 *  1. 零依赖：不下载任何图片、字体、音频文件，美术全部由代码画。
 *  2. 中等分辨率画布（320×288）+ 整数倍放大，像素边缘永远硬。
 *     （v1 用的是 160×144，像素太粗、细节不够，已在 v2 翻倍重画。）
 *  3. classic script（普通 <script src>），不用 ES Module，
 *     这样 file:// 双击也能跑（ES Module 会被 CORS 拦）。
 *  4. 全部 API 挂在 window.HS_GAMES 上，方便被别的页面嵌入。
 * ============================================================ */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------
   * 调色板 v2：奶油纸底 + 柔和光晕，每个色系都给「亮 / 本 / 暗」三档，
   * 这样画角色时能随手做出体积感，而不是一坨平涂。
   * ------------------------------------------------------------ */
  var PAL = {
    /* 中性与纸 */
    black:   '#1b1826',
    ink:     '#2b2438',
    inkSoft: '#4a4258',
    line:    '#6b6280',
    gray:    '#9b93a8',
    grayD:   '#6e6680',
    grayL:   '#c3bccc',
    paper:   '#f8f0e1',
    paper2:  '#e9dcc4',
    paper3:  '#d3bf9e',
    cream:   '#f5e6c8',
    white:   '#fffdf7',
    /* 皮肤 */
    peach:   '#f3c9a6',
    peachL:  '#ffe3c8',
    peachD:  '#cf9f79',
    /* 珊瑚红 */
    coral:   '#f0837a',
    coralL:  '#ffb3a6',
    coralD:  '#c95f5f',
    red:     '#d94f4f',
    redD:    '#a33232',
    /* 粉 */
    rose:    '#f2a3b8',
    roseL:   '#ffd0dd',
    roseD:   '#c06a86',
    /* 绿 */
    mint:    '#8fd3b2',
    mintL:   '#bde8d2',
    mintD:   '#4f9c7c',
    olive:   '#8a9a5b',
    oliveD:  '#5f6d3a',
    teal:    '#2f8f8a',
    tealL:   '#6fd0c9',
    tealD:   '#1d6360',
    /* 黄 */
    butter:  '#f7d774',
    butterL: '#ffe9a8',
    butterD: '#d9a83f',
    gold:    '#e8b44a',
    goldL:   '#f7d98a',
    goldD:   '#b8862b',
    /* 紫 */
    lilac:   '#b9a6e3',
    lilacL:  '#ded3f5',
    lilacD:  '#7d6cb5',
    plum:    '#7a4a6b',
    plumL:   '#a8759a',
    plumD:   '#523048',
    /* 蓝 */
    sky:     '#8cc7e6',
    skyL:    '#bfe4f5',
    skyD:    '#4b87b0',
    navy:    '#3a4f7a',
    navyL:   '#6c85b5',
    navyD:   '#26334f',
    water:   '#3f6f96',
    waterL:  '#6fa8cf',
    waterD:  '#2b4f70',
    /* 木 */
    brown:   '#a5714c',
    brownL:  '#c9976c',
    brownD:  '#7a4f34',
    /* 金属 */
    steel:   '#8a93a8',
    steelL:  '#bcc3d6',
    steelD:  '#5b6377'
  };

  /* ------------------------------------------------------------
   * 绘图原语：全部落在整数像素上，不做抗锯齿
   * ------------------------------------------------------------ */
  function px(ctx, x, y, c) {
    ctx.fillStyle = c;
    ctx.fillRect(x | 0, y | 0, 1, 1);
  }

  function rect(ctx, x, y, w, h, c) {
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = c;
    ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
  }

  function frame(ctx, x, y, w, h, c) {
    rect(ctx, x, y, w, 1, c);
    rect(ctx, x, y + h - 1, w, 1, c);
    rect(ctx, x, y, 1, h, c);
    rect(ctx, x + w - 1, y, 1, h, c);
  }

  function hline(ctx, x, y, len, c) { rect(ctx, x, y, len, 1, c); }
  function vline(ctx, x, y, len, c) { rect(ctx, x, y, 1, len, c); }

  function line(ctx, x0, y0, x1, y1, c) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    var err = dx - dy;
    for (;;) {
      px(ctx, x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      var e2 = err * 2;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }

  function circle(ctx, cx, cy, r, c) {
    cx |= 0; cy |= 0; r |= 0;
    if (r <= 0) { px(ctx, cx, cy, c); return; }
    var x = r, y = 0, err = 1 - r;
    while (x >= y) {
      px(ctx, cx + x, cy + y, c); px(ctx, cx + y, cy + x, c);
      px(ctx, cx - y, cy + x, c); px(ctx, cx - x, cy + y, c);
      px(ctx, cx - x, cy - y, c); px(ctx, cx - y, cy - x, c);
      px(ctx, cx + y, cy - x, c); px(ctx, cx + x, cy - y, c);
      y++;
      if (err < 0) err += 2 * y + 1;
      else { x--; err += 2 * (y - x) + 1; }
    }
  }

  function ellipse(ctx, cx, cy, rx, ry, c) {
    if (rx <= 0 || ry <= 0) return;
    for (var y = -ry; y <= ry; y++) {
      var t = 1 - (y * y) / (ry * ry);
      if (t < 0) continue;
      var dx = Math.floor(rx * Math.sqrt(t));
      rect(ctx, cx - dx, cy + y, dx * 2 + 1, 1, c);
    }
  }

  function tri(ctx, x1, y1, x2, y2, x3, y3, c) {
    var minX = Math.min(x1, x2, x3), maxX = Math.max(x1, x2, x3);
    var minY = Math.min(y1, y2, y3), maxY = Math.max(y1, y2, y3);
    function side(ax, ay, bx, by, cx2, cy2) {
      return (bx - ax) * (cy2 - ay) - (by - ay) * (cx2 - ax);
    }
    for (var y = minY; y <= maxY; y++) {
      for (var x = minX; x <= maxX; x++) {
        var d1 = side(x1, y1, x2, y2, x, y);
        var d2 = side(x2, y2, x3, y3, x, y);
        var d3 = side(x3, y3, x1, y1, x, y);
        var neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
        var pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
        if (!(neg && pos)) px(ctx, x, y, c);
      }
    }
  }

  /* 圆角矩形（像素风用小半径就够） */
  function roundRect(ctx, x, y, w, h, r, c) {
    rect(ctx, x + r, y, w - r * 2, h, c);
    rect(ctx, x, y + r, r, h - r * 2, c);
    rect(ctx, x + w - r, y + r, r, h - r * 2, c);
    rect(ctx, x + r, y, r, r, c);
    rect(ctx, x + w - r, y, r, r, c);
    rect(ctx, x + r, y + h - r, r, r, c);
    rect(ctx, x + w - r, y + h - r, r, r, c);
  }

  /* 棋盘格背景（像素风的底纹） */
  function checker(ctx, x, y, w, h, c1, c2, size) {
    size = size || 4;
    for (var j = 0; j < h; j += size) {
      for (var i = 0; i < w; i += size) {
        var on = (((i / size) | 0) + ((j / size) | 0)) % 2 === 0;
        rect(ctx, x + i, y + j, size, size, on ? c1 : c2);
      }
    }
  }

  /* ------------------------------------------------------------
   * v2 新增：让画面「有层次」的四个小工具
   * ------------------------------------------------------------ */

  /* 竖向渐变：逐行插值，模拟墙面的受光 */
  function gradV(ctx, x, y, w, h, c1, c2) {
    if (h <= 0) return;
    for (var i = 0; i < h; i++) {
      var t = h === 1 ? 0 : i / (h - 1);
      ctx.fillStyle = mix(c1, c2, t);
      ctx.fillRect(x | 0, (y + i) | 0, w | 0, 1);
    }
  }

  function gradH(ctx, x, y, w, h, c1, c2) {
    if (w <= 0) return;
    for (var i = 0; i < w; i++) {
      var t = w === 1 ? 0 : i / (w - 1);
      ctx.fillStyle = mix(c1, c2, t);
      ctx.fillRect((x + i) | 0, y | 0, 1, h | 0);
    }
  }

  /* 颜色插值（只处理 #rrggbb） */
  function mix(c1, c2, t) {
    if (t <= 0) return c1;
    if (t >= 1) return c2;
    var a = hex(c1), b = hex(c2);
    return '#' + [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t)
    ].map(function (v) { var s = v.toString(16); return s.length < 2 ? '0' + s : s; }).join('');
  }

  function hex(c) {
    if (typeof c !== 'string' || c.charAt(0) !== '#') return [0, 0, 0];
    var h = c.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /* 斜纹阴影（dither）：像素风的「半透明」，比画一整块颜色更有质感 */
  function dither(ctx, x, y, w, h, c, density) {
    density = density === undefined ? 0.5 : density;
    ctx.fillStyle = c;
    for (var j = 0; j < h; j++) {
      for (var i = (j & 1); i < w; i += 2) {
        if ((i + j) % 4 === 0 || density > 0.75) ctx.fillRect((x + i) | 0, (y + j) | 0, 1, 1);
      }
    }
  }

  /* 浮雕：上边亮、下边暗，一眼就有厚度 */
  function bevel(ctx, x, y, w, h, light, dark) {
    hline(ctx, x, y, w, light);
    vline(ctx, x, y, h, light);
    hline(ctx, x, y + h - 1, w, dark);
    vline(ctx, x + w - 1, y, h, dark);
  }

  /* 落地阴影（椭圆） */
  function shadow(ctx, cx, cy, rx, ry, c) {
    ellipse(ctx, cx, cy, rx, ry, c);
  }

  /* ------------------------------------------------------------
   * 5×7 像素字体（只做数字和大写字母，中文交给 HTML 层）
   * ------------------------------------------------------------ */
  var FONT = {
    '0': '01110/10001/10011/10101/11001/10001/01110',
    '1': '00100/01100/00100/00100/00100/00100/01110',
    '2': '01110/10001/00001/00010/00100/01000/11111',
    '3': '11111/00010/00100/00010/00001/10001/01110',
    '4': '00010/00110/01010/10010/11111/00010/00010',
    '5': '11111/10000/11110/00001/00001/10001/01110',
    '6': '00110/01000/10000/11110/10001/10001/01110',
    '7': '11111/00001/00010/00100/01000/01000/01000',
    '8': '01110/10001/10001/01110/10001/10001/01110',
    '9': '01110/10001/10001/01111/00001/00010/01100',
    'A': '01110/10001/10001/11111/10001/10001/10001',
    'B': '11110/10001/10001/11110/10001/10001/11110',
    'C': '01110/10001/10000/10000/10000/10001/01110',
    'D': '11100/10010/10001/10001/10001/10010/11100',
    'E': '11111/10000/10000/11110/10000/10000/11111',
    'F': '11111/10000/10000/11110/10000/10000/10000',
    'G': '01110/10001/10000/10111/10001/10001/01111',
    'H': '10001/10001/10001/11111/10001/10001/10001',
    'I': '01110/00100/00100/00100/00100/00100/01110',
    'J': '00111/00010/00010/00010/00010/10010/01100',
    'K': '10001/10010/10100/11000/10100/10010/10001',
    'L': '10000/10000/10000/10000/10000/10000/11111',
    'M': '10001/11011/10101/10101/10001/10001/10001',
    'N': '10001/11001/10101/10011/10001/10001/10001',
    'O': '01110/10001/10001/10001/10001/10001/01110',
    'P': '11110/10001/10001/11110/10000/10000/10000',
    'Q': '01110/10001/10001/10001/10101/10010/01101',
    'R': '11110/10001/10001/11110/10100/10010/10001',
    'S': '01111/10000/10000/01110/00001/00001/11110',
    'T': '11111/00100/00100/00100/00100/00100/00100',
    'U': '10001/10001/10001/10001/10001/10001/01110',
    'V': '10001/10001/10001/10001/10001/01010/00100',
    'W': '10001/10001/10001/10101/10101/10101/01010',
    'X': '10001/10001/01010/00100/01010/10001/10001',
    'Y': '10001/10001/01010/00100/00100/00100/00100',
    'Z': '11111/00001/00010/00100/01000/10000/11111',
    ':': '00000/00100/00100/00000/00100/00100/00000',
    '.': '00000/00000/00000/00000/00000/01100/01100',
    ',': '00000/00000/00000/00000/01100/00100/01000',
    '!': '00100/00100/00100/00100/00100/00000/00100',
    '?': '01110/10001/00001/00010/00100/00000/00100',
    '-': '00000/00000/00000/11111/00000/00000/00000',
    '+': '00000/00100/00100/11111/00100/00100/00000',
    '/': '00001/00010/00100/00100/01000/10000/00000',
    '*': '00000/10101/01110/11111/01110/10101/00000',
    '(': '00010/00100/01000/01000/01000/00100/00010',
    ')': '01000/00100/00010/00010/00010/00100/01000',
    '%': '10001/10010/00100/01000/10000/00000/00000',
    '×': '00000/10001/01010/00100/01010/10001/00000',
    "'": '00100/00100/00000/00000/00000/00000/00000',
    '=': '00000/00000/11111/00000/11111/00000/00000',
    ' ': '00000/00000/00000/00000/00000/00000/00000'
  };

  function text(ctx, str, x, y, color, scale, bold) {
    scale = scale || 1;
    var cx = x | 0;
    str = String(str).toUpperCase();
    for (var i = 0; i < str.length; i++) {
      var g = FONT[str.charAt(i)] || FONT[' '];
      if (!g) continue;
      var rows = g.split('/');
      for (var r = 0; r < rows.length; r++) {
        for (var c = 0; c < rows[r].length; c++) {
          if (rows[r].charAt(c) === '1') {
            rect(ctx, cx + c * scale, y + r * scale, scale * (bold ? 2 : 1), scale, color);
          }
        }
      }
      cx += 6 * scale;
    }
    return cx - x;
  }

  function textWidth(str, scale, bold) {
    scale = scale || 1;
    return String(str).length * 6 * scale - scale + (bold ? scale : 0);
  }

  /* ------------------------------------------------------------
   * 音效：方波 / 三角波，实时合成，同样零文件
   * ------------------------------------------------------------ */
  var Sfx = (function () {
    var ctx = null, muted = false;

    function ensure() {
      if (ctx) return ctx;
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { ctx = null; }
      return ctx;
    }

    var TABLE = {
      hit:   { f: 520, to: 180, dur: 0.08, type: 'square', vol: 0.16 },
      pop:   { f: 760, to: 1180, dur: 0.09, type: 'square', vol: 0.14 },
      miss:  { f: 220, to: 120, dur: 0.14, type: 'sawtooth', vol: 0.12 },
      coin:  { f: 980, to: 1460, dur: 0.12, type: 'triangle', vol: 0.18 },
      level: { f: 660, to: 1320, dur: 0.22, type: 'square', vol: 0.16 },
      over:  { f: 400, to: 90,  dur: 0.45, type: 'sawtooth', vol: 0.14 },
      click: { f: 440, to: 660, dur: 0.05, type: 'square', vol: 0.10 },
      whoosh:{ f: 300, to: 900, dur: 0.12, type: 'triangle', vol: 0.10 },
      splash:{ f: 900, to: 240, dur: 0.18, type: 'triangle', vol: 0.16 },
      bell:  { f: 1320, to: 880, dur: 0.22, type: 'triangle', vol: 0.14 }
    };

    function play(name) {
      if (muted) return;
      var t = TABLE[name];
      if (!t) return;
      var c = ensure();
      if (!c) return;
      try {
        if (c.state === 'suspended' && c.resume) c.resume();
        var now = c.currentTime;
        var osc = c.createOscillator();
        var gain = c.createGain();
        osc.type = t.type;
        osc.frequency.setValueAtTime(t.f, now);
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, t.to), now + t.dur);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(t.vol, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + t.dur);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(now);
        osc.stop(now + t.dur + 0.02);
      } catch (e) { /* 静音失败也不能影响游戏 */ }
    }

    return {
      play: play,
      muted: function () { return muted; },
      setMuted: function (v) { muted = !!v; },
      toggle: function () { muted = !muted; return muted; }
    };
  })();

  /* ------------------------------------------------------------
   * 随机数（可播种，方便测试复现）
   * ------------------------------------------------------------ */
  function makeRng(seed) {
    var s = (seed === undefined ? Date.now() : seed) >>> 0;
    if (s === 0) s = 0x9e3779b9;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  /* ------------------------------------------------------------
   * 顶部状态条 v2：320 宽的画布上，文字放大到 2 倍才看得清
   * ------------------------------------------------------------ */
  function statusBar(api, o) {
    o = o || {};
    var ctx = api.ctx, W = api.W, P = PAL;
    var H = 18;
    ctx.fillStyle = P.ink;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = P.lilacD;
    ctx.fillRect(0, H - 2, W, 2);
    ctx.fillStyle = P.inkSoft;
    ctx.fillRect(0, 0, W, 1);

    var ty = 2;
    if (o.score !== undefined && o.score !== null) {
      api.text('SCORE', 6, ty, P.paper3, 2);
      var s = String(Math.floor(o.score));
      api.text(s, 152 - api.textWidth(s, 2), ty, P.butter, 2);
    }
    if (o.time !== undefined && o.time !== null) {
      var t = 'TIME ' + Math.max(0, Math.ceil(o.time));
      api.text(t, 166 + ((96 - api.textWidth(t, 2)) >> 1), ty, P.white, 2);
    }
    if (o.hearts !== undefined && o.hearts !== null) {
      var max = o.maxHearts || 3;
      for (var k = 0; k < max; k++) {
        var hx = W - 10 - (max - k) * 12;
        var on = k < o.hearts;
        ctx.fillStyle = on ? P.coral : P.grayD;
        ctx.fillRect(hx + 2, ty, 4, 2);
        ctx.fillRect(hx, ty + 2, 8, 4);
        ctx.fillRect(hx + 1, ty + 6, 6, 2);
        ctx.fillRect(hx + 2, ty + 8, 4, 2);
        ctx.fillRect(hx + 3, ty + 10, 2, 2);
        if (on) {
          ctx.fillStyle = P.coralL;
          ctx.fillRect(hx + 2, ty + 1, 2, 1);
        }
      }
    }
    if (o.best !== undefined && o.best !== null && o.hearts === undefined) {
      var b = 'BEST ' + Math.floor(o.best);
      api.text(b, W - api.textWidth(b, 2) - 8, ty, P.paper3, 2);
    }
  }

  /* ------------------------------------------------------------
   * 游戏舞台：画布、循环、输入、粒子、震屏
   * ------------------------------------------------------------ */
  function Stage(canvas, def, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.def = def;
    this.W = def.width || 320;
    this.H = def.height || 288;
    canvas.width = this.W;
    canvas.height = this.H;
    this.ctx = canvas.getContext('2d');
    if (this.ctx) this.ctx.imageSmoothingEnabled = false;
    this.onScore = opts.onScore || function () {};
    this.onEnd = opts.onEnd || function () {};
    this.onState = opts.onState || function () {};
    this.score = 0;
    this.best = opts.best || 0;
    this.over = false;
    this.started = false;
    this.elapsed = 0;
    this.shake = 0;
    this.particles = [];
    this.rng = makeRng(opts.seed);
    this.last = 0;
    this.raf = 0;
    this.running = false;
    var self = this;

    this.api = this.makeApi();
    this.game = def.create(this.api) || {};
    this.bindInput();
    this.resize();
    if (global.addEventListener) global.addEventListener('resize', function () { self.resize(); });
  }

  Stage.prototype.makeApi = function () {
    var self = this;
    var ctx = this.ctx;
    return {
      W: this.W,
      H: this.H,
      ctx: ctx,
      PAL: PAL,
      rand: function (min, max) {
        if (max === undefined) { max = min; min = 0; }
        return min + self.rng() * (max - min);
      },
      randInt: function (min, max) {
        if (max === undefined) { max = min; min = 0; }
        return Math.floor(min + self.rng() * (max - min + 1));
      },
      chance: function (p) { return self.rng() < p; },
      pick: function (arr) { return arr[Math.floor(self.rng() * arr.length)]; },
      shuffle: function (arr) {
        for (var i = arr.length - 1; i > 0; i--) {
          var j = Math.floor(self.rng() * (i + 1));
          var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
        return arr;
      },
      time: function () { return self.elapsed; },
      addScore: function (n) {
        self.score += (n || 0);
        self.onScore(self.score);
        return self.score;
      },
      getScore: function () { return self.score; },
      isOver: function () { return self.over; },
      end: function (summary) {
        if (self.over) return;
        self.over = true;
        self.onEnd({ score: self.score, summary: summary || '' });
      },
      sfx: function (name) { Sfx.play(name); },
      px: px, rect: rect, frame: frame, hline: hline, vline: vline,
      line: line, circle: circle, ellipse: ellipse, tri: tri,
      roundRect: roundRect, checker: checker,
      gradV: gradV, gradH: gradH, dither: dither, bevel: bevel, shadow: shadow,
      mix: mix,
      text: function (s, x, y, c, sc, bold) { return text(ctx, s, x, y, c, sc, bold); },
      textWidth: function (s, sc, bold) { return textWidth(s, sc, bold); },
      statusBar: function (o) { return statusBar(self.api, o); },
      kick: function (power) { self.shake = Math.max(self.shake, power || 3); },
      puff: function (x, y, color, count) {
        count = count || 6;
        for (var i = 0; i < count; i++) {
          var a = self.rng() * Math.PI * 2;
          var sp = 8 + self.rng() * 26;
          self.particles.push({
            x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10,
            life: 0.4 + self.rng() * 0.4, t: 0, c: color || PAL.coral
          });
        }
      },
      updateParticles: function (dt) {
        var list = self.particles;
        for (var i = list.length - 1; i >= 0; i--) {
          var p = list[i];
          p.t += dt;
          if (p.t >= p.life) { list.splice(i, 1); continue; }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 90 * dt;
        }
      },
      drawParticles: function () {
        for (var i = 0; i < self.particles.length; i++) {
          var p = self.particles[i];
          px(ctx, Math.round(p.x), Math.round(p.y), p.c);
        }
      },
      state: function (v) {
        if (v === undefined) return self.stateValue || {};
        self.stateValue = v;
        self.onState(self.stateValue);
      }
    };
  };

  Stage.prototype.resize = function () {
    if (!this.canvas || !this.canvas.parentNode) return;
    var box = this.canvas.parentNode.getBoundingClientRect
      ? this.canvas.parentNode.getBoundingClientRect()
      : { width: 0, height: 0 };
    var avail = Math.floor(box.width) || this.W * 2;
    var scale = Math.max(1, Math.floor(avail / this.W));
    if (scale > 6) scale = 6;
    this.canvas.style.width = (this.W * scale) + 'px';
    this.canvas.style.height = (this.H * scale) + 'px';
    this.scale = scale;
  };

  Stage.prototype.toLogical = function (clientX, clientY) {
    var rect = this.canvas.getBoundingClientRect
      ? this.canvas.getBoundingClientRect()
      : { left: 0, top: 0, width: this.W, height: this.H };
    var x = (clientX - rect.left) / (rect.width || this.W) * this.W;
    var y = (clientY - rect.top) / (rect.height || this.H) * this.H;
    return { x: x, y: y };
  };

  Stage.prototype.bindInput = function () {
    var self = this;
    var canvas = this.canvas;
    if (!canvas || !canvas.addEventListener) return;

    function forward(type, e) {
      var p = self.toLogical(e.clientX, e.clientY);
      if (self.game.pointer) {
        try { self.game.pointer(type, p.x, p.y, e); } catch (err) { /* 单个游戏出错不影响其余 */ }
      }
      if (type === 'down' && e.preventDefault) e.preventDefault();
    }

    canvas.addEventListener('pointerdown', function (e) { forward('down', e); });
    canvas.addEventListener('pointermove', function (e) { forward('move', e); });
    canvas.addEventListener('pointerup', function (e) { forward('up', e); });
    // 老浏览器兜底
    canvas.addEventListener('mousedown', function (e) { forward('down', e); });
    canvas.addEventListener('touchstart', function (e) {
      var t = e.touches && e.touches[0];
      if (t) forward('down', t);
      if (e.preventDefault) e.preventDefault();
    }, { passive: false });

    if (global.addEventListener) {
      global.addEventListener('keydown', function (e) {
        if (!self.running) return;
        if (self.game.key) {
          try { self.game.key(e.key, e); } catch (err) { }
        }
      });
      global.addEventListener('keyup', function (e) {
        if (self.game.keyup) {
          try { self.game.keyup(e.key, e); } catch (err) { }
        }
      });
    }
  };

  Stage.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    this.started = true;
    this.last = 0;
    this.tick(0);
  };

  Stage.prototype.stop = function () {
    this.running = false;
    if (this.raf && global.cancelAnimationFrame) global.cancelAnimationFrame(this.raf);
    this.raf = 0;
  };

  Stage.prototype.destroy = function () {
    this.stop();
    if (this.game.destroy) {
      try { this.game.destroy(); } catch (e) { }
    }
    if (global.removeEventListener) {
      global.removeEventListener('resize', this.resizeHandler);
    }
  };

  Stage.prototype.tick = function (timestamp) {
    if (!this.running) return;
    var self = this;
    if (!this.last) this.last = timestamp;
    var dt = (timestamp - this.last) / 1000;
    this.last = timestamp;
    // 后台标签页回来会跳一大截，夹一下免得物理炸飞
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    this.elapsed += dt;

    if (this.game.update) {
      try { this.game.update(dt, this.elapsed); } catch (e) { }
    }
    this.api.updateParticles(dt);

    var ctx = this.ctx;
    if (ctx) {
      ctx.save();
      if (this.shake > 0) {
        this.shake = Math.max(0, this.shake - dt * 18);
        var sx = (this.rng() - 0.5) * this.shake;
        var sy = (self.rng() - 0.5) * this.shake;
        ctx.translate(Math.round(sx), Math.round(sy));
      }
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(0, 0, this.W, this.H);
      if (this.game.draw) {
        try { this.game.draw(ctx, this.api); } catch (e) { }
      }
      this.api.drawParticles();
      ctx.restore();
    }

    this.raf = global.requestAnimationFrame
      ? global.requestAnimationFrame(function (t) { self.tick(t); })
      : setTimeout(function () { self.tick(Date.now()); }, 16);
  };

  /* ------------------------------------------------------------
   * 对外 API
   * ------------------------------------------------------------ */
  var registry = {};

  var HS_GAMES = {
    PAL: PAL,
    Stage: Stage,
    Sfx: Sfx,
    registry: registry,

    /* 注册一款游戏：{ id, title, tagline, howto, emoji, accent, width, height, create(api) } */
    register: function (def) {
      if (!def || !def.id) return;
      registry[def.id] = def;
    },

    get: function (id) { return registry[id]; },

    list: function () {
      var out = [];
      for (var k in registry) {
        if (Object.prototype.hasOwnProperty.call(registry, k)) out.push(registry[k]);
      }
      return out;
    },

    /* 最高分：只存在本地 */
    bestKey: 'healing-station:games',
    best: function (id) {
      try {
        var raw = global.localStorage ? global.localStorage.getItem(this.bestKey) : null;
        var data = raw ? JSON.parse(raw) : {};
        return Math.round(data[id] || 0);
      } catch (e) { return 0; }
    },
    saveBest: function (id, score) {
      try {
        if (!global.localStorage) return;
        var raw = global.localStorage.getItem(this.bestKey);
        var data = raw ? JSON.parse(raw) : {};
        score = Math.round(score || 0);
        if (!(data[id] > score)) data[id] = score;
        global.localStorage.setItem(this.bestKey, JSON.stringify(data));
      } catch (e) { }
    },

    createStage: function (canvas, id, opts) {
      var def = registry[id];
      if (!def) return null;
      opts = opts || {};
      opts.best = this.best(id);
      return new Stage(canvas, def, opts);
    }
  };

  global.HS_GAMES = HS_GAMES;
  global.HS_PIX = {
    PAL: PAL, px: px, rect: rect, frame: frame, hline: hline, vline: vline,
    line: line, circle: circle, ellipse: ellipse, tri: tri,
    roundRect: roundRect, checker: checker, text: text, textWidth: textWidth,
    gradV: gradV, gradH: gradH, dither: dither, bevel: bevel, shadow: shadow,
    mix: mix, makeRng: makeRng, statusBar: statusBar
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HS_GAMES;
  }
})(typeof window !== 'undefined' ? window : this);
