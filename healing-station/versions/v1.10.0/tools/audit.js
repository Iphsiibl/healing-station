/* =========================================================
   audit.js · 打工人急救站 · 内容审查工具（零依赖）
   ------------------------------------------------------------
   用法：
     node tools/audit.js                输出 Markdown 报告到 stdout
     node tools/audit.js --json         输出 JSON 报告到 stdout
     node tools/audit.js --out=报告.md   同时把报告写到文件

   退出码：存在 ERROR 级问题 → 1；否则 → 0。

   分级：
     ERROR = 必须修（数据缺失、字段不全、引用失效、明显 bug）
     WARN  = 建议修（重复度高、覆盖不足、风格不一致）
     INFO  = 统计信息

   只用 Node 内置模块（fs / path / vm），不修改仓库里的任何其它文件。
   ========================================================= */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var JS_DIR = path.join(ROOT, 'assets', 'js');
var GAME_DIR = path.join(ROOT, 'games');
var SELF_FILE = path.join(__dirname, 'audit.js');

/* ---------- 分级与图标 ---------- */
var LV = { ERROR: 'ERROR', WARN: 'WARN', INFO: 'INFO', PASS: 'PASS' };
var ICON = { ERROR: '❌', WARN: '⚠️', INFO: 'ℹ️', PASS: '✅' };
var LV_TEXT = { ERROR: '必修', WARN: '建议修', INFO: '信息', PASS: '通过' };

/* ---------- 营销腔词表（全局体检用） ---------- */
var MARKETING_EN = [
  'revolutionize', 'revolutionary', 'seamless', 'seamlessly', 'unleash',
  'empower', 'game-changer', 'cutting-edge', 'delight', 'stunning',
  'next-gen', 'bleeding-edge', 'synergy', 'game-changing', 'world-class'
];
var MARKETING_CN = ['革命性', '赋能', '无缝', '颠覆性', '一键搞定', '极致体验'];

/* ---------- 报告容器 ---------- */
var modules = [];
var allFindings = [];

function newModule(id, name, icon) {
  var m = {
    id: id, name: name, icon: icon,
    entries: 0, detail: '',
    checks: [], findings: [], tables: []
  };
  modules.push(m);
  return m;
}

/** 记录一条检查项；ERROR / WARN 同时进入问题清单 */
function check(mod, label, value, level, note) {
  var row = {
    label: label,
    value: String(value),
    level: level || LV.INFO,
    note: note || ''
  };
  mod.checks.push(row);
  if (row.level === LV.ERROR || row.level === LV.WARN) {
    var f = { level: row.level, module: mod.name, label: label, value: row.value, detail: row.note };
    mod.findings.push(f);
    allFindings.push(f);
  }
  return row;
}

/** 结论为「通过」的检查项 */
function pass(mod, label, value, note) { return check(mod, label, value, LV.PASS, note); }
/** 纯统计信息（不参与问题计数） */
function info(mod, label, value, note) { return check(mod, label, value, LV.INFO, note); }
/** 结论为「必修」的检查项 */
function fail(mod, label, value, note) { return check(mod, label, value, LV.ERROR, note); }
/** 结论为「建议修」的检查项 */
function warn(mod, label, value, note) { return check(mod, label, value, LV.WARN, note); }

/** 加一张明细表 */
function addTable(mod, title, head, rows) {
  mod.tables.push({ title: title, head: head, rows: rows });
}

/* =========================================================
   文本工具：归一化 / Jaccard 相似度 / 近重复检测
   ========================================================= */

/** 去掉标点、空白、emoji，只保留汉字与字母数字 */
function normalize(s) {
  return String(s == null ? '' : s)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/[^\p{Script=Han}A-Za-z0-9]/gu, '');
}

/** 字符集合 */
function charSet(s) {
  var set = new Set();
  for (var i = 0; i < s.length; i++) set.add(s[i]);
  return set;
}

/** 字符集合的 Jaccard 相似度 */
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  var small = a.size <= b.size ? a : b;
  var big = a.size <= b.size ? b : a;
  var inter = 0;
  small.forEach(function (ch) { if (big.has(ch)) inter++; });
  var uni = a.size + b.size - inter;
  return uni ? inter / uni : 0;
}

/**
 * 找精确重复与近重复文案
 * items: [{ module, field, text }]
 * 性能：先按归一化长度过滤（长度比 < 0.6 的两串不可能达到 0.75 的 Jaccard），再算集合交并比，
 *       全库约 700 条文案，两两比较 20 万次，毫秒级完成。
 */
function scanDuplicates(items, threshold) {
  var list = items.map(function (it) {
    var n = normalize(it.text);
    return {
      module: it.module, field: it.field, text: it.text,
      norm: n, set: charSet(n), len: n.length
    };
  });

  // 精确重复（原文完全一致）
  var exact = [];
  var seen = new Map();
  list.forEach(function (it) {
    var raw = String(it.text == null ? '' : it.text).trim();
    if (!raw) return;
    if (seen.has(raw)) exact.push({ a: seen.get(raw), b: it });
    else seen.set(raw, it);
  });

  // 近重复（归一化后相似度 ≥ 阈值）
  var near = [];
  for (var i = 0; i < list.length; i++) {
    for (var j = i + 1; j < list.length; j++) {
      var A = list[i], B = list[j];
      if (!A.len || !B.len) continue;
      var max = Math.max(A.len, B.len), min = Math.min(A.len, B.len);
      if (min / max < 0.6) continue;                 // 长度差过滤
      var sim = jaccard(A.set, B.set);
      if (sim < threshold) continue;
      if (String(A.text).trim() === String(B.text).trim()) continue; // 完全相同的已单独报
      near.push({ a: A, b: B, sim: sim });
    }
  }
  near.sort(function (x, y) { return y.sim - x.sim; });
  return { exact: exact, near: near };
}

/**
 * 跨两个文案池找重复（例如「选项文案 × 节点标题」）
 * 与 scanDuplicates 同算法，只是比较范围固定为 A×B
 */
function crossDuplicates(itemsA, itemsB, threshold) {
  function prep(items) {
    return items.map(function (it) {
      var n = normalize(it.text);
      return { module: it.module, field: it.field, text: it.text, norm: n, set: charSet(n), len: n.length };
    });
  }
  var A = prep(itemsA), B = prep(itemsB);
  var exact = [], near = [];
  for (var i = 0; i < A.length; i++) {
    for (var j = 0; j < B.length; j++) {
      var a = A[i], b = B[j];
      if (!a.len || !b.len) continue;
      var max = Math.max(a.len, b.len), min = Math.min(a.len, b.len);
      if (min / max < 0.6) continue;
      var same = String(a.text).trim() === String(b.text).trim();
      if (!same) {
        var sim = jaccard(a.set, b.set);
        if (sim < threshold) continue;
        near.push({ a: a, b: b, sim: sim });
      } else {
        exact.push({ a: a, b: b, sim: 1 });
      }
    }
  }
  near.sort(function (x, y) { return y.sim - x.sim; });
  return { exact: exact, near: near };
}

/** 截断长文本，便于放进报告表格 */
function brief(s, n) {
  var t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  n = n || 28;
  return t.length > n ? t.slice(0, n) + '…' : t;
}

/* =========================================================
   模块 A：情绪急诊室
   ========================================================= */
function auditClinic() {
  var mod = newModule('clinic', '情绪急诊室', '🏥');
  var data = require(path.join(JS_DIR, 'data-moods.js'));
  var moods = data.moods || [];
  var packs = data.keywordPacks || {};
  var packKeys = Object.keys(packs);

  var MOOD_FIELDS = ['id', 'name', 'emoji', 'desc'];
  var moodIds = new Set();
  var moodRows = [];
  var pool = [];
  var blessingPool = [];
  var moodBlessings = 0;
  var remedyTotal = 0;

  moods.forEach(function (m) {
    var tag = m.name || m.id || '(未命名)';
    var missing = MOOD_FIELDS.filter(function (f) {
      return m[f] === undefined || m[f] === null || m[f] === '';
    });
    ['diagnoses', 'causes', 'remedies', 'blessings'].forEach(function (f) {
      if (!Array.isArray(m[f]) || !m[f].length) missing.push(f);
    });
    if (missing.length) {
      fail(mod, '心情「' + tag + '」字段完整', '缺 ' + missing.join('/'), '字段不全必须补齐');
    } else {
      pass(mod, '心情「' + tag + '」字段完整', '8/8 字段');
    }

    if (moodIds.has(m.id)) fail(mod, '心情 id 唯一', m.id, 'id 重复');
    else moodIds.add(m.id);

    // 数量与下限
    var dN = (m.diagnoses || []).length, cN = (m.causes || []).length;
    var rN = (m.remedies || []).length, bN = (m.blessings || []).length;
    if (dN < 3) warn(mod, '心情「' + tag + '」诊断条数', dN, '少于 3 条，重掷容易露出同一句');
    if (cN < 3) warn(mod, '心情「' + tag + '」病因条数', cN, '少于 3 条');
    if (rN < 3) warn(mod, '心情「' + tag + '」处方条数', rN, '少于 3 条，诊断单会显得单薄');
    if (bN < 3) warn(mod, '心情「' + tag + '」祝福条数', bN, '少于 3 条');

    // 处方项字段
    var badRemedy = (m.remedies || []).filter(function (r) {
      return !r || !r.t || !r.d;
    });
    if (badRemedy.length) {
      fail(mod, '心情「' + tag + '」处方字段完整', badRemedy.length + ' 条缺 t/d', '每条处方都要有标题与说明');
    } else {
      pass(mod, '心情「' + tag + '」处方字段完整', rN + ' 条均有 t/d');
    }

    moodBlessings += bN;
    remedyTotal += rN;

    (m.diagnoses || []).forEach(function (x) { pool.push({ module: '情绪急诊室', field: '心情「' + tag + '」·诊断', text: x }); });
    (m.causes || []).forEach(function (x) { pool.push({ module: '情绪急诊室', field: '心情「' + tag + '」·病因', text: x }); });
    (m.blessings || []).forEach(function (x) {
      // 祝福单独成池，避免和「全模块近重复」重复报同一条
      blessingPool.push({ module: '情绪急诊室', field: '心情「' + tag + '」·祝福', text: x });
    });
    (m.remedies || []).forEach(function (r) {
      if (!r) return;
      pool.push({ module: '情绪急诊室', field: '心情「' + tag + '」·处方标题', text: r.t });
      pool.push({ module: '情绪急诊室', field: '心情「' + tag + '」·处方说明', text: r.d });
    });

    moodRows.push([tag, m.emoji || '—', dN, cN, rN, bN,
      missing.length ? '❌ 缺 ' + missing.join('/') : '✅']);
  });

  // checkup 字段（v1.6.0 计划新增，当前未启用）
  var withCheckup = moods.filter(function (m) {
    return typeof m.checkup === 'string' && m.checkup.trim();
  }).length;
  if (withCheckup === 0) {
    info(mod, '心情 checkup 字段', '未启用', 'v1.6.0 计划字段，数据侧尚未提供，当前 0/' + moods.length + ' 个心情带（属预期，不算错误）');
  } else if (withCheckup < moods.length) {
    warn(mod, '心情 checkup 字段', withCheckup + '/' + moods.length, '只有部分心情启用，建议统一');
  } else {
    pass(mod, '心情 checkup 字段', withCheckup + '/' + moods.length + ' 已启用');
  }

  // 关键词包
  var packBlessings = 0;
  var packRows = [];
  var triggerOwner = new Map();
  var triggerClash = [];

  packKeys.forEach(function (key) {
    var p = packs[key] || {};
    var missing = [];
    if (!Array.isArray(p.causes) || !p.causes.length) missing.push('causes');
    if (!Array.isArray(p.remedies) || !p.remedies.length) missing.push('remedies');
    if (!Array.isArray(p.blessings) || !p.blessings.length) missing.push('blessings');
    if (missing.length) {
      fail(mod, '关键词包「' + key + '」结构完整', '缺 ' + missing.join('/'), '关键词包字段不全');
    } else {
      pass(mod, '关键词包「' + key + '」结构完整', 'causes/remedies/blessings 齐全');
    }
    var bad = (p.remedies || []).filter(function (r) { return !r || !r.t || !r.d; });
    if (bad.length) fail(mod, '关键词包「' + key + '」处方字段完整', bad.length + ' 条缺 t/d');

    packBlessings += (p.blessings || []).length;

    (p.causes || []).forEach(function (x) { pool.push({ module: '情绪急诊室', field: '关键词包「' + key + '」·病因', text: x }); });
    (p.blessings || []).forEach(function (x) {
      // 祝福只进祝福池，避免和「全模块近重复」重复报同一条
      blessingPool.push({ module: '情绪急诊室', field: '关键词包「' + key + '」·祝福', text: x });
    });
    (p.remedies || []).forEach(function (r) {
      if (!r) return;
      pool.push({ module: '情绪急诊室', field: '关键词包「' + key + '」·处方标题', text: r.t });
      pool.push({ module: '情绪急诊室', field: '关键词包「' + key + '」·处方说明', text: r.d });
    });

    // 触发词：包名 + 可选的 keywords 扩展（v1.6.0 才新增）
    // 注意：包里把「自己的名字」也列进 keywords 是常规写法，不算冲突，要排除掉
    var triggers = [key];
    (Array.isArray(p.keywords) ? p.keywords : []).forEach(function (t) {
      var w = String(t).trim();
      if (w && w !== key && triggers.indexOf(w) === -1) triggers.push(w);
    });
    triggers.forEach(function (w) {
      if (triggerOwner.has(w)) triggerClash.push({ word: w, a: triggerOwner.get(w), b: key });
      else triggerOwner.set(w, key);
    });

    packRows.push([key,
      (p.causes || []).length, (p.remedies || []).length, (p.blessings || []).length,
      missing.length ? '❌ 缺 ' + missing.join('/') : '✅']);
  });

  var packKeywordsOn = packKeys.filter(function (k) {
    return Array.isArray(packs[k].keywords) && packs[k].keywords.length;
  }).length;
  if (packKeywordsOn === 0) {
    info(mod, '关键词包 keywords 字段', '未启用', 'v1.6.0 才新增，当前 0/' + packKeys.length + ' 个包提供（属预期，不算错误）');
  } else {
    pass(mod, '关键词包 keywords 字段', packKeywordsOn + '/' + packKeys.length + ' 已启用');
  }

  if (triggerClash.length) {
    triggerClash.forEach(function (c) {
      warn(mod, '关键词触发词归属唯一', c.word, '同时出现在「' + c.a + '」与「' + c.b + '」两个包里，命中会二义');
    });
  } else {
    pass(mod, '关键词触发词归属唯一', packKeys.length + ' 个触发词无冲突');
  }

  // 祝福重复
  var bDup = scanDuplicates(blessingPool, 0.75);
  if (bDup.exact.length) {
    bDup.exact.forEach(function (d) {
      fail(mod, '祝福无精确重复', brief(d.b.text), '与「' + d.a.field + '」完全相同');
    });
  } else {
    pass(mod, '祝福无精确重复', moodBlessings + ' + ' + packBlessings + ' 条祝福零重复');
  }
  if (bDup.near.length) {
    bDup.near.forEach(function (d) {
      warn(mod, '祝福无近重复', brief(d.b.text, 20) + ' ≈ ' + brief(d.a.text, 20),
        '相似度 ' + d.sim.toFixed(2) + '（' + d.a.field + ' ↔ ' + d.b.field + '）');
    });
  } else {
    pass(mod, '祝福无近重复', '全部低于 0.75 阈值');
  }

  // 全模块文案近重复（祝福池单独查，避免同一条报两遍）
  var dup = scanDuplicates(pool, 0.75);
  if (dup.exact.length) {
    dup.exact.forEach(function (d) {
      warn(mod, '急诊室文案无精确重复', brief(d.b.text), '与「' + d.a.field + '」完全相同');
    });
  } else {
    pass(mod, '急诊室文案无精确重复', pool.length + ' 条诊断/病因/处方文案零重复');
  }
  if (dup.near.length) {
    dup.near.forEach(function (d) {
      warn(mod, '急诊室文案近重复', brief(d.b.text, 18) + ' ≈ ' + brief(d.a.text, 18),
        '相似度 ' + d.sim.toFixed(2) + '（' + d.a.field + ' ↔ ' + d.b.field + '）');
    });
  } else {
    pass(mod, '急诊室文案近重复', pool.length + ' 条文案全部低于 0.75 阈值');
  }

  mod.entries = moods.length;
  mod.detail = '心情 ' + moods.length + ' · 关键词包 ' + packKeys.length +
    ' · 心情祝福 ' + moodBlessings + ' · 包祝福 ' + packBlessings +
    ' · 处方 ' + remedyTotal + ' 条 · 文案 ' + (pool.length + blessingPool.length) + ' 条';
  addTable(mod, '心情明细', ['心情', 'emoji', '诊断', '病因', '处方', '祝福', '结论'], moodRows);
  addTable(mod, '关键词包明细', ['关键词', '病因', '处方', '祝福', '结论'], packRows);
  return mod;
}

/* =========================================================
   模块 B：社恐话术机
   ========================================================= */
function auditTalk() {
  var mod = newModule('talk', '社恐话术机', '💬');
  var data = require(path.join(JS_DIR, 'data-scenes.js'));
  var scenes = data.scenes || [];
  var tones = data.tones || {};
  var toneKeys = Object.keys(tones);

  // 语气定义
  var badTones = toneKeys.filter(function (k) {
    var t = tones[k] || {};
    return !t.key || !t.name || !t.emoji || !t.desc;
  });
  if (badTones.length) {
    fail(mod, '语气定义字段完整', badTones.length + ' 档缺字段', '语气需要 key/name/emoji/desc');
  } else {
    pass(mod, '语气定义字段完整', toneKeys.length + ' 档齐全');
  }
  pass(mod, '语气档位数量', toneKeys.length + ' 档（' + toneKeys.join('/') + '）');

  var sceneIds = new Set();
  var pool = [];
  var replyPool = [];
  var totalReplies = 0;
  var emptyCells = 0, thinCells = 0, okCells = 0;
  var rows = [];

  scenes.forEach(function (s) {
    var tag = s.name || s.id || '(未命名)';
    var missing = [];
    ['id', 'name', 'emoji', 'desc'].forEach(function (f) {
      if (!s[f]) missing.push(f);
    });
    if (!s.tip || !String(s.tip).trim()) missing.push('tip');
    if (!s.replies || typeof s.replies !== 'object') missing.push('replies');
    if (missing.length) {
      fail(mod, '场景「' + tag + '」基础字段完整', '缺 ' + missing.join('/'), '场景基础字段必须齐全');
    } else {
      pass(mod, '场景「' + tag + '」基础字段完整', 'id/name/emoji/desc/tip 齐全');
    }
    if (sceneIds.has(s.id)) fail(mod, '场景 id 唯一', s.id, 'id 重复');
    else sceneIds.add(s.id);

    var cells = [];
    toneKeys.forEach(function (tk) {
      var list = s.replies ? s.replies[tk] : undefined;
      if (!Array.isArray(list)) {
        fail(mod, '场景「' + tag + '」[' + tk + '] 话术列表', '缺失', '该场景没有 ' + tk + ' 语气的话术');
        emptyCells++;
        cells.push('❌ 缺');
        return;
      }
      var blanks = list.filter(function (x) {
        return typeof x !== 'string' || !x.trim();
      });
      if (blanks.length) {
        fail(mod, '场景「' + tag + '」[' + tk + '] 话术非空', blanks.length + ' 条空串', '空串会直接显示在界面上');
        emptyCells++;
      }
      if (list.length < 3) {
        warn(mod, '场景「' + tag + '」[' + tk + '] 话术条数', list.length + ' 条', '少于 3 条，重掷很快见底');
        thinCells++;
      }
      if (!blanks.length && list.length >= 3) okCells++;
      totalReplies += list.length;
      list.forEach(function (x) {
        if (typeof x !== 'string' || !x.trim()) return;
        var item = { module: '社恐话术机', field: '场景「' + tag + '」[' + tk + ']', text: x };
        pool.push(item);
        replyPool.push(item);
      });
      cells.push(list.length + ' 条' + (blanks.length ? ' ❌' : (list.length < 3 ? ' ⚠️' : ' ✅')));
    });

    if (s.tip) pool.push({ module: '社恐话术机', field: '场景「' + tag + '」·提示', text: s.tip });
    rows.push([tag, s.emoji || '—', cells[0] || '—', cells[1] || '—', cells[2] || '—',
      s.tip ? '✅' : '❌']);
  });

  var cells = scenes.length * toneKeys.length;
  var rate = cells ? Math.round(okCells / cells * 100) : 0;
  if (emptyCells) {
    fail(mod, '语气 × 场景矩阵完整率', rate + '%（' + okCells + '/' + cells + '）',
      emptyCells + ' 个格子缺失或含空串');
  } else if (thinCells) {
    warn(mod, '语气 × 场景矩阵完整率', rate + '%（' + okCells + '/' + cells + '）',
      thinCells + ' 个格子少于 3 条');
  } else {
    pass(mod, '语气 × 场景矩阵完整率', rate + '%（' + okCells + '/' + cells + ' 格）');
  }
  pass(mod, '话术总数', totalReplies + ' 条');

  // when / avoid（v1.7.0 计划新增，当前未启用）
  ['when', 'avoid'].forEach(function (f) {
    var n = scenes.filter(function (s) {
      return typeof s[f] === 'string' && s[f].trim();
    }).length;
    if (n === 0) {
      info(mod, '场景 ' + f + ' 字段', '未启用',
        'v1.7.0 才新增，当前 0/' + scenes.length + ' 个场景提供（属预期，不算错误）');
    } else if (n < scenes.length) {
      warn(mod, '场景 ' + f + ' 字段', n + '/' + scenes.length, '建议统一补齐');
    } else {
      pass(mod, '场景 ' + f + ' 字段', n + '/' + scenes.length + ' 已启用');
    }
  });

  // 精确重复
  var dup = scanDuplicates(pool, 0.75);
  if (dup.exact.length) {
    dup.exact.forEach(function (d) {
      fail(mod, '话术无精确重复', brief(d.b.text), '与「' + d.a.field + '」完全相同');
    });
  } else {
    pass(mod, '话术无精确重复', replyPool.length + ' 条话术零重复');
  }
  if (dup.near.length) {
    dup.near.forEach(function (d) {
      warn(mod, '话术近重复', brief(d.b.text, 18) + ' ≈ ' + brief(d.a.text, 18),
        '相似度 ' + d.sim.toFixed(2) + '（' + d.a.field + ' ↔ ' + d.b.field + '）');
    });
  } else {
    pass(mod, '话术近重复', '全部低于 0.75 阈值');
  }

  mod.entries = scenes.length;
  mod.detail = '场景 ' + scenes.length + ' · 语气 ' + toneKeys.length +
    ' · 话术 ' + totalReplies + ' 条 · 场景提示 ' + scenes.length +
    ' · 矩阵完整率 ' + rate + '%';
  addTable(mod, '场景 × 语气矩阵', ['场景', 'emoji', 'safe', 'pro', 'wild', 'tip'], rows);
  return mod;
}

/* =========================================================
   模块 C：摸鱼补给站
   ========================================================= */
function auditFish() {
  var mod = newModule('fish', '摸鱼补给站', '🐟');

  // 在沙箱里跑 audio.js：window 自引用，AudioContext 缺失时静默降级
  var sandbox = {
    console: console,
    setTimeout: setTimeout, clearTimeout: clearTimeout,
    setInterval: setInterval, clearInterval: clearInterval,
    Math: Math, Date: Date, JSON: JSON
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  var audioCode = fs.readFileSync(path.join(JS_DIR, 'audio.js'), 'utf8');
  vm.runInContext(audioCode, sandbox, { filename: 'audio.js' });
  var audio = sandbox.HS_AUDIO || (sandbox.window && sandbox.window.HS_AUDIO);

  if (!audio || !Array.isArray(audio.sounds)) {
    fail(mod, 'audio.js 可在沙箱中加载', '未取到 window.HS_AUDIO', '沙箱里脚本执行失败');
    mod.entries = 0;
    mod.detail = 'audio.js 加载失败';
    return mod;
  }
  pass(mod, 'audio.js 可在沙箱中加载', 'window.HS_AUDIO 已挂载');

  var sounds = audio.sounds;
  var ids = sounds.map(function (s) { return s.id; });

  // VOICES 实现：从源码里取出对象块的顶层键
  var vStart = audioCode.indexOf('var VOICES');
  var voiceImpl = [];
  if (vStart !== -1) {
    var braceStart = audioCode.indexOf('{', vStart);
    var depth = 0, vEnd = braceStart;
    for (var i = braceStart; i < audioCode.length; i++) {
      if (audioCode[i] === '{') depth++;
      else if (audioCode[i] === '}') { depth--; if (depth === 0) { vEnd = i; break; } }
    }
    var block = audioCode.slice(braceStart, vEnd + 1);
    var re = /^\s{2,}([A-Za-z_$][\w$]*)\s*:\s*function/gm;
    var m;
    while ((m = re.exec(block)) !== null) voiceImpl.push(m[1]);
  }

  var missingImpl = ids.filter(function (id) { return voiceImpl.indexOf(id) === -1; });
  var extraImpl = voiceImpl.filter(function (id) { return ids.indexOf(id) === -1; });
  if (missingImpl.length || extraImpl.length) {
    fail(mod, '音色表与实现一一对应',
      '列表 ' + ids.length + ' 个 / 实现 ' + voiceImpl.length + ' 个',
      (missingImpl.length ? '缺实现：' + missingImpl.join(',') : '') +
      (extraImpl.length ? '；多实现：' + extraImpl.join(',') : ''));
  } else {
    pass(mod, '音色表与实现一一对应', ids.length + ' ↔ ' + voiceImpl.length + '（' + ids.join('/') + '）');
  }

  var rows = [];
  sounds.forEach(function (s) {
    var missing = ['id', 'name', 'emoji', 'desc'].filter(function (f) { return !s[f]; });
    if (missing.length) {
      fail(mod, '音色「' + (s.name || s.id || '?') + '」元信息完整', '缺 ' + missing.join('/'), '音色需要 id/name/emoji/desc');
    } else {
      pass(mod, '音色「' + (s.name || s.id) + '」元信息完整', 'id/name/emoji/desc 齐全');
    }
    rows.push([s.id || '—', s.name || '—', s.emoji || '—', brief(s.desc, 20),
      voiceImpl.indexOf(s.id) === -1 ? '❌ 无实现' : '✅']);
  });

  // 番茄钟档位：从 app.js 的 POMO_MODES 里读
  var appCode = fs.readFileSync(path.join(JS_DIR, 'app.js'), 'utf8');
  var html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  var minutes = [];
  var modesRe = /var\s+POMO_MODES\s*=\s*\[([\s\S]*?)\];/.exec(appCode);
  if (modesRe) {
    var re2 = /minutes:\s*(\d+)/g;
    var mm;
    while ((mm = re2.exec(modesRe[1])) !== null) minutes.push(Number(mm[1]));
  }
  if (minutes.length >= 2) {
    pass(mod, '番茄钟档位', minutes.join('/') + ' 分钟（专注/休息/赶工）',
      '共 ' + minutes.length + ' 档');
    var htmlMin = [];
    var re3 = /(\d+)\s*分钟/g;
    var hm;
    while ((hm = re3.exec(html)) !== null) htmlMin.push(Number(hm[1]));
    var missingInHtml = minutes.filter(function (v) { return htmlMin.indexOf(v) === -1; });
    if (missingInHtml.length) {
      warn(mod, '番茄钟档位与页面文案一致', '页面出现 ' + htmlMin.join('/') + ' 分钟',
        '代码里的 ' + missingInHtml.join('/') + ' 分钟没有出现在页面文案中');
    } else {
      pass(mod, '番茄钟档位与页面文案一致', '页面与代码一致');
    }
  } else {
    warn(mod, '番茄钟档位', '未能解析', '没找到 POMO_MODES 的分钟档位');
  }

  // 伪装页（老板键）：从 data-boss.js 读
  var bossPages = [];
  try {
    bossPages = (require(path.join(JS_DIR, 'data-boss.js')).pages) || [];
  } catch (e) { /* 忽略 */ }
  if (bossPages.length >= 4) {
    pass(mod, '伪装页数量', bossPages.length + ' 个（' + bossPages.map(function (p) { return p.name; }).join('/') + '）');
  } else {
    warn(mod, '伪装页数量', bossPages.length + ' 个', '预期 >= 4 个老板键伪装页');
  }
  bossPages.forEach(function (pg) {
    var missing = ['id', 'name', 'emoji', 'title', 'tag'].filter(function (f) { return !pg[f]; });
    if (missing.length) {
      fail(mod, '伪装页「' + (pg.id || '?') + '」元信息完整', '缺 ' + missing.join('/'), '伪装页需要 id/name/emoji/title/tag');
    } else {
      pass(mod, '伪装页「' + pg.name + '」元信息完整', 'id/name/emoji/title/tag 齐全');
    }
    var hasTable = pg.table && Array.isArray(pg.table.head) && pg.table.rows && pg.table.rows.length;
    var hasList = Array.isArray(pg.list) && pg.list.length;
    if (!hasTable && !hasList) {
      fail(mod, '伪装页「' + (pg.name || pg.id) + '」有内容', '既没有表格也没有清单', '伪装页看起来太空，容易露馅');
    } else {
      pass(mod, '伪装页「' + (pg.name || pg.id) + '」有内容', hasTable ? '表格 ' + pg.table.rows.length + ' 行' : '清单 ' + pg.list.length + ' 条');
    }
  });

  // 呼吸引导（v1.8.0）：从 data-breath.js 读
  var exercises = [];
  try {
    exercises = (require(path.join(JS_DIR, 'data-breath.js')).exercises) || [];
  } catch (e) { /* 忽略 */ }
  if (exercises.length >= 3) {
    pass(mod, '呼吸引导数量', exercises.length + ' 套（' + exercises.map(function (e) { return e.name; }).join('/') + '）');
  } else {
    warn(mod, '呼吸引导数量', exercises.length + ' 套', '预期 >= 3 套呼吸练习');
  }
  exercises.forEach(function (ex) {
    var missing = ['id', 'name', 'emoji', 'when', 'desc', 'finish'].filter(function (f) { return !ex[f]; });
    if (missing.length) {
      fail(mod, '呼吸「' + (ex.id || '?') + '」字段完整', '缺 ' + missing.join('/'), '呼吸练习需要 id/name/emoji/when/desc/finish');
    } else {
      pass(mod, '呼吸「' + ex.name + '」字段完整', 'id/name/emoji/when/desc/finish 齐全');
    }
    if (!Array.isArray(ex.phases) || ex.phases.length < 2) {
      fail(mod, '呼吸「' + (ex.name || ex.id) + '」有阶段', '阶段少于 2 个', '呼吸练习至少要有吸与呼');
    } else {
      pass(mod, '呼吸「' + ex.name + '」有阶段', ex.phases.map(function (p) { return p.label + p.sec + '秒'; }).join(' / '));
    }
  });

  mod.entries = sounds.length + exercises.length + bossPages.length;
  mod.detail = '音色 ' + sounds.length + ' · 合成实现 ' + voiceImpl.length +
    ' · 番茄钟 ' + minutes.join('/') + ' 分钟 · 伪装页 ' + bossPages.length + ' 个' +
    ' · 呼吸 ' + exercises.length + ' 套';
  addTable(mod, '音色明细', ['id', '名称', 'emoji', '说明', '实现'], rows);
  return mod;
}

/* =========================================================
   模块 D：生存故事
   ========================================================= */
function auditStoryFile(mod, story, engine, label, agg) {
  var nodes = story.nodes || {};
  var endings = story.endings || {};
  var nodeIds = Object.keys(nodes);
  var endIds = Object.keys(endings);

  var pool = [];       // 正文 / 回响 / 结局字段
  var titlePool = [];  // 节点标题
  var choicePool = []; // 选项文案
  var choiceCount = 0;
  var badNext = [];
  var rows = [];

  nodeIds.forEach(function (id) {
    var n = nodes[id] || {};
    var missing = ['emoji', 'title', 'text'].filter(function (f) { return !n[f]; });
    if (!Array.isArray(n.choices) || !n.choices.length) missing.push('choices');
    if (missing.length) {
      fail(mod, '节点「' + id + '」字段完整', '缺 ' + missing.join('/'), '节点需要 emoji/title/text/choices');
    } else {
      pass(mod, '节点「' + id + '」字段完整', 'emoji/title/text/choices 齐全');
    }
    pool.push({ module: label, field: '节点「' + id + '」·正文', text: n.text });
    titlePool.push({ module: label, field: '节点「' + id + '」·标题', text: n.title });

    var nChoice = (n.choices || []).length;
    choiceCount += nChoice;
    (n.choices || []).forEach(function (c, i) {
      if (!c || !c.label) {
        fail(mod, '节点「' + id + '」选择 ' + (i + 1), '缺 label', '每个选择都要有文案');
      }
      if (!c || !c.next) {
        fail(mod, '节点「' + id + '」选择 ' + (i + 1) + ' 的 next', '缺失', '选择必须指向下一个节点');
      } else if (!nodes[c.next] && !endings[c.next]) {
        badNext.push({ node: id, index: i + 1, next: c.next });
        fail(mod, '节点「' + id + '」选择 ' + (i + 1) + ' 的 next', c.next, '指向了不存在的节点/结局');
      }
      if (!c || !c.tip || !String(c.tip).trim()) {
        warn(mod, '节点「' + id + '」选择 ' + (i + 1) + ' 的 tip', '缺失', '回响文案为空');
      }
      if (c) {
        choicePool.push({ module: label, field: '节点「' + id + '」·选项 ' + (i + 1), text: c.label });
        if (c.tip) pool.push({ module: label, field: '节点「' + id + '」·回响 ' + (i + 1), text: c.tip });
      }
    });
    rows.push([id, n.emoji || '—', brief(n.title, 12), nChoice,
      (n.choices || []).every(function (c) { return c && nodes[c.next] !== undefined || (c && endings[c.next]); }) ? '✅' : '❌']);
  });

  endIds.forEach(function (id) {
    var e = endings[id] || {};
    var missing = ['emoji', 'title', 'grade', 'desc', 'comfort', 'tip'].filter(function (f) { return !e[f]; });
    if (missing.length) {
      fail(mod, '结局「' + id + '」字段完整', '缺 ' + missing.join('/'), '结局需要 emoji/title/grade/desc/comfort/tip');
    } else {
      pass(mod, '结局「' + id + '」字段完整', '6/6 字段齐全');
    }
    ['title', 'desc', 'comfort', 'tip'].forEach(function (f) {
      if (e[f]) pool.push({ module: label, field: '结局「' + id + '」·' + f, text: e[f] });
    });
  });

  // 可达性
  var reach = engine.storyReach(story.id);
  var reachNodes = Object.keys(reach.nodes || {});
  var reachEnds = Object.keys(reach.endings || {});
  var unreachableNodes = nodeIds.filter(function (id) { return !reach.nodes[id]; });
  // 兜底结局（loopEnding）本来就不经选项可达，它由步数上限触发，单独算
  var fallbackId = story && story.loopEnding;
  var normalEnds = endIds.filter(function (id) { return id !== fallbackId; });
  var unreachableEnds = normalEnds.filter(function (id) { return !reach.endings[id]; });

  if (unreachableEnds.length) {
    unreachableEnds.forEach(function (id) {
      warn(mod, '结局可达', id + ' 不可达', '从起点「' + story.start + '」走不到这个结局');
    });
  } else {
    var reachNormal = normalEnds.filter(function (id) { return reach.endings[id]; }).length;
    pass(mod, '结局可达', reachNormal + '/' + normalEnds.length + ' 全部可达' +
      (fallbackId ? '（兜底结局 ' + fallbackId + ' 由步数上限触发）' : ''));
  }
  if (unreachableNodes.length) {
    unreachableNodes.forEach(function (id) {
      warn(mod, '节点可达', id + ' 不可达', '从起点走不到这个节点');
    });
  } else {
    pass(mod, '节点可达', reachNodes.length + '/' + nodeIds.length + ' 全部可达');
  }

  // 环检测：故事图里出现环时玩家可能永远走不到结局
  // v1.6.0 起引擎计划用 STORY.maxSteps + STORY.loopEnding 到点强制收尾，
  // 有这套兜底时环只算「剧情分支」，降级为 WARN；没有兜底才是真 ERROR。
  var engineSrc = fs.readFileSync(path.join(JS_DIR, 'engine.js'), 'utf8');
  var startState = null;
  try { startState = engine.storyStart(); } catch (e) { startState = null; }
  var maxSteps = (story && story.maxSteps) || (startState && startState.maxSteps) ||
    (/\bmaxSteps\b/.test(engineSrc) ? '引擎内定义' : 0);
  var loopEnding = (story && story.loopEnding) || (startState && startState.loopEnding) ||
    (/\bloopEnding\b/.test(engineSrc) ? '引擎内定义' : 0);
  var hasLoopGuard = !!maxSteps && !!loopEnding;

  // 兜底结局必须真的存在，否则步数到顶后玩家会卡死在空状态
  if (loopEnding) {
    if (!endings[loopEnding]) {
      fail(mod, '兜底结局存在', String(loopEnding), '引擎到步数上限会落到这个结局，但结局表里没有它');
    } else {
      pass(mod, '兜底结局存在', String(loopEnding) + ' 在结局表中（步数上限 ' + maxSteps + ' 步时收尾）');
    }
  } else {
    warn(mod, '兜底结局存在', '未定义', '没有 loopEnding，循环剧情没有收尾兜底');
  }

  var cycles = findCycles(nodes, endings);
  if (cycles.length) {
    cycles.forEach(function (c) {
      if (hasLoopGuard) {
        warn(mod, '故事图环检测', c.join(' → '),
          '存在环，但引擎有步数上限（maxSteps=' + maxSteps + '，loopEnding=' + loopEnding + '），到点强制收尾');
      } else {
        fail(mod, '故事图环检测', c.join(' → '),
          '存在环，且引擎暂无步数上限（未发现 STORY.maxSteps / STORY.loopEnding），玩家可能永远走不到结局');
      }
    });
  } else {
    pass(mod, '故事图环检测', '无自环/互环');
  }

  // 通路长度（简单路径枚举）
  var stat = pathStats(nodes, endings, story.start);
  if (stat.count) {
    pass(mod, '平均通关路径长度',
      stat.avg.toFixed(2) + ' 步（最短 ' + stat.min + ' · 最长 ' + stat.max + '）',
      '共 ' + stat.count + ' 条简单路径');
  } else {
    warn(mod, '平均通关路径长度', '未能枚举', '起点走不到任何结局');
  }

  // —— 重复检测拆成三项：标题 vs 标题 / 选项文案 vs 节点标题 / 正文与其它文案 ——
  // 1) 节点标题之间的重复
  var titleDup = scanDuplicates(titlePool, 0.75);
  if (titleDup.exact.length) {
    titleDup.exact.forEach(function (d) {
      warn(mod, '节点标题无重复', brief(d.b.text), '与「' + d.a.field + '」完全相同');
    });
  } else {
    pass(mod, '节点标题无重复', titlePool.length + ' 个节点标题互不相同');
  }
  if (titleDup.near.length) {
    titleDup.near.forEach(function (d) {
      warn(mod, '节点标题无近重复', brief(d.b.text, 18) + ' ≈ ' + brief(d.a.text, 18),
        '相似度 ' + d.sim.toFixed(2) + '（' + d.a.field + ' ↔ ' + d.b.field + '）');
    });
  } else {
    pass(mod, '节点标题无近重复', '全部低于 0.75 阈值');
  }

  // 2) 选项文案与节点标题撞车（标题短、容易撞，单独列出）
  var cross = crossDuplicates(choicePool, titlePool, 0.75);
  if (cross.exact.length) {
    cross.exact.forEach(function (d) {
      warn(mod, '选项文案不与节点标题撞车', brief(d.b.text), '与「' + d.a.field + '」完全相同');
    });
  } else {
    pass(mod, '选项文案不与节点标题撞车（完全相同）', choicePool.length + ' 条选项文案均未与节点标题重合');
  }
  if (cross.near.length) {
    cross.near.forEach(function (d) {
      warn(mod, '选项文案不与节点标题撞车（近重复）', brief(d.b.text, 18) + ' ≈ ' + brief(d.a.text, 18),
        '相似度 ' + d.sim.toFixed(2) + '（' + d.a.field + ' ↔ ' + d.b.field + '）');
    });
  } else {
    pass(mod, '选项文案不与节点标题撞车（近重复）', '全部低于 0.75 阈值');
  }

  // 3) 选项文案之间的重复（选项之间互相撞车也算瑕疵）
  var choiceDup = scanDuplicates(choicePool, 0.75);
  if (choiceDup.exact.length) {
    choiceDup.exact.forEach(function (d) {
      warn(mod, '选项文案无重复', brief(d.b.text), '与「' + d.a.field + '」完全相同');
    });
  } else {
    pass(mod, '选项文案无重复', choicePool.length + ' 条选项文案零重复');
  }
  if (choiceDup.near.length) {
    choiceDup.near.forEach(function (d) {
      warn(mod, '选项文案无近重复', brief(d.b.text, 18) + ' ≈ ' + brief(d.a.text, 18),
        '相似度 ' + d.sim.toFixed(2) + '（' + d.a.field + ' ↔ ' + d.b.field + '）');
    });
  } else {
    pass(mod, '选项文案无近重复', '全部低于 0.75 阈值');
  }

  // 4) 正文 / 回响 / 结局字段之间的重复
  var dup = scanDuplicates(pool, 0.75);
  if (dup.exact.length) {
    dup.exact.forEach(function (d) {
      warn(mod, '故事正文无精确重复', brief(d.b.text), '与「' + d.a.field + '」完全相同');
    });
  } else {
    pass(mod, '故事正文无精确重复', pool.length + ' 条正文/回响/结局文案零重复');
  }
  if (dup.near.length) {
    dup.near.forEach(function (d) {
      warn(mod, '故事正文无近重复', brief(d.b.text, 18) + ' ≈ ' + brief(d.a.text, 18),
        '相似度 ' + d.sim.toFixed(2) + '（' + d.a.field + ' ↔ ' + d.b.field + '）');
    });
  } else {
    pass(mod, '故事正文无近重复', '全部低于 0.75 阈值');
  }

  agg.nodes += nodeIds.length;
  agg.ends += endIds.length;
  agg.choices += choiceCount;
  agg.detail.push(label + '：节点 ' + nodeIds.length + ' · 结局 ' + endIds.length +
    ' · 选项 ' + choiceCount + ' 条 · 可达结局 ' +
    normalEnds.filter(function (id) { return reach.endings[id]; }).length +
    (fallbackId ? '（+1 兜底 ' + fallbackId + '）' : '') +
    ' · 平均通关 ' + (stat.count ? stat.avg.toFixed(2) : '—') + ' 步');
  addTable(mod, '节点明细 · ' + label, ['节点 id', 'emoji', '标题', '选项数', '指向有效'], rows);
  return mod;
}

/** 载入全部剧目（v1.9.0 起支持多部剧） */
function loadStories() {
  var out = [];
  ['data-story.js', 'data-story2.js'].forEach(function (f) {
    var p = path.join(JS_DIR, f);
    if (!fs.existsSync(p)) return;
    var s = null;
    try { s = require(p); } catch (e) { return; }
    if (!s || !s.nodes) return;
    if (!s.id) s.id = out.length === 0 ? 'today' : ('story' + (out.length + 1));
    out.push(s);
  });
  return out;
}

/** 生存故事模块（含全部剧目） */
function auditStory() {
  var mod = newModule('story', '生存故事', '🎲');
  var engine = require(path.join(JS_DIR, 'engine.js'));
  var stories = loadStories();
  if (!stories.length) {
    fail(mod, '剧目可载入', '0 部', '找不到 data-story.js');
    mod.entries = 0;
    mod.detail = '没有可用剧目';
    return mod;
  }
  pass(mod, '剧目可载入', stories.length + ' 部：' + stories.map(function (s) { return s.title || s.id; }).join(' / '));
  var agg = { nodes: 0, ends: 0, choices: 0, detail: [] };
  stories.forEach(function (st) {
    auditStoryFile(mod, st, engine, st.title || st.id, agg);
  });
  mod.entries = agg.nodes;
  mod.detail = agg.detail.join(' ｜ ');
  return mod;
}

/** 每日彩蛋（v1.9.0） */
function auditChallenges() {
  var mod = newModule('challenge', '每日彩蛋', '🎯');
  var p = path.join(JS_DIR, 'data-challenges.js');
  if (!fs.existsSync(p)) {
    fail(mod, '彩蛋数据文件存在', 'data-challenges.js', '缺少每日彩蛋数据');
    mod.entries = 0;
    return mod;
  }
  var data = require(p);
  var items = data.items || [];
  pass(mod, '彩蛋数据文件存在', 'data-challenges.js');
  if (items.length < 12) {
    fail(mod, '彩蛋数量', items.length + ' 条', '期望 >= 12 条');
  } else {
    pass(mod, '彩蛋数量', items.length + ' 条');
  }
  var ids = {}, pool = [];
  items.forEach(function (c) {
    var missing = ['id', 'text', 'hint'].filter(function (f) { return !c[f]; });
    if (missing.length) {
      fail(mod, '彩蛋「' + (c.id || '?') + '」字段完整', '缺 ' + missing.join('/'), '每条彩蛋需要 id/text/hint');
    } else {
      pass(mod, '彩蛋「' + c.id + '」字段完整', 'id/text/hint 齐全');
    }
    if (ids[c.id]) fail(mod, '彩蛋 id 唯一', c.id, 'id 重复');
    ids[c.id] = true;
    pool.push({ module: '每日彩蛋', field: '彩蛋「' + c.id + '」', text: c.text });
    pool.push({ module: '每日彩蛋', field: '彩蛋「' + c.id + '」·提示', text: c.hint });
  });
  var dup = scanDuplicates(pool, 0.75);
  if (dup.exact.length) {
    dup.exact.forEach(function (d) {
      fail(mod, '彩蛋文案无精确重复', brief(d.b.text), '与「' + d.a.field + '」完全相同');
    });
  } else {
    pass(mod, '彩蛋文案无精确重复', pool.length + ' 条文案零重复');
  }
  if (dup.near.length) {
    dup.near.forEach(function (d) {
      warn(mod, '彩蛋文案无近重复', brief(d.b.text, 18) + ' ≈ ' + brief(d.a.text, 18),
        '相似度 ' + d.sim.toFixed(2));
    });
  } else {
    pass(mod, '彩蛋文案无近重复', '全部低于 0.75 阈值');
  }
  try {
    var engine = require(path.join(JS_DIR, 'engine.js'));
    var c1 = engine.challengesOf('2026-11-17');
    var c2 = engine.challengesOf('2026-11-17');
    if (!c1 || c1.id !== c2.id) {
      fail(mod, '同一天的彩蛋固定', '两次结果不同', '彩蛋应当按日期确定');
    } else {
      pass(mod, '同一天的彩蛋固定', c1.id);
    }
  } catch (e) {
    fail(mod, '彩蛋可按日期取出', '抛异常', String(e && e.message));
  }
  mod.entries = items.length;
  mod.detail = '彩蛋 ' + items.length + ' 条';
  return mod;
}

/** 找出故事图里的环（返回环路径数组） */
function findCycles(nodes, endings) {
  var color = {};      // 0 未访问 1 在栈上 2 已完成
  var stack = [];
  var cycles = [];

  function dfs(id) {
    color[id] = 1;
    stack.push(id);
    var n = nodes[id];
    if (n) {
      (n.choices || []).forEach(function (c) {
        if (!c || !c.next) return;
        if (endings[c.next]) return;
        if (!nodes[c.next]) return;
        if (color[c.next] === 1) {
          var at = stack.indexOf(c.next);
          cycles.push(stack.slice(at).concat([c.next]));
        } else if (!color[c.next]) {
          dfs(c.next);
        }
      });
    }
    stack.pop();
    color[id] = 2;
  }

  Object.keys(nodes).forEach(function (id) {
    if (!color[id]) dfs(id);
  });
  return cycles;
}

/** 统计从起点到结局的简单路径长度 */
function pathStats(nodes, endings, start) {
  var lens = [];
  var byEnd = {};
  var onPath = {};

  function dfs(id, len) {
    var n = nodes[id];
    if (!n) return;
    (n.choices || []).forEach(function (c) {
      if (!c || !c.next) return;
      if (endings[c.next]) {
        lens.push(len + 1);
        (byEnd[c.next] = byEnd[c.next] || []).push(len + 1);
      } else if (nodes[c.next] && !onPath[c.next]) {
        onPath[c.next] = 1;
        dfs(c.next, len + 1);
        delete onPath[c.next];
      }
    });
  }

  if (nodes[start]) {
    onPath[start] = 1;
    dfs(start, 0);
  }
  if (!lens.length) return { count: 0, avg: 0, min: 0, max: 0, byEnd: byEnd };
  var sum = lens.reduce(function (a, b) { return a + b; }, 0);
  return {
    count: lens.length,
    avg: sum / lens.length,
    min: Math.min.apply(null, lens),
    max: Math.max.apply(null, lens),
    byEnd: byEnd
  };
}

/* =========================================================
   模块 E：疗愈周报
   ========================================================= */
function auditReport() {
  var mod = newModule('report', '疗愈周报', '📈');
  var engine = require(path.join(JS_DIR, 'engine.js'));
  var appCode = fs.readFileSync(path.join(JS_DIR, 'app.js'), 'utf8');

  var rep;
  try {
    rep = engine.weeklyReport({}, '2026-01-01', 7);
  } catch (e) {
    fail(mod, 'weeklyReport 可用', '抛异常', String(e && e.message));
    mod.entries = 0;
    mod.detail = 'weeklyReport 调用失败';
    return mod;
  }
  var repKeys = Object.keys(rep || {});
  var totalsKeys = Object.keys((rep && rep.totals) || {});
  pass(mod, 'weeklyReport 返回字段', repKeys.length + ' 个：' + repKeys.join('/'));
  pass(mod, '周报统计键（totals）', totalsKeys.length + ' 个：' + totalsKeys.join('/'));
  pass(mod, '周报窗口长度', ((rep.days || []).length) + ' 天');

  // app.js 里的统计卡定义
  var cardsBlock = extractCardsBlock(appCode);
  var cardCount = 0, cardKeys = [], cardRows = [];
  if (cardsBlock === null) {
    warn(mod, 'app.js 统计卡定义可解析', '未找到 cards 数组', '无法比对统计卡条数');
  } else {
    var entries = cardsBlock.split(/\},\s*\{/).filter(function (x) { return x.trim(); });
    cardCount = entries.length;
    var re = /rep\.totals\.([A-Za-z_$][\w$]*)/g;
    var m;
    while ((m = re.exec(cardsBlock)) !== null) {
      if (cardKeys.indexOf(m[1]) === -1) cardKeys.push(m[1]);
    }
    var re2 = /label:\s*'([^']*)'/g;
    var labels = [];
    while ((m = re2.exec(cardsBlock)) !== null) labels.push(m[1]);
    cardRows = labels.map(function (lb, i) {
      return [lb, cardKeys[i] || '?', '✅'];
    });
    pass(mod, 'app.js 统计卡条数', cardCount + ' 张（' + labels.join('/') + '）');
  }

  if (cardCount && cardCount !== totalsKeys.length) {
    warn(mod, '统计卡条数与统计键一致', cardCount + ' 张卡 / ' + totalsKeys.length + ' 个统计键',
      '数量不一致，界面与数据会脱节');
  } else {
    pass(mod, '统计卡条数与统计键一致', cardCount + ' / ' + totalsKeys.length);
  }

  var unknown = cardKeys.filter(function (k) { return totalsKeys.indexOf(k) === -1; });
  var unused = totalsKeys.filter(function (k) { return cardKeys.indexOf(k) === -1; });
  if (unknown.length) {
    fail(mod, '统计卡引用的统计键有效', unknown.join(','), '界面引用了 weeklyReport 里不存在的键');
  } else {
    pass(mod, '统计卡引用的统计键有效', cardKeys.join('/') + ' 均存在');
  }
  if (unused.length) {
    warn(mod, '统计键都被做成卡片', '未上卡：' + unused.join(','), '有统计项没有对应统计卡');
  } else {
    pass(mod, '统计键都被做成卡片', '无遗漏');
  }

  // reportSummary / reportText 对空数据不抛异常
  try {
    var sum = engine.reportSummary(rep, {}, {});
    if (typeof sum !== 'string' || !sum.length) {
      fail(mod, 'reportSummary 空数据可用', '返回 ' + JSON.stringify(sum), '空周报也应有兜底文案');
    } else {
      pass(mod, 'reportSummary 空数据可用', sum.length + ' 字');
    }
  } catch (e) {
    fail(mod, 'reportSummary 空数据可用', '抛异常', String(e && e.message));
  }
  try {
    var txt = engine.reportText(rep, '');
    if (typeof txt !== 'string' || !txt.length) {
      fail(mod, 'reportText 空数据可用', '返回 ' + JSON.stringify(txt), '空周报也应有兜底文案');
    } else {
      pass(mod, 'reportText 空数据可用', txt.split('\n').length + ' 行');
    }
  } catch (e) {
    fail(mod, 'reportText 空数据可用', '抛异常', String(e && e.message));
  }

  // 小结文案是否覆盖了全部统计键
  var engineCode = fs.readFileSync(path.join(JS_DIR, 'engine.js'), 'utf8');
  var sumSrc = /function\s+reportSummary\s*\([\s\S]*?\n  \}/.exec(engineCode);
  var sumKeys = [];
  if (sumSrc) {
    var re3 = /rep\.totals\.([A-Za-z_$][\w$]*)/g;
    var mm;
    while ((mm = re3.exec(sumSrc[0])) !== null) {
      if (sumKeys.indexOf(mm[1]) === -1) sumKeys.push(mm[1]);
    }
  }
  var sumMissing = totalsKeys.filter(function (k) { return sumKeys.indexOf(k) === -1; });
  if (sumMissing.length) {
    warn(mod, '周报小结覆盖全部统计项', '未提及：' + sumMissing.join(','), '小结文案漏掉了部分统计项');
  } else {
    pass(mod, '周报小结覆盖全部统计项', '全覆盖');
  }

  mod.entries = cardCount || totalsKeys.length;
  mod.detail = '统计卡 ' + cardCount + ' 张 · 周报统计键 ' + totalsKeys.length +
    ' 个 · 周报返回字段 ' + repKeys.length + ' 个 · 窗口 ' + ((rep.days || []).length) + ' 天';
  if (cardRows.length) addTable(mod, '统计卡对照', ['卡片', '统计键', '结论'], cardRows);

  /* ---------- v1.10.0：连续天数 / 热力日历 / 徽章 / 分享模板 ---------- */

  // 成就徽章
  var badgeData = null;
  try { badgeData = require(path.join(JS_DIR, 'data-badges.js')); } catch (e) { /* ignore */ }
  var badgeList = (badgeData && badgeData.items) || [];
  if (badgeList.length >= 6) {
    pass(mod, '成就徽章数量', badgeList.length + ' 枚');
  } else {
    fail(mod, '成就徽章数量', badgeList.length + ' 枚', '徽章少于 6 枚，成就感不足');
  }
  var badgeIds = new Set();
  var badgeBad = [];
  badgeList.forEach(function (b) {
    if (badgeIds.has(b.id)) badgeBad.push('id 重复：' + b.id);
    badgeIds.add(b.id);
    if (!b.name || !b.emoji || !b.desc) badgeBad.push('字段缺失：' + b.id);
    if (!b.need || ['total', 'streak', 'score'].indexOf(b.need.kind) === -1) badgeBad.push('解锁条件异常：' + b.id);
  });
  if (badgeBad.length) {
    badgeBad.forEach(function (b) { fail(mod, '徽章字段合法', b, '徽章定义有问题'); });
  } else {
    pass(mod, '徽章字段合法', badgeList.length + ' 枚全部通过');
  }
  // 徽章文案不得带比较/惩罚意味
  var punishWords = ['排名', '倒数', '落后', '失败', '连续中断'];
  var punishHits = [];
  badgeList.forEach(function (b) {
    punishWords.forEach(function (w) {
      if ((b.desc || '').indexOf(w) !== -1 || (b.name || '').indexOf(w) !== -1) punishHits.push(b.id + '：' + w);
    });
  });
  if (punishHits.length) {
    punishHits.forEach(function (p) { warn(mod, '徽章文案不制造压力', p, '徽章应当只鼓励、不比较'); });
  } else {
    pass(mod, '徽章文案不制造压力', '未命中比较/惩罚字眼');
  }

  // 连续天数：只鼓励不惩罚（注意：日期键是「2026-11-15」这种不补零的写法）
  var streakDays = {};
  streakDays['2026-11-15'] = { d: 1 };
  streakDays['2026-11-14'] = { d: 1 };
  streakDays['2026-11-13'] = { d: 1 };
  try {
    var st3 = engine.streakOf(streakDays, '2026-11-15');
    var st0 = engine.streakOf({}, '2026-11-15');
    if (st3.days === 3) {
      pass(mod, '连续天数计算', '连续 3 天 → 3 天');
    } else {
      fail(mod, '连续天数计算', '得到 ' + st3.days, '连续天数算错');
    }
    if (st0.days === 0 && String(st0.text).indexOf('没关系') !== -1) {
      pass(mod, '断签不惩罚', st0.text);
    } else {
      fail(mod, '断签不惩罚', st0.text, '断签文案应当是鼓励而不是惩罚');
    }
  } catch (e) {
    fail(mod, 'streakOf 可用', '抛异常', String(e && e.message));
  }

  // 热力日历
  try {
    var heat = engine.heatmapDays(streakDays, '2026-11-15', 30);
    var emptyCells = heat.filter(function (h) { return h.total === 0; });
    var badEmpty = emptyCells.filter(function (h) { return h.level !== 0; });
    if (heat.length === 30 && !badEmpty.length) {
      pass(mod, '30 天热力日历', '30 格，缺勤留空不标红');
    } else {
      fail(mod, '30 天热力日历', heat.length + ' 格 / ' + badEmpty.length + ' 格异常', '日历格数或留空规则不对');
    }
  } catch (e) {
    fail(mod, 'heatmapDays 可用', '抛异常', String(e && e.message));
  }

  // 周 / 月切换
  var indexHtmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  if (indexHtmlSrc.indexOf('id="reportWeek"') !== -1 && indexHtmlSrc.indexOf('id="reportMonth"') !== -1) {
    pass(mod, '周 / 月切换入口', '页面有本周与本月两个按钮');
  } else {
    fail(mod, '周 / 月切换入口', '缺失', '页面缺少 reportWeek / reportMonth');
  }
  try {
    var rep30 = engine.weeklyReport({}, '2026-11-15', 30);
    if (rep30.days.length === 30) {
      pass(mod, '月视图窗口', '30 天');
    } else {
      fail(mod, '月视图窗口', rep30.days.length + ' 天', '月视图应为 30 天');
    }
  } catch (e) {
    fail(mod, '月视图窗口', '抛异常', String(e && e.message));
  }

  // 分享模板
  try {
    var tpl = engine.shareTemplates(rep, '', { streak: 2 });
    if (tpl.length === 3 && tpl.every(function (t) { return t.name && t.text; })) {
      pass(mod, '分享模板', '3 种：' + tpl.map(function (t) { return t.name; }).join('/'));
    } else {
      fail(mod, '分享模板', tpl.length + ' 种', '分享模板应当是 3 种且字段完整');
    }
  } catch (e) {
    fail(mod, 'shareTemplates 可用', '抛异常', String(e && e.message));
  }

  return mod;
}

/** 抽出 app.js 里的 `var cards = [ ... ];` 数组源码 */
function extractCardsBlock(src) {
  var at = src.indexOf('var cards = [');
  if (at === -1) return null;
  var start = src.indexOf('[', at);
  var depth = 0, end = -1;
  for (var i = start; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) return null;
  return src.slice(start + 1, end);
}

/* =========================================================
   模块 F：摸鱼游戏厅
   ========================================================= */
function auditGames() {
  var mod = newModule('games', '摸鱼游戏厅', '🎮');

  // 沙箱里跑 pixel.js + sprites.js + 4 个游戏
  var sandbox = {
    console: console,
    setTimeout: setTimeout, clearTimeout: clearTimeout,
    setInterval: setInterval, clearInterval: clearInterval,
    Math: Math, Date: Date, JSON: JSON,
    localStorage: null
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);

  var load = ['pixel.js', 'sprites.js', 'game-mole.js', 'game-dodge.js', 'game-match3.js', 'game-fish.js', 'game-recall.js'];
  var loaded = [];
  load.forEach(function (f) {
    try {
      vm.runInContext(fs.readFileSync(path.join(GAME_DIR, f), 'utf8'), sandbox, { filename: f });
      loaded.push(f);
    } catch (e) {
      fail(mod, '游戏脚本可在沙箱中加载', f + ' 抛异常', String(e && e.message));
    }
  });
  var G = sandbox.HS_GAMES;
  if (!G || !G.registry) {
    fail(mod, 'window.HS_GAMES 可用', '未取到 registry', 'pixel.js 执行失败');
    mod.entries = 0;
    mod.detail = '游戏内核加载失败';
    return mod;
  }
  pass(mod, 'window.HS_GAMES 可用', '已加载 ' + loaded.length + ' 个脚本');

  var registry = G.registry;
  var ids = Object.keys(registry);
  pass(mod, '注册游戏数量', ids.length + ' 款（' + ids.join('/') + '）');

  // 从源码里再解析一次 id，检查是否被后注册覆盖（注册表是对象，重复 id 会静默覆盖）
  var srcIds = [];
  var cjkHits = [];
  var rows = [];
  ids.forEach(function (id) {
    var def = registry[id] || {};
    var name = def.name || def.title || '';
    var missing = [];
    if (!def.id) missing.push('id');
    if (!name) missing.push('name/title');
    if (typeof def.width !== 'number') missing.push('width');
    if (typeof def.height !== 'number') missing.push('height');
    if (missing.length) {
      fail(mod, '游戏「' + (name || id) + '」元信息完整', '缺 ' + missing.join('/'), '游戏需要 id/name/width/height');
    } else {
      pass(mod, '游戏「' + name + '」元信息完整',
        def.id + ' · ' + def.width + '×' + def.height);
    }
    if (def.width !== 320 || def.height !== 288) {
      warn(mod, '游戏「' + name + '」画布尺寸', def.width + '×' + def.height, '统一规格是 320×288');
    } else {
      pass(mod, '游戏「' + name + '」画布尺寸', def.width + '×' + def.height);
    }
    rows.push([def.id || '—', name, (def.emoji || '—'), def.width + '×' + def.height,
      def.width === 320 && def.height === 288 ? '✅' : '⚠️']);
  });

  load.filter(function (f) { return /^game-/.test(f); }).forEach(function (f) {
    var code = fs.readFileSync(path.join(GAME_DIR, f), 'utf8');
    var m = /id\s*:\s*'([^']+)'/.exec(code);
    if (m) srcIds.push({ id: m[1], file: f });
  });
  var idCount = {};
  srcIds.forEach(function (x) { idCount[x.id] = (idCount[x.id] || 0) + 1; });
  var dupIds = Object.keys(idCount).filter(function (k) { return idCount[k] > 1; });
  if (dupIds.length) {
    dupIds.forEach(function (k) {
      fail(mod, '游戏 id 唯一', k + ' 出现 ' + idCount[k] + ' 次',
        '注册表是对象，后注册的会静默覆盖前一个');
    });
  } else {
    pass(mod, '游戏 id 唯一', srcIds.length + ' 个 id 无冲突');
  }

  // 画布源码 ASCII 检查：中文只能通过 api.state({message:...}) 传递
  var CJK = /[\u4e00-\u9fff]/;
  var TEXTCALL = /(?:^|[^\w$])(api\.)?(text|statusBar)\s*\(/;
  load.filter(function (f) { return /^game-/.test(f); }).forEach(function (f) {
    var code = fs.readFileSync(path.join(GAME_DIR, f), 'utf8');
    var lines = code.split(/\r?\n/);
    lines.forEach(function (line, i) {
      if (!CJK.test(line)) return;
      if (!TEXTCALL.test(line)) return;
      if (/message/.test(line)) return;     // 走 api.state({message:...}) 的没问题
      cjkHits.push({ file: f, line: i + 1, text: line.trim() });
    });
  });
  if (cjkHits.length) {
    cjkHits.forEach(function (h) {
      fail(mod, '画布源码不含中文（' + h.file + '）', '第 ' + h.line + ' 行', brief(h.text, 60) + ' —— 中文必须走 api.state({message:...})');
    });
  } else {
    pass(mod, '画布源码不含中文', '4 个游戏的中文均通过 api.state({message:...}) 传递');
  }

  // 检测器自检：造一条违规样本，确认正则真的抓得到（避免检查项形同虚设）
  var sample = "    api.text('今天也要摸鱼', 10, 20);";
  var sampleHit = CJK.test(sample) && TEXTCALL.test(sample) && !/message/.test(sample);
  if (sampleHit) {
    pass(mod, '画布中文检测器自检', '构造的违规样本可被捕获');
  } else {
    fail(mod, '画布中文检测器自检', '检测器失效', '正则没有命中构造的违规样本');
  }

  mod.entries = ids.length;
  mod.detail = '游戏 ' + ids.length + ' 款 · 画布 320×288 × ' +
    ids.filter(function (id) {
      var d = registry[id] || {};
      return d.width === 320 && d.height === 288;
    }).length + ' 款 · 中文越界 ' + cjkHits.length + ' 处';
  addTable(mod, '游戏明细', ['id', '名称', 'emoji', '画布', '结论'], rows);
  return mod;
}

/* =========================================================
   模块 G：全局体检
   ========================================================= */
function walkFiles(dir, out) {
  out = out || [];
  var SKIP = { versions: 1, '.shots': 1, '.git': 1, node_modules: 1 };
  var entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return out;
  }
  entries.forEach(function (e) {
    var full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP[e.name]) return;
      walkFiles(full, out);
    } else if (e.isFile() && /\.(js|html|css)$/i.test(e.name)) {
      out.push(full);
    }
  });
  return out;
}

function auditGlobal() {
  var mod = newModule('global', '全局体检', '🧭');
  var files = walkFiles(ROOT).sort();
  var emojiRe = /\p{Extended_Pictographic}/gu;
  var badChars = [], marketing = [], density = [];

  files.forEach(function (f) {
    var rel = path.relative(ROOT, f).replace(/\\/g, '/');
    var txt = fs.readFileSync(f, 'utf8');
    var kb = Buffer.byteLength(txt, 'utf8') / 1024;

    // 替换字符（乱码）：写在正则里的 U+FFFD 是「自检脚本」自用字面量，不算乱码
    var badCount = 0;
    txt.split(/\r?\n/).forEach(function (line) {
      var at = line.indexOf('\uFFFD');
      while (at !== -1) {
        var inRegex = /\/[^\/]*$/.test(line.slice(0, at)) && /^\//.test(line.slice(at + 1));
        if (!inRegex) badCount++;
        at = line.indexOf('\uFFFD', at + 1);
      }
    });
    if (badCount) badChars.push({ file: rel, n: badCount });

    // 营销腔
    if (path.resolve(f) !== path.resolve(SELF_FILE)) {
      MARKETING_EN.forEach(function (w) {
        var re = new RegExp('\\b' + w.replace(/[-]/g, '[- ]?') + '\\b', 'i');
        var hit = re.exec(txt);
        if (hit) marketing.push({ file: rel, word: hit[0], kind: 'en' });
      });
      MARKETING_CN.forEach(function (w) {
        if (txt.indexOf(w) !== -1) marketing.push({ file: rel, word: w, kind: 'cn' });
      });
    }

    var em = txt.match(emojiRe);
    density.push({ file: rel, n: em ? em.length : 0, kb: kb, d: kb ? (em ? em.length : 0) / kb : 0 });
  });

  pass(mod, '扫描文件数', files.length + ' 个（.js/.html/.css，已跳过 versions/、.shots/、.git/）');
  if (badChars.length) {
    badChars.forEach(function (b) {
      fail(mod, '无乱码替换字符：' + b.file, b.n + ' 处', '出现 U+FFFD，需要修复编码');
    });
  } else {
    pass(mod, '无乱码替换字符', files.length + ' 个文件全部干净', '正则里的自检字面量已排除');
  }

  if (marketing.length) {
    marketing.forEach(function (m) {
      warn(mod, '无营销腔用词：' + m.file, m.word, '文案风格与本站「说人话」基调不符');
    });
  } else {
    pass(mod, '无营销腔用词', '未命中 ' + (MARKETING_EN.length + MARKETING_CN.length) + ' 个词表词',
      '审查工具自身文件已排除在词表扫描之外');
  }

  // 检测器自检：确认规则本身有效，避免「检查项形同虚设」
  var garbleSample = '这里有个乱码' + '\uFFFD' + '字符';
  if (garbleSample.indexOf('\uFFFD') !== -1) {
    pass(mod, '乱码检测器自检', '构造样本可被捕获');
  } else {
    fail(mod, '乱码检测器自检', '检测器失效', '构造的乱码样本没被识别');
  }
  var mkHit = false;
  MARKETING_EN.forEach(function (w) {
    if (new RegExp('\\b' + w.replace(/[-]/g, '[- ]?') + '\\b', 'i').test('这是一段 seamless 的文案')) mkHit = true;
  });
  if (mkHit) {
    pass(mod, '营销腔检测器自检', '构造样本可被捕获');
  } else {
    fail(mod, '营销腔检测器自检', '检测器失效', '构造的营销腔样本没被识别');
  }
  var dupSample = scanDuplicates([
    { module: '自检', field: 'a', text: '今天也是被工作榨干的一天' },
    { module: '自检', field: 'b', text: '今天也是被工作榨干的一日' }
  ], 0.75);
  if (dupSample.near.length) {
    pass(mod, '近重复检测器自检', '构造样本相似度 ' + dupSample.near[0].sim.toFixed(2));
  } else {
    fail(mod, '近重复检测器自检', '检测器失效', '构造的近重复样本没被识别');
  }

  var totalEmoji = density.reduce(function (a, b) { return a + b.n; }, 0);
  var top = density.slice().sort(function (a, b) { return b.d - a.d; }).slice(0, 5);
  info(mod, 'emoji 密度汇总',
    '全站 ' + totalEmoji + ' 个 emoji / ' + files.length + ' 个文件',
    '最密：' + top.map(function (t) { return t.file + ' ' + t.d.toFixed(1) + '/KB'; }).join('、'));

  // 本地资源引用
  var htmlFiles = ['index.html', 'games/index.html'];
  var broken = [];
  var checked = 0;
  htmlFiles.forEach(function (rel) {
    var full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) {
      fail(mod, '入口页面存在：' + rel, '缺失', '找不到文件');
      return;
    }
    var html = fs.readFileSync(full, 'utf8');
    // 先去掉转义标签（&lt;iframe ...&gt; 这类只是示例文字，不是真实引用）
    var cleaned = html.replace(/&lt;[^&]*&gt;/g, '');
    var re = /(?:src|href)\s*=\s*"([^"]+)"/g;
    var m;
    while ((m = re.exec(cleaned)) !== null) {
      var raw = m[1].trim();
      if (!raw) continue;
      if (/^(https?:)?\/\//i.test(raw)) continue;
      if (/^(data:|mailto:|tel:|javascript:|#)/i.test(raw)) continue;
      if (raw.indexOf('…') !== -1) continue;      // 示例里的省略号占位
      var rel2 = raw.split('#')[0].split('?')[0];
      if (!rel2) continue;
      var target = path.resolve(path.dirname(full), rel2);
      checked++;
      if (!fs.existsSync(target)) broken.push({ page: rel, ref: raw });
    }
  });
  if (broken.length) {
    broken.forEach(function (b) {
      fail(mod, '本地资源引用有效：' + b.page, b.ref, '引用的文件不存在');
    });
  } else {
    pass(mod, '本地资源引用有效', checked + ' 条本地引用全部存在');
  }

  // 免责声明
  var indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  if (indexHtml.indexOf('不提供医疗') !== -1) {
    pass(mod, 'index.html 含免责声明', '已声明「不提供医疗」');
  } else {
    fail(mod, 'index.html 含免责声明', '缺失', '页面需要写明「不提供医疗」等免责说明');
  }

  mod.entries = files.length;
  mod.detail = '扫描 ' + files.length + ' 个文件 · ' + totalEmoji + ' 个 emoji · 乱码 ' +
    badChars.length + ' 处 · 营销腔 ' + marketing.length + ' 处 · 失效引用 ' + broken.length + ' 条';
  addTable(mod, '文件 emoji 密度', ['文件', '大小(KB)', 'emoji', '密度(/KB)'],
    density.sort(function (a, b) { return b.d - a.d; }).map(function (d) {
      return [d.file, d.kb.toFixed(1), d.n, d.d.toFixed(1)];
    }));
  return mod;
}

/* =========================================================
   全站终审：跨模块重复文案（v1.10.0 新增）
   —— 各模块单独看都干净，放在一起会不会「说了两遍一样的话」？
   ========================================================= */
function auditCrossModule() {
  var mod = newModule('cross', '跨模块重复', '🔗');
  var pool = [];

  function add(module, field, text) {
    if (text == null) return;
    var s = String(text).trim();
    if (s.length < 6) return;                    // 太短的通用词不参与比较
    pool.push({ module: module, field: field, text: s });
  }

  try {
    var moods = require(path.join(JS_DIR, 'data-moods.js'));
    (moods.moods || []).forEach(function (m) {
      (m.diagnoses || []).forEach(function (x, i) { add('情绪急诊室', '心情「' + m.name + '」·诊断' + (i + 1), x); });
      (m.causes || []).forEach(function (x, i) { add('情绪急诊室', '心情「' + m.name + '」·病因' + (i + 1), x); });
      (m.blessings || []).forEach(function (x, i) { add('情绪急诊室', '心情「' + m.name + '」·祝福' + (i + 1), x); });
      (m.remedies || []).forEach(function (r, i) {
        add('情绪急诊室', '心情「' + m.name + '」·处方' + (i + 1) + '标题', r.t);
        add('情绪急诊室', '心情「' + m.name + '」·处方' + (i + 1) + '说明', r.d);
      });
    });
    Object.keys(moods.keywordPacks || {}).forEach(function (k) {
      var p = moods.keywordPacks[k];
      (p.causes || []).forEach(function (x, i) { add('情绪急诊室', '关键词包「' + k + '」·病因' + (i + 1), x); });
      (p.blessings || []).forEach(function (x, i) { add('情绪急诊室', '关键词包「' + k + '」·祝福' + (i + 1), x); });
      (p.remedies || []).forEach(function (r, i) {
        add('情绪急诊室', '关键词包「' + k + '」·处方' + (i + 1) + '标题', r.t);
        add('情绪急诊室', '关键词包「' + k + '」·处方' + (i + 1) + '说明', r.d);
      });
    });
  } catch (e) { fail(mod, '情绪急诊室文案可读', '抛异常', String(e && e.message)); }

  try {
    var scenes = require(path.join(JS_DIR, 'data-scenes.js'));
    (scenes.scenes || []).forEach(function (s) {
      Object.keys(s.replies || {}).forEach(function (tone) {
        (s.replies[tone] || []).forEach(function (t, i) { add('社恐话术机', '场景「' + s.name + '」·' + tone + (i + 1), t); });
      });
      add('社恐话术机', '场景「' + s.name + '」·提示', s.tip);
      add('社恐话术机', '场景「' + s.name + '」·适合', s.when);
      add('社恐话术机', '场景「' + s.name + '」·别在', s.avoid);
    });
  } catch (e) { fail(mod, '社恐话术机文案可读', '抛异常', String(e && e.message)); }

  ['data-story.js', 'data-story2.js'].forEach(function (file) {
    try {
      var st = require(path.join(JS_DIR, file));
      var label = file === 'data-story.js' ? '生存故事·第一部' : '生存故事·第二部';
      Object.keys(st.nodes || {}).forEach(function (id) {
        var n = st.nodes[id];
        add(label, '节点「' + id + '」·正文', n.text);
        (n.choices || []).forEach(function (c, i) {
          add(label, '节点「' + id + '」·选项' + (i + 1), c.label);
          add(label, '节点「' + id + '」·回响' + (i + 1), c.tip);
        });
      });
      Object.keys(st.endings || {}).forEach(function (id) {
        var e2 = st.endings[id];
        add(label, '结局「' + id + '」·描述', e2.desc);
        add(label, '结局「' + id + '」·安慰', e2.comfort);
        add(label, '结局「' + id + '」·提示', e2.tip);
      });
    } catch (e) { fail(mod, file + ' 文案可读', '抛异常', String(e && e.message)); }
  });

  try {
    var chal = require(path.join(JS_DIR, 'data-challenges.js'));
    (chal.items || []).forEach(function (c) {
      add('每日彩蛋', '彩蛋「' + c.id + '」', c.text);
      add('每日彩蛋', '彩蛋「' + c.id + '」·提示', c.hint);
    });
  } catch (e) { fail(mod, '每日彩蛋文案可读', '抛异常', String(e && e.message)); }

  try {
    var badges = require(path.join(JS_DIR, 'data-badges.js'));
    (badges.items || []).forEach(function (b) {
      add('成就徽章', '徽章「' + b.id + '」·名称', b.name);
      add('成就徽章', '徽章「' + b.id + '」·说明', b.desc);
    });
  } catch (e) { fail(mod, '成就徽章文案可读', '抛异常', String(e && e.message)); }

  try {
    var breath = require(path.join(JS_DIR, 'data-breath.js'));
    (breath.exercises || []).forEach(function (x) {
      add('呼吸引导', '呼吸「' + x.id + '」·说明', x.desc);
      add('呼吸引导', '呼吸「' + x.id + '」·适用', x.when);
      add('呼吸引导', '呼吸「' + x.id + '」·结束语', x.finish);
      (x.phases || []).forEach(function (p, i) { add('呼吸引导', '呼吸「' + x.id + '」·阶段' + (i + 1), p.tip); });
    });
  } catch (e) { fail(mod, '呼吸引导文案可读', '抛异常', String(e && e.message)); }

  var dup = scanDuplicates(pool, 0.75);
  var crossExact = dup.exact.filter(function (d) { return d.a.module !== d.b.module; });
  var crossNear = dup.near.filter(function (d) { return d.a.module !== d.b.module; });

  if (crossExact.length) {
    crossExact.slice(0, 20).forEach(function (d) {
      fail(mod, '跨模块无完全重复文案', d.a.module + '「' + d.a.field + '」= ' + d.b.module + '「' + d.b.field + '」',
        '两个模块说了同一句话：' + String(d.a.text).slice(0, 30));
    });
  } else {
    pass(mod, '跨模块无完全重复文案', '共比对 ' + pool.length + ' 条文案');
  }

  if (crossNear.length) {
    crossNear.slice(0, 20).forEach(function (d) {
      warn(mod, '跨模块无近重复文案', d.a.module + '「' + d.a.field + '」≈ ' + d.b.module + '「' + d.b.field + '」',
        '相似度 ' + d.sim.toFixed(2) + '：' + String(d.a.text).slice(0, 24) + ' / ' + String(d.b.text).slice(0, 24));
    });
  } else {
    pass(mod, '跨模块无近重复文案', '共比对 ' + pool.length + ' 条文案');
  }

  mod.entries = pool.length;
  mod.detail = '跨模块比对 ' + pool.length + ' 条文案 · 完全重复 ' + crossExact.length +
    ' 处 · 近重复 ' + crossNear.length + ' 处';
  return mod;
}

/* =========================================================
   渲染：Markdown / JSON
   ========================================================= */
function mdEscape(s) {
  return String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function renderMarkdown() {
  var errors = allFindings.filter(function (f) { return f.level === LV.ERROR; });
  var warns = allFindings.filter(function (f) { return f.level === LV.WARN; });
  var now = new Date();
  var lines = [];

  lines.push('# 打工人急救站 · 内容审查报告');
  lines.push('');
  lines.push('> 生成时间：' + now.toLocaleString('zh-CN') + '（' + now.toISOString() + '）');
  lines.push('>');
  lines.push('> 一句话总结：共审查 6 个模块 + 全局体检 · 心情 **' + getEntry('clinic') +
    '** · 场景 **' + getEntry('talk') + '** · 音色 **' + getEntry('fish') +
    '** · 故事节点 **' + getEntry('story') + '** · 统计卡 **' + getEntry('report') +
    '** · 游戏 **' + getEntry('games') + '** · ❌ ERROR **' + errors.length +
    '** · ⚠️ WARN **' + warns.length + '**');
  lines.push('');

  lines.push('## 模块内容量总表');
  lines.push('');
  lines.push('| 模块 | 条目数 | 明细 |');
  lines.push('| --- | --- | --- |');
  modules.forEach(function (m) {
    lines.push('| ' + m.icon + ' ' + m.name + ' | ' + m.entries + ' | ' + mdEscape(m.detail) + ' |');
  });
  lines.push('');

  var titles = {
    clinic: '一、情绪急诊室', talk: '二、社恐话术机', fish: '三、摸鱼补给站',
    story: '四、生存故事', report: '五、疗愈周报', games: '六、摸鱼游戏厅'
  };

  modules.forEach(function (m) {
    if (m.id === 'global') return;          // 全局体检单独成节
    lines.push('## ' + (titles[m.id] || m.name));
    lines.push('');
    lines.push('**内容量**：' + mdEscape(m.detail));
    lines.push('');
    lines.push('| 检查项 | 实测值 | 结论 |');
    lines.push('| --- | --- | --- |');
    m.checks.forEach(function (c) {
      var verdict = ICON[c.level] + ' ' + LV_TEXT[c.level];
      var note = c.note ? '　' + mdEscape(c.note) : '';
      lines.push('| ' + mdEscape(c.label) + ' | ' + mdEscape(c.value) + ' | ' + verdict + note + ' |');
    });
    lines.push('');
    m.tables.forEach(function (t) {
      lines.push('**' + t.title + '**');
      lines.push('');
      lines.push('| ' + t.head.join(' | ') + ' |');
      lines.push('| ' + t.head.map(function () { return ' ---'; }).join(' | ') + ' |');
      t.rows.forEach(function (r) {
        lines.push('| ' + r.map(mdEscape).join(' | ') + ' |');
      });
      lines.push('');
    });
  });

  lines.push('## 全局体检');
  lines.push('');
  lines.push('**内容量**：' + mdEscape(modules[modules.length - 1].detail));
  lines.push('');
  lines.push('| 检查项 | 实测值 | 结论 |');
  lines.push('| --- | --- | --- |');
  modules[modules.length - 1].checks.forEach(function (c) {
    var verdict = ICON[c.level] + ' ' + LV_TEXT[c.level];
    var note = c.note ? '　' + mdEscape(c.note) : '';
    lines.push('| ' + mdEscape(c.label) + ' | ' + mdEscape(c.value) + ' | ' + verdict + note + ' |');
  });
  lines.push('');
  modules[modules.length - 1].tables.forEach(function (t) {
    lines.push('**' + t.title + '**');
    lines.push('');
    lines.push('| ' + t.head.join(' | ') + ' |');
    lines.push('| ' + t.head.map(function () { return ' ---'; }).join(' | ') + ' |');
    t.rows.forEach(function (r) {
      lines.push('| ' + r.map(mdEscape).join(' | ') + ' |');
    });
    lines.push('');
  });

  lines.push('## 问题汇总');
  lines.push('');
  if (!allFindings.length) {
    lines.push('✅ 全部通过，没有 ERROR / WARN。');
  } else {
    lines.push('| 级别 | 模块 | 问题 |');
    lines.push('| --- | --- | --- |');
    allFindings.forEach(function (f) {
      lines.push('| ' + ICON[f.level] + ' ' + f.level + ' | ' + f.module + ' | ' +
        mdEscape(f.label + (f.value ? ' → ' + f.value : '') + (f.detail ? '（' + f.detail + '）' : '')) + ' |');
    });
  }
  lines.push('');
  return lines.join('\n');
}

function getEntry(id) {
  for (var i = 0; i < modules.length; i++) if (modules[i].id === id) return modules[i].entries;
  return 0;
}

function renderJSON() {
  var errors = allFindings.filter(function (f) { return f.level === LV.ERROR; });
  var warns = allFindings.filter(function (f) { return f.level === LV.WARN; });
  var now = new Date();
  return JSON.stringify({
    tool: 'audit.js',
    generatedAt: now.toISOString(),
    generatedAtLocal: now.toLocaleString('zh-CN'),
    summary: {
      modules: modules.length,
      errors: errors.length,
      warnings: warns.length,
      entries: modules.reduce(function (acc, m) {
        acc[m.id] = m.entries;
        return acc;
      }, {})
    },
    modules: modules.map(function (m) {
      return {
        id: m.id, name: m.name, icon: m.icon,
        entries: m.entries, detail: m.detail,
        checks: m.checks,
        findings: m.findings,
        tables: m.tables
      };
    }),
    findings: allFindings
  }, null, 2);
}

/* =========================================================
   入口
   ========================================================= */
function main(argv) {
  var asJson = false;
  var outPath = '';
  argv.forEach(function (a) {
    if (a === '--json') asJson = true;
    else if (a.indexOf('--out=') === 0) outPath = a.slice(6);
    else if (a === '--help' || a === '-h') {
      console.log('用法：node tools/audit.js [--json] [--out=路径]');
      process.exit(0);
    }
  });

  var started = Date.now();
  auditClinic();
  auditTalk();
  auditFish();
  auditStory();
  auditChallenges();
  auditReport();
  auditGames();
  auditCrossModule();
  auditGlobal();

  var text = asJson ? renderJSON() : renderMarkdown();
  if (outPath) {
    var target = path.resolve(process.cwd(), outPath);
    fs.writeFileSync(target, text, 'utf8');
    console.error('报告已写入：' + target);
  }
  process.stdout.write(text + '\n');

  var errors = allFindings.filter(function (f) { return f.level === LV.ERROR; }).length;
  if (!asJson) {
    console.error('（审查耗时 ' + (Date.now() - started) + ' ms，ERROR ' + errors + ' / WARN ' +
      allFindings.filter(function (f) { return f.level === LV.WARN; }).length + '）');
  }
  process.exit(errors ? 1 : 0);
}

main(process.argv.slice(2));
