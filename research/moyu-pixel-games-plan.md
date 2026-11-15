# 摸鱼像素小游戏 · 方案与执行计划

> 配套文件：`research/moyu-pixel-games-report.md`（调研报告，2026-11-16）
> 归属项目：《打工人急救站》v1.4.0 · 模块六「摸鱼游戏厅」

---

## 一、调研结论 → 我们的取舍

调研报告列了 16 个「网页/手游已商业化」的品类，并给了 4 款推荐。
我们**不完全照抄推荐名单**，而是按「一局一分钟 + 办公室皮肤 + 老板压测」三条原则重新排：

| 调研推荐 | 我们的处理 | 理由 |
| --- | --- | --- |
| 《摸鱼打地鼠》 | ✅ 做成 **《摸鱼地鼠》**（第 1 款） | 零手势、点击即玩，是整包地基 |
| 《群消息闪避》 | ✅ 做成 **《老板巡视》**（第 2 款） | 唯一能承载「伪装感 / 查岗」反馈点的玩法 |
| 《加薪合成 2048》 | ⚠️ 降级为**备选** | 报告自己提示：易沦为贴皮，且滑动与页面滚动冲突 |
| 《社畜扭蛋机》 | 🔁 挪到 **v1.4.1 迭代**（第 5 款） | 收集感强，但要先把 4 款基本功跑顺 |
| 《工位三消》（报告候选 #3） | ✅ 做成 **《工位三消》**（第 3 款） | 点选交换、无滑动，手机友好；办公物件皮肤 |
| 《摸鱼钓鱼》（报告候选 #9） | ✅ 做成 **《摸鱼钓鱼》**（第 4 款） | 「点一下 → 等 → 惊喜」的治愈循环，正好当摸鱼补给 |

**一句话结论**：做 4 款**玩法互不重复**的像素小游戏——点击反应（地鼠）、躲避弹幕（巡视）、
交换消除（三消）、点击收集（钓鱼）。每款都套「办公室皮肤」，每款都有一个「老板」在给你加压。

---

## 二、方案

### 2.1 技术方案（零依赖是硬约束）

| 决策 | 选择 | 理由 |
| --- | --- | --- |
| 渲染 | `<canvas>` 2D，内部分辨率 **160×144** | 低分辨率是像素风的地基；MDN 明确 `image-rendering` 管不到 canvas 内部缩放，必须 `ctx.imageSmoothingEnabled = false` |
| 放大 | CSS `image-rendering: pixelated` + **整数倍**缩放（3×/4×） | 调研报告 §3 的关键提示；整数倍才能保住硬边 |
| 脚本形态 | classic `<script src>`，全局 `window.HS_GAMES` | ES Module 在 `file://` 下被 CORS 拦，双击打不开就等于没做 |
| 美术 | 全部由代码画：点阵精灵（字符画 + 调色板）+ 绘图原语 | 零图片文件、零字体文件、零网络请求；换色只改调色板 |
| 字体 | 自绘 **5×7 bitmap 字体**，只做数字与大写字母 | 调研报告结论：中文 bitmap 字模是纯自绘成本，正文交给系统字体 |
| 音频 | Web Audio 实时合成方波/三角波（9 种音效） | 与《摸鱼补给站》同一套思路，零音频文件 |
| 循环 | `requestAnimationFrame` + **dt 夹在 0.05s** | 调研报告 §3：后台标签页 rAF 会暂停，切回来 dt 巨大会炸飞物理 |
| 输入 | Pointer Events 为主，mouse/touch 兜底；`touch-action: none` | 调研报告 §3；canvas 游戏必备 |
| 存档 | `localStorage`（`healing-station:games`） | 最高分只存本地，延续全站「数据不上传」的原则 |

### 2.2 模块结构

```
healing-station/games/
├── pixel.js          像素内核：调色板 / 绘图原语 / bitmap 字体 / 音效 / Stage 舞台
├── sprites.js        点阵素材：老板、员工、猫、咖啡、甜甜圈、鱼、仙人掌、显示器、盆栽
├── game-mole.js      《摸鱼地鼠》  点击反应
├── game-dodge.js     《老板巡视》  躲避弹幕
├── game-match3.js    《工位三消》  交换消除
├── game-fish.js      《摸鱼钓鱼》  点击收集
├── game-gacha.js     《社畜扭蛋》  v1.4.1 迭代新增
├── hall.js           游戏厅：卡片菜单 / HUD / 结算 / 最高分
├── games.css         游戏厅样式（主应用与独立页共用）
└── index.html        ★ 独立可嵌入页：?game=mole 直接开那一款
```

**统一游戏接口**（`pixel.js` 的 `Stage`）：

```js
HS_GAMES.register({
  id: 'mole', title: '摸鱼地鼠', tagline: '…', howto: '…', emoji: '🐹',
  accent: '#f0837a', width: 160, height: 144,
  create: function (api) {
    return {
      update: function (dt, t) {},          // dt 秒（已夹 0~0.05），t 累计秒
      draw:   function (ctx, api) {},
      pointer: function (type, x, y, e) {},  // type: down/move/up，x/y 为逻辑像素
      key:    function (key, e) {},
      keyup:  function (key) {},
      destroy:function () {}
    };
  }
});
```

`api` 提供：`W/H/ctx/PAL/rand/randInt/chance/pick/shuffle/time/addScore/getScore/isOver/end(summary)/
sfx(name)/px/rect/frame/hline/vline/line/circle/ellipse/tri/roundRect/checker/text/textWidth/kick/puff/
updateParticles/drawParticles/state(v)`。

### 2.3 四款游戏的玩法与雷区

| 游戏 | 玩法 | 单局 | 老板压力 | 雷区与对策 |
| --- | --- | --- | --- | --- |
| 🐹 摸鱼地鼠 | 同事/猫从桌洞探头，点它得分，连击加成 | 60 秒 | 老板头顶聚光灯扫过时不能下手 | 纯手速会无聊 → 用「聚光灯」加一层判断 |
| 🏃 老板巡视 | 跟着鼠标/方向键跑，躲任务文件，接咖啡和小铃铛 | 60 秒 | 老板盯着你，任务越掉越快 | 判定反馈不清 → 命中给震屏 + 掉心提示 |
| 🧩 工位三消 | 交换相邻办公物件，三连消除，连锁倍率 | 30 步 | 步数在走 | 无解卡死 → 自动洗牌一次 |
| 🎣 摸鱼钓鱼 | 点水面抛竿，等鱼，稀有度三档 | 耐心值 10 点 | 耐心值会掉 | 干等无聊 → 加「鱼潮」时段 + 连击倍率 |

### 2.4 嵌入方案（用户明确要求「可嵌入」）

1. **主应用内嵌**：新增第 6 个 tab「🎮 摸鱼游戏厅」，`#panel-games` 里挂 `#gameHall`。
2. **独立页嵌入**：`games/index.html?game=mole` 任何人一句
   `<iframe src="…/games/index.html?game=mole">` 就能嵌进自己的站点。
3. **深链**：`#tab=games` 直达游戏厅；`?game=xxx` 直达单款。
4. 嵌入页同样零依赖、离线可用。

---

## 三、执行计划

| 阶段 | 任务 | 产出 | 验收 |
| --- | --- | --- | --- |
| P0 调研 | 玩法品类 / 题材现状 / 技术要点 | `research/moyu-pixel-games-report.md` | 有一手来源清单，标明实测与推测 |
| P1 方案 | 取舍 / 技术选型 / 模块结构 / 玩法表 | 本文件 | 与调研推荐逐条对照 |
| P2 内核 | 像素内核 + 素材库 | `pixel.js`、`sprites.js` | `node --check` 通过；可注册并跑帧不报错 |
| P3 游戏 | 4 款游戏 | `game-*.js` ×4 | 每款能 update/draw/pointer 不抛异常 |
| P4 大厅 | 卡片菜单 / HUD / 结算 / 最高分 / 独立嵌入页 | `hall.js`、`games.css`、`games/index.html` | 独立页 `?game=xxx` 能直接开玩 |
| P5 接入 | 主应用新 tab + 周报统计（新增「游戏」计数） | `index.html`、`app.js`、`engine.js` | `#tab=games` 深链可用；周报出现游戏统计卡 |
| P6 测试 | 扩展零依赖自检 + headless Edge 截图 | `tools/selftest.js`、`tools/uitest.js` | 全绿；截图确认画风与布局 |
| P7 迭代 1 | v1.4.0 快照 + 文档 | `versions/v1.4.0/`、`创作说明.md` | 快照与线上文件一致 |
| P8 迭代 2 | 加《社畜扭蛋机》第 5 款 + 打磨（手感/文案/嵌入页） | `game-gacha.js`、`versions/v1.4.1/` | 第二轮测试全绿 |

### 风险清单

- **rAF 被后台暂停** → dt 夹 0.05（已在 Stage 实现）。
- **canvas 放大发糊** → `imageSmoothingEnabled=false` + CSS `pixelated` + 整数倍缩放。
- **手机端滑动与页面滚动打架** → 主操作全部是「点」，滑动只用于躲避游戏，且画布 `touch-action:none`。
- **中文没法用像素字体** → 画布内只画数字/大写字母，中文放 HTML 层。
- **迷你 DOM 测试环境没有 canvas** → 测试里给 `getContext('2d')` 造一个只记录调用的假对象。
- **游戏跑起来掉帧** → 背景每帧重画是 160×144=2.3 万像素，浏览器完全吃得下；粒子上限由游戏自己控制。

---

## 四、验收口径（Definition of Done）

1. 四款游戏都能「打开即玩」，鼠标 / 触摸 / 键盘至少各有一种可用操作。
2. 独立嵌入页 `games/index.html?game=<id>` 可直接嵌到任意网页。
3. 主应用「摸鱼游戏厅」tab 可用，深链 `#tab=games` 可直达。
4. 最高分、周报游戏次数只写 localStorage，不发任何网络请求。
5. 零外部依赖：无图片、字体、音频文件，无 npm 包，无 CDN。
6. 零依赖自检全绿；headless Edge 截图人工复核画风。
7. 两轮迭代快照（v1.4.0 / v1.4.1）入库。
