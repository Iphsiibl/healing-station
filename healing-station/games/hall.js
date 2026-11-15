/* ============================================================
 * 打工人急救站 · 摸鱼游戏厅
 * ------------------------------------------------------------
 * 一个「大厅」：左边挑游戏，右边直接开玩。
 * 也可以单独嵌到别的页面：
 *   <iframe src="games/index.html?game=mole"></iframe>
 * ============================================================ */
(function (global) {
  'use strict';

  var G = global.HS_GAMES;
  if (!G) return;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function Hall(container, opts) {
    opts = opts || {};
    this.container = container;
    this.stage = null;
    this.current = null;
    this.build(opts);
  }

  Hall.prototype.build = function (opts) {
    var self = this;
    var root = el('div', 'hall');

    /* ---- 大厅菜单 ---- */
    this.menu = el('div', 'hall-menu');
    this.menuTitle = el('p', 'hall-intro', '挑一个，摸鱼时间开始。');
    this.menu.appendChild(this.menuTitle);
    this.grid = el('div', 'hall-grid');
    this.menu.appendChild(this.grid);
    root.appendChild(this.menu);

    /* ---- 游戏舞台 ---- */
    this.play = el('div', 'hall-play');
    this.play.setAttribute('hidden', 'hidden');

    var top = el('div', 'hall-top');
    this.backBtn = el('button', 'hall-btn', '← 回大厅');
    this.backBtn.type = 'button';
    this.nameEl = el('div', 'hall-name', '');
    this.scoreEl = el('div', 'hall-score');
    this.scoreNum = el('strong', 'hs-score', '0');
    this.bestNum = el('small', 'hs-best', 'BEST 0');
    this.scoreEl.appendChild(this.scoreNum);
    this.scoreEl.appendChild(this.bestNum);
    top.appendChild(this.backBtn);
    top.appendChild(this.nameEl);
    top.appendChild(this.scoreEl);
    this.play.appendChild(top);

    this.wrap = el('div', 'hall-canvas-wrap');
    this.canvas = el('canvas', 'hall-canvas');
    this.canvas.width = 160;
    this.canvas.height = 144;
    this.wrap.appendChild(this.canvas);
    this.play.appendChild(this.wrap);

    this.howto = el('p', 'hall-howto', '');
    this.play.appendChild(this.howto);

    var actions = el('div', 'hall-actions');
    this.restartBtn = el('button', 'hall-btn hall-btn-main', '重新开始');
    this.restartBtn.type = 'button';
    this.muteBtn = el('button', 'hall-btn', '🔊 音效');
    this.muteBtn.type = 'button';
    actions.appendChild(this.restartBtn);
    actions.appendChild(this.muteBtn);
    this.play.appendChild(actions);

    /* ---- 结算 ---- */
    this.over = el('div', 'hall-over');
    this.over.setAttribute('hidden', 'hidden');
    this.overTitle = el('p', 'hall-over-title', '');
    this.overText = el('p', 'hall-over-text', '');
    var again = el('button', 'hall-btn hall-btn-main', '再来一局');
    again.type = 'button';
    this.over.appendChild(this.overTitle);
    this.over.appendChild(this.overText);
    this.over.appendChild(again);
    this.play.appendChild(this.over);

    root.appendChild(this.play);
    this.container.appendChild(root);
    this.root = root;

    /* ---- 事件 ---- */
    this.backBtn.addEventListener('click', function () { self.toMenu(); });
    this.restartBtn.addEventListener('click', function () { self.start(self.current); });
    again.addEventListener('click', function () { self.start(self.current); });
    this.muteBtn.addEventListener('click', function () {
      var muted = G.Sfx.toggle();
      self.muteBtn.textContent = muted ? '🔇 静音' : '🔊 音效';
    });

    this.renderMenu();

    if (opts.game && G.get(opts.game)) {
      this.start(opts.game);
    }
  };

  Hall.prototype.renderMenu = function () {
    var self = this;
    clear(this.grid);
    var games = G.list();
    for (var i = 0; i < games.length; i++) {
      (function (def) {
        var card = el('button', 'game-card');
        card.type = 'button';
        card.setAttribute('data-game', def.id);
        card.style.setProperty('--accent', def.accent || '#f0837a');
        var em = el('span', 'gc-emoji', def.emoji || '🎮');
        var tt = el('span', 'gc-title', def.title || def.id);
        var tg = el('span', 'gc-tag', def.tagline || '');
        var bs = el('span', 'gc-best', '最高分 ' + G.best(def.id));
        card.appendChild(em);
        card.appendChild(tt);
        card.appendChild(tg);
        card.appendChild(bs);
        card.addEventListener('click', function () { self.start(def.id); });
        self.grid.appendChild(card);
      })(games[i]);
    }
  };

  Hall.prototype.toMenu = function () {
    this.destroyStage();
    this.current = null;
    this.menu.removeAttribute('hidden');
    this.play.setAttribute('hidden', 'hidden');
    this.renderMenu();
  };

  Hall.prototype.destroyStage = function () {
    if (this.stage) {
      this.stage.destroy();
      this.stage = null;
    }
  };

  Hall.prototype.start = function (id) {
    var self = this;
    var def = G.get(id);
    if (!def) return;
    this.destroyStage();
    this.current = id;
    this.menu.setAttribute('hidden', 'hidden');
    this.play.removeAttribute('hidden');
    this.over.setAttribute('hidden', 'hidden');
    this.nameEl.textContent = (def.emoji || '🎮') + ' ' + (def.title || '');
    this.howto.textContent = def.howto || '';
    this.scoreNum.textContent = '0';
    this.bestNum.textContent = 'BEST ' + G.best(id);

    this.stage = G.createStage(this.canvas, id, {
      onScore: function (score) {
        score = Math.round(score || 0);
        self.scoreNum.textContent = String(score);
        var best = G.best(id);
        if (score > best) {
          G.saveBest(id, score);
          best = score;
        }
        self.bestNum.textContent = 'BEST ' + best;
      },
      onEnd: function (result) {
        var score = Math.round((result && result.score) || 0);
        G.saveBest(id, score);
        self.bestNum.textContent = 'BEST ' + G.best(id);
        self.overTitle.textContent = '摸鱼结束 · ' + score + ' 分';
        self.overText.textContent = (result && result.summary) ? result.summary : '今天也是辛苦摸鱼的一天。';
        self.over.removeAttribute('hidden');
        if (typeof global.HS_HALL.onFinish === 'function') {
          try { global.HS_HALL.onFinish(id, score); } catch (e) { }
        }
      }
    });

    if (this.stage) {
      this.stage.start();
      /* 布局定下来后再按容器宽度放大，避免第一帧糊 */
      if (global.setTimeout) global.setTimeout(function () { if (self.stage) self.stage.resize(); }, 30);
    }
  };

  /* ------------------------------------------------------------
   * 对外
   * ------------------------------------------------------------ */
  var HS_HALL = {
    mount: function (container, opts) {
      if (!container) return null;
      clear(container);
      var h = new Hall(container, opts);
      HS_HALL.instance = h;
      return h;
    },
    instance: null
  };

  global.HS_HALL = HS_HALL;
})(typeof window !== 'undefined' ? window : this);
