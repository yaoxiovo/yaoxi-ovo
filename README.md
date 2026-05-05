# Yaoxi homepage SEO/code optimized version

替换方式：把本目录下的 `index.html`、`style.css`、`main.js`、`sw.js` 上传到站点根目录，并新增 `robots.txt`、`sitemap.xml`、`site.webmanifest`。

## 主要改动

- SEO：优化 title / description / Open Graph / Twitter Card / canonical / robots 指令。
- 结构化数据：从单一 Person 扩展为 WebSite + ProfilePage + Person 的 JSON-LD 图谱。
- 内容：补齐中考倒计时卡片，和原 `main.js` 的倒计时 DOM 逻辑对应。
- 可访问性：增加 skip link、dialog role、aria 属性、按钮化联系方式、键盘焦点样式、Escape 关闭弹窗。
- 性能：头像预加载与 fetchpriority，视频 preload 改为 metadata，音频 preload 改为 none。
- Service Worker：不再预缓存大视频/音频；Range 请求直接交给网络，避免音视频拖动/断点请求异常。
- 代码设计：去掉内联 onclick，JS 改为事件委托和模块化 IIFE；CSS 删除重复动画与无用聊天样式。

## 上线后建议

- 在 Google Search Console 提交 `https://yaoxi.wiki/sitemap.xml`。
- 如果 `avatar.jpg` / `favicon.jpg` 不是适合 PWA 图标的方形图，建议另外生成 192x192 和 512x512 图标。
- 如果站点内容不是“初三学生”，请把页面文本和 JSON-LD 中的年级描述改成真实信息。
