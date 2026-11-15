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
或者在一部只有几个按钮的职场生存剧里，看看今天能不能准时下班。

**全部数据只存在你自己的浏览器里**（`localStorage`），不联网、不上传、没有账号、没有埋点。

## 五个模块

| 模块 | 你说 | 它给你 |
| --- | --- | --- |
| 🏥 **情绪急诊室** | 今天是什么状态（累瘫 / 焦虑 / 被委屈 / 生气 / 迷茫 / 社恐 / 低落 / 还不错） | 一张盖了章的诊断单：病历分析、今日处方、值班护士的话 |
| 💬 **社恐话术机** | 你今天遇到了什么场面（老板催 / 被甩锅 / 临时改需求 / 被 @ / 不会拒绝 / 不想加班…） | 16 个场景 × 3 种语气（🙈 怂 · 🧊 稳 · 🎪 浪）× 3 句话 = 144 条可直接复制的话术 |
| 🐟 **摸鱼补给站** | 想假装在工作 | 6 种算法实时合成的环境音（雨 / 咖啡馆 / 地铁 / 空调 / 海浪 / 翻书）、番茄钟、老板键（Esc 一键伪装成会议） |
| 🎲 **今日生存小游戏** | 今天能准时下班吗？ | 40+ 节点 / 6 个结局的分支职场生存剧，带心值和路径回顾 |
| 📈 **疗愈周报** | 这周你被哄了几次？ | 7 天汇总、5 张统计卡、柱状图、高频关键词，一键复制成周报 |

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

深链小抄：`#tab=clinic` / `#tab=talk` / `#tab=fish` / `#tab=game` / `#tab=report`

### 跑测试

```bash
cd healing-station
node tools/selftest.js   # 1115 项：数据完整性 / 引擎 / 页面结构 / 文本卫生
node tools/uitest.js     # 90 项：迷你 DOM + node:vm 无头 UI 冒烟
```

两个脚本都只用 Node 内置能力，**不需要 `npm install`**。

## 部署到 GitHub Pages

仓库已经内置发布工作流：**`.github/workflows/pages.yml`**。

1. 把本仓库推到 GitHub（分支名 `main`）；
2. 仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**；
3. 推上去后 Actions 里会出现 `Deploy to GitHub Pages`，跑完即可访问：
   **https://iphsiibl.github.io/healing-station/**

工作流会自动识别站点文件放在仓库根目录还是 `healing-station/` 子目录，
并且只发布 `index.html` + `assets/`（不带上 `tools/`、`versions/`），体积很小、加载很快。

也可以在 Actions 页面点 **Run workflow** 手动触发一次发布。

## 目录结构

```
healing-station/
├─ index.html                 应用入口（单页，五个模块）
├─ assets/
│  ├─ styles.css              奶油纸 + 柔和光晕视觉体系、夜间模式、响应式
│  └─ js/
│     ├─ data-moods.js        8 种心情 × 诊断 / 成因 / 处方 / 祝福 + 10 个关键词包
│     ├─ data-scenes.js       16 场景 × 3 语气 × 3 条 = 144 条话术
│     ├─ data-story.js        分支故事节点与 6 个结局
│     ├─ engine.js            纯逻辑引擎（诊断 / 话术 / 故事 / 周报汇总）
│     ├─ audio.js             Web Audio 环境音实时合成（零音频文件）
│     └─ app.js               界面渲染与交互
├─ tools/
│  ├─ selftest.js             零依赖自检（1115 项）
│  └─ uitest.js               迷你 DOM 无头 UI 测试（90 项）
└─ versions/                  v1.0.0 / v1.1.0 / v1.2.0 / v1.2.1 / v1.3.0 各版完整快照

.github/workflows/pages.yml   GitHub Pages 自动发布
创作说明.md                   完整创作说明（主题 / 调研 / 流程 / 迭代记录 / 技术踩坑）
```

## 技术选择

- **纯静态、零依赖、零构建**：没有框架、没有打包器、没有后端，`index.html` 双击即用；
- **不用 ES Module**：ES Module 在 `file://` 下会被 CORS 拦截，所以全部走 classic `<script src>` + 全局变量；
- **音效实时合成**：Web Audio 生成噪声与振荡器，不加载任何音频文件，省流量也不怕资源丢失；
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
