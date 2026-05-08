import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";

import HomeShell from "@/components/home/home-shell";
import { authOptions, isKakaoAuthConfigured } from "@/lib/auth";
import { toConversationPreview } from "@/lib/lumo-content";
import { getConversationById, getHomePageData } from "@/lib/lumo-data";

interface ConversationPageProps {
  params: Promise<{
    conversationId: string;
  }>;
}

export default async function ConversationPage({ params }: ConversationPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/");
  }

  const { conversationId } = await params;
  const [homePageData, conversation] = await Promise.all([
    getHomePageData(session.user.id),
    getConversationById(session.user.id, conversationId),
  ]);

  if (!conversation) {
    redirect("/");
  }

  const initialConversationPreviews = homePageData.conversationPreviews.some(
    ({ id }) => id === conversation.id,
  )
    ? homePageData.conversationPreviews
    : [toConversationPreview(conversation), ...homePageData.conversationPreviews].slice(0, 12);
  const kakaoReady = isKakaoAuthConfigured();
  const resolvedSession: Session | null = {
    ...session,
    user: session.user
      ? {
          ...session.user,
          name: session.user.name ?? homePageData.initialUserName,
          image: session.user.image ?? homePageData.initialUserImage,
        }
      : session.user,
  };

  return (
    <HomeShell
      featuredPrompts={homePageData.featuredPrompts}
      initialConversation={conversation}
      initialConversationPreviews={initialConversationPreviews}
      initialProfiles={homePageData.initialProfiles}
      initialActiveProfileIds={homePageData.initialActiveProfileIds}
      initialProfile={homePageData.initialProfile}
      initialSharedConversation={null}
      isSharedView={false}
      kakaoReady={kakaoReady}
      session={resolvedSession}
    />
  );
}
