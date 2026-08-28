import { bigint, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Upload intent and ownership record for private App Storage objects. */
export const ownerMedia = pgTable("owner_media", {
  objectPath: text("object_path").primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  contentType: text("content_type").notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertOwnerMediaSchema = createInsertSchema(ownerMedia).omit({
  createdAt: true,
  completedAt: true,
});
export type OwnerMedia = typeof ownerMedia.$inferSelect;
export type InsertOwnerMedia = z.infer<typeof insertOwnerMediaSchema>;