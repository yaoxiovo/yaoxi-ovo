# Yaoxi homepage

直接修改仓库根目录中的网页和资源。Cloudflare Workers 按 `.assetsignore` 的规则从仓库根目录发布静态文件，无需运行构建命令。

```sh
npx wrangler dev                # 本地预览
npx wrangler deploy --dry-run   # 检查部署打包
npx wrangler deploy             # 部署到 Cloudflare
```

如果已在 Cloudflare 的 Git 集成中设置构建命令，清空构建命令并保留 Wrangler 部署命令。修改离线预缓存中的资源后，更新 `sw.js` 的缓存版本，并同步首页隐私弹窗中的缓存名称。

## 页面与维护

- `index.html`、`style.css` 和 `main.js` 分别负责首页内容、门户布局和交互。首页包含焦点轮播、专题入口、动态卡片、技术方向、社会价值和 Umami 访问统计。
- 导航支持简体中文、繁体中文和英文，以及自动、浅色和深色主题。背景音乐可从导航栏控制。
- `sw.js` 负责首页和常用资源的离线缓存。音频按需加载，带 Range 请求头的请求由网络处理。
- `mother/index.html` 是独立的母亲节祝福页。
- 新增公开文件时，同步更新 `.assetsignore` 中的发布清单。
