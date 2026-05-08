import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { formatConversationUpdatedAt } from "@/lib/chat-session";
import { CONVERSATIONS_COLLECTION } from "@/lib/conversation-collection";
import {
  type ChatMessage,
  type ConversationSession,
  type PromptTemplate,
} from "@/lib/lumo-content";
import { getMongoDatabase } from "@/lib/mongodb";

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
  title: string;
  focus: string;
  preview: string;
  updatedAt: string | Date;
  profile: string;
  toneId: PromptTemplate["tone"];
  tools: PromptTemplate["tools"];
  messages: ChatMessageDocument[];
  userId?: string;
}

interface RouteContext {
  params: Promise<{
    conversationId: string;
  }>;
}

function mapConversationSession(document: ConversationSessionDocument): ConversationSession {
  return {
    id: document._id?.toString() ?? `conversation-${document.title}`,
    title: document.title,
    focus: document.focus,
    preview: document.preview,
    updatedAt: formatConversationUpdatedAt(document.updatedAt),
    profile: document.profile,
    toneId: document.toneId,
    tools: document.tools,
    messages: (document.messages ?? []).map((message, index) => ({
      id: message.id ?? `${document.title}-${index}`,
      role: message.role,
      content: message.content,
      createdAt:
        message.createdAt ??
        (typeof document.updatedAt === "string"
          ? document.updatedAt
          : document.updatedAt.toISOString()),
      toolResults: message.toolResults,
      followUpSuggestions: message.followUpSuggestions,
    })),
  };
}

export async function GET(_: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json(
      { error: "로그인 후에만 채팅을 불러올 수 있습니다." },
      { status: 401 },
    );
  }

  const { conversationId } = await context.params;

  if (!ObjectId.isValid(conversationId)) {
    return NextResponse.json({ error: "잘못된 채팅 ID입니다." }, { status: 400 });
  }

  const database = await getMongoDatabase();
  const conversation = await database
    .collection<ConversationSessionDocument>(CONVERSATIONS_COLLECTION)
    .findOne({
      _id: new ObjectId(conversationId),
      userId,
    });

  if (!conversation?._id) {
    return NextResponse.json({ error: "불러올 채팅을 찾지 못했습니다." }, { status: 404 });
  }

  return NextResponse.json({ conversation: mapConversationSession(conversation) });
}

export async function DELETE(_: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json(
      { error: "로그인 후에만 채팅을 삭제할 수 있습니다." },
      { status: 401 },
    );
  }

  const { conversationId } = await context.params;

  if (!ObjectId.isValid(conversationId)) {
    return NextResponse.json({ error: "잘못된 채팅 ID입니다." }, { status: 400 });
  }

  const database = await getMongoDatabase();
  const conversationObjectId = new ObjectId(conversationId);
  const result = await database.collection(CONVERSATIONS_COLLECTION).deleteOne({
    _id: conversationObjectId,
    userId,
  });

  if (!result.deletedCount) {
    return NextResponse.json({ error: "삭제할 채팅을 찾지 못했습니다." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
