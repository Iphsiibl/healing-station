/* ============================================================
 * 打工人急救站 · 摸鱼游戏厅 · 《工位三消》
 * ------------------------------------------------------------
 * 主题：趁老板进会议室，偷偷把工位上的小物件三连消除。
 * 玩法：7×7 棋盘，点一个再点相邻的交换；连成三个以上就消除并加分，
 *       连续消除有连锁倍率，消不动时会自动洗牌。
 * 零依赖：画面全是 canvas 像素绘制，音效由内核实时合成，没有任何外部文件。
 * ============================================================ */
(function (global) {
  'use strict';

  var G = global;
  if (!G.HS_GAMES) return;               // 内核没加载就不注册，省得报错
  var PAL = G.HS_GAMES.PAL;
  var SPR = G.HS_SPR || {};               // 素材库可能没加载，兜底成空对象

  /* ---------------- 棋盘参数 ---------------- */
  var COLS = 7;                          // 7 列
  var ROWS = 7;                          // 7 行
  var CELL = 16;                         // 每格 16px
  var BX = 8, BY = 8;                    // 棋盘左上角
  var BOARD_W = COLS * CELL;             // 棋盘宽 112
  var BOARD_H = ROWS * CELL;             // 棋盘高 112
  var MAX_STEPS = 30;                    // 步数上限，用完就收工
  var TIME_LIMIT = 90;                   // 一局 90 秒，时间到直接结算
  var TYPE_CNT = 6;                      // 6 种小物件
  var PANEL_X = 128;                     // 右侧「工牌」面板左边界（和棋盘留 4px 缝）
  var PANEL_W = 32;                      // 面板宽度
  var HUD_X = 129;                       // 面板里文字的起点
  var T_CLEAR = 0.22;                    // 消除爆开时长（秒）
  var T_FALL = 0.26;                     // 下落补位时长
  var T_REJECT = 0.26;                   // 交换失败弹回时长
  var NUDGE = 7;                         // 交换失败时两块互相顶开的像素
  var MAX_CHAIN = 20;                    // 连锁上限，防止极端情况死循环

  /* 显示器 / 盆栽没有现成配色表，这里自己配一套 */
  var MONITOR_MAP = { '2': PAL.gray, '3': PAL.grayD, '4': PAL.skyD, '5': PAL.butterL };
  var PLANT_MAP = { '2': PAL.mintD, '3': PAL.brown };

  /* 6 种工位小物件：点阵 + 配色 + 底板 */
  /* chip 底板色 / hl 高光边 / sh 暗边 / sc 点阵倍数 / trim 左右裁掉的列数 */
  var TILES = [];

  /* create 时再取素材，保证 sprites.js 已经加载完 */
  function buildTiles() {
    TILES = [
      { name: 'CUP',     rows: SPR.CUP,     map: SPR.MAP && SPR.MAP.cup,     chip: PAL.coralL,  hl: PAL.white,  sh: PAL.coralD,  sc: 2 },
      { name: 'DONUT',   rows: SPR.DONUT,   map: SPR.MAP && SPR.MAP.donut,   chip: PAL.butterL, hl: PAL.white,  sh: PAL.butterD, sc: 2 },
      { name: 'FISH',    rows: SPR.FISH,    map: SPR.MAP && SPR.MAP.fish,    chip: PAL.sky,     hl: PAL.waterL, sh: PAL.skyD,    sc: 2, trim: 1 },
      { name: 'CACTUS',  rows: SPR.CACTUS,  map: SPR.MAP && SPR.MAP.cactus,  chip: PAL.mintL,   hl: PAL.white,  sh: PAL.mintD,   sc: 2 },
      { name: 'MONITOR', rows: SPR.MONITOR, map: MONITOR_MAP,               chip: PAL.lilacL,  hl: PAL.white,  sh: PAL.lilacD,  sc: 1 },
      { name: 'PLANT',   rows: SPR.PLANT,   map: PLANT_MAP,                 chip: PAL.paper2,  hl: PAL.white,  sh: PAL.brownD,  sc: 2 }
    ];
  }

  /* ---------------- 小工具 ---------------- */

  /* 秒 -> m:ss（像素字体只有数字和冒号） */
  function fmtTime(sec) {
    var s = Math.max(0, Math.ceil(sec));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' + r : '' + r);
  }

  /* 画点阵精灵（支持左右裁边）：FISH 原图 9 宽，裁成 7 宽才能放大 2 倍塞进 16px 格子 */
  function drawSpriteTrim(ctx, rows, x, y, map, scale, trimL, trimR) {
    var h = rows.length, w = 0;
    for (var i = 0; i < h; i++) if (rows[i].length > w) w = rows[i].length;
    for (var r = 0; r < h; r++) {
      var row = rows[r];
      for (var c = trimL; c < w - trimR; c++) {
        var ch = row.charAt(c);
        if (ch === '.' || ch === ' ') continue;      // '.' 是透明
        var col = map[ch];
        if (!col) continue;                          // 没配色的槽位跳过
        ctx.fillStyle = col;
        ctx.fillRect((x + (c - trimL) * scale) | 0, (y + r * scale) | 0, scale, scale);
      }
    }
  }

  /* 算一片点阵画出来多大（用来在格子里居中） */
  function spriteSize(def) {
    if (!def.rows) return { w: 0, h: 0 };
    var w = 0, h = def.rows.length;
    for (var i = 0; i < h; i++) if (def.rows[i].length > w) w = def.rows[i].length;
    if (def.trim) w = Math.max(0, w - def.trim * 2);
    return { w: w * def.sc, h: h * def.sc };
  }

  /* 虚线框：给键盘光标用 */
  function dashFrame(ctx, x, y, w, h, c) {
    for (var i = 0; i < w; i += 2) {
      ctx.fillStyle = c;
      ctx.fillRect(x + i, y, 1, 1);
      ctx.fillRect(x + i, y + h - 1, 1, 1);
    }
    for (var j = 0; j < h; j += 2) {
      ctx.fillStyle = c;
      ctx.fillRect(x, y + j, 1, 1);
      ctx.fillRect(x + w - 1, y + j, 1, 1);
    }
  }

  /* 把中文提示交给 HTML 层（上层找不到容器就安静跳过） */
  function notify(doc, text) {
    try {
      if (!doc || !doc.getElementById) return;
      var el = doc.getElementById('hs-game-msg');
      if (!el && doc.querySelector) el = doc.querySelector('.hs-game-msg');
      if (el) el.textContent = text;
    } catch (e) { /* 没有 HTML 层也不影响游戏 */ }
  }

  /* ---------------- 游戏主体 ---------------- */
  function createGame(api) {
    buildTiles();

    var grid = [];        // grid[r][c] = 物件类型，-1 表示空
    var offX = [];        // 每格动画横向偏移（像素）
    var offY = [];        // 每格动画纵向偏移（像素）
    var mark = [];        // 本轮要爆开的格子
    var pops = [];        // 飘字（+分数）
    var sel = null;       // 鼠标/键盘选中的格子
    var cur = { r: 3, c: 3 };  // 键盘光标位置
    var phase = 'idle';   // idle / clear / fall / reject
    var timer = 0;        // 当前阶段计时
    var chain = 1;        // 连锁倍率
    var steps = MAX_STEPS;// 剩余步数
    var timeLeft = TIME_LIMIT; // 剩余时间（秒）
    var score = 0;        // 分数
    var best = readBest();// 历史最高分
    var msg = '';         // 画布上的英文提示
    var msgCn = '';       // 给 HTML 层的汉字提示
    var msgT = 0;         // 提示剩余时间
    var rej = null;       // 弹回动画的两个格子
    var dead = false;     // 是否已经结束

    /* ---------- 初始化 ---------- */
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

    /* 把当前状态推给 HTML 层（上层可以拿去做结算展示） */
    function syncState() {
      api.state({
        score: score,
        steps: steps,
        chain: chain,
        phase: phase,
        time: Math.ceil(timeLeft),
        message: msgCn
      });
    }

    function setMsg(text, cn, dur) {
      msg = text; msgCn = cn || ''; msgT = dur || 1.6;
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
      for (r = 0; r < ROWS; r++) {           // 横向
        var run = 1;
        for (c = 1; c <= COLS; c++) {
          if (c < COLS && grid[r][c] === grid[r][c - 1]) { run++; continue; }
          if (run >= 3) for (k = c - run; k < c; k++) out.push({ r: r, c: k });
          run = 1;
        }
      }
      for (c = 0; c < COLS; c++) {           // 纵向
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

    /* 洗牌：打乱后要保证既没有现成三连，也至少还有一步能走 */
    function shuffleBoard() {
      for (var attempt = 0; attempt < 40; attempt++) {
        var flat = [];
        for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) flat.push(grid[r][c]);
        api.shuffle(flat);
        var i = 0;
        for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) grid[r][c] = flat[i++];
        var ms = findMatches();             // 洗出来的三连再随机掉
        for (var k = 0; k < ms.length; k++) grid[ms[k].r][ms[k].c] = api.randInt(0, TYPE_CNT - 1);
        if (!findMatches().length && hasMove()) return true;
      }
      return false;
    }

    function swapTypes(r1, c1, r2, c2) {
      var t = grid[r1][c1]; grid[r1][c1] = grid[r2][c2]; grid[r2][c2] = t;
    }

    /* ---------- 交换与结算 ---------- */

    /* 玩家发起一次交换 */
    function doSwap(r1, c1, r2, c2) {
      if (phase !== 'idle' || dead) return false;
      if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return false;  // 只允许上下左右
      swapTypes(r1, c1, r2, c2);
      var ms = findMatches();
      if (!ms.length) {
        /* 消不了：换回去，两块互相顶一下再弹回来 */
        swapTypes(r1, c1, r2, c2);
        rej = { ar: r1, ac: c1, br: r2, bc: c2, dr: r2 - r1, dc: c2 - c1 };
        phase = 'reject'; timer = 0;
        api.sfx('miss');
        setMsg('NO MATCH', '这两块凑不成三个', 1.0);
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
        if (seen[key]) continue;          // 交叉点只算一次
        seen[key] = 1;
        list.push(ms[i]);
        mark[ms[i].r][ms[i].c] = 1;
      }
      var pts = Math.round(list.length * 10 * chain); // 消几个 × 10 × 连锁倍率（一定是整数）
      score = api.addScore(pts);
      api.sfx('pop');
      api.kick(Math.min(7, 2 + list.length * 0.7));  // 大连锁抖一下
      for (var k = 0; k < list.length; k++) {
        var m = list[k];
        var def = TILES[grid[m.r][m.c]];
        api.puff(BX + m.c * CELL + 8, BY + m.r * CELL + 8, def.sh, 5);
        pops.push({ x: BX + m.c * CELL, y: BY + m.r * CELL - 2, text: '+' + pts, t: 0, c: def.sh });
      }
      if (chain >= 2) setMsg('CHAIN X' + chain, '连锁 ' + chain + ' 倍！', 1.2);
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
            offY[write][c] = (r - write) * CELL;   // 负值 = 从上面落下来
            offX[write][c] = 0;
          }
          write--;
        }
        var empty = write + 1;                     // 空出来的行数
        for (var r2 = 0; r2 <= write; r2++) {
          grid[r2][c] = api.randInt(0, TYPE_CNT - 1);
          offY[r2][c] = (r2 - empty) * CELL;       // 从画面外掉进来
          offX[r2][c] = 0;
        }
      }
    }

    /* 落定：看看有没有新的三连，没有就看看还有没有下一步可走 */
    function settle() {
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) { offX[r][c] = 0; offY[r][c] = 0; }
      }
      if (chain >= MAX_CHAIN) {                   // 极端连锁兜底
        chain = 1;
        shuffleBoard();
        phase = 'idle';
        setMsg('AUTO SHUFFLE', '自动洗牌', 1.8);
        api.sfx('whoosh');
        return;
      }
      var ms = findMatches();
      if (ms.length) {                            // 还有连锁，继续消
        chain++;
        startClear(ms);
        return;
      }
      phase = 'idle';
      chain = 1;
      if (!hasMove()) {                           // 走不动了，自动洗牌
        shuffleBoard();
        api.sfx('whoosh');
        setMsg('AUTO SHUFFLE', '自动洗牌', 1.8);
      }
      if (steps <= 0) gameOver('steps');
      syncState();
    }

    /* ---------- 结束 ---------- */
    /* reason: 'steps' 步数用完 / 'time' 时间到 */
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
      if (msgT > 0) {                             // 提示淡出
        msgT -= dt;
        if (msgT <= 0) { msg = ''; msgCn = ''; syncState(); }
      }
      for (var i = pops.length - 1; i >= 0; i--) { // 飘字往上飘
        pops[i].t += dt;
        pops[i].y -= 16 * dt;
        if (pops[i].t > 0.9) pops.splice(i, 1);
      }
      if (phase === 'clear') {
        timer += dt;
        if (timer >= T_CLEAR) resolveClear();
      } else if (phase === 'fall') {
        timer += dt;
        var p = Math.min(1, timer / T_FALL);
        var k = Math.pow(1 - p, 2);                // 缓出：越落越慢
        for (var r = 0; r < ROWS; r++) {
          for (var c = 0; c < COLS; c++) { offX[r][c] *= k; offY[r][c] *= k; }
        }
        if (timer >= T_FALL) settle();
      } else if (phase === 'reject') {
        timer += dt;
        var pr = Math.min(1, timer / T_REJECT);
        var e = pr < 0.5 ? pr * 2 : (1 - pr) * 2;  // 顶出去再弹回来
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

    /* ---------- 绘制 ---------- */
    function drawCell(ctx, a, type, r, c, x, y) {
      var def = TILES[type];
      if (!def) return;
      var picked = sel && sel.r === r && sel.c === c;
      var oy = picked ? -1 : 0;                   // 选中的抬高一像素，像素风"拿起来"
      a.rect(ctx, x + 1, y + 1 + oy, 14, 14, def.chip);
      a.hline(ctx, x + 1, y + 1 + oy, 14, def.hl);
      a.vline(ctx, x + 1, y + 1 + oy, 14, def.hl);
      a.hline(ctx, x + 1, y + 14 + oy, 14, def.sh);
      a.vline(ctx, x + 14, y + 1 + oy, 14, def.sh);
      var sz = spriteSize(def);
      var sx = x + ((CELL - sz.w) >> 1);
      var sy = y + ((CELL - sz.h) >> 1) + oy;
      if (def.rows && def.map) {
        if (def.trim) drawSpriteTrim(ctx, def.rows, sx, sy, def.map, def.sc, def.trim, def.trim);
        else if (SPR.sprite) SPR.sprite(ctx, def.rows, sx, sy, def.map, def.sc);
      }
      if (picked) {                               // 选中：金色描边
        a.frame(ctx, x, y, CELL, CELL, PAL.butterD);
        a.frame(ctx, x + 1, y + 1, CELL - 2, CELL - 2, PAL.butter);
      }
    }

    /* 右侧面板里的一行：上面小字标签，下面右对齐的数值 */
    function hudRow(ctx, a, label, value, y, col) {
      a.text(label, HUD_X, y, PAL.inkSoft, 1);
      var w = a.textWidth(value, 1);
      a.text(value, PANEL_X + PANEL_W - 2 - w, y + 10, col || PAL.ink, 1);
    }

    function draw(ctx, a) {
      a = a || api;
      /* 奶油纸底 */
      a.rect(ctx, 0, 0, 160, 144, PAL.paper);
      /* 棋盘底板 */
      a.roundRect(ctx, 4, 4, BOARD_W + 8, BOARD_H + 8, 2, PAL.paper2);
      a.frame(ctx, 4, 4, BOARD_W + 8, BOARD_H + 8, PAL.inkSoft);
      /* 棋格底纹：淡一点的方块，让人看得出是格子 */
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          if ((r + c) % 2 === 0) a.rect(ctx, BX + c * CELL, BY + r * CELL, CELL, CELL, PAL.paper);
        }
      }
      /* 小物件 */
      for (r = 0; r < ROWS; r++) {
        for (c = 0; c < COLS; c++) {
          var x = BX + c * CELL + Math.round(offX[r][c]);
          var y = BY + r * CELL + Math.round(offY[r][c]);
          if (mark[r][c]) {                       // 正在爆开：方块缩小
            var pr = phase === 'clear' ? Math.min(1, timer / T_CLEAR) : 1;
            var sz = Math.max(2, Math.round(CELL * (1 - pr)));
            var def = TILES[grid[r][c]];
            a.rect(ctx, x + ((CELL - sz) >> 1), y + ((CELL - sz) >> 1), sz, sz, def.sh);
            continue;
          }
          drawCell(ctx, a, grid[r][c], r, c, x, y);
        }
      }
      /* 键盘光标：虚线框 */
      if (!dead) dashFrame(ctx, BX + cur.c * CELL, BY + cur.r * CELL, CELL, CELL, PAL.ink);

      /* 右侧「工牌」面板：浅色底 + 描边，数字看得清；棋盘和面板之间留 4px 缝 */
      a.roundRect(ctx, PANEL_X, 4, PANEL_W, 120, 2, PAL.paper2);
      a.frame(ctx, PANEL_X, 4, PANEL_W, 120, PAL.inkSoft);
      a.rect(ctx, PANEL_X + 2, 5, PANEL_W - 4, 1, PAL.white);
      hudRow(ctx, a, 'SCORE', String(score), 8, PAL.roseD);
      hudRow(ctx, a, 'BEST', String(best), 32, PAL.ink);
      hudRow(ctx, a, 'STEPS', String(steps), 56, steps <= 5 ? PAL.coralD : PAL.ink);
      hudRow(ctx, a, 'CHAIN', chain > 1 ? 'X' + chain : '-', 80, chain > 1 ? PAL.butterD : PAL.grayD);
      hudRow(ctx, a, 'TIME', fmtTime(timeLeft), 104, timeLeft <= 15 ? PAL.coralD : PAL.ink);

      /* 底部桌沿 */
      a.rect(ctx, 0, 124, 160, 20, PAL.brown);
      a.rect(ctx, 0, 124, 160, 2, PAL.brownL);
      a.rect(ctx, 0, 142, 160, 2, PAL.brownD);
      if (msg) a.text(msg, 4, 128, PAL.butterL, 1);
      a.text('ARROWS + ENTER + S', 4, 136, PAL.paper3, 1);
      /* 围观群众：工位常驻的猫（蹲在桌沿上，不挡面板） */
      if (SPR.CAT && SPR.sprite && SPR.MAP) SPR.sprite(ctx, SPR.CAT, 136, 126, SPR.MAP.cat, 2);

      /* 飘字 */
      for (var i = 0; i < pops.length; i++) {
        a.text(pops[i].text, pops[i].x, pops[i].y, pops[i].c, 1);
      }
      /* 空气里的纸屑 */
      if (SPR.drawDust) SPR.drawDust(ctx, 160, 144, api.time(), PAL.paper3);

      /* 结束横幅 */
      if (dead) {
        var bx = 20, by = 52, bw = 120, bh = 36;
        a.rect(ctx, bx, by, bw, bh, PAL.paper);
        a.frame(ctx, bx, by, bw, bh, PAL.ink);
        a.text('GAME OVER', bx + 20, by + 8, PAL.coralD, 1);
        a.text('SCORE ' + score, bx + 20, by + 20, PAL.ink, 1);
      }
    }

    /* ---------- 鼠标 / 触摸 ---------- */
    function pointer(type, x, y, e) {
      if (type !== 'down' || dead || phase !== 'idle') return;
      var c = Math.floor((x - BX) / CELL);
      var r = Math.floor((y - BY) / CELL);
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) { sel = null; return; }  // 点到棋盘外就取消选择
      cur.r = r; cur.c = c;
      if (!sel) { sel = { r: r, c: c }; api.sfx('click'); return; }
      if (sel.r === r && sel.c === c) { sel = null; api.sfx('click'); return; }  // 再点一次取消
      if (Math.abs(sel.r - r) + Math.abs(sel.c - c) === 1) {
        var a = sel; sel = null;
        doSwap(a.r, a.c, r, c);
      } else {
        sel = { r: r, c: c };   // 不相邻就改选这一格
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
      if (k === 's' || k === 'S') {               // 手动洗牌，不扣步数
        if (phase !== 'idle') return;
        shuffleBoard();
        api.sfx('whoosh');
        setMsg('AUTO SHUFFLE', '自动洗牌', 1.8);
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
    width: 160,
    height: 144,
    create: createGame
  });
})(typeof window !== 'undefined' ? window : this);
