/* ============================================================
 * 打工人急救站 · 摸鱼游戏厅 · 像素素材库
 * ------------------------------------------------------------
 * 所有角色都用「点阵字符串」画，像素美术从代码里长出来：
 *   '.' = 透明，'1'~'5' = 调色板槽位
 * 这样改颜色只要改 map，不用重画图。
 * ============================================================ */
(function (global) {
  'use strict';

  var PAL = global.HS_GAMES ? global.HS_GAMES.PAL : {};

  /* 常用配色表 */
  var MAP = {
    boss: { '1': '#f3c9a6', '2': '#3b3350', '3': '#2b2438', '4': '#fffdf7', '5': '#f0837a' },
    worker: { '1': '#f3c9a6', '2': '#a5714c', '3': '#2b2438', '4': '#8fd3b2' },
    cat: { '1': '#fffdf7', '2': '#f7d774', '3': '#2b2438' },
    cup: { '1': '#fffdf7', '2': '#8c5a3c', '3': '#e9dcc4' },
    donut: { '1': '#f8f0e1', '2': '#c9976c', '3': '#f2a3b8' },
    fish: { '1': '#fffdf7', '2': '#4b87b0', '3': '#f0837a' },
    cactus: { '1': '#f8f0e1', '2': '#4f9c7c', '3': '#a5714c' }
  };

  /* ------------------------------------------------------------
   * 点阵精灵绘制
   * rows: 字符串数组，'.' 透明
   * map:  字符 -> 颜色
   * scale: 放大倍数（默认 1）
   * flip:  水平镜像
   * ------------------------------------------------------------ */
  function sprite(ctx, rows, x, y, map, scale, flip) {
    scale = scale || 1;
    var h = rows.length;
    var w = 0;
    for (var i = 0; i < h; i++) if (rows[i].length > w) w = rows[i].length;
    for (var r = 0; r < h; r++) {
      var row = rows[r];
      for (var c = 0; c < row.length; c++) {
        var ch = row.charAt(c);
        if (ch === '.' || ch === ' ') continue;
        var col = map[ch];
        if (!col) continue;
        var dx = flip ? (w - 1 - c) : c;
        ctx.fillStyle = col;
        ctx.fillRect((x + dx * scale) | 0, (y + r * scale) | 0, scale, scale);
      }
    }
  }

  /* ------------------------------------------------------------
   * 素材
   * ------------------------------------------------------------ */

  /* 老板：十秒王（三种表情） */
  var BOSS_CALM = [
    '..222222..',
    '.21111112.',
    '2111311112',
    '2111411112',
    '2111311112',
    '.21111112.',
    '..2.11.2..',
    '..33..33..',
    '.55....55.'
  ];
  var BOSS_SUSPICIOUS = [
    '..222222..',
    '.21111112.',
    '2131313112',
    '2131413112',
    '2131313112',
    '.21111112.',
    '..2.11.2..',
    '..33..33..',
    '.55....55.'
  ];
  var BOSS_ANGRY = [
    '..222222..',
    '.21111112.',
    '2111311112',
    '2311311132',
    '2111311112',
    '.21111112.',
    '..2.11.2..',
    '..33..33..',
    '.55....55.'
  ];

  /* 员工：你（小小一只） */
  var WORKER = [
    '..2222..',
    '.211112.',
    '21131112',
    '21111112',
    '.211112.',
    '..22.22.',
    '.44..44.',
    '44444444'
  ];

  /* 猫：工位常驻摸鱼王 */
  var CAT = [
    '3......3',
    '33....33',
    '33111133',
    '33133133',
    '33111133',
    '33333333',
    '.222222.',
    '..2..2..'
  ];
  var CAT_SLEEP = [
    '3......3',
    '33....33',
    '33111133',
    '33111133',
    '33111133',
    '33333333',
    '.222222.',
    '..2..2..'
  ];

  /* 咖啡杯 */
  var CUP = [
    '.1111.',
    '.1221.',
    '.1221.',
    '.1221.',
    '.12211',
    '.1111.',
    '..11..'
  ];

  /* 甜甜圈 */
  var DONUT = [
    '.22222.',
    '2333332',
    '2331332',
    '2331332',
    '2333332',
    '2333332',
    '.22222.'
  ];

  /* 小鱼（摸鱼钓鱼的收获） */
  var FISH = [
    '....222..',
    '..2222222',
    '222233322',
    '222222222',
    '222233322',
    '..2222222',
    '....222..'
  ];

  /* 仙人掌 */
  var CACTUS = [
    '..1..',
    '..2..',
    '.222.',
    '22222',
    '22222',
    '22222',
    '33333'
  ];

  /* 显示器 */
  var MONITOR = [
    '333333333333',
    '344444444443',
    '344455544443',
    '344455544443',
    '344444444443',
    '333333333333',
    '....2222....',
    '....3333....'
  ];

  /* 盆栽 */
  var PLANT = [
    '.2..2.',
    '.22222',
    '.2.22.',
    '2222222',
    '..333.'
  ];


  /* ------------------------------------------------------------
   * 场景：工位背景（所有游戏共用）
   * ------------------------------------------------------------ */
  /* opt 说明：
   *   topbar:true  顶部有一条 12px 状态条（深色 HUD），窗和钟整体下移避让
   *   window:false 不画窗（游戏内容会顶到左上角时关掉）
   *   clock:false  不画挂钟
   *   plant:false  不画桌上的仙人掌
   */
  function drawDesk(ctx, W, H, t, opt) {
    opt = opt || {};
    var P = PAL;
    var top = opt.topbar ? 12 : 0;          // 状态条占掉的高度
    // 墙面
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, W, H);
    if (top) {
      // 状态条下沿的压边线
      ctx.fillStyle = P.paper3;
      ctx.fillRect(0, top, W, 1);
    }
    // 地板
    ctx.fillStyle = P.paper2;
    ctx.fillRect(0, H - 22, W, 22);
    ctx.fillStyle = P.paper3;
    for (var i = 0; i < W; i += 8) ctx.fillRect(i, H - 22, 1, 22);
    // 窗户（左边）
    if (opt.window !== false) {
      var wx = 6, wy = 8 + top, ww = 44, wh = 34;
      ctx.fillStyle = P.inkSoft;
      ctx.fillRect(wx - 1, wy - 1, ww + 2, wh + 2);
      ctx.fillStyle = P.sky;
      ctx.fillRect(wx, wy, ww, wh);
      // 云
      var cx = wx + 6 + ((t * 0.01) % (ww - 12));
      ctx.fillStyle = P.white;
      ctx.fillRect(cx | 0, wy + 7, 9, 3);
      ctx.fillRect((cx + 2) | 0, wy + 5, 5, 3);
      // 窗框
      ctx.fillStyle = P.paper3;
      ctx.fillRect(wx + (ww >> 1), wy, 1, wh);
      ctx.fillRect(wx, wy + (wh >> 1), ww, 1);
    }
    // 挂钟
    if (opt.clock !== false) {
      ctx.fillStyle = P.white;
      ctx.fillRect(W - 26, 8 + top, 14, 14);
      ctx.fillStyle = P.ink;
      ctx.fillRect(W - 20, 12 + top, 1, 4);
      ctx.fillRect(W - 20, 15 + top, 4, 1);
    }
    // 墙上的便利贴板（两列工位之间的空档，装饰一下别让墙太空）
    if (opt.board !== false) {      var bx0 = 90, by0 = 15 + top, bw = 24, bh = 13;
      ctx.fillStyle = P.paper2;
      ctx.fillRect(bx0, by0, bw, bh);
      ctx.fillStyle = P.inkSoft;
      ctx.fillRect(bx0, by0, bw, 1);
      ctx.fillRect(bx0, by0 + bh - 1, bw, 1);
      ctx.fillRect(bx0, by0, 1, bh);
      ctx.fillRect(bx0 + bw - 1, by0, 1, bh);
      ctx.fillStyle = P.coralL;
      ctx.fillRect(bx0 + 3, by0 + 3, 6, 4);
      ctx.fillStyle = P.mintL;
      ctx.fillRect(bx0 + 12, by0 + 2, 5, 4);
      ctx.fillStyle = P.butterL;
      ctx.fillRect(bx0 + 17, by0 + 6, 5, 4);
      ctx.fillStyle = P.lilacL;
      ctx.fillRect(bx0 + 5, by0 + 7, 5, 3);
    }
    // 大桌面：九个洞要坐在桌面上才像话（opt.table = 桌面上沿的 y）
    if (opt.table) {
      var ty = (opt.table === true) ? 40 : opt.table;
      ctx.fillStyle = P.paper2;
      ctx.fillRect(0, ty, W, H - 12 - ty);
      ctx.fillStyle = P.paper3;
      for (var gx = 0; gx < W; gx += 34) {           // 木纹：只在桌面中间淡淡几道
        var gy = ty + 14 + ((gx * 7) % 11);
        ctx.fillRect(gx, gy, 1, 10);
      }
      ctx.fillStyle = P.paper3;
      ctx.fillRect(0, ty, W, 1);
    }
    // 桌面
    ctx.fillStyle = P.brown;
    ctx.fillRect(0, H - 12, W, 12);
    ctx.fillStyle = P.brownL;
    ctx.fillRect(0, H - 12, W, 2);
    ctx.fillStyle = P.brownD;
    ctx.fillRect(0, H - 3, W, 3);
    if (opt.plant !== false) {
      sprite(ctx, PLANT, W - 20, H - 12 - 16, MAP.cactus, 2);
    }
  }

  /* 顶部飘落的纸屑/咖啡渣氛围 */
  function drawDust(ctx, W, H, t, color) {
    ctx.fillStyle = color || PAL.paper3;
    for (var i = 0; i < 14; i++) {
      var x = (i * 37 + Math.sin(t * 0.5 + i) * 6) % W;
      var y = (i * 23 + t * 4) % H;
      ctx.fillRect(x | 0, y | 0, 1, 1);
    }
  }

  /* ------------------------------------------------------------
   * 对外
   * ------------------------------------------------------------ */
  var SPR = {
    sprite: sprite,
    MAP: MAP,
    BOSS_CALM: BOSS_CALM,
    BOSS_SUSPICIOUS: BOSS_SUSPICIOUS,
    BOSS_ANGRY: BOSS_ANGRY,
    WORKER: WORKER,
    CAT: CAT,
    CAT_SLEEP: CAT_SLEEP,
    CUP: CUP,
    DONUT: DONUT,
    FISH: FISH,
    CACTUS: CACTUS,
    MONITOR: MONITOR,
    PLANT: PLANT,
    drawDesk: drawDesk,
    drawDust: drawDust
  };

  global.HS_SPR = SPR;
  if (typeof module !== 'undefined' && module.exports) module.exports = SPR;
})(typeof window !== 'undefined' ? window : this);
