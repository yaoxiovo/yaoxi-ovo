# yaoxi.wiki · WebGL 物理光追引擎 — 图层隔离与接入规范

> 交付物 ①：现有 HTML/CSS 适配图层隔离规范（对应交付物 ② GLSL 源码、③ 调度脚本，见本目录文件）

## 1. 总览：不破坏现有 DOM 的接入方式

整个引擎的 DOM 变更**只有一处**：由 `background.js` 在运行时向 `<body>` **prepend** 一个固定底层画布。正文结构（Hero Carousel、卡片列表、导航、Footer）零改动。

```
┌─────────────────────────────────────────────────┐
│  .tencent-nav / .hero-carousel / .news-card …   │  z-index: auto/1（正文，不变）
├─────────────────────────────────────────────────┤
│  body::before 渐变背景层           z-index: -1   │  rtx-active 后 opacity:0（撤下）
├─────────────────────────────────────────────────┤
│  #rtx-canvas（WebGL 全屏）          z-index: -1   │  JS prepend，位于 ::before 之上
├─────────────────────────────────────────────────┤
│  body 背景色                                       │
└─────────────────────────────────────────────────┘
```

关键点：

- `body` 已有 `isolation: isolate`，形成独立层叠上下文；`z-index:-1` 的子元素会绘制在正文内容之下、`body` 背景之上，天然处于"最底层可见层"。
- canvas 与 `body::before` 同为 `z-index:-1`，DOM 顺序决定绘制次序：canvas 作为首个子元素在伪元素 `::before` 之后，绘制在其**上方**。引擎就绪后（`html.rtx-active`）把 `body::before` 淡出，背景完全交给 WebGL。
- **画布固定不滚动**（`position:fixed`），滚动位移只以**一个标量 Uniform `uScrollY`** 传入，视差与折射全部在 Shader 内并行解算 —— DOM 侧零滚动耦合。
- `pointer-events:none` 保证不拦截任何交互。

## 2. 接入步骤（已在仓库完成集成）

### 2.1 源 HTML（已接入 index.html）

在 `<head>`（style.css 之后）与 `</body>` 前（main.js 之后）引入：

```html
<link rel="stylesheet" href="webgl/rtx.css?v=10-perf-max">
...
<script src="webgl/background.js?v=10-perf-max"></script>
```

构建时（`npm run build`）自动处理：`rtx.css` 与 `style.css` **合并内联**为单个 `<style>`（保持"零 CSS 请求、零 FOUC"），`background.js` 压缩加 hash 产出 `dist/webgl/background.min.js?v=...` 并重写引用；着色器源码已内嵌于 JS，**零额外请求**。

> 引擎只做**增强**。未开启/加载失败/WebGL2 不支持时，页面保持原静态背景与卡片样式（`html.rtx-fallback`），无 FOUC、无降级闪烁。

### 2.2 可选运行参数

`background.js` 读取 `window.__yaoxiRTG.config`（可在脚本前注入）：

```html
<script>
window.__yaoxiRTG = {
  config: {
    shaderPath: { vert: "/webgl/background.vert", frag: "/webgl/background.frag" }, // 可选：开发期覆盖内嵌着色器
    cardSelector: ".news-card, .slide-text", // 参与光路的玻璃面（≤8）
    marchSteps: 64                            // 晴天体积光步数
  }
};
</script>
```

> 生产默认**不配置** `shaderPath`：着色器源码已内嵌于 `background.js`，单文件加载、PWA 离线可用、无 fetch 时序失败面。仅当需要热调着色器时才指向源文件走 fetch 覆盖。

### 2.3 PWA / Service Worker（已接入）

`sw.js` 已将 `"/webgl/background.min.js?v=10-perf-max"` 加入 `SHELL_CACHE` 预缓存清单（`CACHE_NAME` 提升为 `yaoxi-home-v11-rtx`），构建时自动改写为带 hash 的实际文件名；`rtx.css` 已内联进 HTML，无需单独缓存。

## 3. 视图层级解耦约定

| 数据 | 传输通道 | 说明 |
| --- | --- | --- |
| 垂直滚动位移 | 标量 Uniform `uScrollY`（设备像素） | `scroll` 事件 rAF 节流后写入，Shader 内乘视差系数做大气偏移 |
| 卡片几何（≤8 张） | `vec4 uCards[8]` + `int uCardCount` | `getBoundingClientRect()` × DPR，滚动/缩放/图片加载后重同步 |
| 太阳方向/位置 | `uSunDir`/`uSunPos`/`uSunElev` | 北京时间天文解算（北京 116.4074E / 39.9042N） |
| 大气色温 | `uSkyZenith`/`uSkyHorizon`/`uSunColor`/`uAmbient`/`uGround` | 24h 循环 Catmull-Rom 三次样条，毫秒级连续 |
| 天气 | `uWeather`/`uRain` | 双模状态机平滑插值（≈2.5s 过渡） |
| 光标 | `uCursor`/`uCursorL` | pointermove 指数平滑，做辅助点光源 |
| 主题 | `uTheme` | 0 深色 / 1 浅色，玻璃底色与大气亮度自适应 |

**渲染管线约束（硬性）**：

- 单 Draw Call：一个全屏大三角形（3 顶点，`(-1,-1),(3,-1),(-1,3)`），无索引缓冲，无二次 draw。
- 单 Pass 颜色合成：直接输出默认帧缓冲（无 FBO、无中间纹理、无回读），消除显存带宽开销。
- 片元着色器 `precision mediump float`（FP16 双倍吞吐），全分支指令替换为 `mix/smoothstep/step`。
- 100% 满血点对点：`canvas.width = innerWidth × devicePixelRatio`，**不降采样、不动态降频**。性能基准：天玑 8350（Mali-G615-MC6）60fps 目标，调参杠杆见 §6。

## 4. 双模天气状态机

| 状态 | 晴天 CLEAR | 雨天 RAIN |
| --- | --- | --- |
| 触发 | 白天随机（约 68%）/ 夜间恒为晴天 | 白天随机（约 32%） |
| Shader 效果 | 64 步体积光追（丁达尔光束）、GGX 微表面高光、布朗运动微尘、菲涅尔切边金光 | 多层程序化涟漪法线扰动、透光折射畸变、卡片顶沿飞溅水花 |
| 过渡 | `uWeather` 0→1 经 `mix()` 双模合成，约 2.5s 平滑 |

状态机常驻在 `WeatherFSM`：约 60–120s 评估一次转移，`uWeather` 指数趋近目标值，避免突变。

## 5. 卡片透光毛玻璃材质（三层协作）

1. **CSS 层（rtx.css）**：半透明底色（`color-mix` 降低不透明度，让 WebGL 光路透出）+ SVG `feTurbulence` 抗色阶微噪点（`::after` 叠加，`mix-blend-mode:overlay`）。
2. **Shader 玻璃层**：`atmo(px + refr)` 折射采样作透光底色；RGB 三通道**波长分离微棱镜色散**（每通道独立偏移采样）；太阳主光 + 光标辅助光**双光源 GGX 干涉反射**（薄膜干涉混色）；菲涅尔**切边金光**；雨天卡片顶沿**飞溅水花粒子**。
3. **Dom 层**：原有卡片内容（图片/文本/技能条）原样保留在玻璃之上，形成"玻璃中看世界"的透光质感。

三者坐标对齐依据：`getBoundingClientRect()` 实时同步到 `uCards`，DPR 换算后与 `gl_FragCoord` 严格一致。

## 6. 性能调参（在 60fps 目标下微调）

| 参数 | 位置 | 默认 | 说明 |
| --- | --- | --- | --- |
| `uMarch` | `window.__rtx.setMarch(n)` | 64 | 晴天体积光步数，8–128；低端核可降至 32 换取帧率 |
| 体积光强度 | shader `atmo()` 内 `0.55` 系数 | — | 丁达尔光束浓度 |
| 折射偏移 | shader `refr = rip*14*uRain` | — | 雨天畸变幅度 |
| `motion` | `prefers-reduced-motion` 自动 | 1 / 0.2 | 无障碍降速，不关闭渲染 |

> 若在目标机上实测掉帧：优先降 `uMarch`（保持 100% 分辨率），**不要**降 DPR —— 遵循"满血点对点"硬约束。

## 7. 入口嗅探与三级降级兜底

- **① 硬件加速优先**：先以 `failIfMajorPerformanceCaveat:true` 创建上下文（拒绝软件渲染）；真机（含天玑 8350 等 Mali 设备）应命中此级。
- **② 软件渲染回退**：部分手机 GPU 驱动被浏览器拉黑时 Chromium 会降级到 SwiftShader，此时**不拦截**——改用不带 `failIfMajorPerformanceCaveat` 的上下文继续渲染，并自动把 `uMarch` 降至 20（可用 `window.__yaoxiRTG.config.softwareMarch` 覆盖），控制台输出降级警告。
- **③ 完全无 WebGL2** → 注入 `#rtx-notice` 提示条（提示使用 Chrome / Edge / Safari 15+ 等现代浏览器），页面回退原静态背景，不拦截正文浏览；失败原因与 UA 写入 `window.__rtxFail` 便于诊断。
- 着色器编译失败 → 同款回退，控制台输出具体编译日志。
- 排障提示：若页面未出现任何提示条且背景缺失，说明 `webgl/background.min.js` 未加载（多为部署遗漏 `webgl/` 目录或旧缓存），请检查 Network 面板。

## 8. 文件清单

| 文件 | 职责 |
| --- | --- |
| `webgl/background.vert` | 交付物② 顶点着色器：全屏大三角形（源文件，已内嵌于 background.js） |
| `webgl/background.frag` | 交付物② 片元着色器：大气光追 / 双模天气 / 玻璃光路（源文件，已内嵌于 background.js） |
| `webgl/background.js` | 交付物③ 控制器：调度循环 + 状态机 + 太阳/色温样条（内嵌着色器，单文件自包含） |
| `webgl/rtx.css` | 交付物① 图层隔离与透光玻璃适配样式（构建时并入 style.css 内联） |
| `scripts/build.mjs` | 已扩展：合并内联 rtx.css、压缩加 hash 产出 background.min.js 并重写引用 |
| `sw.js` | 已扩展：SHELL_CACHE 预缓存 background.min.js，CACHE_NAME → v11-rtx |
