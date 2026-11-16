/* 摸鱼补给站 · 老板键伪装页数据（v1.8.0 新增）
   调研依据：research/iterations/iter3-research.md
   - App Store 中国区「摸鱼」类 App 的共同卖点之一是「伪装感」：老板键 / 查岗瞬变装
   约束：内容全部为虚构的通用办公场景，不出现真实公司名、真人姓名、真实业务数据。
   数据结构：{ id, name, emoji, title, tag, table:{head:[],rows:[[]]}, list:[] }
*/
(function (root) {
  'use strict';

  var HS_BOSS = {
    pages: [
      {
        id: 'review',
        name: '业务复盘表',
        emoji: '📊',
        title: 'Q3 业务复盘 & 下阶段目标对齐',
        tag: '内部资料 · 请勿外传',
        table: {
          head: ['指标', '本季度', '目标', '状态'],
          rows: [
            ['活跃用户', '128,400', '130,000', '98.8%'],
            ['人均时长', '27.4 分钟', '30 分钟', '91.3%'],
            ['下季度核心目标', '把新用户首周留存从 42% 提升到 55%', '', '']
          ]
        },
        list: [
          '① 数据口径已与增长组对齐，待最终确认',
          '② 埋点方案本周五前补充完整',
          '③ 下阶段重点：留存 > 拉新'
        ]
      },
      {
        id: 'spec',
        name: '需求评审文档',
        emoji: '📝',
        title: 'V2.4 需求评审 · 交互稿 v7',
        tag: '评审中 · 暂勿改动',
        table: {
          head: ['模块', '负责人', '排期', '风险'],
          rows: [
            ['登录与授权', '产品 A', '3 周', '低'],
            ['消息中心', '前端 B', '5 周', '中'],
            ['数据看板', '前端 C', '2 周', '高'],
            ['灰度方案', '测试 D', '1 周', '中']
          ]
        },
        list: [
          '本次评审只看三个问题：范围有没有超、依赖有没有断、排期够不够',
          '数据看板的联调时间只有 2 周，超期的话先砍自定义筛选',
          '评审结论当天写进纪要，缺席的人会后补看'
        ]
      },
      {
        id: 'sales',
        name: '年度销售数据',
        emoji: '📈',
        title: '年度销售数据 · 区域明细',
        tag: '财务口径 · 仅供内部',
        table: {
          head: ['区域', '完成率', '同比', '备注'],
          rows: [
            ['华东', '103.2%', '+12.4%', '达成'],
            ['华北', '98.7%', '+3.1%', '达成'],
            ['华南', '94.5%', '-2.8%', '需追赶'],
            ['西南', '88.9%', '+6.5%', '新市场']
          ]
        },
        list: [
          '统计周期：1 月 1 日 - 12 月 31 日，金额单位为万元',
          '回款口径以财务系统为准，本表用于周会同步',
          '红色标记的项需要在周会前给出原因说明'
        ]
      },
      {
        id: 'english',
        name: '背单词页',
        emoji: '📖',
        title: '每日英语 · 词汇打卡',
        tag: '个人学习 · 请勿打扰',
        table: {
          head: ['单词', '释义', '例句', '掌握'],
          rows: [
            ['procrastinate', 'v. 拖延', 'He procrastinates on every task.', '★★★'],
            ['deadline', 'n. 截止时间', 'The deadline moved to Friday.', '★★★'],
            ['overtime', 'n. 加班', 'We worked overtime again.', '★★☆'],
            ['feedback', 'n. 反馈', 'Thanks for the honest feedback.', '★★☆'],
            ['schedule', 'v. 安排时间', 'Let me check my schedule.', '★☆☆']
          ]
        },
        list: [
          '今日目标：新词 5 个，复习 10 个',
          '连续打卡 3 天，周末奖励一顿夜宵',
          '记得住就过，记不住就明天再看一遍'
        ]
      }
    ]
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = HS_BOSS;
  root.HS_BOSS = HS_BOSS;
})(typeof window !== 'undefined' ? window : this);
