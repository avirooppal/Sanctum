/**
 * Pure Domain Entities & Logic: Threads & Messages (Core Domain)
 */

import type { ChatMessage, ChatSession } from "../../contracts/types/index.ts";

export function createNewThread(
  id: string,
  modelId: string,
  title: string = "New Local Session",
  systemPrompt: string = "You are a private local assistant running entirely on-device."
): ChatSession {
  return {
    id,
    title,
    modelId,
    createdAt: "Just now",
    updatedAt: "Just now",
    systemPrompt,
    temperature: 0.7,
    topP: 0.9,
    messages: [],
  };
}

export function createMessage(
  role: "user" | "assistant" | "system",
  content: string
): ChatMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    role,
    content,
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}
