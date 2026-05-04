import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { CONVERSATIONS_COLLECTION } from "@/lib/conversation-collection";
import { getMongoDatabase, isMongoConfigured } from "@/lib/mongodb";

interface RouteContext {
  params: Promise<{
    conversationId: string;
  }>;
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

  if (!isMongoConfigured()) {
    return NextResponse.json(
      { error: "저장소가 연결되지 않아 삭제할 수 없습니다." },
      { status: 503 },
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
