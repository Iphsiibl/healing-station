/* =========================================================
   engine.js · 纯逻辑层（浏览器 + Node 双环境可用）
   不依赖 DOM，不依赖任何第三方库。
   暴露：window.HS_ENGINE
   ========================================================= */
(function (root) {
  var MOODS = (root.HS_MOODS || (typeof require !== 'undefined' ? require('./data-moods.js') : {})).moods || [];
  var PACKS = (root.HS_MOODS || (typeof require !== 'undefined' ? require('./data-moods.js') : {})).keywordPacks || {};
  var SCENE_DATA = (root.HS_SCENES || (typeof require !== 'undefined' ? require('./data-scenes.js') : {})).scenes || [];
  var TONES = (root.HS_SCENES || (typeof require !== 'undefined' ? require('./data-scenes.js') : {})).tones || {};

  /* ---------- 通用工具 ---------- */

  // 简易可复现哈希：同样的种子总是得到同样的结果
  // 注意：djb2 的低位与字符位置强相关（差值恒为 33^k，会整除 3、11 等小质数），
  // 因此末尾做一次雪崩混合（murmur3 finalizer），保证 % n 的分布是均匀的。
  function hash(str) {
    var h = 5381, i;
    str = String(str);
    for (i = 0; i < str.length; i++) {
      h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    }
    h ^= h >>> 15;
    h = Math.imul(h, 2246822507) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 3266489909) >>> 0;
    h ^= h >>> 16;
    return h >>> 0;
  }

  function pick(list, seed) {
    if (!list || !list.length) return '';
    return list[hash(seed) % list.length];
  }

  function findMood(id) {
    for (var i = 0; i < MOODS.length; i++) {
      if (MOODS[i].id === id) return MOODS[i];
    }
    return null;
  }

  function findScene(id) {
    for (var i = 0; i < SCENE_DATA.length; i++) {
      if (SCENE_DATA[i].id === id) return SCENE_DATA[i];
    }
    return null;
  }

  /* ---------- 关键词包匹配 ---------- */

  // 返回命中的关键词包列表（最多 2 个，按输入中出现的顺序）
  function matchPacks(input) {
    var text = String(input || '').trim();
    if (!text) return [];
    var keys = Object.keys(PACKS);
    var hits = [];
    var i, k;
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      if (text.indexOf(k) !== -1) hits.push({ key: k, pack: PACKS[k], pos: text.indexOf(k) });
    }
    hits.sort(function (a, b) { return a.pos - b.pos; });
    return hits.slice(0, 2);
  }

  /* ---------- 模块一：情绪急诊室 ---------- */

  /**
   * 生成一份"诊断单"
   * @param {string} moodId  心情 id
   * @param {string} keyword 用户补充描述（可空）
   * @param {string|number} seed 轮转计数（重掷用）
   */
  function diagnose(moodId, keyword, seed) {
    var mood = findMood(moodId);
    if (!mood) return null;

    var hits = matchPacks(keyword);

    // 诊断名：基础诊断 + 可选关键词追加
    var diagnoses = mood.diagnoses.slice();
    var causes = mood.causes.slice();
    var remedies = mood.remedies.slice();
    var blessings = mood.blessings.slice();

    var i, j;
    for (i = 0; i < hits.length; i++) {
      var pack = hits[i].pack;
      if (pack.causes) causes = causes.concat(pack.causes);
      if (pack.remedies) remedies = remedies.concat(pack.remedies);
      if (pack.blessings) blessings = blessings.concat(pack.blessings);
    }

    // 去重（保持顺序）
    causes = uniq(causes);
    remedies = uniqBy(remedies, function (r) { return r.t; });
    blessings = uniq(blessings);

    // 轮转选取：counter 每 +1，整张诊断单整体往后挪一格，
    // 保证"换一张"一定换出内容不同的诊断单，且一个周期内不重复。
    var base = hash(moodId + '|' + (keyword || ''));
    var counter = toInt(seed);

    var diagnosis = diagnoses[(base + counter) % diagnoses.length];
    var cause = causes[(hash(base + '|c') + counter) % causes.length];
    var blessing = blessings[(hash(base + '|b') + counter) % blessings.length];

    // 处方固定取 3 条，连续轮转
    var chosen = [];
    var start = (hash(base + '|r') + counter) % remedies.length;
    for (var k = 0; k < 3 && k < remedies.length; k++) {
      chosen.push(remedies[(start + k) % remedies.length]);
    }
    if (chosen.length < 3) chosen = remedies.slice(0, 3);

    return {
      moodId: mood.id,
      moodName: mood.name,
      moodEmoji: mood.emoji,
      keyword: String(keyword || '').trim(),
      matchedKeywords: hits.map(function (h) { return h.key; }),
      title: diagnosis,
      cause: cause,
      analysis: buildAnalysis(mood, keyword, hits, chosen),
      remedies: chosen,
      blessing: blessing,
      stamp: stampText(mood.id, base + counter),
      copyText: buildCopyText(mood, diagnosis, cause, chosen, blessing)
    };
  }

  // 把任意 seed 转成整数轮转计数：支持 number，或字符串结尾的数字（如 "mood|2"）
  function toInt(seed) {
    if (typeof seed === 'number' && isFinite(seed)) return Math.abs(Math.floor(seed));
    var s = String(seed || '');
    var m = /(\d+)\s*$/.exec(s);
    return m ? parseInt(m[1], 10) : 0;
  }

  function uniq(arr) {
    var out = [], seen = {};
    for (var i = 0; i < arr.length; i++) {
      if (!seen[arr[i]]) { seen[arr[i]] = 1; out.push(arr[i]); }
    }
    return out;
  }

  function uniqBy(arr, fn) {
    var out = [], seen = {};
    for (var i = 0; i < arr.length; i++) {
      var k = fn(arr[i]);
      if (!seen[k]) { seen[k] = 1; out.push(arr[i]); }
    }
    return out;
  }

  // 诊断分析段：把"病情 + 关键词"串成一段像医生写的分析
  function buildAnalysis(mood, keyword, hits, chosen) {
    var lines = [];
    var kw = String(keyword || '').trim();
    if (kw) {
      lines.push('你写下的「' + kw + '」里，藏着这次生病的真正诱因。');
    }
    if (hits.length) {
      lines.push('结合你提到的「' + hits.map(function (h) { return h.key; }).join('、') + '」，医生加了一条备注：先别急着自责，环境确实在消耗你。');
    } else {
      lines.push('医生翻了一下你的记录：这次的触发点不算大，更像是身体先喊了一声。');
    }
    lines.push('综合来看，属于' + mood.desc + '的典型表现。下面的三张处方，按"先救急、再固本"的顺序开。');
    return lines;
  }

  // 印章文字
  function stampText(moodId, seed) {
    var h = hash('stamp|' + moodId + '|' + seed) % 4;
    var arr = ['打工人急救站', '今日已诊', '轻微症状', '建议躺平'];
    return arr[h];
  }

  // 一键复制的完整文本
  function buildCopyText(mood, diagnosis, cause, remedies, blessing) {
    var lines = [];
    lines.push('【打工人急救站 · 诊断单】');
    lines.push('情绪：' + mood.emoji + ' ' + mood.name);
    lines.push('诊断：' + diagnosis);
    lines.push('病因：' + cause);
    for (var i = 0; i < remedies.length; i++) {
      lines.push('处方 ' + (i + 1) + '：' + remedies[i].t + '——' + remedies[i].d);
    }
    lines.push('医嘱：' + blessing);
    lines.push('——记得按时吃饭、按时下班。');
    return lines.join('\n');
  }

  /* ---------- 模块二：社恐话术机 ---------- */

  /**
   * 取一条话术
   * @param {string} sceneId 场景 id
   * @param {string} toneKey safe/pro/wild
   * @param {string|number} seed 轮转计数（"换一句"每 +1）
   */
  function reply(sceneId, toneKey, seed) {
    var scene = findScene(sceneId);
    if (!scene) return null;
    var tone = TONES[toneKey] ? toneKey : 'safe';
    var list = (scene.replies && scene.replies[tone]) || [];
    if (!list.length) return null;

    // 轮转：同一场景同一语气，"换一句"一定换出不同的一条，
    // 转满一轮后回到第一条（不会死循环，也不会重复）。
    var idx = (hash(sceneId + '|' + tone) + toInt(seed)) % list.length;
    var text = list[idx];
    return {
      sceneId: scene.id,
      sceneName: scene.name,
      sceneEmoji: scene.emoji,
      sceneDesc: scene.desc,
      tip: scene.tip,
      tone: tone,
      toneName: TONES[tone].name,
      toneEmoji: TONES[tone].emoji,
      text: text,
      index: idx
    };
  }

  // 某场景某语气共有几条
  function replyCount(sceneId, toneKey) {
    var scene = findScene(sceneId);
    if (!scene || !scene.replies || !scene.replies[toneKey]) return 0;
    return scene.replies[toneKey].length;
  }

  /* ---------- 模块三：今日生存小游戏 ---------- */

  var STORY = (root.HS_STORY || (typeof require !== 'undefined' ? require('./data-story.js') : {}));

  // 开一局：返回全新的游戏状态
  function storyStart() {
    return {
      nodeId: STORY.start,
      heart: STORY.hearts || 5,
      maxHeart: STORY.hearts || 5,
      path: [],
      finished: false,
      endingId: ''
    };
  }

  // 取当前节点（结束态返回 null）
  function storyNode(state) {
    if (!state || state.finished) return null;
    return STORY.nodes[state.nodeId] || null;
  }

  // 走到结局了吗
  function storyIsEnd(state) {
    return !!(state && state.endingId && STORY.endings[state.endingId]);
  }

  function storyEnding(state) {
    if (!storyIsEnd(state)) return null;
    return STORY.endings[state.endingId];
  }

  /**
   * 做一个选择
   * @param {object} state 当前状态
   * @param {number} index 选择序号
   */
  function storyMove(state, index) {
    var node = storyNode(state);
    if (!node) return state;
    var choice = (node.choices || [])[index];
    if (!choice) return state;

    state.path.push({
      nodeTitle: node.title,
      nodeEmoji: node.emoji,
      label: choice.label,
      tip: choice.tip || '',
      heart: choice.heart || 0
    });

    state.heart = Math.max(0, Math.min(state.maxHeart, state.heart + (choice.heart || 0)));
    state.nodeId = choice.next;

    if (STORY.endings[state.nodeId]) {
      state.finished = true;
      state.endingId = state.nodeId;
    }
    return state;
  }

  // 走过的路径文字
  function storyRecap(state) {
    if (!state || !state.path.length) return '';
    var lines = [];
    for (var i = 0; i < state.path.length; i++) {
      lines.push((i + 1) + '. ' + state.path[i].label);
    }
    return lines.join('\n');
  }

  // 统计：从起点出发，哪些节点和结局真的走得到（用于自检）
  function storyReach() {
    var seen = {}, ends = {}, stack = [STORY.start];
    while (stack.length) {
      var id = stack.pop();
      if (seen[id]) continue;
      seen[id] = true;
      var node = STORY.nodes[id];
      if (!node) { if (STORY.endings[id]) ends[id] = true; continue; }
      var chs = node.choices || [];
      for (var i = 0; i < chs.length; i++) {
        var next = chs[i].next;
        if (STORY.endings[next]) ends[next] = true;
        else if (STORY.nodes[next]) stack.push(next);
      }
    }
    return { nodes: seen, endings: ends };
  }

  /* ---------- 模块五：疗愈周报 ---------- */

  // 本地日期键：YYYY-M-D（与 app.js 的 today() 保持一致）
  function dayKey(date) {
    return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
  }

  function topKey(map) {
    var best = '', bestN = 0;
    if (!map) return best;
    for (var k in map) {
      if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
      if (map[k] > bestN) { bestN = map[k]; best = k; }
    }
    return best;
  }

  /**
   * 汇总最近 span 天的使用记录
   * @param {object} days 形如 { '2026-11-15': { d, r, f, p, s, moods:{}, ends:{} } }
   * @param {string} todayStr 今天（YYYY-M-D）
   * @param {number} span 天数，默认 7
   */
  function weeklyReport(days, todayStr, span) {
    span = span || 7;
    var labels = ['日', '一', '二', '三', '四', '五', '六'];
    var base = new Date(String(todayStr || '') + 'T00:00:00');
    if (isNaN(base.getTime())) base = new Date();

    var list = [], totals = { d: 0, r: 0, f: 0, p: 0, s: 0, g: 0 }, moods = {}, ends = {}, max = 0;
    for (var i = span - 1; i >= 0; i--) {
      var dt = new Date(base.getTime() - i * 86400000);
      var key = dayKey(dt);
      var rec = (days && days[key]) || null;
      var row = {
        key: key,
        label: '周' + labels[dt.getDay()],
        date: (dt.getMonth() + 1) + '/' + dt.getDate(),
        d: rec ? (rec.d || 0) : 0,
        r: rec ? (rec.r || 0) : 0,
        f: rec ? (rec.f || 0) : 0,
        p: rec ? (rec.p || 0) : 0,
        s: rec ? (rec.s || 0) : 0,
        g: rec ? (rec.g || 0) : 0,
        total: 0
      };
      row.total = row.d + row.r + row.f + row.p + row.s + row.g;
      if (rec && rec.moods) {
        for (var mk in rec.moods) if (Object.prototype.hasOwnProperty.call(rec.moods, mk)) moods[mk] = (moods[mk] || 0) + rec.moods[mk];
      }
      if (rec && rec.ends) {
        for (var ek in rec.ends) if (Object.prototype.hasOwnProperty.call(rec.ends, ek)) ends[ek] = (ends[ek] || 0) + rec.ends[ek];
      }
      totals.d += row.d; totals.r += row.r; totals.f += row.f; totals.p += row.p; totals.s += row.s; totals.g += row.g;
      if (row.total > max) max = row.total;
      list.push(row);
    }
    return {
      days: list,
      totals: totals,
      max: max,
      moods: moods,
      ends: ends,
      total: totals.d + totals.r + totals.f + totals.p + totals.s + totals.g,
      topMood: topKey(moods),
      topEnding: topKey(ends)
    };
  }

  // 周报小结（纯文字，交给界面直接显示）
  function reportSummary(rep, moodNames, endNames) {
    if (!rep || !rep.total) {
      return '这周你还没来过急救站。没关系——不来，也是一种自我照顾。';
    }
    var bits = [];
    if (rep.totals.d) bits.push('诊断 ' + rep.totals.d + ' 次');
    if (rep.totals.r) bits.push('话术 ' + rep.totals.r + ' 次');
    if (rep.totals.f) bits.push('摸鱼 ' + rep.totals.f + ' 次');
    if (rep.totals.p) bits.push('专注 ' + rep.totals.p + ' 次');
    if (rep.totals.s) bits.push('通关 ' + rep.totals.s + ' 次');
    if (rep.totals.g) bits.push('游戏 ' + rep.totals.g + ' 局');

    var text = '这周你在急救站被哄了 ' + rep.total + ' 次' + (bits.length ? '（' + bits.join('、') + '）' : '') + '。';
    if (rep.topMood && moodNames && moodNames[rep.topMood]) {
      text += '最常出现的心情是「' + moodNames[rep.topMood] + '」。';
    }
    if (rep.topEnding && endNames && endNames[rep.topEnding]) {
      text += '《今天能准时下班吗？》你最常走到「' + endNames[rep.topEnding] + '」。';
    }
    text += '愿你被生活温柔以待 🌿';
    return text;
  }

  // 可复制分享的周报
  function reportText(rep, summary) {
    var lines = ['【打工人急救站 · 本周疗愈周报】'];
    lines.push(summary || '');
    if (rep && rep.days) {
      lines.push('近 ' + rep.days.length + ' 天：' + rep.days.map(function (d) { return d.date + ' ' + d.total + ' 次'; }).join(' / '));
    }
    lines.push('——不解决问题，只负责哄你开心。');
    return lines.join('\n');
  }

  /* ---------- 导出 ---------- */

  var ENGINE = {
    hash: hash,
    pick: pick,
    matchPacks: matchPacks,
    diagnose: diagnose,
    reply: reply,
    replyCount: replyCount,
    findMood: findMood,
    findScene: findScene,
    storyStart: storyStart,
    storyNode: storyNode,
    storyMove: storyMove,
    storyEnding: storyEnding,
    storyIsEnd: storyIsEnd,
    storyRecap: storyRecap,
    storyReach: storyReach,
    weeklyReport: weeklyReport,
    reportSummary: reportSummary,
    reportText: reportText,
    get moods() { return MOODS; },
    get scenes() { return SCENE_DATA; },
    get tones() { return TONES; },
    get keywordPacks() { return PACKS; },
    get story() { return STORY; }
  };

  root.HS_ENGINE = ENGINE;
  if (typeof module !== 'undefined' && module.exports) module.exports = ENGINE;
})(typeof window !== 'undefined' ? window : globalThis);
