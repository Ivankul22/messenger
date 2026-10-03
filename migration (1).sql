CREATE TABLE "messages" (
	"id" serial PRIMARY KEY,
	"room_code" text NOT NULL,
	"kind" text DEFAULT 'chat' NOT NULL,
	"name" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"code" text PRIMARY KEY,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "messages_room_id_idx" ON "messages" ("room_code","id");--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_room_code_rooms_code_fkey" FOREIGN KEY ("room_code") REFERENCES "rooms"("code") ON DELETE CASCADE;