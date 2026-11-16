/* ===========================================================
 * 《今天能准时下班吗？》——分支生存小游戏数据
 * 结构：nodes（普通节点）+ endings（结局节点）
 * 每个选择带 heart（心值增减）与 tip（事后回响）
 * =========================================================== */
(function (root) {
  'use strict';

  var STORY = {
    title: '今天能准时下班吗？',
    subtitle: '一部只有几个按钮的职场生存剧 · 10 种结局 · 多刷几遍会看到不一样的明天',
    start: 'morning',
    hearts: 5,
    heartsLabel: '心值',
    // v1.9.0：主线扩到 60 节点 / 10 结局；剧情里有循环（绕圈型的日常），引擎用步数上限兜底，到点强制收尾
    maxSteps: 60,
    loopEnding: 'end_drift',

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
          { label: '只挑三件今天要紧的', next: 'focus', heart: 1, tip: '先做三件，而不是做十七件。' },
          { label: '全部重排一遍优先级', next: 'overwhelm', heart: 0, tip: '整理清单本身，也会消耗一整个上午。' },
          { label: '今天远程，把清单挪到家里做', next: 'remote_morning', heart: 0, tip: '在家开工也需要仪式感：清单排好，就像人齐了。' }
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
          { label: '准时停手，去楼下走走', next: 'lunch_sun', heart: 1, tip: '会休息的人，才走得远。' },
          { label: '再开一份清单，重新排一遍优先级', next: 'end_drift', heart: -1, tip: '反复重排优先级也是拖延的一种：它让你感觉一直在做事。' }
        ]
      },

      overwhelm: {
        emoji: '🌀',
        title: '事情多得有点喘不过气',
        text: '你盯着满屏的待办，手指放在键盘上，一个字也敲不出来。',
        choices: [
          { label: '去没人的地方哭五分钟', next: 'cry', heart: 0, tip: '允许自己崩一下，比硬撑着崩一小时强。' },
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
          { label: '心满意足回工位', next: 'afternoon', heart: 1, tip: '没有风险的对话，也是生存策略。' },
          { label: '笑着把水杯洗了再回工位', next: 'calm', heart: 1, tip: '洗净的水杯，会让下午的手感顺一点。' }
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
          { label: '一个人戴上耳机，慢慢吃', next: 'lunch_alone', heart: 1, tip: '一个人吃饭，是成年人的小型充电站。' },
          { label: '今天是周五，午饭都吃得快一点', next: 'friday_1545', heart: 1, tip: '周五的饭总是快，因为心里有个倒计时。' }
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
          { label: '聊点生活，给自己续命', next: 'calm', heart: 1, tip: '生活的话题，是精神食粮。' },
          { label: '听他们聊工位调整，心里有点悬', next: 'desk_move', heart: 0, tip: '工位是你在公司的座位，动了就像动了半个人。' }
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
          { label: '什么都不想，先缓一会儿', next: 'quiet', heart: 1, tip: '允许自己停下来，也是效率的一部分。' },
          { label: '洗完脸出来，有人递来一颗糖', next: 'candy_desk', heart: 1, tip: '最难的十分钟里，糖是最轻的一句安慰。' }
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
          { label: '收起手机，装作在思考', next: 'afternoon', heart: 0, tip: '演技，也是职场必修课。' },
          { label: '再摸十分钟鱼，把下班时间忘掉', next: 'evening', heart: 1, tip: '摸鱼的人，通常比赶时间的人更早到家。' }
        ]
      },

      secret_msg: {
        emoji: '😏',
        title: '动态发出去了',
        text: '只有你最好的朋友看得懂，配文是「还在开会，人已离岸」。',
        choices: [
          { label: '偷偷笑一下，继续开会', next: 'afternoon', heart: 1, tip: '一点小快乐，足以撑过两小时。' },
          { label: '把这条动态设成仅自己可见', next: 'quiet', heart: 1, tip: '偷偷的快乐只留给自己看，也挺好。' }
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
          { label: '回到工位，继续今天', next: 'afternoon', heart: 1, tip: '成熟的定义之一：能把火咽回去。' },
          { label: '把今天最后一件事收掉再走', next: 'early', heart: 1, tip: '把火咽下去之后，也记得给自己留个收尾。' }
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
        title: '下午 2:07，「方便看下吗」',
        text: '「方便」两个字，通常意味着不方便。',
        choices: [
          { label: '马上看', next: 'overtime', heart: -1, tip: '响应快是优点，但 responder 也会累。' },
          { label: '先把手上的做完再回', next: 'overtime', heart: 0, tip: '顺序不同，命就不同。' },
          { label: '消息还没回完，电脑先蓝屏了', next: 'blue_screen', heart: -1, tip: '一天里最突然的事，从来没有预兆。' }
        ]
      },

      quiet: {
        emoji: '🕯️',
        title: '只有空调声的十分钟',
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
          { label: '再等等，把这个收个尾', next: 'wait', heart: 0, tip: '「再等一会」是加班的第一块砖。' },
          { label: '今天是周五，直接进电梯', next: 'end_friday_run', heart: 1, tip: '周五十八点零一分，是本周最勇敢的一分钟。' }
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
          { label: '礼貌地等电梯里最后一个同事', next: 'end_slight', heart: 1, tip: '等一个人的电梯，也是一种温柔。' },
          { label: '下楼时碰见前同事', next: 'ex_colleague', heart: 1, tip: '电梯门一开，旧同事就站在外头。' }
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
      },

      /* ---- v1.9.0 新支线：远程办公的一天 ---- */
      remote_morning: {
        emoji: '🏠',
        title: '在家开工的第一小时',
        text: '桌上没有工牌，也没有隔壁的键盘声。挂钟显示九点十分，没人催你，反而不知道从哪儿下手。',
        choices: [
          { label: '先把桌面收拾出来，再列三件事', next: 'remote_video', heart: 1, tip: '在家上班也需要仪式感，仪式感能撑住上午。' },
          { label: '先躺着回一会儿消息', next: 'remote_video', heart: 0, tip: '躺着回消息也挺好，就是腰先知道了。' }
        ]
      },

      remote_video: {
        emoji: '📹',
        title: '视频会议：开摄像头',
        text: '十点整，画面里弹出一排头像。主持人说了句「大家都开一下摄像头吧」，你的手停在触控板上。',
        choices: [
          { label: '打开摄像头，打理一下头发', next: 'remote_finish', heart: 0, tip: '露脸只是面子活，背后的活还得自己干完。' },
          { label: '假装网络卡，等一下再开', next: 'remote_finish', heart: 1, tip: '卡顿是技术问题，也是人类的好朋友。' }
        ]
      },

      remote_finish: {
        emoji: '🌤️',
        title: '下午四点，没人找你了',
        text: '会议散了，消息也回完了。一整天没说几句超过十个字的话，工位却堆了半天的活。',
        choices: [
          { label: '把最后一点收完，准时关电脑', next: 'end_early', heart: 1, tip: '在家办公最难的一步，是关掉电脑那一刻。' },
          { label: '顺手再多做一点，换个心安', next: 'end_late', heart: -1, tip: '多做的那些通常没人知道，也没人会记。' }
        ]
      },

      /* ---- v1.9.0 新支线：周五下班前的最后 15 分钟 ---- */
      friday_1545: {
        emoji: '🕞',
        title: '周五 15:45',
        text: '整层楼的人都开始收东西。你桌上的活看着只剩一点点，一点点通常是最能拖的那种。',
        choices: [
          { label: '先回客户那封一直没动的邮件', next: 'friday_email', heart: 0, tip: '周五的邮件，回一句就能换两天安生。' },
          { label: '把桌面先收干净，文件归位', next: 'friday_pack', heart: 1, tip: '空桌面的周五，走起路来都带风。' }
        ]
      },

      friday_email: {
        emoji: '✉️',
        title: '客户来了一封邮件',
        text: '标题里有「尽快」两个字，正文第一行是「贵司看下」。窗外天色开始变橘，你的手停在键盘上。',
        choices: [
          { label: '回一句「收到，周一处理」', next: 'friday_pack', heart: 1, tip: '这句话替你挡掉了整个周末。' },
          { label: '不好意思，我现在改一下', next: 'end_stayback', heart: -1, tip: '周五晚上的一封回复，常常是整个周末。' }
        ]
      },

      friday_pack: {
        emoji: '🎒',
        title: '收电脑前的一分钟',
        text: '手放在鼠标上，右下角显示 17:58。电梯里还挤着三个人，群里有人在问今晚谁留下。',
        choices: [
          { label: '打卡走人，今天到此为止', next: 'end_friday_run', heart: 1, tip: '十七点五十八分离开的人，赢回了整个周末。' },
          { label: '先把手上这个收完再说', next: 'end_stayback', heart: -1, tip: '周五的「五分钟」，常常通向整个周末。' }
        ]
      },

      /* ---- v1.9.0 新支线：电脑蓝屏 ---- */
      blue_screen: {
        emoji: '🖥️',
        title: '下午三点，电脑蓝屏了',
        text: '屏幕一整片蓝，文档还开着，鼠标点不动。旁边的人探过头看了一眼，跟着吸了口气。',
        choices: [
          { label: '先拍张照，再狂按键盘', next: 'blue_ask', heart: 0, tip: '拍下来发给 IT，至少证明不是你自己想出来的。' },
          { label: '直接重启，硬着头皮赌一把', next: 'blue_ask', heart: -1, tip: '重启像掷骰子，紧张，但也可能刚好过。' }
        ]
      },

      blue_ask: {
        emoji: '🛠️',
        title: '工位呼叫 IT',
        text: 'IT 说要等二十分钟，让大家先用备用机。你看着排队等维修的队伍，悄悄松了一口气。',
        choices: [
          { label: '先在备用机上把要紧的做完', next: 'blue_saved', heart: 1, tip: '计划被砸碎的时候，能救一点是一点。' },
          { label: '趁空档去楼下抽根烟冷静一下', next: 'blue_saved', heart: 0, tip: '机器坏了，人也得喘口气。' }
        ]
      },

      blue_saved: {
        emoji: '💾',
        title: '文件救回来了',
        text: 'IT 说再晚十分钟就真没了。你看着那个文档，忽然觉得今天发生的一切都挺像运气。',
        choices: [
          { label: '谢过同事，把今天的活收掉', next: 'end_early', heart: 1, tip: '有人搭把手的感觉，会在记忆里留很久。' },
          { label: '主动留下来帮他们弄完', next: 'end_helper', heart: 1, tip: '帮别人的时候，其实也在帮自己。' }
        ]
      },

      /* ---- v1.9.0 新支线：同事悄悄递来一颗糖 ---- */
      candy_desk: {
        emoji: '🍬',
        title: '同事悄悄递来一颗糖',
        text: '没人说话，那颗糖就出现在你键盘边上，包装纸皱巴巴的，像被人偷偷揣了一上午。',
        choices: [
          { label: '拆开吃了，回一句谢谢', next: 'candy_talk', heart: 1, tip: '一颗糖不贵，但它说明有人在意你今天的状态。' },
          { label: '先记着，等撑不住的时候再拆', next: 'candy_talk', heart: 0, tip: '把糖留到最累的时候，是个好习惯。' }
        ]
      },

      candy_talk: {
        emoji: '🍵',
        title: '去茶水间拿水',
        text: '那位同事正在泡茶，看见你就把手机扣在桌上：「今天又是这种破事？」你差点笑出声。',
        choices: [
          { label: '坐下来吐槽十分钟', next: 'candy_pass', heart: 1, tip: '被理解比被安慰更管用。' },
          { label: '摇摇头，说「还好，先忙吧」', next: 'candy_pass', heart: 0, tip: '不接话不算冷淡，是给彼此留点余地。' }
        ]
      },

      candy_pass: {
        emoji: '🍬',
        title: '你把糖分给了旁边的人',
        text: '你把糖纸叠好，塞进另一个人的抽屉。十分钟后，那个人抬头冲你笑了一下。',
        choices: [
          { label: '继续干活，心里挺暖和', next: 'end_helper', heart: 1, tip: '善意传出去的时候，不需要回执。' },
          { label: '准时打卡，别再想糖的事', next: 'end_early', heart: 1, tip: '今天的好心情，值得带回家。' }
        ]
      },

      /* ---- v1.9.0 新支线：工位被调整 ---- */
      desk_move: {
        emoji: '🪑',
        title: '工位被调到靠窗',
        text: '桌上贴了张便条，位置从中间挪到了最靠边。搬的时候东西掉了一地，同事都装作没看见。',
        choices: [
          { label: '把东西慢慢搬过去', next: 'desk_new', heart: 0, tip: '换个位置，像换一种角度看这一天。' },
          { label: '去找行政问一句为什么', next: 'desk_new', heart: 0, tip: '问清楚不亏，知道了心里才踏实。' }
        ]
      },

      desk_new: {
        emoji: '🪟',
        title: '新工位，隔壁话很少',
        text: '新邻居一整天只说过三句话，其中两句是谢谢。但他每次去接水，都顺手帮你也带一杯。',
        choices: [
          { label: '下次主动问一句「要不要一起」', next: 'desk_agree', heart: 1, tip: '安静的人需要一点邀请，不需要更多。' },
          { label: '点点头，继续忙自己的', next: 'desk_agree', heart: 0, tip: '点头也算一种打招呼。' }
        ]
      },

      desk_agree: {
        emoji: '📎',
        title: '便条背面还有一行',
        text: '你才发现便条背面还有一行小字：「以后有事可以直接来找我」。新工位的好处，要晚上才显出来。',
        choices: [
          { label: '收下这句话，把今天做完', next: 'end_early', heart: 1, tip: '多一个能说话的人，路会宽一点。' },
          { label: '顺手把隔壁落下的文件送过去', next: 'end_helper', heart: 1, tip: '举手之劳，常常是关系开始的地方。' }
        ]
      },

      /* ---- v1.9.0 新支线：下班路上遇到前同事 ---- */
      ex_colleague: {
        emoji: '🛵',
        title: '楼下遇到前同事',
        text: '他穿着冲锋衣推着车，像是刚下班。你们在路边碰上，都愣了一下，谁都没先开口。',
        choices: [
          { label: '停下来说两句', next: 'ex_chat', heart: 1, tip: '很久不见的人，一开口还是有点熟。' },
          { label: '摆摆手，先各走各的', next: 'ex_bye', heart: 0, tip: '不打扰也是一种体面。' }
        ]
      },

      ex_chat: {
        emoji: '☕',
        title: '他说新公司更累',
        text: '「钱多了一点点，人少了两个。」他苦笑着扫码买了咖啡，纸杯上印着一张笑脸。',
        choices: [
          { label: '听他说，等他讲完', next: 'ex_bye', heart: 1, tip: '被认真听过的十分钟，比一杯咖啡值钱。' },
          { label: '聊两句就找借口走', next: 'ex_bye', heart: 0, tip: '寒暄适度的人，社交也轻松。' }
        ]
      },

      ex_bye: {
        emoji: '🚶',
        title: '回家的最后一公里',
        text: '地铁上人挤人，你看着车窗里的自己。今天没发生什么大事，可好像也没那么难熬。',
        choices: [
          { label: '给家里回一句，我下班了', next: 'end_early', heart: 1, tip: '把「我下班了」说出口，一天才算真正结束。' },
          { label: '顺手把前同事推给了一个岗位', next: 'end_helper', heart: 1, tip: '一句推荐，可能刚好是别人等的那句话。' }
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
      },
      end_drift: {
        emoji: '🌗',
        title: '结局 · 绕圈型',
        grade: 'B',
        desc: '这一天你在「要不要先做这个」和「要不要先做那个」之间来回走了很多趟，天黑的时候才发现：其实哪条都行。',
        comfort: '绕路不丢人。下次卡住的时候，随便挑一个走完，比一直站着挑要划算。',
        tip: '先做那件更小、更快能完成的。'
      },
      end_friday_run: {
        emoji: '🏃',
        title: '结局 · 周五跑路型',
        grade: 'S',
        desc: '十七点五十八分，你按下打卡冲进电梯。楼下的风里有烤红薯的味道，你走得特别快。',
        comfort: '你把这一周稳稳地扛完了，晚上是干净的。',
        tip: '走得早的周五，周末才真的属于自己。'
      },
      end_stayback: {
        emoji: '🔒',
        title: '结局 · 被留下型',
        grade: 'B',
        desc: '同事都走了，办公室只剩你和一块亮着的屏幕。那句「你先把这个弄完」，成了今晚的主线。',
        comfort: '被留下不代表做得不好，只是今天的排班这样写。',
        tip: '下次先问一句「大概到几点」，心里就有数。'
      },
      end_helper: {
        emoji: '🫶',
        title: '结局 · 顺手帮人型',
        grade: 'A',
        desc: '你今天没做什么大事，只是顺手帮了几个人：递颗糖、抬个电脑、留一句话。可这栋楼记住你了。',
        comfort: '愿意搭把手的人，走到哪儿都不太会被落下。',
        tip: '别把「顺手」当成负担，它其实是最省力的社交。'
      }
    }
  };

  root.HS_STORY = STORY;
  if (typeof module !== 'undefined' && module.exports) module.exports = STORY;
})(typeof window !== 'undefined' ? window : globalThis);
