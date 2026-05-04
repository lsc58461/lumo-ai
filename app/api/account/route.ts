import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { CONVERSATIONS_COLLECTION } from "@/lib/conversation-collection";
import { getMongoDatabase, isMongoConfigured } from "@/lib/mongodb";

function buildUserReferenceQuery(fieldName: string, userId: string) {
  const clauses: Record<string, ObjectId | string>[] = [{ [fieldName]: userId }];

  if (ObjectId.isValid(userId)) {
    clauses.push({ [fieldName]: new ObjectId(userId) });
  }

  return clauses.length === 1 ? clauses[0] : { $or: clauses };
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "로그인 상태를 확인할 수 없습니다." }, { status: 401 });
  }

  if (!isMongoConfigured()) {
    return NextResponse.json({ error: "계정 삭제를 처리할 수 없습니다." }, { status: 503 });
  }

  try {
    const database = await getMongoDatabase();
    const userIdQuery = buildUserReferenceQuery("userId", userId);
    const userPrimaryKeyQuery = buildUserReferenceQuery("_id", userId);

    await Promise.all([
      database.collection("userProfiles").deleteMany({ userId }),
      database.collection(CONVERSATIONS_COLLECTION).deleteMany({ userId }),
      database.collection("sharedConversationSnapshots").deleteMany({ userId }),
      database.collection("accounts").deleteMany(userIdQuery),
      database.collection("sessions").deleteMany(userIdQuery),
      database.collection("users").deleteMany(userPrimaryKeyQuery),
    ]);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "회원 탈퇴 처리에 실패했습니다." }, { status: 500 });
  }
}
