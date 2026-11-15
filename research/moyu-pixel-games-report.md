# 「打工人摸鱼」像素风 HTML5 迷你小游戏合集 — 调研报告

（结论均来自下方来源清单中「实测」条目；标「推测」者为未取到一手证据的推断）

## 1. 候选玩法清单（16 个，均为网页/手游已商业化的品类）

格式：玩法｜核心操作｜单局时长｜嵌入适配｜商业实现（渠道/实例）

1. 打地鼠式戳头（Knife Rain 型）｜点/戳｜20–60 秒｜极适合（纯点击、零手势）｜famobi Arcade「Knife Rain」、CrazyGames 打地鼠类
2. 2048 合成（Jelly Run 2048）｜滑动/方向键｜2–5 分钟｜中（窄栏滑动与页面滚动冲突；桌面需键盘）｜famobi 实测、微信小游戏
3. 三消（Fruit Party）｜点选交换｜1–3 分钟｜适合｜famobi Arcade 实测、微信小游戏
4. 切水果/接水果（Katana Fruits、Bananamania）｜挥砍/拖拽｜30–60 秒｜适合｜famobi Arcade 实测两例
5. 扫雷｜左键翻开/右键插旗/长按｜1–3 分钟｜桌面优（手机长按易误触）｜推测（Poki 页面 JS 渲染未取到实例）
6. 贪吃蛇｜方向键/滑动｜1–3 分钟｜桌面优｜推测
7. 打砖块/接落物｜拖挡板｜1–2 分钟｜适合｜推测（famobi「Don't Crash」「2Cars」为同类）
8. 弹幕躲避/点目标（Fast Circles、Go Around）｜拖动/点击｜30–60 秒｜极适合｜famobi Arcade 实测
9. 钓鱼｜点按 + 收线时机｜1–3 分钟｜适合｜iTunes「摸鱼：一方小池塘」；HTML5 实例推测
10. 翻牌记忆｜点翻两张｜30–60 秒｜极适合｜推测
11. 拉栓/堆叠消除（Pull Pins、Peet a Lock、Stack Smash、Tower Fall、Extreme Kitten）｜拖/点｜1–2 分钟｜极适合｜famobi Arcade 实测 5 例
12. 贪吃金币/挖矿点击（Gold Mine）｜点击｜30–60 秒｜极适合｜famobi Arcade 实测
13. 点击养宠/陪伴｜点击喂食｜长线（可碎片化）｜适合做陪伴层｜iTunes「牛马计时器·宠物乐园」「摸鱼：一方小池塘」实测
14. 节奏点击（Timberman、Perfect Piano）｜按节拍点击｜30–60 秒｜适合｜famobi Arcade 实测
15. 合并升职（落物拼图+职级合并）｜拖放合并｜1–2 分钟｜适合｜iTunes「社畜パズル 顔で出世マージ」实测；网页站实例推测
16. 抽卡扭蛋收集（社畜梗图）｜点击抽卡｜30 秒/次｜极适合｜iTunes「社畜あるあるガチャ」实测

不推荐做主线：放置点击/放置经营——无固定单局，与「1 分钟一局」冲突（iTunes 侧多为重度模拟经营，如《天选打工人》《搬砖之王》）。

## 2. 摸鱼/办公室题材已有做法（App Store 中国区 API 实测）

- 操作对象高度集中在五类：同事/老板、报表/待办、群消息、咖啡/小物件、宠物。
  - 《摸鱼-实时薪资计算器》（3.92★/13）：可点击对象=摸鱼池小游戏 + 可瞬时伪装的「BI 监控大屏/枯燥办公文档」（双指划动触发）+ 下班清算战报（基础出勤、带薪摸鱼补贴、情绪磨损费，薪资打码）。
  - 《牛马计时器-上班摸鱼助手》（4.81★/114）：宠物乐园（工作宠物/摸鱼宠物/昼夜天气）、待办、收支图表。
  - 《打工人小组件》（4.89★/3446，多次被 App Store 编辑推荐）：下班倒计时、周五/周历、「时间绿块」视觉。
  - 《打工生活模拟器》（4.63★/57981）：都市设施点击 + 人生节点分支；《荣誉打工人》（4.47★/74423）：与时间赛跑、结识「打工搭子」。
  - 《董事长模拟器》（4.92★/17955）、《搬砖之王-猫咪打工经营模拟器》（4.84★/198700）：招募打工人、升级办公设备＝收集养成。
  - 《梦幻奶茶屋》（4.80★/18109）：原料卡牌排序（叠叠乐式解谜）+ 收集卡牌。
  - 日语同类：「ホウレンソウ」三键时机判断刷评价涨年薪（上司を見返せ！社畜育成ゲーム）、社畜扭蛋、职级脸块合并升职。
- 反馈点三件套反复出现：①爽感（连击/割草）②伪装感（老板键、查岗瞬变装）③收集感（摸鱼折算人民币、宠物/卡牌/工位升级）。
- 商业启示：商店里「摸鱼」多作营销后缀（《坦克大决战-摸鱼版》4.82★/17830、《梦幻奶茶屋-摸鱼解谜叠叠乐》）；真正以摸鱼为核心玩法、且评分低劣者存在（《上班摸鱼模拟器》3.35★/17）——题材不等于品质。而网页小游戏站的通用卖点正是「5 分钟一局」（CrazyGames「5-minute fun：Quick games made for your next break」）。→ 我们的差异化应是「办公室皮肤 + 老板压测机制」，而不是再做一个通用 2048。

## 3. 像素风网页游戏的技术与美术要点（MDN 文档为一手来源）

- 低分辨率画布 + 整数放大：内部分辨率 96×64 或 160×120，CSS 拉伸；元素加 `image-rendering: pixelated`（Baseline，2020-01 起广泛可用；pixelated=整数倍最近邻放大后再平滑，crisp-edges=纯最近邻锐边）。
- 关键坑：CSS 的 image-rendering 不影响 canvas 内部 drawImage 的缩放，必须设 `ctx.imageSmoothingEnabled = false`（Baseline 2017-04；MDN 明示「对像素画类游戏有用」，否则放大发糊）。
- 高 DPI：canvas.width = 布局宽 × devicePixelRatio，ctx.scale(dpr,dpr) 后仍按 CSS 像素作画；或用小 canvas + CSS transform 放大（GPU，最快）。dpr 变化用 matchMedia('(resolution: Xdppx)') 监听。
- 性能：坐标一律 Math.floor 取整（避免子像素抗锯齿）；重复图形预渲染到离屏 canvas；静态背景用 CSS background 而非每帧重画；复杂场景拆成背景/主体/UI 多层 canvas；不要在 drawImage 里缩放图片、预先缓存各尺寸；不需要透明时 getContext('2d',{alpha:false})。
- 移动端：容器设 touch-action: none / manipulation（Baseline 2019-09），用 Pointer Events 并处理 pointercancel；用 pointerdown 而非 click；注意 touch-action:none 会禁掉双指缩放（MDN 的 a11y 提示）。
- 调色板：Sweetie 16（GrafxKid，16 色，69,335 次下载）= #1a1c2c #5d275d #b13e53 #ef7d57 #ffcd75 #a7f070 #38b764 #257179 #29366f #3b5dc9 #41a6f6 #73eff7 #f4f4f4 #94b0c2 #566c86 #333c57——暖橙红 + 柔和绿 + 冷蓝灰 + 米白，正对「奶油纸/柔和光晕」口味；用 Lospec 的 dither 图案生成器做两色过渡。若要「典型像素色」（PICO-8 / Game Boy）需另取色值（推测，本轮未取）。
- 代码生成精灵：字符画（每字符=1 像素 + 调色板映射）解析成 ImageData/离屏 canvas。优点零资源、体积小、可换色换表情（同事/老板几十种表情）；坑是手写字符串易错难维护、逐帧生成浪费，必须工具化生成并缓存成离屏图再 drawImage。
- 字体两条路线：①内置 5×7/3×5 bitmap font（字符画 → 逐像素 fillRect 或预渲染 atlas）：完全可控、零字体文件、零网络请求；代价是中文需自绘 12–16 常用字字模（推测：工作量集中在此）。②canvas fillText + 像素 webfont：Press Start 2P 可通过 Google Fonts CSS2 取到 @font-face（实测），但需 base64 内嵌才满足「零依赖/离线」，且浏览器对文字做抗锯齿、非整数像素会发糊（推测）。

## 4. 推荐 4 款

1. 《摸鱼打地鼠》Slacker Mole — 工位上不断探头的「待办/同事/报表」要你点掉，老板靠近时探头更密。操作：纯点击（鼠标/触屏）。胜出：一眼就懂、点击即玩，「戳掉报表」的爽感直接对应题材，美术/逻辑成本最低。难度：低。雷区：难度曲线与老板节奏没调好会退化成纯手速测试，缺少「伪装」层叙事。
2. 《加薪合成 2048》Pay Raise 2048 — 把工资/职级数字两两合并，终点是合成「加薪」「老板」。操作：滑动或方向键。胜出：2048 是被反复验证的高传播玩法，终点即「升职加薪」的收集感。难度：中。雷区：极易沦为贴皮；窄栏/手机滑动与页面滚动冲突（需 touch-action 处理）；5 分钟一局会与「摸鱼=放松」相冲。
3. 《社畜扭蛋机》Shachi Shachi — 点一下扭蛋抽出同事梗图/工位道具，收集成图鉴。操作：点击。胜出：可复用同一套像素角色库（同事/老板/咖啡/猫），收集感强、成本低。难度：低。雷区：内容很快被抽空，需要稀有度 + 保底 + 每日限定维持新鲜度。
4. 《群消息闪避》Group Chat Dodge — 老板视线扫来时群消息/报表像弹幕落下，要点掉或伪装成工作界面。操作：点按/滑动切换。胜出：四个候选里唯一能承载「伪装感」的玩法，直击「查岗瞬变装」这一查证到的核心反馈点。难度：中。雷区：老板 AI 节奏与判定反馈不清时，玩家会认为是随机掉帧或误触。

若只能做 3 款，建议砍掉《加薪合成 2048》（题材贴皮 + 手势冲突）。

## 5. 来源清单（URL / 状态）

1. iTunes 中国区搜索 API：摸鱼 — https://itunes.apple.com/search?term=摸鱼&country=cn&entity=software&limit=25 — 实测可访问
2. iTunes 中国区搜索 API：打工人 — https://itunes.apple.com/search?term=打工人&country=cn&entity=software&limit=25 — 实测可访问
3. Sweetie 16 Palette（Lospec） — https://lospec.com/palette-list/sweetie-16 — 实测（16 色、色值、69,335 下载数）
4. Lospec 调色板库 — https://lospec.com/palette-list — 实测（4,548 个调色板、dither 工具）
5. MDN image-rendering — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/image-rendering — 实测
6. MDN Canvas imageSmoothingEnabled — https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/imageSmoothingEnabled — 实测
7. MDN Optimizing canvas — https://developer.mozilla.org/en-US/docs/Web/HTML/Canvas/Tutorial/Optimizing_canvas — 实测
8. MDN devicePixelRatio — https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio — 实测
9. MDN touch-action — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action — 实测
10. HTML5 Games（famobi）首页 — https://html5games.com/ — 实测（「HTML5 games for your website」；Publishers 授权嵌入 / Developers 投稿）
11. famobi Arcade 分类页 — https://html5games.com/Arcade/ecfe76c8-13f9-49c1-b81a-084011512dba — 实测（真实游戏名清单）
12. CrazyGames「5-minute fun」标签页 — https://www.crazygames.com/t/5-minute-fun — 实测（定位文案；列表为 JS 渲染，标题级证据）
13. Google Fonts：Press Start 2P @font-face — https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap — 实测
14. 微信小游戏开发文档 — https://developers.weixin.qq.com/minigame/dev/guide/ — 实测
15. Poki（中文站） — https://poki.com/zh — 部分可达：站点可访问但页面 JS 渲染，具体游戏页未取到 → 其上「扫雷/贪吃蛇」实例按推测标注

尝试但本环境不可访问（故未采信）：itch.io、play.google.com、duckduckgo、百度、sogou、bilibili、yandex（验证码或超时）。
