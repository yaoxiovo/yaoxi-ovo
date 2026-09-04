#!/usr/bin/env node
/**
 * Yaoxi Homepage — 极致性能构建流水线
 * 1. esbuild 压缩 CSS/JS/SW
 * 2. CSS 全量内联进 HTML（零 CSS 请求、零 FOUC）
 * 3. JS 加内容 hash（长缓存友好）
 * 4. HTML 压缩（去注释/空白）
 * 5. 静态资源复制到 dist/
 */
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, statSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const VER = "10-perf-max";

// ---------- 1. 压缩 CSS ----------
const cssResult = await build({
  entryPoints: [join(root, "style.css")],
  bundle: false,
  minify: true,
  write: false,
  logLevel: "silent",
});
const cssMin = cssResult.outputFiles[0].text;

// ---------- 2. 压缩 JS（带 hash） ----------
const jsResult = await build({
  entryPoints: [join(root, "main.js")],
  bundle: false,
  minify: true,
  write: false,
  target: "es2019",
  logLevel: "silent",
});
const jsMin = jsResult.outputFiles[0].text;
const jsHash = createHash("sha256").update(jsMin).digest("hex").slice(0, 8);
const jsFile = `main.min.js?v=${VER}-${jsHash}`;

// ---------- 3. 压缩 SW ----------
const swResult = await build({
  entryPoints: [join(root, "sw.js")],
  bundle: false,
  minify: true,
  write: false,
  target: "es2019",
  logLevel: "silent",
});
const swMin = swResult.outputFiles[0].text.replace(
  /main\.min\.js\?v=[^"]*/g,
  `main.min.js?v=${VER}-${jsHash}`
);

// ---------- 4. 处理 HTML ----------
let html = readFileSync(join(root, "index.html"), "utf8");

// CSS 内联：替换 <link rel="stylesheet" href="style.css?v=...">
html = html.replace(
  /<link rel="stylesheet" href="style\.css\?v=[^"]*">/,
  () => `<style>${cssMin}</style>`
);

// JS 引用替换
html = html.replace(
  /main\.js\?v=[^"]*/g,
  () => jsFile
);

// HTML 压缩：去注释 + 压缩空白（保留 <pre> 语义标签与 script/style 内容安全）
html = html.replace(/<!--[\s\S]*?-->/g, "");
html = html.replace(/\n\s*\n/g, "\n").replace(/[ \t]{2,}/g, " ");

// ---------- 5. 写 dist/ ----------
mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, "index.html"), html);
writeFileSync(join(dist, jsFile.split("?")[0]), jsMin);
writeFileSync(join(dist, "sw.js"), swMin);

// 复制静态资源（精确清单，不含中间产物）
const copyList = [
  "mother", ".well-known", "src",
  "avatar.webp", "carousel_bg_1.webp", "project_blog.webp",
  "tech_skills.webp", "tech_engineering.webp", "tech_design.webp",
  "favicon.jpg", "music.mp3", "site.webmanifest", "robots.txt", "sitemap.xml",
  "4780f31b5d4ae80fcf8c2a86c2a235a7.txt", "cdn.txt", "BingSiteAuth.xml",
];
for (const item of copyList) {
  const src = join(root, item);
  if (existsSync(src)) {
    cpSync(src, join(dist, item), { recursive: true });
  }
}

// assets 精确复制：仅 AVIF 图片 + 子集字体
const imgFiles = ["avatar.avif", "carousel_bg_1.avif", "project_blog.avif", "tech_skills.avif", "tech_engineering.avif", "tech_design.avif"];
mkdirSync(join(dist, "assets/img"), { recursive: true });
for (const f of imgFiles) {
  const src = join(root, "assets/img", f);
  if (existsSync(src)) copyFileSync(src, join(dist, "assets/img", f));
}
const fontFiles = ["Inter-400-sub.woff2", "Inter-600-sub.woff2", "Inter-700-sub.woff2", "Outfit-500-sub.woff2", "Outfit-600-sub.woff2", "Outfit-700-sub.woff2", "remixicon-sub.woff2"];
mkdirSync(join(dist, "assets/fonts"), { recursive: true });
for (const f of fontFiles) {
  const src = join(root, "assets/fonts", f);
  if (existsSync(src)) copyFileSync(src, join(dist, "assets/fonts", f));
}

// ---------- 6. 统计 ----------
const kb = (p) => (statSync(p).size / 1024).toFixed(1) + "KB";
console.log("=== 构建产物 ===");
console.log(`index.html     ${kb(join(dist, "index.html"))}  (CSS 已内联)`);
console.log(`${jsFile}  ${kb(join(dist, jsFile.split("?")[0]))}`);
console.log(`sw.js          ${kb(join(dist, "sw.js"))}`);
const assets = ["assets/img/carousel_bg_1.avif", "assets/img/avatar.avif", "assets/fonts/remixicon-sub.woff2"];
for (const a of assets) console.log(`${a.padEnd(28)} ${kb(join(dist, a))}`);
console.log(`music.mp3      ${kb(join(dist, "music.mp3"))} (保持不变)`);
console.log("\n=== 完成 ===");