import type { Config } from "@netlify/functions";
import { sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { downloads } from "../../db/schema.js";

// GET  /api/downloads        -> { [key]: count }
// POST /api/downloads {key}  -> { key, count }  (increments by 1)
export default async (req: Request) => {
  if (req.method === "GET") {
    const rows = await db.select().from(downloads);
    const out: Record<string, number> = {};
    for (const r of rows) out[r.key] = r.count;
    return Response.json(out, { headers: { "Cache-Control": "no-store" } });
  }

  if (req.method === "POST") {
    let key = "";
    try {
      const body = await req.json();
      key = String(body?.key ?? "").trim().slice(0, 200);
    } catch {}
    if (!key) return Response.json({ error: "key required" }, { status: 400 });

    const [row] = await db
      .insert(downloads)
      .values({ key, count: 1 })
      .onConflictDoUpdate({ target: downloads.key, set: { count: sql`${downloads.count} + 1` } })
      .returning();
    return Response.json(row);
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = { path: "/api/downloads" };
