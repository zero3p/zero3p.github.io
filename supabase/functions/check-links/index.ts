const clean = (v: string | undefined): string =>
  (v ?? "").trim().replace(/^["']+|["']+$/g, "").trim();

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ENV_ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE = clean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
const TG_TOKEN = clean(Deno.env.get("TELEGRAM_BOT_TOKEN"));
const TG_CHAT = clean(Deno.env.get("OWNER_TELEGRAM_CHAT_ID"));

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

const T: Record<string, string> = {
  alert_title:
    "\u062a\u0646\u0628\u064a\u0647 ZE: \u0631\u0648\u0627" +
    "\u0628\u0637 \u062a\u062d\u0645\u064a\u0644 \u0645" +
    "\u0639\u0637\u0644\u0629",
  r_http_404:
    "\u0627\u0644\u0633\u0628\u0628: \u0627\u0644\u0631" +
    "\u0627\u0628\u0637 \u063a\u064a\u0631 \u0645\u0648" +
    "\u062c\u0648\u062f (404)",
  r_http_410:
    "\u0627\u0644\u0633\u0628\u0628: \u0627\u0644\u0645" +
    "\u0644\u0641 \u0645\u062d\u0630\u0648\u0641 \u0646" +
    "\u0647\u0627\u0626\u064a\u0627\u064b (410)",
  r_file_removed:
    "\u0627\u0644\u0633\u0628\u0628: \u0635\u0641\u062d" +
    "\u0629 \u0627\u0644\u0627\u0633\u062a\u0636\u0627" +
    "\u0641\u0629 \u062a\u0642\u0648\u0644 \u0625\u0646 " +
    "\u0627\u0644\u0645\u0644\u0641 \u0645\u062d\u0630" +
    "\u0648\u0641",
  r_domain_not_found:
    "\u0627\u0644\u0633\u0628\u0628: \u0627\u0644\u062f" +
    "\u0648\u0645\u064a\u0646 \u063a\u064a\u0631 \u0645" +
    "\u0648\u062c\u0648\u062f",
  r_invalid_url:
    "\u0627\u0644\u0633\u0628\u0628: \u0635\u064a\u063a" +
    "\u0629 \u0627\u0644\u0631\u0627\u0628\u0637 \u063a" +
    "\u064a\u0631 \u0635\u062d\u064a\u062d\u0629",
};

async function rpcBool(
  fn: string,
  token: string,
  apikey: string,
): Promise<boolean> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        apikey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return false;
    return (await r.json()) === true;
  } catch {
    return false;
  }
}

async function isStaff(token: string, apikey: string): Promise<boolean> {
  if (await rpcBool("is_admin", token, apikey)) return true;
  return await rpcBool("is_staff", token, apikey);
}

let winStart = 0, winCount = 0;

function rateOk(): boolean {
  const now = Date.now();
  if (now - winStart > 60_000) {
    winStart = now;
    winCount = 0;
  }
  return ++winCount <= 30;
}

function svcHeaders(extra: Record<string, string> = {}) {
  const h: Record<string, string> = {
    apikey: SERVICE,
    "Content-Type": "application/json",
    ...extra,
  };
  if (SERVICE.startsWith("eyJ")) h["Authorization"] = "Bearer " + SERVICE;
  return h;
}

async function svcDb(
  path: string,
  method: string,
  body?: unknown,
  extra: Record<string, string> = {},
): Promise<Response | null> {
  if (!SERVICE || !SUPABASE_URL) return null;
  try {
    return await fetch(SUPABASE_URL + "/rest/v1/" + path, {
      method,
      headers: svcHeaders(extra),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return null;
  }
}

async function loadProtectedLinks(
  itemIds: string[],
): Promise<Map<string, Record<string, unknown>>> {
  const result = new Map<string, Record<string, unknown>>();
  if (!itemIds.length) return result;
  if (!SERVICE) throw new Error("service_role_missing");
  // IDs originate from the items table; keep the filter numeric-only because item_id is bigint.
  const ids = itemIds.filter((id) => /^\d+$/.test(id));
  if (!ids.length) return result;
  const filter = ids.join(",");
  const r = await svcDb(
    "game_links?select=item_id,links&item_id=in.(" + filter + ")",
    "GET",
  );
  if (!r || !r.ok) throw new Error("protected_links_read_failed");
  const rows = await r.json();
  if (!Array.isArray(rows)) throw new Error("protected_links_invalid_response");
  for (const row of rows) {
    const id = String(row.item_id);
    const links = row.links;
    if (links && typeof links === "object" && !Array.isArray(links)) {
      result.set(id, links as Record<string, unknown>);
    }
  }
  return result;
}

async function sha(s: string): Promise<string> {
  const b = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(s),
  );
  return [...new Uint8Array(b)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

async function tgSend(text: string): Promise<boolean> {
  if (!TG_TOKEN || !TG_CHAT) return false;
  try {
    const r = await fetch(
      "https://api.telegram.org/bot" + TG_TOKEN + "/sendMessage",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TG_CHAT,
          text: text.slice(0, 3500),
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(8000),
      },
    );
    return r.ok;
  } catch {
    return false;
  }
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/124.0 Safari/537.36";

type LinkRef = { field: string; label: string; url: string };
type LinkResult = {
  status: string;
  http: number;
  reason: string;
  kind: string;
  size: number;
};

// These keys must match the protected-link format written by the site's dvSplit().
const FIELDS: [string, string][] = [
  ["u", "main"],
  ["up", "update"],
  ["tr", "torrent"],
  ["ad", "addon"],
  ["ad2", "addon2"],
  ["sv", "save"],
  ["lc", "license"],
  ["dp", "direct_pkg"],
];

const SENTINEL = "@";

function restoreProtectedLinks(
  source: Record<string, unknown>,
  protectedLinks: Record<string, unknown>,
): Record<string, unknown> {
  const d = { ...source };
  for (const [field] of FIELDS) {
    if (d[field] === SENTINEL && typeof protectedLinks[field] === "string") {
      d[field] = protectedLinks[field];
    }
  }
  if (Array.isArray(d.links)) {
    d.links = d.links.map((entry, i) => {
      if (!entry || typeof entry !== "object") return entry;
      const item = { ...(entry as Record<string, unknown>) };
      const key = "L" + i;
      if (item.u === SENTINEL && typeof protectedLinks[key] === "string") {
        item.u = protectedLinks[key];
      }
      return item;
    });
  }
  if (Array.isArray(d.versions)) {
    d.versions = d.versions.map((version, vi) => {
      if (!version || typeof version !== "object") return version;
      const v = { ...(version as Record<string, unknown>) };
      if (Array.isArray(v.links)) {
        v.links = v.links.map((entry, li) => {
          if (!entry || typeof entry !== "object") return entry;
          const item = { ...(entry as Record<string, unknown>) };
          const key = `V${vi}_${li}`;
          if (item.u === SENTINEL && typeof protectedLinks[key] === "string") {
            item.u = protectedLinks[key];
          }
          return item;
        });
      }
      return v;
    });
  }
  return d;
}

function linksOf(d: Record<string, unknown>): LinkRef[] {
  const out: LinkRef[] = [];
  const seen = new Set<string>();
  const add = (field: string, label: string, value: unknown) => {
    if (typeof value !== "string") return;
    const url = value.trim();
    if (!/^https?:\/\//i.test(url)) return;
    const key = field + "|" + url;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ field, label, url });
  };
  for (const [f, label] of FIELDS) add(f, label, d[f]);
  if (Array.isArray(d.links)) {
    d.links.forEach((x, i) => {
      if (!x || typeof x !== "object") return;
      const o = x as Record<string, unknown>;
      add("L" + i, String(o.t ?? "link").slice(0, 40), o.u);
    });
  }
  if (Array.isArray(d.versions)) {
    d.versions.forEach((version, vi) => {
      if (!version || typeof version !== "object") return;
      const v = version as Record<string, unknown>;
      if (!Array.isArray(v.links)) return;
      v.links.forEach((x, li) => {
        if (!x || typeof x !== "object") return;
        const o = x as Record<string, unknown>;
        add(`V${vi}_${li}`, `version_${vi + 1}_${String(o.t ?? "link").slice(0, 24)}`, o.u);
      });
    });
  }
  return out;
}

function declaredBytes(s: unknown): number {
  const m = String(s ?? "").match(
    /([0-9]+(?:[.,][0-9]+)?)\s*(KB|MB|GB|TB)/i,
  );
  if (!m) return 0;
  const n = parseFloat(m[1].replace(",", "."));
  const mul: Record<string, number> = {
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4,
  };
  return n * (mul[m[2].toUpperCase()] ?? 0);
}

function hostBlocked(h: string): boolean {
  const host = h.toLowerCase().replace(/^\[|\]$/g, "");
  if (host.includes(":")) return true;
  if (host === "localhost" || !host.includes(".")) return true;
  const bad = [".localhost", ".local", ".internal", ".lan", ".home"];
  if (bad.some((x) => host.endsWith(x))) return true;
  const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const a = +m[1], b = +m[2];
    if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  return false;
}

function guardUrl(u: URL): string {
  if (!/^https?:$/.test(u.protocol)) return "invalid_url";
  if (u.username || u.password) return "blocked_host";
  if (hostBlocked(u.hostname)) return "blocked_host";
  if (u.port && u.port !== "80" && u.port !== "443") {
    return "blocked_port";
  }
  return "";
}

class LinkError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

async function hop(
  url: string,
  method: string,
  range: boolean,
): Promise<Response> {
  const headers: Record<string, string> = {
    "User-Agent": UA,
    Accept: "*/*",
  };
  if (range) headers["Range"] = "bytes=0-65535";
  return await fetch(url, {
    method,
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(9000),
  });
}

async function follow(
  start: string,
  method: string,
  range: boolean,
): Promise<{ res: Response; finalUrl: URL }> {
  let cur = new URL(start);
  for (let i = 0; i < 6; i++) {
    const g = guardUrl(cur);
    if (g) throw new LinkError(g);
    const res = await hop(cur.href, method, range);
    const loc = res.headers.get("location");
    if ([301, 302, 303, 307, 308].includes(res.status) && loc) {
      res.body?.cancel();
      cur = new URL(loc, cur);
      continue;
    }
    return { res, finalUrl: cur };
  }
  throw new LinkError("too_many_redirects");
}

async function readSnippet(res: Response, max = 65536): Promise<string> {
  const rd = res.body?.getReader();
  if (!rd) return "";
  const dec = new TextDecoder("utf-8", { fatal: false });
  let out = "";
  let n = 0;
  try {
    while (n < max) {
      const { done, value } = await rd.read();
      if (done || !value) break;
      n += value.length;
      out += dec.decode(value, { stream: true });
    }
  } catch {
    return out;
  } finally {
    try {
      await rd.cancel();
    } catch {
      /* closed */
    }
  }
  return out;
}

function totalSize(res: Response): number {
  const cr = res.headers.get("content-range") ?? "";
  const m = cr.match(/\/(\d+)\s*$/);
  if (m) return +m[1];
  if (res.status === 206) return 0;
  const cl = Number(res.headers.get("content-length") ?? 0);
  return isFinite(cl) && cl > 0 ? cl : 0;
}

function out(
  status: string,
  http: number,
  reason: string,
  kind = "",
  size = 0,
): LinkResult {
  return { status, http, reason, kind, size };
}

async function classify(
  f: { res: Response; finalUrl: URL },
  origin: URL,
  field: string,
  declared: number,
): Promise<LinkResult> {
  const st = f.res.status;
  const host = f.finalUrl.hostname.toLowerCase();
  if (st === 404 || st === 410) {
    f.res.body?.cancel();
    return out("broken", st, "http_" + st);
  }
  if (st >= 400) {
    f.res.body?.cancel();
    return out("unverified", st, "http_" + (st >= 500 ? "5xx" : st));
  }
  if (st < 200 || st >= 300) {
    f.res.body?.cancel();
    return out("unverified", st, "http_other");
  }
  const homeJump = f.finalUrl.pathname === "/" &&
    origin.pathname.length > 1 && f.finalUrl.href !== origin.href;
  if (homeJump) {
    f.res.body?.cancel();
    return out("unverified", st, "redirected_to_home");
  }
  const ct = (f.res.headers.get("content-type") ?? "").toLowerCase();
  const cdp = (f.res.headers.get("content-disposition") ?? "")
    .toLowerCase();
  const size = totalSize(f.res);
  const isHtml = ct.includes("text/html") || ct.includes("xhtml");
  const expectFile = field === "dp" ||
    /\.(pkg|zip|rar|7z|iso|bin|exe)$/i.test(origin.pathname);
  if (!isHtml || cdp.includes("attachment")) {
    f.res.body?.cancel();
    if (declared > 0 && size > 0) {
      const ratio = size / declared;
      if (ratio < 0.2 || ratio > 5) {
        return out("unverified", st, "size_mismatch", "file", size);
      }
    }
    return out("ok", st, "file_ok", "file", size);
  }
  const body = await readSnippet(f.res);
  if (host.includes("google") &&
    /file you have requested does not exist/i.test(body)) {
    return out("broken", st, "file_removed", "page");
  }
  if (host.includes("mediafire") &&
    /Invalid or Deleted File/i.test(body)) {
    return out("broken", st, "file_removed", "page");
  }
  if (/file (was |has been )?(removed|deleted)|file not found/i
    .test(body)) {
    return out("unverified", st, "page_may_say_removed", "page");
  }
  if (expectFile) return out("unverified", st, "not_a_file", "page");
  return out("ok", st, "page_ok", "page");
}

function errorResult(e: unknown): { r: LinkResult; dns: boolean } {
  const msg = String((e as Error)?.message ?? e);
  const name = String((e as Error)?.name ?? "");

  if (e instanceof LinkError) {
    return { r: out("unverified", 0, e.code), dns: false };
  }

  if (name === "TimeoutError" || name === "AbortError") {
    return { r: out("unverified", 0, "timeout"), dns: false };
  }

  if (/lookup address|dns|name or service not known|no such host/i
    .test(msg)) {
    return { r: out("unverified", 0, "dns_error"), dns: true };
  }

  if (/certificate|tls|ssl/i.test(msg)) {
    return { r: out("unverified", 0, "tls_error"), dns: false };
  }

  return { r: out("unverified", 0, "network_error"), dns: false };
}

async function checkOnce(
  raw: string,
  field: string,
  declared: number,
): Promise<{ r: LinkResult; dns: boolean }> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { r: out("broken", 0, "invalid_url"), dns: false };
  }
  try {
    let f = await follow(u.href, "HEAD", false);
    const ct = (f.res.headers.get("content-type") ?? "").toLowerCase();
    const ok2 = f.res.status >= 200 && f.res.status < 300;
    if (!ok2 || ct === "" || ct.includes("text/html")) {
      f.res.body?.cancel();
      f = await follow(u.href, "GET", true);
    }
    return { r: await classify(f, u, field, declared), dns: false };
  } catch (e) {
    return errorResult(e);
  }
}

async function checkUrl(
  raw: string,
  field: string,
  declared: number,
): Promise<LinkResult> {
  const first = await checkOnce(raw, field, declared);
  if (!first.dns) return first.r;
  await new Promise((r) => setTimeout(r, 1200));
  const second = await checkOnce(raw, field, declared);
  if (second.dns) return out("broken", 0, "domain_not_found");
  return second.r;
}

type Task = {
  item_id: string;
  game: string;
  declared: number;
  ref: LinkRef;
  host: string;
};

type Row = {
  item_id: string;
  game: string;
  field: string;
  label: string;
  url: string;
  status: string;
  http: number;
  reason: string;
  kind: string;
};

async function runTasks(tasks: Task[], deadline: number): Promise<Row[]> {
  const rows: Row[] = [];
  const queue = [...tasks];
  const busy = new Set<string>();
  const worker = async () => {
    while (queue.length) {
      const i = queue.findIndex((t) => !busy.has(t.host));
      if (i < 0) {
        await new Promise((r) => setTimeout(r, 150));
        continue;
      }
      const t = queue.splice(i, 1)[0];
      busy.add(t.host);
      let r: LinkResult;
      if (Date.now() > deadline) {
        r = out("unverified", 0, "budget_exceeded");
      } else {
        r = await checkUrl(t.ref.url, t.ref.field, t.declared);
      }
      busy.delete(t.host);
      rows.push({
        item_id: t.item_id,
        game: t.game,
        field: t.ref.field,
        label: t.ref.label,
        url: t.ref.url,
        status: r.status,
        http: r.http,
        reason: r.reason,
        kind: r.kind,
      });
      await new Promise((x) => setTimeout(x, 250));
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return rows;
}

function hostOf(u: string): string {
  try {
    return new URL(u).hostname.toLowerCase();
  } catch {
    return "";
  }
}

async function persist(rows: Row[], itemIds: string[], startIso: string) {
  if (!SERVICE) return { saved: false, newlyBroken: [] as Row[] };
  const inList = itemIds.map((x) => '"' + x + '"').join(",");
  const prevRes = await svcDb(
    "link_checks?select=item_id,field,url,status&item_id=in.(" +
      encodeURIComponent(inList) + ")",
    "GET",
  );
  const prev = new Map<string, string>();
  if (prevRes && prevRes.ok) {
    const arr = await prevRes.json();
    for (const p of arr) {
      prev.set(p.item_id + "|" + p.field + "|" + p.url, p.status);
    }
  }
  const up = await svcDb(
    "link_checks?on_conflict=item_id,field,url",
    "POST",
    rows.map((r) => ({
      item_id: r.item_id,
      game: r.game,
      field: r.field,
      label: r.label,
      url: r.url,
      status: r.status,
      http_status: r.http,
      reason: r.reason,
      kind: r.kind,
      checked_at: startIso,
    })),
    { Prefer: "resolution=merge-duplicates,return=minimal" },
  );
  const saved = !!up && up.ok;
  if (saved) {
    for (const id of itemIds) {
      await svcDb(
        "link_checks?item_id=eq." + encodeURIComponent(id) +
          "&checked_at=lt." + encodeURIComponent(startIso),
        "DELETE",
      );
    }
  }
  const newlyBroken: Row[] = [];
  for (const r of rows) {
    const key = r.item_id + "|" + r.field + "|" + r.url;
    const fp = "lk:" + await sha(key);
    if (r.status === "broken") {
      await svcDb("rpc/report_site_error", "POST", {
        p_fingerprint: fp,
        p_kind: "broken_link",
        p_severity: "important",
        p_message: "broken_link:" + r.reason,
        p_detail: (r.game + " | " + r.label + " | " + r.url)
          .slice(0, 1500),
        p_location: "item:" + r.item_id + ":" + r.field,
        p_hint: "broken_link",
        p_ua: "",
      });
      if (prev.get(key) !== "broken") newlyBroken.push(r);
    } else if (r.status === "ok" && prev.get(key) === "broken") {
      await svcDb(
        "site_errors?fingerprint=eq." + encodeURIComponent(fp),
        "PATCH",
        { status: "resolved", resolved_at: new Date().toISOString() },
      );
    }
  }
  return { saved, newlyBroken };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }
  if (req.method !== "POST") return reply({ error: "method" }, 405);
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
  const apikey = req.headers.get("apikey") || ENV_ANON;
  if (!token || !SUPABASE_URL || !apikey) {
    return reply({ error: "unauthorized" }, 401);
  }
  if (!(await isStaff(token, apikey))) {
    return reply({ error: "forbidden" }, 403);
  }
  if (!rateOk()) return reply({ error: "rate_limited" }, 429);

  let action = "";
  let itemId = "";
  let offset = 0;
  let limit = 4;
  try {
    const b = await req.json();
    action = String(b?.action ?? "");
    itemId = String(b?.item_id ?? "");
    offset = Math.max(0, Math.floor(Number(b?.offset ?? 0)) || 0);
    const lim = Math.floor(Number(b?.limit ?? 4)) || 4;
    limit = Math.min(8, Math.max(1, lim));
  } catch {
    return reply({ error: "bad_request" }, 400);
  }

  if (action === "list") {
    const r = await svcDb(
      "link_checks?select=*&order=checked_at.desc&limit=500",
      "GET",
    );
    if (!r || !r.ok) return reply({ error: "read_failed" }, 502);
    return reply({ ok: true, rows: await r.json() });
  }

  if (itemId && !/^[A-Za-z0-9_-]{1,64}$/.test(itemId)) {
    return reply({ error: "bad_request" }, 400);
  }

  const q = itemId
    ? "items?select=id,data&id=eq." + encodeURIComponent(itemId)
    : "items?select=id,data&order=id.desc&offset=" + offset +
      "&limit=" + limit;

  let list: { id: unknown; data: Record<string, unknown> }[] = [];
  let total = 0;
  try {
    const r = await fetch(SUPABASE_URL + "/rest/v1/" + q, {
      headers: {
        apikey,
        Authorization: "Bearer " + token,
        Prefer: "count=exact",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return reply({ error: "items_read_failed" }, 502);
    list = await r.json();
    const cr = r.headers.get("content-range") ?? "";
    const m = cr.match(/\/(\d+)\s*$/);
    total = m ? +m[1] : list.length;
  } catch {
    return reply({ error: "items_read_failed" }, 502);
  }

  const tasks: Task[] = [];
  const itemIds: string[] = [];
  for (const it of list) {
    const d = it.data ?? {};
    if (!itemId && d["archived"]) continue;
    itemIds.push(String(it.id));
  }

  let protectedById: Map<string, Record<string, unknown>>;
  try {
    protectedById = await loadProtectedLinks(itemIds);
  } catch (e) {
    const reason = String((e as Error)?.message ?? e);
    return reply({ error: reason === "service_role_missing"
      ? "protected_links_unavailable"
      : "protected_links_read_failed" }, 502);
  }

  for (const it of list) {
    const raw = it.data ?? {};
    if (!itemId && raw["archived"]) continue;
    const id = String(it.id);
    const d = restoreProtectedLinks(raw, protectedById.get(id) ?? {});
    const game = String(d["a"] ?? d["n"] ?? "").slice(0, 120);
    const declared = declaredBytes(d["s"]);
    for (const ref of linksOf(d)) {
      tasks.push({
        item_id: id,
        game,
        declared,
        ref,
        host: hostOf(ref.url),
      });
    }
  }

  const startIso = new Date().toISOString();
  const rows = await runTasks(tasks, Date.now() + 100_000);
  const p = await persist(rows, itemIds, startIso);

  if (p.newlyBroken.length) {
    const lines = p.newlyBroken.slice(0, 8).map((r) =>
      "- " + r.game + " (" + (r.label || r.field) + ")\n " + r.url +
      "\n " + (T["r_" + r.reason] ?? r.reason)
    );
    await tgSend(
      T.alert_title + " (" + p.newlyBroken.length + ")\n\n" +
        lines.join("\n"),
    );
  }

  const next = offset + limit;
  return reply({
    ok: true,
    saved: p.saved,
    total,
    next_offset: itemId ? null : next,
    done: itemId ? true : next >= total,
    results: rows,
  });
});
