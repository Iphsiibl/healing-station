/* =========================================================
   app.js · UI 层（经典脚本，file:// 双击即可运行）
   ========================================================= */
(function () {
  'use strict';

  var E = window.HS_ENGINE;
  var MOODS = window.HS_MOODS.moods;
  var SCENES = window.HS_SCENES.scenes;
  var TONES = window.HS_SCENES.tones;

  var STORE_KEY = 'healing-station:v1';

  var state = {
    mood: null,
    keyword: '',
    scene: null,
    tone: 'safe',
    seed: 0,
    clinicSeed: 0,
    replySeed: 0,
    energy: 0
  };

  /* ---------- 小工具 ---------- */
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function loadStore() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return {};
      return JSON.parse(raw) || {};
    } catch (e) { return {}; }
  }

  function saveStore(patch) {
    try {
      var data = loadStore();
      for (var k in patch) { if (Object.prototype.hasOwnProperty.call(patch, k)) data[k] = patch[k]; }
      window.localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) { /* 隐私模式下 localStorage 不可用，忽略即可 */ }
  }

  function copyText(text, okMsg) {
    var done = function () { toast(okMsg || '已复制到剪贴板 ✅'); };
    var fail = function () { toast('复制失败，请手动选中文字复制 🥲'); };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text) ? done() : fail(); });
    } else {
      legacyCopy(text) ? done() : fail();
    }
  }

  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  function toast(msg) {
    var old = document.querySelector('.hs-toast');
    if (old) old.remove();
    var t = el('div', 'hs-toast', msg);
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('is-out'); }, 1800);
    setTimeout(function () { t.remove(); }, 2400);
  }

  function bumpEnergy(n) {
    state.energy += (n || 1);
    saveStore({ energy: state.energy, energyDate: today() });
    renderEnergy();
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function renderEnergy() {
    var chip = $('#energyChip');
    if (!chip) return;
    var todayStr = today();
    var data = loadStore();
    if (data.energyDate !== todayStr) {
      state.energy = 0;
      data.energy = 0;
      data.energyDate = todayStr;
      saveStore({ energy: 0, energyDate: todayStr });
    }
    var level = state.energy >= 10 ? '💖' : state.energy >= 4 ? '🌿' : '🌱';
    chip.textContent = level + ' 疗愈指数 ' + state.energy;
    chip.title = '今天你在这里被哄了 ' + state.energy + ' 次';
  }

  /* ---------- 主题（白天 / 夜晚） ---------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var btn = $('#themeToggle');
    if (btn) {
      btn.textContent = theme === 'night' ? '☀️ 白天模式' : '🌗 夜晚模式';
      btn.setAttribute('aria-pressed', theme === 'night' ? 'true' : 'false');
    }
  }

  /* ---------- Tab 切换 ---------- */
  function initTabs() {
    var tabs = $$('.tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) {
          var on = t === tab;
          t.classList.toggle('is-active', on);
          t.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        var target = tab.getAttribute('aria-controls');
        $$('.panel').forEach(function (p) {
          var on = p.id === target;
          p.classList.toggle('is-active', on);
          p.hidden = !on;
        });
        saveStore({ lastTab: target });
      });
    });
  }

  /* ---------- 模块一：情绪急诊室 ---------- */
  function renderMoods() {
    var grid = $('#moodGrid');
    grid.innerHTML = '';
    MOODS.forEach(function (m) {
      var b = el('button', 'mood-btn');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', 'false');
      b.dataset.mood = m.id;
      b.appendChild(el('span', 'mood-emoji', m.emoji));
      var text = el('span', 'mood-text');
      text.appendChild(el('span', 'mood-name', m.name));
      text.appendChild(el('span', 'mood-desc', m.desc));
      b.appendChild(text);
      b.addEventListener('click', function () { selectMood(m.id); });
      grid.appendChild(b);
    });
  }

  function selectMood(id) {
    state.mood = id;
    $$('.mood-btn').forEach(function (b) {
      var on = b.dataset.mood === id;
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  function renderClinicResult(r) {
    $('#clinicMoodName').textContent = r.moodEmoji + ' ' + r.moodName + (r.matchedKeywords.length ? ' · 关键词：' + r.matchedKeywords.join('、') : '');
    $('#clinicTitle').textContent = r.title;
    $('#clinicCause').textContent = r.cause;

    var analysis = $('#clinicAnalysis');
    analysis.innerHTML = '';
    r.analysis.forEach(function (line) { analysis.appendChild(el('li', null, line)); });

    var rem = $('#clinicRemedies');
    rem.innerHTML = '';
    r.remedies.forEach(function (x, i) {
      var li = el('li');
      li.appendChild(el('span', 'remedy-title', (i + 1) + '. ' + x.t));
      li.appendChild(el('span', 'remedy-desc', x.d));
      rem.appendChild(li);
    });

    $('#clinicBlessing').textContent = r.blessing;

    var card = $('#clinicResult');
    card.hidden = false;
    card.classList.remove('is-fresh');
    void card.offsetWidth; // 重启动画
    card.classList.add('is-fresh');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function doDiagnose(reroll) {
    if (!state.mood) {
      toast('先选一个今天的心情吧 🫶');
      return;
    }
    state.keyword = $('#clinicKeyword').value.trim();
    state.clinicSeed = reroll ? state.clinicSeed + 1 : state.clinicSeed;
    var r = E.diagnose(state.mood, state.keyword, state.clinicSeed);
    if (!r) { toast('出了点小问题，请再试一次'); return; }
    renderClinicResult(r);
    bumpEnergy(1);
  }

  /* ---------- 模块二：社恐话术机 ---------- */
  function renderScenes() {
    var grid = $('#sceneGrid');
    grid.innerHTML = '';
    SCENES.forEach(function (s) {
      var b = el('button', 'scene-btn');
      b.type = 'button';
      b.dataset.scene = s.id;
      b.appendChild(el('span', 'scene-emoji', s.emoji));
      var sText = el('span', 'scene-text');
      sText.appendChild(el('span', 'scene-name', s.name));
      sText.appendChild(el('span', 'scene-desc', s.desc));
      b.appendChild(sText);
      b.addEventListener('click', function () { selectScene(s.id); });
      grid.appendChild(b);
    });
  }

  function selectScene(id) {
    state.scene = id;
    state.replySeed = 0;
    $$('.scene-btn').forEach(function (b) {
      b.classList.toggle('is-selected', b.dataset.scene === id);
    });
    renderTalk();
  }

  function renderTalk(reroll) {
    if (!state.scene) {
      toast('先挑一个今天遇到的场面 🎬');
      return;
    }
    if (reroll) state.replySeed += 1;
    var r = E.reply(state.scene, state.tone, state.replySeed);
    if (!r) { toast('这个场景还没有话术，换一个试试'); return; }

    $('#talkSceneName').textContent = r.sceneEmoji + ' ' + r.sceneName;
    $('#talkTitle').textContent = r.sceneDesc;
    $('#replyText').textContent = r.text;
    $('#talkTip').textContent = '💡 ' + r.tip;

    $$('.tone-btn').forEach(function (b) {
      var on = b.dataset.tone === state.tone;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    var card = $('#talkResult');
    card.hidden = false;
    card.classList.remove('is-fresh');
    void card.offsetWidth;
    card.classList.add('is-fresh');
    if (!reroll) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    bumpEnergy(1);
  }

  /* ---------- 初始化 ---------- */
  function init() {
    var store = loadStore();

    // 主题
    applyTheme(store.theme === 'night' ? 'night' : 'day');
    var themeBtn = $('#themeToggle');
    themeBtn.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'night' ? 'day' : 'night';
      applyTheme(next);
      saveStore({ theme: next });
    });

    // 能量
    state.energy = (store.energyDate === today()) ? (store.energy || 0) : 0;
    renderEnergy();

    initTabs();

    // 急诊室
    renderMoods();
    $('#clinicForm').addEventListener('submit', function (e) {
      e.preventDefault();
      doDiagnose(false);
    });
    $('#clinicAgain').addEventListener('click', function () { doDiagnose(true); });
    $('#clinicCopy').addEventListener('click', function () {
      var r = E.diagnose(state.mood, state.keyword, state.clinicSeed);
      if (!r) { toast('还没有诊断单哦'); return; }
      copyText(r.copyText, '诊断单已复制，拿去群里发 📋');
    });
    $('#clinicShare').addEventListener('click', function () {
      var url = location.href.split('#')[0] + '#clinic=' + encodeURIComponent(state.mood || 'tired');
      copyText(url, '链接已复制，分享给同事 🤝');
    });

    // 话术机
    renderScenes();
    $$('.tone-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        state.tone = b.dataset.tone;
        renderTalk(false);
      });
    });
    $('#replyCopy').addEventListener('click', function () {
      copyText($('#replyText').textContent, '话术已复制，粘贴即用 📋');
    });
    $('#replyReroll').addEventListener('click', function () { renderTalk(true); });

    // 清空本地记录
    $('#resetData').addEventListener('click', function (e) {
      e.preventDefault();
      try { window.localStorage.removeItem(STORE_KEY); } catch (err) { /* ignore */ }
      state.energy = 0;
      renderEnergy();
      toast('本地记录已清空，重新开始 🤍');
    });

    // 支持链接直达：#clinic=mood
    var m = /#clinic=([a-z_]+)/.exec(location.hash);
    if (m && E.findMood(m[1])) {
      selectMood(m[1]);
      doDiagnose(false);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
