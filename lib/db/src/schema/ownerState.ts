import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * One versioned application document per Clerk user. A missing row means the
 * owner has never initialized server state; an empty JSON document is valid.
 */
export const ownerState = pgTable("owner_state", {
  ownerId: text("owner_id").primaryKey(),
  snapshot: jsonb("snapshot").$type<unknown>().notNull(),
  revision: integer("revision").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOwnerStateSchema = createInsertSchema(ownerState).omit({
  createdAt: true,
  updatedAt: true,
});
export type OwnerState = typeof ownerState.$inferSelect;
export type InsertOwnerState = z.infer<typeof insertOwnerStateSchema>;
