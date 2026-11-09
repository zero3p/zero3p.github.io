import { pgTable, text, integer } from "drizzle-orm/pg-core";

export const downloads = pgTable("downloads", {
  key: text().primaryKey(),
  count: integer().notNull().default(0),
});
