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
ok(scenes.length >= 26, '场景数量 >= 26', '实际 ' + scenes.length);
ok(Object.keys(tones).length === 4, '语气档位为 4 档', Object.keys(tones).join(','));
ok(!!tones.direct, '新增第 4 档语气 direct（直球·有底气）');

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
const toneKeys = Object.keys(tones);
// v1.7.0 新增的 10 个场景：话术控制在 60 字以内；老场景保留原文，仅做长度兜底
const NEW_SCENE_IDS = ['layoff_notice', 'exit_handover', 'sick_leave', 'perf_review', 'bonus_ask',
  'transfer_talk', 'client_push', 'scope_push', 'credit_steal', 'weekend_call'];
const allReplies = [];
scenes.forEach(s => {
  ok(!sceneIds.has(s.id), '场景 id 唯一：' + s.id);
  sceneIds.add(s.id);
  ok(s.name && s.emoji && s.desc && s.tip, '场景「' + s.name + '」基础字段完整');
  ok(typeof s.when === 'string' && s.when.trim().length > 2, '场景「' + s.name + '」有使用提醒 when');
  ok(typeof s.avoid === 'string' && s.avoid.trim().length > 2, '场景「' + s.name + '」有使用提醒 avoid');
  const isNew = NEW_SCENE_IDS.indexOf(s.id) !== -1;
  toneKeys.forEach(t => {
    const list = (s.replies || {})[t];
    ok(Array.isArray(list) && list.length === 3, '场景「' + s.name + '」[' + t + '] 恰好 3 条', list ? '实际 ' + list.length : '缺失');
    (list || []).forEach((x, i) => {
      ok(typeof x === 'string' && x.trim().length > 4, '场景「' + s.name + '」[' + t + ']第' + (i + 1) + '条话术有效');
      ok(x.length <= (isNew ? 60 : 200), '场景「' + s.name + '」[' + t + ']第' + (i + 1) + '条长度合规',
        '实际 ' + x.length + (isNew ? '（新场景限 60 字）' : ''));
      allReplies.push(x);
    });
  });
});
ok(NEW_SCENE_IDS.every(id => sceneIds.has(id)), 'v1.7.0 新增的 10 个场景齐备');
ok(allReplies.length === scenes.length * toneKeys.length * 3, '话术总数 = 场景 × 语气 × 3', '实际 ' + allReplies.length);
ok(new Set(allReplies).size === allReplies.length, '全部话术无字面重复');
ok(allReplies.every(x => x.indexOf('\uFFFD') === -1 && x.indexOf('**') === -1 && x.indexOf('##') === -1), '话术无乱码与 Markdown 标记');

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
  toneKeys.forEach(t => {
    const r = engine.reply(s.id, t, s.id + '|' + t + '|0');
    ok(!!r && typeof r.text === 'string' && r.text.length > 4, '话术可生成：' + s.id + '/' + t);
    ok(r && r.tone === t, '语气正确：' + s.id + '/' + t);
    ok(r && typeof r.when === 'string' && r.when.length > 2, '话术带使用提醒 when：' + s.id + '/' + t);
    ok(r && typeof r.avoid === 'string' && r.avoid.length > 2, '话术带使用提醒 avoid：' + s.id + '/' + t);
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
  const bad = txt.match(/\uFFFD/g);
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

ok(nodeIds.length >= 60, '故事节点 >= 60', '实际 ' + nodeIds.length);
ok(endIds.length >= 10, '结局数量 >= 10', '实际 ' + endIds.length);
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

/* ---------- 7. 摸鱼补给站：音色 / 呼吸 / 伪装页（v1.8.0 新增） ---------- */
section('7. 摸鱼补给站内容（v1.8.0）');

const audioSrc = fs.readFileSync(path.join(JS, 'audio.js'), 'utf8');
const soundIds = [];
const voiceRe = /\{\s*id:\s*'([a-z_]+)',\s*name:\s*'([^']+)',\s*emoji:\s*'([^']+)',\s*desc:\s*'([^']+)'\s*\}/g;
let vm2;
while ((vm2 = voiceRe.exec(audioSrc)) !== null) soundIds.push({ id: vm2[1], name: vm2[2], emoji: vm2[3], desc: vm2[4] });
ok(soundIds.length >= 10, '环境音 >= 10 种', '实际 ' + soundIds.length);
const soundIdsSet = new Set(soundIds.map(s => s.id));
ok(soundIdsSet.size === soundIds.length, '环境音 id 不重复');
['rain', 'cafe', 'subway', 'aircon', 'waves', 'pages', 'thunder', 'forest', 'train', 'typing'].forEach(id => {
  ok(soundIdsSet.has(id), '存在环境音：' + id);
});
soundIds.forEach(s => {
  ok(s.name.length >= 2 && s.desc.length >= 4, '环境音「' + s.id + '」名称与说明完整');
  ok(audioSrc.indexOf(s.id + ': function') !== -1, '环境音「' + s.id + '」有合成实现');
});

const breathData = require(path.join(JS, 'data-breath.js'));
const exercises = breathData.exercises || [];
ok(exercises.length >= 3, '呼吸引导 >= 3 套', '实际 ' + exercises.length);
exercises.forEach(ex => {
  ok(!!ex.id && !!ex.name && !!ex.emoji && !!ex.when && !!ex.desc, '呼吸「' + ex.id + '」字段完整');
  ok(Array.isArray(ex.phases) && ex.phases.length >= 2, '呼吸「' + ex.id + '」至少 2 个阶段');
  ok(ex.finish && ex.finish.length >= 8, '呼吸「' + ex.id + '」有结束语');
  ex.phases.forEach(p => ok(!!p.label && p.sec >= 1 && !!p.tip, '呼吸「' + ex.id + '」阶段「' + p.label + '」完整'));
  const plan = engine.breathPlan(ex.id);
  ok(!!plan && plan.totalSec > 0, 'breathPlan 可展开：' + ex.id);
  ok(plan && plan.totalSec === ex.phases.reduce((a, p) => a + p.sec, 0), 'breathPlan 总秒数与数据一致：' + ex.id);
});
ok(engine.breathPlan('not-exist') !== null, '未知呼吸 id 回退到第一套');
ok(engine.breathExercises().length === exercises.length, 'engine.breathExercises 可读取');

const bossData = require(path.join(JS, 'data-boss.js'));
const bossList = bossData.pages || [];
ok(bossList.length >= 4, '老板键伪装页 >= 4 个', '实际 ' + bossList.length);
const bossIds = new Set();
bossList.forEach(pg => {
  ok(!!pg.id && !!pg.name && !!pg.emoji && !!pg.title && !!pg.tag, '伪装页「' + pg.id + '」字段完整');
  ok(!bossIds.has(pg.id), '伪装页 id 不重复：' + pg.id);
  bossIds.add(pg.id);
  const hasTable = pg.table && Array.isArray(pg.table.head) && pg.table.head.length >= 3 && Array.isArray(pg.table.rows) && pg.table.rows.length >= 3;
  ok(hasTable || (Array.isArray(pg.list) && pg.list.length >= 2), '伪装页「' + pg.id + '」有表格或清单');
  ok(engine.bossPage(pg.id) && engine.bossPage(pg.id).id === pg.id, 'bossPage 可按 id 取回：' + pg.id);
});
ok(engine.bossPage('not-exist') !== null, '未知伪装页 id 回退到第一页');
ok(engine.bossPages().length === bossList.length, 'engine.bossPages 可读取');

ok(html.indexOf('assets/js/data-breath.js') !== -1, '引入 data-breath.js');
ok(html.indexOf('assets/js/data-boss.js') !== -1, '引入 data-boss.js');
ok(html.indexOf('id="breathPicker"') !== -1 && html.indexOf('id="breathCircle"') !== -1, '页面存在呼吸引导区');
ok(html.indexOf('id="bossPicker"') !== -1 && html.indexOf('id="bossDocTitle"') !== -1, '页面存在伪装页选择区');
ok(html.indexOf('id="breathStart"') !== -1 && html.indexOf('id="breathStop"') !== -1, '页面存在呼吸开始/停止按钮');
ok(appJs.indexOf('recordAction(\'b\')') !== -1, '呼吸完成后计入周报');

// 周报分项新增呼吸次数
const daysB = {};
daysB['2026-11-15'] = { d: 1, r: 1, f: 1, p: 1, s: 1, g: 1, b: 2 };
const repB = engine.weeklyReport(daysB, todayStr, 7);
ok(repB.totals.b === 2, '周报统计呼吸次数', String(repB.totals.b));
ok(repB.total === 8, '周报总量含呼吸次数', String(repB.total));
ok(engine.reportSummary(repB, {}, {}).includes('呼吸 2 次'), '周报小结提到呼吸');

/* ---------- 8. 剧目与每日彩蛋（v1.9.0） ---------- */
section('8. 剧目与每日彩蛋（v1.9.0）');

// 8.1 第二短篇《被裁的那天》
const story2 = require(path.join(JS, 'data-story2.js'));
const s2nodes = story2.nodes || {};
const s2ends = story2.endings || {};
const s2nodeIds = Object.keys(s2nodes);
const s2endIds = Object.keys(s2ends);
ok(s2nodeIds.length >= 20, '第二短篇节点 >= 20', '实际 ' + s2nodeIds.length);
ok(s2endIds.length >= 4, '第二短篇结局 >= 4', '实际 ' + s2endIds.length);
ok(!!story2.id && !!story2.title && !!story2.subtitle && !!story2.heartsLabel, '第二短篇顶层字段完整');
ok(!!s2nodes[story2.start], '第二短篇起始节点存在：' + story2.start);
s2nodeIds.forEach(id => {
  const n = s2nodes[id];
  ok(!!n.emoji && !!n.title && !!n.text, '第二短篇节点「' + id + '」含 emoji/title/text');
  ok(Array.isArray(n.choices) && n.choices.length >= 2, '第二短篇节点「' + id + '」至少 2 个选择');
  n.choices.forEach((c, i) => {
    ok(!!c.label && !!c.tip, '第二短篇节点「' + id + '」选择 ' + i + ' 字段完整');
    ok(!!s2nodes[c.next] || !!s2ends[c.next], '第二短篇节点「' + id + '」选择 ' + i + ' 指向有效目标：' + c.next);
  });
});
s2endIds.forEach(id => {
  const e = s2ends[id];
  ok(!!e.emoji && !!e.title && !!e.grade && !!e.desc && !!e.comfort && !!e.tip, '第二短篇结局「' + id + '」字段完整');
});
const reach2 = engine.storyReach('layoff');
s2nodeIds.forEach(id => ok(!!reach2.nodes[id], '第二短篇节点可达：' + id));
s2endIds.forEach(id => ok(!!reach2.endings[id], '第二短篇结局可达：' + id));

// 第二短篇不得出现法律条文、赔偿数字或给法律建议
const s2Text = JSON.stringify(story2);
const legalWords = ['劳动法', '仲裁', '赔偿金', 'N+1', '2N', '经济补偿金', '依据第'];
legalWords.forEach(w => ok(s2Text.indexOf(w) === -1, '第二短篇不含法律/金额表述：' + w));
ok(!/\d+\s*元/.test(s2Text), '第二短篇不含具体金额');

// 8.2 多剧目引擎
const storyList = engine.storyList();
ok(storyList.length >= 2, '剧目列表 >= 2 部', '实际 ' + storyList.length);
storyList.forEach(s => {
  ok(!!s.id && !!s.title && !!s.subtitle, '剧目「' + s.id + '」元信息完整');
  ok(s.nodeCount >= 20, '剧目「' + s.id + '」节点数达标：' + s.nodeCount);
  ok(s.endingCount >= 4, '剧目「' + s.id + '」结局数达标：' + s.endingCount);
});
ok(engine.storySelect('layoff') === true, 'storySelect 可切换到第二部');
ok(engine.storyCurrent().id === 'layoff', '当前剧目已切换');
const st2 = engine.storyStart();
ok(st2.nodeId === story2.start, '切换后 storyStart 从新剧目起点开始');
ok(!!st2.heartsLabel, 'storyStart 带出 heartsLabel');
engine.storySelect('today');
ok(engine.storyCurrent().id === 'today', '可以切回第一部');
ok(engine.storySelect('not-exist') === false, '切换不存在的剧目会失败');

// 8.3 每日彩蛋
const chalData = require(path.join(JS, 'data-challenges.js'));
const chalList = chalData.items || [];
ok(chalList.length >= 12, '每日彩蛋 >= 12 条', '实际 ' + chalList.length);
const chalIds = new Set();
chalList.forEach(c => {
  ok(!!c.id && !!c.text && !!c.hint, '彩蛋「' + c.id + '」字段完整');
  ok(!chalIds.has(c.id), '彩蛋 id 不重复：' + c.id);
  chalIds.add(c.id);
  ok(c.text.length <= 40 && c.hint.length <= 40, '彩蛋「' + c.id + '」文案长度合规');
});
ok(engine.challengeList().length === chalList.length, 'engine.challengeList 可读取');
const c1 = engine.challengesOf('2026-11-17');
const c2 = engine.challengesOf('2026-11-17');
ok(!!c1 && c1.id === c2.id, '同一天的彩蛋是同一条');
const dayIds = new Set();
['2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'].forEach(d => {
  const c = engine.challengesOf(d);
  ok(!!c && !!c.id, '日期 ' + d + ' 能取到彩蛋');
  dayIds.add(c && c.id);
});
ok(dayIds.size >= 3, '不同日期会轮换出不同彩蛋', '实际 ' + dayIds.size + ' 种');

// 8.4 周报新增彩蛋统计
const daysC = {};
daysC['2026-11-15'] = { d: 1, r: 1, f: 1, p: 1, s: 1, g: 1, b: 1, c: 2 };
const repC = engine.weeklyReport(daysC, todayStr, 7);
ok(repC.totals.c === 2, '周报统计彩蛋数', String(repC.totals.c));
ok(repC.total === 9, '周报总量含彩蛋数', String(repC.total));
ok(engine.reportSummary(repC, {}, {}).includes('彩蛋 2 个'), '周报小结提到彩蛋');

// 8.5 页面与脚本接线
ok(html.indexOf('assets/js/data-story2.js') !== -1, '引入 data-story2.js');
ok(html.indexOf('assets/js/data-challenges.js') !== -1, '引入 data-challenges.js');
ok(html.indexOf('id="storyTabs"') !== -1, '页面存在剧目切换区');
ok(html.indexOf('id="challengeCard"') !== -1 && html.indexOf('id="challengeDone"') !== -1, '页面存在今日彩蛋卡');
ok(appJs.indexOf('challengesDone') !== -1, '彩蛋完成状态存在本地存储');
ok(appJs.indexOf('recordAction(\'c\')') !== -1, '彩蛋完成计入周报');

/* ---------- 9. 周报增强与成就徽章（v1.10.0） ---------- */
section('9. 周报增强与成就徽章（v1.10.0）');

// 9.1 徽章数据
const badgeData = require(path.join(JS, 'data-badges.js'));
const badgeList = badgeData.items || [];
ok(badgeList.length >= 6, '成就徽章 >= 6 枚', '实际 ' + badgeList.length);
const badgeIds = new Set();
badgeList.forEach(b => {
  ok(!!b.id && !!b.name && !!b.emoji && !!b.desc, '徽章「' + b.id + '」字段完整');
  ok(!badgeIds.has(b.id), '徽章 id 不重复：' + b.id);
  badgeIds.add(b.id);
  ok(b.need && ['total', 'streak', 'score'].indexOf(b.need.kind) !== -1, '徽章「' + b.id + '」解锁条件类型合法');
  ok(b.need && b.need.value >= 1, '徽章「' + b.id + '」解锁条件为正数');
  if (b.need.kind === 'total') {
    ok(['d', 'r', 'f', 'p', 's', 'g', 'b', 'c'].indexOf(b.need.key) !== -1, '徽章「' + b.id + '」统计键合法');
  }
  ok(b.desc.length <= 60, '徽章「' + b.id + '」说明不长');
});
const badWords = ['排名', '倒数', '落后', '输', '失败', '连续中断'];
badgeList.forEach(b => {
  badWords.forEach(w => ok(b.desc.indexOf(w) === -1 && b.name.indexOf(w) === -1, '徽章「' + b.id + '」不含比较/惩罚字眼：' + w));
});

// 9.2 徽章进度计算
const aggFull = { d: 3, r: 12, f: 2, p: 1, s: 1, g: 4, b: 3, c: 5, streak: 3, score: 1200 };
const badges = engine.badgesFor(aggFull);
ok(badges.length === badgeList.length, 'badgesFor 返回全部徽章', String(badges.length));
ok(badges.every(b => b.unlocked), '数据齐全时六枚徽章全部解锁');
const aggEmpty = { d: 0, r: 0, f: 0, p: 0, s: 0, g: 0, b: 0, c: 0, streak: 0, score: 0 };
const badgesEmpty = engine.badgesFor(aggEmpty);
ok(badgesEmpty.every(b => !b.unlocked), '没有记录时徽章全部未解锁');
ok(badgesEmpty.every(b => b.pct === 0), '没有记录时徽章进度为 0');
const partial = engine.badgeProgress({ need: { kind: 'total', key: 'r', value: 10 } }, { r: 4 });
ok(partial.cur === 4 && partial.goal === 10 && partial.pct === 40 && !partial.unlocked, '徽章进度计算正确', JSON.stringify(partial));
ok(engine.badges.length === badgeList.length, 'engine.badges 可读取徽章数据');

// 9.3 连续天数：只鼓励，不惩罚
const streakDays = {};
streakDays['2026-11-15'] = { d: 1 };
streakDays['2026-11-14'] = { d: 1 };
streakDays['2026-11-13'] = { d: 1 };
const streak3 = engine.streakOf(streakDays, '2026-11-15');
ok(streak3.days === 3, '连续三天算 3 天', String(streak3.days));
ok(streak3.active === true, '连续天数标记为有活动');
ok(streak3.text.indexOf('连着来了 3 天') !== -1, '连续天数文案正确', streak3.text);
const streakTodayMiss = engine.streakOf(streakDays, '2026-11-16');
ok(streakTodayMiss.days === 3, '今天还没来不算断签', String(streakTodayMiss.days));
const streakNone = engine.streakOf({}, '2026-11-15');
ok(streakNone.days === 0 && streakNone.active === false, '没有记录时连续天数为 0');
ok(streakNone.text.indexOf('没关系') !== -1, '断签文案是鼓励而不是惩罚', streakNone.text);
const streakBroken = engine.streakOf({ '2026-11-15': { d: 1 }, '2026-11-13': { d: 1 } }, '2026-11-15');
ok(streakBroken.days === 1, '中间断掉只算到最近一段', String(streakBroken.days));

// 9.4 热力日历
const heat = engine.heatmapDays(streakDays, '2026-11-15', 30);
ok(heat.length === 30, '热力日历 30 格', String(heat.length));
ok(heat[0].key < heat[29].key, '热力日历按时间从旧到新');
ok(heat[29].key === '2026-11-15', '热力日历最后一天是今天', heat[29].key);
ok(heat[29].level >= 1, '有记录的日子有颜色');
ok(heat.filter(h => h.total === 0).every(h => h.level === 0), '没来的日子留空（level 0），不标红');
const heatEmpty = engine.heatmapDays({}, '2026-11-15', 30);
ok(heatEmpty.every(h => h.level === 0), '全空时日历全是留空格');
ok(engine.heatmapDays(streakDays, '2026-11-15', 30).filter(h => h.total > 0).every(h => h.level >= 1 && h.level <= 4), '颜色分档在 1~4 之间');

// 9.5 周 / 月视图
const repMonth = engine.weeklyReport(days, todayStr, 30);
ok(repMonth.days.length === 30, '月视图 30 天', String(repMonth.days.length));
ok(repMonth.span === 30, '月视图 span 正确', String(repMonth.span));
ok(repMonth.days[0].label.indexOf('/') !== -1, '月视图标签是日期', repMonth.days[0].label);
ok(rep.days[0].label.indexOf('周') === 0, '周视图标签仍是星期', rep.days[0].label);
const sumMonth = engine.reportSummary(repMonth, moodNames, endNames, 'month');
ok(sumMonth.indexOf('这个月') !== -1, '月视图小结用「这个月」', sumMonth);
const textMonth = engine.reportText(repMonth, sumMonth, 'month');
ok(textMonth.indexOf('本月疗愈月报') !== -1, '月视图分享标题正确');
ok(engine.reportText(rep, sum).indexOf('本周疗愈周报') !== -1, '周视图分享标题正确');

// 9.6 分享模板
const templates = engine.shareTemplates(rep, sum, aggFull);
ok(templates.length === 3, '分享模板 3 种', String(templates.length));
const tIds = new Set(templates.map(t => t.id));
ok(tIds.size === 3, '分享模板 id 不重复');
templates.forEach(t => {
  ok(!!t.name && !!t.text, '分享模板「' + t.id + '」字段完整');
  ok(t.text.indexOf('不解决问题') !== -1, '分享模板「' + t.id + '」带落款');
  ok(t.text.indexOf('\n') !== -1, '分享模板「' + t.id + '」是多行文本');
});
ok(templates[0].text.indexOf('10 次') !== -1, '自嘲版带总次数', templates[0].text);
ok(templates[1].text.indexOf('连着来了 3 天') !== -1, '打气版带连续天数');
ok(templates[2].text.length < templates[0].text.length, '极简版最短', String(templates[2].text.length));

// 9.7 页面与脚本接线
ok(html.indexOf('assets/js/data-badges.js') !== -1, '引入 data-badges.js');
ok(html.indexOf('id="reportHeatmap"') !== -1 && html.indexOf('id="reportBadges"') !== -1, '页面存在热力日历与徽章区');
ok(html.indexOf('id="reportShare"') !== -1 && html.indexOf('id="reportWeek"') !== -1 && html.indexOf('id="reportMonth"') !== -1, '页面存在分享模板与周月切换');
ok(html.indexOf('v1.10.0') !== -1, '页面版本号更新为 v1.10.0');
ok(appJs.indexOf('streakOf') !== -1 && appJs.indexOf('badgesFor') !== -1 && appJs.indexOf('heatmapDays') !== -1, 'app.js 接上连续天数/徽章/热力日历');
ok(appJs.indexOf('shareTemplates') !== -1, 'app.js 接上分享模板');

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
