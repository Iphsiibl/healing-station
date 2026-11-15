/* ============================================================
 * 打工人急救站 · 摸鱼游戏厅 · 《摸鱼钓鱼》
 * ------------------------------------------------------------
 * 主题：工位旁边的小船，抛竿下去，什么也不干。
 * 玩法：点水面抛竿，等浮标晃一会儿；钓到鱼加分，连续钓到有倍率，
 *       没钓到会掉一点耐心值，耐心耗尽或者时间到就收工。
 * 零依赖：画面全是 canvas 像素绘制，音效由内核实时合成，没有任何外部文件。
 * ============================================================ */
(function (global) {
  'use strict';

  var G = global;
  if (!G.HS_GAMES) return;               // 内核没加载就不注册，省得报错
  var PAL = G.HS_GAMES.PAL;
  var SPR = G.HS_SPR || {};               // 素材库可能没加载，兜底成空对象

  /* ---------------- 画面参数 ---------------- */
  var W = 160, H = 144;                  // 逻辑分辨率
  var SKY_H = 28;                        // 顶部天空带高度，右上角计分板也放这儿
  var WATER_Y = 28;                      // 水面起始 y
  var MAX_PATIENCE = 10;                 // 耐心值
  var MAX_FLOATS = 3;                    // 同时最多几根线
  var TIDE_EVERY = 20;                   // 多久来一次鱼潮（秒）
  var TIDE_LAST = 5;                     // 鱼潮持续（秒）
  var TIME_LIMIT = 90;                   // 一局 90 秒，时间到直接收工结算
  var FISH_Y = 108;                      // 船所在的高度
  var HUD_X = 88, HUD_W = 72, HUD_H = 28;// 右上角计分板的位置

  /* ---------------- 鱼的稀有度 ---------------- */
  /* 常见=蓝、稀有=珊瑚、传说=金色；cn 是给 HTML 层看的中文名 */
  var RARITY = [
    { key: 'COMMON', cn: '常见小蓝鱼', map: { '1': PAL.white, '2': PAL.skyD, '3': PAL.coral }, pts: 30 },
    { key: 'RARE',   cn: '稀有珊瑚鱼', map: { '1': PAL.white, '2': PAL.coral, '3': PAL.roseD }, pts: 60 },
    { key: 'LEGEND', cn: '传说金鳞鱼', map: { '1': PAL.butterL, '2': PAL.gold, '3': PAL.butterD }, pts: 120 }
  ];

  /* ---------------- 背景鱼群 ---------------- */
  /* 2 条小鱼 + 1 条大鱼，高低错落、大小不同，深色剪影，不会跟耐心值混在一起 */
  var SCHOOL = [
    { x: 26,  y: 58,  sp: 8,   s: 2 },   // 大鱼，慢悠悠地游
    { x: 104, y: 84,  sp: -13, s: 1 },   // 小鱼，往左游
    { x: 58,  y: 112, sp: 16,  s: 1 }    // 小鱼，往右游
  ];

  /* ---------------- 小工具 ---------------- */

  /* 把中文提示交给 HTML 层（上层找不到容器就安静跳过） */
  function notify(doc, text) {
    try {
      if (!doc || !doc.getElementById) return;
      var el = doc.getElementById('hs-game-msg');
      if (!el && doc.querySelector) el = doc.querySelector('.hs-game-msg');
      if (el) el.textContent = text;
    } catch (e) { /* 没有 HTML 层也不影响游戏 */ }
  }

  /* 秒 -> m:ss（画布上的像素字体只有数字和冒号） */
  function fmtTime(sec) {
    var s = Math.max(0, Math.ceil(sec));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' + r : '' + r);
  }

  /* ---------------- 游戏主体 ---------------- */
  function createGame(api) {
    var floats = [];      // 浮标
    var catches = [];     // 上浮的鱼
    var pops = [];        // 飘字
    var bubbles = [];     // 空钩气泡
    var swimmers = [];    // 水下背景里游来游去的鱼
    var patience = MAX_PATIENCE;
    var streak = 0;       // 连续钓到的次数
    var combo = 1;        // 当前倍率（= min(3, streak)，最多 3 倍）
    var score = 0;
    var best = readBest();
    var caught = 0;       // 钓到的鱼总数
    var tideT = 0;        // 鱼潮剩余时间
    var tideTimer = 0;    // 距离下次鱼潮
    var timeLeft = TIME_LIMIT;  // 剩余时间
    var msg = '';         // 画布上的英文提示
    var msgCn = '';       // 给 HTML 层的汉字提示
    var msgT = 0;
    var dead = false;

    /* 背景鱼群：按 SCHOOL 起手，再各自随机一点点位置和速度 */
    for (var i = 0; i < SCHOOL.length; i++) {
      swimmers.push({
        x: SCHOOL[i].x + api.rand(-8, 8),
        y: SCHOOL[i].y + api.rand(-3, 3),
        sp: SCHOOL[i].sp,
        s: SCHOOL[i].s
      });
    }

    function readBest() {
      try {
        if (G.HS_GAMES && G.HS_GAMES.best) return G.HS_GAMES.best('fish') || 0;
      } catch (e) { /* 没有存档就当 0 分 */ }
      return 0;
    }

    function syncState() {
      api.state({
        score: score,
        patience: patience,
        combo: combo,
        streak: streak,
        tide: tideT > 0,
        time: Math.ceil(timeLeft),
        message: msgCn
      });
    }

    function setMsg(text, cn, dur) {
      msg = text; msgCn = cn || ''; msgT = dur || 1.6;
      syncState();
      notify(G.document, msgCn);
    }

    /* ---------- 抛竿与结算 ---------- */

    /* 掷一次鱼：返回稀有度下标，-1 表示空钩 */
    function rollFish() {
      var tide = tideT > 0;
      /* 先掷空钩：平时 25% 空钩，鱼潮时只有 15%（水暖鱼多，空军少了） */
      if (api.chance(tide ? 0.15 : 0.25)) return -1;
      var p = api.rand(0, 1);
      var edge1 = tide ? 0.45 : 0.70;     // 常见
      var edge2 = tide ? 0.80 : 0.95;     // 稀有
      if (p < edge1) return 0;
      if (p < edge2) return 1;
      return 2;                            // 传说
    }

    function castAt(x, y) {
      if (floats.length >= MAX_FLOATS) return;   // 线不够用了，先等等
      floats.push({
        x: x, y: y,
        t: 0,                                    // 已经等了多久
        wait: api.rand(1.2, 2.5),                // 这次要等多久
        anim: 0,
        state: 'wait'
      });
      api.sfx('splash');
    }

    /* 等待结束，判定这一竿的结果 */
    function resolve(f) {
      f.state = 'done';
      var r = rollFish();
      if (r >= 0) {
        streak++;                                  // 连续钓到就叠倍率
        combo = Math.min(3, streak);               // 倍率最多 3 倍
        var pts = Math.round(RARITY[r].pts * combo);
        score = api.addScore(pts);
        caught++;
        api.sfx('coin');
        api.puff(f.x, f.y, RARITY[r].map['2'], 6);
        catches.push({ x: f.x, y: f.y, r: r, t: 0 });
        pops.push({ x: f.x - 18, y: f.y - 14, text: RARITY[r].key + ' +' + pts, t: 0, c: PAL.gold });
        setMsg(RARITY[r].key + ' +' + pts, '钓到了！' + RARITY[r].cn + '（+' + pts + ' 分）', 1.6);
      } else {
        streak = 0;                             // 空钩打断连击
        combo = 1;
        patience--;
        api.sfx('miss');
        bubbles.push({ x: f.x, y: f.y, t: 0 });
        pops.push({ x: f.x - 14, y: f.y - 14, text: 'NO FISH', t: 0, c: PAL.paper3 });
        setMsg('NO FISH', '空钩……（耐心 -1）', 1.4);
        if (patience <= 0) gameOver('patience');
      }
      syncState();
    }

    /* reason: 'patience' 耐心耗尽 / 'time' 时间到 */
    function gameOver(reason) {
      if (dead) return;
      dead = true;
      api.sfx('over');
      if (reason === 'time') api.end('时间到，收工！一共钓到了 ' + caught + ' 条鱼');
      else api.end('耐心值耗尽，一共钓到了 ' + caught + ' 条鱼');
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
      if (msgT > 0) {                            // 提示淡出
        msgT -= dt;
        if (msgT <= 0) { msg = ''; msgCn = ''; syncState(); }
      }
      /* 鱼潮计时：每 20 秒来一次，持续 5 秒 */
      tideTimer += dt;
      if (tideTimer >= TIDE_EVERY) {
        tideTimer = 0;
        tideT = TIDE_LAST;
        api.sfx('level');
        setMsg('TIDE!', '稀有鱼潮来了，好鱼变多了！', 2.0);
      }
      if (tideT > 0) tideT -= dt;
      /* 浮标 */
      for (var i = floats.length - 1; i >= 0; i--) {
        var f = floats[i];
        f.t += dt;
        if (f.state === 'wait') {
          if (f.t >= f.wait) resolve(f);
        } else {
          f.anim += dt;
          if (f.anim > 1.0) floats.splice(i, 1);
        }
      }
      /* 上浮的鱼 */
      for (var j = catches.length - 1; j >= 0; j--) {
        catches[j].t += dt;
        if (catches[j].t > 1.2) catches.splice(j, 1);
      }
      /* 空钩气泡 */
      for (var b = bubbles.length - 1; b >= 0; b--) {
        bubbles[b].t += dt;
        if (bubbles[b].t > 1.1) bubbles.splice(b, 1);
      }
      /* 飘字 */
      for (var p = pops.length - 1; p >= 0; p--) {
        pops[p].t += dt;
        pops[p].y -= 14 * dt;
        if (pops[p].t > 1.0) pops.splice(p, 1);
      }
      /* 背景鱼游动 */
      for (var s = 0; s < swimmers.length; s++) {
        var sw = swimmers[s];
        sw.x += sw.sp * dt;
        if (sw.x > W + 20) sw.x = -20;
        if (sw.x < -20) sw.x = W + 20;
      }
      /* 鱼潮时水里会多一条鱼 */
      if (tideT > 0 && swimmers.length < 4) {
        swimmers.push({
          x: api.rand(-20, W),
          y: api.rand(64, 122),
          sp: api.rand(6, 14) * (api.chance(0.5) ? 1 : -1),
          s: api.chance(0.35) ? 2 : 1
        });
      }
    }

    /* ---------- 绘制 ---------- */

    /* 画一颗 5×4 的小心心（耐心值用） */
    function heart(ctx, a, x, y, col) {
      a.rect(ctx, x + 1, y, 1, 2, col);
      a.rect(ctx, x + 3, y, 1, 2, col);
      a.rect(ctx, x, y + 1, 5, 2, col);
      a.rect(ctx, x + 1, y + 3, 3, 1, col);
    }

    function draw(ctx, a) {
      a = a || api;
      var tide = tideT > 0;
      var deep = tide ? PAL.lilacD : PAL.water;      // 鱼潮时整片水变色
      var near = tide ? PAL.lilac : PAL.waterL;
      var crest = tide ? PAL.lilacL : PAL.sky;

      /* 天空 */
      a.rect(ctx, 0, 0, W, SKY_H, PAL.sky);
      var cloud = (api.time() * 3) % (W + 40) - 40;
      a.rect(ctx, cloud | 0, 6, 16, 3, PAL.white);
      a.rect(ctx, (cloud + 4) | 0, 4, 9, 2, PAL.white);
      a.circle(ctx, 16, 9, 5, PAL.butterL);
      a.circle(ctx, 16, 9, 3, PAL.butter);

      /* 水面 */
      a.rect(ctx, 0, WATER_Y, W, H - WATER_Y, deep);
      a.rect(ctx, 0, WATER_Y, W, 10, near);
      /* 波浪：几排错开的横线，慢慢往右飘 */
      for (var row = 0; row < 8; row++) {
        var wy = WATER_Y + 16 + row * 13;
        var sp = 5 + row * 2;
        var off = (api.time() * sp) % 16;
        for (var x = -16; x < W; x += 16) {
          var xx = Math.round(x + off);
          a.rect(ctx, xx, wy, 7, 1, row % 2 ? near : crest);
          a.rect(ctx, xx + 9, wy + 4, 4, 1, near);
        }
      }

      /* 水下背景鱼：深色剪影，2 小 1 大，高低错落 */
      if (SPR.FISH && SPR.sprite) {
        for (var s = 0; s < swimmers.length; s++) {
          var sw = swimmers[s];
          var sil = { '1': PAL.paper, '2': PAL.ink, '3': PAL.paper };
          SPR.sprite(ctx, SPR.FISH, sw.x | 0, sw.y | 0, sil, sw.s, sw.sp < 0);
        }
      }

      /* 鱼线：从竿尖拉到每个浮标 */
      for (var f = 0; f < floats.length; f++) {
        var fl = floats[f];
        a.line(ctx, 48, FISH_Y - 30, fl.x, fl.y - 2, PAL.paper3);
      }

      /* 浮标 + 涟漪 */
      for (var q = 0; q < floats.length; q++) {
        var ff = floats[q];
        var bob = Math.round(Math.sin(api.time() * 6 + ff.x) * 1);
        var fy = ff.y + bob;
        var rp = (ff.t * 0.8) % 1;
        a.ellipse(ctx, ff.x, fy + 2, 2 + Math.round(rp * 6), 1, near);
        a.rect(ctx, ff.x - 1, fy - 3, 3, 4, PAL.coral);
        a.rect(ctx, ff.x - 1, fy - 3, 3, 2, PAL.white);
        a.rect(ctx, ff.x, fy - 4, 1, 1, PAL.ink);
      }

      /* 上浮的鱼 */
      for (var j = 0; j < catches.length; j++) {
        var c = catches[j];
        var pr = Math.min(1, c.t / 0.9);
        var fy2 = c.y + 14 - pr * 22;                 // 从水下浮上来
        if (SPR.FISH && SPR.sprite) {
          SPR.sprite(ctx, SPR.FISH, (c.x - 4) | 0, (fy2 - 3) | 0, RARITY[c.r].map, 1);
        }
        a.rect(ctx, c.x - 3, fy2 + 5, 7, 1, crest);  // 鱼身下的水花
      }

      /* 空钩气泡 */
      for (var b = 0; b < bubbles.length; b++) {
        var bb = bubbles[b];
        var by = bb.y - 10 - bb.t * 12;
        a.circle(ctx, bb.x, by, 5, PAL.white);
        a.circle(ctx, bb.x, by, 4, PAL.paper2);
        a.text('X', bb.x - 3, by - 3, PAL.ink, 1);
      }

      /* 小船 + 船员 + 猫 */
      var bob2 = Math.round(Math.sin(api.time() * 1.6) * 1);
      var deck = FISH_Y + bob2;
      a.rect(ctx, 4, deck, 52, 3, PAL.brownL);        // 甲板
      a.rect(ctx, 7, deck + 3, 46, 4, PAL.brown);      // 船身
      a.rect(ctx, 11, deck + 7, 38, 3, PAL.brownD);    // 船底
      if (SPR.WORKER && SPR.sprite && SPR.MAP) {
        SPR.sprite(ctx, SPR.WORKER, 22, deck - 8, SPR.MAP.worker, 1);
      }
      if (SPR.CAT && SPR.sprite && SPR.MAP) {
        SPR.sprite(ctx, SPR.CAT, 40, deck - 8, SPR.MAP.cat, 1);
      }
      a.line(ctx, 29, deck - 6, 48, deck - 30, PAL.brownD);   // 鱼竿
      a.px(ctx, 48, deck - 30, PAL.ink);

      /* 飘字 */
      for (var pp = 0; pp < pops.length; pp++) {
        a.text(pops[pp].text, pops[pp].x, pops[pp].y, pops[pp].c, 1);
      }

      /* 右上角计分板：浅色底 + 描边，数字看得清 */
      a.roundRect(ctx, HUD_X, 0, HUD_W, HUD_H, 2, PAL.paper2);
      a.frame(ctx, HUD_X, 0, HUD_W, HUD_H, PAL.inkSoft);
      a.rect(ctx, HUD_X + 2, 1, HUD_W - 4, 1, PAL.white);
      /* 第一行：SCORE / BEST 的小标题 */
      a.text('SCORE', HUD_X + 4, 3, PAL.inkSoft, 1);
      a.text('BEST', HUD_X + 38, 3, PAL.inkSoft, 1);
      /* 第二行：当前分 / 历史最高分（右对齐） */
      var sv = String(score);
      a.text(sv, HUD_X + 33 - a.textWidth(sv, 1), 12, PAL.roseD, 1);
      var bv = String(best);
      a.text(bv, HUD_X + HUD_W - 4 - a.textWidth(bv, 1), 12, PAL.ink, 1);
      /* 第三行：剩余时间（标题在左，数字右对齐） */
      a.text('TIME', HUD_X + 4, 21, PAL.inkSoft, 1);
      var tv = fmtTime(timeLeft);
      a.text(tv, HUD_X + HUD_W - 4 - a.textWidth(tv, 1), 21, timeLeft <= 15 ? PAL.coralD : PAL.ink, 1);

      /* 左下角：耐心值卡片（10 颗小心心） */
      a.roundRect(ctx, 4, 124, 70, 13, 2, PAL.paper2);
      a.frame(ctx, 4, 124, 70, 13, PAL.inkSoft);
      for (var h = 0; h < MAX_PATIENCE; h++) {
        heart(ctx, a, 8 + h * 6, 129, h < patience ? PAL.coral : PAL.grayD);
      }

      /* 右下角：鱼潮提示 + 连击倍率卡片 */
      if (tide) {
        a.roundRect(ctx, 96, 124, 32, 13, 2, PAL.lilacL);
        a.frame(ctx, 96, 124, 32, 13, PAL.lilacD);
        a.text('TIDE!', 112 - a.textWidth('TIDE!', 1) / 2, 127, PAL.lilacD, 1);
      }
      if (combo > 1) {
        a.roundRect(ctx, 132, 124, 24, 13, 2, PAL.paper);
        a.frame(ctx, 132, 124, 24, 13, PAL.coralD);
        var cv = 'X' + combo;
        a.text(cv, 144 - a.textWidth(cv, 1) / 2, 127, PAL.coralD, 1);
      }

      /* 结束横幅 */
      if (dead) {
        var bx = 20, by2 = 52, bw = 120, bh = 36;
        a.rect(ctx, bx, by2, bw, bh, PAL.paper);
        a.frame(ctx, bx, by2, bw, bh, PAL.ink);
        a.text(timeLeft <= 0 ? 'TIME UP' : 'NO PATIENCE', bx + 12, by2 + 8, PAL.coralD, 1);
        a.text('SCORE ' + score, bx + 14, by2 + 20, PAL.ink, 1);
      }
    }

    /* ---------- 鼠标 / 触摸 ---------- */
    function pointer(type, x, y, e) {
      if (type !== 'down' || dead) return;
      if (y < WATER_Y + 2) return;                // 天空里钓不到鱼
      castAt(Math.max(4, Math.min(W - 4, Math.round(x))), Math.max(WATER_Y + 6, Math.min(H - 20, Math.round(y))));
    }

    /* ---------- 键盘 ---------- */
    function key(k, e) {
      if (dead) return;
      if (k === ' ' || k === 'Spacebar' || k === 'Enter') {
        castAt(api.randInt(20, W - 20), api.randInt(WATER_Y + 12, H - 24));  // 盲抛一竿
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
    id: 'fish',
    title: '摸鱼钓鱼',
    tagline: '在工位边的小船上抛竿，什么也不干，只等鱼。',
    howto: '点水面抛竿，浮标会晃一会儿：钓到鱼就加分，连续钓到会有 1/2/3 倍加成；没钓到会掉一点耐心值（共 10 点），耐心耗尽就收工。一局 90 秒，时间到也会自动结算。每 20 秒会来一次稀有鱼潮，水会变色，这时候更容易钓到稀有鱼和传说鱼。键盘：Enter / 空格盲抛一竿。',
    emoji: '🎣',
    accent: '#8cc7e6',
    width: 160,
    height: 144,
    create: createGame
  });
})(typeof window !== 'undefined' ? window : this);
