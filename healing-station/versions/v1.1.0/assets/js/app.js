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

  // 给元素写入 CSS 变量（兼容不支持 setProperty 的环境）
  function setFill(el, pct) {
    if (!el) return;
    var v = String(pct) + '%';
    if (el.style && typeof el.style.setProperty === 'function') el.style.setProperty('--fill', v);
    else if (el.style) el.style['--fill'] = v;
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
  function activateTab(target) {
    var tabs = $$('.tab');
    tabs.forEach(function (t) {
      var on = t.getAttribute('aria-controls') === target;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $$('.panel').forEach(function (p) {
      var on = p.id === target;
      p.classList.toggle('is-active', on);
      p.hidden = !on;
    });
  }

  function initTabs() {
    var tabs = $$('.tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = tab.getAttribute('aria-controls');
        activateTab(target);
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

  /* ---------- 模块三：摸鱼补给站 ---------- */
  var AUDIO = window.HS_AUDIO;

  function renderSounds() {
    var grid = $('#soundGrid');
    if (!grid || !AUDIO) return;
    grid.innerHTML = '';
    AUDIO.sounds.forEach(function (s) {
      var b = el('button', 'sound-btn');
      b.type = 'button';
      b.dataset.sound = s.id;
      b.appendChild(el('span', 'sound-emoji', s.emoji));
      var t = el('span', 'sound-text');
      t.appendChild(el('span', 'sound-name', s.name));
      t.appendChild(el('span', 'sound-desc', s.desc));
      b.appendChild(t);
      b.addEventListener('click', function () { toggleSound(s.id); });
      grid.appendChild(b);
    });
  }

  function soundName(id) {
    var list = (AUDIO && AUDIO.sounds) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].name;
    return id;
  }

  function syncSounds() {
    var cur = AUDIO ? AUDIO.currentId() : '';
    $$('.sound-btn').forEach(function (b) {
      var on = b.dataset.sound === cur;
      b.classList.toggle('is-playing', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function toggleSound(id) {
    if (!AUDIO) return;
    if (!AUDIO.supported()) { toast('这个浏览器不支持合成音效 🙈'); return; }
    AUDIO.toggle(id);
    syncSounds();
    toast(AUDIO.currentId() ? '正在播放：' + soundName(AUDIO.currentId()) + ' 🎧' : '安静一下，也很好 🌙');
  }

  /* ---------- 番茄钟 ---------- */
  var pomo = { mode: 'focus', total: 25 * 60 * 1000, left: 25 * 60 * 1000, endAt: 0, timer: null };

  function pomoLabel() {
    return pomo.mode === 'focus' ? '专注中' : '休息一下';
  }

  function pomoTotal() {
    return pomo.mode === 'focus' ? 25 * 60 * 1000 : 5 * 60 * 1000;
  }

  function pomoRender() {
    var left = Math.max(0, pomo.left);
    var m = Math.floor(left / 60000);
    var s = Math.floor((left % 60000) / 1000);
    var timeEl = $('#pomoTime');
    if (timeEl) timeEl.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    var modeEl = $('#pomoMode');
    if (modeEl) modeEl.textContent = pomoLabel() + (pomo.timer ? '' : '（未开始）');
    var ring = $('#pomoRing');
    if (ring) {
      var c = 2 * Math.PI * 52;
      var pct = pomo.total ? (left / pomo.total) : 0;
      ring.style.strokeDasharray = c.toFixed(1);
      ring.style.strokeDashoffset = (c * (1 - pct)).toFixed(1);
    }
  }

  function pomoStart() {
    if (pomo.timer) { pomoStop(); return; }
    if (pomo.left <= 0) pomo.left = pomo.total = pomoTotal();
    pomo.endAt = Date.now() + pomo.left;
    pomo.timer = setInterval(pomoTick, 250);
    pomoRender();
    toast(pomo.mode === 'focus' ? '开始专注，25 分钟后再见 ⏳' : '休息 5 分钟，走一走 🌿');
  }

  function pomoTick() {
    pomo.left = Math.max(0, pomo.endAt - Date.now());
    pomoRender();
    if (pomo.left <= 0) {
      pomoStop();
      if (AUDIO) { try { AUDIO.chime(); } catch (e) { /* 忽略 */ } }
      pomo.mode = pomo.mode === 'focus' ? 'break' : 'focus';
      pomo.total = pomoTotal();
      pomo.left = pomo.total;
      pomoRender();
      toast(pomo.mode === 'break' ? '叮！专注结束，去喝口水 ☕' : '叮！休息结束，回来继续 🌱');
    }
  }

  function pomoStop() {
    if (pomo.timer) { clearInterval(pomo.timer); pomo.timer = null; }
    pomoRender();
  }

  function pomoReset() {
    pomoStop();
    pomo.total = pomoTotal();
    pomo.left = pomo.total;
    pomoRender();
  }

  function pomoToggleMode() {
    pomoStop();
    pomo.mode = pomo.mode === 'focus' ? 'break' : 'focus';
    pomo.total = pomoTotal();
    pomo.left = pomo.total;
    pomoRender();
    toast(pomo.mode === 'focus' ? '切回 25 分钟专注 ⏳' : '切到 5 分钟休息 🌿');
  }

  /* ---------- 老板键 ---------- */
  function bossShow(show) {
    var screen = $('#bossScreen');
    if (!screen) return;
    screen.hidden = !show;
    document.body.classList.toggle('boss-mode', !!show);
    if (show && screen.focus) { try { screen.focus(); } catch (e) { /* 忽略 */ } }
  }

  function bossToggle() {
    var screen = $('#bossScreen');
    if (!screen) return;
    bossShow(screen.hidden);
  }

  /* ---------- 模块四：今日生存小游戏 ---------- */
  var storyState = null;

  function storyInit() {
    if (!storyState) storyState = E.storyStart();
    renderStory();
  }

  function renderHearts() {
    var box = $('#storyHearts');
    if (!box) return;
    var full = '❤'.repeat(Math.max(0, storyState.heart));
    var empty = '🤍'.repeat(Math.max(0, storyState.maxHeart - storyState.heart));
    box.textContent = full + empty + '　' + storyState.heart + '/' + storyState.maxHeart;
  }

  function renderStory() {
    var node = E.storyNode(storyState);
    if (node) {
      $('#storyEmoji').textContent = node.emoji;
      $('#storyScene').textContent = node.title;
      $('#storyText').textContent = node.text;
      renderHearts();
      var box = $('#storyChoices');
      box.innerHTML = '';
      node.choices.forEach(function (c, i) {
        var b = el('button', 'choice-btn');
        b.type = 'button';
        b.appendChild(el('span', 'choice-label', c.label));
        b.addEventListener('click', function () { storyChoose(i); });
        box.appendChild(b);
      });
      $('#storyEndingCard').hidden = true;
      $('#storyPath').hidden = true;
      var tip = $('#storyTip');
      if (tip) { tip.hidden = true; tip.textContent = ''; }
      return;
    }

    var end = E.storyEnding(storyState);
    if (!end) return;
    $('#storyEndGrade').textContent = '今日评级：' + end.grade;
    $('#storyEndTitle').textContent = end.emoji + ' ' + end.title;
    $('#storyEndDesc').textContent = end.desc;
    $('#storyEndComfort').textContent = end.comfort;
    $('#storyEndTip').textContent = end.tip;
    $('#storyEndingCard').hidden = false;
    var box2 = $('#storyChoices');
    if (box2) box2.innerHTML = '';
    var head = $('#storyScene');
    if (head) head.textContent = '故事结束';
    var emoji = $('#storyEmoji');
    if (emoji) emoji.textContent = end.emoji;
    var text = $('#storyText');
    if (text) text.textContent = end.desc;
  }

  function storyChoose(index) {
    E.storyMove(storyState, index);
    var last = storyState.path[storyState.path.length - 1];
    renderStory();
    if (last && last.tip) {
      var tip = $('#storyTip');
      if (tip) { tip.textContent = '💭 ' + last.tip; tip.hidden = false; }
    }
    if (E.storyIsEnd(storyState)) {
      bumpEnergy(2);
      toast('通关啦！看看你的结局 ✨');
    }
  }

  function storyRestart() {
    storyState = E.storyStart();
    renderStory();
    toast('新的一天，重新来过 🌅');
  }

  function storyShowPath() {
    var box = $('#storyPath');
    if (!box) return;
    if (!box.hidden) { box.hidden = true; return; }
    box.textContent = E.storyRecap(storyState) || '你还没有开始走这条路。';
    box.hidden = false;
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

    // 深链：#tab=fish / #tab=game / #tab=talk / #tab=clinic 直接打开对应面板
    var deep = /#tab=(clinic|talk|fish|game)/.exec(location.hash || '');
    if (deep) activateTab('panel-' + deep[1]);

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

    // 摸鱼补给站
    renderSounds();
    var vol = $('#volRange');
    if (vol && AUDIO) {
      AUDIO.setVolume(vol.value / 100);
      setFill(vol, vol.value);
      vol.addEventListener('input', function () {
        AUDIO.setVolume(vol.value / 100);
        setFill(vol, vol.value);
        var v = $('#volValue');
        if (v) v.textContent = vol.value + '%';
      });
    }
    var stopBtn = $('#soundStop');
    if (stopBtn) {
      stopBtn.addEventListener('click', function () {
        if (!AUDIO) return;
        AUDIO.stop();
        syncSounds();
        toast('安静一下，也很好 🌙');
      });
    }
    var bossBtn = $('#bossKey');
    if (bossBtn) bossBtn.addEventListener('click', function () { bossToggle(); });
    var bossScreen = $('#bossScreen');
    if (bossScreen) {
      bossScreen.addEventListener('click', function () { bossShow(false); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') bossToggle();
      });
    }

    // 番茄钟
    pomo.total = pomoTotal();
    pomo.left = pomo.total;
    pomoRender();
    var pStart = $('#pomoStart');
    if (pStart) pStart.addEventListener('click', pomoStart);
    var pReset = $('#pomoReset');
    if (pReset) pReset.addEventListener('click', pomoReset);
    var pMode = $('#pomoModeBtn');
    if (pMode) pMode.addEventListener('click', pomoToggleMode);

    // 今日生存小游戏
    storyInit();
    var sAgain = $('#storyAgain');
    if (sAgain) sAgain.addEventListener('click', storyRestart);
    var sRestart = $('#storyRestart');
    if (sRestart) sRestart.addEventListener('click', storyRestart);
    var sPath = $('#storyPathBtn');
    if (sPath) sPath.addEventListener('click', storyShowPath);

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
