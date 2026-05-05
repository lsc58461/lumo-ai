import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { CONVERSATIONS_COLLECTION } from "@/lib/conversation-collection";
import {
  buildFollowUpSuggestionsPrompt,
  getLumoAiClient,
  isLumoAiConfigured,
  LUMO_FALLBACK_MODEL,
  LUMO_PRIMARY_MODEL,
  type FollowUpSuggestionsPayload,
} from "@/lib/gemini";
import { type ChatMessage, type PromptTemplate } from "@/lib/lumo-content";
import { getMongoDatabase, isMongoConfigured } from "@/lib/mongodb";

export const runtime = "nodejs";

interface ChatMessageDocument {
  id?: string;
  role: ChatMessage["role"];
  content: string;
  createdAt?: string;
  toolResults?: ChatMessage["toolResults"];
  followUpSuggestions?: ChatMessage["followUpSuggestions"];
}

interface ConversationSessionDocument {
  _id?: ObjectId;
  userId?: string;
  title: string;
  focus: string;
  preview: string;
  updatedAt: string | Date;
  createdAt: string | Date;
  profile: string;
  toneId: PromptTemplate["tone"];
  tools: PromptTemplate["tools"];
  messages: ChatMessageDocument[];
}

function isChatMessageArray(value: unknown): value is FollowUpSuggestionsPayload["messages"] {
  return (
    Array.isArray(value) &&
    value.every(
      (message) =>
        message &&
        typeof message === "object" &&
        "role" in message &&
        (message.role === "user" || message.role === "assistant" || message.role === "tool") &&
        "content" in message &&
        typeof message.content === "string",
    )
  );
}

function isFollowUpPayload(value: unknown): value is FollowUpSuggestionsPayload & {
  conversationId?: string;
  assistantMessageId?: string;
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<FollowUpSuggestionsPayload> & {
    conversationId?: string;
    assistantMessageId?: string;
  };

  return (
    typeof payload.profile === "string" &&
    typeof payload.question === "string" &&
    typeof payload.toneId === "string" &&
    Array.isArray(payload.tools) &&
    isChatMessageArray(payload.messages) &&
    (typeof payload.conversationId === "undefined" ||
      typeof payload.conversationId === "string") &&
    (typeof payload.assistantMessageId === "undefined" ||
      typeof payload.assistantMessageId === "string")
  );
}

async function generateFollowUps(prompt: string, model: string): Promise<string[]> {
  const lumoAi = getLumoAiClient();
  const response = await lumoAi.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: 0.5,
      topP: 0.95,
      responseMimeType: "application/json",
    },
  });
  const rawText = response.text?.trim();

  if (!rawText) {
    return [];
  }

  const parsed = JSON.parse(rawText) as { suggestions?: unknown };

  if (!Array.isArray(parsed.suggestions)) {
    return [];
  }

  return Array.from(
    new Set(
      parsed.suggestions
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  ).slice(0, 3);
}

export async function POST(request: Request) {
  const body = (await request.json()) as unknown;

  if (!isFollowUpPayload(body)) {
    return NextResponse.json({ error: "잘못된 후속 질문 요청 형식입니다." }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json(
      { error: "로그인 후에만 후속 질문을 만들 수 있습니다." },
      { status: 401 },
    );
  }

  if (!isLumoAiConfigured()) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const prompt = buildFollowUpSuggestionsPrompt(body);
    const suggestions = await generateFollowUps(prompt, LUMO_PRIMARY_MODEL).catch(() =>
      generateFollowUps(prompt, LUMO_FALLBACK_MODEL),
    );

    if (
      suggestions.length > 0 &&
      isMongoConfigured() &&
      body.conversationId &&
      body.assistantMessageId &&
      ObjectId.isValid(body.conversationId)
    ) {
      const database = await getMongoDatabase();

      await database
        .collection<ConversationSessionDocument>(CONVERSATIONS_COLLECTION)
        .updateOne(
          {
            _id: new ObjectId(body.conversationId),
            userId,
            "messages.id": body.assistantMessageId,
          },
          {
            $set: {
              "messages.$.followUpSuggestions": suggestions,
            },
          },
        );
    }

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
