/* =========================================================
   uitest.js · 零依赖"无头 DOM"冒烟测试
   目的：本机没有可用浏览器（无 Chrome/Edge），因此自建一个够用的小型 DOM，
        把 index.html 解析成树，把 app.js 真的跑起来，模拟点击并断言渲染结果。
   用法：node tools/uitest.js
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

/* ---------------- 迷你 DOM ---------------- */

const VOID_TAGS = new Set(['meta', 'link', 'br', 'hr', 'img', 'input', 'source', 'area', 'base', 'col', 'embed', 'param', 'track', 'wbr']);

class ClassList {
  constructor(node) { this.node = node; this.set = new Set(); }
  add(...names) { names.forEach(n => n && this.set.add(n)); this.sync(); }
  remove(...names) { names.forEach(n => this.set.delete(n)); this.sync(); }
  contains(n) { return this.set.has(n); }
  toggle(n, force) {
    const on = force === undefined ? !this.set.has(n) : !!force;
    if (on) this.set.add(n); else this.set.delete(n);
    this.sync();
    return on;
  }
  sync() { this.node._className = Array.from(this.set).join(' '); }
  get value() { return Array.from(this.set).join(' '); }
}

class Node {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.id = '';
    this.childNodes = [];
    this.attributes = {};
    this.dataset = {};
    this._className = '';
    this._text = '';
    this.hidden = false;
    this.value = '';
    this.style = {
      setProperty(k, v) { this[k] = String(v); },
      removeProperty(k) { delete this[k]; }
    };
    this.parentNode = null;
    this.listeners = {};
    this.classList = new ClassList(this);
  }
  get className() { return this._className; }
  set className(v) {
    this._className = v || '';
    this.classList.set = new Set(String(v || '').split(/\s+/).filter(Boolean));
  }
  get children() { return this.childNodes.filter(n => n instanceof Node); }
  get firstChild() { return this.childNodes[0] || null; }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] || null; }
  get offsetWidth() { return 100; }
  setAttribute(name, value) {
    if (name === 'class') { this.className = value; return; }
    if (name === 'hidden') { this.hidden = true; this.attributes.hidden = ''; return; }
    if (name === 'id') { this.id = String(value); this.attributes.id = String(value); return; }
    if (name === 'value') { this.value = String(value); this.attributes.value = String(value); return; }
    this.attributes[name] = String(value);
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (m, c) => c.toUpperCase());
      this.dataset[key] = String(value);
    }
  }
  getAttribute(name) {
    if (name === 'class') return this._className;
    return this.attributes[name] !== undefined ? this.attributes[name] : null;
  }
  removeAttribute(name) {
    delete this.attributes[name];
    if (name === 'hidden') { this.hidden = false; return; }
    if (name === 'class') { this.className = ''; return; }
    if (name === 'id') { this.id = ''; this.attributes.id = ''; return; }
    if (name === 'value') { this.value = ''; return; }
  }
  appendChild(child) { child.parentNode = this; this.childNodes.push(child); return child; }
  removeChild(child) {
    const i = this.childNodes.indexOf(child);
    if (i >= 0) this.childNodes.splice(i, 1);
    child.parentNode = null;
    return child;
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  get textContent() {
    if (this.childNodes.length === 0) return this._text;
    return this.childNodes.map(n => (n instanceof Node ? n.textContent : n._text)).join('');
  }
  set textContent(v) { this.childNodes = []; this._text = String(v); }
  set innerHTML(v) { if (v === '') { this.childNodes = []; this._text = ''; } }
  get innerHTML() { return ''; }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  dispatch(type) {
    const ev = { type, target: this, preventDefault() {}, stopPropagation() {} };
    (this.listeners[type] || []).forEach(fn => fn.call(this, ev));
    return ev;
  }
  scrollIntoView() { /* noop */ }
  focus() { /* noop */ }
  select() { /* noop */ }
  click() {
    const ev = { type: 'click', target: this, preventDefault() {}, stopPropagation() {} };
    (this.listeners.click || []).forEach(fn => fn.call(this, ev));
  }
  submit() {
    const ev = { type: 'submit', target: this, preventDefault() {}, stopPropagation() {} };
    (this.listeners.submit || []).forEach(fn => fn.call(this, ev));
  }
  descendants() {
    const out = [];
    const walk = n => { n.childNodes.forEach(c => { if (c instanceof Node) { out.push(c); walk(c); } }); };
    walk(this);
    return out;
  }
  matches(sel) {
    sel = sel.trim();
    if (!sel) return false;
    const tagMatch = sel.match(/^[a-zA-Z][\w-]*/);
    let rest = tagMatch ? sel.slice(tagMatch[0].length) : sel;
    if (tagMatch && this.tagName !== tagMatch[0].toUpperCase()) return false;
    const idMatch = rest.match(/#([\w-]+)/);
    if (idMatch) {
      if (this.getAttribute('id') !== idMatch[1]) return false;
      rest = rest.replace('#' + idMatch[1], '');
    }
    if (rest) {
      const classes = rest.split('.').filter(Boolean);
      for (const c of classes) if (!this.classList.contains(c)) return false;
    }
    return true;
  }
  querySelectorAll(sel) {
    const groups = sel.split(',').map(s => s.trim()).filter(Boolean);
    const all = this.descendants();
    const out = [];
    groups.forEach(g => {
      const parts = g.split(/\s+/).filter(Boolean);
      all.forEach(n => {
        if (out.indexOf(n) !== -1) return;
        if (matchesComplex(n, parts)) out.push(n);
      });
    });
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

/* --- 祖先后代选择器：'#a .b' --- */
function matchesComplex(node, parts) {
  if (!parts.length) return false;
  if (!node.matches(parts[parts.length - 1])) return false;
  let idx = parts.length - 2;
  let cur = node.parentNode;
  while (idx >= 0 && cur) {
    if (cur instanceof Node && cur.matches(parts[idx])) idx--;
    cur = cur.parentNode;
  }
  return idx < 0;
}

/* --- 假的 canvas 2D 上下文：只记录调用，不真的画 --- */
function makeFakeCtx() {
  const noop = () => {};
  return {
    canvas: null,
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1,
    imageSmoothingEnabled: false, font: '', textAlign: 'left', textBaseline: 'top',
    fillRect: noop, strokeRect: noop, clearRect: noop, fillText: noop, strokeText: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
    fill: noop, stroke: noop, save: noop, restore: noop, translate: noop, rotate: noop,
    scale: noop, setTransform: noop, resetTransform: noop, drawImage: noop, createLinearGradient: () => ({ addColorStop: noop }),
    measureText: () => ({ width: 10 })
  };
}

/* --- 极简 HTML 解析：只支持本项目用到的标签与属性 --- */
function parseHTML(html) {
  const root = new Node('root');
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^<>]*?)?)(\/?)>/g;
  let last = 0, m;
  while ((m = re.exec(html)) !== null) {
    const text = html.slice(last, m.index);
    if (text.trim()) stack[stack.length - 1].appendChild(new Node('#text'))._text = text;
    last = re.lastIndex;
    if (m[0].startsWith('<!')) continue;
    if (m[1]) { // 闭合标签
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tagName === m[1].toUpperCase()) { stack.length = i; break; }
      }
      continue;
    }
    const tag = m[2];
    const attrStr = m[3] || '';
    const node = new Node(tag);
    const attrRe = /([a-zA-Z_:][-\w:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
    let a;
    while ((a = attrRe.exec(attrStr)) !== null) {
      const val = a[2] !== undefined ? a[2] : (a[3] !== undefined ? a[3] : (a[4] !== undefined ? a[4] : ''));
      node.setAttribute(a[1], val);
    }
    if (tag === 'script' || tag === 'style') {
      // 跳过脚本/样式内容
      const close = html.indexOf('</' + tag, last);
      const end = close === -1 ? html.length : close;
      last = end;
      re.lastIndex = end;
    }
    stack[stack.length - 1].appendChild(node);
    if (!VOID_TAGS.has(tag) && m[4] !== '/') stack.push(node);
  }
  return root;
}

/* ---------------- 断言 ---------------- */
let failures = 0, checks = 0;
function ok(cond, label, extra) {
  checks++;
  if (cond) console.log('  ✓ ' + label);
  else { failures++; console.log('  ✗ ' + label + (extra ? ' → ' + extra : '')); }
}

/* ---------------- 模拟 Web Audio（用于测试真实播放链路） ---------------- */
function mockParam(v) {
  return {
    value: v === undefined ? 0 : v,
    setValueAtTime: function () { return this; },
    exponentialRampToValueAtTime: function () { return this; },
    cancelScheduledValues: function () { return this; },
    setTargetAtTime: function () { return this; },
    connect: function () { return this; },
    disconnect: function () { return this; }
  };
}
function mockNode() {
  return {
    gain: mockParam(1),
    frequency: mockParam(440),
    Q: mockParam(1),
    type: '',
    buffer: null,
    loop: false,
    connect: function () { return this; },
    disconnect: function () { return this; },
    start: function () {},
    stop: function () {}
  };
}
function MockAudioContext() {
  this.state = 'running';
  this.sampleRate = 8000;      // 降低采样率，测试里生成噪声更快
  this.currentTime = 0;
  this.destination = {};
}
MockAudioContext.prototype.createGain = mockNode;
MockAudioContext.prototype.createOscillator = mockNode;
MockAudioContext.prototype.createBiquadFilter = mockNode;
MockAudioContext.prototype.createBufferSource = mockNode;
MockAudioContext.prototype.createBuffer = function (ch, len) {
  return { getChannelData: function () { return new Float32Array(len); } };
};
MockAudioContext.prototype.resume = function () { this.state = 'running'; return Promise.resolve(); };

/* ---------------- 搭建运行环境（可重复启动，测试深链） ---------------- */
let document, store, sandbox, $, $$;

function boot(hash, seed) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dom = parseHTML(html);

  const rootNode = new Node('html');
  const bodyNode = new Node('body');
  document = {
    readyState: 'complete',
    documentElement: rootNode,
    body: bodyNode,
    createElement(tag) {
      const n = new Node(tag);
      /* 画布：给游戏内核一个最小可用的 2D 上下文，测试里只关心"能建起来" */
      if (String(tag).toLowerCase() === 'canvas') {
        n.width = 0; n.height = 0;
        n.getContext = () => makeFakeCtx();
        n.getBoundingClientRect = () => ({ width: 480, height: 432, left: 0, top: 0, right: 480, bottom: 432 });
      }
      return n;
    },
    // 从 rootNode 查询，这样运行时 appendChild 到 body 的节点（如 toast）也能查到
    querySelector(sel) { return rootNode.querySelector(sel); },
    querySelectorAll(sel) { return rootNode.querySelectorAll(sel); },
    execCommand() { return true; },
    addEventListener() {}
  };

  // 把 index.html 的 body 子树搬进 document.body
  const parsedBody = dom.querySelector('body');
  if (parsedBody) parsedBody.childNodes.forEach(c => bodyNode.appendChild(c));
  rootNode.appendChild(bodyNode);

  // 依据 html 上的属性初始化 documentElement
  const parsedHtml = dom.querySelector('html');
  if (parsedHtml) {
    Object.keys(parsedHtml.attributes).forEach(k => document.documentElement.setAttribute(k, parsedHtml.attributes[k]));
  }

  store = seed ? JSON.parse(JSON.stringify(seed)) : {};
  const localStorage = {
    getItem(k) { return store[k] !== undefined ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; }
  };

  sandbox = {
    document,
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage,
    navigator: { clipboard: undefined },
    isSecureContext: false,
    AudioContext: MockAudioContext,
    webkitAudioContext: MockAudioContext,
    location: { href: 'http://localhost/healing-station/index.html', hash: hash || '' },
    Math, JSON, Date, String, Number, Object, Array, Boolean, RegExp, Error, isNaN, parseInt, parseFloat
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  $ = sel => document.querySelector(sel);
  $$ = sel => document.querySelectorAll(sel);
  return { document, store, sandbox };
}

function runScript(file) {
  const code = fs.readFileSync(path.join(ROOT, 'assets', 'js', file), 'utf8');
  vm.runInContext(code, sandbox, { filename: file });
}

/* 游戏内核与四款小游戏（在 app.js 之前加载，跟 index.html 的顺序一致） */
const GAME_FILES = ['pixel.js', 'sprites.js', 'game-mole.js', 'game-dodge.js', 'game-match3.js', 'game-fish.js', 'hall.js'];
function runGames() {
  GAME_FILES.forEach(f => {
    const code = fs.readFileSync(path.join(ROOT, 'games', f), 'utf8');
    vm.runInContext(code, sandbox, { filename: 'games/' + f });
  });
}

/* 一次性把整个应用加载起来 */
function loadApp() {
  runScript('data-moods.js');
  runScript('data-scenes.js');
  runScript('data-story.js');
  runScript('engine.js');
  runScript('audio.js');
  runGames();
  runScript('app.js');
}

boot('');

console.log('\n== 无头 DOM 冒烟测试 ==');
try {
  loadApp();
  ok(true, '应用脚本（含游戏）在无头环境中加载无异常');
} catch (e) {
  ok(false, '脚本加载无异常', e && e.message);
}

/* ---------------- 渲染断言 ---------------- */
ok($$('.mood-btn').length === 8, '情绪按钮渲染 8 个', String($$('.mood-btn').length));
ok($$('.scene-btn').length === 16, '场景按钮渲染 16 个', String($$('.scene-btn').length));
ok($('#moodGrid').textContent.includes('累瘫了'), '心情文案已注入');
ok($('#sceneGrid').textContent.includes('老板催进度'), '场景文案已注入');

/* 心情选择 + 诊断 */
$$('.mood-btn')[0].click();
ok($$('.mood-btn')[0].classList.contains('is-selected'), '点击后心情被标记为选中');
ok($('#moodGrid').querySelectorAll('.mood-btn')[0].getAttribute('aria-checked') === 'true', '选中态同步 aria-checked');

$('#clinicKeyword').value = '最近一直在加班';
$('#clinicForm').submit();
ok($('#clinicResult').hidden === false, '诊断后结果卡显示');
ok($('#clinicTitle').textContent.length > 2, '诊断标题已填充：' + $('#clinicTitle').textContent);
ok($('#clinicCause').textContent.length > 5, '病因已填充');
ok($$('#clinicAnalysis li').length >= 2, '病历分析渲染为列表项', String($$('#clinicAnalysis li').length));
ok($$('#clinicRemedies li').length === 3, '处方渲染 3 条', String($$('#clinicRemedies li').length));
ok($('#clinicRemedies').textContent.includes('加班'), '关键词「加班」处方生效');
ok($('#clinicBlessing').textContent.length > 4, '护士寄语已填充');
ok($('#clinicMoodName').textContent.includes('加班'), '诊断单头部显示命中关键词');

const title1 = $('#clinicTitle').textContent;
$('#clinicAgain').click();
ok($('#clinicTitle').textContent !== title1, '「换一张诊断单」换出了不同结果');

/* 话术机 */
$$('.scene-btn')[0].click();
ok($('#talkResult').hidden === false, '选中场景后话术卡显示');
ok($('#replyText').textContent.length > 6, '话术文本已填充：' + $('#replyText').textContent.slice(0, 18) + '…');
ok($('#talkTip').textContent.includes('💡'), '场景提示已渲染');
const reply1 = $('#replyText').textContent;
$('#replyReroll').click();
ok($('#replyText').textContent !== reply1, '「换一句」换出了不同话术');

const toneBtns = $$('.tone-btn');
ok(toneBtns.length === 3, '语气按钮 3 个');
toneBtns[2].click();
ok(toneBtns[2].classList.contains('is-active'), '切换到「浪」语气后按钮高亮');
ok($('#replyText').textContent !== reply1, '切换语气后话术随之改变');
const wildReply = $('#replyText').textContent;
$('#replyReroll').click();
ok($('#replyText').textContent !== wildReply, '「浪」语气下换一句同样有效');

/* 复制 */
$('#replyCopy').click();
ok(true, '点击复制未抛异常');

/* Tab 切换 */
const tabs = $$('.tab');
ok(tabs.length === 6, '功能标签 6 个', String(tabs.length));
tabs[1].click();
ok($('#panel-talk').hidden === false && $('#panel-clinic').hidden === true, '切换到话术机面板',
  'talk.hidden=' + $('#panel-talk').hidden + ' clinic.hidden=' + $('#panel-clinic').hidden);
tabs[0].click();
ok($('#panel-clinic').hidden === false, '切回急诊室面板', 'clinic.hidden=' + $('#panel-clinic').hidden);
tabs[2].click();
ok($('#panel-fish').hidden === false && $('#panel-clinic').hidden === true, '切换到摸鱼补给站面板');
tabs[3].click();
ok($('#panel-game').hidden === false, '切换到小游戏面板');
tabs[4].click();
ok($('#panel-games').hidden === false, '切换到摸鱼游戏厅面板');
ok(!!sandbox.HS_GAMES && sandbox.HS_GAMES.list().length === 4, '游戏厅注册了 4 款小游戏',
  sandbox.HS_GAMES ? String(sandbox.HS_GAMES.list().length) : 'no HS_GAMES');
ok($$('#gameHall .game-card').length === 4, '游戏厅渲染 4 张游戏卡片',
  String($$('#gameHall .game-card').length));

/* 点开一款游戏：真的能进舞台 */
const gameCard0 = $$('#gameHall .game-card')[0];
if (gameCard0) {
  gameCard0.click();
  ok($('#gameHall .hall-play').hidden === false, '点开游戏卡片后进入舞台');
  ok($('#gameHall .hall-name').textContent.length > 1, '舞台显示游戏名：' + $('#gameHall .hall-name').textContent);
  ok($$('#gameHall .hall-canvas').length === 1, '舞台挂上了像素画布');
  ok($('#gameHall .hall-howto').textContent.length > 4, '舞台有玩法说明：' + $('#gameHall .hall-howto').textContent.slice(0, 18) + '…');
  ok($('#gameHall .hs-best').textContent.includes('BEST'), '舞台显示最高分：' + $('#gameHall .hs-best').textContent);
  const backBtn = $('#gameHall .hall-btn');
  if (backBtn) {
    backBtn.click();
    ok($('#gameHall .hall-menu').hidden === false, '「回大厅」能退回菜单');
  }
} else {
  ok(false, '找到游戏卡片');
}
tabs[5].click();
ok($('#panel-report').hidden === false, '切换到疗愈周报面板');
tabs[0].click();

/* 摸鱼补给站：背景音（用 Mock AudioContext 跑通真实播放链路） */
ok($$('.sound-btn').length === 6, '背景音按钮渲染 6 个', String($$('.sound-btn').length));
ok($('#soundGrid').textContent.includes('窗外在下雨'), '背景音文案已注入');
ok(!!sandbox.HS_AUDIO && sandbox.HS_AUDIO.supported() === true, '合成音频在测试环境中可用');
const soundBtns = $$('.sound-btn');
soundBtns[0].click();
ok(sandbox.HS_AUDIO.currentId() === 'rain', '点击背景音按钮真的开始播放（当前音效=rain）', String(sandbox.HS_AUDIO.currentId()));
ok(soundBtns[0].classList.contains('is-playing'), '播放中的按钮有 is-playing 样式');
ok(soundBtns[0].getAttribute('aria-pressed') === 'true', '播放中的按钮同步 aria-pressed=true');
ok($('#soundStatus').textContent.includes('正在播放'), '状态行提示正在播放', $('#soundStatus').textContent);
const toastEl = $('.hs-toast');
ok(!!toastEl && toastEl.textContent.includes('正在播放'), '点击后出现播放提示 toast', toastEl ? toastEl.textContent : 'none');
soundBtns[0].click();
ok(sandbox.HS_AUDIO.currentId() === '', '再点一次可以停下', String(sandbox.HS_AUDIO.currentId()));
ok(!soundBtns[0].classList.contains('is-playing'), '停下后按钮取消高亮');
soundBtns[2].click();
ok(sandbox.HS_AUDIO.currentId() === 'subway', '可以切换到另一个背景音', String(sandbox.HS_AUDIO.currentId()));
ok(soundBtns[2].classList.contains('is-playing') && !soundBtns[0].classList.contains('is-playing'), '切换音效时旧按钮取消高亮');
$('#soundStop').click();
ok(sandbox.HS_AUDIO.currentId() === '', '停止按钮能清空当前音效', String(sandbox.HS_AUDIO.currentId()));
ok($('#soundStatus').textContent.includes('还没有在放声音'), '停止后状态行回到空闲文案', $('#soundStatus').textContent);
const vol = $('#volRange');
vol.value = '30';
vol.dispatch('input');
ok($('#volValue').textContent === '30%', '音量滑块联动数值', $('#volValue').textContent);

/* 番茄钟 */
ok($('#pomoTime').textContent === '25:00', '番茄钟初始显示 25:00', $('#pomoTime').textContent);
$('#pomoModeBtn').click();
ok($('#pomoTime').textContent === '05:00', '切换到休息模式显示 05:00', $('#pomoTime').textContent);
$('#pomoModeBtn').click();
ok($('#pomoTime').textContent === '25:00', '切回专注模式');
$('#pomoReset').click();
ok($('#pomoTime').textContent === '25:00', '重置番茄钟');

/* 老板键 */
ok($('#bossScreen').hidden === true, '老板键初始隐藏');
$('#bossKey').click();
ok($('#bossScreen').hidden === false, '点击老板键弹出伪装界面');
$('#bossScreen').click();
ok($('#bossScreen').hidden === true, '点击伪装界面可返回');

/* 今日生存小游戏 */
ok($$('#storyChoices .choice-btn').length >= 2, '故事选项已渲染', String($$('#storyChoices .choice-btn').length));
ok($('#storyScene').textContent.length > 2, '故事场景标题已填充：' + $('#storyScene').textContent);
const scene0 = $('#storyScene').textContent;
$$('#storyChoices .choice-btn')[0].click();
ok($('#storyScene').textContent !== scene0, '做出选择后场景推进', $('#storyScene').textContent);
ok($('#storyTip').hidden === false, '选择回响提示已显示');

let guard = 0;
while ($('#storyEndingCard').hidden === true && guard < 30) {
  const cs = $$('#storyChoices .choice-btn');
  if (!cs.length) break;
  cs[0].click();
  guard++;
}
ok($('#storyEndingCard').hidden === false, '一路选择可以走到结局', '步数 ' + guard);
ok($('#storyEndTitle').textContent.includes('结局'), '结局标题已渲染：' + $('#storyEndTitle').textContent);
ok($('#storyEndComfort').textContent.length > 4, '结局安慰语已填充');
$('#storyPathBtn').click();
ok($('#storyPath').hidden === false && $('#storyPath').textContent.includes('1.'), '路径回顾已展示');
$('#storyRestart').click();
ok($('#storyEndingCard').hidden === true && $('#storyScene').textContent.includes('早上'), '重新开始可回到第一幕',
  $('#storyScene').textContent);

/* 疗愈周报 */
tabs[5].click();
ok($('#panel-report').hidden === false, '周报面板可见');
ok($('#reportEmpty').hidden === true, '有数据时不显示空状态');
ok($('#reportSummary').textContent.includes('被哄了'), '周报小结已生成：' + $('#reportSummary').textContent.slice(0, 22) + '…');
ok($$('#reportStats .report-stat').length === 6, '统计小卡 6 个', String($$('#reportStats .report-stat').length));
ok($$('#reportChart .report-col').length === 7, '近 7 天柱状图 7 列', String($$('#reportChart .report-col').length));
ok($$('#reportTags .report-tag').length >= 1, '高频关键词标签已生成');
$('#reportCopy').click();
ok(true, '复制周报未抛异常');
$('#reportToClinic').click();
ok($('#panel-clinic').hidden === false, '从周报可一键回到急诊室');

/* 头部疗愈指数 → 周报 */
$('#energyChip').click();
ok($('#panel-report').hidden === false, '点击疗愈指数直达周报');

/* 主题 */
const themeBtn = $('#themeToggle');
themeBtn.click();
ok(document.documentElement.getAttribute('data-theme') === 'night', '夜间模式生效');
themeBtn.click();
ok(document.documentElement.getAttribute('data-theme') === 'day', '白天模式恢复');

/* 能量与存储 */
ok($('#energyChip').textContent.includes('疗愈指数'), '疗愈指数显示：' + $('#energyChip').textContent);
ok(Object.keys(store).length > 0, '本地存储已写入', JSON.stringify(store).slice(0, 80));
const seed = JSON.parse(JSON.stringify(store));   // 清空前留一份，用于「记忆上次心情」
$('#resetData').click();
const afterReset = JSON.parse(store['healing-station:v1'] || '{}');
ok(afterReset.theme === undefined && afterReset.lastTab === undefined, '清空本地记录：主题/面板记忆已移除', JSON.stringify(afterReset));
ok(afterReset.energy === 0, '清空后疗愈指数归零', String(afterReset.energy));

/* 深链：#tab=game 直达小游戏面板 */
boot('#tab=game');
try {
  loadApp();
} catch (e) {
  ok(false, '深链场景脚本加载无异常', e && e.message);
}
ok($('#panel-game').hidden === false, '深链 #tab=game 直接打开小游戏面板');
ok($('#panel-clinic').hidden === true, '深链场景下其他面板被隐藏');
ok($$('#storyChoices .choice-btn').length >= 2, '深链场景故事选项已渲染');

/* 深链：#tab=fish 直达摸鱼补给站 */
boot('#tab=fish');
try {
  loadApp();
} catch (e) {
  ok(false, '深链场景脚本加载无异常', e && e.message);
}
ok($('#panel-fish').hidden === false, '深链 #tab=fish 直接打开摸鱼补给站');
ok($$('.sound-btn').length === 6, '深链场景背景音按钮渲染 6 个');

/* 深链：#tab=report 直达疗愈周报 */
boot('#tab=report', seed);
try {
  loadApp();
} catch (e) {
  ok(false, '深链场景脚本加载无异常', e && e.message);
}
ok($('#panel-report').hidden === false, '深链 #tab=report 直接打开疗愈周报面板');
ok($('#reportEmpty').hidden === true, '深链场景下沿用历史记录，周报有数据');
ok($$('#reportStats .report-stat').length === 6, '深链场景统计小卡 6 个');

/* 记忆上次心情：带着旧记录重新进入 */
boot('', seed);
try {
  loadApp();
} catch (e) {
  ok(false, '重进场景脚本加载无异常', e && e.message);
}
ok($('#clinicWelcome').hidden === false, '再次进入时提示上次心情');
ok($('#clinicWelcome').textContent.includes('上次你走进来时'), '欢迎语文案正确');
const wb = $('#clinicWelcome').querySelector('.welcome-btn');
ok(!!wb, '欢迎语带「接着上次继续」按钮');
if (wb) {
  wb.click();
  ok($$('.mood-btn').some(b => b.classList.contains('is-selected')), '点击欢迎按钮可回到上次的那个心情');
}

/* 空状态：清空记录后周报回到空态 */
$('#resetData').click();
$('#energyChip').click();
ok($('#reportEmpty').hidden === false, '清空记录后周报显示空状态');

console.log('\n----------------------------------------');
console.log('检查项：' + checks + '　失败：' + failures);
process.exit(failures ? 1 : 0);
