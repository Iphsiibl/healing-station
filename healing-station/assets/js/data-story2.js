/* ===========================================================
 * 《被裁的那天》——被约谈那一天的分支演练
 * 结构：nodes（普通节点）+ endings（结局节点）
 * 每个选择带 heart（底气增减）与 tip（事后回响）
 * 说明：这是一次「先在没人看见的地方练一遍」的情境演练，
 *      只做情境预演与情绪支持，不引用法条、不谈具体数字、不给法律建议。
 * =========================================================== */
(function (root) {
  'use strict';

  var STORY2 = {
    id: 'layoff',
    title: '被裁的那天',
    subtitle: '一场没人看见的排练 · 4 种结局 · 先想清楚自己的底线和要问的问题',
    start: 'notice',
    hearts: 5,
    heartsLabel: '底气',
    maxSteps: 40,
    loopEnding: 'end_tomorrow',

    nodes: {
      /* ---------- 一、约谈试探 ---------- */

      notice: {
        emoji: '📮',
        title: '一封没有主题的邮件',
        text: '上午十点，邮箱里多出一行字：十点十分，小会议室，关于你的岗位。没有人说是什么事。',
        choices: [
          { label: '先回一句收到', next: 'meetup', heart: 0, tip: '先应下来，节奏才不会乱。' },
          { label: '先找同事打听一句', next: 'rumor', heart: 0, tip: '问一句，比自己编一整夜强。' },
          { label: '记下时间、地点、通知人', next: 'meetup', heart: 1, tip: '日期和名字记着，以后不用靠回忆。' }
        ]
      },

      rumor: {
        emoji: '👂',
        title: '走廊里的风声',
        text: '茶水间有人说，这个季度要动一批人；也有人说不是。你手里那杯水还热着。',
        choices: [
          { label: '记下听到的版本，先不当结论', next: 'meetup', heart: 1, tip: '听来的话，放一晚再看。' },
          { label: '先在心里给自己判了死刑', next: 'meetup', heart: -1, tip: '别人的一句话，别提前替你写好结局。' }
        ]
      },

      meetup: {
        emoji: '🚪',
        title: '小会议室门口',
        text: '玻璃门里有人在整理文件。你看了眼表，还有四分钟。',
        choices: [
          { label: '提前两分钟进去，坐靠门的位置', next: 'opening', heart: 1, tip: '位置还能挑的时候，就自己挑一个。' },
          { label: '带一支笔和一张白纸进去', next: 'opening', heart: 1, tip: '笔在本子上沙沙的声音，比心跳好听。' },
          { label: '在楼梯间站一分钟再进去', next: 'opening', heart: 0, tip: '慢一分钟，是为了走得稳。' }
        ]
      },

      opening: {
        emoji: '🪑',
        title: '他把门关上了',
        text: '对方坐下，翻开笔记本，说今天想跟你聊聊岗位的事。语速很平，像在念流程。',
        choices: [
          { label: '安静听完，先不接话', next: 'perf', heart: 1, tip: '听完再答，是最省力的礼貌。' },
          { label: '先问我们大概聊多久', next: 'perf', heart: 0, tip: '问时间，是给自己留一条退路。' },
          { label: '问这是流程还是已有结论', next: 'bottom', heart: 1, tip: '把问题问在开头，后面少绕路。' }
        ]
      },

      /* ---------- 二、绩效施压 ---------- */

      perf: {
        emoji: '📊',
        title: '他打开了一张表',
        text: '屏幕转过来，是季度评分表。他一项一项念，你发现有些事你从没听说过。',
        choices: [
          { label: '问这些项是谁打的、怎么打的', next: 'bottom', heart: 1, tip: '不知来路的分，先问来路。' },
          { label: '先点头记下，不当场反驳', next: 'proof', heart: 0, tip: '先记下来，反驳可以晚一点。' }
        ]
      },

      bottom: {
        emoji: '📉',
        title: '表格的最后一列',
        text: '他说这个季度末位有几个人，你在里面。他的语气里没有恶意，只有陈述。',
        choices: [
          { label: '问末位的标准写在哪里', next: 'proof', heart: 1, tip: '能被写下来的，才谈得上讨论。' },
          { label: '当场说你们就是冲着我来的', next: 'argue', heart: -2, tip: '气话很真，却会替你省掉有用的问题。' }
        ]
      },

      proof: {
        emoji: '📄',
        title: '他要你举证',
        text: '他说团队一直希望有具体的事例。你想了很久，只想起几件顺手做的小事。',
        choices: [
          { label: '一条条问具体指哪一次、哪份材料', next: 'argue', heart: 1, tip: '问题越具体，答案越难含糊。' },
          { label: '先记下举证不足这四个字', next: 'transfer', heart: 0, tip: '记下这个词，比争论它管用。' }
        ]
      },

      argue: {
        emoji: '🗣️',
        title: '你开口了',
        text: '你把心里的问题一条条说出来。对方听着，没打断，也没立刻回答。',
        choices: [
          { label: '把反问说完，先不逼回应', next: 'transfer', heart: 1, tip: '问完就停，比追着要答案更稳。' },
          { label: '说回去看材料，明天给答复', next: 'keep', heart: 1, tip: '留一晚给自己，想清楚再说话。' },
          { label: '把话说到最重的地方', next: 'transfer', heart: -2, tip: '情绪冲得越高，记住的细节越少。' }
        ]
      },

      /* ---------- 三、调岗降薪 ---------- */

      transfer: {
        emoji: '🔀',
        title: '换个地方干',
        text: '他说与其说岗位没了，不如换个方向：可以去别的部门，待遇的说法也换一套。',
        choices: [
          { label: '问调岗是现在定的还是要走流程', next: 'pay', heart: 1, tip: '流程还在，事情就还有余地。' },
          { label: '先听完全部条件再表态', next: 'relocate', heart: 0, tip: '听完整套方案，才知道哪条不能接。' }
        ]
      },

      pay: {
        emoji: '💰',
        title: '新的那串数字',
        text: '屏幕上出现一个比你现在低的数字。他说这个数是按新岗位定的，不是针对你。',
        choices: [
          { label: '问新岗位的薪酬是怎么定出来的', next: 'rename', heart: 1, tip: '数字背后有来路，问清来路再谈数字。' },
          { label: '问原来的职级和工龄还算不算', next: 'keep', heart: 1, tip: '你在意的事，先说出来。' }
        ]
      },

      relocate: {
        emoji: '📍',
        title: '换个城市',
        text: '他说另一个城市的团队缺人，年底前过去就行。那边房租便宜，也安静。',
        choices: [
          { label: '问去哪儿、怎么通知、过渡怎么安排', next: 'rename', heart: 1, tip: '变动越大，细节越要问。' },
          { label: '说我需要时间看，先记下来', next: 'keep', heart: 0, tip: '先记下来，你就有得选。' }
        ]
      },

      rename: {
        emoji: '🏷️',
        title: '换个名字的岗位',
        text: '新岗位有另一个名字，写在文件上。听着像升职，也像换了个地方消失。',
        choices: [
          { label: '问为什么非要换个名字', next: 'paper', heart: 1, tip: '名字换了，事还是那件事。' },
          { label: '把要问的问题写成清单', next: 'ask', heart: 1, tip: '清单上的一条，比记在脑中的牢。' }
        ]
      },

      /* ---------- 四、逼签放弃协议 ---------- */

      paper: {
        emoji: '📝',
        title: '桌上多了一张纸',
        text: '他推过来一份文件，说签了就能办手续，不签就走另一套流程。纸还带着打印机的热气。',
        choices: [
          { label: '一行行读，先看有没有空白页', next: 'deadline', heart: 1, tip: '空白页，常常是留给以后填的。' },
          { label: '问这份文件是给谁看的', next: 'dignity', heart: 1, tip: '问用途，比问条件更能看清处境。' }
        ]
      },

      deadline: {
        emoji: '⏳',
        title: '今天就要一个答复',
        text: '他说今天不方便谈太久，希望你下班前给个回复。笔放在纸上，没有推过来。',
        choices: [
          { label: '问今天就得给答复吗', next: 'dignity', heart: 1, tip: '期限是他们的节奏，不是你的。' },
          { label: '说带回去看，明天回复你', next: 'silent', heart: 1, tip: '拿回家再答，脑子会更清楚。' }
        ]
      },

      dignity: {
        emoji: '🎭',
        title: '「签了大家都体面」',
        text: '他说这话不是威胁，只是体面。你点点头，发现自己没在听内容，只在听语气。',
        choices: [
          { label: '问不签的话接下来会发生什么', next: 'sign', heart: 1, tip: '把最坏的可能摆到桌面上看。' },
          { label: '把文件轻轻推回桌子中间', next: 'silent', heart: 1, tip: '推回去半寸，也是回答。' }
        ]
      },

      sign: {
        emoji: '🖊️',
        title: '笔就在那儿',
        text: '他把笔转了半圈，推到你面前。房间里只剩空调声，和纸角翘起的声音。',
        choices: [
          { label: '把笔放下，说今天不签', next: 'silent', heart: 1, tip: '不签也是一种回答，说出来就好。' },
          { label: '先问清每一条的意思再动笔', next: 'ask', heart: 1, tip: '看不懂的条款，别用签字带过。' }
        ]
      },

      /* ---------- 五、取证与协商 ---------- */

      keep: {
        emoji: '🗂️',
        title: '该留的东西',
        text: '你回到工位，先不打开那些系统。抽屉里还有去年的排班表、工牌、几张打印出来的通知。',
        choices: [
          { label: '把该留的都留一份，列好清单', next: 'end_records', heart: 2, tip: '留存不是为了吵架，是为了以后不靠记忆。' },
          { label: '把要问的问题写在纸上', next: 'ask', heart: 1, tip: '问题写下来，就不会被忘在门外。' },
          { label: '先自己留一份，暂时不外传', next: 'silent', heart: 0, tip: '先放好，选择权还在你手里。' }
        ]
      },

      ask: {
        emoji: '❓',
        title: '该问的话',
        text: '你把清单摊开：岗位怎么评的、方案谁定的、文件怎么来的。一条条问完，人有点累。',
        choices: [
          { label: '把问题一条条问到底', next: 'end_deal', heart: 2, tip: '问清楚不等于答应，只是把黑箱打开一点。' },
          { label: '问完说需要回去想想', next: 'leave', heart: 1, tip: '不急着答，也是一种答法。' },
          { label: '直接说这个方案我不同意', next: 'end_tomorrow', heart: 0, tip: '先说不同意，后面还有余地。' }
        ]
      },

      silent: {
        emoji: '🤫',
        title: '你没有点头',
        text: '你说，我需要时间。他愣了一下，说好，那今天先到这儿。你发现手心一直是凉的。',
        choices: [
          { label: '不点头也不摇头，起身说回去想想', next: 'leave', heart: 1, tip: '把场子留在原地，你才有下一步。' },
          { label: '明确说今天不给答复', next: 'end_tomorrow', heart: 1, tip: '不给答复，也是一种答复。' },
          { label: '说出自己的底线，什么条件才考虑', next: 'end_stable', heart: 1, tip: '底线说出口，就不用每次重想一遍。' }
        ]
      },

      leave: {
        emoji: '🌆',
        title: '你走出了会议室',
        text: '走廊的灯是白的。你的包有点重，手机里存着一串没拨出去的电话。',
        choices: [
          { label: '把今天记的东西整理一遍', next: 'end_stable', heart: 1, tip: '整理完，慌就少一半。' },
          { label: '给信任的人打个电话听听', next: 'end_tomorrow', heart: 1, tip: '别人的经验是参考，不是你的结论。' },
          { label: '先回家睡一觉，明天再处理', next: 'end_tomorrow', heart: 1, tip: '睡一觉，不会让事情变糟。' }
        ]
      }
    },

    endings: {
      end_deal: {
        emoji: '🌤️',
        title: '结局 · 谈下来了',
        grade: 'A',
        desc: '你没有当场签字，但该问的都问了，对方也把能说的说了。你们约好几天后再谈一次，气氛比进门时松了一点。',
        comfort: '今天你没点头，也没慌。能问出口的问题，已经被你自己问走了大半。',
        tip: '下次同类谈话，先带上问题清单，节奏会稳很多。'
      },
      end_stable: {
        emoji: '🌿',
        title: '结局 · 先稳住了',
        grade: 'B',
        desc: '你想说的话说了，不想签的字留下了。今天既没答应，也没翻脸，走出大楼时天还亮着。',
        comfort: '你撑过了这一天，没在最慌的那一刻做决定，这已经很不容易了。',
        tip: '能拖一天是一天，你不是一个人耗时间。'
      },
      end_records: {
        emoji: '🗃️',
        title: '结局 · 留了证据再来',
        grade: 'S',
        desc: '排班表、工牌、打印出来的通知，你一样样留好，还列了一张清单。东西在你手里，你就不算空手。',
        comfort: '这些纸现在不解决问题，但它们替未来的你记着今天。',
        tip: '收好，先别外传；给信任的人看之前，先想好怎么说。'
      },
      end_tomorrow: {
        emoji: '🌙',
        title: '结局 · 明天再说',
        grade: 'C',
        desc: '文件还留在桌上，答复还没给。你和对方都知道今天没谈完，但也没谈崩。',
        comfort: '没谈完不等于谈砸，今天的沉默也算数。',
        tip: '睡一觉，明天带着清单去，别空着脑子回去。'
      }
    }
  };

  root.HS_STORY2 = STORY2;
  if (typeof module !== 'undefined' && module.exports) module.exports = STORY2;
})(typeof window !== 'undefined' ? window : globalThis);
