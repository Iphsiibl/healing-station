/* ============================================================
 * 《老板巡视》—— 老板开始查岗，你得边躲任务边捡咖啡
 * ------------------------------------------------------------
 * 玩法：控制摸鱼的自己（鼠标/手指跟随，或方向键），
 *       躲开从天上掉下来的「任务」，顺手接住咖啡和小铃铛。
 *       被砸中三次就露馅了。
 *
 * v2：画布 160×144 → 320×288，画面重画：墙上的监控眼、
 *     地砖、盆栽、纸任务文件、咖啡杯与小铃铛都放大重画。
 * ============================================================ */
(function (global) {
  'use strict';

  var G = global.HS_GAMES;
  var SPR = global.HS_SPR;
  if (!G || !SPR) return;

  var W = 320, H = 288;
  var TOPBAR = 18;
  var WALL_H = 94;               // 墙面高度（18~112）
  var FLOOR_Y = TOPBAR + WALL_H; // 地面起始 = 112
  var PS = 2;                    // 角色缩放
  var PW = 22 * PS;              // 角色宽 44
  var PH = 24 * PS;              // 角色高 48

  /* 三种掉落物的尺寸（素材尺寸 × 缩放） */
  var ITEM = {
    task: { w: 12 * 2, h: 15 * 2 },
    coffee: { w: 14 * 2, h: 16 * 2 },
    bell: { w: 12 * 2, h: 12 * 2 }
  };

  G.register({
    id: 'dodge',
    title: '老板巡视',
    tagline: '查岗时间到了，躲任务、捡咖啡',
    howto: '用鼠标或手指带着自己跑（键盘方向键也行），躲开天上掉下来的任务文件，接住咖啡杯和小铃铛加分。被砸中会掉一颗心，三次就露馅。',
    emoji: '🏃',
    accent: '#b9a6e3',
    width: W,
    height: H,

    create: function (api) {
      var P = api.PAL;
      var player = { x: W / 2, y: H - PH - 6, tx: W / 2, ty: H - PH - 6, w: 30, h: 40, blink: 0, run: 0 };
      var items = [];
      var hearts = 3;
      var spawnTimer = 0.8;
      var elapsed = 0;
      var idleAcc = 0;          // 苟着的时间，攒够 1 秒给 2 分（保持整数分）
      var msg = '';
      var msgTimer = 0;
      var keys = {};
      var eyeX = W / 2, eyeY = 40;

      function say(text, ascii) {
        msg = ascii || ''; msgTimer = 1.2;
        api.state({ message: text });
      }

      function spawn() {
        var r = api.rand();
        var type = 'task';
        if (r > 0.86) type = 'coffee';
        else if (r > 0.74) type = 'bell';
        items.push({
          type: type,
          x: api.rand(10, W - 30),
          y: FLOOR_Y - 40,
          vx: api.rand(-12, 12),
          vy: type === 'task' ? api.rand(38, 56) : api.rand(28, 40),
          rot: 0
        });
      }

      function hurt() {
        hearts -= 1;
        api.kick(5);
        api.sfx('miss');
        api.puff(player.x + PW / 2, player.y + PH - 10, P.coralD, 12);
        player.blink = 1.2;
        if (hearts <= 0) api.end('被老板发现了三次');
      }

      return {
        update: function (dt, t) {
          elapsed += dt;
          if (elapsed >= 60) {
            api.end('熬过了整整一分钟');
            return;
          }
          if (msgTimer > 0) msgTimer -= dt;
          if (player.blink > 0) player.blink -= dt;

          /* 键盘移动 */
          var kv = 0, kh = 0;
          if (keys['ArrowLeft'] || keys['a']) kv -= 1;
          if (keys['ArrowRight'] || keys['d']) kv += 1;
          if (keys['ArrowUp'] || keys['w']) kh -= 1;
          if (keys['ArrowDown'] || keys['s']) kh += 1;
          if (kv || kh) {
            player.tx += kv * 150 * dt;
            player.ty += kh * 150 * dt;
            player.tx = Math.max(4, Math.min(W - PW - 4, player.tx));
            player.ty = Math.max(FLOOR_Y + 6, Math.min(H - PH - 4, player.ty));
          }
          /* 指针跟随：平滑一点，手感更软 */
          var dx = player.tx - player.x;
          var dy = player.ty - player.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          var step = Math.min(d, 230 * dt);
          if (d > 0.5) {
            player.x += dx / d * step;
            player.y += dy / d * step;
          }
          player.run += d * 0.05;

          /* 老板的眼睛盯着你 */
          var lx = (player.x + PW / 2) - eyeX;
          var ly = (player.y + PH / 2) - eyeY;
          var ld = Math.max(1, Math.sqrt(lx * lx + ly * ly));
          eyeX += (lx / ld) * 40 * dt;
          eyeY += (ly / ld) * 26 * dt;
          eyeY = Math.max(30, Math.min(52, eyeY));

          /* 难度随时间上升 */
          var gap = 1.5 - Math.min(0.9, elapsed / 70);
          spawnTimer -= dt;
          if (spawnTimer <= 0) {
            spawnTimer = gap * api.rand(0.7, 1.25);
            spawn();
          }

          for (var i = items.length - 1; i >= 0; i--) {
            var it = items[i];
            var sz = ITEM[it.type];
            it.y += it.vy * dt;
            it.x += it.vx * dt;
            if (it.x < 2 || it.x > W - sz.w - 2) it.vx = -it.vx;
            if (it.y > H + 20) { items.splice(i, 1); continue; }

            var hitX = it.x < player.x + player.w && it.x + sz.w > player.x;
            var hitY = it.y < player.y + player.h && it.y + sz.h > player.y;
            if (hitX && hitY) {
              if (it.type === 'task') {
                if (player.blink <= 0) {
                  hurt();
                  items.splice(i, 1);
                  if (api.isOver()) return;
                  continue;
                }
              } else {
                if (it.type === 'coffee') {
                  api.addScore(15);
                  api.sfx('coin');
                  say('+15 咖啡续命', '+15 COFFEE');
                } else {
                  api.addScore(30);
                  api.sfx('level');
                  say('+30 老板不在！', '+30 CLEAR!');
                }
                api.puff(it.x + sz.w / 2, it.y + sz.h / 2, it.type === 'coffee' ? P.gold : P.mint, 10);
                items.splice(i, 1);
                continue;
              }
            }
          }

          /* 苟着也是分：攒满 1 秒才记 2 分，分数永远是整数 */
          idleAcc += dt;
          while (idleAcc >= 1) {
            idleAcc -= 1;
            api.addScore(2);
          }
        },

        draw: function (ctx) {
          var t = api.time();
          /* 背景：墙面 */
          SPR.drawDesk(ctx, W, H, t, {
            topbar: true, wallH: WALL_H, window: true, clock: true,
            poster: true, posterX: W - 112, posterY: TOPBAR + 14,
            notes: false, shelf: false, floor: false, deskTop: H,
            props: false, plant: false
          });

          /* 地毯地面 */
          ctx.fillStyle = P.grayL;
          ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
          for (var ty = FLOOR_Y; ty < H; ty += 18) {
            ctx.fillStyle = P.gray;
            ctx.fillRect(0, ty, W, 1);
          }
          for (var tx = 0; tx <= W; tx += 32) {
            ctx.fillStyle = P.gray;
            ctx.fillRect(tx, FLOOR_Y, 1, H - FLOOR_Y);
          }
          /* 墙脚阴影 */
          ctx.fillStyle = P.grayD;
          ctx.fillRect(0, FLOOR_Y - 3, W, 3);

          /* 地上的地毯、纸屑、椅子、垃圾桶 */
          api.ellipse(ctx, W / 2, H - 62, 78, 26, P.rose);
          api.ellipse(ctx, W / 2, H - 62, 70, 21, P.roseD);
          api.ellipse(ctx, W / 2, H - 62, 62, 16, P.rose);
          SPR.sprite(ctx, SPR.PAPER, 96, FLOOR_Y + 26, SPR.MAP.paper, 1);
          SPR.sprite(ctx, SPR.PAPER, 206, H - 96, SPR.MAP.paper, 1);
          /* 办公椅 */
          ctx.fillStyle = P.steelD;
          ctx.fillRect(272, H - 70, 4, 30);
          ctx.fillStyle = P.paper3;
          ctx.fillRect(258, H - 74, 34, 12);
          ctx.fillStyle = P.gray;
          ctx.fillRect(258, H - 64, 34, 3);
          ctx.fillStyle = P.steelD;
          ctx.fillRect(266, H - 58, 4, 14);
          ctx.fillRect(282, H - 58, 4, 14);
          ctx.fillStyle = P.steel;
          ctx.fillRect(260, H - 46, 30, 3);
          /* 垃圾桶 */
          ctx.fillStyle = P.steel;
          ctx.fillRect(22, H - 34, 22, 28);
          ctx.fillStyle = P.steelL;
          ctx.fillRect(22, H - 34, 22, 3);
          ctx.fillStyle = P.steelD;
          ctx.fillRect(19, H - 38, 28, 5);

          /* 墙上的监控眼 */
          var mx = W / 2 - 34, my = 24, mw = 68, mh = 38;
          ctx.fillStyle = P.steelD;
          ctx.fillRect(mx + mw / 2 - 2, my - 6, 4, 8);
          ctx.fillStyle = P.steel;
          ctx.fillRect(mx, my, mw, mh);
          ctx.fillStyle = P.steelL;
          ctx.fillRect(mx, my, mw, 2);
          ctx.fillStyle = P.steelD;
          ctx.fillRect(mx, my + mh - 2, mw, 2);
          /* 眼球 */
          ctx.fillStyle = P.white;
          ctx.fillRect(mx + 12, my + 8, 34, 20);
          ctx.fillStyle = P.paper3;
          ctx.fillRect(mx + 12, my + 25, 34, 3);
          ctx.fillStyle = P.ink;
          ctx.fillRect(Math.round(eyeX - 8), Math.round(eyeY - 8), 15, 15);
          ctx.fillStyle = P.white;
          ctx.fillRect(Math.round(eyeX - 5), Math.round(eyeY - 6), 5, 5);
          /* 指示灯 */
          ctx.fillStyle = hearts > 1 ? P.mint : P.coral;
          ctx.fillRect(mx + mw - 12, my + mh - 6, 6, 4);

          /* 地上的盆栽 */
          SPR.sprite(ctx, SPR.PLANT, 8, H - 36, SPR.MAP.plant, 2);

          /* 掉落物 */
          for (var i = 0; i < items.length; i++) {
            var it = items[i];
            var ix = Math.round(it.x), iy = Math.round(it.y);
            if (it.type === 'task') {
              SPR.sprite(ctx, SPR.PAPER, ix, iy, SPR.MAP.paper, 2);
              /* 纸上的一道横线 */
              ctx.fillStyle = P.gray;
              ctx.fillRect(ix + 6, iy + 8, 14, 2);
              ctx.fillRect(ix + 6, iy + 14, 10, 2);
            } else if (it.type === 'coffee') {
              SPR.sprite(ctx, SPR.CUP, ix, iy, SPR.MAP.cup, 2);
            } else {
              SPR.sprite(ctx, SPR.BELL, ix, iy, SPR.MAP.bell, 2);
            }
          }

          /* 玩家（脚下带影子） */
          var px = Math.round(player.x), py = Math.round(player.y);
          ctx.fillStyle = P.grayD;
          ctx.globalAlpha = 0.35;
          ctx.fillRect(px + 6, py + PH - 4, 32, 5);
          ctx.globalAlpha = 1;
          if (player.blink <= 0 || Math.floor(api.time() * 12) % 2 === 0) {
            SPR.sprite(ctx, SPR.WORKER, px, py, SPR.MAP.worker, PS);
          }

          SPR.drawDust(ctx, W, H, t, P.paper3);

          /* HUD（顶部状态条） */
          api.statusBar({ score: api.getScore(), time: 60 - elapsed, hearts: hearts, maxHearts: 3 });

          /* 提示条（ASCII；中文走 HTML 层） */
          if (msgTimer > 0) {
            var w = api.textWidth(msg, 2) + 16;
            ctx.fillStyle = P.white;
            ctx.fillRect((W - w) >> 1, H - 36, w, 22);
            ctx.fillStyle = P.paper3;
            ctx.fillRect((W - w) >> 1, H - 15, w, 1);
            api.text(msg, (W - api.textWidth(msg, 2)) >> 1, H - 31, P.ink, 2);
          }
        },

        pointer: function (type, x, y) {
          if (type === 'move' || type === 'down') {
            player.tx = x - PW / 2;
            player.ty = y - PH / 2;
          }
        },

        key: function (key, e) {
          keys[key] = true;
          if (e && e.preventDefault) e.preventDefault();
        },

        keyup: function (key) {
          keys[key] = false;
        }
      };
    }
  });
})(typeof window !== 'undefined' ? window : this);
