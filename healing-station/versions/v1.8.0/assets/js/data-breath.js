/* 摸鱼补给站 · 呼吸引导数据（v1.8.0 新增）
   调研依据：research/iterations/iter3-research.md
   - 潮汐 App 冥想场景（专注/孤独/午休/减压/沮丧/晚安/通勤）
   - 潮汐「呼吸法」分类：平衡呼吸 / 4-7-8 / 箱式呼吸
   约束：只做呼吸节律，不做疗效承诺；每个动作都能坐着完成。
   数据结构：{ id, name, emoji, minutes, when, desc, phases:[{label,sec,tip}], finish }
*/
(function (root) {
  'use strict';

  var HS_BREATH = {
    exercises: [
      {
        id: 'box',
        name: '箱式呼吸',
        emoji: '🧊',
        minutes: 4,
        when: '心慌、脑子停不下来、手抖着点不开邮件的时候',
        desc: '四个数一样长：吸气 4 秒 → 屏住 4 秒 → 呼气 4 秒 → 停 4 秒。四个动作凑成一轮，像沿着一个正方形走。',
        phases: [
          { label: '吸气', sec: 4, tip: '用鼻子慢慢吸，肩膀别抬起来' },
          { label: '屏住', sec: 4, tip: '不用憋，轻轻停住就行' },
          { label: '呼气', sec: 4, tip: '用嘴慢慢吐，把气送出去' },
          { label: '停住', sec: 4, tip: '什么都不做，等下一轮自己来' }
        ],
        finish: '走完四轮，你的心跳通常会比刚才慢一点点。慢一点点就够了。'
      },
      {
        id: '478',
        name: '4-7-8 助眠呼吸',
        emoji: '😴',
        minutes: 3,
        when: '躺下了还醒着、脑子开始放电影的时候',
        desc: '吸气 4 秒 → 屏住 7 秒 → 呼气 8 秒。呼气比吸气长，身体会误以为该睡觉了。',
        phases: [
          { label: '吸气', sec: 4, tip: '轻轻吸，不要吸到最满' },
          { label: '屏住', sec: 7, tip: '舌头抵上颚，会更容易停住' },
          { label: '呼气', sec: 8, tip: '从嘴慢慢吐完，声音可以拉长' }
        ],
        finish: '呼气拉长的时候，你会比刚才更困一点。睡不着的夜晚，这不算失败。'
      },
      {
        id: 'equal',
        name: '平衡呼吸',
        emoji: '⚖️',
        minutes: 2,
        when: '进会议室前、要开口说话前、手放在键盘上却打不出字的时候',
        desc: '吸气 4 秒 → 呼气 6 秒。只做 10 轮，站在工位上就能做完，不用找地方。',
        phases: [
          { label: '吸气', sec: 4, tip: '吸到一半就停住也可以' },
          { label: '呼气', sec: 6, tip: '吐得比吸得慢，这就是全部要点' }
        ],
        finish: '10 轮之后站起来。你的声音会比刚才稳一点点，说出口的那句话也就没那么难。'
      }
    ]
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = HS_BREATH;
  root.HS_BREATH = HS_BREATH;
})(typeof window !== 'undefined' ? window : this);
