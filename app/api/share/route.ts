import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { CONVERSATIONS_COLLECTION } from "@/lib/conversation-collection";
import { type ChatMessage, type PromptTemplate } from "@/lib/lumo-content";
import { getMongoDatabase, isMongoConfigured } from "@/lib/mongodb";

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

interface SharedConversationDocument extends ConversationSessionDocument {
  shareId: string;
  sharedAt: string;
  sourceConversationId: string;
  snapshotSignature?: string;
}

function buildSnapshotSignature(conversation: ConversationSessionDocument): string {
  return JSON.stringify({
    title: conversation.title,
    focus: conversation.focus,
    preview: conversation.preview,
    updatedAt: conversation.updatedAt,
    createdAt: conversation.createdAt,
    profile: conversation.profile,
    toneId: conversation.toneId,
    tools: conversation.tools,
    messages: conversation.messages,
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json(
      { error: "로그인 후에만 공유 링크를 만들 수 있습니다." },
      { status: 401 },
    );
  }

  if (!isMongoConfigured()) {
    return NextResponse.json({ error: "공유 링크를 만들 수 없습니다." }, { status: 503 });
  }

  const body = (await request.json()) as {
    conversationId?: string;
  };

  if (!body.conversationId || !ObjectId.isValid(body.conversationId)) {
    return NextResponse.json({ error: "공유할 대화를 찾을 수 없습니다." }, { status: 400 });
  }

  try {
    const database = await getMongoDatabase();
    const conversations =
      database.collection<ConversationSessionDocument>(CONVERSATIONS_COLLECTION);
    const sharedSnapshots = database.collection<SharedConversationDocument>(
      "sharedConversationSnapshots",
    );
    const conversationId = new ObjectId(body.conversationId);
    const conversation = await conversations.findOne({
      _id: conversationId,
      userId,
    });

    if (!conversation?._id) {
      return NextResponse.json({ error: "공유할 대화를 찾을 수 없습니다." }, { status: 404 });
    }

    const snapshotSignature = buildSnapshotSignature(conversation);
    const latestSharedSnapshot = await sharedSnapshots.findOne(
      {
        userId,
        sourceConversationId: conversation._id.toString(),
      },
      {
        sort: {
          sharedAt: -1,
        },
      },
    );

    if (latestSharedSnapshot) {
      const latestSnapshotSignature =
        latestSharedSnapshot.snapshotSignature ?? buildSnapshotSignature(latestSharedSnapshot);

      if (latestSnapshotSignature === snapshotSignature) {
        return NextResponse.json({ shareId: latestSharedSnapshot.shareId });
      }
    }

    const shareId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2);

    await sharedSnapshots.insertOne({
      shareId,
      sharedAt: new Date().toISOString(),
      sourceConversationId: conversation._id.toString(),
      snapshotSignature,
      userId,
      title: conversation.title,
      focus: conversation.focus,
      preview: conversation.preview,
      updatedAt: conversation.updatedAt,
      createdAt: conversation.createdAt,
      profile: conversation.profile,
      toneId: conversation.toneId,
      tools: conversation.tools,
      messages: conversation.messages,
    });

    return NextResponse.json({ shareId });
  } catch {
    return NextResponse.json({ error: "공유 링크 생성에 실패했습니다." }, { status: 500 });
  }
}
