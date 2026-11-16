/* ============================================================
 * 打工人急救站 · 摸鱼游戏厅 · 《撤回消息》
 * ------------------------------------------------------------
 * 玩法：模拟工作群聊，消息一条条从底部浮上来。
 *       带着红色倒计时条的，是必须赶紧撤掉的工作消息：
 *       在倒计时走完之前点中它 = 撤回成功，加分，连击还有加成；
 *       倒计时走完还没撤 = 老板看见了，扣一颗心，屏幕闪一下。
 *       灰色气泡是同事发来的好消息（下午茶之类），不用撤回，
 *       点它反而扣分掉心 —— 靠「颜色」和「有没有倒计时条」分清楚。
 *       3 颗心，90 秒硬时限，到点或心耗尽就结算。
 *
 * 操作：鼠标/手指点气泡；键盘左右方向键在候选气泡之间切换选中框，
 *       Enter / 空格撤回选中的那一条。
 *
 * 文本规则：画布上只画像素字库有的 ASCII（大写字母/数字/少量符号），
 *          中文提示全部通过 api.state({ message: '…' }) 交给 HTML 层。
 * ============================================================ */
(function (global) {
  'use strict';

  var G = global.HS_GAMES;
  if (!G) return;
  var PAL = G.PAL;

  /* ---------------- 画布与布局 ---------------- */
  var W = 320, H = 288;
  var TOPBAR = 18;                  /* 顶部状态条（内核画，别占） */
  var HEADER_H = 26;                /* 群名条高度 */
  var LIST_TOP = TOPBAR + HEADER_H; /* 44：聊天列表上沿 */
  var LIST_BOTTOM = 272;            /* 聊天列表下沿 */
  var SLOT_H = 44;                  /* 每条消息占的行高 */
  var AVATAR_X = 12, AVATAR_SZ = 16;
  var BUBBLE_X = 34, BUBBLE_H = 24;
  var BAR_H = 5, BAR_DY = 1;        /* 倒计时条的位置与厚度（紧贴气泡下方） */

  /* ---------------- 玩法参数 ---------------- */
  var TIME_LIMIT = 90;
  var MAX_HEARTS = 3;
  var MAX_SLOTS = 7;                /* 最多同时在场的气泡（最上面那个会滑出屏幕） */
  var BASE_SCORE = 10;              /* 撤回的基础分 */
  var QUICK_BONUS = 5;              /* 剩下一半以上时间就撤掉的奖励 */
  var FRIEND_CHANCE = 0.18;         /* 友好消息（不用撤回）的出现概率 */
  var WRONG_PENALTY = 10;           /* 点错友好消息扣的分 */
  var FRIEND_LIFE = 13;             /* 友好消息最多挂多久（超时只是沉底，不扣分） */

  /* 群里的几个人（头像用字母，颜色各不相同） */
  var SENDERS = [
    { ch: 'A', c: PAL.rose, d: PAL.roseD },
    { ch: 'B', c: PAL.teal, d: PAL.tealD },
    { ch: 'C', c: PAL.gold, d: PAL.goldD },
    { ch: 'D', c: PAL.lilac, d: PAL.lilacD },
    { ch: 'E', c: PAL.mint, d: PAL.mintD }
  ];

  /* 要撤回的消息（语气急） */
  var HOT_WORDS = ['URGENT?', 'MEETING?', 'REPORT?', 'OOPS', 'ASAP?', 'HELP?', 'ERROR!', 'SORRY!', 'REPLY?'];
  /* 不用撤回的好消息（灰气泡） */
  var NICE_WORDS = ['TEA?', 'LUNCH?', 'LOL', 'THANKS!', 'OK', 'BYE?', 'COFFEE?', 'NICE!'];

  /* ============================================================
   * 游戏主体
   * ============================================================ */
  function createGame(api) {
    var msgs = [];      /* 在场的气泡：msgs[0] 最新（最靠近底部） */
    var ghosts = [];    /* 正在消失的气泡（撤回 / 被看见） */
    var pops = [];      /* 飘起来的分数 */
    var hearts = MAX_HEARTS;
    var combo = 0;      /* 连击数 */
    var recalled = 0;   /* 一共撤回了多少条 */
    var spawnTimer = 0.5;
    var spawnCount = 0;
    var sel = 0;        /* 键盘选中的气泡下标 */
    var flash = 0;      /* 屏幕闪红 */
    var msg = '';       /* 画布上的 ASCII 提示 */
    var msgCn = '';     /* 交给 HTML 层的中文提示 */
    var msgColor = PAL.ink;
    var msgT = 0;
    var timeLeft = TIME_LIMIT;
    var dead = false;
    var best = readBest();

    function readBest() {
      try {
        if (G.best) return G.best('recall') || 0;
      } catch (e) { /* 没有存档就当 0 分 */ }
      return 0;
    }

    /* 把状态推给 HTML 层（中文提示也走这里） */
    function syncState() {
      api.state({
        score: api.getScore(),
        best: best,
        hearts: hearts,
        combo: combo,
        recalled: recalled,
        time: Math.ceil(timeLeft),
        message: msgCn,
        color: msgColor
      });
    }

    /* 画布上的 ASCII 提示 + HTML 层的中文提示 */
    function say(ascii, cn, dur, color) {
      msg = ascii || '';
      msgCn = cn || '';
      msgColor = color || PAL.ink;
      msgT = dur || 1.5;
      syncState();
    }

    /* ---------------- 气泡尺寸 ---------------- */
    function bubbleW(m) {
      return api.textWidth(m.text, 2) + 14;
    }

    /* ---------------- 生成一条新消息 ---------------- */
    function spawn() {
      spawnCount++;
      /* 第三条固定是友好消息：早点教会玩家「灰的不用撤」 */
      var friendly = (spawnCount === 3) || api.chance(FRIEND_CHANCE);
      var words = friendly ? NICE_WORDS : HOT_WORDS;
      var elapsed = TIME_LIMIT - timeLeft;
      /* 越到后面越短越密：8.0 秒 → 4.5 秒，间隔 1.7 秒 → 1.0 秒 */
      var total = friendly ? 0 : (8.0 - (elapsed / TIME_LIMIT) * 3.5);
      var m = {
        kind: friendly ? 'friendly' : 'recall',
        text: api.pick(words),
        sender: api.randInt(0, SENDERS.length - 1),
        total: total,
        left: total,
        age: 0,
        y: LIST_BOTTOM + 24,        /* 从画面下方浮上来 */
        ty: LIST_BOTTOM - SLOT_H    /* 第 0 槽的位置 */
      };
      msgs.unshift(m);
      /* 原来在下面的几条整体上浮一格 */
      for (var i = 1; i < msgs.length; i++) msgs[i].ty -= SLOT_H;
      if (sel >= msgs.length) sel = msgs.length - 1;
    }

    /* 下一条消息多久后冒出来（越到后面越密） */
    function spawnGap() {
      var elapsed = TIME_LIMIT - timeLeft;
      var gap = 1.7 - (elapsed / TIME_LIMIT) * 0.7;
      return gap * api.rand(0.8, 1.25);
    }

    /* ---------------- 删除一条消息（在场的其余消息顺势归位） ---------------- */
    function removeMsg(m) {
      var idx = -1;
      for (var i = 0; i < msgs.length; i++) {
        if (msgs[i] === m) { idx = i; break; }
      }
      if (idx < 0) return;
      msgs.splice(idx, 1);
      /* 它下面的（更旧的）几条往下挪一格 */
      for (var j = idx; j < msgs.length; j++) msgs[j].ty += SLOT_H;
      if (sel >= msgs.length) sel = msgs.length - 1;
      if (sel < 0) sel = 0;
    }

    /* ---------------- 撤回成功 ---------------- */
    function doRecall(m) {
      if (m.kind === 'friendly') { punishFriendly(m); return; }
      combo += 1;
      /* 连击加成封顶 4 倍，免得分数爆掉 */
      var mult = Math.min(4, 1 + Math.floor(combo / 3));
      var gain = BASE_SCORE * mult;
      var quick = m.total > 0 && (m.left / m.total) > 0.55;
      if (quick) gain += QUICK_BONUS;
      api.addScore(gain);
      recalled += 1;
      api.sfx('pop');
      api.sfx('coin');
      api.kick(3);
      api.puff(BUBBLE_X + bubbleW(m) / 2, Math.round(m.y) + BUBBLE_H / 2, PAL.coralL, 12);
      addGhost(m, 'recalled');
      removeMsg(m);
      pops.push({
        x: Math.round(BUBBLE_X + bubbleW(m) / 2 - api.textWidth('+' + gain, 2) / 2),
        y: Math.round(m.y) - 4,
        text: '+' + gain,
        t: 0,
        c: PAL.butter
      });
      var cn = '撤回成功！+' + gain + ' 分';
      if (quick) cn = '手速飞快，撤回成功！+' + gain + ' 分';
      else if (combo >= 3) cn = '连击 ×' + mult + '！撤回成功 +' + gain + ' 分';
      say('+' + gain + (quick ? ' FAST' : ''), cn, 1.5, PAL.butter);
      syncState();
    }

    /* ---------------- 点错了友好消息 ---------------- */
    function punishFriendly(m) {
      hearts -= 1;
      combo = 0;
      if (api.getScore() >= WRONG_PENALTY) api.addScore(-WRONG_PENALTY);
      api.sfx('miss');
      api.kick(6);
      flash = 0.7;
      api.puff(BUBBLE_X + bubbleW(m) / 2, Math.round(m.y) + BUBBLE_H / 2, PAL.grayD, 12);
      addGhost(m, 'wrong');
      removeMsg(m);
      say('OOPS!', '这是同事的好消息，乱撤要扣分的！', 1.7, PAL.coralD);
      if (hearts <= 0) gameOver('hearts');
      syncState();
    }

    /* ---------------- 倒计时走完：老板看见了 ---------------- */
    function onTimeout(m) {
      hearts -= 1;
      combo = 0;
      api.sfx('miss');
      api.kick(5);
      flash = 0.7;
      api.puff(BUBBLE_X + bubbleW(m) / 2, Math.round(m.y) + BUBBLE_H / 2, PAL.red, 14);
      addGhost(m, 'seen');
      removeMsg(m);
      say('SEEN!', '老板看见这条消息了，扣一颗心！', 1.7, PAL.red);
      if (hearts <= 0) gameOver('hearts');
      syncState();
    }

    /* ---------------- 气泡碎掉的残影 ---------------- */
    function addGhost(m, mode) {
      var w = bubbleW(m);
      var g = {
        x: BUBBLE_X, y: Math.round(m.y), w: w, h: BUBBLE_H,
        mode: mode, t: 0, life: mode === 'seen' ? 0.7 : 0.6,
        shards: []
      };
      for (var i = 0; i < 10; i++) {
        var a = (i / 10) * Math.PI * 2 + api.rand(-0.3, 0.3);
        var sp = api.rand(24, 70);
        g.shards.push({
          x: g.x + w / 2, y: g.y + BUBBLE_H / 2,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 18,
          c: (mode === 'seen') ? PAL.red : (mode === 'wrong' ? PAL.grayD : PAL.coralL)
        });
      }
      ghosts.push(g);
    }

    /* ---------------- 结束 ---------------- */
    function gameOver(reason) {
      if (dead) return;
      dead = true;
      api.sfx('over');
      if (reason === 'time') api.end('90 秒到了，一共撤回了 ' + recalled + ' 条消息');
      else api.end('被老板抓到 ' + MAX_HEARTS + ' 次，只撤回了 ' + recalled + ' 条消息');
      syncState();
    }

    /* ============================================================
     * 每帧更新
     * ============================================================ */
    function update(dt, t) {
      if (msgT > 0) {
        msgT -= dt;
        if (msgT <= 0) { msg = ''; msgCn = ''; syncState(); }
      }
      if (flash > 0) flash = Math.max(0, flash - dt * 1.8);
      updateEffects(dt);
      if (dead) return;

      /* 90 秒硬时限：时间到直接收工，保证一局一定会结束 */
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        gameOver('time');
        return;
      }

      /* 冒新消息 */
      spawnTimer -= dt;
      if (spawnTimer <= 0 && msgs.length < MAX_SLOTS + 2) {
        spawnTimer = spawnGap();
        spawn();
      }

      for (var i = msgs.length - 1; i >= 0; i--) {
        var m = msgs[i];
        /* 平滑地浮到自己的位置 */
        m.y += (m.ty - m.y) * Math.min(1, dt * 13);
        /* 滑出屏幕顶端的旧消息直接退休 */
        if (m.y + BUBBLE_H < LIST_TOP) {
          removeMsg(m);
          continue;
        }
        m.age += dt;
        if (m.kind === 'recall') {
          m.left -= dt;
          if (m.left <= 0) {
            m.left = 0;
            onTimeout(m);
          }
        } else if (m.age > FRIEND_LIFE) {
          /* 友好消息没人理，半天就被新消息顶上去了（不扣分） */
          removeMsg(m);
          continue;
        }
      }
    }

    /* 特效（残影 / 飘分） */
    function updateEffects(dt) {
      for (var i = ghosts.length - 1; i >= 0; i--) {
        var g = ghosts[i];
        g.t += dt;
        for (var s = 0; s < g.shards.length; s++) {
          var sh = g.shards[s];
          sh.x += sh.vx * dt;
          sh.y += sh.vy * dt;
          sh.vy += 120 * dt;
        }
        if (g.t >= g.life) ghosts.splice(i, 1);
      }
      for (var p = pops.length - 1; p >= 0; p--) {
        pops[p].t += dt;
        pops[p].y -= 16 * dt;
        if (pops[p].t > 0.9) pops.splice(p, 1);
      }
    }

    /* ============================================================
     * 绘制
     * ============================================================ */
    function draw(ctx) {
      var t = api.time();
      drawListBg(ctx);
      /* 旧消息先画，新的压在上面 */
      for (var i = msgs.length - 1; i >= 0; i--) drawMsg(ctx, msgs[i], t);
      drawGhosts(ctx);
      drawPops(ctx);
      drawCombo(ctx);
      drawToast(ctx);
      drawHeader(ctx);
      drawHint(ctx);
      /* 顶部状态条由内核统一绘制（SCORE / TIME / 心） */
      api.statusBar({ score: api.getScore(), time: timeLeft, hearts: hearts, maxHearts: MAX_HEARTS });
      if (flash > 0) {
        ctx.fillStyle = 'rgba(217,79,79,' + (flash * 0.34).toFixed(2) + ')';
        ctx.fillRect(0, 0, W, H);
      }
      if (dead) drawOver(ctx);
    }

    /* 聊天列表背景：浅灰蓝的渐变 + 一点点噪点 */
    function drawListBg(ctx) {
      var h = LIST_BOTTOM - LIST_TOP;
      api.gradV(ctx, 0, LIST_TOP, W, h,
        api.mix(PAL.grayL, PAL.white, 0.45),
        api.mix(PAL.grayL, PAL.white, 0.72));
      /* 底部输入区的浅影 */
      api.gradV(ctx, 0, LIST_BOTTOM - 18, W, 18,
        api.mix(PAL.grayL, PAL.white, 0.72),
        api.mix(PAL.grayL, PAL.white, 0.42));
      /* 空状态：右上角挂一张置顶公告 */
      drawPinned(ctx);
      /* 噪点，避免大片纯色 */
      for (var i = 0; i < 90; i++) {
        var x = (i * 37) % W;
        var y = LIST_TOP + ((i * 53) % (h - 2));
        ctx.fillStyle = api.mix(PAL.grayL, PAL.ink, 0.10);
        ctx.fillRect(x, y, 1, 1);
      }
    }

    /* 置顶公告卡片（纯装饰，不参与游戏） */
    function drawPinned(ctx) {
      var x = 186, y = 58, w = 120, h = 54;
      ctx.globalAlpha = 0.55;
      api.roundRect(ctx, x, y, w, h, 4, PAL.paper);
      api.frame(ctx, x, y, w, h, PAL.gray);
      /* 图钉 */
      ctx.fillStyle = PAL.coralD;
      ctx.fillRect(x + 8, y + 8, 6, 6);
      ctx.fillRect(x + 10, y + 14, 2, 6);
      /* 标题与两条假正文 */
      api.text('PINNED', x + 22, y + 9, PAL.inkSoft, 1);
      ctx.fillStyle = PAL.grayL;
      ctx.fillRect(x + 10, y + 26, w - 22, 3);
      ctx.fillRect(x + 10, y + 34, w - 40, 3);
      ctx.fillRect(x + 10, y + 42, w - 30, 3);
      ctx.globalAlpha = 1;
    }

    /* 群名条 */
    function drawHeader(ctx) {
      ctx.fillStyle = PAL.navy;
      ctx.fillRect(0, TOPBAR, W, HEADER_H);
      ctx.fillStyle = PAL.navyL;
      ctx.fillRect(0, TOPBAR, W, 1);
      ctx.fillStyle = PAL.navyD;
      ctx.fillRect(0, TOPBAR + HEADER_H - 2, W, 2);
      /* 返回箭头 */
      api.line(ctx, 19, TOPBAR + 8, 13, TOPBAR + 13, PAL.white);
      api.line(ctx, 13, TOPBAR + 13, 19, TOPBAR + 18, PAL.white);
      /* 群名 */
      api.text('WORK GROUP', 28, TOPBAR + 6, PAL.white, 2);
      /* 人数徽章 */
      ctx.fillStyle = PAL.sky;
      ctx.fillRect(152, TOPBAR + 7, 16, 12);
      ctx.fillStyle = PAL.navyD;
      ctx.fillRect(152, TOPBAR + 7, 16, 1);
      api.text('9', 154, TOPBAR + 8, PAL.navyD, 1);
      /* 历史最高分 */
      var bt = 'BEST ' + best;
      api.text(bt, W - 8 - api.textWidth(bt, 1), TOPBAR + 9, api.mix(PAL.paper, PAL.navy, 0.3), 1);
    }

    /* 底部提示条（只有 ASCII） */
    function drawHint(ctx) {
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(0, LIST_BOTTOM, W, H - LIST_BOTTOM);
      ctx.fillStyle = PAL.lilacD;
      ctx.fillRect(0, LIST_BOTTOM, W, 1);
      var s = 'ARROWS SELECT  ENTER RECALL  CLICK TOO';
      api.text(s, (W - api.textWidth(s, 1)) >> 1, LIST_BOTTOM + 5, PAL.butter, 1);
    }

    /* 一条气泡 */
    function drawMsg(ctx, m, t) {
      var y = Math.round(m.y);
      if (y > H + 20 || y + BUBBLE_H < LIST_TOP - 30) return;
      var s = SENDERS[m.sender];
      var friendly = (m.kind === 'friendly');
      var w = bubbleW(m);
      var fill = friendly ? PAL.grayL : PAL.white;
      var border = friendly ? PAL.grayD : PAL.inkSoft;
      var selected = (msgs[sel] === m);

      /* 气泡的投影 */
      ctx.globalAlpha = 0.13;
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(BUBBLE_X + 1, y + 2, w, BUBBLE_H);
      ctx.globalAlpha = 1;

      /* 尾巴（指向左边的头像） */
      api.tri(ctx, BUBBLE_X - 7, y + 10, BUBBLE_X + 1, y + 4, BUBBLE_X + 1, y + 18, border);
      api.tri(ctx, BUBBLE_X - 4, y + 11, BUBBLE_X + 1, y + 6, BUBBLE_X + 1, y + 16, fill);

      /* 气泡本体：外描边 + 内填充 */
      api.roundRect(ctx, BUBBLE_X, y, w, BUBBLE_H, 3, border);
      api.roundRect(ctx, BUBBLE_X + 1, y + 1, w - 2, BUBBLE_H - 2, 3, fill);
      /* 顶部高光 */
      ctx.fillStyle = friendly ? api.mix(fill, PAL.white, 0.35) : PAL.white;
      ctx.fillRect(BUBBLE_X + 4, y + 1, w - 8, 1);

      /* 消息文字 */
      api.text(m.text, BUBBLE_X + 7, y + 5, PAL.ink, 2);

      /* 头像 */
      var ax = AVATAR_X, ay = y + 3;
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(ax, ay, AVATAR_SZ, AVATAR_SZ);
      ctx.fillStyle = s.c;
      ctx.fillRect(ax + 1, ay + 1, AVATAR_SZ - 2, AVATAR_SZ - 2);
      ctx.fillStyle = s.d;
      ctx.fillRect(ax + 1, ay + AVATAR_SZ - 3, AVATAR_SZ - 2, 2);
      api.text(s.ch, ax + 2, ay + 1, PAL.white, 2);

      if (friendly) {
        /* 友好消息：右上角一个绿色小勾，表示不用撤 */
        checkMark(ctx, BUBBLE_X + w - 14, y + 9, PAL.tealD);
      } else {
        /* 倒计时条：越短越危险 */
        var barY = y + BUBBLE_H + BAR_DY;
        ctx.fillStyle = PAL.ink;
        ctx.fillRect(BUBBLE_X, barY, w, BAR_H);
        var ratio = m.total > 0 ? Math.max(0, Math.min(1, m.left / m.total)) : 0;
        var fw = Math.round(w * ratio);
        var fc = ratio < 0.3 ? (Math.floor(t * 9) % 2 ? PAL.coralL : PAL.red) : PAL.red;
        ctx.fillStyle = fc;
        ctx.fillRect(BUBBLE_X, barY, fw, BAR_H);
        ctx.fillStyle = PAL.paper3;
        ctx.fillRect(BUBBLE_X + fw, barY, 1, BAR_H);
        /* 条子底部的一道亮边，别和背景糊在一起 */
        ctx.fillStyle = PAL.grayD;
        ctx.fillRect(BUBBLE_X, barY + BAR_H, w, 1);
      }

      /* 键盘选中框：四角标记，闪一下 */
      if (selected && !dead) {
        var blink = Math.sin(t * 6) > -0.25;
        if (blink) {
          var bh = friendly ? BUBBLE_H : BUBBLE_H + BAR_DY + BAR_H;
          cornerMarks(ctx, BUBBLE_X - 2, y - 2, w + 4, bh + 4, PAL.butter, 8, 2);
        }
      }
    }

    /* 气泡碎掉的残影 */
    function drawGhosts(ctx) {
      for (var i = 0; i < ghosts.length; i++) {
        var g = ghosts[i];
        var p = Math.min(1, g.t / g.life);
        ctx.globalAlpha = Math.max(0, 1 - p);
        if (g.mode === 'recalled') {
          /* 撤回成功：缩成一团，标上 RECALLED */
          var k = 1 - p * 0.45;
          var w = Math.max(24, Math.round(g.w * k));
          var h = Math.max(12, Math.round(g.h * k));
          var x = Math.round(g.x + (g.w - w) / 2);
          var y = Math.round(g.y + (g.h - h) / 2);
          api.roundRect(ctx, x, y, w, h, 3, PAL.grayD);
          api.roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 3, PAL.paper2);
          var t1 = 'RECALLED';
          api.text(t1, x + Math.max(2, (w - api.textWidth(t1, 1)) / 2), y + Math.max(2, (h - 7) / 2), PAL.inkSoft, 1);
        } else if (g.mode === 'seen') {
          /* 老板看见了：红框 + SEEN */
          api.roundRect(ctx, g.x, g.y, g.w, g.h, 3, PAL.red);
          api.roundRect(ctx, g.x + 1, g.y + 1, g.w - 2, g.h - 2, 3, PAL.paper);
          var t2 = 'SEEN';
          api.text(t2, g.x + (g.w - api.textWidth(t2, 2)) / 2, g.y + 4, PAL.redD, 2);
        } else {
          /* 点错了：灰框 + OOPS */
          api.roundRect(ctx, g.x, g.y, g.w, g.h, 3, PAL.grayD);
          api.roundRect(ctx, g.x + 1, g.y + 1, g.w - 2, g.h - 2, 3, PAL.grayL);
          var t3 = 'OOPS';
          api.text(t3, g.x + (g.w - api.textWidth(t3, 2)) / 2, g.y + 4, PAL.ink, 2);
        }
        /* 碎片 */
        for (var s = 0; s < g.shards.length; s++) {
          var sh = g.shards[s];
          ctx.fillStyle = sh.c;
          ctx.fillRect(Math.round(sh.x), Math.round(sh.y), 2, 2);
        }
        ctx.globalAlpha = 1;
      }
    }

    /* 飘分 */
    function drawPops(ctx) {
      for (var i = 0; i < pops.length; i++) {
        var p = pops[i];
        ctx.globalAlpha = Math.max(0, 1 - p.t / 0.9);
        api.text(p.text, p.x + 1, p.y + 1, PAL.ink, 2);
        api.text(p.text, p.x, p.y, p.c, 2);
        ctx.globalAlpha = 1;
      }
    }

    /* 连击徽章（右下角，连上以后才出现） */
    function drawCombo(ctx) {
      if (combo < 2 || dead) return;
      var mult = Math.min(4, 1 + Math.floor(combo / 3));
      var s = 'COMBO ' + combo + '  X' + mult;
      var tw = api.textWidth(s, 1);
      var x = W - 10 - tw, y = LIST_BOTTOM - 22;
      api.roundRect(ctx, x - 7, y - 5, tw + 14, 17, 3, PAL.ink);
      api.text(s, x, y, PAL.butter, 1);
    }

    /* 顶部 ASCII 小提示（中文版在 HTML 层，这里只放画布能画的 ASCII） */
    function drawToast(ctx) {
      if (!msg || msgT <= 0) return;
      var w = api.textWidth(msg, 1) + 14;
      var x = W - 10 - w, y = 122;
      ctx.globalAlpha = Math.min(1, msgT * 2) * 0.92;
      api.roundRect(ctx, x, y, w, 16, 3, PAL.ink);
      ctx.globalAlpha = 1;
      var c = (msgColor === PAL.ink) ? PAL.butter : msgColor;
      api.text(msg, x + 7, y + 4, c, 1);
    }

    /* 结束面板 */
    function drawOver(ctx) {
      ctx.fillStyle = 'rgba(27,24,38,0.55)';
      ctx.fillRect(0, TOPBAR, W, H - TOPBAR);
      var w = 208, h = 78, x = (W - w) >> 1, y = 92;
      ctx.fillStyle = PAL.paper;
      ctx.fillRect(x, y, w, h);
      api.frame(ctx, x, y, w, h, PAL.ink);
      api.bevel(ctx, x + 1, y + 1, w - 2, h - 2, PAL.white, PAL.paper3);
      var t1 = timeLeft <= 0 ? 'TIME UP' : 'NO HEARTS';
      api.text(t1, x + ((w - api.textWidth(t1, 2)) >> 1), y + 12, PAL.coralD, 2);
      var t2 = 'SCORE ' + api.getScore();
      api.text(t2, x + ((w - api.textWidth(t2, 2)) >> 1), y + 34, PAL.ink, 2);
      var t3 = 'RECALLED ' + recalled + '   BEST ' + best;
      api.text(t3, x + ((w - api.textWidth(t3, 1)) >> 1), y + 58, PAL.inkSoft, 1);
    }

    /* ============================================================
     * 小工具
     * ============================================================ */

    /* 四角标记（键盘选中框） */
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

    /* 小对勾（友好消息的标记） */
    function checkMark(ctx, x, y, c) {
      ctx.fillStyle = c;
      ctx.fillRect(x, y + 3, 2, 2);
      ctx.fillRect(x + 2, y + 5, 2, 2);
      ctx.fillRect(x + 4, y + 3, 2, 2);
      ctx.fillRect(x + 6, y + 1, 2, 2);
      ctx.fillRect(x + 8, y, 2, 2);
    }

    /* 命中测试：点在气泡上就返回那条消息 */
    function hitTest(x, y) {
      for (var i = msgs.length - 1; i >= 0; i--) {
        var m = msgs[i];
        var my = Math.round(m.y);
        var w = bubbleW(m);
        if (x >= BUBBLE_X && x <= BUBBLE_X + w && y >= my && y <= my + BUBBLE_H + BAR_DY + BAR_H) return m;
        if (x >= AVATAR_X && x <= AVATAR_X + AVATAR_SZ && y >= my + 3 && y <= my + 3 + AVATAR_SZ) return m;
      }
      return null;
    }

    /* ============================================================
     * 鼠标 / 触摸
     * ============================================================ */
    function pointer(type, x, y) {
      if (type !== 'down' || dead) return;
      var m = hitTest(x, y);
      if (!m) return;
      sel = msgs.indexOf(m);
      if (sel < 0) sel = 0;
      doRecall(m);
    }

    /* ============================================================
     * 键盘
     * ============================================================ */
    function key(k) {
      if (dead) return;
      var n = msgs.length;
      if (k === 'ArrowUp' || k === 'ArrowLeft') {
        if (!n) return;
        sel = (sel + 1) % n;              /* 往更旧的一条走（画面里是往上） */
        api.sfx('click');
        return;
      }
      if (k === 'ArrowDown' || k === 'ArrowRight') {
        if (!n) return;
        sel = (sel - 1 + n) % n;          /* 往更新的一条走 */
        api.sfx('click');
        return;
      }
      if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
        if (!n) return;
        if (sel < 0 || sel >= n) sel = 0;
        doRecall(msgs[sel]);
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

  /* ============================================================
   * 注册
   * ============================================================ */
  G.register({
    id: 'recall',
    title: '撤回消息',
    tagline: '手速太快，撤回都来不及',
    howto: '工作群的消息一条条冒上来：带红色倒计时条的必须赶紧撤回，点中就加分，连击还有加成；倒计时走完还没撤，老板就看见了，扣一颗心。灰色气泡是同事的好消息，别乱点。3 颗心，90 秒到点收工。键盘：左右方向键切换气泡，Enter / 空格撤回。',
    emoji: '💬',
    accent: '#4b87b0',
    width: W,
    height: H,
    create: createGame
  });
})(typeof window !== 'undefined' ? window : this);
