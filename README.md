<div align="center">

# 🚑 打工人急救站

**不解决你的问题，只负责哄你开心。**

一个纯前端、零依赖、可离线运行的打工人情绪急救小站。

[![Pages 部署状态](https://github.com/Iphsiibl/healing-station/actions/workflows/pages.yml/badge.svg)](https://github.com/Iphsiibl/healing-station/actions/workflows/pages.yml)
[![无需构建](https://img.shields.io/badge/build-none-63b581)](https://github.com/Iphsiibl/healing-station)
[![零依赖](https://img.shields.io/badge/dependencies-0-blue)](https://github.com/Iphsiibl/healing-station)
[![License: MIT](https://img.shields.io/badge/License-MIT-coral.svg)](LICENSE)

[🌐 在线体验](https://iphsiibl.github.io/healing-station/)　·　[✨ 给它一颗星](https://github.com/Iphsiibl/healing-station/stargazers)　·　[🐛 提个建议](https://github.com/Iphsiibl/healing-station/issues)

</div>

---

## 这是什么

上班很难，但你可以先喘口气。

「打工人急救站」是一个把日常职场烦恼翻译成玩笑和安慰的地方：
发一张诊断单、抄一句能直接发出去的话、放一段雨声假装在工作，
在一部只有几个按钮的职场生存剧里看看今天能不能准时下班（还有一部叫《被裁的那天》），
或者去像素游戏厅摸一把鱼、躲一次老板、把要撤回的消息抢回来。

**全部数据只存在你自己的浏览器里**（`localStorage`），不联网、不上传、没有账号、没有埋点。

## 六个模块

| 模块 | 你说 | 它给你 |
| --- | --- | --- |
| 🏥 **情绪急诊室** | 今天是什么状态（累瘫 / 焦虑 / 被委屈 / 生气 / 迷茫 / 社恐 / 低落 / 还不错 / 被优化 / 被 AI 顶替 / 通勤 / 年纪卡线） | 一张盖了章的诊断单：病历分析、今日处方、值班护士的话，外加一条「🩹 复诊提醒」 |
| 💬 **社恐话术机** | 你今天遇到了什么场面（老板催 / 被甩锅 / 临时改需求 / 被 @ / 不会拒绝 / 裁员通知 / 绩效面谈 / 追年终奖 / 功劳被抢…） | 26 个场景 × 4 种语气（🙈 怂 · 🧊 稳 · 🎪 浪 · 🔥 直球）× 3 句话 = 312 条可直接复制的话术，外加「👍 适合 / 👎 别在」使用提醒 |
| 🐟 **摸鱼补给站** | 想假装在工作 | 10 种算法实时合成的环境音（雨 / 咖啡馆 / 地铁 / 空调 / 海浪 / 翻书 / 雷雨 / 林风 / 列车 / 敲键盘）、番茄钟（25 / 5 / 15 分钟）、老板键（4 份伪装页，Esc 一键切换）、呼吸急救（3 套呼吸法） |
| 🎲 **今日生存小游戏** | 今天能准时下班吗？还是……被裁的那天 | **两部**分支职场生存剧（60 节点 / 10 结局 + 20 节点 / 4 结局），带心值（底气）与路径回顾 |
| 🎮 **摸鱼游戏厅** | 想摸鱼，但手得动 | 5 款自制像素小游戏：🐹 摸鱼地鼠 · 🏃 老板巡视 · 🧩 工位三消 · 🎣 摸鱼钓鱼 · 💬 撤回消息，320×288 手绘像素场景，可 iframe 单独嵌入；每天还有一件「三分钟彩蛋」 |
| 📈 **疗愈周报** | 这周你被哄了几次？ | 周 / 月切换、连续天数（断签不扣分，随时重新开始）、8 张统计卡、柱状图、30 天热力日历、6 枚成就徽章、高频关键词、3 种可复制的分享文案 |

还有一个小细节：下次打开，站点还记得你上次的心情。

## 快速开始

### 直接打开（最省事）

下载或克隆本仓库，打开 `healing-station/index.html` 就能用。
无需安装、无需构建、无需服务器，断网也能玩。

### 本地跑一个服务器（想用深链分享时）

```bash
cd healing-station
python -m http.server 8000
# 然后访问 http://localhost:8000/index.html#tab=fish
```

深链小抄：`#tab=clinic` / `#tab=talk` / `#tab=fish` / `#tab=game` / `#tab=games` / `#tab=report`

### 单独玩小游戏

主应用里的「🎮 摸鱼游戏厅」之外，每款游戏都有独立可嵌入页：

```
https://iphsiibl.github.io/healing-station/games/index.html?game=mole
```

`game` 可选 `mole`（摸鱼地鼠）、`dodge`（老板巡视）、`match3`（工位三消）、`fish`（摸鱼钓鱼）、`recall`（撤回消息）。
不写 `?game=` 会显示游戏厅菜单。嵌进你自己的页面：

```html
<iframe src="https://iphsiibl.github.io/healing-station/games/index.html?game=fish" width="480" height="560"></iframe>
```

### 跑测试

```bash
cd healing-station
node tools/selftest.js   # 3186 项：数据完整性 / 引擎 / 页面结构 / 文本卫生 / 剧目与彩蛋 / 周报与徽章
node tools/uitest.js     # 149 项：迷你 DOM + node:vm 无头 UI 冒烟（含音频与游戏）
node tools/gametest.js   # 127 项：像素内核 / 五款游戏的沙盒自检
node tools/spritecheck.js # 52 项：点阵素材自检
node tools/audit.js      # 内容审查报告：条目数 / 近重复 / 跨模块重复 / 结局可达性 / 全站文案卫生
```

这些脚本都只用 Node 内置能力，**不需要 `npm install`**。

## 部署到 GitHub Pages

仓库已经内置发布工作流：**`.github/workflows/pages.yml`**。

1. 把本仓库推到 GitHub（分支名 `main`）；
2. 仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**；
3. 推上去后 Actions 里会出现 `Deploy to GitHub Pages`，跑完即可访问：
   **https://iphsiibl.github.io/healing-station/**

工作流会自动识别站点文件放在仓库根目录还是 `healing-station/` 子目录，
并且只发布 `index.html` + `assets/` + `games/`（不带上 `tools/`、`versions/`），体积很小、加载很快。

也可以在 Actions 页面点 **Run workflow** 手动触发一次发布。

## 目录结构

```
healing-station/
├─ index.html                 应用入口（单页，六个模块）
├─ assets/
│  ├─ styles.css              奶油纸 + 柔和光晕视觉体系、夜间模式、响应式
│  └─ js/
│     ├─ data-moods.js        12 种心情 × 诊断 / 成因 / 处方 / 祝福 / 复诊提醒 + 18 个关键词包
│     ├─ data-scenes.js       26 场景 × 4 语气 × 3 条 = 312 条话术 + 每场景使用提醒
│     ├─ data-story.js        主篇分支故事（60 节点 / 10 结局）
│     ├─ data-story2.js       第二短篇《被裁的那天》（20 节点 / 4 结局）
│     ├─ data-challenges.js   每日彩蛋 12 条
│     ├─ data-breath.js       3 套呼吸引导（箱式 / 4-7-8 / 平衡）
│     ├─ data-boss.js         4 份老板键伪装页
│     ├─ data-badges.js       6 枚成就徽章（解锁条件 + 一句祝贺）
│     ├─ engine.js            纯逻辑引擎（诊断 / 话术 / 故事 / 呼吸 / 伪装页 / 彩蛋 / 周报 / 连续天数 / 热力日历 / 徽章 / 分享模板）
│     ├─ audio.js             Web Audio 环境音实时合成（10 种，零音频文件）
│     └─ app.js               界面渲染与交互
├─ games/                     像素摸鱼游戏厅（可独立嵌入）
│  ├─ index.html              独立嵌入页（?game=mole / dodge / match3 / fish / recall）
│  ├─ pixel.js                像素内核（调色板 / 原语 / 位图字体 / 音效 / 舞台）
│  ├─ sprites.js              点阵素材库与办公室场景
│  ├─ game-mole.js            🐹 摸鱼地鼠
│  ├─ game-dodge.js           🏃 老板巡视
│  ├─ game-match3.js          🧩 工位三消
│  ├─ game-fish.js            🎣 摸鱼钓鱼
│  ├─ game-recall.js          💬 撤回消息
│  ├─ hall.js                 游戏厅（卡片菜单 / 舞台 / 结算 / 中文提示行）
│  └─ games.css               大厅与舞台样式
├─ tools/
│  ├─ selftest.js             零依赖自检（3186 项）
│  ├─ uitest.js               迷你 DOM 无头 UI 测试（149 项）
│  ├─ gametest.js             游戏内核与五款游戏沙盒自检（127 项）
│  ├─ spritecheck.js          点阵素材自检（行宽 / 调色板 / 尺寸）
│  ├─ audit.js                内容审查工具（条目数 / 近重复 / 跨模块重复 / 可达性 / 全站卫生）
│  ├─ gameshot.js             离线像素渲染器（node:zlib 手写 PNG，出图秒级）
│  └─ spriteshot.js           素材总览图（一次看全部点阵画）
└─ versions/                  v1.0.0 … v1.10.0 各版完整快照

.github/workflows/pages.yml   GitHub Pages 自动发布
research/                     调研与方案文档（像素游戏报告 / 计划 + 每轮迭代的调研与审查记录）
创作说明.md                   完整创作说明（主题 / 调研 / 流程 / 迭代记录 / 技术踩坑）
```

## 技术选择

- **纯静态、零依赖、零构建**：没有框架、没有打包器、没有后端，`index.html` 双击即用；
- **不用 ES Module**：ES Module 在 `file://` 下会被 CORS 拦截，所以全部走 classic `<script src>` + 全局变量；
- **音效实时合成**：Web Audio 生成噪声与振荡器，不加载任何音频文件，省流量也不怕资源丢失；
- **像素游戏也自研内核**：低分辨率画布 + 整数倍放大（`imageSmoothingEnabled=false`）保证像素边缘不糊；时间戳算 dt 并夹紧，避开后台标签页 rAF 暂停导致的物理炸飞；
- **自建测试环境**：`jsdom` 装不上（网络受限），于是用 Node 内置 `node:vm` + 手写迷你 DOM 做无头 UI 测试；
- **无障碍**：语义化标签、`aria-*` 状态同步、`:focus-visible` 键盘描边、跳转到主内容链接。

## 迭代记录

| 版本 | 做了什么 |
| --- | --- |
| v1.0.0 | 骨架跑通：情绪急诊室 + 社恐话术机，四层架构与零依赖自检 |
| v1.1.0 | 摸鱼补给站 + 今日生存小游戏 + `#tab=xxx` 深链 |
| v1.2.0 | 疗愈周报、记住上次心情、疗愈指数直达周报、无障碍细节 |
| v1.2.1 | 修掉摸鱼补给站按钮不响的根因（`new` 返回构造器导致 AudioContext 取到类），并把播放链路纳入自动化回归 |
| v1.3.0 | GitHub Pages 自动发布工作流 + 页面上的 GitHub 标识与仓库地址；并修掉 `hidden` 属性被 `display:flex` 覆盖导致的空白横条 |
| v1.4.0 | 像素摸鱼游戏厅：调研 → 方案 → 执行计划留档，自研像素内核与 4 款小游戏，接入主应用新 tab 与周报统计 |
| v1.4.1 | 画风打磨（墙纸 / 海报 / 桌沿小物 / HUD 对比度）、修掉独立嵌入页 `hidden` 被覆盖、测试扩到 99+111 项 |
| v1.5.0 | **画布翻倍重画**：160×144 → 320×288，56 色调色板 + 渐变/斜面/投影原语，四款游戏全部按 2 倍素材重做场景；新增离线像素渲染器与素材自检 |
| v1.5.1 | 打磨收尾：游戏大厅加中文提示行、画布加外框投影、办公室补地毯/椅子/监控眼，测试断言同步更新 |
| v1.6.0 | **内容扩充第一轮**：急诊室扩容（12 心情 / 18 关键词包 / 114 条祝福 / 复诊提醒），新增内容审查工具 `tools/audit.js`，故事加步数上限兜底结局 |
| v1.7.0 | **内容扩充第二轮**：社恐话术机扩容（26 场景 / 4 语气 / 312 条话术），每场景加「👍 适合 / 👎 别在」使用提醒 |
| v1.8.0 | **内容扩充第三轮**：摸鱼补给站扩容（10 种合成环境音 / 4 份老板键伪装页 / 番茄钟 15 分钟档 / 3 套呼吸引导），周报统计卡增到 7 张 |
| v1.9.0 | **内容扩充第四轮**：生存故事扩容（主篇 60 节点 / 10 结局）+ 第二短篇《被裁的那天》（20 节点 / 4 结局）+ 每日彩蛋 12 条 + 第 5 款像素游戏《撤回消息》，周报统计卡增到 8 张 |
| v1.10.0 | **内容扩充第五轮**：疗愈周报扩容（周/月切换 + 连续天数 + 30 天热力日历 + 6 枚徽章 + 3 种分享模板）+ 全站终审（跨模块重复检测、窄屏修正、文案一致性），五轮收官 |

## 隐私

- 所有记录只写入浏览器的 `localStorage`（键名 `healing-station:v1`）；
- 不联网、不上传、不申请任何权限、不加载第三方脚本或字体；
- 页脚提供「清空我的本地记录」，一键删除。

## 致谢与许可

- 灵感来自知乎热榜里那些真实的职场烦恼（失业断供、LLM 岗位替代焦虑、周报难写……）；
- 界面用奶油纸与柔和光晕，希望你在打开它的三秒钟里能松一口气。

代码以 MIT 协议开源，见 [LICENSE](LICENSE)。

<div align="center">
  <sub>Made with 🫶 by <a href="https://github.com/Iphsiibl">Iphsiibl</a> · <a href="https://github.com/Iphsiibl/healing-station">Iphsiibl/healing-station</a></sub>
</div>
