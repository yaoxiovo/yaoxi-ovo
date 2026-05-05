const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://yaoxi.wiki/</loc>
    <lastmod>2026-05-05</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;

const ROBOTS_TXT = `User-agent: *
Allow: /

Sitemap: https://yaoxi.wiki/sitemap.xml
`;

function textResponse(body, contentType, request) {
  return new Response(request.method === "HEAD" ? null : body, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=3600",
      "x-content-type-options": "nosniff"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "GET" || request.method === "HEAD") {
      if (pathname === "/sitemap.xml") {
        return textResponse(SITEMAP_XML, "application/xml; charset=utf-8", request);
      }

      if (pathname === "/robots.txt") {
        return textResponse(ROBOTS_TXT, "text/plain; charset=utf-8", request);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
