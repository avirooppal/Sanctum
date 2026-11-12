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

export interface ThreadStoreSnapshot {
  revision: number;
  updatedAt: number;
  sessions: ChatSession[];
}

export function normalizeThreadSnapshot(raw: unknown): ThreadStoreSnapshot {
  if (Array.isArray(raw)) {
    return { revision: 0, updatedAt: 0, sessions: raw as ChatSession[] };
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const sessions = Array.isArray(obj.sessions) ? (obj.sessions as ChatSession[]) : [];
    const revision = typeof obj.revision === "number" ? obj.revision : 0;
    const updatedAt = typeof obj.updatedAt === "number" ? obj.updatedAt : 0;
    return { revision, updatedAt, sessions };
  }
  return { revision: 0, updatedAt: 0, sessions: [] };
}

function hasSubstantiveThreads(sessions: ChatSession[]): boolean {
  if (!sessions.length) return false;
  if (sessions.length > 1) return true;
  return (sessions[0]?.messages?.length ?? 0) > 0;
}

export function reconcileThreadSnapshots(
  hostRaw: unknown,
  local: ThreadStoreSnapshot,
  alreadyMigrated: boolean
): { winner: "host" | "local" | "none"; snapshot: ThreadStoreSnapshot; shouldPushToHost: boolean } {
  const host = normalizeThreadSnapshot(hostRaw);
  const hostHasData = host.sessions.length > 0 && (hasSubstantiveThreads(host.sessions) || host.revision > 0);
  const localHasData = hasSubstantiveThreads(local.sessions) || local.revision > 0;

  if (!hostHasData && localHasData && !alreadyMigrated) {
    const migrated: ThreadStoreSnapshot = {
      revision: Math.max(1, local.revision),
      updatedAt: local.updatedAt || Date.now(),
      sessions: local.sessions,
    };
    return { winner: "local", snapshot: migrated, shouldPushToHost: true };
  }

  if (hostHasData) {
    if (local.revision > host.revision || (local.revision === host.revision && local.updatedAt > host.updatedAt)) {
      return { winner: "local", snapshot: local, shouldPushToHost: true };
    }
    return { winner: "host", snapshot: host, shouldPushToHost: false };
  }

  return { winner: "none", snapshot: local, shouldPushToHost: false };
}
