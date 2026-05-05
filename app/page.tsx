import { getServerSession } from "next-auth";
import type { Session } from "next-auth";

import HomeShell from "@/components/home/home-shell";
import { authOptions, isKakaoAuthConfigured } from "@/lib/auth";
import { getHomePageData } from "@/lib/lumo-data";

interface HomePageProps {
  searchParams: Promise<{
    share?: string | string[];
  }>;
}

export default async function Home({ searchParams }: HomePageProps) {
  const session = await getServerSession(authOptions);
  const resolvedSearchParams = await searchParams;
  const shareId = Array.isArray(resolvedSearchParams.share)
    ? resolvedSearchParams.share[0]
    : resolvedSearchParams.share;
  const {
    featuredPrompts,
    conversationSessions,
    initialProfiles,
    initialActiveProfileIds,
    initialProfile,
    initialUserName,
    initialUserImage,
    sharedConversation,
    isSharedView,
  } = await getHomePageData(session?.user?.id, shareId);
  const kakaoReady = isKakaoAuthConfigured();
  const resolvedSession: Session | null = session
    ? {
        ...session,
        user: session.user
          ? {
              ...session.user,
              name: session.user.name ?? initialUserName,
              image: session.user.image ?? initialUserImage,
            }
          : session.user,
      }
    : null;

  return (
    <HomeShell
      featuredPrompts={featuredPrompts}
      initialConversations={conversationSessions}
      initialProfiles={initialProfiles}
      initialActiveProfileIds={initialActiveProfileIds}
      initialProfile={initialProfile}
      initialSharedConversation={sharedConversation}
      isSharedView={isSharedView}
      kakaoReady={kakaoReady}
      session={resolvedSession}
    />
  );
}
