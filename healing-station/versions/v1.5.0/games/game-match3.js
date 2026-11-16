/* ============================================================
 * 打工人急救站 · 摸鱼游戏厅 · 《工位三消》 v2
 * ------------------------------------------------------------
 * 主题：趁老板进会议室，偷偷把工位桌面上的小物件三连消除。
 *
 * v1 是 160×144 的小格子，v2 把画布翻倍到 320×288：
 *   · 棋盘从 7×7 变成 7×6，格子 16px → 34px，物件整体放大重画；
 *   · 场景换成「一张木桌 + 一个木框托盘」的实景：
 *     木纹桌面、倒角木框、内凹绒面棋盘、格线、落地投影；
 *   · 顶部状态条（内核统一画 SCORE / TIME）+ 下面的 STEPS / CHAIN 信息条；
 *   · 桌面小物：便利贴、订书机、偷看的小猫、咖啡杯；
 *   · 消除时的白色闪光、连锁飘带横幅、飘分、选中高亮、闲置呼吸动画。
 *
 * 玩法完全没变：
 *   点一个物件 → 再点上下左右相邻的物件交换；连成 3 个以上就消除；
 *   得分 = 消除格数 × 10 × 连锁倍率；30 步用完或 90 秒到就收工；
 *   棋盘走不动时自动洗牌；方向键移动光标，Enter/空格选中交换，S 洗牌。
 *
 * 文字规则：画布上只画大写 ASCII（像素字体只认 A-Z 0-9 和少量符号），
 * 所有中文提示都通过 api.state({ message: '...' }) 交给 HTML 层显示。
 * ============================================================ */
(function (global) {
  'use strict';

  var G = global;
  if (!G.HS_GAMES) return;              // 内核没加载就不注册，省得报错
  var PAL = G.HS_GAMES.PAL;
  var SPR = G.HS_SPR || {};              // 素材库可能没加载，兜底成空对象

  /* ---------------- 画布与棋盘参数 ---------------- */
  var W = 320, H = 288;
  var TOPBAR = 18;                      // 顶部状态条高度（内核绘制，别占用）
  var COLS = 7;                         // 7 列
  var ROWS = 6;                         // 6 行
  var CELL = 34;                        // 每格 34px
  var BX = 41, BY = 58;                 // 棋盘左上角（棋盘 238×204，止于 279 / 262）
  var BOARD_W = COLS * CELL;            // 238
  var BOARD_H = ROWS * CELL;            // 204
  var FRAME = 4;                        // 木框厚度
  var FX = BX - FRAME, FY = BY - FRAME; // 37 / 54
  var FW = BOARD_W + FRAME * 2;         // 246
  var FH = BOARD_H + FRAME * 2;         // 212（底边 266）
  var EDGE_Y = 268;                     // 桌沿上沿（下面是深色前沿 + 提示）
  var CHIP_Y = 20, CHIP_H = 28, CHIP_W = 116;
  var CHIP_X = [BX, BX + CHIP_W + 6];   // 41 / 163，两张信息卡正好对齐棋盘

  var MAX_STEPS = 30;                   // 步数上限
  var TIME_LIMIT = 90;                  // 一局 90 秒（硬时限，什么都不点也会结束）
  var TYPE_CNT = 6;                     // 6 种小物件
  var T_CLEAR = 0.22;                   // 消除爆开时长
  var T_FALL = 0.26;                    // 下落补位时长
  var T_REJECT = 0.26;                  // 交换失败弹回时长
  var NUDGE = 8;                        // 交换失败时两块互相顶开的像素
  var MAX_CHAIN = 20;                   // 连锁上限，防止极端情况死循环

  /* ---------------- 配色（场景用色） ---------------- */
  var DESK_L = '#f2e7d2';               // 木纹高光
  var DESK_D = '#c9b28d';               // 木纹暗线
  var DESK_EDGE = '#b9a077';            // 桌后沿
  var BOARD_A = '#2c3a5a';              // 棋盘格（浅）
  var BOARD_B = '#26324a';              // 棋盘格（深）
  var BOARD_LINE = '#1e2840';           // 格线
  var SHADOW = '#141a2b';               // 物件投影

  /* ------------------------------------------------------------
   * 拼行工具：row(宽, [起点, 内容], ...)
   * 保证每一行都是同一个宽度，手写点阵也不会画歪。
   * ------------------------------------------------------------ */
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

  /* 重复字符 n 次（比手数 10 个 P 靠谱） */
  function rep(ch, n) {
    var s = '';
    for (var i = 0; i < n; i++) s += ch;
    return s;
  }

  /* ------------------------------------------------------------
   * 本地新增的小素材（不写进 sprites.js，免得和别人打架）
   * ------------------------------------------------------------ */

  /* 便利贴：两张叠在一起的便签（26×18） */
  var STICKY = [
    row(26),
    row(26, [12, 'K' + rep('P', 10) + 'K']),
    row(26, [12, 'K' + rep('P', 10) + 'K']),
    row(26, [12, 'KPN' + rep('N', 8) + 'K']),
    row(26, [12, 'K' + rep('P', 10) + 'K']),
    row(26, [12, 'KPN' + rep('N', 6) + 'PPK']),
    row(26, [12, 'K' + rep('P', 10) + 'K']),
    row(26, [12, 'K' + rep('P', 10) + 'K']),
    row(26, [12, rep('K', 12)]),
    row(26, [2, rep('K', 12)]),
    row(26, [2, 'K' + rep('Y', 10) + 'K']),
    row(26, [2, 'KY' + rep('D', 8) + 'YK']),
    row(26, [2, 'KY' + rep('L', 8) + 'YK']),
    row(26, [2, 'KY' + rep('D', 7) + 'YYK']),
    row(26, [2, 'K' + rep('Y', 10) + 'K']),
    row(26, [2, 'KY' + rep('L', 8) + 'YK']),
    row(26, [2, 'KY' + rep('D', 7) + 'YYK']),
    row(26, [2, 'K' + rep('Y', 10) + 'K']),
    row(26, [2, rep('K', 12)])
  ];

  /* 订书机（18×12） */
  var STAPLER = [
    row(18),
    row(18, [5, 'K' + rep('R', 3) + 'K']),
    row(18, [4, 'K' + rep('R', 6) + 'K']),
    row(18, [3, 'K' + rep('R', 7) + 'K']),
    row(18, [3, 'K' + rep('R', 7) + 'K']),
    row(18, [3, 'K' + rep('R', 6) + 'EK']),
    row(18, [4, 'K' + rep('R', 6) + 'K']),
    row(18, [5, 'K' + rep('R', 3) + 'K']),
    row(18, [2, rep('K', 14)]),
    row(18, [2, 'K' + rep('S', 12) + 'K']),
    row(18, [2, rep('K', 14)]),
    row(18, [4, rep('K', 12)])
  ];

  /* 鼠标（12×14） */
  var MOUSE = [
    row(12),
    row(12, [2, rep('K', 8)]),
    row(12, [1, 'K' + rep('W', 8) + 'K']),
    row(12, [1, 'K' + rep('W', 8) + 'K']),
    row(12, [1, 'K' + rep('W', 4) + 'R' + rep('W', 3) + 'K']),
    row(12, [1, 'K' + rep('W', 4) + 'R' + rep('W', 3) + 'K']),
    row(12, [1, 'K' + rep('G', 8) + 'K']),
    row(12, [1, 'K' + rep('G', 8) + 'K']),
    row(12, [1, 'K' + rep('D', 8) + 'K']),
    row(12, [1, 'K' + rep('D', 8) + 'K']),
    row(12, [2, rep('K', 8)]),
    row(12),
    row(12),
    row(12)
  ];

  /* 铅笔（22×8，横着放） */
  var PENCIL = [
    row(22, [0, 'K' + 'WW' + rep('Y', 15) + 'K' + 'PP' + 'K']),
    row(22, [0, 'K' + 'WW' + rep('L', 15) + 'K' + 'PP' + 'K']),
    row(22, [0, 'K' + 'WW' + rep('Y', 15) + 'K' + 'PP' + 'K']),
    row(22, [0, 'K' + 'WW' + rep('Y', 15) + 'K' + 'PP' + 'K']),
    row(22, [0, 'K' + 'WW' + rep('D', 15) + 'K' + 'PP' + 'K']),
    row(22, [0, 'K' + 'WW' + rep('D', 15) + 'K' + 'PP' + 'K']),
    row(22, [0, rep('K', 22)]),
    row(22, [0, rep('K', 22)])
  ];

  var LOCAL_MAP = {
    sticky: { K: PAL.ink, Y: PAL.butter, L: PAL.butterL, D: PAL.butterD, P: PAL.rose, N: PAL.roseD },
    stapler: { K: PAL.ink, R: PAL.red, E: PAL.redD, S: PAL.steelL },
    mouse: { K: PAL.ink, W: PAL.paper, G: PAL.gray, D: PAL.grayD, R: PAL.red },
    pencil: { K: PAL.ink, W: PAL.paper3, Y: PAL.butter, L: PAL.butterL, D: PAL.butterD, P: PAL.rose }
  };

  /* ------------------------------------------------------------
   * 6 种工位小物件：共享素材库里的点阵 + 配色
   * ------------------------------------------------------------ */
  var TILES = [];

  function buildTiles() {
    var M = SPR.MAP || {};
    TILES = [
      { key: 'donut', rows: SPR.DONUT, map: M.donut, sc: 2, back: PAL.rose, backD: PAL.roseD },
      { key: 'cup', rows: SPR.CUP, map: M.cup, sc: 2, back: PAL.coral, backD: PAL.coralD },
      { key: 'fish', rows: SPR.FISH, map: M.fish, sc: 2, back: PAL.sky, backD: PAL.skyD },
      { key: 'cactus', rows: SPR.CACTUS, map: M.cactus, sc: 2, back: PAL.mint, backD: PAL.mintD },
      { key: 'plant', rows: SPR.PLANT, map: M.plant, sc: 2, back: PAL.teal, backD: PAL.tealD },
      { key: 'monitor', rows: SPR.MONITOR, map: M.monitor, sc: 1, back: PAL.lilac, backD: PAL.lilacD }
    ];
    for (var i = 0; i < TILES.length; i++) {
      var t = TILES[i];
      var w = 0, h = 0;
      if (t.rows) {
        h = t.rows.length;
        for (var j = 0; j < t.rows.length; j++) if (t.rows[j].length > w) w = t.rows[j].length;
      }
      t.w = w ? w * t.sc : 24;
      t.h = h ? h * t.sc : 24;
    }
  }

  /* ------------------------------------------------------------
   * 小工具
   * ------------------------------------------------------------ */

  /* 画一片点阵，但整片只用一种颜色（用来做剪影投影） */
  function drawFlat(ctx, rows, x, y, scale, color) {
    for (var r = 0; r < rows.length; r++) {
      var s = rows[r];
      for (var c = 0; c < s.length; c++) {
        var ch = s.charAt(c);
        if (ch === '.' || ch === ' ') continue;
        ctx.fillStyle = color;
        ctx.fillRect((x + c * scale) | 0, (y + r * scale) | 0, scale, scale);
      }
    }
  }

  /* 四个角的 L 形角标（键盘光标 / 选中提示） */
  function cornerMarks(ctx, x, y, w, h, c, len, th) {
    th = th || 2;
    len = len || 8;
    ctx.fillStyle = c;
    ctx.fillRect(x, y, len, th);
    ctx.fillRect(x, y, th, len);
    ctx.fillRect(x + w - len, y, len, th);
    ctx.fillRect(x + w - th, y, th, len);
    ctx.fillRect(x, y + h - th, len, th);
    ctx.fillRect(x, y + h - len, th, len);
    ctx.fillRect(x + w - len, y + h - th, len, th);
    ctx.fillRect(x + w - th, y + h - len, th, len);
  }

  /* ---------------- 游戏主体 ---------------- */
  function createGame(api) {
    buildTiles();

    var grid = [];        // grid[r][c] = 物件类型
    var offX = [];        // 动画横向偏移
    var offY = [];        // 动画纵向偏移
    var mark = [];        // 本轮要爆开的格子
    var pops = [];        // 飘字（+分数）
    var sel = null;       // 鼠标/键盘选中的格子
    var cur = { r: 2, c: 3 };  // 键盘光标
    var phase = 'idle';   // idle / clear / fall / reject
    var timer = 0;
    var chain = 1;        // 连锁倍率
    var steps = MAX_STEPS;
    var timeLeft = TIME_LIMIT;
    var score = 0;
    var best = readBest();
    var rej = null;       // 弹回动画
    var dead = false;
    var banner = null;    // { text, t, life, c } 横幅（连锁 / 提示）
    var chainPulse = 0;   // 连锁数字的脉冲
    var msgCn = '';       // 给 HTML 层的汉字提示

    for (var r0 = 0; r0 < ROWS; r0++) {
      grid[r0] = []; offX[r0] = []; offY[r0] = []; mark[r0] = [];
      for (var c0 = 0; c0 < COLS; c0++) {
        grid[r0][c0] = 0; offX[r0][c0] = 0; offY[r0][c0] = 0; mark[r0][c0] = 0;
      }
    }
    fillBoard();

    function readBest() {
      try {
        if (G.HS_GAMES && G.HS_GAMES.best) return G.HS_GAMES.best('match3') || 0;
      } catch (e) { /* 没有存档就当 0 分 */ }
      return 0;
    }

    /* 把状态推给 HTML 层（中文提示也走这里） */
    function syncState() {
      api.state({
        score: score,
        best: best,
        steps: steps,
        chain: chain,
        phase: phase,
        time: Math.ceil(timeLeft),
        message: msgCn
      });
    }

    /* 画布横幅 + 中文提示一起发 */
    function say(text, cn, dur, color) {
      msgCn = cn || '';
      banner = { text: text, t: 0, life: dur || 1.4, c: color || PAL.coral };
      syncState();
    }

    /* ---------- 棋盘算法 ---------- */

    /* 填一格：挑一个不会立刻凑成三连的类型，保证开局没有自动消除 */
    function pickSafeType(r, c) {
      var banned = {};
      if (c >= 2 && grid[r][c - 1] === grid[r][c - 2]) banned[grid[r][c - 1]] = 1;
      if (r >= 2 && grid[r - 1][c] === grid[r - 2][c]) banned[grid[r - 1][c]] = 1;
      var opts = [];
      for (var i = 0; i < TYPE_CNT; i++) if (!banned[i]) opts.push(i);
      if (!opts.length) return api.randInt(0, TYPE_CNT - 1);
      return api.pick(opts);
    }

    function fillBoard() {
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) grid[r][c] = pickSafeType(r, c);
      }
    }

    /* 找出所有三连（横竖都算，四连五连也一起算） */
    function findMatches() {
      var out = [], r, c, k;
      for (r = 0; r < ROWS; r++) {
        var run = 1;
        for (c = 1; c <= COLS; c++) {
          if (c < COLS && grid[r][c] === grid[r][c - 1]) { run++; continue; }
          if (run >= 3) for (k = c - run; k < c; k++) out.push({ r: r, c: k });
          run = 1;
        }
      }
      for (c = 0; c < COLS; c++) {
        var run2 = 1;
        for (r = 1; r <= ROWS; r++) {
          if (r < ROWS && grid[r][c] === grid[r - 1][c]) { run2++; continue; }
          if (run2 >= 3) for (k = r - run2; k < r; k++) out.push({ r: k, c: c });
          run2 = 1;
        }
      }
      return out;
    }

    /* 试交换：能消除就返回 true（会把数据换回来） */
    function trySwap(r1, c1, r2, c2) {
      var t = grid[r1][c1]; grid[r1][c1] = grid[r2][c2]; grid[r2][c2] = t;
      var ok = findMatches().length > 0;
      var t2 = grid[r1][c1]; grid[r1][c1] = grid[r2][c2]; grid[r2][c2] = t2;
      return ok;
    }

    /* 棋盘上还有没有能消除的一步 */
    function hasMove() {
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          if (c + 1 < COLS && trySwap(r, c, r, c + 1)) return true;
          if (r + 1 < ROWS && trySwap(r, c, r + 1, c)) return true;
        }
      }
      return false;
    }

    /* 洗牌：打乱后保证既没有现成三连，也至少还有一步能走 */
    function shuffleBoard() {
      for (var attempt = 0; attempt < 40; attempt++) {
        var flat = [];
        for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) flat.push(grid[r][c]);
        api.shuffle(flat);
        var i = 0;
        for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) grid[r][c] = flat[i++];
        var ms = findMatches();
        for (var k = 0; k < ms.length; k++) grid[ms[k].r][ms[k].c] = api.randInt(0, TYPE_CNT - 1);
        if (!findMatches().length && hasMove()) return true;
      }
      return false;
    }

    function swapTypes(r1, c1, r2, c2) {
      var t = grid[r1][c1]; grid[r1][c1] = grid[r2][c2]; grid[r2][c2] = t;
    }

    /* ---------- 交换与结算 ---------- */

    function doSwap(r1, c1, r2, c2) {
      if (phase !== 'idle' || dead) return false;
      if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return false;
      swapTypes(r1, c1, r2, c2);
      var ms = findMatches();
      if (!ms.length) {
        /* 消不了：换回去，两块互相顶一下再弹回来 */
        swapTypes(r1, c1, r2, c2);
        rej = { ar: r1, ac: c1, br: r2, bc: c2, dr: r2 - r1, dc: c2 - c1 };
        phase = 'reject'; timer = 0;
        api.sfx('miss');
        say('NO MATCH', '这一步没得换，换个思路', 1.2, PAL.coralD);
        return false;
      }
      /* 消得了：扣一步，开始消除 */
      steps--;
      chain = 1;
      startClear(ms);
      return true;
    }

    /* 开始一轮消除：加分、撒粒子、进 clear 阶段 */
    function startClear(ms) {
      var seen = {}, list = [];
      for (var i = 0; i < ms.length; i++) {
        var key = ms[i].r + ',' + ms[i].c;
        if (seen[key]) continue;
        seen[key] = 1;
        list.push(ms[i]);
        mark[ms[i].r][ms[i].c] = 1;
      }
      var pts = Math.round(list.length * 10 * chain);   // 格数 × 10 × 连锁（一定是整数）
      score = api.addScore(pts);
      api.sfx('pop');
      api.kick(Math.min(7, 2 + list.length * 0.7));
      /* 粒子按格撒，但飘分只飘一个（取被消格子的中心），免得几个 +90 叠在一起看不清 */
      var sx = 0, sy = 0;
      for (var k = 0; k < list.length; k++) {
        var m = list[k];
        var def = TILES[grid[m.r][m.c]] || TILES[0];
        var cx = BX + m.c * CELL + (CELL >> 1);
        var cy = BY + m.r * CELL + (CELL >> 1);
        api.puff(cx, cy, def.backD, 6);
        sx += cx; sy += cy;
      }
      sx = sx / list.length; sy = sy / list.length;
      pops.push({
        x: Math.round(sx - api.textWidth('+' + pts, 2) / 2),
        y: Math.max(BY + 3, Math.round(sy - 20)),
        text: '+' + pts,
        t: 0,
        c: PAL.butter
      });
      if (chain >= 2) {
        chainPulse = 0.8;
        say('CHAIN X' + chain, '连击 ×' + chain, 1.3, PAL.butterD);
        api.sfx('coin');
      }
      phase = 'clear'; timer = 0;
      syncState();
    }

    /* 消除结束：清空 + 重力下落 + 顶部补新块 */
    function resolveClear() {
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          if (!mark[r][c]) continue;
          grid[r][c] = -1;
          mark[r][c] = 0;
        }
      }
      applyGravity();
      phase = 'fall';
      timer = 0;
    }

    /* 重力：下面的往上补，空出来的顶部塞新块，新块从画面上方掉进来 */
    function applyGravity() {
      for (var c = 0; c < COLS; c++) {
        var write = ROWS - 1;
        for (var r = ROWS - 1; r >= 0; r--) {
          if (grid[r][c] < 0) continue;
          if (write !== r) {
            grid[write][c] = grid[r][c];
            grid[r][c] = -1;
            offY[write][c] = (r - write) * CELL;
            offX[write][c] = 0;
          }
          write--;
        }
        var empty = write + 1;
        for (var r2 = 0; r2 <= write; r2++) {
          grid[r2][c] = api.randInt(0, TYPE_CNT - 1);
          offY[r2][c] = (r2 - empty) * CELL;
          offX[r2][c] = 0;
        }
      }
    }

    /* 落定：看看有没有新的三连，没有就看看还有没有下一步可走 */
    function settle() {
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) { offX[r][c] = 0; offY[r][c] = 0; }
      }
      if (chain >= MAX_CHAIN) {
        chain = 1;
        shuffleBoard();
        phase = 'idle';
        say('AUTO SHUFFLE', '洗牌！', 1.8, PAL.skyD);
        api.sfx('whoosh');
        return;
      }
      var ms = findMatches();
      if (ms.length) {
        chain++;
        startClear(ms);
        return;
      }
      phase = 'idle';
      chain = 1;
      if (!hasMove()) {
        shuffleBoard();
        api.sfx('whoosh');
        say('AUTO SHUFFLE', '洗牌！', 1.8, PAL.skyD);
      }
      if (steps <= 0) gameOver('steps');
      syncState();
    }

    /* ---------- 结束 ---------- */
    function gameOver(reason) {
      if (dead) return;
      dead = true;
      api.sfx('over');
      if (reason === 'time') api.end('时间到，收工！一共整理了 ' + score + ' 分的小物件');
      else api.end('步数用完了，一共整理了 ' + score + ' 分的小物件');
      syncState();
    }

    /* ---------- 每帧更新 ---------- */
    function update(dt, t) {
      if (dead) return;
      /* 90 秒硬时限：时间到直接收工，保证一局一定会结束 */
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        gameOver('time');
        return;
      }
      if (banner) {
        banner.t += dt;
        if (banner.t >= banner.life) { banner = null; msgCn = ''; syncState(); }
      }
      if (chainPulse > 0) chainPulse -= dt;

      for (var i = pops.length - 1; i >= 0; i--) {
        pops[i].t += dt;
        pops[i].y -= 18 * dt;
        if (pops[i].t > 0.9) pops.splice(i, 1);
      }

      if (phase === 'clear') {
        timer += dt;
        if (timer >= T_CLEAR) resolveClear();
      } else if (phase === 'fall') {
        timer += dt;
        var p = Math.min(1, timer / T_FALL);
        var k = Math.pow(1 - p, 2);
        for (var r = 0; r < ROWS; r++) {
          for (var c = 0; c < COLS; c++) { offX[r][c] *= k; offY[r][c] *= k; }
        }
        if (timer >= T_FALL) settle();
      } else if (phase === 'reject') {
        timer += dt;
        var pr = Math.min(1, timer / T_REJECT);
        var e = pr < 0.5 ? pr * 2 : (1 - pr) * 2;
        var dx = rej.dc * NUDGE * e, dy = rej.dr * NUDGE * e;
        offX[rej.ar][rej.ac] = dx; offY[rej.ar][rej.ac] = dy;
        offX[rej.br][rej.bc] = -dx; offY[rej.br][rej.bc] = -dy;
        if (timer >= T_REJECT) {
          offX[rej.ar][rej.ac] = 0; offY[rej.ar][rej.ac] = 0;
          offX[rej.br][rej.bc] = 0; offY[rej.br][rej.bc] = 0;
          rej = null;
          phase = 'idle';
        }
      }
    }

    /* ---------- 绘制：桌面 ---------- */
    function drawDesk(ctx) {
      var y, k;
      for (y = TOPBAR; y < EDGE_Y; y++) {
        k = (y - TOPBAR) / (EDGE_Y - TOPBAR);
        ctx.fillStyle = k < 0.45 ? PAL.paper2 : PAL.paper3;
        ctx.fillRect(0, y, W, 1);
      }
      /* 桌后沿：一条阴影 + 一条高光 */
      ctx.fillStyle = DESK_EDGE; ctx.fillRect(0, TOPBAR, W, 2);
      ctx.fillStyle = DESK_L; ctx.fillRect(0, TOPBAR + 2, W, 1);
      /* 木纹 */
      for (var i = 0; i < 40; i++) {
        var gy = TOPBAR + 4 + i * 6 + ((i * 5) % 3);
        if (gy > EDGE_Y - 2) break;
        var gx = (i * 53) % 210;
        var gw = 55 + ((i * 31) % 120);
        ctx.fillStyle = (i % 3 === 0) ? DESK_L : DESK_D;
        ctx.fillRect(gx, gy, gw, 1);
      }
    }

    /* ---------- 绘制：木框托盘 ---------- */
    function drawFrame(ctx) {
      /* 落在桌面上的投影 */
      ctx.fillStyle = 'rgba(92,70,40,0.30)';
      ctx.fillRect(FX + 3, FY + 4, FW, FH);
      /* 框体 */
      ctx.fillStyle = PAL.brown;
      ctx.fillRect(FX, FY, FW, FH);
      /* 外斜角：左上受光，右下背光 */
      ctx.fillStyle = PAL.brownL;
      ctx.fillRect(FX, FY, FW, 1); ctx.fillRect(FX, FY, 1, FH);
      ctx.fillStyle = PAL.brownD;
      ctx.fillRect(FX, FY + FH - 1, FW, 1); ctx.fillRect(FX + FW - 1, FY, 1, FH);
      /* 内凹：上/左是阴影，下/右是反光 */
      ctx.fillStyle = '#3d2a1c';
      ctx.fillRect(FX + 1, FY + 1, FW - 2, 1); ctx.fillRect(FX + 1, FY + 1, 1, FH - 2);
      ctx.fillStyle = PAL.brownL;
      ctx.fillRect(FX + 1, FY + FH - 2, FW - 2, 1); ctx.fillRect(FX + FW - 2, FY + 1, 1, FH - 2);
      /* 内圈亮边 */
      ctx.fillStyle = '#c08a5c';
      ctx.fillRect(FX + 2, FY + 2, FW - 4, 1); ctx.fillRect(FX + 2, FY + 2, 1, FH - 4);
      /* 绒面棋盘底 */
      ctx.fillStyle = BOARD_A;
      ctx.fillRect(BX, BY, BOARD_W, BOARD_H);
    }

    /* ---------- 绘制：格底 ---------- */
    function drawCells(ctx) {
      var r, c, x, y;
      for (r = 0; r < ROWS; r++) {
        for (c = 0; c < COLS; c++) {
          x = BX + c * CELL; y = BY + r * CELL;
          ctx.fillStyle = ((r + c) & 1) ? BOARD_A : BOARD_B;
          ctx.fillRect(x, y, CELL, CELL);
        }
      }
      /* 格线 */
      for (var i = 1; i < COLS; i++) {
        ctx.fillStyle = BOARD_LINE;
        ctx.fillRect(BX + i * CELL, BY, 1, BOARD_H);
      }
      for (var j = 1; j < ROWS; j++) {
        ctx.fillStyle = BOARD_LINE;
        ctx.fillRect(BX, BY + j * CELL, BOARD_W, 1);
      }
      /* 凹槽内阴影 + 底边反光 */
      ctx.fillStyle = 'rgba(10,14,26,0.45)';
      ctx.fillRect(BX, BY, BOARD_W, 3); ctx.fillRect(BX, BY, 3, BOARD_H);
      ctx.fillStyle = 'rgba(255,255,255,0.045)';
      ctx.fillRect(BX, BY + BOARD_H - 2, BOARD_W, 2);
      ctx.fillRect(BX + BOARD_W - 2, BY, 2, BOARD_H);
      /* 每格再挖一个小凹槽，物件像放在卡槽里 */
      for (r = 0; r < ROWS; r++) {
        for (c = 0; c < COLS; c++) {
          x = BX + c * CELL + 2; y = BY + r * CELL + 2;
          ctx.fillStyle = 'rgba(9,12,22,0.35)';
          ctx.fillRect(x, y, CELL - 4, 1); ctx.fillRect(x, y, 1, CELL - 4);
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          ctx.fillRect(x, y + CELL - 5, CELL - 4, 1);
          ctx.fillRect(x + CELL - 5, y, 1, CELL - 4);
        }
      }
    }

    /* ---------- 绘制：一个小物件 ---------- */
    function drawPiece(ctx, def, x, y, lift) {
      if (!def) return;
      var sx = Math.round(x + (CELL - def.w) / 2);
      var sy = Math.round(y + (CELL - def.h) / 2) - lift;
      if (!def.rows || !def.map || !SPR.sprite) {
        /* 没有素材库时的兜底色块，游戏照样能玩 */
        ctx.fillStyle = def.back;
        ctx.fillRect(sx, sy, def.w, def.h);
        ctx.fillStyle = PAL.ink;
        ctx.fillRect(sx, sy, def.w, 1); ctx.fillRect(sx, sy, 1, def.h);
        return;
      }
      /* 落地投影 */
      var dy = (def.h + 3 >= CELL) ? 1 : 3;
      drawFlat(ctx, def.rows, sx + 2, sy + dy, def.sc, SHADOW);
      /* 本体 */
      SPR.sprite(ctx, def.rows, sx, sy, def.map, def.sc);
    }

    /* ---------- 绘制：所有物件 ---------- */
    function drawPieces(ctx, t) {
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          var def = TILES[grid[r][c]] || TILES[0];
          var x = BX + c * CELL + Math.round(offX[r][c]);
          var y = BY + r * CELL + Math.round(offY[r][c]);
          var picked = sel && sel.r === r && sel.c === c;
          var lift = picked ? 3 : 0;
          /* 闲置呼吸：每格相位不同，看起来错落有致 */
          var bob = Math.round(Math.sin(t * 2.1 + r * 2.7 + c * 1.3) * 1.2);
          if (bob < 0 && def.h >= CELL) bob = 0;
          drawPiece(ctx, def, x, y + bob, lift);
          /* 正在爆开：白光一闪 */
          if (mark[r][c]) {
            var pr = phase === 'clear' ? Math.min(1, timer / T_CLEAR) : 1;
            if (def.rows && SPR.sprite) {
              var sx = Math.round(x + (CELL - def.w) / 2);
              var sy = Math.round(y + (CELL - def.h) / 2) - lift + bob;
              ctx.globalAlpha = Math.max(0, 1 - pr);
              drawFlat(ctx, def.rows, sx, sy, def.sc, PAL.white);
              ctx.globalAlpha = 1;
            }
          }
          /* 选中：金色高亮框 */
          if (picked) {
            api.frame(ctx, x + 1, y + 1, CELL - 2, CELL - 2, PAL.gold);
            cornerMarks(ctx, x, y, CELL, CELL, PAL.butter, 7, 2);
          }
        }
      }
      /* 键盘光标：四角标记（呼吸闪烁） */
      if (!dead) {
        var blink = (Math.sin(t * 4) > -0.2);
        if (blink) {
          cornerMarks(ctx, BX + cur.c * CELL, BY + cur.r * CELL, CELL, CELL, PAL.white, 9, 2);
        }
      }
    }

    /* ---------- 绘制：STEPS / CHAIN 信息条 ---------- */
    function drawChip(ctx, x, label, value, vcolor, hot) {
      var y = CHIP_Y, w = CHIP_W, h = CHIP_H;
      ctx.fillStyle = 'rgba(92,70,40,0.22)';
      ctx.fillRect(x + 2, y + 2, w, h);
      ctx.fillStyle = hot ? PAL.butterL : PAL.paper;
      ctx.fillRect(x, y, w, h);
      api.bevel(ctx, x + 1, y + 1, w - 2, h - 2, PAL.white, PAL.paper3);
      api.frame(ctx, x, y, w, h, PAL.inkSoft);
      api.text(label, x + 9, y + 10, PAL.inkSoft, 1);
      var vw = api.textWidth(value, 2);
      api.text(value, x + w - 9 - vw, y + 7, vcolor, 2);
    }

    function drawChips(ctx) {
      drawChip(ctx, CHIP_X[0], 'STEPS', String(steps), steps <= 5 ? PAL.coralD : PAL.ink, false);
      drawChip(ctx, CHIP_X[1], 'CHAIN', chain > 1 ? 'X' + chain : '-', chain > 1 ? PAL.butterD : PAL.grayD, chainPulse > 0);
    }

    /* ---------- 绘制：桌面小物 ---------- */
    function drawProps(ctx) {
      if (!SPR.sprite) return;
      /* 小物在桌面上也要有影子，才不会像浮在空中 */
      function shadow(rows, x, y, sc, col) {
        ctx.globalAlpha = 0.18;
        drawFlat(ctx, rows, x + 2, y + 2, sc, col || '#8a7554');
        ctx.globalAlpha = 1;
      }
      /* 左上角便利贴、右上角订书机 */
      shadow(STICKY, 6, 22, 1);
      SPR.sprite(ctx, STICKY, 6, 22, LOCAL_MAP.sticky, 1);
      shadow(STAPLER, 288, 26, 1);
      SPR.sprite(ctx, STAPLER, 288, 26, LOCAL_MAP.stapler, 1);
      /* 两侧桌面小物：鼠标、铅笔、一叠文件 */
      shadow(MOUSE, 6, 120, 2);
      SPR.sprite(ctx, MOUSE, 6, 120, LOCAL_MAP.mouse, 2);
      shadow(PENCIL, 8, 156, 1);
      SPR.sprite(ctx, PENCIL, 8, 156, LOCAL_MAP.pencil, 1);
      if (SPR.PAPER && SPR.MAP && SPR.MAP.paper) {
        shadow(SPR.PAPER, 290, 124, 1);
        SPR.sprite(ctx, SPR.PAPER, 290, 124, SPR.MAP.paper, 1);
        SPR.sprite(ctx, SPR.PAPER, 292, 127, SPR.MAP.paper, 1);
        SPR.sprite(ctx, SPR.PAPER, 294, 130, SPR.MAP.paper, 1);
      }
      /* 桌沿下：偷看的小猫和一杯咖啡 */
      if (SPR.CAT && SPR.MAP && SPR.MAP.cat) {
        shadow(SPR.CAT, 8, EDGE_Y + 2, 1, '#3a2416');
        SPR.sprite(ctx, SPR.CAT, 8, EDGE_Y + 2, SPR.MAP.cat, 1);
      }
      if (SPR.CUP && SPR.MAP && SPR.MAP.cup) {
        shadow(SPR.CUP, 296, EDGE_Y + 2, 1, '#3a2416');
        SPR.sprite(ctx, SPR.CUP, 296, EDGE_Y + 2, SPR.MAP.cup, 1);
      }
    }

    /* ---------- 绘制：桌沿 + 操作提示 ---------- */
    function drawEdge(ctx) {
      ctx.fillStyle = PAL.brown; ctx.fillRect(0, EDGE_Y, W, 6);
      ctx.fillStyle = PAL.brownL; ctx.fillRect(0, EDGE_Y, W, 1);
      ctx.fillStyle = PAL.brownD; ctx.fillRect(0, EDGE_Y + 6, W, 2);
      for (var y = EDGE_Y + 8; y < H; y++) {
        var k = (y - EDGE_Y - 8) / Math.max(1, H - EDGE_Y - 8);
        ctx.fillStyle = k < 0.5 ? PAL.brown : PAL.brownD;
        ctx.fillRect(0, y, W, 1);
      }
      var hint = 'ARROWS MOVE  ENTER SWAP  S SHUFFLE';
      api.text(hint, (W - api.textWidth(hint, 1)) >> 1, EDGE_Y + 8, PAL.butterL, 1);
    }

    /* ---------- 绘制：横幅（连锁 / 提示） ---------- */
    function drawBanner(ctx) {
      if (!banner) return;
      var b = banner;
      var pop = Math.min(1, b.t * 8);
      var left = b.life - b.t;
      if (left < 0.3) ctx.globalAlpha = Math.max(0, left / 0.3);
      var tw = api.textWidth(b.text, 2);
      var w = tw + 36;
      var x = Math.round((W - w) / 2);
      var y = Math.round(BY + BOARD_H / 2 - 17 + (1 - pop) * 14);
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(x - 2, y - 2, w + 4, 28);
      ctx.fillStyle = PAL.red;
      ctx.fillRect(x, y, w, 24);
      ctx.fillStyle = PAL.coral;
      ctx.fillRect(x + 4, y + 3, w - 8, 18);
      ctx.fillStyle = PAL.redD;
      ctx.fillRect(x, y, 5, 24); ctx.fillRect(x + w - 5, y, 5, 24);
      api.text(b.text, x + 18, y + 5, PAL.white, 2);
      ctx.globalAlpha = 1;
    }

    /* ---------- 绘制：飘分 ---------- */
    function drawPops(ctx) {
      for (var i = 0; i < pops.length; i++) {
        var p = pops[i];
        ctx.globalAlpha = Math.max(0, 1 - p.t / 0.9);
        api.text(p.text, p.x + 1, p.y + 1, PAL.ink, 2);
        api.text(p.text, p.x, p.y, p.c, 2);
        ctx.globalAlpha = 1;
      }
    }

    /* ---------- 绘制：结束面板 ---------- */
    function drawOver(ctx) {
      ctx.fillStyle = 'rgba(27,24,38,0.55)';
      ctx.fillRect(0, TOPBAR, W, H - TOPBAR);
      var w = 208, h = 78, x = (W - w) >> 1, y = 88;
      ctx.fillStyle = PAL.paper;
      ctx.fillRect(x, y, w, h);
      api.frame(ctx, x, y, w, h, PAL.ink);
      api.bevel(ctx, x + 1, y + 1, w - 2, h - 2, PAL.white, PAL.paper3);
      var t1 = 'GAME OVER';
      api.text(t1, x + ((w - api.textWidth(t1, 2)) >> 1), y + 12, PAL.coralD, 2);
      var t2 = 'SCORE ' + score;
      api.text(t2, x + ((w - api.textWidth(t2, 2)) >> 1), y + 34, PAL.ink, 2);
      var t3 = 'BEST ' + best + '   STEPS ' + steps;
      api.text(t3, x + ((w - api.textWidth(t3, 1)) >> 1), y + 58, PAL.inkSoft, 1);
    }

    /* ---------- 总绘制 ---------- */
    function draw(ctx, a) {
      a = a || api;
      var t = api.time();
      drawDesk(ctx);
      drawFrame(ctx);
      drawCells(ctx);
      drawPieces(ctx, t);
      drawChips(ctx);
      drawEdge(ctx);
      drawProps(ctx);
      drawBanner(ctx);
      drawPops(ctx);
      if (SPR.drawDust) SPR.drawDust(ctx, W, H, t, PAL.paper3);
      /* 顶部状态条由内核统一绘制（SCORE / TIME） */
      a.statusBar({ score: score, time: timeLeft });
      /* 内核的状态条右侧留了空位，这里补一个 BEST 小标签 */
      var bt = 'BEST';
      var bn = String(best);
      a.text(bt, 262, 6, PAL.paper3, 1);
      a.text(bn, 262 + a.textWidth(bt, 1) + 4, 6, PAL.butter, 1);
      if (dead) drawOver(ctx);
    }

    /* ---------- 鼠标 / 触摸 ---------- */
    function pointer(type, x, y, e) {
      if (type !== 'down' || dead || phase !== 'idle') return;
      var c = Math.floor((x - BX) / CELL);
      var r = Math.floor((y - BY) / CELL);
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) { sel = null; return; }
      cur.r = r; cur.c = c;
      if (!sel) { sel = { r: r, c: c }; api.sfx('click'); return; }
      if (sel.r === r && sel.c === c) { sel = null; api.sfx('click'); return; }
      if (Math.abs(sel.r - r) + Math.abs(sel.c - c) === 1) {
        var a = sel; sel = null;
        doSwap(a.r, a.c, r, c);
      } else {
        sel = { r: r, c: c };
        api.sfx('click');
      }
    }

    /* ---------- 键盘 ---------- */
    function key(k, e) {
      if (dead) return;
      if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') {
        if (k === 'ArrowUp') cur.r = cur.r > 0 ? cur.r - 1 : 0;
        if (k === 'ArrowDown') cur.r = cur.r < ROWS - 1 ? cur.r + 1 : ROWS - 1;
        if (k === 'ArrowLeft') cur.c = cur.c > 0 ? cur.c - 1 : 0;
        if (k === 'ArrowRight') cur.c = cur.c < COLS - 1 ? cur.c + 1 : COLS - 1;
        api.sfx('click');
        return;
      }
      if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
        if (phase !== 'idle') return;
        if (!sel) { sel = { r: cur.r, c: cur.c }; api.sfx('click'); return; }
        if (sel.r === cur.r && sel.c === cur.c) { sel = null; api.sfx('click'); return; }
        if (Math.abs(sel.r - cur.r) + Math.abs(sel.c - cur.c) === 1) {
          var a = sel; sel = null;
          doSwap(a.r, a.c, cur.r, cur.c);
        } else {
          sel = { r: cur.r, c: cur.c };
          api.sfx('click');
        }
        return;
      }
      if (k === 's' || k === 'S') {          // 手动洗牌，不扣步数
        if (phase !== 'idle') return;
        shuffleBoard();
        api.sfx('whoosh');
        say('AUTO SHUFFLE', '洗牌！', 1.8, PAL.skyD);
      }
    }

    syncState();

    return {
      update: update,
      draw: draw,
      pointer: pointer,
      key: key
    };
  }

  /* ---------------- 注册 ---------------- */
  G.HS_GAMES.register({
    id: 'match3',
    title: '工位三消',
    tagline: '趁老板进会议室，把桌面小物件偷偷三连消除。',
    howto: '点一个物件，再点上下左右相邻的物件交换，连成三个以上就会消除并加分；一次消除的格数 × 10 × 连锁倍率就是得分，连续消除倍率会涨。30 步用完或者 90 秒到就收工，棋盘走不动时会自动洗牌。键盘：方向键移动光标，Enter / 空格选中与交换，S 手动洗牌。',
    emoji: '🧩',
    accent: '#f0837a',
    width: W,
    height: H,
    create: createGame
  });
})(typeof window !== 'undefined' ? window : this);
