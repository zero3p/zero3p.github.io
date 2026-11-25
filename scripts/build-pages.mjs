import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SITE_URL = (
  process.env.SITE_URL || "https://zero3p.github.io"
).replace(/\/+$/, "");

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_KEY");
}

const OUT_DIR = path.join(ROOT, "game");
const SITEMAP_FILE = path.join(ROOT, "sitemap-games.xml");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugify(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function safeSlug(item) {
  const data = item.data || {};
  const supplied = slugify(data.slug);
  const name = slugify(data.n);
  return supplied || name || `game-${item.id}`;
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function fetchGames() {
  const url = new URL(`${SUPABASE_URL}/rest/v1/items`);
  url.searchParams.set("select", "id,data");
  url.searchParams.set("order", "id.desc");

  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Supabase request failed: ${response.status} ${await response.text()}`
    );
  }

  const rows = await response.json();

  if (!Array.isArray(rows)) {
    throw new Error("Supabase response is not an array");
  }

  return rows.filter((item) => {
    const data = item?.data || {};
    return item?.id != null && data.n && !data.archived;
  });
}

function makeGameHtml(item, slug) {
  const data = item.data || {};

  const title = String(data.n || "لعبة").trim();
  const description = String(
    data.d || `تحميل لعبة ${title} للاندرويد`
  ).trim();

  const canonical = `${SITE_URL}/game/${slug}/`;
  const image = data.img || `${SITE_URL}/logo.png`;

  const facts = [
    ["الحجم", data.s],
    ["الشركة", data.cn],
    ["سنة الإصدار", data.yr],
    ["التصنيف", data.rg],
    ["الإصدار", data.gv],
  ].filter(([, value]) => value);

  const factsHtml = facts
    .map(
      ([label, value]) =>
        `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`
    )
    .join("\n");

  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const safeCanonical = escapeHtml(canonical);

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle} - ZE ZERO</title>
  <meta name="description" content="${safeDescription}">
  <link rel="canonical" href="${safeCanonical}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:url" content="${safeCanonical}">
  <meta property="og:image" content="${safeImage}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${safeImage}">
  <meta name="robots" content="index,follow">
</head>
<body>
  <!-- ZE-GENERATED-GAME-PAGE -->
  <main>
    <h1>${safeTitle}</h1>
    <img src="${safeImage}" alt="${safeTitle}" style="max-width:100%;height:auto">
    <p>${safeDescription}</p>
    ${factsHtml ? `<ul>${factsHtml}</ul>` : ""}
    <p>
      <a href="${SITE_URL}/?gp=${encodeURIComponent(slug)}">
        عرض اللعبة في ZE ZERO
      </a>
    </p>
    <p><a href="${SITE_URL}/">العودة إلى الموقع</a></p>
  </main>
  <script>
    window.location.replace(
      ${JSON.stringify(`${SITE_URL}/?gp=${slug}`)}
    );
  </script>
</body>
</html>`;
}

async function main() {
  const games = await fetchGames();

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const activeSlugs = new Set();
  const sitemapUrls = [];

  for (const item of games) {
    const slug = safeSlug(item);

    if (!slug || activeSlugs.has(slug)) {
      console.warn("Skipping duplicate or invalid slug:", slug);
      continue;
    }

    activeSlugs.add(slug);

    const gameDir = path.join(OUT_DIR, slug);
    const pageFile = path.join(gameDir, "index.html");

    fs.mkdirSync(gameDir, { recursive: true });
    fs.writeFileSync(pageFile, makeGameHtml(item, slug), "utf8");

    sitemapUrls.push(
      `<url><loc>${xmlEscape(`${SITE_URL}/game/${slug}/`)}</loc></url>`
    );
  }

  // Remove only old pages created by this generator.
  for (const entry of fs.readdirSync(OUT_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const pageFile = path.join(OUT_DIR, entry.name, "index.html");

    if (!fs.existsSync(pageFile)) continue;

    const content = fs.readFileSync(pageFile, "utf8");

    if (
      content.includes("ZE-GENERATED-GAME-PAGE") &&
      !activeSlugs.has(entry.name)
    ) {
      fs.rmSync(path.join(OUT_DIR, entry.name), {
        recursive: true,
        force: true,
      });
    }
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.join("\n")}
</urlset>
`;

  fs.writeFileSync(SITEMAP_FILE, sitemap, "utf8");

  console.log(`pages: ${activeSlugs.size}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
