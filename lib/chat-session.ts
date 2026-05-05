import {
  toolCatalog,
  type ChatMessage,
  type ChatRole,
  type ConversationSession,
  type ToolExecutionResult,
  type ToolKey,
} from "@/lib/lumo-content";

export const defaultChatProfile = "";
export const defaultChatQuestion = "";

export function createClientSafeId(prefix: string): string {
  const randomPart = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2);

  return `${prefix}-${randomPart}`;
}

export function createChatMessage(
  role: ChatRole,
  content: string,
  options?: {
    createdAt?: string;
    id?: string;
    pending?: boolean;
    toolResults?: ToolExecutionResult[];
    followUpSuggestions?: string[];
  },
): ChatMessage {
  return {
    id: options?.id ?? createClientSafeId(role),
    role,
    content,
    createdAt: options?.createdAt ?? new Date().toISOString(),
    pending: options?.pending ?? false,
    toolResults: options?.toolResults,
    followUpSuggestions: options?.followUpSuggestions,
  };
}

export function deriveConversationTitle(question: string, tools?: ToolKey[]): string {
  const normalizedQuestion = question.replace(/\s+/g, " ").trim();

  if (!normalizedQuestion) {
    const toolHeading = (tools ?? [])
      .slice(0, 2)
      .map((toolKey) => toolCatalog[toolKey]?.label ?? toolKey)
      .filter(Boolean)
      .join(" · ");

    return toolHeading || "새 채팅";
  }

  if (normalizedQuestion.length <= 18) {
    return normalizedQuestion;
  }

  return `${normalizedQuestion.slice(0, 17)}…`;
}

export function deriveConversationFocus(question: string): string {
  const normalizedQuestion = question.replace(/\s+/g, " ").trim();

  if (normalizedQuestion.length <= 36) {
    return normalizedQuestion;
  }

  return `${normalizedQuestion.slice(0, 35)}…`;
}

export function deriveConversationPreview(content: string): string {
  const normalizedContent = content.replace(/\s+/g, " ").trim();

  if (normalizedContent.length <= 88) {
    return normalizedContent;
  }

  return `${normalizedContent.slice(0, 87)}…`;
}

export function formatConversationUpdatedAt(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "방금 전";
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.floor((today.getTime() - targetDay.getTime()) / 86_400_000);

  if (dayDiff <= 0) {
    return "오늘";
  }

  if (dayDiff === 1) {
    return "어제";
  }

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  if (date.getFullYear() === now.getFullYear()) {
    return `${month}.${day}`;
  }

  return `${date.getFullYear()}.${month}.${day}`;
}

export function upsertConversation(
  conversations: ConversationSession[],
  nextConversation: ConversationSession,
): ConversationSession[] {
  return [
    nextConversation,
    ...conversations.filter(({ id }) => id !== nextConversation.id),
  ].slice(0, 12);
}
