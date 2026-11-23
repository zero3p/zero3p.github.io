const clean = (v: string | undefined): string =>
(v ?? "").trim().replace(/^["']+|["']+$/g, "").trim();
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE = clean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
const TG_TOKEN = clean(Deno.env.get("TELEGRAM_BOT_TOKEN"));
const TG_CHAT = clean(Deno.env.get("OWNER_TELEGRAM_CHAT_ID"));
const ALLOWED = clean(Deno.env.get("ALLOWED_ORIGIN"));
const CORS: Record<string, string> = {
"Access-Control-Allow-Origin": ALLOWED || "*",
"Access-Control-Allow-Headers":
"authorization, content-type, apikey, x-client-info",
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
"\u062a\u0646\u0628\u064a\u0647 ZE: \u062e\u0637\u0623 " +
"\u0645\u0647\u0645 \u0641\u064a \u0627\u0644\u0645" +
"\u0648\u0642\u0639",
l_kind:
"\u0627\u0644\u0646\u0648\u0639",
l_where:
"\u0627\u0644\u0645\u0643\u0627\u0646",
l_msg:
"\u0627\u0644\u0631\u0633\u0627\u0644\u0629",
l_count:
"\u0639\u062f\u062f \u0627\u0644\u0645\u0631\u0627" +
"\u062a",
l_hint:
"\u0627\u0644\u0633\u0628\u0628 \u0627\u0644\u0645" +
"\u062d\u062a\u0645\u0644",
k_supabase:
"\u0627\u062a\u0635\u0627\u0644 Supabase",
k_edge_function:
"Edge Function",
k_upload:
"\u0631\u0641\u0639 \u0645\u0644\u0641",
k_save:
"\u062d\u0641\u0638 \u0628\u064a\u0627\u0646\u0627" +
"\u062a",
k_load:
"\u062a\u062d\u0645\u064a\u0644 \u0628\u064a\u0627" +
"\u0646\u0627\u062a",
k_image:
"\u062a\u062d\u0645\u064a\u0644 \u0635\u0648\u0631" +
"\u0629",
k_js_error:
"\u062e\u0637\u0623 JavaScript",
k_promise:
"\u062e\u0637\u0623 \u063a\u064a\u0631 \u0645\u0639" +
"\u0627\u0644\u062c",
k_other:
"\u0623\u062e\u0631\u0649",
h_supabase_unreachable:
"\u062a\u0639\u0630\u0631 \u0627\u0644\u0648\u0635" +
"\u0648\u0644 \u0625\u0644\u0649 Supabase: \u062a\u062d" +
"\u0642\u0642 \u0623\u0646 \u0627\u0644\u0645\u0634" +
"\u0631\u0648\u0639 \u063a\u064a\u0631 \u0645\u062a" +
"\u0648\u0642\u0641 (Paused) \u0648\u0623\u0646 \u0627" +
"\u0644\u062e\u062f\u0645\u0629 \u062a\u0639\u0645" +
"\u0644.",
h_supabase_server_error:
"Supabase \u064a\u0631\u062c\u0639 \u062e\u0637\u0623 " +
"\u062e\u0627\u062f\u0645: \u0631\u0627\u062c\u0639 " +
"\u062d\u0627\u0644\u0629 \u0627\u0644\u0645\u0634" +
"\u0631\u0648\u0639 \u0648\u0633\u062c\u0644\u0627" +
"\u062a \u0642\u0627\u0639\u062f\u0629 \u0627\u0644" +
"\u0628\u064a\u0627\u0646\u0627\u062a.",
h_supabase_other:
"\u0637\u0644\u0628 \u0625\u0644\u0649 Supabase \u0641" +
"\u0634\u0644: \u0631\u0627\u062c\u0639 \u0627\u0644" +
"\u0633\u062c\u0644\u0627\u062a.",
h_edge_not_found:
"\u0627\u0644\u062f\u0627\u0644\u0629 \u063a\u064a" +
"\u0631 \u0645\u0646\u0634\u0648\u0631\u0629 \u0623" +
"\u0648 \u0627\u0633\u0645\u0647\u0627 \u0641\u064a " +
"\u0627\u0644\u0645\u0648\u0642\u0639 \u0644\u0627 " +
"\u064a\u0637\u0627\u0628\u0642 \u0627\u0633\u0645" +
"\u0647\u0627 \u0641\u064a Supabase.",
h_edge_unauthorized:
"\u0631\u064f\u0641\u0636 \u0627\u0644\u0637\u0644" +
"\u0628: \u0627\u0646\u062a\u0647\u062a \u0627\u0644" +
"\u062c\u0644\u0633\u0629 \u0623\u0648 \u062e\u064a" +
"\u0627\u0631 Verify JWT \u064a\u062d\u062a\u0627\u062c" +
" \u0636\u0628\u0637\u0627\u064b.",
h_edge_server_error:
"\u0627\u0644\u062f\u0627\u0644\u0629 \u0623\u0631" +
"\u062c\u0639\u062a \u062e\u0637\u0623 \u062f\u0627" +
"\u062e\u0644\u064a\u0627\u064b: \u0631\u0627\u062c" +
"\u0639 Logs \u0627\u0644\u062e\u0627\u0635\u0629 " +
"\u0628\u0647\u0627 \u0641\u064a Supabase.",
h_edge_unreachable:
"\u062a\u0639\u0630\u0631 \u0627\u0644\u0648\u0635" +
"\u0648\u0644 \u0625\u0644\u0649 \u0627\u0644\u062f" +
"\u0627\u0644\u0629: \u062a\u062d\u0642\u0642 \u0645" +
"\u0646 \u0646\u0634\u0631\u0647\u0627 \u0648\u0645" +
"\u0646 CORS.",
h_edge_other:
"\u0641\u0634\u0644 \u0627\u0633\u062a\u062f\u0639" +
"\u0627\u0621 \u0627\u0644\u062f\u0627\u0644\u0629: " +
"\u0631\u0627\u062c\u0639 Logs \u0627\u0644\u062e\u0627" +
"\u0635\u0629 \u0628\u0647\u0627.",
h_upload_failed:
"\u0641\u0634\u0644 \u0631\u0641\u0639 \u0645\u0644" +
"\u0641: \u0631\u0627\u062c\u0639 \u0633\u064a\u0627" +
"\u0633\u0627\u062a bucket \u0648\u062d\u062c\u0645 " +
"\u0627\u0644\u0645\u0644\u0641.",
h_save_denied:
"\u0631\u064f\u0641\u0636 \u0627\u0644\u062d\u0641" +
"\u0638: \u0633\u064a\u0627\u0633\u0627\u062a RLS " +
"\u0623\u0648 \u0627\u0646\u062a\u0647\u062a \u0627" +
"\u0644\u062c\u0644\u0633\u0629.",
h_save_invalid:
"\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644" +
"\u062d\u0641\u0638 \u0645\u0631\u0641\u0648\u0636" +
"\u0629: \u0639\u0645\u0648\u062f \u0646\u0627\u0642" +
"\u0635 \u0623\u0648 \u0642\u064a\u0645\u0629 \u063a" +
"\u064a\u0631 \u0635\u0627\u0644\u062d\u0629.",
h_save_failed:
"\u0641\u0634\u0644 \u062d\u0641\u0638 \u0627\u0644" +
"\u0628\u064a\u0627\u0646\u0627\u062a: \u0631\u0627" +
"\u062c\u0639 \u0633\u062c\u0644\u0627\u062a \u0642" +
"\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a" +
"\u0627\u0646\u0627\u062a.",
h_load_failed:
"\u0641\u0634\u0644 \u062a\u062d\u0645\u064a\u0644 " +
"\u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a: " +
"\u0631\u0627\u062c\u0639 \u0627\u062a\u0635\u0627" +
"\u0644 Supabase \u0648\u0633\u064a\u0627\u0633\u0627" +
"\u062a \u0627\u0644\u0642\u0631\u0627\u0621\u0629.",
h_image_failed:
"\u0635\u0648\u0631\u0629 \u0644\u0627 \u062a\u064f" +
"\u062d\u0645\u064e\u0651\u0644: \u0627\u0644\u0631" +
"\u0627\u0628\u0637 \u0645\u062d\u0630\u0648\u0641 " +
"\u0623\u0648 \u0627\u0644\u0645\u0644\u0641 \u063a" +
"\u064a\u0631 \u0639\u0627\u0645.",
h_js_error:
"\u062e\u0637\u0623 \u0628\u0631\u0645\u062c\u064a " +
"\u0641\u064a \u0627\u0644\u0648\u0627\u062c\u0647" +
"\u0629: \u0631\u0627\u062c\u0639 \u0627\u0644\u0645" +
"\u0648\u0642\u0639 \u0627\u0644\u0645\u0630\u0643" +
"\u0648\u0631 \u0648\u0633\u0637\u0631 \u0627\u0644" +
"\u0643\u0648\u062f.",
h_promise_rejection:
"\u062e\u0637\u0623 \u063a\u064a\u0631 \u0645\u0639" +
"\u0627\u0644\u062c \u0641\u064a \u0627\u0644\u0648" +
"\u0627\u062c\u0647\u0629: \u0631\u0627\u062c\u0639 " +
"\u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644.",
h_other:
"\u063a\u064a\u0631 \u0645\u0639\u0631\u0648\u0641: " +
"\u0631\u0627\u062c\u0639 \u0627\u0644\u062a\u0641" +
"\u0627\u0635\u064a\u0644.",
};
const KINDS = [
"js_error",
"promise",
"supabase",
"edge_function",
"upload",
"save",
"load",
"image",
"other",
];
const IMPORTANT = ["supabase", "edge_function", "upload", "save", "load"];
const SECRET_KEYS = "apikey|api_key|access_token|refresh_token|" +
"password|passwd|secret|token";
const SECRET_RE = new RegExp(
"(" + SECRET_KEYS + ")([\"']?\\s*[:=]\\s*[\"']?)[^&\\s\"',}]+",
"gi",
);
const JWT_RE = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g;
function scrub(s: string): string {
return s
.replace(JWT_RE, "[jwt]")
.replace(/sb_(publishable|secret)_[A-Za-z0-9_-]+/g, "[key]")
.replace(/Bearer\s+[A-Za-z0-9._~+\/=-]+/gi, "Bearer [x]")
.replace(SECRET_RE, "$1$2[x]")
.replace(/(https?:\/\/[^\s?#"']+)\?[^\s"']*/g, "$1")
.replace(/\0/g, "");
}
function field(v: unknown, max: number): string {
return scrub(String(v ?? "")).slice(0, max).trim();
}
function normalize(s: string): string {
return s
.toLowerCase()
.replace(/[0-9a-f]{16,}/g, "x")
.replace(/[0-9]+/g, "#")
.replace(/\s+/g, " ")
.slice(0, 160);
}
function hintFor(kind: string, status: number, msg: string): string {
const net = status === 0 || /failed to fetch|network|load failed/i
.test(msg);
if (kind === "supabase") {
if (status >= 500) return "supabase_server_error";
return net ? "supabase_unreachable" : "supabase_other";
}
if (kind === "edge_function") {
if (status === 404) return "edge_not_found";
if (status === 401 || status === 403) return "edge_unauthorized";
if (status >= 500) return "edge_server_error";
return net ? "edge_unreachable" : "edge_other";
}
if (kind === "upload") return "upload_failed";
if (kind === "save") {
if (status === 401 || status === 403) return "save_denied";
if (status === 400 || status === 422) return "save_invalid";
return "save_failed";
}
if (kind === "load") return "load_failed";
if (kind === "image") return "image_failed";
if (kind === "js_error") return "js_error";
if (kind === "promise") return "promise_rejection";
return "other";
}
const hits = new Map<string, { t: number; n: number }>();
let gStart = 0, gCount = 0;
function rateOk(ip: string): boolean {
const now = Date.now();
if (now - gStart > 60_000) { gStart = now; gCount = 0; hits.clear(); }
if (++gCount > 200) return false;
const h = hits.get(ip) ?? { t: now, n: 0 };
h.n++;
hits.set(ip, h);
return h.n <= 20;
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
method,
return await fetch(SUPABASE_URL + "/rest/v1/" + path, {
headers: svcHeaders(extra),
body: body === undefined ? undefined : JSON.stringify(body),
signal: AbortSignal.timeout(10000),
});
} catch {
return null;
}
}
async function countRows(path: string): Promise<number> {
const r = await svcDb(path, "GET", undefined, {
Prefer: "count=exact",
Range: "0-0",
});
const cr = r?.headers.get("content-range") ?? "";
const m = cr.match(/\/(\d+)\s*$/);
return m ? +m[1] : 0;
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
async function adminAction(
req: Request,
b: Record<string, unknown>,
): Promise<Response> {
const auth = req.headers.get("authorization") ?? "";
const token = auth.toLowerCase().startsWith("bearer ")
? auth.slice(7).trim()
: "";
const apikey = req.headers.get("apikey") ?? "";
if (!token || !apikey) return reply({ error: "unauthorized" }, 401);
if (!(await rpcBool("is_admin", token, apikey))) {
return reply({ error: "forbidden" }, 403);
}
const action = String(b.action);
if (action === "list") {
const only = b.status === "all" ? "" : "&status=eq.new";
const r = await svcDb(
"site_errors?select=*&order=last_seen.desc&limit=100" + only,
"GET",
);
if (!r || !r.ok) return reply({ error: "read_failed" }, 502);
const rows = await r.json();
const newCount = await countRows(
"site_errors?select=id&status=eq.new",
);
return reply({ ok: true, rows, new_count: newCount });
}
if (action === "resolve") {
const id = String(b.id ?? "");
if (!/^\d{1,18}$/.test(id)) {
return reply({ error: "bad_request" }, 400);
}
const done = b.resolved !== false;
const r = await svcDb("site_errors?id=eq." + id, "PATCH", {
status: done ? "resolved" : "new",
resolved_at: done ? new Date().toISOString() : null,
});
if (!r || !r.ok) return reply({ error: "write_failed" }, 502);
return reply({ ok: true });
}
return reply({ error: "bad_request" }, 400);
}
Deno.serve(async (req: Request) => {
if (req.method === "OPTIONS") {
return new Response("ok", { headers: CORS });
}
if (req.method !== "POST") return reply({ error: "method" }, 405);
const origin = req.headers.get("origin") ?? "";
if (ALLOWED && origin && origin !== ALLOWED) return reply({ ok: true });
if (Number(req.headers.get("content-length") ?? 0) > 8192) {
return reply({ error: "too_large" }, 413);
}
const fwd = req.headers.get("x-forwarded-for") ?? "";
const ip = fwd.split(",")[0].trim() || "unknown";
if (!rateOk(ip)) return reply({ error: "rate_limited" }, 429);
if (!SERVICE || !SUPABASE_URL) {
return reply({ error: "not_configured" }, 503);
}
let b: Record<string, unknown> = {};
try {
b = await req.json();
} catch {
return reply({ error: "bad_request" }, 400);
}
if (b.action) return await adminAction(req, b);
const kind = KINDS.includes(String(b.kind)) ? String(b.kind) : "other";
const message = field(b.message, 300);
if (message.length < 2) return reply({ error: "bad_request" }, 400);
const detail = field(b.detail, 1500);
const location = field(b.location, 200);
const ua = field(b.ua, 200);
const status = Math.max(0, Math.floor(Number(b.status ?? 0)) || 0);
const severity = IMPORTANT.includes(kind) ? "important" : "normal";
const hint = hintFor(kind, status, message);
const hourAgo = new Date(Date.now() - 3600_000).toISOString();
const fresh = await countRows(
"site_errors?select=id&first_seen=gt." + encodeURIComponent(hourAgo),
);
if (fresh >= 400) return reply({ ok: true, dropped: true });
const fp = await sha(kind + "|" + location + "|" + normalize(message));
const rr = await svcDb("rpc/report_site_error", "POST", {
p_fingerprint: fp,
p_kind: kind,
p_severity: severity,
p_message: message,
p_detail: detail || null,
p_location: location || null,
p_hint: hint,
p_ua: ua || null,
});
if (!rr || !rr.ok) {
console.error("report_site_error rpc failed", rr?.status ?? 0);
return reply({ error: "store_failed" }, 502);
}
const rows = await rr.json();
const row = Array.isArray(rows) ? rows[0] : rows;
if (!row) return reply({ ok: true });
const last = row.last_alert_at ? Date.parse(row.last_alert_at) : 0;
const cooled = Date.now() - last > 6 * 3600_000;
const should = cooled && (severity === "important" || row.cnt >= 10);
if (should) {
const recent = await countRows(
"site_errors?select=id&last_alert_at=gt." +
encodeURIComponent(hourAgo),
);
if (recent < 15) {
const text = T.alert_title + "\n" +
T.l_kind + ": " + (T["k_" + kind] ?? kind) + "\n" +
T.l_where + ": " + (location || "-") + "\n" +
T.l_msg + ": " + message + "\n" +
T.l_count + ": " + row.cnt + "\n" +
T.l_hint + ": " + (T["h_" + hint] ?? "-");
if (await tgSend(text)) {
await svcDb(
"site_errors?id=eq." + encodeURIComponent(String(row.id)),
"PATCH",
{ last_alert_at: new Date().toISOString() },
);
}
}
}
return reply({ ok: true });
});
