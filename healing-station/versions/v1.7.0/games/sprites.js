/* ============================================================
 * 打工人急救站 · 摸鱼游戏厅 · 美术库 v2
 * ------------------------------------------------------------
 * v1 的问题：画布只有 160×144，角色是 8×8 的小方块，
 * 画面看起来「像素点太少、不够精美」。
 * v2 的做法：
 *   1. 画布翻倍到 320×288；
 *   2. 所有角色/物件重新手绘，尺寸翻倍并加描边、三档明暗、高光；
 *   3. 场景分层：墙面渐变 + 壁纸 + 窗 + 挂钟 + 海报 + 便利贴板
 *      + 置物架 + 踢脚线 + 地砖 / 木纹桌面 + 桌沿小物。
 *
 * 素材用「字符画 + 调色板」的方式画，运行时逐像素填充，
 * 所以放大后边缘依然是硬的（不依赖任何图片文件）。
 *
 * 所有行都用 row(宽, [起点, 内容], ...) 拼出来，
 * 这样每行宽度和左右对称性都由代码保证，不会画歪。
 * ============================================================ */
(function (global) {
  'use strict';

  var PAL = (global.HS_PIX && global.HS_PIX.PAL) || (global.HS_GAMES && global.HS_GAMES.PAL);

  /* 拼一行：row(22, [5,'KHH'], [12,'KK']) */
  function row(w) {
    var s = '';
    for (var i = 1; i < arguments.length; i++) {
      var p = arguments[i];
      while (s.length < p[0]) s += '.';
      s += p[1];
    }
    while (s.length < w) s += '.';
    return s.slice(0, w);
  }

  /* ------------------------------------------------------------
   * 调色板（每张「地图」定义自己的字母 → 颜色）
   * ------------------------------------------------------------ */
  var MAP = {
    boss: {
      K: PAL.ink, H: PAL.ink, S: PAL.peach, B: PAL.ink, E: PAL.ink,
      M: PAL.red, T: PAL.plum, N: PAL.peachD, P: PAL.navy, A: PAL.gold,
      U: PAL.ink
    },
    worker: {
      K: PAL.ink, H: PAL.brownD, S: PAL.peach, E: PAL.ink, M: PAL.red,
      T: PAL.coral, N: PAL.peachD, P: PAL.navy, A: PAL.butter
    },
    cat: {
      K: PAL.ink, B: PAL.steel, S: PAL.steelL, E: PAL.mint, N: PAL.rose, A: PAL.peach
    },
    cup: {
      K: PAL.ink, W: PAL.white, C: PAL.brown, H: PAL.white
    },
    donut: {
      K: PAL.ink, D: PAL.brownL, F: PAL.rose, R: PAL.butter, G: PAL.mint
    },
    fish: {
      K: PAL.ink, B: PAL.sky, F: PAL.skyD, E: PAL.ink, W: PAL.white, G: PAL.mint
    },
    cactus: {
      K: PAL.ink, G: PAL.mint, D: PAL.mintD, F: PAL.rose, P: PAL.brown
    },
    monitor: {
      K: PAL.ink, S: PAL.skyL, F: PAL.steel, D: PAL.steelD, W: PAL.white,
      C: PAL.sky, L: PAL.mint, P: PAL.paper2
    },
    plant: {
      K: PAL.ink, G: PAL.mint, D: PAL.mintD, P: PAL.coral, E: PAL.coralD
    },
    keyboard: {
      K: PAL.ink, W: PAL.paper, D: PAL.grayD, L: PAL.paper3
    },
    bell: {
      K: PAL.ink, Y: PAL.gold, L: PAL.goldL, D: PAL.goldD
    },
    boat: {
      K: PAL.ink, R: PAL.brown, L: PAL.brownL, W: PAL.white, S: PAL.grayD
    },
    paper: {
      K: PAL.ink, W: PAL.white, L: PAL.paper3, S: PAL.gray
    }
  };

  /* ------------------------------------------------------------
   * 角色素材
   * ------------------------------------------------------------ */

  /* 同事（22×24）：爆炸头、珊瑚色衬衫 + 领带 */
  var WORKER = [
    row(22),
    row(22, [7, 'KKKKKKKKKK']),
    row(22, [6, 'KHHHHHHHHHHK']),
    row(22, [5, 'KHHHHHHHHHHHHHK']),
    row(22, [5, 'KHSSSSSSSSSSHK']),
    row(22, [5, 'KHSSSSSSSSSSHK']),
    row(22, [5, 'KHSEESSSEESSHK']),
    row(22, [5, 'KHSSSMMSSSSSHK']),
    row(22, [5, 'KHSSSSSSSSSSHK']),
    row(22, [5, 'KHSSSSSSSSSSHK']),
    row(22, [5, 'KHHSSSSSSSSHHK']),
    row(22, [6, 'KSSSSSSSSSSK']),
    row(22, [8, 'NNNNNN']),
    row(22, [5, 'KTTTTTTTTTTTTK']),
    row(22, [5, 'KTTTTTTTTTTTTK']),
    row(22, [5, 'KTTTTTAATTTTTTK']),
    row(22, [5, 'KTTTTTTTTTTTTK']),
    row(22, [5, 'KTTTTTTTTTTTTK']),
    row(22, [5, 'KTTTTTTTTTTTTK']),
    row(22, [5, 'KTTTTTTTTTTTTK']),
    row(22, [6, 'KTTTTTTTTTTK']),
    row(22, [6, 'KTTTTTTTTTTK']),
    row(22, [6, 'KPPPPPPPPPPK']),
    row(22, [5, 'KPPPPPPPPPPPPK'])
  ];

  /* 猫（18×16）：灰色狸花，绿眼睛 */
  var CAT = [
    row(18, [3, 'KK'], [12, 'KK']),
    row(18, [2, 'KKK'], [11, 'KKK']),
    row(18, [2, 'KBBBBBBBBBBBBBK']),
    row(18, [2, 'KBSSSSSSSSSSBK']),
    row(18, [2, 'KBSSEESSSEESSBK']),
    row(18, [2, 'KBSSSSNNSSSSBK']),
    row(18, [2, 'KBSSSSSSSSSSBK']),
    row(18, [2, 'KBSSSSSSSSSSBK']),
    row(18, [2, 'KBBBBBBBBBBBBBK']),
    row(18, [3, 'KBSSSSSSSSSSBK']),
    row(18, [3, 'KBSSSSSSSSSSBK']),
    row(18, [3, 'KBBBBBBBBBBBBBK']),
    row(18, [4, 'KBBBBBBBBBBK']),
    row(18, [5, 'KKKKKKKKKK']),
    row(18, [3, 'KAAK'], [12, 'KAAK']),
    row(18, [3, 'KAAK'], [12, 'KAAK'])
  ];

  /* 老板（26×26）：三种表情，靠换「脸的几行」实现 */
  var BOSS_FACE = {
    calm: [
      'SSSSSSSSSS',
      'SSSSSSSSSS',
      'SSEESSEESS',
      'SSSSUUUUSS',
      'SSSSMMMMSS',
      'SSSSSSSSSS',
      'SSSSSSSSSS'
    ],
    suspicious: [
      'SSSSSSSSSS',
      'SSBBSSBBSS',
      'SSSEESSEES',
      'SSSSUUUUSS',
      'SSSMMMMSSS',
      'SSSSSSSSSS',
      'SSSSSSSSSS'
    ],
    angry: [
      'SSSSSSSSSS',
      'SSBSSSSBSS',
      'SSEESSEESS',
      'SSSSUUUUSS',
      'SSMMMMMMSS',
      'SSSSSSSSSS',
      'SSSSSSSSSS'
    ]
  };

  function buildBoss(faceName) {
    var face = BOSS_FACE[faceName] || BOSS_FACE.calm;
    var rows = [
      row(26, [9, 'KKKKKKKKKK']),
      row(26, [8, 'KHHHHHHHHHHK']),
      row(26, [7, 'KHHHHHHHHHHHHHK'])
    ];
    for (var f = 0; f < 7; f++) rows.push(row(26, [7, 'KH' + face[f] + 'HK']));
    rows.push(row(26, [7, 'KHHHHHHHHHHHHHK']));
    rows.push(row(26, [8, 'KHHHHHHHHHHK']));
    rows.push(row(26, [9, 'KKKKKKKKKK']));
    rows.push(row(26, [7, 'KTTTTTTTTTTTK']));
    rows.push(row(26, [7, 'KTTTTTTTTTTTK']));
    rows.push(row(26, [7, 'KTTTTTTTTTTTK']));
    rows.push(row(26, [7, 'KTTTTTTTTTTTK']));
    rows.push(row(26, [7, 'KTTTTTTTTTTTK']));
    rows.push(row(26, [7, 'KTTTTTTTTTTTK']));
    rows.push(row(26, [7, 'KTTTTTTTTTTTK']));
    rows.push(row(26, [7, 'KTTTTTTTTTTTK']));
    rows.push(row(26, [8, 'KTTTTTTTTTTK']));
    rows.push(row(26, [8, 'KTTTTTTTTTTK']));
    rows.push(row(26, [8, 'KPPPPPPPPK']));
    rows.push(row(26, [8, 'KPPPPPPPPK']));
    rows.push(row(26, [7, 'KPPPPPPPPPPK']));
    return rows;
  }

  var BOSS_CALM = buildBoss('calm');
  var BOSS_SUSPICIOUS = buildBoss('suspicious');
  var BOSS_ANGRY = buildBoss('angry');

  /* ------------------------------------------------------------
   * 物件素材
   * ------------------------------------------------------------ */

  /* 马克杯（14×16） */
  var CUP = [
    row(14, [3, 'KKKKKKKK']),
    row(14, [2, 'KWWWWWWWWK']),
    row(14, [2, 'KWCCCCCCWK']),
    row(14, [2, 'KWCCCCCCWK']),
    row(14, [2, 'KWCCCCCCWKK']),
    row(14, [2, 'KWCCCCCCWKK']),
    row(14, [2, 'KWCCCCCCWKK']),
    row(14, [2, 'KWCCCCCCWK']),
    row(14, [2, 'KWWWWWWWWK']),
    row(14, [2, 'KKKKKKKKKK']),
    row(14, [3, 'KWWWWWWK']),
    row(14, [3, 'KWWWWWWK']),
    row(14, [3, 'KKKKKKKK']),
    row(14, [4, 'KWWWWK']),
    row(14, [4, 'KWWWWK']),
    row(14, [5, 'KKKK'])
  ];

  /* 甜甜圈（16×12）：从上看，中间是洞 */
  var DONUT = [
    row(16, [5, 'KKKKKK']),
    row(16, [3, 'KKDDDDDDKK']),
    row(16, [2, 'KDDDDDDDDDDK']),
    row(16, [1, 'KDDFFFFFFFFDDK']),
    row(16, [1, 'KDFFRR'], [11, 'FFDK']),
    row(16, [1, 'KDFRR'], [11, 'RFDK']),
    row(16, [1, 'KDFRR'], [11, 'RFDK']),
    row(16, [1, 'KDFFRR'], [11, 'FFDK']),
    row(16, [1, 'KDDFFFFFFFFDDK']),
    row(16, [2, 'KDDDDDDDDDDK']),
    row(16, [3, 'KKDDDDDDKK']),
    row(16, [5, 'KKKKKK'])
  ];

  /* 小鱼（16×11）：头朝左，尾巴在右 */
  var FISH = [
    row(16, [6, 'KKKK']),
    row(16, [5, 'KFFFFK']),
    row(16, [4, 'KFFEBK']),
    row(16, [3, 'KFFFFFFK'], [12, 'KK']),
    row(16, [2, 'KFFFFFFFFK'], [12, 'KF']),
    row(16, [1, 'KFFFFFFFFK'], [11, 'KFK']),
    row(16, [2, 'KFFFFFFFFK'], [12, 'KF']),
    row(16, [3, 'KFFFFFFWWK'], [12, 'KK']),
    row(16, [4, 'KFFWWWWWWK']),
    row(16, [5, 'KWWWWWWWK']),
    row(16, [6, 'KKKKKKK'])
  ];

  /* 仙人掌（12×16） */
  var CACTUS = [
    row(12, [5, 'KK']),
    row(12, [5, 'KGGK']),
    row(12, [5, 'KGGK']),
    row(12, [5, 'KGGK']),
    row(12, [2, 'KK'], [5, 'KGGK']),
    row(12, [2, 'KGGK'], [5, 'KGGK']),
    row(12, [2, 'KGGK'], [5, 'KGGK']),
    row(12, [2, 'KGGK'], [5, 'KGGK']),
    row(12, [2, 'KGGK'], [5, 'KGGK']),
    row(12, [5, 'KGGK']),
    row(12, [5, 'KGGK']),
    row(12, [5, 'KGGK']),
    row(12, [5, 'KGGK']),
    row(12, [4, 'KKKKKK']),
    row(12, [3, 'KPPPPPPK']),
    row(12, [2, 'KPPPPPPPPK'])
  ];

  /* 显示器（26×20）：屏幕里画着 Excel 表格 */
  var MONITOR = [
    row(26, [0, 'KKKKKKKKKKKKKKKKKKKKKKKKKK']),
    row(26, [0, 'KFFFFFFFFFFFFFFFFFFFFFFFFK']),
    row(26, [0, 'KFWFWFWFWFWFWFWFWFWFWFWFWFWK']),
    row(26, [0, 'KFWFWFWFWFWFWFWFWFWFWFWFWFWK']),
    row(26, [0, 'KFWFWFWFWFWFWFWFWFWFWFWFWFWK']),
    row(26, [0, 'KWWWWWWWWWWWWWWWWWWWWWWWWK']),
    row(26, [0, 'KFFFFFFFFFFFFFFFFFFFFFFFFK']),
    row(26, [0, 'KFFFFFFFFFFFFFFFFFFFFFFFFK']),
    row(26, [0, 'KFFFFFFFFFFFFFFFFFFFFFFFFK']),
    row(26, [0, 'KFFFFFFFFFFFFFFFFFFFFFFFFK']),
    row(26, [0, 'KFFFFFFFFFFFFFFFFFFFFFFFFK']),
    row(26, [0, 'KKKKKKKKKKKKKKKKKKKKKKKKKK']),
    row(26, [10, 'KKKKKK']),
    row(26, [10, 'KKKKKK']),
    row(26, [10, 'KKKKKK']),
    row(26, [10, 'KKKKKK']),
    row(26, [9, 'KKKKKKKK']),
    row(26, [6, 'KKKKKKKKKKKKKK']),
    row(26, [4, 'KKKKKKKKKKKKKKKKKK']),
    row(26, [4, 'KKKKKKKKKKKKKKKKKK'])
  ];

  /* 绿萝（14×17） */
  var PLANT = [
    row(14, [6, 'KK']),
    row(14, [5, 'KGGK']),
    row(14, [4, 'KGGGGK']),
    row(14, [3, 'KGGGGGGK']),
    row(14, [2, 'KGGGGGGGGK']),
    row(14, [3, 'KGGGGGGGK']),
    row(14, [4, 'KGGGGGGK']),
    row(14, [5, 'KGGGGGK']),
    row(14, [4, 'KGGGGGK']),
    row(14, [3, 'KGGGGGK']),
    row(14, [2, 'KGGGGGK']),
    row(14, [3, 'KGGGGGK']),
    row(14, [5, 'KGGGK']),
    row(14, [4, 'KKKKKK']),
    row(14, [3, 'KPPPPPPK']),
    row(14, [2, 'KPPPPPPPPK']),
    row(14, [1, 'KPPPPPPPPPPK'])
  ];

  /* 键盘（26×10） */
  var KEYBOARD = [
    row(26, [0, 'KKKKKKKKKKKKKKKKKKKKKKKKKK']),
    row(26, [0, 'KWWKWWKWWKWWKWWKWWKWWKWWKWK']),
    row(26, [0, 'KWWKWWKWWKWWKWWKWWKWWKWWKWK']),
    row(26, [0, 'KWWWWWWWWWWWKWWWWWWWWWWWK']),
    row(26, [0, 'KWWWWWWWWWWWWWWWWWWWWWWWWK']),
    row(26, [0, 'KWWWWWWWWWWWWWWWWWWWWWWWWK']),
    row(26, [0, 'KWWWWWWWWWWWWWWWWWWWWWWWWK']),
    row(26, [0, 'KWWWWWWWWWWWWWWWWWWWWWWWWK']),
    row(26, [0, 'KKKKKKKKKKKKKKKKKKKKKKKKKK']),
    row(26, [1, 'KKKKKKKKKKKKKKKKKKKKKKKK'])
  ];

  /* 铃铛（12×12） */
  var BELL = [
    row(12, [5, 'KK']),
    row(12, [4, 'KYYK']),
    row(12, [3, 'KYYYYK']),
    row(12, [3, 'KYYYYK']),
    row(12, [2, 'KYYLLYYK']),
    row(12, [2, 'KYYLLYYK']),
    row(12, [1, 'KYYLLLLYYK']),
    row(12, [1, 'KYYLLLLYYK']),
    row(12, [1, 'KYYYKYYKYYK']),
    row(12, [1, 'KYYYYYYYYYYK']),
    row(12, [2, 'KKKKKKKKKK']),
    row(12, [3, 'KDDDDDDK'])
  ];

  /* 小船（22×12） */
  var BOAT = [
    row(22, [9, 'KKKKK']),
    row(22, [8, 'KWWWWWWWK']),
    row(22, [8, 'KWKKKKKWK']),
    row(22, [7, 'KWWWWWWWK']),
    row(22, [7, 'KWKKKKKWK']),
    row(22, [6, 'KWWWWWWWK']),
    row(22, [5, 'KWKKKKKWK']),
    row(22, [4, 'KWWWWWWWK']),
    row(22, [2, 'KRRRRRRRRRRRRRRRRRRK']),
    row(22, [1, 'KRLLRRRRRRRRRRRRRRRLK']),
    row(22, [0, 'KRLLLRRRRRRRRRRRRRRLLK']),
    row(22, [0, 'KKKKKKKKKKKKKKKKKKKKKK'])
  ];

  /* 任务文件（12×15，角上折了一下） */
  var PAPER = [
    row(12, [0, 'KKKKKKKKKKKK']),
    row(12, [0, 'KWLLLLLLLWLK']),
    row(12, [0, 'KWLLLLLLLWWK']),
    row(12, [0, 'KWLLLLLLLLWK']),
    row(12, [0, 'KWLLLLLLLLWK']),
    row(12, [0, 'KWLLLLLLLLWK']),
    row(12, [0, 'KWLLLLLLLLWK']),
    row(12, [0, 'KWLLLLLLLLWK']),
    row(12, [0, 'KWLLLLLLLLWK']),
    row(12, [0, 'KWLLLLLLLLWK']),
    row(12, [0, 'KWLLLLLLLLWK']),
    row(12, [0, 'KWLLLLLLLLWK']),
    row(12, [0, 'KWLLLLLLLLWK']),
    row(12, [0, 'KWLLLLLLLLWK']),
    row(12, [0, 'KKKKKKKKKKKK'])
  ];

  /* ------------------------------------------------------------
   * 渲染：字符画 → 像素
   * ------------------------------------------------------------ */
  function sprite(ctx, rows, x, y, map, scale, flip) {
    scale = scale || 1;
    x = x | 0; y = y | 0;
    for (var r = 0; r < rows.length; r++) {
      var rowStr = rows[r];
      for (var c = 0; c < rowStr.length; c++) {
        var ch = rowStr.charAt(c);
        if (ch === '.' || ch === ' ') continue;
        var col = map && map[ch];
        if (!col) continue;
        var dx = flip ? (rowStr.length - 1 - c) : c;
        ctx.fillStyle = col;
        ctx.fillRect((x + dx * scale) | 0, (y + r * scale) | 0, scale, scale);
      }
    }
  }

  /* 精灵尺寸（方便游戏按尺寸摆放） */
  function sizeOf(rows) {
    var w = 0;
    for (var i = 0; i < rows.length; i++) if (rows[i].length > w) w = rows[i].length;
    return { w: w, h: rows.length };
  }

  /* ------------------------------------------------------------
   * 场景零件：全部用几何图元画，比字符画更容易做层次
   * ------------------------------------------------------------ */

  function disc(ctx, cx, cy, r, c) {
    ctx.fillStyle = c;
    for (var y = -r; y <= r; y++) {
      var dx = Math.floor(Math.sqrt(r * r - y * y));
      ctx.fillRect(cx - dx, cy + y, dx * 2 + 1, 1);
    }
  }

  function ellipseF(ctx, cx, cy, rx, ry, c) {
    ctx.fillStyle = c;
    for (var y = -ry; y <= ry; y++) {
      var t = 1 - (y * y) / (ry * ry);
      if (t < 0) continue;
      var dx = Math.floor(rx * Math.sqrt(t));
      ctx.fillRect(cx - dx, cy + y, dx * 2 + 1, 1);
    }
  }

  function rectF(ctx, x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
  }

  function vlineF(ctx, x, y, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(x | 0, y | 0, 1, h | 0);
  }

  function hlineF(ctx, x, y, w, c) {
    ctx.fillStyle = c;
    ctx.fillRect(x | 0, y | 0, w | 0, 1);
  }

  /* 窗户：天空 + 云 + 太阳 + 木框 + 窗台 */
  function drawWindow(ctx, x, y, w, h, t) {
    var P = PAL;
    rectF(ctx, x - 3, y - 3, w + 6, h + 6, P.brownD);
    rectF(ctx, x - 1, y - 1, w + 2, h + 2, P.brownL);
    for (var i = 0; i < h; i++) {
      var k = i / Math.max(1, h - 1);
      rectF(ctx, x, y + i, w, 1, k < 0.55 ? P.skyL : (k < 0.85 ? P.sky : P.skyD));
    }
    var drift = ((t * 5) % (w + 60)) - 30;
    cloud(ctx, x + 10 + drift, y + 14, 9, P.white);
    cloud(ctx, x + 34 + drift * 0.6, y + 32, 7, P.white);
    cloud(ctx, x - 2 + drift * 0.35, y + 46, 8, P.white);
    disc(ctx, x + w - 14, y + 12, 7, P.butter);
    disc(ctx, x + w - 14, y + 12, 5, P.butterL);
    rectF(ctx, x + (w >> 1) - 1, y, 3, h, P.brownL);
    rectF(ctx, x, y + (h >> 1) - 1, w, 3, P.brownL);
    rectF(ctx, x - 6, y + h + 3, w + 12, 4, P.brown);
    rectF(ctx, x - 6, y + h + 3, w + 12, 1, P.brownL);
    rectF(ctx, x - 6, y + h + 6, w + 12, 2, P.brownD);
  }

  function cloud(ctx, cx, cy, r, c) {
    ellipseF(ctx, cx, cy, r, r * 0.62, c);
    ellipseF(ctx, cx - r * 0.7, cy + 1, r * 0.55, r * 0.4, c);
    ellipseF(ctx, cx + r * 0.7, cy + 1, r * 0.55, r * 0.4, c);
  }

  /* 挂钟：指针真的在走 */
  function drawClock(ctx, cx, cy, r, t) {
    var P = PAL;
    disc(ctx, cx, cy, r + 2, P.brownD);
    disc(ctx, cx, cy, r + 1, P.brownL);
    disc(ctx, cx, cy, r, P.white);
    disc(ctx, cx, cy, r - 1, P.paper);
    for (var i = 0; i < 12; i++) {
      var a = i * Math.PI / 6;
      var rr = r - 3;
      rectF(ctx, Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), 2, 2, P.inkSoft);
    }
    var ha = (t / 6) % (Math.PI * 2) - Math.PI / 2;
    var ma = (t / 1.5) % (Math.PI * 2) - Math.PI / 2;
    clockHand(ctx, cx, cy, ha, r * 0.5, P.ink, 2);
    clockHand(ctx, cx, cy, ma, r * 0.72, P.coralD, 1);
    rectF(ctx, cx - 1, cy - 1, 3, 3, P.ink);
  }

  function clockHand(ctx, cx, cy, a, len, c, w) {
    ctx.fillStyle = c;
    var dx = Math.cos(a), dy = Math.sin(a);
    for (var i = 0; i < len; i++) {
      ctx.fillRect(Math.round(cx + dx * i), Math.round(cy + dy * i), w, w);
    }
  }

  /* 海报：山与太阳 */
  function drawPoster(ctx, x, y, w, h) {
    var P = PAL;
    rectF(ctx, x - 2, y - 2, w + 4, h + 4, P.paper3);
    rectF(ctx, x, y, w, h, P.skyL);
    rectF(ctx, x, y, w, (h * 0.55) | 0, P.sky);
    disc(ctx, x + w - 12, y + 10, 6, P.butter);
    mountain(ctx, x + 4, y + h, w * 0.5, h * 0.6, P.tealD);
    mountain(ctx, x + w * 0.55, y + h, w * 0.55, h * 0.75, P.teal);
    rectF(ctx, x, y + h - 3, w, 3, P.mint);
  }

  function mountain(ctx, bx, by, w, h, c) {
    ctx.fillStyle = c;
    for (var y = 0; y < h; y++) {
      var half = (w / 2) * (1 - y / h);
      ctx.fillRect(Math.round(bx + w / 2 - half), Math.round(by - y), Math.round(half * 2), 1);
    }
  }

  /* 便利贴板：4 张彩色便签 */
  function drawNotes(ctx, x, y, w, h) {
    var P = PAL;
    rectF(ctx, x, y, w, h, P.brown);
    rectF(ctx, x + 1, y + 1, w - 2, h - 2, P.brownL);
    var cols = [P.butterL, P.mintL, P.roseL, P.skyL];
    var nw = Math.floor((w - 12) / 2), nh = Math.floor((h - 10) / 2);
    for (var i = 0; i < 4; i++) {
      var nx = x + 4 + (i % 2) * (nw + 4);
      var ny = y + 4 + ((i / 2) | 0) * (nh + 2);
      rectF(ctx, nx, ny, nw, nh, cols[i]);
      rectF(ctx, nx, ny, nw, 1, P.white);
      hlineF(ctx, nx + 2, ny + 4, nw - 5, PAL.grayD);
      hlineF(ctx, nx + 2, ny + 7, nw - 8, PAL.grayD);
    }
  }

  /* 置物架：木板 + 书 + 小盆栽 */
  function drawShelf(ctx, x, y, w) {
    var P = PAL;
    var books = [P.coral, P.butter, P.mint, P.lilac, P.sky];
    var bx = x + 4;
    for (var i = 0; i < books.length; i++) {
      var bw = 6 + (i % 2) * 2;
      var bh = 14 + ((i * 5) % 7);
      rectF(ctx, bx, y - bh, bw, bh, books[i]);
      rectF(ctx, bx, y - bh, bw, 2, PAL.white);
      rectF(ctx, bx + bw - 2, y - bh, 2, bh, PAL.ink);
      bx += bw + 2;
    }
    rectF(ctx, bx + 4, y - 8, 10, 8, P.coral);
    rectF(ctx, bx + 4, y - 10, 10, 3, P.coralD);
    ellipseF(ctx, bx + 9, y - 14, 6, 5, P.mint);
    ellipseF(ctx, bx + 5, y - 11, 4, 3, P.mintD);
    rectF(ctx, x, y, w, 4, P.brown);
    rectF(ctx, x, y, w, 1, P.brownL);
    rectF(ctx, x, y + 3, w, 1, P.brownD);
  }

  /* 桌上的小物件：键盘 + 咖啡杯 */
  function drawDeskProps(ctx, x, y) {
    sprite(ctx, KEYBOARD, x, y, MAP.keyboard, 1);
    sprite(ctx, CUP, x + 32, y - 4, MAP.cup, 1);
  }

  /* ------------------------------------------------------------
   * 主场景：办公室
   *   opt = { topbar, wallH, window, clock, poster, notes, shelf,
   *           floor(地板) / desk(大桌面), deskTop, props, plant }
   * ------------------------------------------------------------ */
  function drawDesk(ctx, W, H, t, opt) {
    opt = opt || {};
    var P = PAL;
    var top = opt.topbar ? 18 : 0;
    var wallH = opt.wallH || 150;
    var floorY = top + wallH;

    /* ---- 墙面：渐变 + 壁纸暗纹 ---- */
    for (var i = 0; i < wallH; i++) {
      var k = i / Math.max(1, wallH - 1);
      rectF(ctx, 0, top + i, W, 1, k < 0.45 ? P.paper : (k < 0.8 ? P.cream : P.paper2));
    }
    if (opt.wallpaper !== false) {
      for (var wx = 6; wx < W; wx += 18) {
        for (var wy = top + 3; wy < floorY - 8; wy += 3) {
          rectF(ctx, wx, wy, 1, 1, P.paper2);
        }
      }
    }
    /* ---- 踢脚线 ---- */
    rectF(ctx, 0, floorY - 7, W, 7, P.paper3);
    hlineF(ctx, 0, floorY - 7, W, P.paper2);
    hlineF(ctx, 0, floorY - 1, W, P.paper2);

    /* ---- 地面 / 桌面 ---- */
    if (opt.floor) {
      for (var fy = floorY; fy < H; fy++) {
        var fk = (fy - floorY) / Math.max(1, H - floorY);
        rectF(ctx, 0, fy, W, 1, fk < 0.5 ? P.paper2 : P.paper3);
      }
      for (var tx = 0; tx <= W; tx += 40) vlineF(ctx, tx, floorY, H - floorY, P.paper2);
      for (var ty = floorY; ty < H; ty += 16) hlineF(ctx, 0, ty, W, P.paper2);
    } else {
      var deskTop = opt.deskTop === undefined ? floorY : opt.deskTop;
      for (var dy = deskTop; dy < H; dy++) {
        var dk = (dy - deskTop) / Math.max(1, H - deskTop);
        rectF(ctx, 0, dy, W, 1, dk < 0.35 ? P.brownL : (dk < 0.8 ? P.brown : P.brownD));
      }
      hlineF(ctx, 0, deskTop, W, P.paper3);
      hlineF(ctx, 0, deskTop + 1, W, P.brownL);
      for (var gx = 0; gx < W; gx += 3) {
        var gy = deskTop + 8 + ((gx * 7) % Math.max(1, (H - deskTop - 12)));
        rectF(ctx, gx, gy, 2, 1, P.brownD);
      }
      for (var g2 = 0; g2 < W; g2 += 5) {
        var gy2 = deskTop + 22 + ((g2 * 13) % Math.max(1, (H - deskTop - 26)));
        rectF(ctx, g2, gy2, 3, 1, P.brownD);
      }
    }

    /* ---- 墙上的东西 ---- */
    if (opt.window) drawWindow(ctx, 14, top + 22, 84, 62, t);
    if (opt.clock) drawClock(ctx, W - 42, top + 40, 18, t);
    if (opt.poster) drawPoster(ctx, opt.posterX === undefined ? W - 108 : opt.posterX, opt.posterY === undefined ? top + 76 : opt.posterY, 46, 36);
    if (opt.notes) drawNotes(ctx, opt.notesX === undefined ? 120 : opt.notesX, opt.notesY === undefined ? top + 34 : opt.notesY, 52, 40);
    if (opt.shelf) drawShelf(ctx, opt.shelfX === undefined ? W - 140 : opt.shelfX, opt.shelfY === undefined ? top + 116 : opt.shelfY, 100);
    if (opt.props) drawDeskProps(ctx, 20, H - 28);
    if (opt.plant) sprite(ctx, PLANT, W - 26, H - 20, MAP.plant, 1);
  }

  /* 空气中的灰尘（老办公室的氛围） */
  function drawDust(ctx, W, H, t, color) {
    ctx.fillStyle = color;
    for (var i = 0; i < 22; i++) {
      var seed = i * 97.3;
      var x = (seed * 3.1) % W;
      var y = 30 + ((seed * 1.7 + t * (6 + (i % 4) * 3)) % Math.max(1, H - 60));
      ctx.globalAlpha = 0.22 + (i % 3) * 0.18;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------
   * 导出
   * ------------------------------------------------------------ */
  var SPR = {
    MAP: MAP,
    sprite: sprite,
    sizeOf: sizeOf,
    drawDesk: drawDesk,
    drawDust: drawDust,
    drawWindow: drawWindow,
    drawClock: drawClock,
    drawPoster: drawPoster,
    drawNotes: drawNotes,
    drawShelf: drawShelf,
    disc: disc,
    ellipseF: ellipseF,

    WORKER: WORKER,
    CAT: CAT,
    BOSS_CALM: BOSS_CALM,
    BOSS_SUSPICIOUS: BOSS_SUSPICIOUS,
    BOSS_ANGRY: BOSS_ANGRY,
    CUP: CUP,
    DONUT: DONUT,
    FISH: FISH,
    CACTUS: CACTUS,
    MONITOR: MONITOR,
    PLANT: PLANT,
    KEYBOARD: KEYBOARD,
    BELL: BELL,
    BOAT: BOAT,
    PAPER: PAPER
  };

  global.HS_SPR = SPR;
  if (typeof module !== 'undefined' && module.exports) module.exports = SPR;
})(typeof window !== 'undefined' ? window : this);
