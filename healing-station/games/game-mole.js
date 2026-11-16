/* ============================================================
 * 《摸鱼地鼠》—— 趁老板不在，戳醒打瞌睡的同事
 * ------------------------------------------------------------
 * 玩法：一排排工位格子间里，同事的脑袋会冒出来（偶尔是猫）。
 *       趁老板的聚光灯没扫过来，一戳即中，连击有加成。
 *       在灯光下动手 → 被记一次小过。
 * 操作：鼠标/手指点击，或键盘 1~9 对应九个工位。
 *
 * v2：画布从 160×144 升级到 320×288，场景重画成「工位格子间」。
 * ============================================================ */
(function (global) {
  'use strict';

  var G = global.HS_GAMES;
  var SPR = global.HS_SPR;
  if (!G || !SPR) return;

  var W = 320, H = 288;

  /* 场景分层 */
  var TOPBAR = 18;              // 顶部状态条
  var WALL_H = 74;              // 墙面高度（18~92）
  var DESK_Y = TOPBAR + WALL_H; // 桌面后沿 = 92
  var LEDGE = 14;               // 每排工位桌沿（木质压条）厚度
  var BAND_Y = [146, 208, 270]; // 三排工位的桌沿位置
  var COL_X = [8, 116, 224];    // 三列工位左边
  var COL_W = 88;               // 每列宽度
  var HEAD_H = 48;              // 角色露出桌面的高度（两种角色统一）

  G.register({
    id: 'mole',
    title: '摸鱼地鼠',
    tagline: '趁老板没看，戳醒打瞌睡的同事',
    howto: '工位格子间里会冒出打瞌睡的同事（偶尔是猫），点它一下就得一分，连击还有加成。老板的聚光灯扫过来时别动手，否则被记一次小过。键盘也可以按 1~9 直接戳。',
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
              cx: COL_X[c] + COL_W / 2,
              x: COL_X[c],
              y: BAND_Y[r],
              pop: 0,
              up: 0,
              type: null,
              stay: 0
            });
          }
        }
      })();

      var lives = 3;
      var combo = 0;
      var comboFlash = 0;
      var timeLeft = 60;
      var spawnTimer = 0.4;
      var boss = { active: false, x: -30, timer: 4.2, life: 0 };
      var msg = '';
      var msgTimer = 0;
      var flash = 0;

      function say(text, ascii, color) {
        msg = ascii || '';
        msgTimer = 1.4;
        api.state({ message: text, color: color || P.ink });
      }

      /* 聚光灯在某一行的半宽 */
      function coneHalf(y) {
        var t = (y - DESK_Y) / Math.max(1, H - DESK_Y);
        return 14 + t * 34;
      }

      function hitHole(h) {
        if (!h.type || h.pop < 0.3) return false;
        var inCone = boss.active && Math.abs(h.cx - boss.x) < coneHalf(h.y) + 6;
        if (inCone) {
          /* 被老板逮个正着 */
          lives -= 1;
          combo = 0;
          flash = 0.5;
          api.kick(6);
          api.sfx('miss');
          api.puff(h.cx, h.y + 8, P.coralD, 14);
          h.pop = 0; h.type = null; h.up = 0;
          say('被老板抓到了！', 'CAUGHT!', P.coralD);
          if (lives <= 0) api.end('被老板逮住了三次');
          return true;
        }
        var isCat = h.type === 'cat';
        var base = isCat ? 30 : 10;
        combo += 1;
        var gain = base * (1 + Math.floor(combo / 3));
        api.addScore(gain);
        comboFlash = 0.8;
        api.sfx(isCat ? 'coin' : 'pop');
        api.kick(2);
        api.puff(h.cx, h.y + 4, isCat ? P.gold : P.butter, 12);
        h.pop = 0; h.type = null; h.up = 0;
        say('+' + gain + (combo >= 3 ? '  X' + combo : ''), '+' + gain + (combo >= 3 ? ' X' + combo : ''), isCat ? P.gold : P.coralD);
        return true;
      }

      function inHole(x, y) {
        for (var i = 0; i < holes.length; i++) {
          var h = holes[i];
          if (x >= h.x && x < h.x + COL_W && y >= h.y - 52 && y < h.y + 26) return h;
        }
        return null;
      }

      /* 画一整排工位的正面：木质桌沿 + 紫色隔板（一直延伸到画面底） */
      function drawPartition(ctx, y, row) {
        var bottom = H;
        var top = y - LEDGE;
        /* 桌沿：木头压条 + 高光 */
        ctx.fillStyle = P.brownL;
        ctx.fillRect(0, top, W, LEDGE - 2);
        ctx.fillStyle = P.paper3;
        ctx.fillRect(0, top, W, 1);
        ctx.fillStyle = P.brownD;
        ctx.fillRect(0, top + LEDGE - 2, W, 2);
        /* 隔板主体：上浅下深 */
        var h = bottom - y;
        for (var i = 0; i < h; i++) {
          var k = i / h;
          ctx.fillStyle = k < 0.3 ? P.lilacL : (k < 0.72 ? P.lilac : P.lilacD);
          ctx.fillRect(0, y + i, W, 1);
        }
        ctx.fillStyle = P.plum;
        ctx.fillRect(0, bottom - 2, W, 2);
        /* 三段工位之间的竖缝 */
        for (var s = 0; s < 2; s++) {
          var sx = COL_X[s] + COL_W + 10;
          ctx.fillStyle = P.plum;
          ctx.fillRect(sx, y + 4, 2, h - 6);
          ctx.fillStyle = P.lilacD;
          ctx.fillRect(sx + 2, y + 4, 1, h - 6);
        }
        /* 每段工位贴一张便利贴、挂一支笔 */
        for (var c = 0; c < 3; c++) {
          var nx = COL_X[c] + 14;
          ctx.fillStyle = P.butterL;
          ctx.fillRect(nx, y + 8, 16, 12);
          ctx.fillStyle = P.butterD;
          ctx.fillRect(nx, y + 11, 11, 1);
          ctx.fillRect(nx, y + 14, 13, 1);
          ctx.fillStyle = P.coralD;
          ctx.fillRect(nx + 60, y + 7, 2, 13);
          ctx.fillStyle = P.ink;
          ctx.fillRect(nx + 60, y + 7, 2, 4);
        }
        /* 桌沿上的小物，按排不同 */
        if (row === 0) {
          SPR.sprite(ctx, SPR.PAPER, 252, top - 12, SPR.MAP.paper, 1);
          SPR.sprite(ctx, SPR.CUP, 20, top - 15, SPR.MAP.cup, 1);
        } else if (row === 1) {
          SPR.sprite(ctx, SPR.KEYBOARD, 130, top - 9, SPR.MAP.keyboard, 1);
          SPR.sprite(ctx, SPR.CUP, 196, top - 15, SPR.MAP.cup, 1);
        } else {
          SPR.sprite(ctx, SPR.MONITOR, 232, top - 18, SPR.MAP.monitor, 1);
          SPR.sprite(ctx, SPR.KEYBOARD, 30, top - 9, SPR.MAP.keyboard, 1);
        }
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
            boss.x = -30;
            boss.life = 7.2;
          }
          if (boss.active) {
            boss.x += 30 * dt;
            boss.life -= dt;
            if (boss.x > W + 30 || boss.life <= 0) {
              boss.active = false;
              boss.timer = 4.5 + api.rand(0, 2);
            }
          }

          /* 冒头的同事 */
          spawnTimer -= dt;
          if (spawnTimer <= 0) {
            spawnTimer = api.rand(0.5, 0.95);
            var free = [];
            for (var i = 0; i < holes.length; i++) if (!holes[i].type) free.push(holes[i]);
            if (free.length) {
              var h = api.pick(free);
              h.type = api.chance(0.22) ? 'cat' : 'worker';
              h.stay = h.type === 'cat' ? api.rand(1.4, 2.1) : api.rand(0.9, 1.6);
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
          var t = api.time();
          /* 背景：墙面 + 木纹大桌 */
          SPR.drawDesk(ctx, W, H, t, {
            topbar: true, wallH: WALL_H, window: false, clock: true,
            poster: true, posterX: W - 118, posterY: TOPBAR + 12,
            notes: true, notesX: 112, notesY: TOPBAR + 16,
            shelf: false, floor: false,
            deskTop: DESK_Y, props: false, plant: false
          });
          /* 墙上的窗户 */
          SPR.drawWindow(ctx, 16, TOPBAR + 14, 76, 48, t);
          /* 远端桌上的显示器与绿植 */
          SPR.sprite(ctx, SPR.MONITOR, 236, DESK_Y - 18, SPR.MAP.monitor, 1);
          SPR.sprite(ctx, SPR.PLANT, 288, DESK_Y - 16, SPR.MAP.plant, 1);

          /* 三个工位排：先画远处的（角色→桌沿→隔板），再画近的 */
          for (var row = 0; row < 3; row++) {
            for (var i = 0; i < 3; i++) {
              var h = holes[row * 3 + i];
              if (h.type && h.pop > 0.02) {
                var art = h.type === 'cat' ? SPR.CAT : SPR.WORKER;
                var map = h.type === 'cat' ? SPR.MAP.cat : SPR.MAP.worker;
                var sc = h.type === 'cat' ? 3 : 2;
                var sw = art[0].length * sc;
                var top = h.y + 6 - h.pop * HEAD_H;
                SPR.sprite(ctx, art, Math.round(h.cx - sw / 2), Math.round(top), map, sc);
              }
            }
            drawPartition(ctx, BAND_Y[row], row);
          }

          /* 老板的聚光灯：从他脚下往桌面上照，越远越散 */
          if (boss.active) {
            ctx.save();
            ctx.globalAlpha = 0.16;
            ctx.fillStyle = P.butter;
            for (var y = DESK_Y; y < H; y += 2) {
              var half = coneHalf(y);
              ctx.fillRect(Math.round(boss.x - half), y, Math.round(half * 2), 2);
            }
            ctx.restore();
          }

          /* 老板本体：站在桌子后沿 */
          if (boss.active) {
            var artB = boss.life < 1.8 ? SPR.BOSS_ANGRY : (boss.life < 3.6 ? SPR.BOSS_SUSPICIOUS : SPR.BOSS_CALM);
            SPR.sprite(ctx, artB, Math.round(boss.x - 26), DESK_Y - 50, SPR.MAP.boss, 2);
            /* 头顶的小灯泡 */
            ctx.fillStyle = P.ink;
            ctx.fillRect(Math.round(boss.x - 7), DESK_Y - 56, 14, 5);
            ctx.fillStyle = boss.life < 1.8 ? P.red : P.butter;
            ctx.fillRect(Math.round(boss.x - 5), DESK_Y - 54, 10, 3);
          }

          SPR.drawDust(ctx, W, H, t, P.paper3);

          /* HUD（顶部状态条） */
          api.statusBar({ score: api.getScore(), time: timeLeft, hearts: lives, maxHearts: 3 });

          /* 连击徽章：状态条下面靠左，闪一下就消失 */
          if (combo > 1) {
            var ct = 'X' + combo;
            var cw = api.textWidth(ct, 2) + 10;
            ctx.fillStyle = comboFlash > 0 ? P.coral : P.coralD;
            ctx.fillRect(8, 22, cw, 18);
            api.text(ct, 13, 25, P.white, 2);
          }
          /* 提示条 */
          if (msgTimer > 0) {
            var w = api.textWidth(msg, 2) + 16;
            ctx.fillStyle = P.white;
            ctx.fillRect((W - w) >> 1, H - 36, w, 22);
            ctx.fillStyle = P.paper3;
            ctx.fillRect((W - w) >> 1, H - 15, w, 1);
            api.text(msg, (W - api.textWidth(msg, 2)) >> 1, H - 31, P.ink, 2);
          }
          if (flash > 0) {
            ctx.fillStyle = 'rgba(240,131,122,' + (flash * 0.5).toFixed(2) + ')';
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
