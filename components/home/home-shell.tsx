"use client";

import Link from "next/link";
import type { Session } from "next-auth";
import { useCallback, useEffect, useMemo, useState } from "react";

import Chat, { type ChatComposerDraft } from "@/components/home/chat";
import LoginModal from "@/components/home/login-modal";
import Sidebar from "@/components/home/sidebar";
import TutorialOverlay from "@/components/home/tutorial-modal";
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
  type ConversationPreview,
  type ConversationSession,
  type PromptTemplate,
} from "@/lib/lumo-content";
import {
  normalizeProfileIds,
  resolveSavedProfileValues,
  serializeProfileSelection,
  type SavedProfileRecord,
} from "@/lib/profile";

interface HomeShellProps {
  featuredPrompts: PromptTemplate[];
  initialConversationPreviews: ConversationPreview[];
  initialProfiles: SavedProfileRecord[];
  initialActiveProfileIds: string[];
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

interface GetConversationResponse {
  conversation?: ConversationSession;
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

function createPreviewPlaceholderConversation(
  preview: ConversationPreview,
  featuredPrompts: PromptTemplate[],
  initialProfile: string,
): ConversationSession {
  const firstPrompt = featuredPrompts[0];

  return {
    ...preview,
    profile: initialProfile ?? defaultChatProfile,
    toneId: firstPrompt?.tone ?? "clear",
    tools: firstPrompt?.tools ?? ["saju", "astrology"],
    messages: [],
  };
}

function upsertConversationPreview(
  previews: ConversationPreview[],
  nextPreview: ConversationPreview,
): ConversationPreview[] {
  return [nextPreview, ...previews.filter(({ id }) => id !== nextPreview.id)].slice(0, 12);
}

function HomeShell({
  featuredPrompts,
  initialConversationPreviews,
  initialProfiles,
  initialActiveProfileIds,
  initialProfile,
  initialSharedConversation,
  isSharedView,
  kakaoReady,
  session,
}: HomeShellProps) {
  const isAuthenticated = Boolean(session?.user);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);

  useEffect(() => {
    const handleOpenTutorial = () => {
      setIsTutorialOpen(true);
    };

    window.addEventListener("lumo:open-tutorial", handleOpenTutorial);

    return () => {
      window.removeEventListener("lumo:open-tutorial", handleOpenTutorial);
    };
  }, []);
  const [conversationPreviews, setConversationPreviews] = useState(initialConversationPreviews);
  const [loadedConversations, setLoadedConversations] = useState<ConversationSession[]>([]);
  const [savedProfiles, setSavedProfiles] = useState(initialProfiles);
  const [selectedSavedProfileIds, setSelectedSavedProfileIds] =
    useState(initialActiveProfileIds);
  const [defaultProfileValue, setDefaultProfileValue] = useState(initialProfile);
  const [draftConversation, setDraftConversation] = useState(() =>
    createDraftConversation(featuredPrompts, initialProfile),
  );
  const [activeConversationId, setActiveConversationId] = useState(
    initialSharedConversation?.id ?? draftConversation.id,
  );
  const [pendingConversationId, setPendingConversationId] = useState<string | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const isConversationLoading = pendingConversationId === activeConversationId;

  const activeConversation = useMemo(() => {
    if (isSharedView && initialSharedConversation) {
      return initialSharedConversation;
    }

    if (activeConversationId === draftConversation.id) {
      return draftConversation;
    }

    const loadedConversation = loadedConversations.find(
      ({ id }) => id === activeConversationId,
    );

    if (loadedConversation) {
      return loadedConversation;
    }

    const preview = conversationPreviews.find(({ id }) => id === activeConversationId);

    if (preview) {
      return createPreviewPlaceholderConversation(
        preview,
        featuredPrompts,
        defaultProfileValue,
      );
    }

    return draftConversation;
  }, [
    activeConversationId,
    conversationPreviews,
    defaultProfileValue,
    draftConversation,
    featuredPrompts,
    initialSharedConversation,
    isSharedView,
    loadedConversations,
  ]);
  const visibleConversationPreviews = useMemo(
    () => (isAuthenticated && !isSharedView ? conversationPreviews : []),
    [conversationPreviews, isAuthenticated, isSharedView],
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

  const updateMessageFollowUps = useCallback(
    (
      conversation: ConversationSession,
      messageId: string,
      followUpSuggestions: string[],
    ): ConversationSession => ({
      ...conversation,
      messages: conversation.messages.map((message) =>
        message.id === messageId ? { ...message, followUpSuggestions } : message,
      ),
    }),
    [],
  );

  const removePendingToolMessages = useCallback(
    (conversation: ConversationSession): ConversationSession => ({
      ...conversation,
      messages: conversation.messages.filter(
        (message) => !(message.role === "tool" && message.pending),
      ),
    }),
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

      setLoadedConversations((currentConversations) =>
        upsertConversation(currentConversations, nextConversation),
      );
      setConversationPreviews((currentConversationPreviews) =>
        upsertConversationPreview(
          currentConversationPreviews,
          toConversationPreview(nextConversation),
        ),
      );
    },
    [activeConversationId, draftConversation.id],
  );

  const handleNewChat = useCallback((): void => {
    const nextDraftConversation = createDraftConversation(featuredPrompts, defaultProfileValue);

    setDraftConversation(nextDraftConversation);
    setActiveConversationId(nextDraftConversation.id);
    setPendingConversationId(null);
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

      if (conversationId === activeConversationId) {
        setRequestError("");
        return;
      }

      const loadedConversation = loadedConversations.find(({ id }) => id === conversationId);

      if (loadedConversation) {
        setPendingConversationId(null);
        setActiveConversationId(conversationId);
        setRequestError("");
        return;
      }

      const previousConversationId = activeConversationId;

      setActiveConversationId(conversationId);
      setPendingConversationId(conversationId);
      setRequestError("");

      const loadConversation = async () => {
        try {
          const response = await fetch(`/api/conversations/${conversationId}`);
          const data = (await response.json()) as GetConversationResponse;

          if (!response.ok || !data.conversation) {
            throw new Error(data.error ?? "채팅을 불러오지 못했습니다.");
          }

          setLoadedConversations((currentConversations) =>
            upsertConversation(currentConversations, data.conversation as ConversationSession),
          );
          setConversationPreviews((currentConversationPreviews) =>
            upsertConversationPreview(
              currentConversationPreviews,
              toConversationPreview(data.conversation as ConversationSession),
            ),
          );
          setRequestError("");
        } catch (error) {
          setActiveConversationId(previousConversationId);
          setRequestError(
            error instanceof Error ? error.message : "채팅을 불러오는 중 오류가 발생했습니다.",
          );
        } finally {
          setPendingConversationId((currentPendingConversationId) =>
            currentPendingConversationId === conversationId
              ? null
              : currentPendingConversationId,
          );
        }
      };

      loadConversation().catch(() => undefined);
    },
    [activeConversationId, isAuthenticated, isSharedView, loadedConversations],
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

      setLoadedConversations((currentConversations) =>
        currentConversations.filter((conversation) => conversation.id !== conversationId),
      );
      setConversationPreviews((currentConversationPreviews) =>
        currentConversationPreviews.filter(
          (conversation) => conversation.id !== conversationId,
        ),
      );

      if (activeConversationId === conversationId) {
        const nextDraftConversation = createDraftConversation(
          featuredPrompts,
          defaultProfileValue,
        );

        setDraftConversation(nextDraftConversation);
        setActiveConversationId(nextDraftConversation.id);
        setPendingConversationId(null);
      }

      setRequestError("");
    },
    [activeConversationId, defaultProfileValue, featuredPrompts, isAuthenticated],
  );

  const handleSaveProfile = useCallback(
    async (
      profile: string,
      profileId?: string,
      currentSelectionIds?: string[],
    ): Promise<string> => {
      if (!isAuthenticated) {
        setIsLoginModalOpen(true);
        return "";
      }

      const response = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profile,
          profileId,
          activeProfileIds: currentSelectionIds,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        activeProfileId?: string;
        activeProfileIds?: string[];
        profiles?: SavedProfileRecord[];
      };

      if (!response.ok) {
        throw new Error(data.error ?? "프로필 저장에 실패했습니다.");
      }

      const nextProfiles = data.profiles ?? [];
      const nextActiveProfileIds = normalizeProfileIds(
        data.activeProfileIds ?? (data.activeProfileId ? [data.activeProfileId] : []),
      );
      const nextSelectedProfiles = resolveSavedProfileValues(
        nextProfiles,
        nextActiveProfileIds,
      );

      const nextSelectionValue =
        nextSelectedProfiles.length > 0 ? serializeProfileSelection(nextSelectedProfiles) : "";

      setSelectedSavedProfileIds(nextActiveProfileIds);
      setDefaultProfileValue(nextSelectionValue);
      setSavedProfiles(nextProfiles);
      setDraftConversation((currentConversation) => ({
        ...currentConversation,
        profile: nextSelectionValue,
      }));

      return nextSelectionValue;
    },
    [isAuthenticated],
  );

  const handleDeleteProfile = useCallback(
    async (profileId: string): Promise<string> => {
      if (!isAuthenticated) {
        setIsLoginModalOpen(true);
        return "";
      }

      const response = await fetch("/api/profile", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ profileId }),
      });

      const data = (await response.json()) as {
        error?: string;
        activeProfileId?: string;
        activeProfileIds?: string[];
        profiles?: SavedProfileRecord[];
      };

      if (!response.ok) {
        throw new Error(data.error ?? "프로필 삭제에 실패했습니다.");
      }

      const nextProfiles = data.profiles ?? [];
      const nextActiveProfileIds = normalizeProfileIds(
        data.activeProfileIds ?? (data.activeProfileId ? [data.activeProfileId] : []),
      );
      const nextSelectedProfiles = resolveSavedProfileValues(
        nextProfiles,
        nextActiveProfileIds,
      );
      const nextSelectionValue =
        nextSelectedProfiles.length > 0 ? serializeProfileSelection(nextSelectedProfiles) : "";

      setSavedProfiles(nextProfiles);
      setSelectedSavedProfileIds(nextActiveProfileIds);
      setDefaultProfileValue(nextSelectionValue);
      setDraftConversation((currentConversation) => ({
        ...currentConversation,
        profile: nextSelectionValue,
      }));

      return nextSelectionValue;
    },
    [isAuthenticated],
  );

  const handleSelectSavedProfiles = useCallback(
    (profileIds: string[]): void => {
      const nextSelectedProfileIds = normalizeProfileIds(profileIds);
      const nextSelectionValue = serializeProfileSelection(
        resolveSavedProfileValues(savedProfiles, nextSelectedProfileIds),
      );

      setSelectedSavedProfileIds(nextSelectedProfileIds);
      setDefaultProfileValue(nextSelectionValue);
      setDraftConversation((currentConversation) => ({
        ...currentConversation,
        profile: nextSelectionValue,
      }));

      if (!isAuthenticated) {
        return;
      }

      fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          activeProfileIds: nextSelectedProfileIds,
        }),
      }).catch(() => undefined);
    },
    [isAuthenticated, savedProfiles],
  );

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

  const requestFollowUpSuggestions = useCallback(
    async (conversation: ConversationSession, question: string): Promise<void> => {
      const assistantMessage = [...conversation.messages]
        .reverse()
        .find((message) => message.role === "assistant" && !message.pending);

      if (!assistantMessage || assistantMessage.followUpSuggestions?.length) {
        return;
      }

      const response = await fetch("/api/chat/follow-ups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId: conversation.id.startsWith("draft-") ? undefined : conversation.id,
          assistantMessageId: assistantMessage.id,
          profile: conversation.profile,
          question,
          toneId: conversation.toneId,
          tools: conversation.tools,
          messages: conversation.messages.map(
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
      const data = (await response.json()) as {
        suggestions?: string[];
      };
      const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];

      if (suggestions.length === 0) {
        return;
      }

      setLoadedConversations((currentConversations) =>
        currentConversations.map((currentConversation) =>
          currentConversation.id === conversation.id
            ? updateMessageFollowUps(currentConversation, assistantMessage.id, suggestions)
            : currentConversation,
        ),
      );
      setConversationPreviews((currentConversationPreviews) =>
        currentConversationPreviews.map((currentConversationPreview) =>
          currentConversationPreview.id === conversation.id
            ? toConversationPreview(
                updateMessageFollowUps(conversation, assistantMessage.id, suggestions),
              )
            : currentConversationPreview,
        ),
      );
      setDraftConversation((currentConversation) =>
        currentConversation.id === conversation.id
          ? updateMessageFollowUps(currentConversation, assistantMessage.id, suggestions)
          : currentConversation,
      );
    },
    [updateMessageFollowUps],
  );

  const handleSubmit = useCallback(
    async (draft: ChatComposerDraft): Promise<void> => {
      if (!isAuthenticated) {
        setIsLoginModalOpen(true);
        return;
      }

      if (isConversationLoading) {
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
            streamedConversation = removePendingToolMessages(streamedConversation);
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
            streamedConversation = removePendingToolMessages(streamedConversation);
            updateActiveConversation(streamedConversation);
            setLoadedConversations((currentConversations) =>
              upsertConversation(currentConversations, payload.conversation),
            );
            setConversationPreviews((currentConversationPreviews) =>
              upsertConversationPreview(
                currentConversationPreviews,
                toConversationPreview(payload.conversation),
              ),
            );
            setActiveConversationId(payload.conversation.id);
            setPendingConversationId(null);
            setRequestError("");
            requestFollowUpSuggestions(payload.conversation, draft.question).catch(
              () => undefined,
            );
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
      isConversationLoading,
      isAuthenticated,
      removePendingToolMessages,
      requestFollowUpSuggestions,
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
                conversations={visibleConversationPreviews}
                kakaoReady={kakaoReady}
                session={session}
                onDeleteConversation={handleDeleteConversation}
                onNewChat={handleNewChat}
                onOpenLoginModal={handleOpenLoginModal}
                onSelectConversation={handleSelectConversation}
              />
            ) : null}

            <SidebarInset className="h-full min-h-0 overflow-hidden bg-transparent">
              <div className="flex h-full min-h-0 w-full">
                <Chat
                  activeConversation={activeConversation}
                  availableProfiles={savedProfiles}
                  featuredPrompts={featuredPrompts}
                  initialProfile={initialProfile}
                  isAuthenticated={isAuthenticated}
                  isConversationLoading={isConversationLoading}
                  isReadOnly={isSharedView}
                  kakaoReady={kakaoReady}
                  isSending={isSending}
                  requestError={requestError}
                  selectedProfileIds={selectedSavedProfileIds}
                  onCreateShareLink={handleCreateShareLink}
                  onDeleteProfile={handleDeleteProfile}
                  onRequestLogin={handleOpenLoginModal}
                  onSaveProfile={handleSaveProfile}
                  onSelectSavedProfile={handleSelectSavedProfiles}
                  onSubmit={handleSubmit}
                  onFollowUpSelect={async (question) => {
                    await handleSubmit({
                      profile: activeConversation.profile,
                      question,
                      toneId: activeConversation.toneId,
                      tools: activeConversation.tools,
                    });
                  }}
                />
              </div>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </div>

      <TutorialOverlay
        open={isTutorialOpen}
        onClose={() => {
          setIsTutorialOpen(false);
        }}
      />
    </>
  );
}

export default HomeShell;
