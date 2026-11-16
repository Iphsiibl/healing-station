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

ok(moods.length >= 12, '心情数量 >= 12', '实际 ' + moods.length);
ok(Object.keys(packs).length >= 18, '关键词包数量 >= 18', '实际 ' + Object.keys(packs).length);
ok(scenes.length >= 12, '场景数量 >= 12', '实际 ' + scenes.length);
ok(Object.keys(tones).length === 3, '语气档位为 3 档', Object.keys(tones).join(','));

const MOOD_FIELDS = ['id', 'name', 'emoji', 'desc', 'diagnoses', 'causes', 'remedies', 'blessings', 'checkup'];
const moodIds = new Set();
moods.forEach(m => {
  MOOD_FIELDS.forEach(f => ok(m[f] !== undefined && m[f] !== null && m[f] !== '', '心情「' + (m.name || m.id) + '」含字段 ' + f));
  ok(!moodIds.has(m.id), '心情 id 唯一：' + m.id);
  moodIds.add(m.id);
  ok(m.diagnoses.length >= 3, '心情「' + m.name + '」诊断 >= 3 条');
  ok(m.causes.length >= 3, '心情「' + m.name + '」病因 >= 3 条');
  ok(m.remedies.length >= 4, '心情「' + m.name + '」处方 >= 4 条');
  ok(m.blessings.length >= 5, '心情「' + m.name + '」祝福 >= 5 条', '实际 ' + m.blessings.length);
  m.remedies.forEach(r => ok(r.t && r.d, '心情「' + m.name + '」每条处方有标题与说明'));
});

Object.keys(packs).forEach(k => {
  ok(!!packs[k].causes && !!packs[k].remedies && !!packs[k].blessings, '关键词包「' + k + '」结构完整');
  ok(packs[k].causes.length >= 2, '关键词包「' + k + '」病因 >= 2 条');
  ok(packs[k].remedies.length >= 3, '关键词包「' + k + '」处方 >= 3 条');
  ok(packs[k].blessings.length >= 3, '关键词包「' + k + '」祝福 >= 3 条');
  ok(Array.isArray(packs[k].keywords) && packs[k].keywords.length >= 4, '关键词包「' + k + '」同义说法 >= 4 条');
  packs[k].remedies.forEach(r => ok(r.t && r.d, '关键词包「' + k + '」处方项完整'));
});

// 关键词同义说法：每个包的第一个同义词都要能被 matchPacks 命中
Object.keys(packs).forEach(k => {
  const kw = (packs[k].keywords || [])[0];
  if (!kw) return;
  const hit = engine.matchPacks('今天' + kw + '，心累');
  ok(hit.some(h => h.key === kw || h.via === k), '同义说法「' + kw + '」能命中包「' + k + '」');
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
  ok(r.remedies.length >= 3 && r.remedies.length <= 4, '处方 3~4 条：' + m.id, '实际 ' + r.remedies.length);
  ok(r.remedies.every(x => x.t && x.d), '处方字段完整：' + m.id);
  ok(!!r.checkup, '诊断单带复诊提醒：' + m.id);
  ok(r.copyText.includes('诊断单'), '复制文本包含标题：' + m.id);
  ok(r.copyText.includes('复诊提醒'), '复制文本包含复诊提醒：' + m.id);
  const r2 = engine.diagnose(m.id, '', m.id + '|1');
  ok(r2.title !== r.title || r2.cause !== r.cause || r2.blessing !== r.blessing, '重掷能换出不同结果：' + m.id);
});

// 关键词包命中
const kwMood = moods.find(m => m.id === 'tired');
const rKw = engine.diagnose(kwMood.id, '今天一直在加班', 'x');
ok(rKw.matchedKeywords.includes('加班'), '关键词「加班」被识别');
ok(rKw.remedies.length >= 3, '命中关键词后处方不少于 3 条');
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
ok(html.indexOf('assets/js/data-story.js') !== -1, '引入 data-story.js');
ok(html.indexOf('assets/js/audio.js') !== -1, '引入 audio.js');
ok(html.indexOf('assets/js/engine.js') !== -1, '引入 engine.js');
ok(html.indexOf('assets/js/app.js') !== -1, '引入 app.js');
ok(!/<script[^>]+type="module"/.test(html), '未使用 ES module（保证 file:// 可直接打开）');
ok(html.indexOf('id="clinicAnalysis"') !== -1 && html.indexOf('<ul class="result-list" id="clinicAnalysis">') !== -1, '病历分析为 ul 容器');
ok(html.indexOf('id="resetData"') !== -1, '存在清空数据入口');

/* ---------- 4. 文本卫生 ---------- */
section('4. 文本卫生');

const textFiles = ['data-moods.js', 'data-scenes.js', 'data-story.js', 'engine.js', 'audio.js', 'app.js'].map(f => path.join(JS, f));
textFiles.push(path.join(ROOT, 'index.html'));
textFiles.push(path.join(ROOT, 'assets', 'styles.css'));
textFiles.forEach(f => {
  const txt = fs.readFileSync(f, 'utf8');
  const bad = txt.match(/�/g);
  ok(!bad, '无乱码替换字符：' + path.basename(f), bad ? bad.length + ' 处' : '');
});

const moodsTxt = fs.readFileSync(path.join(JS, 'data-moods.js'), 'utf8');
ok(!/[一-龥][A-Za-z_]{2,}/.test(moodsTxt.replace(/\/\*[\s\S]*?\*\//g, '')), '情绪文案无中英夹杂的病名');

// v1.6.0：文案不许说教、不许承诺疗效
const FORBIDDEN = ['你应该', '你必须', '一切都会好', '治愈', '根治', '包治', '保证不'];
const moodsAll = [];
moods.forEach(m => {
  m.blessings.forEach(b => moodsAll.push({ from: '心情「' + m.name + '」', text: b }));
});
Object.keys(packs).forEach(k => {
  (packs[k].blessings || []).forEach(b => moodsAll.push({ from: '关键词包「' + k + '」', text: b }));
});
FORBIDDEN.forEach(w => {
  const hit = moodsAll.filter(x => String(x.text).indexOf(w) !== -1);
  ok(hit.length === 0, '祝福不含说教/承诺词「' + w + '」', hit.length ? hit[0].from + '：' + hit[0].text : '');
});

// 祝福全库不得字面重复
const blessingSeen = new Map();
moodsAll.forEach(x => {
  const key = String(x.text).replace(/[\s，。！？、,.!?]/g, '');
  ok(!blessingSeen.has(key), '祝福不重复：' + String(x.text).slice(0, 14), blessingSeen.get(key) || '');
  if (!blessingSeen.has(key)) blessingSeen.set(key, x.from);
});
ok(moodsAll.length >= 100, '全库祝福 >= 100 条', '实际 ' + moodsAll.length);

/* ---------- 5. 小游戏数据与引擎 ---------- */
section('5. 小游戏数据与引擎');

const story = require(path.join(JS, 'data-story.js'));
const nodes = story.nodes;
const endings = story.endings;
const nodeIds = Object.keys(nodes);
const endIds = Object.keys(endings);

ok(nodeIds.length >= 20, '故事节点 >= 20', '实际 ' + nodeIds.length);
ok(endIds.length >= 5, '结局数量 >= 5', '实际 ' + endIds.length);
ok(!!nodes[story.start], '起始节点存在：' + story.start);

nodeIds.forEach(id => {
  const n = nodes[id];
  ok(!!n.emoji && !!n.title && !!n.text, '节点「' + id + '」含 emoji/title/text');
  ok(Array.isArray(n.choices) && n.choices.length >= 1, '节点「' + id + '」至少有 1 个选择');
  n.choices.forEach((c, i) => {
    ok(!!c.label, '节点「' + id + '」选择 ' + i + ' 有文案');
    ok(!!nodes[c.next] || !!endings[c.next], '节点「' + id + '」选择 ' + i + ' 指向有效目标：' + c.next);
    ok(c.tip && c.tip.length >= 4, '节点「' + id + '」选择 ' + i + ' 有回响 tip');
  });
});

endIds.forEach(id => {
  const e = endings[id];
  ok(!!e.emoji && !!e.title && !!e.grade && !!e.desc && !!e.comfort && !!e.tip, '结局「' + id + '」字段完整');
});

const reach = engine.storyReach();
nodeIds.forEach(id => ok(!!reach.nodes[id], '节点可达：' + id));
endIds.forEach(id => ok(!!reach.endings[id], '结局可达：' + id));

// 模拟通关：沿着第一条路走到底
let st = engine.storyStart();
ok(st.nodeId === story.start, 'storyStart 返回起始节点');
ok(engine.storyNode(st) !== null, '起始节点可读取');
let guard = 0;
while (!engine.storyIsEnd(st) && guard < 60) {
  const node = engine.storyNode(st);
  engine.storyMove(st, 0);
  guard++;
}
ok(engine.storyIsEnd(st), '沿默认路径可以走到结局', '步数 ' + guard);
ok(!!engine.storyEnding(st), '结局内容可读取');
ok(st.path.length === guard, '路径记录完整', st.path.length + '/' + guard);
ok(engine.storyRecap(st).split('\n').length === guard, '路径回顾文本行数正确');
ok(st.heart >= 0 && st.heart <= st.maxHeart, '心值在合法区间', String(st.heart));

// 每个结局都能被走到
endIds.forEach(id => {
  let found = false;
  const walk = (nodeId, depth) => {
    if (found || depth > 40) return;
    const n = nodes[nodeId];
    if (!n) return;
    n.choices.forEach(c => {
      if (found) return;
      if (c.next === id) { found = true; return; }
      walk(c.next, depth + 1);
    });
  };
  walk(story.start, 0);
  ok(found, '结局可被路径触发：' + id);
});

/* ---------- 6. 疗愈周报引擎 ---------- */
section('6. 疗愈周报引擎');

const todayStr = '2026-11-15';
const emptyRep = engine.weeklyReport({}, todayStr, 7);
ok(emptyRep.days.length === 7, '周报固定 7 天', String(emptyRep.days.length));
ok(emptyRep.total === 0 && emptyRep.max === 0, '空记录周报总量为 0');
ok(emptyRep.topMood === '' && emptyRep.topEnding === '', '空记录没有高频心情/结局');
ok(emptyRep.days[6].key === todayStr, '周报最后一天是今天', emptyRep.days[6].key);
ok(emptyRep.days[0].key === '2026-11-9', '周报第一天是 7 天前', emptyRep.days[0].key);
ok(emptyRep.days[6].label === '周日', '周报标签按星期显示', emptyRep.days[6].label);

const days = {};
days['2026-11-15'] = { d: 2, r: 1, f: 0, p: 1, s: 1, moods: { tired: 2 }, ends: { end_early: 1 } };
days['2026-11-14'] = { d: 1, r: 0, f: 2, p: 0, s: 0, moods: { tired: 1, anxious: 1 }, ends: {} };
days['2026-11-9'] = { d: 1, r: 1, f: 0, p: 0, s: 0, moods: { anxious: 1 }, ends: {} };
days['2026-10-1'] = { d: 9, r: 9, f: 9, p: 9, s: 9, moods: { angry: 9 }, ends: { end_hero: 9 } }; // 窗口外，应被忽略

const rep = engine.weeklyReport(days, todayStr, 7);
ok(rep.totals.d === 4 && rep.totals.r === 2 && rep.totals.f === 2 && rep.totals.p === 1 && rep.totals.s === 1,
  '周报分项统计正确', JSON.stringify(rep.totals));
ok(rep.total === 10, '周报总次数正确', String(rep.total));
ok(rep.max === 5, '周报单日最高值正确', String(rep.max));
ok(rep.topMood === 'tired', '周报高频心情正确', rep.topMood);
ok(rep.topEnding === 'end_early', '周报高频结局正确', rep.topEnding);
ok(rep.moods.anxious === 2, '窗口外记录不计入高频统计', String(rep.moods.anxious));
ok(rep.days.every(d => typeof d.total === 'number'), '每日小计均为数字');
ok(rep.days[6].total === 5 && rep.days[0].total === 2, '首尾两天小计正确',
  rep.days[6].total + '/' + rep.days[0].total);

const moodNames = { tired: '累瘫了', anxious: '有点慌' };
const endNames = { end_early: '准时下班型' };
const sumEmpty = engine.reportSummary(emptyRep, moodNames, endNames);
ok(sumEmpty.includes('这周你还没来过急救站'), '空周报小结文案正确', sumEmpty);
ok(sumEmpty.length > 10, '空周报小结不空洞');

const sum = engine.reportSummary(rep, moodNames, endNames);
ok(sum.includes('被哄了 10 次'), '周报小结包含总次数', sum);
ok(sum.includes('累瘫了'), '周报小结包含高频心情名', sum);
ok(sum.includes('准时下班型'), '周报小结包含高频结局名', sum);
ok(sum.includes('🌿'), '周报小结带祝福');

const text = engine.reportText(rep, sum);
ok(text.includes('【打工人急救站 · 本周疗愈周报】'), '可复制周报标题正确');
ok(text.includes('不解决问题，只负责哄你开心'), '可复制周报落款正确');
ok(text.split('\n').length >= 4, '可复制周报为多行文本', String(text.split('\n').length));

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
