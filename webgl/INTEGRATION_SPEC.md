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
| 触发 | 随机（约 60%） | 随机（约 40%，**全天候含夜间**——夜间雨幕×幽蓝人造光是核心美术场景） |
| 切换周期 | 每 45–90s 评估一次；首访 ~18–30s 内即出现首次切换 | 同左 |
| Shader 效果 | 64 步体积光追（丁达尔光束）、GGX 微表面高光、布朗运动微尘、菲涅尔切边金光 | 多层程序化涟漪法线扰动、透光折射畸变、卡片顶沿飞溅水花 |
| 过渡 | `uWeather` 0→1 经 `mix()` 双模合成，约 2.5s 平滑 |

状态机常驻在 `WeatherFSM`，`uWeather` 指数趋近目标值，避免突变。

## 5. 卡片透光毛玻璃材质（三层协作）

1. **CSS 层（rtx.css）**：半透明底色（`color-mix` 降低不透明度，让 WebGL 光路透出）+ SVG `feTurbulence` 抗色阶微噪点（`::after` 叠加，`mix-blend-mode:overlay`）。
2. **Shader 玻璃层**：`atmo(px + refr)` 折射采样作透光底色；RGB 三通道**波长分离微棱镜色散**（每通道独立偏移采样）；太阳主光 + 光标辅助光**双光源 GGX 干涉反射**（薄膜干涉混色）；菲涅尔**切边金光**；雨天卡片顶沿**飞溅水花粒子**。
3. **Dom 层**：原有卡片内容（图片/文本/技能条）原样保留在玻璃之上，形成"玻璃中看世界"的透光质感。

三者坐标对齐依据：`getBoundingClientRect()` 实时同步到 `uCards`，DPR 换算后与 `gl_FragCoord` 严格一致。

## 6. 性能调参（在 60fps 目标下微调）

| 参数 | 位置 | 默认 | 说明 |
| --- | --- | --- | --- |
| `uSteps` | `window.__rtx.setMarch(n)` | 64 | 晴天体积光步数，8–128；低端核可降至 32 换取帧率 |
| `uBeamK` | `window.__rtx.setBeamK(k)` | 1.0 | 丁达尔光束强度系数 0–2（shader `atmo()` 内 `0.55*uBeamK`） |
| `uRefrK` | `window.__rtx.setRefrK(k)` | 1.0 | 雨滴折射畸变系数 0–3（shader `refr = rip*14*uRain*uRefrK`） |
| `uWeather` | `window.__rtx.setWeatherValue(v)` / `setWeatherAuto()` | FSM 自动 | 手动冻结天气混合 0–1（1=全雨）；恢复 FSM 自动切换 |
| 时间覆盖 | `window.__rtx.setTimeOverride(h)` | `null` | 固定北京小时 0–24 解算太阳/色温；`null` 跟随实际时间 |
| `motion` | `prefers-reduced-motion` 自动 | 1 / 0.2 | 无障碍降速，不关闭渲染 |

> 若在目标机上实测掉帧：引擎已内置**自适应体积光步数**（每 ~2s 依据帧时 EMA 调节 `uSteps`：>24ms 降 16 步、<14ms 升 8 步，区间 16–64），**分辨率/DPR 始终满血点对点、绝不降采样**。可用 `window.__yaoxiRTG.config.adaptiveMarch=false` 关闭，或 `window.__rtx.setMarch(n)` 手动固定。

## 7. 入口嗅探与三级降级兜底

### 7.1 上下文三级降级
- **① 硬件加速优先**：先以 `failIfMajorPerformanceCaveat:true` 创建上下文（拒绝软件渲染）；真机（含天玑 8350 等 Mali 设备）应命中此级。
- **② 软件渲染回退**：部分手机 GPU 驱动被浏览器拉黑时 Chromium 会降级到 SwiftShader，此时**不拦截**——改用不带 `failIfMajorPerformanceCaveat` 的上下文继续渲染，并自动把 `uSteps` 降至 20（可用 `window.__yaoxiRTG.config.softwareMarch` 覆盖），控制台输出降级警告。
- **③ 完全无 WebGL2** → 注入 `#rtx-notice` 提示条（提示使用 Chrome / Edge / Safari 15+ 等现代浏览器），页面回退原静态背景，不拦截正文浏览；失败原因与 UA 写入 `window.__rtxFail` 便于诊断。

### 7.2 着色器三级自愈（FULL → LITE → MINI）
拿到 WebGL2 上下文后，按档位顺序编译，**首个成功的档位自动生效**，用户无感知：
- **FULL**：完整光追（体积光束/雨滴涟漪/玻璃色散/双光源 GGX）；
- **LITE**：无循环、无数组、无动态索引的纯数学大气（天空/太阳/星点/视差/光标辉光），规避驱动循环展开与索引限制；
- **MINI**：天空渐变 + 太阳柔光，终极保底。
当前生效档位记录于 `window.__rtx.shaderTier` 并打印 `[RTX] 着色器档位就绪: <tier>`。**各档位编译失败的原因捕获于 `window.__rtx.tierErrors`（如 `{full:"ERROR: ..."}`），并直接公示在场景调节台提示横幅中**——手机端无法看控制台时的唯一排障线索。三级全挂才会弹横幅，且横幅内嵌**可读的驱动错误摘要**（便于手机端截图反馈）。

### 7.3 已知兼容性坑（踩过）
- **mediump(FP16) 像素坐标溢出 → 整屏黑**：设备像素可达 ~3240，`hash21` 内 `px*456≈1.48M` 超 FP16 上限 65504 → `Inf` → `fract(Inf)=NaN` 经星点/抖动项污染全屏；`length()` 内部平方项 ~10.5M 同样溢出 → 太阳/水花消失。**修正：片元着色器全线 `precision highp float`**（Mali-G615 highp 片元吞吐完全可用），FP16 双吞吐的理论收益让位于正确性。
- **内嵌 GLSL 的前导换行**：模板字符串起始换行会让 `#version` 不在第一行，ANGLE（Android Chrome/Edge 的 WebGL 后端）直接判编译失败。`linkProgram()` 内统一 `String(src).trim()` 兜底，**勿移除**。
- **`smoothstep(edge0, edge1)` 的 edge0 ≥ edge1 属规范未定义行为**，已全部改写为 `1.0 - smoothstep(小, 大, x)` 形式。
- 非恒定循环界（`for (int i=0; i<uSteps; i++)`）为 ES 3.00 合法语法，可防止驱动展开 64 步体积光循环导致指令超限；但极老驱动若有兼容问题，LITE/MINI 档位可完全规避。
- 排障提示：若页面未出现任何提示条且背景缺失，说明 `webgl/background.min.js` 未加载（多为部署遗漏 `webgl/` 目录或旧缓存），请检查 Network 面板。

## 8. 场景调节台（导航栏全场景自定义 + 实时数值读出）

导航栏 `.scene-toggle`（均衡器图标）→ 弹出玻璃面板 `#scenePanel`，控制器内嵌于 `webgl/background.js` 的 `initScenePanel()`，引擎启动即挂载，**不依赖 rtx-active**（引擎离线时读出显示"引擎未运行"并禁用控制区）。

### 8.1 数值读出（2.5Hz，面板开启时才轮询）
渲染状态（运行中/运行中·软渲/引擎未运行）、FPS/帧时、着色器档位（FULL/LITE/MINI）、体积光步数（含"手动"标记）、天气混合值、太阳仰角/方位角、屏幕分辨率 @DPR —— 数据源 `window.__rtx.getStats()`。

### 8.2 控制项（拖动即生效，全部实时反映到下一帧 uniform）
| 控件 | 行为 |
| --- | --- |
| 天气混合滑杆 + "自动天气" | 拖动 → `setWeatherValue()` 冻结 FSM；勾回 → `setWeatherAuto()`。自动模式下滑杆实时跟随 FSM 输出（拖动中不反写） |
| 北京时间滑杆 + "跟随实际时间" | 拖动 → `setTimeOverride(h)` 固定太阳/色温解算；勾回 → `null`。**所有档位均生效**（太阳/色温为 JS 侧解算） |
| 体积光步数滑杆 + "帧率自适应" | 拖动 → `setMarchManual(n)` 固定步数；勾回 → 恢复自适应。自动模式下跟随自适应输出 |
| 光束强度 / 雨滴折射 | `setBeamK(0–2)` / `setRefrK(0–3)`，直通 shader `uBeamK`/`uRefrK` |
| 恢复默认 | `resetScene()` + 清除持久化 |

**档位差异（v13）**：LITE/MINI 档已接入 `uWeather`（雨天压暗+去饱和）与 `uBeamK`（太阳光晕缩放）——天气/光束滑杆在所有档位都有可见反馈；雨滴折射与体积光步数仅 FULL 档有效，非 FULL 档时面板自动置灰（`.is-na`）并显示琥珀色提示横幅（含降级说明、软渲提示与 FULL 编译错误原文）。光束在夜间（太阳低于地平线）任何档位均不可见，属物理正确行为。

### 8.3 持久化
用户自定义写入 `localStorage("yaoxiSceneCfg")`（含各滑杆值与自动开关态），下次访问静默恢复；"恢复默认"即删除。隐私模式存储不可用时静默降级为会话级。

### 8.4 无障碍与 i18n
- 开合同步 `aria-expanded` / `aria-hidden`；ESC 关闭并归还焦点；滑杆 `focus-visible` 高亮。
- 静态文案走 main.js i18n；动态数值标签（自动/手动/跟随本地等）由面板内置 zh-CN/zh-TW/en 字典按 `document.documentElement.lang` 渲染。

## 9. 文件清单

| 文件 | 职责 |
| --- | --- |
| `webgl/background.vert` | 交付物② 顶点着色器：全屏大三角形（源文件，已内嵌于 background.js） |
| `webgl/background.frag` | 交付物② 片元着色器：大气光追 / 双模天气 / 玻璃光路（源文件，已内嵌于 background.js） |
| `webgl/background.js` | 交付物③ 控制器：调度循环 + 状态机 + 太阳/色温样条 + 场景调节台控制器（内嵌着色器，单文件自包含） |
| `webgl/rtx.css` | 交付物① 图层隔离与透光玻璃适配样式 + 调节台玻璃面板样式（构建时并入 style.css 内联） |
| `scripts/build.mjs` | 已扩展：合并内联 rtx.css、压缩加 hash 产出 background.min.js 并重写引用 |
| `sw.js` | 已扩展：SHELL_CACHE 预缓存 background.min.js，CACHE_NAME → v12-scene-console |
