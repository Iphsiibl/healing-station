/* =========================================================
   selftest.js · 零依赖自检脚本
   用法：node tools/selftest.js
   检查项：
     1. 数据完整性（心情 / 关键词包 / 场景 / 话术）
     2. 引擎逻辑（覆盖全部心情 × 全部场景 × 三种语气）
     3. 页面结构（app.js 用到的选择器必须在 index.html 中存在）
     4. 文本卫生（乱码字符、英文夹杂的病名）
   ========================================================= */
'use strict';

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const JS = path.join(ROOT, 'assets', 'js');

let failures = [];
let checks = 0;

function ok(cond, label, extra) {
  checks++;
  if (!cond) {
    failures.push(label + (extra ? ' → ' + extra : ''));
    console.log('  ✗ ' + label + (extra ? ' → ' + extra : ''));
  } else {
    console.log('  ✓ ' + label);
  }
}

function section(t) { console.log('\n== ' + t + ' =='); }

/* ---------- 载入 ---------- */
const moodsData = require(path.join(JS, 'data-moods.js'));
const scenesData = require(path.join(JS, 'data-scenes.js'));
const engine = require(path.join(JS, 'engine.js'));

const moods = moodsData.moods;
const packs = moodsData.keywordPacks;
const scenes = scenesData.scenes;
const tones = scenesData.tones;

/* ---------- 1. 数据完整性 ---------- */
section('1. 数据完整性');

ok(moods.length >= 8, '心情数量 >= 8', '实际 ' + moods.length);
ok(scenes.length >= 12, '场景数量 >= 12', '实际 ' + scenes.length);
ok(Object.keys(tones).length === 3, '语气档位为 3 档', Object.keys(tones).join(','));

const MOOD_FIELDS = ['id', 'name', 'emoji', 'desc', 'diagnoses', 'causes', 'remedies', 'blessings'];
const moodIds = new Set();
moods.forEach(m => {
  MOOD_FIELDS.forEach(f => ok(m[f] !== undefined && m[f] !== null && m[f] !== '', '心情「' + (m.name || m.id) + '」含字段 ' + f));
  ok(!moodIds.has(m.id), '心情 id 唯一：' + m.id);
  moodIds.add(m.id);
  ok(m.diagnoses.length >= 3, '心情「' + m.name + '」诊断 >= 3 条');
  ok(m.causes.length >= 3, '心情「' + m.name + '」病因 >= 3 条');
  ok(m.remedies.length >= 4, '心情「' + m.name + '」处方 >= 4 条');
  ok(m.blessings.length >= 3, '心情「' + m.name + '」祝福 >= 3 条');
  m.remedies.forEach(r => ok(r.t && r.d, '心情「' + m.name + '」每条处方有标题与说明'));
});

Object.keys(packs).forEach(k => {
  ok(!!packs[k].causes && !!packs[k].remedies && !!packs[k].blessings, '关键词包「' + k + '」结构完整');
  packs[k].remedies.forEach(r => ok(r.t && r.d, '关键词包「' + k + '」处方项完整'));
});

const sceneIds = new Set();
scenes.forEach(s => {
  ok(!sceneIds.has(s.id), '场景 id 唯一：' + s.id);
  sceneIds.add(s.id);
  ok(s.name && s.emoji && s.desc && s.tip, '场景「' + s.name + '」基础字段完整');
  ['safe', 'pro', 'wild'].forEach(t => {
    const list = (s.replies || {})[t];
    ok(Array.isArray(list) && list.length === 3, '场景「' + s.name + '」[' + t + '] 恰好 3 条', list ? '实际 ' + list.length : '缺失');
    (list || []).forEach((x, i) => ok(typeof x === 'string' && x.trim().length > 4, '场景「' + s.name + '」[' + t + ']第' + (i + 1) + '条话术有效'));
  });
});

/* ---------- 2. 引擎逻辑 ---------- */
section('2. 引擎逻辑');

moods.forEach(m => {
  const r = engine.diagnose(m.id, '', m.id + '|0');
  ok(!!r, '诊断可用：' + m.id);
  if (!r) return;
  ok(r.title && r.cause && r.blessing, '诊断单三段齐全：' + m.id);
  ok(Array.isArray(r.analysis) && r.analysis.length >= 2, '病历分析为多行数组：' + m.id);
  ok(r.remedies.length === 3, '处方恰好 3 条：' + m.id);
  ok(r.remedies.every(x => x.t && x.d), '处方字段完整：' + m.id);
  ok(r.copyText.includes('诊断单'), '复制文本包含标题：' + m.id);
  const r2 = engine.diagnose(m.id, '', m.id + '|1');
  ok(r2.title !== r.title || r2.cause !== r.cause || r2.blessing !== r.blessing, '重掷能换出不同结果：' + m.id);
});

// 关键词包命中
const kwMood = moods.find(m => m.id === 'tired');
const rKw = engine.diagnose(kwMood.id, '今天一直在加班', 'x');
ok(rKw.matchedKeywords.includes('加班'), '关键词「加班」被识别');
ok(rKw.remedies.length === 3, '命中关键词后处方仍为 3 条');
const rKw2 = engine.diagnose(kwMood.id, '早上开会开到头晕', 'y');
ok(rKw2.matchedKeywords.includes('开会'), '关键词「开会」被识别');
ok(rKw2.matchedKeywords.length <= 2, '一次最多命中 2 个关键词包');
ok(engine.diagnose('not-exist', '', 'z') === null, '未知心情返回 null');

scenes.forEach(s => {
  ['safe', 'pro', 'wild'].forEach(t => {
    const r = engine.reply(s.id, t, s.id + '|' + t + '|0');
    ok(!!r && typeof r.text === 'string' && r.text.length > 4, '话术可生成：' + s.id + '/' + t);
    ok(r && r.tone === t, '语气正确：' + s.id + '/' + t);
    const r2 = engine.reply(s.id, t, s.id + '|' + t + '|1');
    ok(r2 && r2.text !== r.text, '重掷能换出不同话术：' + s.id + '/' + t);
  });
});
ok(engine.reply('not-exist', 'safe', 'z') === null, '未知场景返回 null');
ok(engine.reply(scenes[0].id, 'unknown-tone', 'z').tone === 'safe', '未知语气回退到 safe');

/* ---------- 3. 页面结构 ---------- */
section('3. 页面结构');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(JS, 'app.js'), 'utf8');

const neededIds = new Set();
const idRe = /\$\('#([A-Za-z0-9_-]+)'\)/g;
let m;
while ((m = idRe.exec(appJs)) !== null) neededIds.add(m[1]);
neededIds.forEach(id => ok(html.indexOf('id="' + id + '"') !== -1, 'index.html 存在 id="' + id + '"'));

ok(html.indexOf('data-tone="safe"') !== -1, '存在 safe 语气按钮');
ok(html.indexOf('data-tone="pro"') !== -1, '存在 pro 语气按钮');
ok(html.indexOf('data-tone="wild"') !== -1, '存在 wild 语气按钮');
ok(html.indexOf('assets/js/data-moods.js') !== -1, '引入 data-moods.js');
ok(html.indexOf('assets/js/data-scenes.js') !== -1, '引入 data-scenes.js');
ok(html.indexOf('assets/js/engine.js') !== -1, '引入 engine.js');
ok(html.indexOf('assets/js/app.js') !== -1, '引入 app.js');
ok(!/<script[^>]+type="module"/.test(html), '未使用 ES module（保证 file:// 可直接打开）');
ok(html.indexOf('id="clinicAnalysis"') !== -1 && html.indexOf('<ul class="result-list" id="clinicAnalysis">') !== -1, '病历分析为 ul 容器');
ok(html.indexOf('id="resetData"') !== -1, '存在清空数据入口');

/* ---------- 4. 文本卫生 ---------- */
section('4. 文本卫生');

const textFiles = ['data-moods.js', 'data-scenes.js', 'engine.js', 'app.js'].map(f => path.join(JS, f));
textFiles.push(path.join(ROOT, 'index.html'));
textFiles.push(path.join(ROOT, 'assets', 'styles.css'));
textFiles.forEach(f => {
  const txt = fs.readFileSync(f, 'utf8');
  const bad = txt.match(/�/g);
  ok(!bad, '无乱码替换字符：' + path.basename(f), bad ? bad.length + ' 处' : '');
});

const moodsTxt = fs.readFileSync(path.join(JS, 'data-moods.js'), 'utf8');
ok(!/[一-龥][A-Za-z_]{2,}/.test(moodsTxt.replace(/\/\*[\s\S]*?\*\//g, '')), '情绪文案无中英夹杂的病名');

/* ---------- 结果 ---------- */
console.log('\n----------------------------------------');
console.log('检查项：' + checks + '　失败：' + failures.length);
if (failures.length) {
  console.log('\n失败清单：');
  failures.forEach(f => console.log(' - ' + f));
  process.exit(1);
} else {
  console.log('全部通过 ✅');
}
