import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Stable slot: user_1 | user_2 — presentation names come from env. */
  profileSlot: text("profile_slot").notNull().unique(),
  email: text("email").unique(),
  displayName: text("display_name").notNull(),
  nickname: text("nickname"),
  /** Argon2id hash — never plaintext. Initialized from env, then user-changeable. */
  passwordHash: text("password_hash"),
  avatarMediaId: uuid("avatar_media_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
