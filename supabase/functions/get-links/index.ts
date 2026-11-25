
const clean = (v: string | undefined): string =>
  (v ?? "").trim().replace(/^["']+|["']+$/g, "").trim();

function normOrigin(v: string | undefined): string {
  const t = clean(v);
  if (!t) return "";
  try {
    return new URL(t).origin;
  } catch (_e) {
    return t.replace(/\/+$/, "");
  }
}

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
const SERVICE = clean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
const TS_SECRET = clean(Deno.env.get("TURNSTILE_SECRET"));
const ALLOWED = normOrigin(Deno.env.get("ALLOWED_ORIGIN"));
const SITEVERIFY =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

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
    headers: Object.assign({}, CORS, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    }),
  });
}

function svcHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    apikey: SERVICE,
    "Content-Type": "application/json",
  };
  if (SERVICE.startsWith("eyJ")) {
    h.Authorization = "Bearer " + SERVICE;
  }
  return h;
}

async function rest(path: string): Promise<unknown> {
  const r = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    headers: svcHeaders(),
  });
  if (!r.ok) throw new Error("db " + r.status);
  return await r.json();
}

const hits: Record<string, number[]> = {};

function limited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits[ip] || []).filter((t) => now - t < 60000);
  arr.push(now);
  hits[ip] = arr;

  const keys = Object.keys(hits);
  if (keys.length > 2000) {
    for (const k of keys.slice(0, 1000)) delete hits[k];
  }
  return arr.length > 30;
}

type Settings = {
  mode: string;
  seconds: number;
  skip_premium: boolean;
};

async function loadSettings(): Promise<Settings | null> {
  try {
    const rows = (await rest(
      "site_settings?select=value&key=eq.dl_verify",
    )) as { value?: Record<string, unknown> }[];

    const v = rows && rows[0] ? rows[0].value : null;

    if (!v || typeof v !== "object" || Array.isArray(v)) return null;

    if (
      v.mode !== "off" &&
      v.mode !== "countdown" &&
      v.mode !== "turnstile"
    ) {
      return null;
    }

    let sec = 3;
    if (v.seconds !== undefined && v.seconds !== null) {
      sec = Number(v.seconds);
      if (!Number.isFinite(sec)) return null;
    }

    sec = Math.max(0, Math.min(30, Math.floor(sec)));

    return {
      mode: v.mode,
      seconds: sec,
      skip_premium: v.skip_premium !== false,
    };
  } catch (_e) {
    return null;
  }
}

const enc = new TextEncoder();

async function sign(id: number, ts: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode("get-links:" + SERVICE),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(id + ":" + ts),
  );

  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function makeTicket(id: number): Promise<string> {
  const ts = Date.now();
  return ts + "." + (await sign(id, ts));
}

async function ticketTime(id: number, t: string): Promise<number> {
  const parts = t.split(".");
  if (parts.length !== 2 || !/^[0-9]{10,16}$/.test(parts[0])) {
    return -1;
  }

  const ts = Number(parts[0]);
  const age = Date.now() - ts;

  if (age < 0 || age > 600000) return -1;

  const want = await sign(id, ts);
  if (want.length !== parts[1].length) return -1;

  let diff = 0;
  for (let i = 0; i < want.length; i++) {
    diff |= want.charCodeAt(i) ^ parts[1].charCodeAt(i);
  }

  return diff === 0 ? ts : -1;
}

async function callerInfo(
  tok: string,
  apikey: string,
): Promise<{ staff: boolean; premium: boolean }> {
  const res = { staff: false, premium: false };
  if (!tok || !apikey) return res;

  const base: Record<string, string> = {
    apikey,
    Authorization: "Bearer " + tok,
    "Content-Type": "application/json",
  };

  let uid = "";

  try {
    const u = await fetch(SUPABASE_URL + "/auth/v1/user", {
      headers: base,
    });

    if (!u.ok) return res;

    const uj = await u.json();
    uid = String(uj && uj.id ? uj.id : "");
  } catch (_e) {
    return res;
  }

  if (!uid) return res;

  for (const fn of ["is_admin", "is_staff"]) {
    try {
      const r = await fetch(
        SUPABASE_URL + "/rest/v1/rpc/" + fn,
        {
          method: "POST",
          headers: base,
          body: "{}",
        },
      );

      if (r.ok && (await r.json()) === true) {
        res.staff = true;
      }
    } catch (_e) {
    }
  }

  try {
    const p = (await rest(
      "profiles?select=premium_until&user_id=eq." +
        encodeURIComponent(uid),
    )) as { premium_until?: string }[];

    const pu =
      p && p[0] && p[0].premium_until ? p[0].premium_until : "";

    if (pu && Date.parse(pu) > Date.now()) {
      res.premium = true;
    }
  } catch (_e) {
  }

  return res;
}

async function verifyTurnstile(
  token: string,
  ip: string,
): Promise<boolean> {
  if (!TS_SECRET || !token || token.length > 2048) return false;

  const form = new URLSearchParams();
  form.set("secret", TS_SECRET);
  form.set("response", token);
  if (ip && ip !== "unknown") form.set("remoteip", ip);

  try {
    const r = await fetch(SITEVERIFY, {
      method: "POST",
      body: form,
    });

    if (!r.ok) return false;

    const j = await r.json();

    if (!j || j.success !== true) return false;

    if (ALLOWED) {
      const expectedHost = new URL(ALLOWED).hostname.toLowerCase();
      const actualHost = String(j.hostname || "").toLowerCase();

      if (actualHost !== expectedHost) return false;
    }

    return true;
  } catch (_e) {
    return false;
  }
}

function isUrl(t: unknown): boolean {
  return typeof t === "string" && /^https?:\/\//i.test(t);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  if (req.method !== "POST") {
    return reply({ error: "method" }, 405);
  }

  if (ALLOWED && req.headers.get("origin") !== ALLOWED) {
    return reply({ error: "origin" }, 403);
  }

  if (!SUPABASE_URL || !SERVICE) {
    return reply({ error: "config" }, 500);
  }

  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0].trim() || "unknown";

  if (limited(ip)) {
    return reply({ error: "rate" }, 429);
  }

  let body: {
    id?: unknown;
    token?: unknown;
    ticket?: unknown;
    step?: unknown;
  } = {};

  try {
    body = JSON.parse(await req.text());
  } catch (_e) {
    return reply({ error: "bad_request" }, 400);
  }

  const id = Number(body.id);

  if (!Number.isInteger(id) || id < 1) {
    return reply({ error: "bad_request" }, 400);
  }

  const settings = await loadSettings();

  const auth = req.headers.get("authorization") ?? "";
  const tok = auth.replace(/^Bearer\s+/i, "").trim();
  const apikey = req.headers.get("apikey") ?? "";

  const who = tok && tok !== apikey
    ? await callerInfo(tok, apikey)
    : { staff: false, premium: false };

  let pass = who.staff;

  if (!pass) {
    if (settings === null) {
      return reply({ error: "config" }, 503);
    }

    if (settings.skip_premium && who.premium) {
      pass = true;
    }
  }

  if (!pass && settings !== null) {
    if (settings.mode === "off") {
      pass = true;
    } else if (settings.mode === "turnstile") {
      const t = typeof body.token === "string" ? body.token : "";

      if (!t) return reply({ error: "verify" }, 403);

      if (!(await verifyTurnstile(t, ip))) {
        return reply({ error: "verify" }, 403);
      }

      pass = true;
    } else if (settings.seconds <= 0) {
      pass = true;
    } else {
      const tk = typeof body.ticket === "string" ? body.ticket : "";

      if (tk) {
        const ts = await ticketTime(id, tk);

        if (ts < 0) {
          return reply({ error: "ticket" }, 403);
        }

        const left = settings.seconds * 1000 - (Date.now() - ts);

        if (left > 0) {
          return reply(
            { error: "early", wait: Math.ceil(left / 1000) },
            403,
          );
        }

        pass = true;
      } else if (body.step === "start") {
        return reply({
          wait: settings.seconds,
          ticket: await makeTicket(id),
        });
      } else {
        return reply(
          { error: "wait", wait: settings.seconds },
          403,
        );
      }
    }
  }

  if (!pass) {
    return reply({ error: "verify" }, 403);
  }

  try {
    const rows = (await rest(
      "items?select=data&id=eq." + id,
    )) as { data?: Record<string, unknown> }[];

    const item = rows && rows[0] ? rows[0] : null;

    if (!item || !item.data) {
      return reply({ error: "not_found" }, 404);
    }

    if (item.data.archived && !who.staff) {
      return reply({ error: "not_found" }, 404);
    }

    const gl = (await rest(
      "game_links?select=links&item_id=eq." + id,
    )) as { links?: Record<string, unknown> }[];

    const stored =
      gl && gl[0] && gl[0].links ? gl[0].links : {};

    const links: Record<string, string> = {};

    for (const k of Object.keys(stored)) {
      if (isUrl(stored[k])) {
        links[k] = String(stored[k]);
      }
    }

    // مهم: لا نقرأ روابط التحميل من items.data.
    // المصدر الوحيد للروابط المحمية هو game_links.

    return reply({ links });
  } catch (_e) {
    return reply({ error: "db" }, 502);
  }
});
