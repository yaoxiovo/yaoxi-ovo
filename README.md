# Yaoxi homepage

替换方式：把本目录下的 `index.html`、`style.css`、`main.js`、`sw.js` 上传到站点根目录，并新增 `robots.txt`、`sitemap.xml`、`site.webmanifest`。

## 主要改动

- UI：重构为 iOS 26 inspired Liquid Glass 视觉体系，统一导航、Hero、内容卡片、数据面板、页脚、Cookie 横幅和弹窗的透明材质。
- 主题：使用可复用 CSS design tokens，支持按本地时间自动切换以及手动浅色 / 深色模式，记忆偏好并同步浏览器 `theme-color`。
- 多语言：导航栏支持简体中文、繁体中文和英文完整界面切换，并在本地保存语言偏好。
- 时间组件：Hero 新增本地时间玻璃组件，随早晨、午间、下午、傍晚和深夜切换问候、图标、光色与昼夜进度。
- 响应式：针对桌面、平板和 390px 手机断点重排网格与导航，保留稳定尺寸并避免横向溢出。
- SEO：优化 title / description / Open Graph / Twitter Card / canonical / robots 指令。
- 结构化数据：从单一 Person 扩展为 WebSite + ProfilePage + Person 的 JSON-LD 图谱。
- 内容：保留六张个人动态卡片、技术方向、社会价值、关键指标与 Umami 数据面板的完整信息架构。
- 可访问性：增加 skip link、dialog role、aria 属性、按钮化联系方式、键盘焦点样式、Escape 关闭弹窗；轮播指示器支持键盘操作并同步 `aria-current` / `aria-hidden`。
- 性能：头像预加载与 fetchpriority，视频 preload 改为 metadata，音频 preload 改为 none。
- Service Worker：不再预缓存大视频/音频；Range 请求直接交给网络，避免音视频拖动/断点请求异常；Liquid Glass 更新使用独立缓存版本。
- 代码设计：去掉内联 onclick，JS 改为事件委托和模块化 IIFE；CSS 删除重复动画与无用聊天样式。

## 上线后建议

- 在 Google Search Console 提交 `https://yaoxi.wiki/sitemap.xml`。
- 如果 `avatar.jpg` / `favicon.jpg` 不是适合 PWA 图标的方形图，建议另外生成 192x192 和 512x512 图标。
- 如果站点内容不是“初三学生”，请把页面文本和 JSON-LD 中的年级描述改成真实信息。
