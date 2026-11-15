/* ============================================================
 * 《老板巡视》—— 老板开始查岗，你得边躲任务边捡咖啡
 * ------------------------------------------------------------
 * 玩法：控制摸鱼的自己（鼠标/手指跟随，或方向键），
 *       躲开从天上掉下来的「任务」，顺手接住咖啡和小铃铛。
 *       被砸中三次就露馅了。
 * ============================================================ */
(function (global) {
  'use strict';

  var G = global.HS_GAMES;
  var SPR = global.HS_SPR;
  if (!G || !SPR) return;

  var W = 160, H = 144;

  var PAPER = [
    '.1111.',
    '122221',
    '122221',
    '.1111.'
  ];

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
      var player = { x: W / 2, y: H - 26, tx: W / 2, ty: H - 26, w: 10, h: 8, blink: 0 };
      var items = [];
      var hearts = 3;
      var spawnTimer = 0.8;
      var elapsed = 0;
      var idleAcc = 0;          // 苟着的时间，攒够 1 秒给 2 分（保持整数分）
      var msg = '';
      var msgTimer = 0;
      var keys = {};

      function say(text, color) {
        msg = text; msgTimer = 1.2;
        api.state({ msg: text, color: color || P.ink });
      }

      function spawn() {
        var r = api.rand();
        var type = 'task';
        if (r > 0.86) type = 'coffee';
        else if (r > 0.74) type = 'bell';
        items.push({
          type: type,
          x: api.rand(6, W - 12),
          y: -8,
          vx: api.rand(-8, 8),
          vy: type === 'task' ? api.rand(26, 38) : api.rand(18, 28),
          rot: 0
        });
      }

      function hurt() {
        hearts -= 1;
        api.kick(5);
        api.sfx('miss');
        api.puff(player.x + 5, player.y + 4, P.coralD, 10);
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
            player.tx += kv * 90 * dt;
            player.ty += kh * 90 * dt;
            player.tx = Math.max(4, Math.min(W - 14, player.tx));
            player.ty = Math.max(20, Math.min(H - 14, player.ty));
          }
          /* 指针跟随：平滑一点，手感更软 */
          var dx = player.tx - player.x;
          var dy = player.ty - player.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          var step = Math.min(d, 150 * dt);
          if (d > 0.5) {
            player.x += dx / d * step;
            player.y += dy / d * step;
          }

          /* 难度随时间上升 */
          var gap = 1.5 - Math.min(0.9, elapsed / 70);
          spawnTimer -= dt;
          if (spawnTimer <= 0) {
            spawnTimer = gap * api.rand(0.7, 1.25);
            spawn();
          }

          for (var i = items.length - 1; i >= 0; i--) {
            var it = items[i];
            it.y += it.vy * dt;
            it.x += it.vx * dt;
            if (it.x < 2 || it.x > W - 12) it.vx = -it.vx;
            if (it.y > H + 10) { items.splice(i, 1); continue; }

            var hitX = it.x < player.x + player.w && it.x + 8 > player.x;
            var hitY = it.y < player.y + player.h && it.y + 8 > player.y;
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
                  say('+15 咖啡续命', P.gold);
                } else {
                  api.addScore(30);
                  api.sfx('level');
                  say('+30 老板不在！', P.mintD);
                }
                api.puff(it.x + 4, it.y + 4, it.type === 'coffee' ? P.gold : P.mint, 8);
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
          SPR.drawDesk(ctx, W, H, api.time(), { topbar: true, plant: false });
          SPR.drawDust(ctx, W, H, api.time(), P.paper3);

          /* 老板在顶部盯着（眼睛跟着你） */
          var look = Math.max(-1, Math.min(1, (player.x - W / 2) / 40));
          var bx = W / 2 - 5;
          ctx.fillStyle = P.ink;
          ctx.fillRect(bx + 1, 14, 9, 9);
          ctx.fillStyle = '#f3c9a6';
          ctx.fillRect(bx + 2, 15, 7, 7);
          ctx.fillStyle = P.ink;
          ctx.fillRect(bx + 3 + Math.round(look * 2), 17, 2, 2);
          ctx.fillRect(bx + 6 + Math.round(look * 2), 17, 2, 2);
          ctx.fillStyle = P.coralD;
          ctx.fillRect(bx + 3 + Math.round(look * 2), 19, 3, 1);

          /* 掉落物 */
          for (var i = 0; i < items.length; i++) {
            var it = items[i];
            var ix = it.x | 0, iy = it.y | 0;
            if (it.type === 'task') {
              SPR.sprite(ctx, PAPER, ix, iy, { '1': P.paper3, '2': P.white }, 1);
              ctx.fillStyle = P.inkSoft;
              ctx.fillRect(ix + 2, iy + 2, 4, 1);
            } else if (it.type === 'coffee') {
              SPR.sprite(ctx, SPR.CUP, ix, iy, SPR.MAP.cup, 1);
            } else {
              ctx.fillStyle = P.mint;
              ctx.fillRect(ix + 2, iy, 4, 6);
              ctx.fillStyle = P.mintD;
              ctx.fillRect(ix + 3, iy + 2, 2, 2);
            }
          }

          /* 玩家 */
          if (player.blink <= 0 || Math.floor(api.time() * 12) % 2 === 0) {
            SPR.sprite(ctx, SPR.WORKER, player.x | 0, player.y | 0, SPR.MAP.worker, 1);
          }

          /* HUD（顶部状态条） */
          api.statusBar({ score: api.getScore(), time: 60 - elapsed, hearts: hearts, maxHearts: 3 });
          if (msgTimer > 0) {
            var w = api.textWidth(msg, 1) + 8;
            ctx.fillStyle = P.white;
            ctx.fillRect((W - w) >> 1, H - 14, w, 11);
            api.text(msg, (W - api.textWidth(msg, 1)) >> 1, H - 11, P.ink, 1);
          }
        },

        pointer: function (type, x, y) {
          if (type === 'move' || type === 'down') {
            player.tx = x - 5;
            player.ty = y - 4;
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
