import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getMongoDatabase, isMongoConfigured } from "@/lib/mongodb";

interface UserProfileDocument {
  userId: string;
  profile: string;
  name?: string | null;
  image?: string | null;
  updatedAt: string;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  const userId = session?.user?.id;
  const userName = session?.user?.name ?? null;
  const userImage = session?.user?.image ?? null;

  if (!userId) {
    return NextResponse.json(
      { error: "로그인 후에만 프로필을 저장할 수 있습니다." },
      { status: 401 },
    );
  }

  const body = (await request.json()) as {
    profile?: string;
  };
  const profile = body.profile?.trim();

  if (!profile) {
    return NextResponse.json({ error: "저장할 출생 프로필이 비어 있습니다." }, { status: 400 });
  }

  if (!isMongoConfigured()) {
    return NextResponse.json({ saved: false, profile });
  }

  try {
    const database = await getMongoDatabase();

    await database.collection<UserProfileDocument>("userProfiles").updateOne(
      { userId },
      {
        $set: {
          userId,
          profile,
          name: userName,
          image: userImage,
          updatedAt: new Date().toISOString(),
        },
      },
      { upsert: true },
    );

    return NextResponse.json({ saved: true, profile });
  } catch {
    return NextResponse.json({ saved: false, profile });
  }
}
