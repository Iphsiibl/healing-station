/* ===========================================================
 * 《今天能准时下班吗？》——分支生存小游戏数据
 * 结构：nodes（普通节点）+ endings（结局节点）
 * 每个选择带 heart（心值增减）与 tip（事后回响）
 * =========================================================== */
(function (root) {
  'use strict';

  var STORY = {
    title: '今天能准时下班吗？',
    subtitle: '一部只有几个按钮的职场生存剧 · 6 种结局 · 多刷几遍会看到不一样的明天',
    start: 'morning',
    hearts: 5,
    heartsLabel: '心值',

    nodes: {
      morning: {
        emoji: '🌅',
        title: '早上 8:55，工位',
        text: '你比上班时间早到了五分钟。电脑还热着，工作群在跳，桌角有一杯不知道谁放下的水。今天的第一件事，会决定最后一件。',
        choices: [
          { label: '在群里先回一句「收到」，稳住老板', next: 'boss_ping', heart: 0, tip: '秒回是一种策略：先证明你在，再谈别的。' },
          { label: '先去茶水间泡杯咖啡，缓一缓', next: 'coffee', heart: 1, tip: '早上的十分钟，是你一天里唯一属于自己的时间。' },
          { label: '打开待办清单，认真排个优先级', next: 'todo', heart: 1, tip: '清单越清晰，人越不慌。' }
        ]
      },

      boss_ping: {
        emoji: '📱',
        title: '9:02，老板发来「在吗？」',
        text: '两个字，后面跟着一个句号。你盯着那个句号看了三秒，屏幕像一场无声的抽奖。',
        choices: [
          { label: '秒回「在的，请说」', next: 'boss_meeting', heart: 0, tip: '回复速度换来了今天的第一个任务，也换来了安心。' },
          { label: '先把手头这件收个尾，三分钟后再回', next: 'boundary', heart: 1, tip: '晚三分钟回复，世界不会塌。' }
        ]
      },

      coffee: {
        emoji: '☕',
        title: '茶水间，遇见了同事',
        text: '饮水机嗡嗡响。对面那位刚洗完杯子，正看着你，欲言又止。',
        choices: [
          { label: '聊两句', next: 'gossip', heart: 0, tip: '同事的碎嘴里，藏着一整天的情报。' },
          { label: '点头微笑，快速回工位', next: 'calm', heart: 1, tip: '有些对话，留到下班路上说更划算。' }
        ]
      },

      todo: {
        emoji: '📋',
        title: '待办清单：17 项',
        text: '光看标题就累了。其中有一项标注着「重要且不紧急」，你知道它才是真正的 Boss。',
        choices: [
          { label: '只挑三件今天必须做的', next: 'focus', heart: 1, tip: '先做三件，而不是做十七件。' },
          { label: '全部重排一遍优先级', next: 'overwhelm', heart: 0, tip: '整理清单本身，也会消耗一整个上午。' }
        ]
      },

      calm: {
        emoji: '🫧',
        title: '安静的十分钟',
        text: '没有人找你。你捧着那杯温水，忽然想起来：今天好像还没被谁消耗过。',
        choices: [
          { label: '趁没人找，把最难的那件做了', next: 'focus', heart: 1, tip: '最难的活，值得你最清醒的两小时。' },
          { label: '再坐一会儿，什么都不做', next: 'overwhelm', heart: 0, tip: '发呆也是生产力的一部分。' }
        ]
      },

      boss_meeting: {
        emoji: '👔',
        title: '临时会议，15 分钟',
        text: '会议室里七个人，投影上是上季度的 OKR。你在第 11 分钟开始神游。',
        choices: [
          { label: '认真记笔记，抢一点存在感', next: 'meeting_ok', heart: 0, tip: '认真开会的人，会议上就已经累了。' },
          { label: '打开笔记本，假装在工作', next: 'meeting_bored', heart: 1, tip: '把会议当成带薪的十五分钟，也是一种天赋。' }
        ]
      },

      boundary: {
        emoji: '🛡️',
        title: '三分钟过去了',
        text: '你把手头的事收了尾，再回老板：消息发出去了。现在，等。',
        choices: [
          { label: '「在的，刚收尾，您说」——如实说', next: 'boss_good', heart: 1, tip: '有边界感的人，反而更被信任。' },
          { label: '「不好意思刚才在忙」，心里发慌', next: 'boss_bad', heart: -1, tip: '心虚的措辞，会被读成不专业。' }
        ]
      },

      gossip: {
        emoji: '👥',
        title: '同事开始吐槽领导',
        text: '「你说他是不是……」她压低了声音，但音量刚好够你听见。',
        choices: [
          { label: '附和两句，一起吐槽', next: 'trouble', heart: -1, tip: '一起吐槽很爽，但小圈子的记忆更长。' },
          { label: '换个话题，聊聊周末', next: 'safe_talk', heart: 1, tip: '会转移话题的人，办公室最安全。' },
          { label: '点头微笑，什么都不说', next: 'safe_talk', heart: 1, tip: '沉默有时是最聪明的附和。' }
        ]
      },

      focus: {
        emoji: '🔥',
        title: '上午忽然顺了',
        text: '键盘声连成一片，你甚至忘了喝水。抬头时已经 11:40。',
        choices: [
          { label: '趁热打铁，再做一件', next: 'lunch', heart: 1, tip: '状态好的时候别浪费，但也要记得吃饭。' },
          { label: '准时停手，去楼下走走', next: 'lunch_sun', heart: 1, tip: '会休息的人，才走得远。' }
        ]
      },

      overwhelm: {
        emoji: '🌀',
        title: '事情多得有点喘不过气',
        text: '你盯着满屏的待办，手指放在键盘上，一个字也敲不出来。',
        choices: [
          { label: '去茶水间哭五分钟', next: 'cry', heart: 0, tip: '允许自己崩一下，比硬撑着崩一小时强。' },
          { label: '找同事问一句「这个怎么弄」', next: 'ask_help', heart: 1, tip: '求助不是偷懒，是效率最高的协作。' }
        ]
      },

      meeting_ok: {
        emoji: '📝',
        title: '会议结束',
        text: '笔记本上记了六行要点，其中四行是「待跟进」。大家开始鱼贯而出。',
        choices: [
          { label: '把待跟进的事记进清单', next: 'afternoon', heart: 0, tip: '记下来，它才不会半夜回来找你。' },
          { label: '先去吃饭，脑子需要冷却', next: 'lunch', heart: 1, tip: '会议之后的十分钟，是一天里最贵的一口气。' }
        ]
      },

      meeting_bored: {
        emoji: '🥱',
        title: '会议进入第 14 分钟',
        text: '有人说「最后一点」，然后又讲了十分钟。',
        choices: [
          { label: '认真收尾，做个好员工', next: 'afternoon', heart: 0, tip: '认真是一种美德，也是一种消耗。' },
          { label: '偷偷把消息回完', next: 'slacking', heart: 1, tip: '一心二用，是打工人的核心技能。' },
          { label: '发一条只有朋友看得懂的动态', next: 'secret_msg', heart: 1, tip: '偷偷的快乐，也是快乐。' }
        ]
      },

      boss_good: {
        emoji: '👍',
        title: '老板回复：「不错，继续保持」',
        text: '六个字，比一整天的夸都值钱。你还没来得及高兴，新消息来了。',
        choices: [
          { label: '顺势提一句「需要我做什么？」', next: 'raise', heart: 1, tip: '主动的人拥有更多选择，包括选择不加班。' },
          { label: '低调回复「好的，谢谢老板」', next: 'afternoon', heart: 0, tip: '低调也安全，但机会会从指缝里溜走。' }
        ]
      },

      boss_bad: {
        emoji: '😶',
        title: '老板的回复只有一个句号',
        text: '「。」你盯着它看了很久，感觉整个下午都凉了一半。',
        choices: [
          { label: '赶紧补救，先道歉再给方案', next: 'apologize', heart: 0, tip: '认错不丢人，拖着才丢人。' },
          { label: '心里有点气，想直接怼回去', next: 'fight', heart: -1, tip: '情绪上头时写下的字，通常第二天就想撤回。' }
        ]
      },

      safe_talk: {
        emoji: '🫖',
        title: '闲聊安全着陆',
        text: '你们聊到了周末的天气、楼下的新咖啡店，以及一只在停车场出现的橘猫。',
        choices: [
          { label: '心满意足回工位', next: 'afternoon', heart: 1, tip: '没有风险的对话，也是生存策略。' }
        ]
      },

      trouble: {
        emoji: '😅',
        title: '话说多了',
        text: '「其实他上次那个……」你话说到一半，发现对方脸色变了。',
        choices: [
          { label: '立刻刹车：「我什么都没说哈哈」', next: 'apologize', heart: 0, tip: '刹车踩得好，事故就不会扩大。' },
          { label: '硬着头皮把话说完', next: 'fight', heart: -1, tip: '说完一句话的代价，通常是三天。' }
        ]
      },

      lunch: {
        emoji: '🍱',
        title: '12:10，午餐时间',
        text: '工位上的外卖凉了一半，同事在群里问「一起点吗」。',
        choices: [
          { label: '和同事拼单，边吃边聊', next: 'lunch_chat', heart: 0, tip: '饭桌上的话最真，也最容易传出去。' },
          { label: '一个人戴上耳机，慢慢吃', next: 'lunch_alone', heart: 1, tip: '一个人吃饭，是成年人的小型充电站。' }
        ]
      },

      lunch_sun: {
        emoji: '☀️',
        title: '楼下晒太阳',
        text: '风很轻，晒得人有点晕。手机在口袋里震了一下。',
        choices: [
          { label: '掏出来看：又是工作消息', next: 'urgent_pm', heart: -1, tip: '阳光下的坏消息，比会议室里的更难消化。' },
          { label: '不看，再晒三分钟', next: 'calm', heart: 1, tip: '不看的那三分钟，是你偷来的。' }
        ]
      },

      lunch_chat: {
        emoji: '🥢',
        title: '饭桌上在聊',
        text: '有人刚吐槽完隔壁组 leader，也有人偷偷说周末要去爬山。',
        choices: [
          { label: '聊点工作，混个脸熟', next: 'afternoon', heart: 0, tip: '聊工作安全，但不解饿。' },
          { label: '聊点生活，给自己续命', next: 'calm', heart: 1, tip: '生活的话题，是精神食粮。' }
        ]
      },

      lunch_alone: {
        emoji: '🎧',
        title: '一个人吃饭',
        text: '耳机里放着一首老歌。窗口的光落在键盘上，像很久以前的一个下午。',
        choices: [
          { label: '顺手看了眼工作群', next: 'afternoon', heart: 0, tip: '午休看群消息，是双倍的下班焦虑。' },
          { label: '把手机扣过去，继续听歌', next: 'quiet', heart: 1, tip: '这一分钟，世界安静得刚刚好。' }
        ]
      },

      cry: {
        emoji: '🥹',
        title: '茶水间，哭了五分钟',
        text: '没人看见。热水机的蒸汽糊住了眼镜，你把脸埋进袖子。',
        choices: [
          { label: '洗把脸，回去继续', next: 'afternoon', heart: 0, tip: '哭完还能回去上班的人，真的很厉害。' },
          { label: '再坐一会儿，什么都不想', next: 'quiet', heart: 1, tip: '允许自己停下来，也是效率的一部分。' }
        ]
      },

      ask_help: {
        emoji: '🙋',
        title: '你开口问了一句',
        text: '「这个我不太熟，你有什么建议吗？」话一出口，你的心跳漏了半拍。',
        choices: [
          { label: '同事耐心讲了一遍', next: 'helped', heart: 1, tip: '大部分人都比你想的愿意帮忙。' },
          { label: '对方回了一句「我也很忙」', next: 'ignored', heart: -1, tip: '被拒绝不代表你不好，只代表今天不方便。' }
        ]
      },

      helped: {
        emoji: '🤝',
        title: '问题解决了',
        text: '原来只要十五分钟。你甚至有点想笑——难了一上午的事，居然这么大。',
        choices: [
          { label: '趁手热把第二件也做掉', next: 'afternoon', heart: 1, tip: '连赢两把的下午，是久违的爽感。' },
          { label: '准时收工，剩下的明天再说', next: 'early', heart: 1, tip: '知道什么时候停，也是能力。' }
        ]
      },

      ignored: {
        emoji: '🚪',
        title: '门关上了',
        text: '对方在忙。你站在原地，突然有点想自己扛。',
        choices: [
          { label: '自己慢慢摸索', next: 'afternoon', heart: 0, tip: '有些门会开，有些不会，记得换一扇。' },
          { label: '先歇一会儿再说', next: 'quiet', heart: 0, tip: '休息不是逃避，是重新上膛。' }
        ]
      },

      slacking: {
        emoji: '📱',
        title: '消息回完了',
        text: '会议还在继续，你的心已经飘到工位上。这大概是打工人最熟练的 multitasking。',
        choices: [
          { label: '收起手机，装作在思考', next: 'afternoon', heart: 0, tip: '演技，也是职场必修课。' }
        ]
      },

      secret_msg: {
        emoji: '😏',
        title: '动态发出去了',
        text: '只有你最好的朋友看得懂，配文是「还在开会，人已离岸」。',
        choices: [
          { label: '偷偷笑一下，继续开会', next: 'afternoon', heart: 1, tip: '一点小快乐，足以撑过两小时。' }
        ]
      },

      raise: {
        emoji: '🙋‍♂️',
        title: '你提了一个请求',
        text: '「这块能不能我来推？」老板停了两秒，说：「你确认？」',
        choices: [
          { label: '确认，并说清你能做到哪一步', next: 'asked', heart: 1, tip: '把话说清楚，比说「我可以」重要十倍。' },
          { label: '算了，还是照原计划吧', next: 'declined', heart: 0, tip: '不争，也是一种温和的策略。' }
        ]
      },

      asked: {
        emoji: '🎯',
        title: '任务交到了你手上',
        text: '有点紧张，但这次是你自己接的。下午的时间忽然有了方向。',
        choices: [
          { label: '一头扎进去，做漂亮一点', next: 'afternoon', heart: 1, tip: '主动选择的事，连加班都不那么难熬。' },
          { label: '先评估工时，别把自己填满', next: 'early', heart: 1, tip: '会估工时的人，才能准点下班。' }
        ]
      },

      declined: {
        emoji: '🙅',
        title: '你还是没开口',
        text: '机会滑过去了，但下午也没有崩。',
        choices: [
          { label: '把手上这件事做漂亮', next: 'afternoon', heart: 0, tip: '不争一时，不亏一世。' },
          { label: '心里有点堵，找人吐槽两句', next: 'fight', heart: -1, tip: '情绪需要一个出口，但别选错出口。' }
        ]
      },

      apologize: {
        emoji: '🙏',
        title: '你道了歉，也给了方案',
        text: '「刚才没及时回是我不好，下次我提前说。」对方回了一个「好」。',
        choices: [
          { label: '收下这个「好」，继续干活', next: 'afternoon', heart: 1, tip: '事情翻篇了，比什么都好。' },
          { label: '越想越气，还想再说点什么', next: 'fight', heart: -1, tip: '有些气，放到下班路上再发。' }
        ]
      },

      fight: {
        emoji: '🔥',
        title: '情绪上头了',
        text: '手指已经在键盘上敲出一长串字，感叹号打了三个。',
        choices: [
          { label: '深呼吸，删掉重写', next: 'cool_down', heart: 1, tip: '删掉的那三十秒，替你省了一个月的班。' },
          { label: '直接发送', next: 'blast', heart: -1, tip: '发送键是世界上最贵的一键。' },
          { label: '跑下楼绕一圈再回来', next: 'afternoon', heart: 1, tip: '身体先冷静，脑子才跟得上。' }
        ]
      },

      cool_down: {
        emoji: '🫁',
        title: '你删掉了那三个感叹号',
        text: '重新读了一遍，改成两句话发出去。世界没有塌。',
        choices: [
          { label: '回到工位，继续今天', next: 'afternoon', heart: 1, tip: '成熟的定义之一：能把火咽回去。' }
        ]
      },

      blast: {
        emoji: '💥',
        title: '消息发出去了',
        text: '三秒后你开始后悔。群里一片安静。',
        choices: [
          { label: '冷静后补一句解释', next: 'apologize', heart: 0, tip: '事后补救，也是成年人的必修课。' },
          { label: '假装无事发生，缩进自己的世界', next: 'quiet', heart: -1, tip: '沉默有时候比解释更响。' }
        ]
      },

      urgent_pm: {
        emoji: '📲',
        title: '下午 2:07，一条「方便看下吗」',
        text: '「方便」两个字，通常意味着不方便。',
        choices: [
          { label: '马上看', next: 'overtime', heart: -1, tip: '响应快是优点，但 responder 也会累。' },
          { label: '先把手上的做完再回', next: 'overtime', heart: 0, tip: '顺序不同，命就不同。' }
        ]
      },

      quiet: {
        emoji: '🕯️',
        title: '安静的十分钟',
        text: '你什么也没做，只是坐着，听见空调的声音。',
        choices: [
          { label: '让这份安静再久一点', next: 'calm', heart: 1, tip: '有些时间不产出，但很珍贵。' },
          { label: '好了，回到工位', next: 'afternoon', heart: 0, tip: '休息好了，就出发吧。' }
        ]
      },

      afternoon: {
        emoji: '🕒',
        title: '下午三点',
        text: '工位上的灯亮着，你的日程表上还有两个待办和一格空白。',
        choices: [
          { label: '状态还行，继续往前推', next: 'evening', heart: 1, tip: '下午三点是一天里最容易坚持的时刻。' },
          { label: '下午被临时塞了新活', next: 'overtime', heart: -1, tip: '计划被打乱时，更要留一点弹性。' },
          { label: '手头的活提前做完了', next: 'early', heart: 1, tip: '提前完成的人，拥有下班主动权。' }
        ]
      },

      evening: {
        emoji: '🌆',
        title: '下午六点零一分',
        text: '楼下的车流开始变密。屏幕右下角的数字在跳，你的手放在键盘上。',
        choices: [
          { label: '收工！打卡走人', next: 'leave', heart: 1, tip: '第一秒离开办公室的人，最自由。' },
          { label: '再等等，把这个收个尾', next: 'wait', heart: 0, tip: '「再等一会」是加班的第一块砖。' }
        ]
      },

      overtime: {
        emoji: '🌃',
        title: '下班时间过了',
        text: '办公室的人少了一半，键盘声变得很清晰。',
        choices: [
          { label: '做完它，然后回家', next: 'end_overtime', heart: -1, tip: '你今天的努力没人会知道，但你自己知道。' },
          { label: '干脆把它做到超出预期', next: 'end_hero', heart: -1, tip: '把工作做到极致的人，最容易错过末班车。' }
        ]
      },

      early: {
        emoji: '🎉',
        title: '活干完了，还早',
        text: '工位突然安静下来，你有一小段完全属于自己的时间。',
        choices: [
          { label: '准点打卡，去过自己的晚上', next: 'leave', heart: 1, tip: '今天的你，值得完整的晚上。' },
          { label: '再检查一遍，完美主义一下', next: 'check_again', heart: 0, tip: '完美主义很贵，偶尔也值得。' }
        ]
      },

      leave: {
        emoji: '🚪',
        title: '你站起来，收了包',
        text: '电梯往下走的时候，你听见身后有人还在敲键盘。',
        choices: [
          { label: '头也不回，走得理直气壮', next: 'end_early', heart: 1, tip: '下班不需要理由。' },
          { label: '礼貌地等电梯里最后一个同事', next: 'end_slight', heart: 1, tip: '等一个人的电梯，也是一种温柔。' }
        ]
      },

      wait: {
        emoji: '⏳',
        title: '「再五分钟就好」',
        text: '五分钟变成了十分钟，十分钟变成了「马上就完」。',
        choices: [
          { label: '真的做完了', next: 'end_slight', heart: 0, tip: '收尾是美德，但别每次都它。' },
          { label: '又发现了一个新问题', next: 'end_late', heart: -1, tip: '永远有一个新问题，所以要有截止时间。' }
        ]
      },

      check_again: {
        emoji: '🔍',
        title: '你又检查了一遍',
        text: '没问题。真的没问题了。但你还是又改了一行。',
        choices: [
          { label: '行了，走吧', next: 'end_perfect', heart: 1, tip: '完美主义的最高境界：允许自己准时。' },
          { label: '再顺手帮同事看一眼', next: 'end_early', heart: 1, tip: '善良但要设边界，否则好心会变成加班。' }
        ]
      }
    },

    endings: {
      end_early: {
        emoji: '🌅',
        title: '结局 · 准时下班型',
        grade: 'S',
        desc: '六点零一分，你比闹钟还准时。地铁上你看着窗外，忽然觉得今天也没有那么难。',
        comfort: '你今天已经做完了该做的事。剩下的，明天再说。',
        tip: '把这段时间留给生活，它比工位更值钱。'
      },
      end_perfect: {
        emoji: '🏅',
        title: '结局 · 完美主义型',
        grade: 'S+',
        desc: '活干完了，文档也检查了三遍。你走出办公室时，天还没完全黑。',
        comfort: '你对自己的标准很高，这很好——但别让它替你决定几点回家。',
        tip: '允许 80 分先下班，剩下的 20 分留给明天。'
      },
      end_slight: {
        emoji: '🌙',
        title: '结局 · 差一点型',
        grade: 'A',
        desc: '六点四十五，你在电梯里最后检查了一遍消息，然后才按下关门键。',
        comfort: '晚一点点不算失败，你今天已经很努力了。',
        tip: '下次试试：到点就停，哪怕只差一点点。'
      },
      end_late: {
        emoji: '🌃',
        title: '结局 · 深夜战士型',
        grade: 'B',
        desc: '十一点，办公室只剩你一盏灯。改完最后一版，你终于把电脑合上。',
        comfort: '辛苦了。今晚请对自己好一点，明天的班我们再想办法。',
        tip: '深夜的效率常常是假象，早点睡也是生产力。'
      },
      end_overtime: {
        emoji: '🫠',
        title: '结局 · 通宵战士型',
        grade: 'C',
        desc: '凌晨两点，你和进度条互相伤害。走出大楼时，整座城市只剩你和路灯。',
        comfort: '没有人会为你的牺牲鼓掌，但你依然撑住了这一天。你很了不起。',
        tip: '明天的第一件事，是睡够。其他的都可以商量。'
      },
      end_hero: {
        emoji: '🏵',
        title: '结局 · 公司之光型',
        grade: 'A+',
        desc: '你的超额完成被写进了复盘 PPT，虽然大部分同事根本没看到。',
        comfort: '有些光是自己发出来的。哪怕没人鼓掌，你也知道今天做了什么。',
        tip: '记得给自己也发一朵小红花。'
      }
    }
  };

  root.HS_STORY = STORY;
  if (typeof module !== 'undefined' && module.exports) module.exports = STORY;
})(typeof window !== 'undefined' ? window : globalThis);
