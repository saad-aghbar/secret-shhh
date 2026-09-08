"use server";

import { randomUUID } from "node:crypto";

import { resolveAuthorizedSession } from "@/lib/auth/session";
import { sendTextMessage } from "@/lib/chat/send";
import type { ChatMessage } from "@/lib/chat/types";
import { sendMessageSchema } from "@/lib/validation/chat";

export async function sendMessageAction(input: {
  text: unknown;
  clientGeneratedId: unknown;
}): Promise<{ ok: true; message: ChatMessage } | { ok: false; error: string }> {
  const session = await resolveAuthorizedSession();
  if (!session) {
    return { ok: false, error: "Please sign in." };
  }

  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success || !parsed.data.text) {
    return { ok: false, error: "That message couldn’t be sent." };
  }

  try {
    const message = await sendTextMessage({
      requestId: randomUUID(),
      userId: session.user.id,
      conversationId: session.conversationId,
      text: parsed.data.text,
      clientGeneratedId: parsed.data.clientGeneratedId,
    });
    return { ok: true, message };
  } catch {
    return { ok: false, error: "Message couldn’t send. Try again." };
  }
}
