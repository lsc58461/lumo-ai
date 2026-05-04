"use client";

import Link from "next/link";
import type { Session } from "next-auth";
import { useCallback, useMemo, useState } from "react";

import Chat, { type ChatComposerDraft } from "@/components/home/chat";
import LoginModal from "@/components/home/login-modal";
import Sidebar from "@/components/home/sidebar";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  createChatMessage,
  createClientSafeId,
  defaultChatProfile,
  deriveConversationFocus,
  deriveConversationPreview,
  upsertConversation,
} from "@/lib/chat-session";
import {
  toConversationPreview,
  type ChatMessage,
  type ConversationSession,
  type PromptTemplate,
} from "@/lib/lumo-content";

interface HomeShellProps {
  featuredPrompts: PromptTemplate[];
  initialConversations: ConversationSession[];
  initialProfiles: string[];
  initialProfile: string;
  initialSharedConversation: ConversationSession | null;
  isSharedView: boolean;
  kakaoReady: boolean;
  session: Session | null;
}

interface DeleteConversationResponse {
  success?: boolean;
  error?: string;
}

function createDraftConversation(
  featuredPrompts: PromptTemplate[],
  initialProfile: string,
): ConversationSession {
  const firstPrompt = featuredPrompts[0];

  return {
    id: `draft-${createClientSafeId("chat")}`,
    title: "새 채팅",
    focus: "새 질문을 시작해 보세요",
    updatedAt: "방금 전",
    preview: "아직 루모 AI 답변이 없습니다.",
    profile: initialProfile ?? defaultChatProfile,
    toneId: firstPrompt?.tone ?? "clear",
    tools: firstPrompt?.tools ?? ["saju", "astrology"],
    messages: [],
  };
}

function HomeShell({
  featuredPrompts,
  initialConversations,
  initialProfiles,
  initialProfile,
  initialSharedConversation,
  isSharedView,
  kakaoReady,
  session,
}: HomeShellProps) {
  const isAuthenticated = Boolean(session?.user);
  const [conversations, setConversations] = useState(initialConversations);
  const [savedProfiles, setSavedProfiles] = useState(initialProfiles);
  const [defaultProfileValue, setDefaultProfileValue] = useState(initialProfile);
  const [draftConversation, setDraftConversation] = useState(() =>
    createDraftConversation(featuredPrompts, initialProfile),
  );
  const [activeConversationId, setActiveConversationId] = useState(
    initialSharedConversation?.id ?? draftConversation.id,
  );
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [isSending, setIsSending] = useState(false);

  const activeConversation = useMemo(
    () =>
      (isSharedView && initialSharedConversation) ||
      conversations.find(({ id }) => id === activeConversationId) ||
      draftConversation,
    [
      activeConversationId,
      conversations,
      draftConversation,
      initialSharedConversation,
      isSharedView,
    ],
  );

  const conversationPreviews = useMemo(
    () => (isAuthenticated && !isSharedView ? conversations.map(toConversationPreview) : []),
    [conversations, isAuthenticated, isSharedView],
  );

  const upsertMessageContent = useCallback(
    (
      conversation: ConversationSession,
      messageId: string,
      content: string,
      pending: boolean,
    ): ConversationSession => ({
      ...conversation,
      preview:
        content.trim().length > 0 ? deriveConversationPreview(content) : conversation.preview,
      messages: conversation.messages.map((message) =>
        message.id === messageId ? { ...message, content, pending } : message,
      ),
    }),
    [],
  );

  const ensurePendingAssistantMessage = useCallback(
    (
      conversation: ConversationSession,
      pendingAssistantMessage: ChatMessage,
    ): ConversationSession => {
      if (conversation.messages.some(({ id }) => id === pendingAssistantMessage.id)) {
        return conversation;
      }

      return {
        ...conversation,
        messages: [...conversation.messages, pendingAssistantMessage],
      };
    },
    [],
  );

  const appendToolMessage = useCallback(
    (conversation: ConversationSession, toolMessage: ChatMessage): ConversationSession => {
      const nextMessages = conversation.messages.some(({ id }) => id === toolMessage.id)
        ? conversation.messages.map((message) =>
            message.id === toolMessage.id ? toolMessage : message,
          )
        : [
            ...conversation.messages.filter(
              (message) => !(message.role === "tool" && message.pending),
            ),
            toolMessage,
            ...conversation.messages.filter(
              (message) => message.pending && message.role !== "tool",
            ),
          ];

      return {
        ...conversation,
        messages: nextMessages,
        preview: deriveConversationPreview(toolMessage.content),
      };
    },
    [],
  );

  const handleOpenLoginModal = useCallback((): void => {
    setIsLoginModalOpen(true);
  }, []);

  const updateActiveConversation = useCallback(
    (nextConversation: ConversationSession): void => {
      if (activeConversationId === draftConversation.id) {
        setDraftConversation(nextConversation);
        return;
      }

      setConversations((currentConversations) =>
        currentConversations.map((conversation) =>
          conversation.id === nextConversation.id ? nextConversation : conversation,
        ),
      );
    },
    [activeConversationId, draftConversation.id],
  );

  const handleNewChat = useCallback((): void => {
    const nextDraftConversation = createDraftConversation(featuredPrompts, defaultProfileValue);

    setDraftConversation(nextDraftConversation);
    setActiveConversationId(nextDraftConversation.id);
    setRequestError("");
  }, [defaultProfileValue, featuredPrompts]);

  const handleSelectConversation = useCallback(
    (conversationId: string): void => {
      if (isSharedView) {
        return;
      }

      if (!isAuthenticated) {
        setIsLoginModalOpen(true);
        return;
      }

      setActiveConversationId(conversationId);
      setRequestError("");
    },
    [isAuthenticated, isSharedView],
  );

  const handleDeleteConversation = useCallback(
    async (conversationId: string): Promise<void> => {
      if (!isAuthenticated) {
        setIsLoginModalOpen(true);
        return;
      }

      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as DeleteConversationResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "채팅 삭제에 실패했습니다.");
      }

      setConversations((currentConversations) => {
        const nextConversations = currentConversations.filter(
          (conversation) => conversation.id !== conversationId,
        );

        if (activeConversationId === conversationId) {
          if (nextConversations[0]) {
            setActiveConversationId(nextConversations[0].id);
          } else {
            const nextDraftConversation = createDraftConversation(
              featuredPrompts,
              defaultProfileValue,
            );

            setDraftConversation(nextDraftConversation);
            setActiveConversationId(nextDraftConversation.id);
          }
        }

        return nextConversations;
      });
      setRequestError("");
    },
    [activeConversationId, defaultProfileValue, featuredPrompts, isAuthenticated],
  );

  const handleSaveProfile = useCallback(
    async (profile: string): Promise<void> => {
      if (!isAuthenticated) {
        setIsLoginModalOpen(true);
        return;
      }

      const response = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ profile }),
      });

      const data = (await response.json()) as {
        error?: string;
        activeProfile?: string;
        profiles?: string[];
      };

      if (!response.ok) {
        throw new Error(data.error ?? "프로필 저장에 실패했습니다.");
      }

      const nextActiveProfile = data.activeProfile ?? profile;
      const nextProfiles = data.profiles ?? [profile];

      setDefaultProfileValue(nextActiveProfile);
      setSavedProfiles(nextProfiles);
      setDraftConversation((currentConversation) => ({
        ...currentConversation,
        profile: nextActiveProfile,
      }));
    },
    [isAuthenticated],
  );

  const handleSelectSavedProfile = useCallback((profile: string): void => {
    setDefaultProfileValue(profile);
    setDraftConversation((currentConversation) => ({
      ...currentConversation,
      profile,
    }));
  }, []);

  const handleCreateShareLink = useCallback(async (conversationId: string): Promise<string> => {
    const response = await fetch("/api/share", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ conversationId }),
    });
    const data = (await response.json()) as {
      error?: string;
      shareId?: string;
    };

    if (!response.ok || !data.shareId) {
      throw new Error(data.error ?? "공유 링크 생성에 실패했습니다.");
    }

    return `${window.location.origin}/?share=${data.shareId}`;
  }, []);

  const handleSubmit = useCallback(
    async (draft: ChatComposerDraft): Promise<void> => {
      if (!isAuthenticated) {
        setIsLoginModalOpen(true);
        return;
      }

      const userMessage = createChatMessage("user", draft.question);
      const pendingToolMessage = createChatMessage(
        "tool",
        "도구들이 순차적으로 질문을 분석하는 중입니다.",
        {
          pending: true,
        },
      );
      const pendingAssistantMessage = createChatMessage("assistant", "", {
        pending: true,
      });
      const optimisticConversation: ConversationSession = {
        ...activeConversation,
        title:
          activeConversation.messages.length > 0 && !activeConversation.id.startsWith("draft-")
            ? activeConversation.title
            : "제목 요약 중…",
        focus: deriveConversationFocus(draft.question),
        updatedAt: "방금 전",
        preview: "도구 분석과 루모 AI 답변을 준비하는 중입니다.",
        profile: draft.profile,
        toneId: draft.toneId,
        tools: draft.tools,
        messages: [...activeConversation.messages, userMessage, pendingToolMessage],
      };

      updateActiveConversation(optimisticConversation);
      setIsSending(true);
      setRequestError("");

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversationId: activeConversation.id.startsWith("draft-")
              ? undefined
              : activeConversation.id,
            profile: draft.profile,
            question: draft.question,
            toneId: draft.toneId,
            tools: draft.tools,
            messages: [...activeConversation.messages, userMessage].map(
              ({ id, role, content, createdAt, toolResults: messageToolResults }) => ({
                id,
                role,
                content,
                createdAt,
                toolResults: messageToolResults,
              }),
            ),
          }),
        });

        if (response.status === 401) {
          setIsLoginModalOpen(true);
        }

        if (!response.ok) {
          const data = (await response.json()) as {
            error?: string;
          };

          throw new Error(data.error ?? "루모 AI 채팅 생성에 실패했습니다.");
        }

        if (!response.body) {
          throw new Error("스트리밍 응답을 읽을 수 없습니다.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let streamBuffer = "";
        let assistantContent = "";
        let streamedConversation = optimisticConversation;

        const applyStreamPayload = (
          payload:
            | { type: "tool"; message: ChatMessage }
            | { type: "chunk"; delta: string }
            | { type: "done"; conversation: ConversationSession }
            | { type: "error"; error: string },
        ): void => {
          if (payload.type === "tool") {
            streamedConversation = appendToolMessage(streamedConversation, payload.message);
            updateActiveConversation(streamedConversation);
            return;
          }

          if (payload.type === "chunk") {
            streamedConversation = ensurePendingAssistantMessage(
              streamedConversation,
              pendingAssistantMessage,
            );
            assistantContent += payload.delta;
            streamedConversation = upsertMessageContent(
              streamedConversation,
              pendingAssistantMessage.id,
              assistantContent,
              true,
            );
            updateActiveConversation(streamedConversation);
            return;
          }

          if (payload.type === "done") {
            setConversations((currentConversations) =>
              upsertConversation(currentConversations, payload.conversation),
            );
            setActiveConversationId(payload.conversation.id);
            setRequestError("");
            return;
          }

          throw new Error(payload.error);
        };

        const consumeReader = async (): Promise<void> => {
          const { done, value } = await reader.read();

          if (done) {
            return;
          }

          streamBuffer += decoder.decode(value, { stream: true });
          const lines = streamBuffer.split("\n");
          streamBuffer = lines.pop() ?? "";

          lines
            .filter((line) => line.trim().length > 0)
            .forEach((line) => {
              const payload = JSON.parse(line) as
                | { type: "tool"; message: ChatMessage }
                | { type: "chunk"; delta: string }
                | { type: "done"; conversation: ConversationSession }
                | { type: "error"; error: string };

              applyStreamPayload(payload);
            });

          await consumeReader();
        };

        await consumeReader();
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "루모 AI 채팅 생성 중 알 수 없는 오류가 발생했습니다.";

        updateActiveConversation({
          ...optimisticConversation,
          preview: deriveConversationPreview(draft.question),
          messages: [...activeConversation.messages, userMessage],
        });
        setRequestError(errorMessage);
        throw error instanceof Error ? error : new Error(errorMessage);
      } finally {
        setIsSending(false);
      }
    },
    [
      activeConversation,
      appendToolMessage,
      ensurePendingAssistantMessage,
      isAuthenticated,
      updateActiveConversation,
      upsertMessageContent,
    ],
  );

  return (
    <>
      <LoginModal
        kakaoReady={kakaoReady}
        open={isLoginModalOpen}
        onOpenChange={setIsLoginModalOpen}
      />

      <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
        {isSharedView ? (
          <header className="border-b border-white/10 bg-[#101119]/90 px-4 py-4 backdrop-blur-xl md:px-6">
            <div className="mx-auto flex w-full max-w-450 items-center justify-between gap-4">
              <Link href="/" className="flex items-center gap-3 text-zinc-100">
                <div className="font-display flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-lg font-semibold text-white">
                  L
                </div>
                <div>
                  <div className="text-sm font-semibold tracking-[0.24em] text-zinc-400 uppercase">
                    Lumo AI
                  </div>
                  <div className="text-sm text-zinc-200">운명을 비추는 사주 채팅</div>
                </div>
              </Link>

              <Button
                type="button"
                className="rounded-2xl bg-zinc-50 text-zinc-950 hover:bg-zinc-200"
                onClick={() => {
                  window.location.href = "/";
                }}
              >
                나도 루모 AI와 상담하기
              </Button>
            </div>
          </header>
        ) : null}

        <SidebarProvider defaultOpen className="min-h-0 flex-1 overflow-hidden">
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {!isSharedView ? (
              <Sidebar
                activeConversationId={activeConversationId}
                conversations={conversationPreviews}
                kakaoReady={kakaoReady}
                session={session}
                onDeleteConversation={handleDeleteConversation}
                onNewChat={handleNewChat}
                onOpenLoginModal={handleOpenLoginModal}
                onSelectConversation={handleSelectConversation}
              />
            ) : null}

            <SidebarInset className="h-full min-h-0 overflow-hidden bg-transparent">
              <div className="flex h-full min-h-0 w-full px-3 py-3 md:px-4 md:py-4">
                <Chat
                  activeConversation={activeConversation}
                  availableProfiles={savedProfiles}
                  featuredPrompts={featuredPrompts}
                  initialProfile={initialProfile}
                  isAuthenticated={isAuthenticated}
                  isReadOnly={isSharedView}
                  kakaoReady={kakaoReady}
                  isSending={isSending}
                  requestError={requestError}
                  onCreateShareLink={handleCreateShareLink}
                  onRequestLogin={handleOpenLoginModal}
                  onSaveProfile={handleSaveProfile}
                  onSelectSavedProfile={handleSelectSavedProfile}
                  onSubmit={handleSubmit}
                />
              </div>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </div>
    </>
  );
}

export default HomeShell;
