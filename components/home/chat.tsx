"use client";

import { MessageSquareText, Share2, Sparkles } from "lucide-react";
import { useCallback, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { toneOptions, type ConversationSession, type PromptTemplate } from "@/lib/lumo-content";
import { hasStoredChatProfile, type SavedProfileRecord } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chat-store";

import { useChatProfileState } from "../../hooks/use-chat-profile-state";
import { useChatShareState, useChatViewState } from "../../hooks/use-chat-share-state";

import { ChatComposerPanel } from "./chat-composer-panel";
import { ChatDeleteProfileDialog } from "./chat-delete-profile-dialog";
import { ChatProfileDialog } from "./chat-profile-dialog";
import { ChatShareDialog } from "./chat-share-dialog";
import { ChatMessageBubble, ToolMessageBubble } from "./tool-message-bubble";

export interface ChatComposerDraft {
  profile: string;
  question: string;
  toneId: ConversationSession["toneId"];
  tools: ConversationSession["tools"];
}

interface ChatProps {
  activeConversation: ConversationSession;
  availableProfiles: SavedProfileRecord[];
  featuredPrompts: PromptTemplate[];
  initialProfile: string;
  isAuthenticated: boolean;
  isConversationLoading: boolean;
  isReadOnly: boolean;
  kakaoReady: boolean;
  isSending: boolean;
  requestError: string;
  selectedProfileIds: string[];
  onCreateShareLink: (conversationId: string) => Promise<string>;
  onDeleteProfile: (profileId: string) => Promise<string>;
  onRequestLogin: () => void;
  onSaveProfile: (
    profile: string,
    profileId?: string,
    currentSelectionIds?: string[],
  ) => Promise<string>;
  onSelectSavedProfile: (profileIds: string[]) => void;
  onSubmit: (draft: ChatComposerDraft) => Promise<void>;
  onFollowUpSelect: (question: string) => Promise<void>;
}

interface ChatConversationHeaderProps {
  isReadOnly: boolean;
  title: string;
}

interface ChatEmptyStateProps {
  featuredPrompts: PromptTemplate[];
  helperText: string;
  onPromptSelect: (prompt: PromptTemplate) => void;
}

function ChatLoadingState() {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 items-center justify-center rounded-[28px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_42%),rgba(255,255,255,0.03)] px-6 text-center">
      <div>
        <div className="text-sm font-semibold text-zinc-100">채팅을 불러오는 중입니다.</div>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          저장된 메시지와 도구 분석 결과를 가져오고 있습니다.
        </p>
      </div>
    </div>
  );
}

function ChatConversationHeader({ isReadOnly, title }: ChatConversationHeaderProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-start justify-between gap-4",
        !isReadOnly && "pl-12 md:pl-14",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0">
          <Badge
            variant="outline"
            className="max-w-full border-cyan-300/15 bg-cyan-300/10 px-3 py-1 text-[11px] tracking-[0.24em] whitespace-normal text-cyan-100 uppercase"
          >
            <Sparkles className="size-3.5" />
            루모 AI와 이어서 보는 사주 채팅
          </Badge>
          <div className="mt-4">
            <div className="text-[11px] font-semibold tracking-[0.24em] text-zinc-500 uppercase">
              루모 AI 채팅
            </div>
            <h2 className="font-display mt-2 text-2xl leading-tight tracking-tight wrap-break-word text-white md:mt-3 md:text-4xl">
              {title}
            </h2>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatEmptyState({ featuredPrompts, helperText, onPromptSelect }: ChatEmptyStateProps) {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 overflow-y-auto rounded-[28px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_42%),rgba(255,255,255,0.03)]">
      <div className="mx-auto my-auto flex w-full max-w-3xl flex-col items-center px-3 py-6 text-center">
        <Badge
          variant="outline"
          className="border-cyan-300/15 bg-cyan-300/10 px-2.5 py-0.5 text-[11px] text-cyan-100"
        >
          <MessageSquareText className="size-3.5" />한 줄 질문으로 바로 시작
        </Badge>
        <h1 className="font-display mt-3 text-2xl leading-tight tracking-tight text-white sm:text-3xl">
          루모 AI에게 오늘의 흐름을 물어보세요.
        </h1>
        <p className="mt-2 max-w-lg text-xs leading-5 text-zinc-500">
          호흡은 간결하게, 해석은 또렷하게. 연애, 진로, 궁합, 재물처럼 지금 마음에 걸린 질문을
          채팅으로 이어가세요.
        </p>

        <div className="mt-4 grid w-full min-w-0 grid-cols-1 gap-2 md:grid-cols-2">
          {featuredPrompts.slice(0, 4).map((prompt) => (
            <button
              key={prompt.id}
              type="button"
              className="rounded-[20px] border border-white/10 bg-white/4 px-4 py-3 text-left transition-colors hover:bg-white/[0.07]"
              onClick={() => {
                onPromptSelect(prompt);
              }}
            >
              <span className="text-[10px] font-semibold tracking-[0.22em] text-zinc-500 uppercase">
                {prompt.category}
              </span>
              <strong className="mt-1 block text-sm font-semibold text-white">
                {prompt.title}
              </strong>
              <span className="mt-0.5 block text-xs leading-5 text-zinc-400">
                {prompt.summary}
              </span>
            </button>
          ))}
        </div>

        <div className="pt-4 text-center text-[11px] text-zinc-500">{helperText}</div>
      </div>
    </div>
  );
}

function Chat({
  activeConversation,
  availableProfiles,
  featuredPrompts,
  initialProfile,
  isAuthenticated,
  isConversationLoading,
  isReadOnly,
  kakaoReady,
  isSending,
  requestError,
  selectedProfileIds,
  onCreateShareLink,
  onDeleteProfile,
  onRequestLogin,
  onSaveProfile,
  onSelectSavedProfile,
  onSubmit,
  onFollowUpSelect,
}: ChatProps) {
  const {
    applyPrompt,
    initialize,
    profile,
    question,
    selectedToneId,
    selectedTools,
    setProfile,
    setQuestion,
    setSelectedToneId,
    startNewChat,
    syncConversationContext,
    toggleTool,
  } = useChatStore(
    useShallow((state) => ({
      applyPrompt: state.applyPrompt,
      initialize: state.initialize,
      profile: state.profile,
      question: state.question,
      selectedToneId: state.selectedToneId,
      selectedTools: state.selectedTools,
      setProfile: state.setProfile,
      setQuestion: state.setQuestion,
      setSelectedToneId: state.setSelectedToneId,
      startNewChat: state.startNewChat,
      syncConversationContext: state.syncConversationContext,
      toggleTool: state.toggleTool,
    })),
  );

  const isDraftConversation = activeConversation.id.startsWith("draft-");
  const hasMessages = activeConversation.messages.length > 0;
  const hasProfile = hasStoredChatProfile(profile);
  const {
    id: activeConversationId,
    messages,
    profile: activeConversationProfile,
    toneId: activeConversationToneId,
    title: activeConversationTitle,
    tools: activeConversationTools,
  } = activeConversation;
  const selectedTone =
    toneOptions.find((toneOption) => toneOption.id === selectedToneId) ?? toneOptions[0];
  const {
    handleCopyShareLink,
    handleOpenShareDialog,
    handleShareToKakao,
    isCreatingShareLink,
    isShareDialogOpen,
    setIsShareDialogOpen,
    shareError,
    shareUrl,
  } = useChatShareState({
    conversationId: activeConversationId,
    conversationTitle: activeConversationTitle,
    hasMessages,
    isDraftConversation,
    isReadOnly,
    onCreateShareLink,
  });
  const {
    activeScrollContainer,
    canSubmit,
    handleScrollToBottom,
    hasQuestion,
    helperText,
    remainingCharacters,
    setEmptyStateScrollContainer,
    setMessageScrollContainer,
    showScrollToBottomButton,
    submitButtonLabel,
  } = useChatViewState({
    hasMessages,
    hasProfile,
    isAuthenticated,
    isReadOnly,
    isSending,
    kakaoReady,
    question,
    requestError,
    scrollDependency: activeConversation.messages.length,
  });
  const {
    birthTimeModeOptions,
    calendarTypeOptions,
    editingProfileId,
    handleBackToProfileList,
    handleDeleteProfileDialogOpenChange,
    handleDeleteSavedProfile,
    handleEditSavedProfile,
    handleOpenProfileDialog,
    handleProfileDialogOpenChange,
    handleRequestDeleteSavedProfile,
    handleSaveProfile,
    handleStartAddProfile,
    handleToggleSavedProfile,
    isAddingProfile,
    isDeletingProfile,
    isProfileDialogOpen,
    isSavingProfile,
    locationOptions,
    pendingDeleteProfileValue,
    profileDraft,
    savedProfileOptions,
    setProfileDraft,
  } = useChatProfileState({
    availableProfiles,
    currentProfile: profile,
    selectedProfileIds,
    onDeleteProfile,
    onSaveProfile,
    onSelectSavedProfile,
    setProfile,
  });

  useEffect(() => {
    initialize(featuredPrompts, initialProfile);
  }, [featuredPrompts, initialize, initialProfile]);

  useEffect(() => {
    if (isConversationLoading) {
      return;
    }

    if (isReadOnly) {
      syncConversationContext(
        activeConversationProfile,
        activeConversationToneId,
        activeConversationTools,
      );
      return;
    }

    if (isDraftConversation && !hasMessages) {
      startNewChat(featuredPrompts, initialProfile);
      return;
    }

    syncConversationContext(
      activeConversationProfile,
      activeConversationToneId,
      activeConversationTools,
    );
  }, [
    activeConversation.id,
    activeConversationProfile,
    activeConversationToneId,
    activeConversationTools,
    featuredPrompts,
    hasMessages,
    initialProfile,
    isConversationLoading,
    isReadOnly,
    isDraftConversation,
    startNewChat,
    syncConversationContext,
  ]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!hasQuestion || isConversationLoading || isSending) {
      return;
    }

    if (!isAuthenticated) {
      onRequestLogin();
      return;
    }

    if (!hasProfile) {
      handleOpenProfileDialog(savedProfileOptions.length === 0);
      return;
    }

    try {
      await onSubmit({
        profile,
        question,
        toneId: selectedToneId,
        tools: selectedTools,
      });
      setQuestion("");
    } catch {
      // Error state is managed in the parent shell.
    }
  }, [
    hasProfile,
    hasQuestion,
    isAuthenticated,
    isConversationLoading,
    isSending,
    onRequestLogin,
    onSubmit,
    profile,
    question,
    selectedToneId,
    selectedTools,
    setQuestion,
    handleOpenProfileDialog,
    savedProfileOptions.length,
  ]);

  let conversationBody: React.ReactNode;

  if (hasMessages) {
    conversationBody = (
      <div ref={setMessageScrollContainer} className="flex min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full min-h-0 flex-1 overflow-hidden">
          <div className="min-w-0 space-y-4 p-4 md:p-5">
            <ChatConversationHeader isReadOnly={isReadOnly} title={activeConversationTitle} />

            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex min-w-0",
                  message.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                {message.role === "tool" ? (
                  <ToolMessageBubble
                    message={
                      message as ConversationSession["messages"][number] & {
                        role: "tool";
                      }
                    }
                  />
                ) : (
                  <ChatMessageBubble
                    isReadOnly={isReadOnly}
                    isSending={isSending}
                    message={
                      message as ConversationSession["messages"][number] & {
                        role: "assistant" | "user";
                      }
                    }
                    onFollowUpSelect={onFollowUpSelect}
                  />
                )}
              </div>
            ))}

            {requestError ? (
              <div className="rounded-[24px] border border-red-400/20 bg-red-500/10 px-5 py-4 text-sm leading-7 text-red-100">
                {requestError}
              </div>
            ) : null}

            <div className="px-1 pt-3 text-center text-[11px] text-zinc-500 md:text-xs">
              {helperText}
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  } else if (isConversationLoading) {
    conversationBody = (
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ChatLoadingState />
      </div>
    );
  } else {
    conversationBody = (
      <div ref={setEmptyStateScrollContainer} className="flex min-h-0 flex-1 overflow-hidden">
        <ChatEmptyState
          featuredPrompts={featuredPrompts}
          helperText={helperText}
          onPromptSelect={applyPrompt}
        />
      </div>
    );
  }

  return (
    <section className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden text-zinc-100">
      {!isReadOnly ? (
        <SidebarTrigger className="absolute top-5 left-5 z-20 size-10 rounded-2xl border border-white/10 bg-white/4 text-zinc-100 shadow-lg shadow-black/20 hover:bg-white/8 hover:text-white md:top-6 md:left-6 md:size-12 [&_svg]:size-5 md:[&_svg]:size-6" />
      ) : null}

      {!isReadOnly && !isDraftConversation && hasMessages ? (
        <Button
          type="button"
          variant="outline"
          className="absolute top-5 right-8 z-20 rounded-2xl border-white/10 bg-white/4 text-zinc-100 shadow-lg shadow-black/20 hover:bg-white/8 hover:text-white md:right-11"
          onClick={handleOpenShareDialog}
        >
          <Share2 className="size-4" />
          공유
        </Button>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {conversationBody}
        </div>

        {isReadOnly ? (
          <Card className="shrink-0 rounded-[28px] border-white/10 bg-white/4 py-0 shadow-2xl shadow-black/10">
            <CardContent className="space-y-4 p-5 text-center">
              <div className="text-sm leading-7 text-zinc-400">
                이 대화는 공유 시점까지의 내용만 표시됩니다.
              </div>
              <Button
                type="button"
                className="rounded-2xl bg-zinc-50 text-zinc-950 hover:bg-zinc-200"
                onClick={() => {
                  window.location.href = "/";
                }}
              >
                나도 루모 AI와 상담하기
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ChatComposerPanel
            canSubmit={canSubmit && !isConversationLoading}
            hasMessages={hasMessages}
            isAuthenticated={isAuthenticated}
            question={question}
            remainingCharacters={remainingCharacters}
            selectedProfileCount={selectedProfileIds.length}
            selectedToneId={selectedToneId}
            selectedToneLabel={selectedTone.label}
            selectedTools={selectedTools}
            showScrollToBottomButton={
              showScrollToBottomButton && Boolean(activeScrollContainer)
            }
            submitButtonLabel={isConversationLoading ? "불러오는 중..." : submitButtonLabel}
            onOpenProfileDialog={() => {
              handleOpenProfileDialog();
            }}
            onQuestionChange={setQuestion}
            onRequestLogin={onRequestLogin}
            onScrollToBottom={handleScrollToBottom}
            onSubmit={handleSubmit}
            onToggleTool={toggleTool}
            onToneChange={(value) => {
              setSelectedToneId(value);
            }}
          />
        )}

        <ChatProfileDialog
          open={isProfileDialogOpen}
          isAddingProfile={isAddingProfile}
          isDeletingProfile={isDeletingProfile}
          isSavingProfile={isSavingProfile}
          editingProfileId={editingProfileId}
          profileDraft={profileDraft}
          savedProfileOptions={savedProfileOptions}
          selectedProfileIds={selectedProfileIds}
          locationOptions={locationOptions}
          calendarTypeOptions={calendarTypeOptions}
          birthTimeModeOptions={birthTimeModeOptions}
          setProfileDraft={setProfileDraft}
          onOpenChange={handleProfileDialogOpenChange}
          onStartAddProfile={handleStartAddProfile}
          onBackToList={handleBackToProfileList}
          onToggleSavedProfile={handleToggleSavedProfile}
          onEditSavedProfile={handleEditSavedProfile}
          onRequestDeleteSavedProfile={handleRequestDeleteSavedProfile}
          onSaveProfile={handleSaveProfile}
        />

        <ChatDeleteProfileDialog
          open={Boolean(pendingDeleteProfileValue)}
          isDeletingProfile={isDeletingProfile}
          canDelete={Boolean(pendingDeleteProfileValue)}
          onOpenChange={handleDeleteProfileDialogOpenChange}
          onConfirm={handleDeleteSavedProfile}
        />

        <ChatShareDialog
          open={isShareDialogOpen}
          isCreatingShareLink={isCreatingShareLink}
          shareUrl={shareUrl}
          shareError={shareError}
          onOpenChange={setIsShareDialogOpen}
          onCopyShareLink={handleCopyShareLink}
          onShareToKakao={handleShareToKakao}
        />
      </div>
    </section>
  );
}

export default Chat;
