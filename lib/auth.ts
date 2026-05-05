import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { ObjectId } from "mongodb";
import type { Account, NextAuthOptions } from "next-auth";
import KakaoProvider from "next-auth/providers/kakao";

import { getMongoClient, getMongoDatabase, isMongoConfigured } from "@/lib/mongodb";

interface KakaoProfile {
  properties?: {
    nickname?: string;
    profile_image?: string;
  };
  kakao_account?: {
    profile?: {
      nickname?: string;
      profile_image_url?: string;
    };
  };
}

interface StoredUserProfile {
  _id?: ObjectId | string;
  name?: string | null;
  image?: string | null;
}

interface StoredAccountProfile {
  provider?: string;
  providerAccountId?: string;
  userId?: ObjectId | string;
}

interface StoredUserProfileDocument {
  userId: string;
  activeProfileId?: string;
  activeProfileIds?: string[];
  name?: string | null;
  image?: string | null;
  updatedAt?: string;
}

function buildUserIdQuery(userId: string) {
  const clauses: Record<string, ObjectId | string>[] = [{ _id: userId }];

  if (ObjectId.isValid(userId)) {
    clauses.push({ _id: new ObjectId(userId) });
  }

  return clauses.length === 1 ? clauses[0] : { $or: clauses };
}

function extractKakaoProfile(profile?: KakaoProfile) {
  return {
    name: profile?.kakao_account?.profile?.nickname ?? profile?.properties?.nickname,
    image:
      profile?.kakao_account?.profile?.profile_image_url ?? profile?.properties?.profile_image,
  };
}

function normalizeString(value?: string | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

async function syncUserProfile(
  userId: string,
  values: {
    name?: string | null;
    image?: string | null;
  },
) {
  if (!isMongoConfigured()) {
    return;
  }

  const updatePayload = Object.fromEntries(
    Object.entries(values).filter(([, value]) => typeof value === "string" && value.length > 0),
  );

  if (Object.keys(updatePayload).length === 0) {
    return;
  }

  const database = await getMongoDatabase();

  await database.collection<StoredUserProfile>("users").updateOne(buildUserIdQuery(userId), {
    $set: updatePayload,
  });
}

async function syncUserProfileDocument(
  userId: string,
  values: {
    name?: string | null;
    image?: string | null;
  },
) {
  if (!isMongoConfigured()) {
    return;
  }

  const updatePayload = Object.fromEntries(
    Object.entries(values).filter(([, value]) => typeof value === "string" && value.length > 0),
  );

  if (Object.keys(updatePayload).length === 0) {
    return;
  }

  const database = await getMongoDatabase();

  await database.collection<StoredUserProfileDocument>("userProfiles").updateOne(
    { userId },
    {
      $set: {
        userId,
        ...updatePayload,
        updatedAt: new Date().toISOString(),
      },
      $setOnInsert: {
        activeProfileId: "",
        activeProfileIds: [],
      },
    },
    { upsert: true },
  );
}

async function getStoredUserProfile(userId: string) {
  if (!isMongoConfigured()) {
    return null;
  }

  const database = await getMongoDatabase();

  return database.collection<StoredUserProfile>("users").findOne(buildUserIdQuery(userId));
}

async function getStoredUserProfileDocument(userId: string) {
  if (!isMongoConfigured()) {
    return null;
  }

  const database = await getMongoDatabase();

  return database.collection<StoredUserProfileDocument>("userProfiles").findOne({ userId });
}

async function resolveUserIdForSync(userId: string | undefined, account?: Account | null) {
  if (userId) {
    return userId;
  }

  if (!isMongoConfigured() || !account?.providerAccountId) {
    return undefined;
  }

  const database = await getMongoDatabase();
  const linkedAccount = await database.collection<StoredAccountProfile>("accounts").findOne({
    provider: account.provider,
    providerAccountId: account.providerAccountId,
  });

  if (!linkedAccount?.userId) {
    return undefined;
  }

  return String(linkedAccount.userId);
}

export function isKakaoAuthConfigured(): boolean {
  return Boolean(process.env.KAKAO_CLIENT_ID && process.env.KAKAO_CLIENT_SECRET);
}

const mongoConfigured = isMongoConfigured();
const kakaoConfigured = isKakaoAuthConfigured();

export const authOptions: NextAuthOptions = {
  adapter: mongoConfigured ? MongoDBAdapter(getMongoClient()) : undefined,
  session: {
    strategy: mongoConfigured ? "database" : "jwt",
  },
  providers: kakaoConfigured
    ? [
        KakaoProvider({
          clientId: process.env.KAKAO_CLIENT_ID ?? "",
          clientSecret: process.env.KAKAO_CLIENT_SECRET ?? "",
          authorization: {
            params: {
              scope: "profile_nickname profile_image",
            },
          },
        }),
      ]
    : [],
  pages: {
    signIn: "/",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      const resolvedUserId = await resolveUserIdForSync(user.id, account);

      if (!resolvedUserId) {
        return true;
      }

      const kakaoProfile = extractKakaoProfile(profile as KakaoProfile | undefined);
      const normalizedName = normalizeString(kakaoProfile.name) ?? normalizeString(user.name);
      const normalizedImage =
        normalizeString(kakaoProfile.image) ?? normalizeString(user.image);
      await Promise.all([
        syncUserProfile(resolvedUserId, {
          name: normalizedName,
          image: normalizedImage,
        }),
        syncUserProfileDocument(resolvedUserId, {
          name: normalizedName,
          image: normalizedImage,
        }),
      ]);

      return true;
    },
    async session({ session, token, user }) {
      if (!session.user) {
        return session;
      }

      const userId = user?.id ?? token.sub;
      const [storedUser, storedProfile] = userId
        ? await Promise.all([
            getStoredUserProfile(userId),
            getStoredUserProfileDocument(userId),
          ])
        : [null, null];
      const resolvedName =
        normalizeString(session.user.name) ??
        normalizeString(user?.name) ??
        normalizeString(storedUser?.name) ??
        normalizeString(storedProfile?.name);
      const resolvedImage =
        normalizeString(session.user.image) ??
        normalizeString(user?.image) ??
        normalizeString(storedUser?.image) ??
        normalizeString(storedProfile?.image);

      return {
        ...session,
        user: {
          ...session.user,
          id: userId,
          name: resolvedName,
          image: resolvedImage,
        },
      };
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
