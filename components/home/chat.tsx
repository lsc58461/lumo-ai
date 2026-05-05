"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Compass,
  Copy,
  Link2,
  MessageCircleMore,
  MessageSquareText,
  Paintbrush,
  Pencil,
  Share2,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Streamdown } from "streamdown";
import { useShallow } from "zustand/react/shallow";

import ToolRunResults from "@/components/home/tool-run-results";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import {
  toolSelectionKeys,
  toneOptions,
  toolCatalog,
  type ConversationSession,
  type PromptTemplate,
} from "@/lib/lumo-content";
import {
  defaultChatProfileFields,
  getPrimarySelectedProfile,
  hasStoredChatProfile,
  isChatProfileComplete,
  parseChatProfile,
  parseProfileSelection,
  serializeChatProfile,
  serializeProfileSelection,
  supportedBirthLocations,
  summarizeChatProfile,
  type ChatProfileFields,
} from "@/lib/profile";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chat-store";

const profileDropdownTriggerClassName =
  "h-12 w-full justify-between rounded-2xl border-white/10 bg-black/20 px-4 text-zinc-100 hover:bg-white/8 hover:text-white";
const selectedProfileButtonClassName =
  "border-cyan-300/45 bg-cyan-400/12 text-zinc-50 font-semibold shadow-[0_0_0_1px_rgba(103,232,249,0.18)]";
const birthTimeOptions = Array.from({ length: 48 }, (_, index) => {
  const hour = String(Math.floor(index / 2)).padStart(2, "0");
  const minute = index % 2 === 0 ? "00" : "30";

  return `${hour}:${minute}`;
});

interface ProfileDropdownFieldProps {
  label: string;
  placeholder: string;
  value: string;
  options: {
    value: string;
    label: string;
    description?: string;
  }[];
  onChange: (value: string) => void;
  disabled?: boolean;
  contentClassName?: string;
}

function ProfileDropdownField({
  label,
  placeholder,
  value,
  options,
  onChange,
  disabled = false,
  contentClassName,
}: ProfileDropdownFieldProps) {
  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-zinc-200">{label}</div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <Button
            type="button"
            variant="outline"
            className={cn(
              profileDropdownTriggerClassName,
              !selectedOption && "text-zinc-500",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <span className="truncate">{selectedOption?.label ?? placeholder}</span>
            <ChevronDown className="size-4 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className={cn(
            "w-(--radix-dropdown-menu-trigger-width) border-white/10 bg-[#12141d] text-zinc-100",
            contentClassName,
          )}
        >
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
            {options.map((option) => (
              <DropdownMenuRadioItem
                key={option.value}
                value={option.value}
                className="items-start py-2"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-zinc-100">{option.label}</span>
                  {option.description ? (
                    <span className="text-xs text-zinc-500">{option.description}</span>
                  ) : null}
                </div>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export interface ChatComposerDraft {
  profile: string;
  question: string;
  toneId: ConversationSession["toneId"];
  tools: ConversationSession["tools"];
}

interface ChatProps {
  activeConversation: ConversationSession;
  availableProfiles: string[];
  featuredPrompts: PromptTemplate[];
  initialProfile: string;
  isAuthenticated: boolean;
  isReadOnly: boolean;
  kakaoReady: boolean;
  isSending: boolean;
  requestError: string;
  onCreateShareLink: (conversationId: string) => Promise<string>;
  onRequestLogin: () => void;
  onSaveProfile: (
    profile: string,
    previousProfile?: string,
    currentSelection?: string[],
  ) => Promise<string>;
  onSelectSavedProfile: (profiles: string[]) => void;
  onSubmit: (draft: ChatComposerDraft) => Promise<void>;
  onFollowUpSelect: (question: string) => Promise<void>;
}

function Chat({
  activeConversation,
  availableProfiles,
  featuredPrompts,
  initialProfile,
  isAuthenticated,
  isReadOnly,
  kakaoReady,
  isSending,
  requestError,
  onCreateShareLink,
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
  const hasQuestion = question.trim().length > 0;
  const hasProfile = hasStoredChatProfile(profile);
  const canSubmit = hasQuestion && !isSending;
  const activeConversationProfile = activeConversation.profile;
  const activeConversationToneId = activeConversation.toneId;
  const activeConversationTools = activeConversation.tools;
  const selectedTone =
    toneOptions.find((toneOption) => toneOption.id === selectedToneId) ?? toneOptions[0];
  const selectedProfileValues = useMemo(() => parseProfileSelection(profile), [profile]);
  const locationOptions = useMemo(
    () => supportedBirthLocations.map((location) => ({ value: location, label: location })),
    [],
  );
  const calendarTypeOptions = useMemo(
    () => [
      { value: "양력", label: "양력", description: "일반적인 양력 생일 기준" },
      { value: "음력", label: "음력", description: "음력 생일 기준으로 환산" },
    ],
    [],
  );
  const birthTimeModeOptions = useMemo(
    () => [
      { value: "known", label: "시각 입력", description: "시주와 ASC/MC 계산에 반영" },
      { value: "unknown", label: "시각 모름", description: "시주와 시간축 계산은 제외" },
    ],
    [],
  );
  const birthTimeDropdownOptions = useMemo(
    () =>
      birthTimeOptions.map((time) => ({
        value: time,
        label: time,
      })),
    [],
  );
  const savedProfileOptions = useMemo(
    () =>
      availableProfiles.map((savedProfile) => ({
        value: savedProfile,
        summary: summarizeChatProfile(parseChatProfile(savedProfile)),
      })),
    [availableProfiles],
  );
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isCreatingShareLink, setIsCreatingShareLink] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<ChatProfileFields>(defaultChatProfileFields);
  const [editingProfileValue, setEditingProfileValue] = useState<string | null>(null);
  const [shareError, setShareError] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [messageScrollContainer, setMessageScrollContainer] = useState<HTMLDivElement | null>(
    null,
  );
  const [emptyStateScrollContainer, setEmptyStateScrollContainer] =
    useState<HTMLDivElement | null>(null);
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);
  const remainingCharacters = 140 - question.length;
  let helperText = "중요한 결정은 전문가와 상담하세요.";
  let submitButtonLabel = "로그인 후 전송";

  if (isAuthenticated) {
    submitButtonLabel = "질문 보내기";
  }

  if (isSending) {
    submitButtonLabel = "루모 AI 답변 생성 중";
  }

  if (!isAuthenticated) {
    helperText = "채팅 전송과 채팅 내역은 로그인 후에만 사용할 수 있습니다.";
  } else if (!hasProfile) {
    helperText = "질문을 보내기 전에 출생 프로필을 먼저 등록해 주세요.";
  } else if (!kakaoReady) {
    helperText = "카카오 연동 키가 없어 현재 로그인 버튼은 비활성화됩니다.";
  }

  if (isReadOnly) {
    helperText = "이 대화는 공유 시점까지의 내용만 표시됩니다.";
  }

  useEffect(() => {
    initialize(featuredPrompts, initialProfile);
  }, [featuredPrompts, initialize, initialProfile]);

  useEffect(() => {
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
    isReadOnly,
    isDraftConversation,
    startNewChat,
    syncConversationContext,
  ]);

  const activeScrollContainer = useMemo(() => {
    if (hasMessages) {
      return messageScrollContainer?.querySelector<HTMLDivElement>(
        '[data-slot="scroll-area-viewport"]',
      );
    }

    return emptyStateScrollContainer;
  }, [emptyStateScrollContainer, hasMessages, messageScrollContainer]);

  useEffect(() => {
    const container = activeScrollContainer;

    if (!container) {
      return undefined;
    }

    const updateScrollButton = () => {
      const distanceFromBottom =
        container.scrollHeight - (container.scrollTop + container.clientHeight);

      setShowScrollToBottomButton(distanceFromBottom > 24);
    };

    updateScrollButton();
    container.addEventListener("scroll", updateScrollButton, { passive: true });
    window.addEventListener("resize", updateScrollButton);

    const cleanup = () => {
      container.removeEventListener("scroll", updateScrollButton);
      window.removeEventListener("resize", updateScrollButton);
    };

    return cleanup;
  }, [activeConversation.messages.length, activeScrollContainer, hasMessages, requestError]);

  const handleScrollToBottom = useCallback(() => {
    if (!activeScrollContainer) {
      return;
    }

    activeScrollContainer.scrollTo({
      top: activeScrollContainer.scrollHeight,
      behavior: "smooth",
    });
  }, [activeScrollContainer]);

  const handleOpenShareDialog = useCallback(async (): Promise<void> => {
    if (isReadOnly || isDraftConversation || activeConversation.messages.length === 0) {
      return;
    }

    setIsShareDialogOpen(true);
    setShareError("");

    if (shareUrl) {
      return;
    }

    setIsCreatingShareLink(true);

    try {
      setShareUrl(await onCreateShareLink(activeConversation.id));
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "공유 링크 생성에 실패했습니다.");
    } finally {
      setIsCreatingShareLink(false);
    }
  }, [
    activeConversation.id,
    activeConversation.messages.length,
    isDraftConversation,
    isReadOnly,
    onCreateShareLink,
    shareUrl,
  ]);

  const handleCopyShareLink = useCallback(async (): Promise<void> => {
    if (!shareUrl) {
      return;
    }

    await navigator.clipboard.writeText(shareUrl);
  }, [shareUrl]);

  const handleShareToKakao = useCallback((): void => {
    if (!shareUrl) {
      return;
    }

    window.open(
      `https://sharer.kakao.com/talk/friends/picker/link?url=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }, [shareUrl]);

  const handleSaveProfile = useCallback(async (): Promise<void> => {
    setIsSavingProfile(true);

    try {
      const serializedProfile = serializeChatProfile(profileDraft);
      const nextSelectionValue = await onSaveProfile(
        serializedProfile,
        editingProfileValue ?? undefined,
        selectedProfileValues,
      );

      setProfile(nextSelectionValue || serializedProfile);
      setEditingProfileValue(null);
      setProfileDraft(defaultChatProfileFields);
      setIsAddingProfile(false);
    } finally {
      setIsSavingProfile(false);
    }
  }, [editingProfileValue, onSaveProfile, profileDraft, selectedProfileValues, setProfile]);

  const handleOpenProfileDialog = useCallback(
    (showAddForm = false): void => {
      setEditingProfileValue(null);
      setProfileDraft(parseChatProfile(getPrimarySelectedProfile(profile)));
      setIsAddingProfile(showAddForm || savedProfileOptions.length === 0);
      setIsProfileDialogOpen(true);
    },
    [profile, savedProfileOptions.length],
  );

  const handleToggleSavedProfile = useCallback(
    (nextProfile: string): void => {
      const isSelected = selectedProfileValues.includes(nextProfile);
      let nextSelectedProfiles = selectedProfileValues;

      if (isSelected) {
        nextSelectedProfiles = selectedProfileValues.filter(
          (selectedProfile) => selectedProfile !== nextProfile,
        );
      } else if (selectedProfileValues.length < 2) {
        nextSelectedProfiles = [...selectedProfileValues, nextProfile];
      }

      const nextSelectionValue = serializeProfileSelection(nextSelectedProfiles);

      setProfile(nextSelectionValue);
      setProfileDraft(parseChatProfile(nextSelectedProfiles[0] ?? nextProfile));
      onSelectSavedProfile(nextSelectedProfiles);
    },
    [onSelectSavedProfile, selectedProfileValues, setProfile],
  );

  const handleEditSavedProfile = useCallback((savedProfile: string): void => {
    setEditingProfileValue(savedProfile);
    setProfileDraft(parseChatProfile(savedProfile));
    setIsAddingProfile(true);
  }, []);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!hasQuestion || isSending) {
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

  const renderMessageBody = useCallback(
    (message: ConversationSession["messages"][number]) => {
      if (message.role === "tool" && message.pending) {
        return (
          <article className="w-full max-w-160 min-w-0 rounded-[24px] border border-cyan-300/15 bg-linear-to-br from-cyan-300/12 to-cyan-300/5 px-4 py-4 text-cyan-50 shadow-lg shadow-black/10 transition-all duration-500 md:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/12 px-2.5 py-1 text-[10px] font-semibold tracking-[0.22em] text-cyan-100/80 uppercase">
                단계별 도구 분석
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/15 bg-black/10 px-2.5 py-1 text-[11px] text-cyan-100/85">
                <span className="size-1.5 animate-pulse rounded-full bg-cyan-300" />
                분석중
              </span>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-3">
              <div className="rounded-2xl border border-cyan-300/18 bg-black/10 px-3 py-2.5">
                <div className="text-[10px] tracking-[0.18em] text-cyan-100/55 uppercase">
                  Step 1
                </div>
                <p className="mt-1 text-sm font-medium text-cyan-50">도구 분석중</p>
              </div>
              <div className="hidden h-px bg-cyan-300/18 md:block" />
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-zinc-400">
                <div className="text-[10px] tracking-[0.18em] text-zinc-500 uppercase">
                  Step 2
                </div>
                <p className="mt-1 text-sm">분석 완료 후 결과 정리</p>
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/15">
              <div className="h-full w-2/5 animate-pulse rounded-full bg-cyan-300/80 transition-all duration-700" />
            </div>
          </article>
        );
      }

      if (message.role === "tool" && message.toolResults?.length) {
        return (
          <article className="w-full max-w-240 min-w-0 overflow-hidden bg-transparent py-1">
            <ToolRunResults toolResults={message.toolResults} />
          </article>
        );
      }

      if (message.role === "tool") {
        return (
          <article className="w-full max-w-240 min-w-0 rounded-2xl border border-cyan-300/15 bg-cyan-300/10 px-5 py-4 text-cyan-50 shadow-lg shadow-black/10">
            <div className="mb-3 text-[11px] font-semibold tracking-[0.24em] text-cyan-100/70 uppercase">
              단계별 도구 분석
            </div>
            <p className="text-sm leading-7 wrap-break-word whitespace-pre-wrap md:text-[15px]">
              {message.content}
            </p>
          </article>
        );
      }

      return (
        <article
          className={cn(
            "max-w-[86%] min-w-0 rounded-[28px] border px-5 py-4 shadow-lg shadow-black/10 md:max-w-180",
            message.role === "user"
              ? "border-transparent bg-zinc-50 text-zinc-950"
              : "border-white/10 bg-white/5 text-zinc-100",
            message.pending ? "opacity-70" : "opacity-100",
          )}
        >
          <div className="mb-3 text-[11px] font-semibold tracking-[0.24em] text-zinc-500 uppercase">
            {message.role === "assistant" ? "루모 AI" : "나"}
          </div>
          {message.role === "assistant" ? (
            <div className="space-y-3">
              <Streamdown
                className="lumo-streamdown text-sm leading-7 wrap-break-word md:text-[15px]"
                animated
                isAnimating={message.pending}
              >
                {message.content}
              </Streamdown>
              {message.followUpSuggestions?.length ? (
                <div className="flex flex-wrap gap-2">
                  {message.followUpSuggestions.slice(0, 3).map((suggestion) => (
                    <button
                      key={`${message.id}-${suggestion}`}
                      type="button"
                      className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-left text-xs text-cyan-50 transition hover:bg-cyan-300/18 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                      disabled={isSending}
                      onClick={() => {
                        onFollowUpSelect(suggestion).catch(() => undefined);
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm leading-7 wrap-break-word whitespace-pre-wrap md:text-[15px]">
              {message.content}
            </p>
          )}
        </article>
      );
    },
    [isSending, onFollowUpSelect],
  );

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

      <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden px-4 py-4 md:px-6 md:py-6">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {hasMessages ? (
            <div
              ref={setMessageScrollContainer}
              className="flex min-h-0 flex-1 overflow-hidden"
            >
              <ScrollArea className="h-full min-h-0 flex-1 overflow-hidden">
                <div className="min-w-0 space-y-4 p-4 md:p-5">
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
                            Lumo AI Chat
                          </div>
                          <h2 className="font-display mt-2 text-2xl leading-tight tracking-tight wrap-break-word text-white md:mt-3 md:text-4xl">
                            {activeConversation.title}
                          </h2>
                        </div>
                      </div>
                    </div>
                  </div>

                  {activeConversation.messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex min-w-0",
                        message.role === "user" ? "justify-end" : "justify-start",
                      )}
                    >
                      {renderMessageBody(message)}
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
          ) : (
            <div
              ref={setEmptyStateScrollContainer}
              className="flex h-full min-h-0 w-full min-w-0 flex-col items-center justify-start overflow-y-auto rounded-[28px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_42%),rgba(255,255,255,0.03)] px-5 py-7 text-center md:justify-center md:py-8"
            >
              <Badge
                variant="outline"
                className="border-cyan-300/15 bg-cyan-300/10 px-2.5 py-0.5 text-[11px] text-cyan-100 md:px-3 md:py-1"
              >
                <MessageSquareText className="size-4" />한 줄 질문으로 바로 시작
              </Badge>
              <h1 className="font-display mt-6 text-4xl leading-[0.98] tracking-tight text-white sm:text-5xl xl:text-6xl">
                루모 AI에게
                <br />
                오늘의 흐름을 물어보세요.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-400 sm:text-base sm:leading-8">
                호흡은 간결하게, 해석은 또렷하게. 연애, 진로, 궁합, 재물처럼 지금 마음에 걸린
                질문을 채팅으로 이어가세요.
              </p>

              <div className="mt-5 grid w-full max-w-4xl min-w-0 grid-cols-1 gap-2.5 md:mt-6 md:grid-cols-2 md:gap-3">
                {featuredPrompts.slice(0, 4).map((prompt) => (
                  <button
                    key={prompt.id}
                    type="button"
                    className="rounded-[24px] border border-white/10 bg-white/4 p-4 text-left transition-colors hover:bg-white/[0.07] md:rounded-[28px] md:p-5"
                    onClick={() => {
                      applyPrompt(prompt);
                    }}
                  >
                    <span className="text-[11px] font-semibold tracking-[0.22em] text-zinc-500 uppercase">
                      {prompt.category}
                    </span>
                    <strong className="mt-3 block text-base font-semibold text-white">
                      {prompt.title}
                    </strong>
                    <span className="mt-2 block text-sm leading-6 text-zinc-400">
                      {prompt.summary}
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-auto px-1 pt-6 text-center text-[11px] text-zinc-500 md:text-xs">
                {helperText}
              </div>
            </div>
          )}
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
          <Card className="relative shrink-0 rounded-[28px] border border-white/10 bg-white/5 py-0 shadow-lg shadow-black/10 backdrop-blur-xl">
            {showScrollToBottomButton && activeScrollContainer ? (
              <div className="pointer-events-none absolute inset-x-0 -top-18 z-20 flex justify-center">
                <Button
                  type="button"
                  size="icon"
                  className="pointer-events-auto size-10 rounded-full border border-white/10 bg-[#12141d]/95 text-zinc-100 shadow-lg shadow-black/30 hover:bg-white/8 md:size-11"
                  onClick={handleScrollToBottom}
                >
                  <ArrowDown className="size-4" />
                  <span className="sr-only">아래로 스크롤</span>
                </Button>
              </div>
            ) : null}

            <CardContent className="space-y-2 p-2 md:space-y-3 md:p-3">
              <div className="relative">
                <Textarea
                  aria-label="채팅 질문 입력"
                  className="min-h-18 resize-none rounded-[18px] border border-white/10 bg-[#12141d] px-3 pt-2 pb-12 text-[14px] leading-6 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0 md:min-h-20 md:rounded-[22px] md:px-4 md:pt-3 md:pb-12 md:text-[15px]"
                  rows={2}
                  maxLength={140}
                  value={question}
                  onChange={(event) => {
                    setQuestion(event.target.value);
                  }}
                  placeholder={
                    hasMessages ? "이어서 더 물어보세요..." : "메시지를 입력하세요..."
                  }
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-3 pb-3 md:px-4">
                  <div className="text-[11px] text-zinc-500 tabular-nums md:text-xs">
                    {remainingCharacters} / 140
                  </div>
                  <Button
                    type="button"
                    disabled={!canSubmit}
                    className="pointer-events-auto size-9 rounded-xl bg-zinc-50 text-zinc-950 shadow-lg shadow-black/20 hover:bg-zinc-200 md:size-10"
                    onClick={handleSubmit}
                  >
                    <ArrowUp className="size-4" />
                    <span className="sr-only">{submitButtonLabel}</span>
                  </Button>
                </div>
              </div>

              <Separator className="bg-white/10" />

              <div className="flex flex-wrap items-center gap-1 text-sm text-zinc-300 md:gap-2">
                <div className="flex flex-wrap items-center gap-1 text-sm text-zinc-300 md:gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-7 rounded-full px-2 text-[12px] text-zinc-200 hover:bg-white/6 hover:text-white md:h-9 md:px-2.5 md:text-sm"
                      >
                        <Compass className="size-4" />
                        도구 + {selectedTools.length}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-72 border-white/10 bg-[#12141d] text-zinc-100"
                    >
                      <DropdownMenuLabel>도구 선택</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {toolSelectionKeys.map((toolKey) => {
                        const toolInfo = toolCatalog[toolKey];

                        return (
                          <DropdownMenuCheckboxItem
                            key={toolKey}
                            checked={selectedTools.includes(toolKey)}
                            disabled={
                              selectedTools.length === 1 && selectedTools.includes(toolKey)
                            }
                            className="items-start py-2"
                            onCheckedChange={() => {
                              toggleTool(toolKey);
                            }}
                            onSelect={(event) => {
                              event.preventDefault();
                            }}
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-zinc-100">
                                {toolInfo.label}
                              </span>
                              {toolInfo.beta ? (
                                <span className="inline-flex w-fit rounded-full border border-amber-300/20 bg-amber-300/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-amber-100 uppercase">
                                  beta
                                </span>
                              ) : null}
                              <span className="text-xs text-zinc-500">{toolInfo.blurb}</span>
                            </div>
                          </DropdownMenuCheckboxItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    type="button"
                    variant="ghost"
                    className="h-7 rounded-full px-2 text-[12px] text-zinc-200 hover:bg-white/6 hover:text-white md:h-9 md:px-2.5 md:text-sm"
                    onClick={() => {
                      handleOpenProfileDialog();
                    }}
                  >
                    <UserRound className="size-4" />
                    프로필
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-7 rounded-full px-2 text-[12px] text-zinc-200 hover:bg-white/6 hover:text-white md:h-9 md:px-2.5 md:text-sm"
                      >
                        <Paintbrush className="size-4" />
                        {selectedTone.label}
                        <ChevronDown className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-72 border-white/10 bg-[#12141d] text-zinc-100"
                    >
                      <DropdownMenuLabel>상담 톤</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup
                        value={selectedToneId}
                        onValueChange={(value) =>
                          setSelectedToneId(value as ConversationSession["toneId"])
                        }
                      >
                        {toneOptions.map((toneOption) => (
                          <DropdownMenuRadioItem
                            key={toneOption.id}
                            value={toneOption.id}
                            className="items-start py-2"
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-zinc-100">
                                {toneOption.label}
                              </span>
                              <span className="text-xs text-zinc-500">
                                {toneOption.summary}
                              </span>
                            </div>
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog
          open={isProfileDialogOpen}
          onOpenChange={(open) => {
            setIsProfileDialogOpen(open);

            if (!open) {
              setIsAddingProfile(false);
              setEditingProfileValue(null);
            }
          }}
        >
          <DialogContent className="border-white/10 bg-[#12141d] text-zinc-100 sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>출생 프로필</DialogTitle>
              <DialogDescription className="text-zinc-400">
                이름, 생년월일, 출생지, 성별, 음력/양력, 출생시각을 구조화해서 저장합니다.
              </DialogDescription>
            </DialogHeader>
            {!isAddingProfile && savedProfileOptions.length > 0 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-zinc-200">등록된 프로필 선택</div>
                    <div className="text-xs text-zinc-500">최대 2개까지 선택</div>
                  </div>
                  <div className="grid gap-2">
                    {savedProfileOptions.map((savedProfileOption) => (
                      <div key={savedProfileOption.value} className="flex items-stretch gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={
                            !selectedProfileValues.includes(savedProfileOption.value) &&
                            selectedProfileValues.length >= 2
                          }
                          className={cn(
                            "h-auto flex-1 justify-between rounded-2xl border-white/10 bg-black/20 px-4 py-3 text-left text-zinc-100 hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-50",
                            selectedProfileValues.includes(savedProfileOption.value) &&
                              "border-cyan-300/40 bg-cyan-400/10 text-zinc-50 shadow-[0_0_0_1px_rgba(103,232,249,0.15)]",
                          )}
                          onClick={() => {
                            handleToggleSavedProfile(savedProfileOption.value);
                          }}
                        >
                          <span className="min-w-0 flex-1 wrap-break-word">
                            {savedProfileOption.summary}
                          </span>
                          {selectedProfileValues.includes(savedProfileOption.value) ? (
                            <Check className="ml-3 size-4 shrink-0 text-cyan-100" />
                          ) : null}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-auto rounded-2xl border-white/10 bg-black/20 px-3 text-zinc-300 hover:bg-white/8 hover:text-white"
                          onClick={() => {
                            handleEditSavedProfile(savedProfileOption.value);
                          }}
                        >
                          <Pencil className="size-4" />
                          수정
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    className="rounded-2xl bg-zinc-50 text-zinc-950 hover:bg-zinc-200"
                    onClick={() => {
                      setEditingProfileValue(null);
                      setProfileDraft(defaultChatProfileFields);
                      setIsAddingProfile(true);
                    }}
                  >
                    새 프로필 추가
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-zinc-200">
                      {editingProfileValue ? "프로필 수정" : "새 프로필 추가"}
                    </div>
                    {savedProfileOptions.length > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 rounded-full px-3 text-xs text-zinc-400 hover:bg-white/6 hover:text-white"
                        onClick={() => {
                          setEditingProfileValue(null);
                          setIsAddingProfile(false);
                          setProfileDraft(parseChatProfile(getPrimarySelectedProfile(profile)));
                        }}
                      >
                        목록으로
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <div className="text-sm font-medium text-zinc-200">이름</div>
                  <Input
                    aria-label="이름 입력"
                    className="h-12 rounded-2xl border-white/10 bg-black/20 text-zinc-100 placeholder:text-zinc-500"
                    value={profileDraft.name}
                    onChange={(event) => {
                      setProfileDraft((current) => ({ ...current, name: event.target.value }));
                    }}
                    placeholder="이름을 입력하세요"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <ProfileDropdownField
                    label="출생지"
                    placeholder="도시를 선택하세요"
                    value={profileDraft.location}
                    options={locationOptions}
                    onChange={(value) => {
                      setProfileDraft((current) => ({
                        ...current,
                        location: value,
                      }));
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium text-zinc-200">생년월일</div>
                  <Input
                    aria-label="생년월일 입력"
                    type="date"
                    className="h-12 rounded-2xl border-white/10 bg-black/20 text-zinc-100"
                    value={profileDraft.birthDate}
                    onChange={(event) => {
                      setProfileDraft((current) => ({
                        ...current,
                        birthDate: event.target.value,
                      }));
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium text-zinc-200">성별</div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["남", "여"] as const).map((gender) => (
                      <Button
                        key={gender}
                        type="button"
                        variant="outline"
                        className={cn(
                          "h-12 rounded-2xl border-white/10 bg-black/20 text-zinc-200 hover:bg-white/8 hover:text-white",
                          profileDraft.gender === gender && selectedProfileButtonClassName,
                        )}
                        onClick={() => {
                          setProfileDraft((current) => ({ ...current, gender }));
                        }}
                      >
                        {profileDraft.gender === gender ? (
                          <Check className="mr-2 size-4 shrink-0 text-cyan-100" />
                        ) : null}
                        {gender}
                      </Button>
                    ))}
                  </div>
                </div>

                <ProfileDropdownField
                  label="달력"
                  placeholder="달력 종류를 선택하세요"
                  value={profileDraft.calendarType}
                  options={calendarTypeOptions}
                  onChange={(value) => {
                    setProfileDraft((current) => ({
                      ...current,
                      calendarType: value as ChatProfileFields["calendarType"],
                    }));
                  }}
                />

                <div className="space-y-2 sm:col-span-2">
                  <div className="text-sm font-medium text-zinc-200">출생시각</div>
                  <div className="grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)]">
                    <ProfileDropdownField
                      label="시각 상태"
                      placeholder="입력 여부 선택"
                      value={profileDraft.birthTimeKnown ? "known" : "unknown"}
                      options={birthTimeModeOptions}
                      onChange={(value) => {
                        setProfileDraft((current) => ({
                          ...current,
                          birthTimeKnown: value === "known",
                        }));
                      }}
                    />
                    <ProfileDropdownField
                      label="출생시각"
                      placeholder="시간을 선택하세요"
                      value={profileDraft.birthTime}
                      options={birthTimeDropdownOptions}
                      disabled={!profileDraft.birthTimeKnown}
                      contentClassName="max-h-80 overflow-y-auto"
                      onChange={(value) => {
                        setProfileDraft((current) => ({
                          ...current,
                          birthTime: value,
                        }));
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
            {isAddingProfile ? (
              <>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-300">
                  <div>프로필 요약: {summarizeChatProfile(profileDraft)}</div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    disabled={
                      isSavingProfile ||
                      !isChatProfileComplete(profileDraft) ||
                      (profileDraft.birthTimeKnown && profileDraft.birthTime.length === 0)
                    }
                    className="rounded-2xl bg-zinc-50 text-zinc-950 hover:bg-zinc-200"
                    onClick={handleSaveProfile}
                  >
                    저장 후 목록으로
                  </Button>
                </DialogFooter>
              </>
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
          <DialogContent className="border-white/10 bg-[#12141d] text-zinc-100 sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>대화 공유</DialogTitle>
              <DialogDescription className="text-zinc-400">
                공유 링크로 들어온 사용자는 채팅을 이어서 보낼 수 없고, 현재까지의 대화만 읽을
                수 있습니다.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-300">
              <div className="flex items-center gap-2">
                <Link2 className="size-4 text-zinc-500" />
                <span>
                  {isCreatingShareLink
                    ? "공유 링크를 만드는 중입니다..."
                    : shareUrl || shareError || "공유 링크를 준비합니다."}
                </span>
              </div>
            </div>
            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="outline"
                disabled={!shareUrl}
                className="rounded-2xl border-white/10 bg-transparent text-zinc-100 hover:bg-white/8 hover:text-white"
                onClick={handleCopyShareLink}
              >
                <Copy className="size-4" />
                링크 복사
              </Button>
              <Button
                type="button"
                disabled={!shareUrl}
                className="rounded-2xl bg-zinc-50 text-zinc-950 hover:bg-cyan-100"
                onClick={handleShareToKakao}
              >
                <MessageCircleMore className="size-4" />
                카카오톡으로 공유
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}

export default Chat;
