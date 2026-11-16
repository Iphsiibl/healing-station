/* ============================================================
 * 打工人急救站 · 摸鱼游戏厅 · 《摸鱼钓鱼》v2
 * ------------------------------------------------------------
 * v2 的改动：
 *   1. 画布从 160×144 升级到 320×288，场景整张重画：
 *      渐变天空 + 夕阳 + 流云 + 远山 + 芦苇远岸
 *      → 分层水面（竖向渐变 + 斜射光柱 + 动态波纹）
 *      → 前景木栈道 + 木桶 + 马克杯 + 猫 + 告示 + 小铃铛
 *      → 工位旁的小鱼竿（竿梢真的连着浮标）
 *   2. 鱼会摆尾、跃出水面；空钩会冒泡；潮水会变色。
 *   3. 顶部状态条显示 SCORE / TIME，左上木牌显示耐心值（10 颗心）
 *      与历史最高分，右上角显示 TIDE! 横幅。
 *
 * 玩法与 v1 完全一致（一点没改）：
 *   点水面抛竿，同时最多 3 根线，每根等 1.2~2.5 秒结算；
 *   空钩概率平时 25%、鱼潮时 15%，空钩扣 1 点耐心（初始 10 点）；
 *   常见 30 / 稀有 60 / 传说 120 分，× 连击倍率（1/2/3，空钩清零）；
 *   每 20 秒来一次 5 秒的鱼潮；
 *   耐心归零，或者 90 秒硬时限到点，一定收工（api.end + 中文小结）。
 *
 * 文本规则：画布上只画像素字库有的 ASCII（大写字母/数字/少量符号），
 *          中文全部通过 api.state({message:'…'}) 交给 HTML 层。
 * ============================================================ */
(function (global) {
  'use strict';

  var G = global.HS_GAMES;
  var SPR = global.HS_SPR;
  if (!G || !SPR) return;

  var PAL = G.PAL;
  var W = 320, H = 288;

  /* ---------------- 场景分层（逻辑坐标） ---------------- */
  var TOPBAR = 18;         /* 顶部状态条高度，下面才是画面 */
  var SKY_H = 56;          /* 天空带：18 ~ 74 */
  var HILL_Y = 52;         /* 远山起点 */
  var BANK_Y = 84;         /* 远岸草线 */
  var WATER_Y = 96;        /* 水面 */
  var PIER_Y = 232;        /* 木栈道台面 */
  var PIER_X1 = 160;       /* 木栈道右端 */
  var ROD_TIP_X = 208, ROD_TIP_Y = 78;    /* 竿梢 */
  var ROD_BUTT_X = 146, ROD_BUTT_Y = 197; /* 竿柄（工人手里） */

  /* HUD */
  var PANEL_X = 8, PANEL_Y = 22, PANEL_W = 160, PANEL_H = 30;
  var TIDE_X = 220, TIDE_Y = 22, TIDE_W = 92, TIDE_H = 24;
  var COMBO_X = 174, COMBO_Y = 28;

  /* ---------------- 玩法参数（与 v1 一致） ---------------- */
  var MAX_PATIENCE = 10;
  var MAX_FLOATS = 3;
  var TIDE_EVERY = 20;
  var TIDE_LAST = 5;
  var TIME_LIMIT = 90;

  /* ============================================================
   * 本地素材（只在本文件里定义，不污染 sprites.js）
   * 每行都用 row(宽, [起点, 内容], …) 拼，宽度由代码保证。
   * ============================================================ */
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

  /* 小鱼（18×8，尾巴单独用三角函数画，所以身体不含尾巴；E=眼珠 G=高光） */
  var BODY_SMALL = [
    row(18, [7, 'KKKKK']),
    row(18, [5, 'KDDDDDDK']),
    row(18, [4, 'KBEGBBBBK']),
    row(18, [3, 'KBBBBBBBBBK']),
    row(18, [3, 'KBBBBBBBBBK']),
    row(18, [4, 'KBBWWWWWWK']),
    row(18, [5, 'KWWWWWWWK']),
    row(18, [7, 'KKKKKKK'])
  ];

  /* 中鱼（24×10） */
  var BODY_MED = [
    row(24, [8, 'KKKKKK']),
    row(24, [6, 'KDDDDDDDDDK']),
    row(24, [5, 'KBEGBBBBBBBK']),
    row(24, [4, 'KBBBBBBBBBBBBK']),
    row(24, [3, 'KBBBBBBBBBBBBBK']),
    row(24, [3, 'KBBBBBBBBBBBBBK']),
    row(24, [4, 'KBBBBBBBBBBBBK']),
    row(24, [5, 'KBBWWWWWWWWWWK']),
    row(24, [6, 'KWWWWWWWWWWWWK']),
    row(24, [8, 'KKKKKKKKKK'])
  ];

  /* 大鱼（30×14，传说金鳞） */
  var BODY_BIG = [
    row(30, [11, 'KKKKKK']),
    row(30, [9, 'KDDDDDDDDK']),
    row(30, [7, 'KBEGBBBBBBBK']),
    row(30, [6, 'KBBBBBBBBBBBBBK']),
    row(30, [5, 'KBBBBBBBBBBBBBBK']),
    row(30, [4, 'KBBBBBBBBBBBBBBBK']),
    row(30, [3, 'KBBBBBBBBBBBBBBBK']),
    row(30, [3, 'KBBBBBBBBBBBBBBBK']),
    row(30, [4, 'KBBBBBBBBBBBBBBK']),
    row(30, [5, 'KBBBBBBBBBBBBBBK']),
    row(30, [6, 'KBBWWWWWWWWWWWWK']),
    row(30, [7, 'KWWWWWWWWWWWWWWK']),
    row(30, [9, 'KKKKKKKKKKKKK']),
    row(30, [11, 'KKKKKKKKK'])
  ];

  /* 浮标（6×9） */
  var BOBBER = [
    row(6, [2, 'KK']),
    row(6, [2, 'RR']),
    row(6, [1, 'RRRR']),
    row(6, [1, 'RWWR']),
    row(6, [1, 'KWWWK']),
    row(6, [1, 'KWWWK']),
    row(6, [1, 'KRRWK']),
    row(6, [1, 'KRRWK']),
    row(6, [2, 'KKKK'])
  ];

  /* 木桶（14×14） */
  var BUCKET = [
    row(14, [3, 'KLLLK'], [9, 'KLLLK']),
    row(14, [2, 'KLLK'], [11, 'KLLK']),
    row(14, [2, 'KLLK'], [11, 'KLLK']),
    row(14, [1, 'KKKKKKKKKKKKK']),
    row(14, [2, 'KWMMMMMMMMWK']),
    row(14, [2, 'KTWWWWWWWWWK']),
    row(14, [2, 'KBBBBBBBBBBK']),
    row(14, [2, 'KBBBBBBBBBBK']),
    row(14, [3, 'KBBBBBBBBBBK']),
    row(14, [3, 'KBBBBBBBBBBK']),
    row(14, [4, 'KBBBBBBBBBBK']),
    row(14, [4, 'KBBBBBBBBBBK']),
    row(14, [5, 'KKKKKKKKK'])
  ];

  /* 睡莲叶（18×8，右侧有个缺口） */
  var LILY = [
    row(18, [6, 'KKKKKK']),
    row(18, [3, 'KGGGGGGGGK']),
    row(18, [2, 'KGGGGGGGGGGK']),
    row(18, [1, 'KGGGGGGGGGGGK']),
    row(18, [1, 'KGGGGGGGGGGG']),
    row(18, [2, 'KGGGGGGGGGGK']),
    row(18, [3, 'KGGGGGGGGK']),
    row(18, [6, 'KKKKKK'])
  ];

  /* 小荷花（7×6） */
  var FLOWER = [
    row(7, [1, 'RRRR']),
    row(7, [0, 'RRRRRR']),
    row(7, [0, 'RWWRRR']),
    row(7, [0, 'RRRRRR']),
    row(7, [1, 'RRRR']),
    row(7, [3, 'GG'])
  ];

  var M_BUCKET = { K: PAL.ink, L: PAL.brownL, M: PAL.steel, B: PAL.brown, T: PAL.tealL, W: PAL.white };
  var M_BOBBER = { K: PAL.ink, R: PAL.red, W: PAL.white };
  var M_LILY = { K: PAL.ink, G: PAL.mint, P: PAL.rose };
  var M_FLOWER = { R: PAL.roseL, W: PAL.butter, G: PAL.mintD };

  /* 三档稀有度的配色：常见=金黄、稀有=珊瑚、传说=奶金+金光 */
  var FISH_PAL = [
    { K: PAL.ink, B: PAL.butter, D: PAL.goldD, E: PAL.ink, G: PAL.white, W: PAL.white, F: PAL.gold },
    { K: PAL.ink, B: PAL.coralL, D: PAL.coral, E: PAL.ink, G: PAL.white, W: PAL.paper, F: PAL.coralD },
    { K: PAL.ink, B: PAL.butterL, D: PAL.gold, E: PAL.ink, G: PAL.white, W: PAL.white, F: PAL.goldD }
  ];
  var RARITY_ART = [BODY_SMALL, BODY_MED, BODY_BIG];
  var RARITY_TAIL_X = [12, 16, 22];   /* 身体右边缘（尾根） */

  /* ============================================================
   * 游戏主体
   * ============================================================ */
  function createGame(api) {
    var floats = [];      /* 浮标（鱼线） */
    var catches = [];     /* 跃出水面的鱼 */
    var pops = [];        /* 飘字 */
    var bubbles = [];     /* 空钩气泡 */
    var amb = [];         /* 水里的环境气泡 */
    var swimmers = [];    /* 水下背景鱼 */
    var droplets = [];    /* 水花 */
    var lilies = [];      /* 睡莲 */

    var patience = MAX_PATIENCE;
    var streak = 0;
    var combo = 1;
    var score = 0;
    var caught = 0;
    var tideT = 0;
    var tideTimer = 0;
    var timeLeft = TIME_LIMIT;
    var msg = '';
    var msgCn = '';
    var msgT = 0;
    var dead = false;
    var bell = 0;         /* 铃铛摆动能量 */
    var best = readBest();

    /* 背景鱼群：高低错落、大小不同 */
    var SCHOOL = [
      { x: 40, y: 130, sp: 9, s: 1 },
      { x: 150, y: 168, sp: -14, s: 1 },
      { x: 90, y: 206, sp: 18, s: 2 },
      { x: 250, y: 236, sp: -11, s: 1 }
    ];

    function readBest() {
      try {
        if (G.best) return G.best('fish') || 0;
      } catch (e) { /* 没有存档就当 0 分 */ }
      return 0;
    }

    /* ---------------- 初始化背景元素 ---------------- */
    (function init() {
      var i;
      for (i = 0; i < SCHOOL.length; i++) {
        swimmers.push({
          x: SCHOOL[i].x + api.rand(-10, 10),
          y: SCHOOL[i].y + api.rand(-4, 4),
          sp: SCHOOL[i].sp,
          s: SCHOOL[i].s,
          ph: api.rand(0, 6.28)
        });
      }
      for (i = 0; i < 5; i++) {
        lilies.push({
          x: api.rand(14, W - 14),
          y: api.rand(WATER_Y + 26, H - 22),
          s: api.chance(0.4) ? 2 : 1,
          ph: api.rand(0, 6.28),
          flower: i === 1
        });
      }
      for (i = 0; i < 16; i++) {
        amb.push({
          x: api.rand(4, W - 4),
          y: api.rand(WATER_Y + 4, H - 4),
          r: api.rand(1, 2.4),
          sp: api.rand(6, 16),
          ph: api.rand(0, 6.28)
        });
      }
    })();

    /* ---------------- 状态同步（中文提示走 HTML 层） ---------------- */
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

    /* 把中文提示也塞到 DOM（如果页面里有 #hs-game-msg） */
    function notify(doc, text) {
      try {
        if (!doc || !doc.getElementById) return;
        var el = doc.getElementById('hs-game-msg');
        if (!el && doc.querySelector) el = doc.querySelector('.hs-game-msg');
        if (el) el.textContent = text;
      } catch (e) { /* 没有 HTML 层也不影响游戏 */ }
    }

    function setMsg(text, cn, dur) {
      msg = text;
      msgCn = cn || '';
      msgT = dur || 1.6;
      syncState();
      notify(global.document, msgCn);
    }

    /* ---------------- 抛竿与结算 ---------------- */

    /* 掷一次鱼：返回稀有度下标，-1 表示空钩 */
    function rollFish() {
      var tide = tideT > 0;
      /* 先掷空钩：平时 25% 空钩，鱼潮时只有 15%（水暖鱼多，空军少了） */
      if (api.chance(tide ? 0.15 : 0.25)) return -1;
      var p = api.rand(0, 1);
      var edge1 = tide ? 0.45 : 0.70;     /* 常见 */
      var edge2 = tide ? 0.80 : 0.95;     /* 稀有 */
      if (p < edge1) return 0;
      if (p < edge2) return 1;
      return 2;                            /* 传说 */
    }

    function castAt(x, y) {
      if (floats.length >= MAX_FLOATS) return;   /* 线不够用了，先等等 */
      floats.push({
        x: x, y: y,
        t: 0,                                    /* 已经等了多久 */
        wait: api.rand(1.2, 2.5),                /* 这次要等多久 */
        anim: 0,
        state: 'wait'
      });
      api.sfx('splash');
      splashAt(x, WATER_Y + 2, 5);
    }

    /* 等待结束，判定这一竿的结果 */
    function resolve(f) {
      var r = rollFish();
      if (r >= 0) {
        streak++;                                  /* 连续钓到就叠倍率 */
        combo = Math.min(3, streak);               /* 倍率最多 3 倍 */
        var pts = Math.round(30 * combo * (r === 0 ? 1 : (r === 1 ? 2 : 4)));  /* 30/60/120 */
        score = api.addScore(pts);
        caught++;
        api.sfx('coin');
        api.sfx('bell');
        api.kick(3);
        api.puff(f.x, f.y, FISH_PAL[r].D, 10);
        bell = 1;
        f.state = 'fish';
        var sc = 3;
        var art = RARITY_ART[r];
        var c = {
          x: f.x, y: f.y, y0: f.y, r: r, t: 0, sc: sc,
          mx: f.x - (art[0].length * sc) / 2 + 2 * sc   /* 鱼嘴位置，鱼线挂这里 */
        };
        f.catch = c;
        catches.push(c);
        var label = (r === 0 ? 'COMMON' : (r === 1 ? 'RARE' : 'LEGEND')) + ' +' + pts;
        pops.push({ x: f.x, y: Math.max(56, f.y - 80), text: label, t: 0, c: r === 2 ? PAL.gold : PAL.butter });
        setMsg(label, '钓到了！' + (r === 0 ? '常见小蓝鱼' : (r === 1 ? '稀有珊瑚鱼' : '传说金鳞鱼')) +
          '（+' + pts + ' 分）', 1.6);
      } else {
        streak = 0;                             /* 空钩打断连击 */
        combo = 1;
        patience--;
        api.sfx('miss');
        bubbles.push({ x: f.x, y: f.y, t: 0 });
        pops.push({ x: f.x, y: f.y - 42, text: 'NO FISH', t: 0, c: PAL.paper3 });
        f.state = 'empty';
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

    /* ---------------- 水花 ---------------- */
    function splashAt(x, y, n) {
      for (var i = 0; i < n; i++) {
        var a2 = -Math.PI * 0.5 + api.rand(-1.1, 1.1);
        var sp = api.rand(20, 60);
        droplets.push({
          x: x, y: y,
          vx: Math.cos(a2) * sp,
          vy: Math.sin(a2) * sp,
          life: api.rand(0.3, 0.6), t: 0,
          c: PAL.skyL
        });
      }
    }

    /* ---------------- 每帧更新 ---------------- */
    function update(dt, t) {
      if (dead) {
        /* 结束后场景还在动，但不再计时 */
        updateEffects(dt);
        return;
      }
      /* 90 秒硬时限：时间到直接收工，保证一局一定会结束 */
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        gameOver('time');
        return;
      }
      if (msgT > 0) {                            /* 提示淡出 */
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
      if (bell > 0) bell = Math.max(0, bell - dt * 1.4);

      /* 浮标 */
      for (var i = floats.length - 1; i >= 0; i--) {
        var f = floats[i];
        f.t += dt;
        if (f.state === 'wait') {
          if (f.t >= f.wait) resolve(f);
        } else {
          f.anim += dt;
          if (f.state === 'empty' && f.anim > 0.9) floats.splice(i, 1);
        }
      }
      updateEffects(dt);
    }

    /* 特效（水花 / 气泡 / 飘字 / 跃鱼 / 背景鱼） */
    function updateEffects(dt) {
      /* 上浮的鱼 */
      for (var j = catches.length - 1; j >= 0; j--) {
        var c = catches[j];
        var py = c.y;
        c.t += dt;
        c.y = leapY(c);
        /* 破水瞬间溅起水花 */
        if (py > WATER_Y + 3 && c.y <= WATER_Y + 3) {
          for (var q = 0; q < 7; q++) {
            droplets.push({
              x: c.x + api.rand(-7, 7), y: WATER_Y + 3,
              vx: api.rand(-30, 30), vy: api.rand(-78, -30),
              t: 0, life: api.rand(0.3, 0.62), c: api.chance(0.5) ? PAL.skyL : PAL.white
            });
          }
        }
        if (c.t > 1.35) {
          catches.splice(j, 1);
          /* 鱼落水，浮标收线 */
          for (var k = floats.length - 1; k >= 0; k--) {
            if (floats[k].state === 'fish') { floats[k].state = 'empty'; floats[k].anim = 0; }
          }
        }
      }
      /* 空钩气泡 */
      for (var b = bubbles.length - 1; b >= 0; b--) {
        bubbles[b].t += dt;
        if (bubbles[b].t > 1.1) bubbles.splice(b, 1);
      }
      /* 飘字 */
      for (var p = pops.length - 1; p >= 0; p--) {
        pops[p].t += dt;
        pops[p].y -= 16 * dt;
        if (pops[p].t > 1.1) pops.splice(p, 1);
      }
      /* 水花 */
      for (var d = droplets.length - 1; d >= 0; d--) {
        var dp = droplets[d];
        dp.t += dt;
        dp.x += dp.vx * dt;
        dp.y += dp.vy * dt;
        dp.vy += 160 * dt;
        if (dp.t >= dp.life) droplets.splice(d, 1);
      }
      /* 环境气泡上浮 */
      for (var e = 0; e < amb.length; e++) {
        amb[e].y -= amb[e].sp * dt;
        if (amb[e].y < WATER_Y + 2) {
          amb[e].y = H - api.rand(1, 6);
          amb[e].x = api.rand(4, W - 4);
        }
      }
      /* 背景鱼游动 */
      for (var s = 0; s < swimmers.length; s++) {
        var sw = swimmers[s];
        sw.x += sw.sp * dt;
        sw.ph += dt * 6;
        if (sw.x > W + 24) sw.x = -24;
        if (sw.x < -24) sw.x = W + 24;
      }
      /* 鱼潮时水里会多一条鱼 */
      if (tideT > 0 && swimmers.length < 6) {
        swimmers.push({
          x: api.rand(-20, W),
          y: api.rand(WATER_Y + 20, H - 30),
          sp: api.rand(8, 18) * (api.chance(0.5) ? 1 : -1),
          s: api.chance(0.35) ? 2 : 1,
          ph: api.rand(0, 6.28)
        });
      }
    }

    /* 跃出水面的高度：先上浮到水面 -> 破水跃起 -> 落回原处 */
    function leapY(c) {
      var p = c.t;
      var surf = WATER_Y + 2;
      if (p < 0.42) {
        var u = p / 0.42;
        var e = 1 - (1 - u) * (1 - u);
        return c.y0 + (surf - c.y0) * e;
      }
      if (p < 0.82) {
        var u2 = (p - 0.42) / 0.4;
        return surf - Math.sin(u2 * Math.PI) * 38;
      }
      var u3 = Math.min(1, (p - 0.82) / 0.58);
      return surf + (c.y0 - surf) * u3 * u3;
    }

    /* ============================================================
     * 绘制
     * ============================================================ */
    function draw(ctx, a) {
      a = a || api;
      var t = a.time();
      var tide = tideT > 0;

      drawSky(ctx, a, t, tide);
      drawHills(ctx, a, t, tide);
      drawWater(ctx, a, t, tide);
      drawSwimmers(ctx, a, t);
      drawLilies(ctx, a, t);
      drawBoat(ctx, a, t);
      drawFloats(ctx, a, t);
      drawPier(ctx, a, t);
      drawRod(ctx, a, t);
      drawCatches(ctx, a, t);   /* 跃起的鱼画在鱼竿前面，避免被竿子挡住 */
      drawLines(ctx, a, t);
      drawReeds(ctx, a, t);
      drawDroplets(ctx, a);
      drawPops(ctx, a);
      drawHUD(ctx, a, t, tide);
      if (dead) drawOver(ctx, a);
    }

    /* ---------------- 天空 ---------------- */
    function drawSky(ctx, a, t, tide) {
      /* 天空一直画到水面，保证画面没有露底 */
      var rows = WATER_Y - TOPBAR;
      for (var i = 0; i < rows; i++) {
        var k = i / (rows - 1);
        var c;
        if (tide) {
          c = k < 0.45 ? a.mix(PAL.skyL, PAL.butterL, k / 0.45)
            : a.mix(PAL.butterL, PAL.goldL, (k - 0.45) / 0.55);
        } else {
          c = k < 0.42 ? a.mix(PAL.skyL, PAL.sky, k / 0.42)
            : (k < 0.78 ? a.mix(PAL.sky, PAL.peachL, (k - 0.42) / 0.36)
              : a.mix(PAL.peachL, PAL.peach, (k - 0.78) / 0.22));
        }
        a.rect(ctx, 0, TOPBAR + i, W, 1, c);
      }

      /* 夕阳 */
      var sx = 248, sy = 48;
      SPR.disc(ctx, sx, sy, 14, a.mix(PAL.butterL, PAL.paper, 0.55));
      SPR.disc(ctx, sx, sy, 10, PAL.butter);
      SPR.disc(ctx, sx - 3, sy - 3, 5, PAL.butterL);

      /* 流云 */
      var cw = 150;
      for (var i = 0; i < 3; i++) {
        var cx = ((t * (5 + i * 3) + i * 130) % (W + cw)) - cw / 2;
        var cy = 28 + i * 9;
        var col = tide ? PAL.paper2 : PAL.white;
        SPR.ellipseF(ctx, cx, cy, 16, 6, col);
        SPR.ellipseF(ctx, cx - 11, cy + 2, 9, 4, col);
        SPR.ellipseF(ctx, cx + 10, cy + 2, 11, 5, col);
        SPR.ellipseF(ctx, cx - 2, cy - 4, 8, 4, col);
      }

      /* 小鸟 */
      var bx = ((t * 9) % (W + 60)) - 30;
      bird(ctx, a, bx, 34, PAL.navy);
      bird(ctx, a, bx + 16, 27, PAL.navyD);
    }

    function bird(ctx, a, x, y, c) {
      a.px(ctx, x - 3, y, c);
      a.px(ctx, x - 2, y - 1, c);
      a.px(ctx, x - 1, y, c);
      a.px(ctx, x, y + 1, c);
      a.px(ctx, x + 1, y, c);
      a.px(ctx, x + 2, y - 1, c);
      a.px(ctx, x + 3, y, c);
    }

    /* ---------------- 远山 + 远岸 ---------------- */
    function drawHills(ctx, a, t, tide) {
      var far = tide ? PAL.plumD : PAL.tealD;
      var near = tide ? PAL.plum : PAL.teal;
      /* 最远的一层 */
      hill(ctx, a, 30, HILL_Y + 24, 150, 34, far);
      hill(ctx, a, 150, HILL_Y + 22, 140, 32, far);
      hill(ctx, a, 250, HILL_Y + 26, 160, 36, far);
      /* 近的一层（基座压到岸线，避免出现缝隙） */
      hill(ctx, a, -60, BANK_Y + 2, 200, 28, near);
      hill(ctx, a, 20, BANK_Y + 2, 200, 28, near);
      hill(ctx, a, 150, BANK_Y + 2, 200, 26, near);
      hill(ctx, a, 280, BANK_Y + 2, 200, 30, near);

      /* 远岸：草线 + 灌木 + 小树 */
      var bank = tide ? PAL.mintD : PAL.oliveD;
      a.rect(ctx, 0, BANK_Y, W, WATER_Y - BANK_Y, bank);
      a.rect(ctx, 0, BANK_Y, W, 2, tide ? PAL.mint : PAL.olive);
      for (var x = 0; x < W; x += 4) {
        var n = Math.sin(x * 12.9898 + 7) * 43758.5453;
        n = n - Math.floor(n);
        var hgt = 2 + Math.round(n * 5);
        a.rect(ctx, x, BANK_Y - hgt, 3, hgt, bank);
      }
      /* 岸上的小树 */
      tree(ctx, a, 52, BANK_Y, 12, tide ? PAL.mintD : PAL.oliveD);
      tree(ctx, a, 178, BANK_Y, 10, tide ? PAL.mintD : PAL.oliveD);
      tree(ctx, a, 292, BANK_Y, 13, tide ? PAL.mintD : PAL.oliveD);
      /* 水面与远岸的接缝（岸的倒影） */
      a.rect(ctx, 0, WATER_Y, W, 1, tide ? PAL.tealD : PAL.waterD);
    }

    function hill(ctx, a, bx, by, w, h, c) {
      for (var y = 0; y < h; y++) {
        var half = (w / 2) * (1 - y / h);
        var k = y / h;
        var col = c;
        a.rect(ctx, Math.round(bx + w / 2 - half), Math.round(by - y), Math.round(half * 2), 1, col);
        if (k < 0.35) {
          a.rect(ctx, Math.round(bx + w / 2 - half * 0.5), Math.round(by - y), Math.round(half), 1,
            a.mix(c, PAL.paper, 0.22));
        }
      }
    }

    function tree(ctx, a, x, y, h, c) {
      a.rect(ctx, x - 1, y - 3, 3, 4, PAL.brownD);
      a.rect(ctx, x - Math.round(h / 2), y - 3 - h, h, h, c);
      a.rect(ctx, x - Math.round(h / 3), y - 3 - h - 3, Math.round(h * 0.66), 3, c);
      a.rect(ctx, x - Math.round(h / 2) + 1, y - 3 - h, 2, h, a.mix(c, PAL.paper, 0.25));
    }

    /* ---------------- 水 ---------------- */
    function drawWater(ctx, a, t, tide) {
      var shallow = tide ? PAL.mint : PAL.waterL;
      var mid = tide ? PAL.teal : PAL.water;
      var deep = tide ? PAL.tealD : PAL.waterD;
      var foam = tide ? PAL.butterL : PAL.skyL;
      var h = H - WATER_Y;

      for (var i = 0; i < h; i++) {
        var k = i / (h - 1);
        var c;
        if (k < 0.28) c = a.mix(shallow, mid, k / 0.28);
        else c = a.mix(mid, deep, (k - 0.28) / 0.72);
        a.rect(ctx, 0, WATER_Y + i, W, 1, c);
      }

      /* 斜射光柱 */
      ctx.globalAlpha = tide ? 0.13 : 0.10;
      ctx.fillStyle = foam;
      for (var s = 0; s < 6; s++) {
        var bx = 18 + s * 52;
        var len = 54 + (s % 3) * 26;
        for (var y = 0; y < len; y++) {
          ctx.fillRect(Math.round(bx - y * 0.22), WATER_Y + y, 10 + (s % 2) * 4, 1);
        }
      }
      ctx.globalAlpha = 1;

      /* 动态波纹：几排错开的短横线，慢慢往右飘 */
      ctx.globalAlpha = 0.34;
      for (var row = 0; row < 7; row++) {
        var wy = WATER_Y + 8 + row * 15;
        if (wy > H - 4) break;
        var sp = 5 + row * 2.2;
        var off = (t * sp) % 26;
        for (var x = -26; x < W; x += 26) {
          var xx = Math.round(x + off);
          var len2 = 6 + ((row * 3) % 7);
          a.rect(ctx, xx, wy, len2, 1, foam);
          a.rect(ctx, xx + 13, wy + 3, 3, 1, foam);
        }
      }
      ctx.globalAlpha = 1;

      /* 环境气泡 */
      for (var b = 0; b < amb.length; b++) {
        var bb = amb[b];
        var bx2 = bb.x + Math.sin(t * 1.6 + bb.ph) * 3;
        ring(ctx, a, bx2, bb.y, bb.r, bb.r, a.mix(foam, deep, 0.35));
        if (bb.r > 1.6) a.px(ctx, Math.round(bx2 - 1), Math.round(bb.y - 1), foam);
      }

      /* 水面高光（起伏的亮线） */
      for (var wx = 0; wx < W; wx++) {
        var yy = WATER_Y + Math.round(Math.sin((wx + t * 26) * 0.085) * 1.4);
        a.px(ctx, wx, yy, foam);
        a.px(ctx, wx, yy + 1, a.mix(foam, deep, 0.45));
      }

      /* 夕阳在水面的倒影：一条抖动的碎金光 */
      var gx = 248;
      ctx.globalAlpha = 0.22;
      for (var gy = 3; gy < 76; gy++) {
        var wob = Math.sin(t * 2 + gy * 0.55) * (1.5 + gy * 0.13);
        var gw = 4 + Math.round(Math.abs(Math.sin(t * 1.7 + gy * 0.9)) * (4 + gy * 0.22));
        a.rect(ctx, Math.round(gx + wob - gw / 2), WATER_Y + gy, gw, 1, tide ? PAL.butterL : PAL.butter);
      }
      ctx.globalAlpha = 1;
    }

    /* 椭圆环 */
    function ring(ctx, a, cx, cy, rx, ry, c) {
      var steps = Math.max(10, Math.round(rx * 6));
      for (var i = 0; i <= steps; i++) {
        var ang = (i / steps) * Math.PI * 2;
        a.px(ctx, Math.round(cx + Math.cos(ang) * rx), Math.round(cy + Math.sin(ang) * ry), c);
      }
    }

    /* ---------------- 水下背景鱼 ---------------- */
    function drawSwimmers(ctx, a, t) {
      for (var s = 0; s < swimmers.length; s++) {
        var sw = swimmers[s];
        var bob = Math.round(Math.sin(sw.ph) * 1.5);
        /* 越深越暗，和水的渐变融在一起 */
        var depth = (sw.y - WATER_Y) / (H - WATER_Y);
        var body = a.mix(PAL.tealD, PAL.waterD, Math.max(0, Math.min(1, depth)) * 0.8);
        var map = {
          'K': PAL.navy,
          'F': body,
          'E': PAL.paper,
          'W': a.mix(body, PAL.paper, 0.35),
          'G': body
        };
        SPR.sprite(ctx, SPR.FISH, Math.round(sw.x), Math.round(sw.y + bob), map, sw.s, sw.sp < 0);
      }
    }

    /* ---------------- 睡莲 ---------------- */
    function drawLilies(ctx, a, t) {
      for (var i = 0; i < lilies.length; i++) {
        var l = lilies[i];
        var bob = Math.round(Math.sin(t * 1.3 + l.ph) * 1.2);
        SPR.sprite(ctx, LILY, Math.round(l.x - 9 * l.s), Math.round(l.y - 4 * l.s + bob), M_LILY, l.s);
        if (l.flower) {
          SPR.sprite(ctx, FLOWER, Math.round(l.x - 3), Math.round(l.y - 10 * l.s + bob), M_FLOWER, l.s);
        }
      }
    }

    /* ---------------- 远处的小船 ---------------- */
    function drawBoat(ctx, a, t) {
      var bob = Math.round(Math.sin(t * 1.1) * 1);
      SPR.sprite(ctx, SPR.BOAT, 244, 84 + bob, SPR.MAP.boat, 1);
      /* 船上的小小人影 */
      a.rect(ctx, 252, 74 + bob, 4, 10, PAL.coral);
      a.rect(ctx, 252, 70 + bob, 4, 4, PAL.peach);
    }

    /* ---------------- 跃出水面的鱼 ---------------- */
    function drawCatches(ctx, a, t) {
      for (var i = 0; i < catches.length; i++) {
        var c = catches[i];
        var art = RARITY_ART[c.r];
        var map = FISH_PAL[c.r];
        var sc = c.sc || 3;
        var w = art[0].length * sc;
        var h = art.length * sc;
        var wig = t * 10 + c.t * 6;
        var x = Math.round(c.x - w / 2);
        var y = Math.round(c.y - h / 2);
        var alpha = c.t > 1.0 ? Math.max(0, 1 - (c.t - 1.0) / 0.35) : 1;

        ctx.globalAlpha = alpha;
        /* 尾巴：三角，随时间摆 */
        var ax = x + RARITY_TAIL_X[c.r] * sc;
        var ay = y + h * 0.5;
        var sw = Math.sin(wig) * 1.2 * sc;
        a.tri(ctx, ax, ay - h * 0.30, ax + 7 * sc, ay - h * 0.58 + sw, ax + 7 * sc, ay + h * 0.34 + sw, map.F);
        a.tri(ctx, ax, ay - h * 0.10, ax + 5 * sc, ay - h * 0.40 + sw, ax + 5 * sc, ay + h * 0.24 + sw, map.D);
        /* 身体 */
        SPR.sprite(ctx, art, x, y, map, sc);
        ctx.globalAlpha = 1;

        /* 水下部分染上水色（淡淡的，别把鱼的颜色吃掉） */
        var top = y;
        if (y + h > WATER_Y) {
          ctx.globalAlpha = 0.2;
          a.rect(ctx, x - 2, Math.max(top, WATER_Y), w + 4, y + h - Math.max(top, WATER_Y), PAL.water);
          ctx.globalAlpha = 1;
        }
        /* 传说鱼的金光 */
        if (c.r === 2) {
          ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 12);
          for (var s = 0; s < 4; s++) {
            var ang = t * 3 + s * 1.57;
            a.px(ctx, Math.round(c.x + Math.cos(ang) * (w / 2 + 6)),
              Math.round(c.y + Math.sin(ang) * (h / 2 + 4)), PAL.butterL);
          }
          ctx.globalAlpha = 1;
        }
      }
    }

    /* ---------------- 浮标 + 涟漪 ---------------- */
    function drawFloats(ctx, a, t) {
      for (var q = 0; q < floats.length; q++) {
        var ff = floats[q];
        if (ff.state === 'fish') continue;         /* 鱼在跃，鱼线跟着鱼 */
        var bob = Math.round(Math.sin(t * 6 + ff.x * 0.3) * 1.4);
        var fy = ff.y + bob;
        /* 涟漪 */
        var rp = (ff.t * 0.7) % 1;
        ring(ctx, a, ff.x, fy + 3, 3 + Math.round(rp * 8), 1 + Math.round(rp * 2.4),
          a.mix(PAL.skyL, PAL.water, 0.45));
        ring(ctx, a, ff.x, fy + 3, 2 + Math.round(rp * 4), 1, PAL.skyL);
        /* 浮标本体 */
        SPR.sprite(ctx, BOBBER, Math.round(ff.x - 6), Math.round(fy - 16), M_BOBBER, 2);
      }
    }

    /* ---------------- 木栈道（前景） ---------------- */
    function drawPier(ctx, a, t) {
      var P = PAL;
      /* 栈道在水里的影子 */
      ctx.globalAlpha = 0.25;
      a.rect(ctx, 0, PIER_Y + 6, PIER_X1 + 10, 12, P.navyD);
      ctx.globalAlpha = 1;

      /* 桩子（先画，被台面压住） */
      var posts = [8, 62, 116, 148];
      for (var i = 0; i < posts.length; i++) {
        var px = posts[i];
        a.rect(ctx, px, PIER_Y + 4, 9, H - PIER_Y - 4, P.brownD);
        a.rect(ctx, px, PIER_Y + 4, 3, H - PIER_Y - 4, P.brown);
        a.rect(ctx, px + 7, PIER_Y + 4, 2, H - PIER_Y - 4, P.inkSoft);
        /* 水位线附近的苔藓 */
        a.rect(ctx, px, PIER_Y + 44, 9, 3, P.mintD);
      }

      /* 台面：侧视的木板 */
      a.rect(ctx, 0, PIER_Y, PIER_X1, 2, P.brownL);      /* 受光的板面 */
      a.rect(ctx, 0, PIER_Y + 2, PIER_X1, 5, P.brown);    /* 板身 */
      a.rect(ctx, 0, PIER_Y + 7, PIER_X1, 3, P.brownD);   /* 板底阴影 */
      /* 板缝 */
      for (var x = 12; x < PIER_X1; x += 22) {
        a.rect(ctx, x, PIER_Y, 2, 7, P.brownD);
        a.rect(ctx, x, PIER_Y, 1, 2, P.brownL);
      }
      /* 前梁 */
      a.rect(ctx, 0, PIER_Y + 10, PIER_X1, 4, P.brownD);
      a.rect(ctx, 0, PIER_Y + 10, PIER_X1, 1, P.brown);

      /* 台面上的东西 */
      SPR.sprite(ctx, BUCKET, 16, PIER_Y - 14, M_BUCKET, 1);     /* 木桶 */
      SPR.sprite(ctx, SPR.CUP, 38, PIER_Y - 16, SPR.MAP.cup, 1); /* 马克杯 */
      SPR.sprite(ctx, SPR.CAT, 56, PIER_Y - 16, SPR.MAP.cat, 1); /* 猫 */

      /* 小铃铛：挂在一根木桩上，钓到鱼会晃 */
      a.rect(ctx, 86, PIER_Y - 34, 4, 34, P.brownD);
      a.rect(ctx, 86, PIER_Y - 34, 1, 34, P.brown);
      a.rect(ctx, 84, PIER_Y - 38, 8, 4, P.brown);
      var sw = Math.sin(t * 6) * (bell > 0 ? 4 * bell : 0.6);
      var bx = 86 + sw;
      a.line(ctx, 86, PIER_Y - 36, bx, PIER_Y - 30, P.ink);
      SPR.sprite(ctx, SPR.BELL, Math.round(bx - 6), PIER_Y - 30, SPR.MAP.bell, 1);

      /* 告示：贴在桩子上 */
      SPR.sprite(ctx, SPR.PAPER, 96, PIER_Y - 16, SPR.MAP.paper, 1);

      /* 钓鱼的同事 */
      SPR.sprite(ctx, SPR.WORKER, 104, PIER_Y - 48, SPR.MAP.worker, 2);
    }

    /* ---------------- 鱼竿 ---------------- */
    function drawRod(ctx, a, t) {
      var P = PAL;
      var x0 = ROD_BUTT_X, y0 = ROD_BUTT_Y;
      var x1 = ROD_TIP_X, y1 = ROD_TIP_Y;
      var mx = x0 + (x1 - x0) * 0.42, my = y0 + (y1 - y0) * 0.42;
      var dx = x1 - x0, dy = y1 - y0;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / len, ny = dx / len;
      /* 细竿梢 */
      a.line(ctx, mx, my, x1, y1, P.brownD);
      /* 粗竿身（三条平行线做出圆柱感） */
      a.line(ctx, x0, y0, mx, my, P.brown);
      a.line(ctx, x0 + nx, y0 + ny, mx + nx, my + ny, P.brownD);
      a.line(ctx, x0 - nx, y0 - ny, mx - nx, my - ny, P.brownL);
      /* 握把 */
      a.rect(ctx, x0 - 5, y0 - 3, 11, 7, P.ink);
      a.rect(ctx, x0 - 4, y0 - 2, 9, 5, P.brownL);
      a.rect(ctx, x0 - 4, y0 - 2, 9, 1, P.paper2);
      /* 轮子 */
      a.circle(ctx, x0 + 5, y0 + 9, 5, P.ink);
      a.circle(ctx, x0 + 5, y0 + 9, 3, P.steel);
      a.px(ctx, x0 + 5, y0 + 9, P.steelL);
      a.px(ctx, x0 + 7, y0 + 7, P.steelL);
      /* 竿梢导环 */
      a.px(ctx, x1, y1, P.ink);
      a.px(ctx, x1 + 1, y1 + 1, P.ink);
    }

    /* ---------------- 前景水草（右下角） ---------------- */
    function drawReeds(ctx, a, t) {
      var P = PAL;
      var reeds = [
        { x: 258, h: 58 },
        { x: 270, h: 86 },
        { x: 282, h: 48 },
        { x: 296, h: 72 },
        { x: 309, h: 56 },
        { x: 320, h: 92 }
      ];
      for (var i = 0; i < reeds.length; i++) {
        var r = reeds[i];
        var sway = Math.sin(t * 1.1 + i * 1.3) * 3;
        var tipx = r.x + sway, tipy = H - r.h;
        /* 叶子 */
        a.line(ctx, r.x, H, r.x - 9 + sway * 0.5, H - r.h * 0.42, P.tealD);
        a.line(ctx, r.x, H, r.x + 8 + sway * 0.4, H - r.h * 0.34, P.tealD);
        /* 茎 */
        a.line(ctx, r.x, H, tipx, tipy, P.tealD);
        a.px(ctx, Math.round(tipx), Math.round(tipy), P.mintD);
        /* 蒲棒 */
        a.rect(ctx, Math.round(tipx) - 2, Math.round(tipy) - 2, 4, 10, P.brownD);
        a.rect(ctx, Math.round(tipx) - 2, Math.round(tipy) - 2, 4, 2, P.brown);
        a.rect(ctx, Math.round(tipx) - 2, Math.round(tipy) + 4, 4, 1, P.brownL);
      }
    }

    /* ---------------- 鱼线 ---------------- */
    function drawLines(ctx, a, t) {
      for (var i = 0; i < floats.length; i++) {
        var f = floats[i];
        var x1 = f.x, y1 = f.y - 6;
        if (f.state === 'fish' && f.catch) {
          /* 线跟着鱼走，挂在鱼嘴上 */
          x1 = f.catch.mx; y1 = f.catch.y;
        }
        sagLine(ctx, a, ROD_TIP_X, ROD_TIP_Y, x1, y1, PAL.paper);
      }
    }

    function sagLine(ctx, a, x0, y0, x1, y1, c) {
      var dx = x1 - x0, dy = y1 - y0;
      var len = Math.sqrt(dx * dx + dy * dy);
      var sag = Math.min(16, len * 0.07);
      var steps = 14;
      var px = x0, py = y0;
      ctx.globalAlpha = 0.8;
      for (var i = 1; i <= steps; i++) {
        var u = i / steps;
        var nx = x0 + dx * u;
        var ny = y0 + dy * u + Math.sin(u * Math.PI) * sag;
        a.line(ctx, px, py, nx, ny, c);
        px = nx; py = ny;
      }
      ctx.globalAlpha = 1;
    }

    /* ---------------- 水花粒子 ---------------- */
    function drawDroplets(ctx, a) {
      for (var i = 0; i < droplets.length; i++) {
        var d = droplets[i];
        a.px(ctx, Math.round(d.x), Math.round(d.y), d.c);
      }
    }

    /* ---------------- 飘字 ---------------- */
    function drawPops(ctx, a) {
      for (var i = 0; i < pops.length; i++) {
        var p = pops[i];
        var tw = a.textWidth(p.text, 2);
        var x = Math.max(4, Math.min(W - tw - 12, p.x - tw / 2));
        var y = Math.round(p.y);
        ctx.globalAlpha = 0.85;
        a.rect(ctx, x - 5, y - 4, tw + 10, 18, PAL.ink);
        ctx.globalAlpha = 1;
        a.rect(ctx, x - 5, y - 4, tw + 10, 1, PAL.inkSoft);
        a.text(p.text, x, y, p.c, 2);
      }
    }

    /* ---------------- HUD ---------------- */
    function drawHUD(ctx, a, t, tide) {
      var P = PAL;
      /* 顶部状态条：SCORE + TIME（内核画的） */
      a.statusBar({ score: score, time: timeLeft });

      /* 左上木牌：耐心值 + 最高分 */
      a.roundRect(ctx, PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 3, P.brownD);
      a.roundRect(ctx, PANEL_X + 1, PANEL_Y + 1, PANEL_W - 2, PANEL_H - 3, 3, P.paper2);
      a.rect(ctx, PANEL_X + 3, PANEL_Y + 1, PANEL_W - 6, 1, P.paper);
      a.text('PATIENCE', PANEL_X + 5, PANEL_Y + 4, P.inkSoft, 1);
      a.text('BEST', PANEL_X + 100, PANEL_Y + 4, P.inkSoft, 1);
      for (var h = 0; h < MAX_PATIENCE; h++) {
        heart(ctx, a, PANEL_X + 5 + h * 9, PANEL_Y + 14, h < patience ? P.coral : P.grayD);
      }
      var bv = String(best);
      a.text(bv, PANEL_X + PANEL_W - 6 - a.textWidth(bv, 1), PANEL_Y + 14, P.ink, 1);

      /* 连击倍率徽章 */
      if (combo > 1) {
        var cv = 'X' + combo;
        var cw = a.textWidth(cv, 2) + 12;
        a.rect(ctx, COMBO_X, COMBO_Y, cw, 20, P.coralD);
        a.rect(ctx, COMBO_X, COMBO_Y, cw, 1, P.coral);
        a.text(cv, COMBO_X + 6, COMBO_Y + 5, P.white, 2);
      }

      /* 鱼潮横幅 */
      if (tide) {
        var blink = Math.sin(t * 7) > -0.4;
        a.roundRect(ctx, TIDE_X, TIDE_Y, TIDE_W, TIDE_H, 3, blink ? P.butter : P.butterL);
        a.roundRect(ctx, TIDE_X + 1, TIDE_Y + 1, TIDE_W - 2, TIDE_H - 3, 3, blink ? P.goldL : P.paper);
        a.frame(ctx, TIDE_X, TIDE_Y, TIDE_W, TIDE_H, P.goldD);
        a.text('TIDE!', TIDE_X + (TIDE_W - a.textWidth('TIDE!', 2)) / 2, TIDE_Y + 5, P.plumD, 2);
        /* 横幅两侧的小水波（画在横幅内，避免出界） */
        waveMark(ctx, a, TIDE_X + 6, TIDE_Y + 12, P.goldD);
        waveMark(ctx, a, TIDE_X + TIDE_W - 11, TIDE_Y + 12, P.goldD);
      }
    }

    function waveMark(ctx, a, x, y, c) {
      a.px(ctx, x, y, c);
      a.px(ctx, x + 1, y - 1, c);
      a.px(ctx, x + 2, y, c);
      a.px(ctx, x + 3, y - 1, c);
      a.px(ctx, x + 4, y, c);
    }

    /* 7×6 的小心心 */
    function heart(ctx, a, x, y, col) {
      a.rect(ctx, x + 1, y, 2, 1, col);
      a.rect(ctx, x + 4, y, 2, 1, col);
      a.rect(ctx, x, y + 1, 7, 2, col);
      a.rect(ctx, x + 1, y + 3, 5, 1, col);
      a.rect(ctx, x + 2, y + 4, 3, 1, col);
      a.rect(ctx, x + 3, y + 5, 1, 1, col);
    }

    /* ---------------- 结束横幅 ---------------- */
    function drawOver(ctx, a) {
      var P = PAL;
      var bw = 210, bh = 84;
      var bx = (W - bw) / 2, by = 56;
      ctx.globalAlpha = 0.93;
      a.rect(ctx, bx, by, bw, bh, P.ink);
      ctx.globalAlpha = 1;
      a.frame(ctx, bx, by, bw, bh, P.paper3);
      a.rect(ctx, bx + 2, by + 2, bw - 4, 1, P.inkSoft);
      var title = timeLeft <= 0 ? 'TIME UP' : 'NO PATIENCE';
      a.text(title, bx + (bw - a.textWidth(title, 2)) / 2, by + 12, P.coral, 2);
      var s1 = 'SCORE ' + score;
      a.text(s1, bx + (bw - a.textWidth(s1, 2)) / 2, by + 36, P.butter, 2);
      var s2 = 'FISH ' + caught + '   BEST ' + best;
      a.text(s2, bx + (bw - a.textWidth(s2, 1)) / 2, by + 60, P.paper3, 1);
    }

    /* ---------------- 鼠标 / 触摸 ---------------- */
    function pointer(type, x, y, e) {
      if (type !== 'down' || dead) return;
      if (y < WATER_Y + 4) return;                /* 天空里钓不到鱼 */
      castAt(Math.max(6, Math.min(W - 6, Math.round(x))),
        Math.max(WATER_Y + 6, Math.min(H - 16, Math.round(y))));
    }

    /* ---------------- 键盘 ---------------- */
    function key(k, e) {
      if (dead) return;
      if (k === ' ' || k === 'Spacebar' || k === 'Enter') {
        castAt(api.randInt(24, W - 24), api.randInt(WATER_Y + 16, H - 30));  /* 盲抛一竿 */
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
  G.register({
    id: 'fish',
    title: '摸鱼钓鱼',
    tagline: '在工位边的小船上抛竿，什么也不干，只等鱼。',
    howto: '点水面抛竿，浮标会晃一会儿：钓到鱼就加分，连续钓到会有 1/2/3 倍加成；没钓到会掉一点耐心值（共 10 点），耐心耗尽就收工。一局 90 秒，时间到也会自动结算。每 20 秒会来一次稀有鱼潮，水会变色，这时候更容易钓到稀有鱼和传说鱼。键盘：Enter / 空格盲抛一竿。',
    emoji: '🎣',
    accent: '#8cc7e6',
    width: W,
    height: H,
    create: createGame
  });
})(typeof window !== 'undefined' ? window : this);
