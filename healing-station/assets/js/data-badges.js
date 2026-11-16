/* =========================================================
   data-badges.js · 成就徽章（v1.10.0 新增）
   —— 内容守则：只鼓励、不比较；不做金币 / 宠物 / 排行榜
   need.kind 取值：
     total  累计某个计数（key 对应 d/r/f/p/s/g/b/c）
     streak 连续来几天
     score  游戏厅历史最高分累计
   ========================================================= */
(function (root) {
  'use strict';

  var ITEMS = [
    {
      id: 'first',
      name: '第一次推门',
      emoji: '🚪',
      desc: '第一次打开急救站就算数，不用做任何事。',
      need: { kind: 'total', key: 'd', value: 1 }
    },
    {
      id: 'streak3',
      name: '连着来了三天',
      emoji: '🌱',
      desc: '连续三天来看看自己——断了也没关系，随时可以重新开始。',
      need: { kind: 'streak', value: 3 }
    },
    {
      id: 'words10',
      name: '话术收集家',
      emoji: '💬',
      desc: '翻了 10 张能直接发出去的话术。',
      need: { kind: 'total', key: 'r', value: 10 }
    },
    {
      id: 'breath3',
      name: '会呼吸的人',
      emoji: '🫧',
      desc: '完成了 3 次呼吸练习，身体比嘴巴先松下来。',
      need: { kind: 'total', key: 'b', value: 3 }
    },
    {
      id: 'ending1',
      name: '走到结局的人',
      emoji: '🎲',
      desc: '把一部剧从开头走到了结局。',
      need: { kind: 'total', key: 's', value: 1 }
    },
    {
      id: 'pixel1000',
      name: '摸鱼高手',
      emoji: '🎮',
      desc: '在游戏厅里累计拿到 1000 分，效率惊人（或者只是手速好）。',
      need: { kind: 'score', value: 1000 }
    }
  ];

  var DATA = { version: 'v1.10.0', items: ITEMS };

  root.HS_BADGES = DATA;
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
})(typeof window !== 'undefined' ? window : globalThis);
