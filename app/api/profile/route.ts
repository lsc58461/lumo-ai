import { createHash } from "node:crypto";

import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getMongoDatabase, isMongoConfigured } from "@/lib/mongodb";
import { normalizeProfileIds, type SavedProfileRecord } from "@/lib/profile";

interface UserProfileDocument {
  userId: string;
  activeProfileId: string;
  activeProfileIds?: string[];
  name?: string | null;
  image?: string | null;
  updatedAt: string;
}

interface SavedProfileDocument {
  _id?: ObjectId;
  userId: string;
  value: string;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
}

function mapSavedProfileRecord(document: SavedProfileDocument): SavedProfileRecord {
  return {
    id: document._id?.toString() ?? "",
    value: document.value,
  };
}

function toObjectId(profileId: string): ObjectId | null {
  return ObjectId.isValid(profileId) ? new ObjectId(profileId) : null;
}

function buildProfileContentHash(profile: string): string {
  return createHash("sha256").update(profile.trim(), "utf8").digest("hex");
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
    profileId?: string;
    activeProfileIds?: string[];
  };
  const profile = body.profile?.trim();
  const profileId = body.profileId?.trim();
  const requestedActiveProfileIds = normalizeProfileIds(body.activeProfileIds ?? []);

  if (!profile && requestedActiveProfileIds.length === 0) {
    return NextResponse.json({ error: "저장할 출생 프로필이 비어 있습니다." }, { status: 400 });
  }

  if (!isMongoConfigured()) {
    return NextResponse.json({
      saved: false,
      activeProfileId: requestedActiveProfileIds[0] ?? profileId ?? "",
      activeProfileIds: requestedActiveProfileIds,
      profiles: [] as SavedProfileRecord[],
    });
  }

  try {
    const database = await getMongoDatabase();
    const savedProfilesCollection = database.collection<SavedProfileDocument>("savedProfiles");
    const userProfilesCollection = database.collection<UserProfileDocument>("userProfiles");
    const now = new Date().toISOString();
    let persistedProfileId = profileId ?? "";

    if (profile) {
      const contentHash = buildProfileContentHash(profile);
      const existingDuplicateProfile = await savedProfilesCollection.findOne({
        userId,
        contentHash,
      });

      if (profileId) {
        const objectId = toObjectId(profileId);

        if (!objectId) {
          return NextResponse.json({ error: "잘못된 프로필 ID입니다." }, { status: 400 });
        }

        if (
          existingDuplicateProfile &&
          existingDuplicateProfile._id?.toString() !== profileId
        ) {
          await savedProfilesCollection.deleteOne({ _id: objectId, userId });
          await savedProfilesCollection.updateOne(
            { _id: existingDuplicateProfile._id, userId },
            {
              $set: {
                updatedAt: now,
              },
            },
          );
          persistedProfileId = existingDuplicateProfile._id?.toString() ?? profileId;
        } else {
          await savedProfilesCollection.updateOne(
            { _id: objectId, userId },
            {
              $set: {
                value: profile,
                contentHash,
                updatedAt: now,
              },
            },
            { upsert: true },
          );
          persistedProfileId = profileId;
        }
      } else if (existingDuplicateProfile?._id) {
        await savedProfilesCollection.updateOne(
          { _id: existingDuplicateProfile._id, userId },
          {
            $set: {
              updatedAt: now,
            },
          },
        );
        persistedProfileId = existingDuplicateProfile._id.toString();
      } else {
        const insertResult = await savedProfilesCollection.insertOne({
          userId,
          value: profile,
          contentHash,
          createdAt: now,
          updatedAt: now,
        });
        persistedProfileId = insertResult.insertedId.toString();
      }
    }

    const nextProfiles = (
      await savedProfilesCollection
        .find({ userId })
        .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
        .toArray()
    ).map(mapSavedProfileRecord);
    const nextProfileIdSet = new Set(nextProfiles.map((savedProfile) => savedProfile.id));
    let nextActiveProfileIds = requestedActiveProfileIds.filter((savedProfileId) =>
      nextProfileIdSet.has(savedProfileId),
    );

    if (persistedProfileId && !nextActiveProfileIds.includes(persistedProfileId)) {
      if (nextActiveProfileIds.length < 2) {
        nextActiveProfileIds = [...nextActiveProfileIds, persistedProfileId];
      } else {
        nextActiveProfileIds = [
          nextActiveProfileIds[0] ?? persistedProfileId,
          persistedProfileId,
        ];
      }
    }

    nextActiveProfileIds = normalizeProfileIds(nextActiveProfileIds).filter((savedProfileId) =>
      nextProfileIdSet.has(savedProfileId),
    );
    const nextPrimaryProfileId = nextActiveProfileIds[0] ?? "";

    await userProfilesCollection.updateOne(
      { userId },
      {
        $set: {
          userId,
          activeProfileId: nextPrimaryProfileId,
          activeProfileIds: nextActiveProfileIds,
          name: userName,
          image: userImage,
          updatedAt: now,
        },
      },
      { upsert: true },
    );

    return NextResponse.json({
      saved: true,
      activeProfileId: nextPrimaryProfileId,
      activeProfileIds: nextActiveProfileIds,
      profiles: nextProfiles,
    });
  } catch {
    return NextResponse.json({
      saved: false,
      activeProfileId: requestedActiveProfileIds[0] ?? profileId ?? "",
      activeProfileIds: requestedActiveProfileIds,
      profiles: [] as SavedProfileRecord[],
    });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json(
      { error: "로그인 후에만 프로필을 삭제할 수 있습니다." },
      { status: 401 },
    );
  }

  const body = (await request.json()) as {
    profileId?: string;
  };
  const profileId = body.profileId?.trim();

  if (!profileId) {
    return NextResponse.json({ error: "삭제할 프로필이 비어 있습니다." }, { status: 400 });
  }

  if (!isMongoConfigured()) {
    return NextResponse.json({
      deleted: false,
      activeProfileId: "",
      activeProfileIds: [],
      profiles: [] as SavedProfileRecord[],
    });
  }

  try {
    const database = await getMongoDatabase();
    const objectId = toObjectId(profileId);

    if (!objectId) {
      return NextResponse.json({ error: "잘못된 프로필 ID입니다." }, { status: 400 });
    }

    const savedProfilesCollection = database.collection<SavedProfileDocument>("savedProfiles");
    const currentUserProfile = await database
      .collection<UserProfileDocument>("userProfiles")
      .findOne({ userId });

    await savedProfilesCollection.deleteOne({ _id: objectId, userId });

    const nextProfiles = (
      await savedProfilesCollection
        .find({ userId })
        .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
        .toArray()
    ).map(mapSavedProfileRecord);
    const nextProfileIdSet = new Set(nextProfiles.map((savedProfile) => savedProfile.id));
    const nextActiveProfileIds = normalizeProfileIds(
      (currentUserProfile?.activeProfileIds ?? []).filter(
        (savedProfileId) => savedProfileId !== profileId,
      ),
    ).filter((savedProfileId) => nextProfileIdSet.has(savedProfileId));
    const nextPrimaryProfileId = nextActiveProfileIds[0] ?? "";

    await database.collection<UserProfileDocument>("userProfiles").updateOne(
      { userId },
      {
        $set: {
          activeProfileId: nextPrimaryProfileId,
          activeProfileIds: nextActiveProfileIds,
          updatedAt: new Date().toISOString(),
        },
      },
    );

    return NextResponse.json({
      deleted: true,
      activeProfileId: nextPrimaryProfileId,
      activeProfileIds: nextActiveProfileIds,
      profiles: nextProfiles,
    });
  } catch {
    return NextResponse.json({ error: "프로필 삭제에 실패했습니다." }, { status: 500 });
  }
}
