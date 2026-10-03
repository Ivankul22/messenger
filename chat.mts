import type { Config, Context } from "@netlify/functions";
import { randomInt } from "node:crypto";
import { getUser, type User } from "@netlify/identity";
import { and, asc, desc, eq, gt } from "drizzle-orm";
import { db } from "../../db/index.js";
import { messages, rooms } from "../../db/schema.js";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeRoomCode() {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_CHARS[randomInt(CODE_CHARS.length)];
  return code;
}

// Display name comes from the signed-in account, never from the request body
function displayName(user: User) {
  const name = String(user.name ?? user.userMetadata?.full_name ?? "").trim();
  return (name || user.email?.split("@")[0] || "User").slice(0, 30);
}

function cleanText(text: unknown, max = 2000) {
  return String(text ?? "").trim().slice(0, max);
}

function error(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

async function findRoom(code: string) {
  const [room] = await db.select().from(rooms).where(eq(rooms.code, code));
  return room;
}

function systemMessage(roomCode: string, name: string, text: string) {
  return db.insert(messages).values({ roomCode, kind: "system", name, text });
}

export default async (req: Request, context: Context) => {
  const code = context.params.code?.toUpperCase();
  const action = context.params.action;

  const user = await getUser();
  if (!user) return error("Please log in to continue.", 401);
  const username = displayName(user);

  // Create a room
  if (!code && req.method === "POST") {
    const body = await readJson(req);
    const name = cleanText(body.name, 40) || `${username}'s room`;

    for (let attempt = 0; attempt < 5; attempt++) {
      const [room] = await db
        .insert(rooms)
        .values({ code: makeRoomCode(), name })
        .onConflictDoNothing()
        .returning();
      if (room) {
        await systemMessage(room.code, username, `${username} created the room.`);
        return Response.json({ room, me: username }, { status: 201 });
      }
    }
    return error("Could not create a room, please try again.", 500);
  }

  // Rooms are private: there is no listing, they can only be reached by code
  if (!code) return error("Method not allowed", 405);

  const room = await findRoom(code);
  if (!room) return error("Room not found. Check the room code.", 404);

  if (action === "join" && req.method === "POST") {
    await systemMessage(code, username, `${username} joined the room.`);
    const recent = await db
      .select()
      .from(messages)
      .where(eq(messages.roomCode, code))
      .orderBy(desc(messages.id))
      .limit(200);
    return Response.json({ room, me: username, messages: recent.reverse() });
  }

  if (action === "leave" && req.method === "POST") {
    await systemMessage(code, username, `${username} left the room.`);
    return new Response(null, { status: 204 });
  }

  if (action === "messages" && req.method === "GET") {
    const after = Number(new URL(req.url).searchParams.get("after")) || 0;
    const newer = await db
      .select()
      .from(messages)
      .where(and(eq(messages.roomCode, code), gt(messages.id, after)))
      .orderBy(asc(messages.id))
      .limit(200);
    return Response.json({ messages: newer });
  }

  if (action === "messages" && req.method === "POST") {
    const body = await readJson(req);
    const text = cleanText(body.text);
    if (!text) return error("Message cannot be empty.");
    const [message] = await db
      .insert(messages)
      .values({ roomCode: code, kind: "chat", name: username, text })
      .returning();
    return Response.json({ message }, { status: 201 });
  }

  return error("Not found", 404);
};

export const config: Config = {
  path: ["/api/rooms", "/api/rooms/:code/:action"],
};
