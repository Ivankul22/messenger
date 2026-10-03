import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

export const rooms = pgTable("rooms", {
  code: text().primaryKey(),
  name: text().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messages = pgTable(
  "messages",
  {
    id: serial().primaryKey(),
    roomCode: text("room_code")
      .notNull()
      .references(() => rooms.code, { onDelete: "cascade" }),
    // "chat" for user messages, "system" for join/leave notices
    kind: text().notNull().default("chat"),
    name: text().notNull(),
    text: text().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("messages_room_id_idx").on(t.roomCode, t.id)]
);
