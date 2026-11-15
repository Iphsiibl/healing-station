/* ============================================================
 * 《摸鱼地鼠》—— 趁老板不在，戳醒打瞌睡的同事
 * ------------------------------------------------------------
 * 玩法：桌面三个洞，同事的脑袋会冒出来（偶尔是猫）。
 *       趁老板的视线没扫过来，一戳即中，连击有加成。
 *       被老板的聚光灯照到时下手 → 被记一次小过。
 * 操作：鼠标/手指点击，或键盘 1~9 对应九个工位。
 * ============================================================ */
(function (global) {
  'use strict';

  var G = global.HS_GAMES;
  var SPR = global.HS_SPR;
  if (!G || !SPR) return;

  var W = 160, H = 144;

  G.register({
    id: 'mole',
    title: '摸鱼地鼠',
    tagline: '趁老板没看，戳醒打瞌睡的同事',
    howto: '桌面会冒出打瞌睡的同事（偶尔是猫），点它一下就得一分，连击还有加成。老板头顶的灯光扫过来时别动手，否则被记一次小过。键盘也可以按 1~9 直接戳。',
    emoji: '🐹',
    accent: '#f0837a',
    width: W,
    height: H,

    create: function (api) {
      var P = api.PAL;

      /* 九个工位：三列三行 */
      var holes = [];
      (function () {
        for (var r = 0; r < 3; r++) {
          for (var c = 0; c < 3; c++) {
            holes.push({
              col: c, row: r,
              x: 8 + c * 49,
              y: 44 + r * 32,
              pop: 0,          // 0 藏在桌下，1 完全冒头
              up: 0,           // 冒头后停留的时间
              type: null,      // worker / cat
              stay: 0,
              hit: false
            });
          }
        }
      })();

      var lives = 3;
      var combo = 0;
      var comboFlash = 0;
      var timeLeft = 60;
      var spawnTimer = 0.4;
      var boss = { active: false, x: -14, timer: 5.0, life: 0 };
      var msg = '';
      var msgTimer = 0;
      var flash = 0;

      function say(text, color) {
        msg = text;
        msgTimer = 1.4;
        api.state({ msg: text, color: color || P.ink });
      }

      function hitHole(h) {
        if (!h.type || h.pop < 0.3) return false;
        var inCone = boss.active && Math.abs(h.x + 18 - boss.x) < 19;
        if (inCone) {
          /* 被老板逮个正着 */
          lives -= 1;
          combo = 0;
          flash = 0.5;
          api.kick(5);
          api.sfx('miss');
          api.puff(h.x + 18, h.y + 6, P.coralD, 12);
          h.pop = 0; h.type = null; h.up = 0;
          say('被老板抓到了！', P.coralD);
          if (lives <= 0) api.end('被老板逮住了三次');
          return true;
        }
        var base = h.type === 'cat' ? 30 : 10;
        var isCat = h.type === 'cat';
        combo += 1;
        var gain = base * (1 + Math.floor(combo / 3));
        api.addScore(gain);
        comboFlash = 0.8;
        api.sfx(isCat ? 'coin' : 'pop');
        api.kick(2);
        api.puff(h.x + 18, h.y + 2, isCat ? P.gold : P.butter, 10);
        h.pop = 0; h.type = null; h.up = 0;
        say('+' + gain + (combo >= 3 ? '  X' + combo : ''), isCat ? P.gold : P.coralD);
        return true;
      }

      function inHole(x, y) {
        for (var i = 0; i < holes.length; i++) {
          var h = holes[i];
          if (x >= h.x && x < h.x + 36 && y >= h.y - 14 && y < h.y + 26) return h;
        }
        return null;
      }

      return {
        update: function (dt, t) {
          timeLeft -= dt;
          if (timeLeft <= 0) {
            timeLeft = 0;
            api.end('一分钟到了，收工摸鱼');
            return;
          }
          if (msgTimer > 0) msgTimer -= dt;
          if (comboFlash > 0) comboFlash -= dt;
          if (flash > 0) flash -= dt;

          /* 老板巡逻 */
          boss.timer -= dt;
          if (!boss.active && boss.timer <= 0) {
            boss.active = true;
            boss.x = -14;
            boss.life = 6.4;
          }
          if (boss.active) {
            boss.x += 26 * dt;
            boss.life -= dt;
            if (boss.x > W + 14 || boss.life <= 0) {
              boss.active = false;
              boss.timer = 5.5 + api.rand(0, 2);
            }
          }

          /* 冒头的同事 */
          spawnTimer -= dt;
          if (spawnTimer <= 0) {
            spawnTimer = api.rand(0.55, 1.05);
            var free = [];
            for (var i = 0; i < holes.length; i++) if (!holes[i].type) free.push(holes[i]);
            if (free.length) {
              var h = api.pick(free);
              h.type = api.chance(0.22) ? 'cat' : 'worker';
              h.stay = h.type === 'cat' ? api.rand(1.4, 2.1) : api.rand(0.9, 1.7);
              h.up = 0;
            }
          }
          for (var j = 0; j < holes.length; j++) {
            var g = holes[j];
            if (!g.type) { g.pop = Math.max(0, g.pop - dt * 4); continue; }
            if (g.pop < 1) {
              g.pop = Math.min(1, g.pop + dt * 3.4);
            } else {
              g.up += dt;
              if (g.up > g.stay) {
                /* 没人戳，自己缩回去了 */
                g.pop -= dt * 3.4;
                g.up = 0;
                if (g.pop <= 0) {
                  g.type = null;
                  combo = 0;
                }
              }
            }
          }
        },

        draw: function (ctx) {
          SPR.drawDesk(ctx, W, H, api.time(), { topbar: true, window: false, clock: false, table: 40 });
          SPR.drawDust(ctx, W, H, api.time(), P.paper3);

          /* 老板的聚光灯 */
          if (boss.active) {
            ctx.save();
            ctx.globalAlpha = 0.16;
            ctx.fillStyle = P.butter;
            ctx.fillRect(boss.x - 19, 22, 38, H - 22);
            ctx.restore();
          }

          /* 九个洞 */
          for (var i = 0; i < holes.length; i++) {
            var h = holes[i];
            ctx.fillStyle = P.ink;
            ctx.fillRect(h.x + 2, h.y + 12, 32, 6);
            ctx.fillStyle = P.inkSoft;
            ctx.fillRect(h.x + 4, h.y + 13, 28, 3);
            if (h.type && h.pop > 0.02) {
              var lift = Math.round((1 - h.pop) * 20);
              var art = h.type === 'cat' ? SPR.CAT : SPR.WORKER;
              var map = h.type === 'cat' ? SPR.MAP.cat : SPR.MAP.worker;
              SPR.sprite(ctx, art, h.x + 10, h.y - 2 - lift, map, 2);
            }
          }

          /* 老板本体 */
          if (boss.active) {
            var artB = boss.life < 1.6 ? SPR.BOSS_ANGRY : (boss.life < 3.2 ? SPR.BOSS_SUSPICIOUS : SPR.BOSS_CALM);
            SPR.sprite(ctx, artB, boss.x | 0, 13, SPR.MAP.boss, 1);
            ctx.fillStyle = P.ink;
            ctx.fillRect(boss.x - 6, 11, 12, 2);
          }

          /* HUD（顶部状态条） */
          api.statusBar({ score: api.getScore(), time: timeLeft, hearts: lives, maxHearts: 3 });

          /* 连击徽章：状态条下面靠左，闪一下就消失 */
          if (combo > 1) {
            var ct = 'X' + combo;
            var cw = api.textWidth(ct, 1) + 6;
            ctx.fillStyle = comboFlash > 0 ? P.coral : P.coralD;
            ctx.fillRect(3, 15, cw, 10);
            api.text(ct, 6, 18, P.white, 1);
          }
          /* 提示条 */
          if (msgTimer > 0) {
            var w = api.textWidth(msg, 1) + 8;
            ctx.fillStyle = P.white;
            ctx.fillRect((W - w) >> 1, H - 14, w, 11);
            ctx.fillStyle = P.paper3;
            ctx.fillRect((W - w) >> 1, H - 4, w, 1);
            api.text(msg, (W - api.textWidth(msg, 1)) >> 1, H - 11, P.ink, 1);
          }
          if (flash > 0) {
            ctx.fillStyle = 'rgba(240,131,122,' + (flash * 0.6).toFixed(2) + ')';
            ctx.fillRect(0, 0, W, H);
          }
        },

        pointer: function (type, x, y) {
          if (type !== 'down') return;
          if (api.isOver()) return;
          var h = inHole(x, y);
          if (h) {
            hitHole(h);
          } else {
            combo = 0;
            api.sfx('click');
          }
        },

        key: function (key) {
          if (api.isOver()) return;
          if (key >= '1' && key <= '9') {
            var idx = parseInt(key, 10) - 1;
            if (holes[idx]) hitHole(holes[idx]);
          }
        }
      };
    }
  });
})(typeof window !== 'undefined' ? window : this);
