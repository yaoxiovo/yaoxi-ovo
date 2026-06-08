# Yaoxi 个人主页

这是一个基于原生 HTML / CSS / JavaScript 构建的轻量级个人主页项目，包含基础 SEO、PWA 相关文件和 Cloudflare Workers / Assets 部署配置。

项目当前没有使用前端框架、构建工具或包管理器，适合直接作为静态站点部署。

## 项目结构

```text
.
├── index.html          # 页面结构、SEO 元信息、社交分享信息、JSON-LD
├── style.css           # 页面样式、响应式布局、玻璃拟态视觉效果
├── main.js             # 时钟、主题切换、音乐弹窗、联系方式弹窗、复制、SW 注册
├── sw.js               # Service Worker 缓存逻辑
├── src/worker.js       # Cloudflare Worker，处理 robots.txt / sitemap.xml 并回退到静态资源
├── wrangler.toml       # Cloudflare Workers / Assets 配置
├── robots.txt          # 搜索引擎爬虫规则
├── sitemap.xml         # 站点地图
├── site.webmanifest    # PWA manifest
├── avatar.jpg          # 头像资源
├── favicon.jpg         # 网站图标
├── home.mp4            # 桌面端背景视频
├── mobile-bg.jpg       # 移动端背景图
└── music.mp3           # 背景音乐
```

## 技术栈

- 原生 HTML
- 原生 CSS
- 原生 JavaScript
- Service Worker
- Web Manifest / PWA
- Cloudflare Workers / Assets

当前项目未包含：

- `package.json`
- npm / pnpm / yarn / bun 锁文件
- 构建脚本
- 测试配置
- lint / formatter 配置

## 本地预览

由于项目没有构建步骤，可以直接使用任意静态服务器预览。

例如在项目根目录运行：

```bash
python -m http.server
```

然后访问：

```text
http://localhost:8000
```

不建议直接通过 `file://` 打开页面，因为 Service Worker 需要在 HTTP(S) 或 localhost 等安全上下文中注册。

## Cloudflare 部署

项目包含 `wrangler.toml`，使用 Cloudflare Workers / Assets 托管静态资源。

关键配置：

```toml
name = "yaoxi-ovo"
compatibility_date = "2026-01-09"

[assets]
directory = "."
```

如果本机已配置 Wrangler，可在项目根目录执行：

```bash
wrangler deploy
```

## 当前功能

### 页面与 SEO

`index.html` 包含：

- `title` / `description`
- Open Graph
- Twitter Card
- canonical
- robots meta
- JSON-LD 结构化数据
- 外部图标资源
- Umami 统计脚本

### 前端交互

`main.js` 当前负责：

- 顶部时间显示
- 根据时间切换日间 / 夜间主题
- 背景音乐播放确认弹窗
- 使用 `localStorage` 保存音乐播放偏好
- 联系方式弹窗
- QQ / Email 复制到剪贴板
- 注册 `sw.js`

### PWA / 离线缓存

`sw.js` 当前实现了：

- 安装阶段预缓存静态资源
- 激活阶段清理旧缓存
- fetch 阶段缓存优先读取资源
- 网络请求成功后写入缓存

注意：当前 Service Worker 仍会预缓存 `home.mp4` 和 `music.mp3` 等媒体资源，后续如需优化首屏加载和移动端流量，建议将大媒体文件从预缓存列表中移除。

### Cloudflare Worker

`src/worker.js` 当前负责：

- `/sitemap.xml` 返回 XML 内容
- `/robots.txt` 返回文本内容
- 其他请求交给 `env.ASSETS.fetch(request)` 处理

## 已知维护点

当前代码整体简单直接，但仍有一些可以继续优化的地方：

1. **HTML 中仍存在内联事件**
   - 当前页面仍使用部分 `onclick`。
   - 后续可改为 `addEventListener` 或事件委托，减少全局函数暴露。

2. **Service Worker 缓存策略可以更精细**
   - 建议只处理 `GET` 请求。
   - 建议对带 `Range` 头的音视频请求直接走网络。
   - 建议移除大视频 / 音频的预缓存。
   - 建议为网络失败增加更明确的兜底逻辑。

3. **音视频加载策略仍可优化**
   - 背景视频可显式设置 `preload="metadata"`。
   - 背景音乐可设置 `preload="none"`，等用户确认播放后再加载。

4. **结构化数据仍较简单**
   - 当前 JSON-LD 主要描述 `Person`。
   - 后续可按需要扩展为 `WebSite`、`ProfilePage`、`Person` 的 `@graph`。

5. **缺少自动化质量检查**
   - 当前没有测试、lint、formatter 或 CI。
   - 如果项目继续扩展，建议补充最小化质量检查流程。

## 上线后建议

- 在 Google Search Console 提交站点地图，例如：`https://yaoxi.wiki/sitemap.xml`。
- 确认 `avatar.jpg` / `favicon.jpg` 是否适合作为 PWA 图标；如不适合，建议生成标准的 192x192 和 512x512 图标。
- 如果页面中的身份、年级、联系方式或站点域名发生变化，请同步更新：
  - `index.html`
  - `robots.txt`
  - `sitemap.xml`
  - `src/worker.js`
  - `site.webmanifest`

## 设计原则

当前项目适合继续保持无构建、低复杂度的实现方式：

- **KISS**：保持静态站点结构简单，不为当前需求引入不必要框架。
- **YAGNI**：没有后端业务、数据库或复杂状态时，不额外增加技术栈。
- **DRY**：后续可将联系方式弹窗、复制逻辑统一通过 `data-*` 属性和事件委托管理。
- **渐进优化**：优先修正 Service Worker、内联事件和媒体加载策略，再考虑更严格的 CSP、安全策略和自动化检查。
