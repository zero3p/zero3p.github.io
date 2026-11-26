
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SITE_URL = (process.env.SITE_URL || "https://zero3p.github.io").replace(/\/+$/, "");
const RAW_SUPABASE_URL = (process.env.SUPABASE_URL || "").trim();
const SUPABASE_KEY = (process.env.SUPABASE_KEY || "").trim();

function getSupabaseOrigin() {
  if (!RAW_SUPABASE_URL) {
    throw new Error("Missing SUPABASE_URL repository secret");
  }

  let parsed;
  try {
    parsed = new URL(RAW_SUPABASE_URL);
  } catch {
    throw new Error("SUPABASE_URL must begin with https://");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("SUPABASE_URL must use https://");
  }

  if (!parsed.hostname.endsWith(".supabase.co")) {
    throw new Error("SUPABASE_URL must end with .supabase.co");
  }

  return parsed.origin;
}

const SUPABASE_ORIGIN = getSupabaseOrigin();

if (!SUPABASE_KEY) {
  throw new Error("Missing SUPABASE_KEY repository secret");
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

function getSlug(item) {
  const data = item?.data || {};

  return (
    slugify(data.slug) ||
    slugify(data.n) ||
    `game-${item.id}`
  );
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
  const endpoint = new URL(
    "/rest/v1/items",
    SUPABASE_ORIGIN
  );

  endpoint.searchParams.set("select", "id,data");
  endpoint.searchParams.set("order", "id.desc");

  const response = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!response.ok) {
    const detail = await response.text();

    throw new Error(
      `Supabase returned HTTP ${response.status}: ${detail.slice(0, 500)}`
    );
  }

  const rows = await response.json();

  if (!Array.isArray(rows)) {
    throw new Error("Supabase response was not an array");
  }

  return rows.filter((item) => {
    const data = item?.data || {};

    return (
      item?.id != null &&
      data.n &&
      !data.archived
    );
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

  // FIX: send the complete game path to index.html
  const target =
    `${SITE_URL}/?gp=${encodeURIComponent("/game/" + slug + "/")}`;

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

    <img
      src="${safeImage}"
      alt="${safeTitle}"
      style="max-width:100%;height:auto"
    >

    <p>${safeDescription}</p>

    ${factsHtml ? `<ul>${factsHtml}</ul>` : ""}

    <p>
      <a href="${escapeHtml(target)}">
        عرض اللعبة في ZE ZERO
      </a>
    </p>

    <p>
      <a href="${escapeHtml(SITE_URL)}/">
        العودة إلى الموقع
      </a>
    </p>
  </main>

  <script>
    window.location.replace(${JSON.stringify(target)});
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
    const slug = getSlug(item);

    if (!slug || activeSlugs.has(slug)) {
      console.warn(
        `Skipping duplicate or invalid slug: ${slug}`
      );
      continue;
    }

    activeSlugs.add(slug);

    const gameDir = path.join(OUT_DIR, slug);

    fs.mkdirSync(gameDir, { recursive: true });

    const pageFile = path.join(
      gameDir,
      "index.html"
    );

    fs.writeFileSync(
      pageFile,
      makeGameHtml(item, slug),
      "utf8"
    );

    sitemapUrls.push(
      `<url><loc>${xmlEscape(
        `${SITE_URL}/game/${slug}/`
      )}</loc></url>`
    );
  }

  // Remove only pages created by this generator.
  for (const entry of fs.readdirSync(OUT_DIR, {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) continue;

    const gameDir = path.join(OUT_DIR, entry.name);

    const pageFile = path.join(
      gameDir,
      "index.html"
    );

    if (!fs.existsSync(pageFile)) continue;

    const content = fs.readFileSync(
      pageFile,
      "utf8"
    );

    if (
      content.includes("ZE-GENERATED-GAME-PAGE") &&
      !activeSlugs.has(entry.name)
    ) {
      fs.rmSync(gameDir, {
        recursive: true,
        force: true,
      });
    }
  }

  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${sitemapUrls.join("\n")}\n` +
    `</urlset>\n`;

  fs.writeFileSync(
    SITEMAP_FILE,
    sitemap,
    "utf8"
  );

  console.log(
    `Generated ${activeSlugs.size} game pages.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
