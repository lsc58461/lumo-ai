import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getMongoDatabase, isMongoConfigured } from "@/lib/mongodb";
import { normalizeProfileSelection } from "@/lib/profile";

interface UserProfileDocument {
  userId: string;
  activeProfile: string;
  activeProfiles?: string[];
  profiles: string[];
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
    previousProfile?: string;
    activeProfiles?: string[];
  };
  const profile = body.profile?.trim();
  const previousProfile = body.previousProfile?.trim();
  const requestedActiveProfiles = normalizeProfileSelection(body.activeProfiles ?? []);

  if (!profile && requestedActiveProfiles.length === 0) {
    return NextResponse.json({ error: "저장할 출생 프로필이 비어 있습니다." }, { status: 400 });
  }

  const primaryProfile = requestedActiveProfiles[0] ?? profile ?? "";
  const activeProfiles =
    requestedActiveProfiles.length > 0 ? requestedActiveProfiles : [primaryProfile];

  if (!isMongoConfigured()) {
    return NextResponse.json({
      saved: false,
      activeProfile: primaryProfile,
      activeProfiles,
      profiles: profile ? [profile] : requestedActiveProfiles,
    });
  }

  try {
    const database = await getMongoDatabase();
    const currentUserProfile = await database
      .collection<UserProfileDocument>("userProfiles")
      .findOne({ userId });
    const currentProfiles = currentUserProfile?.profiles ?? [];
    let nextProfiles = currentProfiles;

    if (profile) {
      if (previousProfile) {
        nextProfiles = Array.from(
          new Set(
            currentProfiles.map((savedProfile) =>
              savedProfile === previousProfile ? profile : savedProfile,
            ),
          ),
        );
      } else {
        nextProfiles = Array.from(new Set([...currentProfiles, profile]));
      }
    }

    await database.collection<UserProfileDocument>("userProfiles").updateOne(
      { userId },
      {
        $set: {
          userId,
          activeProfile: primaryProfile,
          activeProfiles,
          profiles: nextProfiles,
          name: userName,
          image: userImage,
          updatedAt: new Date().toISOString(),
        },
      },
      { upsert: true },
    );

    const nextUserProfile = await database
      .collection<UserProfileDocument>("userProfiles")
      .findOne({ userId });

    return NextResponse.json({
      saved: true,
      activeProfile: nextUserProfile?.activeProfile ?? primaryProfile,
      activeProfiles: nextUserProfile?.activeProfiles ?? activeProfiles,
      profiles: nextUserProfile?.profiles ?? nextProfiles,
    });
  } catch {
    return NextResponse.json({
      saved: false,
      activeProfile: primaryProfile,
      activeProfiles,
      profiles: profile ? [profile] : requestedActiveProfiles,
    });
  }
}
