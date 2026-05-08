import { useCallback, useEffect, useMemo, useState } from "react";

const kakaoJavascriptKey = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;

interface KakaoShareLink {
  mobileWebUrl?: string;
  webUrl?: string;
}

interface KakaoShareButton {
  title: string;
  link: KakaoShareLink;
}

interface KakaoSharePayload {
  objectType: "text";
  text: string;
  link: KakaoShareLink;
  buttons?: KakaoShareButton[];
}

interface KakaoSdk {
  isInitialized(): boolean;
  init(appKey: string): void;
  Share: {
    sendDefault(payload: KakaoSharePayload): void;
  };
}

declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

let kakaoSdkLoadPromise: Promise<KakaoSdk | null> | null = null;

async function ensureKakaoSdk(): Promise<KakaoSdk | null> {
  if (!kakaoJavascriptKey || typeof window === "undefined") {
    return null;
  }

  if (window.Kakao) {
    if (!window.Kakao.isInitialized()) {
      window.Kakao.init(kakaoJavascriptKey);
    }

    return window.Kakao;
  }

  if (!kakaoSdkLoadPromise) {
    kakaoSdkLoadPromise = new Promise<KakaoSdk | null>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[data-kakao-sdk="true"]',
      );

      const initializeKakao = () => {
        if (!window.Kakao) {
          reject(new Error("카카오 SDK를 불러오지 못했습니다."));
          return;
        }

        if (!window.Kakao.isInitialized()) {
          window.Kakao.init(kakaoJavascriptKey);
        }

        resolve(window.Kakao);
      };

      if (existingScript) {
        existingScript.addEventListener("load", initializeKakao, { once: true });
        existingScript.addEventListener(
          "error",
          () => {
            reject(new Error("카카오 SDK 스크립트를 불러오지 못했습니다."));
          },
          { once: true },
        );

        return;
      }

      const script = document.createElement("script");
      script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.5/kakao.min.js";
      script.async = true;
      script.crossOrigin = "anonymous";
      script.dataset.kakaoSdk = "true";
      script.addEventListener("load", initializeKakao, { once: true });
      script.addEventListener(
        "error",
        () => {
          reject(new Error("카카오 SDK 스크립트를 불러오지 못했습니다."));
        },
        { once: true },
      );
      document.head.append(script);
    }).catch((error: unknown) => {
      kakaoSdkLoadPromise = null;
      throw error;
    });
  }

  return kakaoSdkLoadPromise;
}

interface UseChatShareStateParams {
  conversationId: string;
  conversationTitle: string;
  hasMessages: boolean;
  isDraftConversation: boolean;
  isReadOnly: boolean;
  onCreateShareLink: (conversationId: string) => Promise<string>;
}

interface UseChatViewStateParams {
  hasMessages: boolean;
  hasProfile: boolean;
  isAuthenticated: boolean;
  isReadOnly: boolean;
  isSending: boolean;
  kakaoReady: boolean;
  question: string;
  requestError: string;
  scrollDependency: number;
}

export function useChatShareState({
  conversationId,
  conversationTitle,
  hasMessages,
  isDraftConversation,
  isReadOnly,
  onCreateShareLink,
}: UseChatShareStateParams) {
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isCreatingShareLink, setIsCreatingShareLink] = useState(false);
  const [shareError, setShareError] = useState("");
  const [shareUrl, setShareUrl] = useState("");

  const handleOpenShareDialog = useCallback(async (): Promise<void> => {
    if (isReadOnly || isDraftConversation || !hasMessages) {
      return;
    }

    setIsShareDialogOpen(true);
    setShareError("");
    setShareUrl("");

    setIsCreatingShareLink(true);

    try {
      setShareUrl(await onCreateShareLink(conversationId));
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "공유 링크 생성에 실패했습니다.");
    } finally {
      setIsCreatingShareLink(false);
    }
  }, [conversationId, hasMessages, isDraftConversation, isReadOnly, onCreateShareLink]);

  const handleCopyShareLink = useCallback(async (): Promise<void> => {
    if (!shareUrl) {
      return;
    }

    await navigator.clipboard.writeText(shareUrl);
  }, [shareUrl]);

  const handleShareToKakao = useCallback(async (): Promise<void> => {
    if (!shareUrl) {
      return;
    }

    const fallbackToSharer = () => {
      window.open(
        `https://sharer.kakao.com/talk/friends/picker/link?url=${encodeURIComponent(shareUrl)}`,
        "_blank",
        "noopener,noreferrer",
      );
    };

    try {
      const kakao = await ensureKakaoSdk();

      if (!kakao) {
        fallbackToSharer();
        return;
      }

      kakao.Share.sendDefault({
        objectType: "text",
        text: `${conversationTitle}\n\n루모 AI 대화를 확인해 보세요.`,
        link: {
          mobileWebUrl: shareUrl,
          webUrl: shareUrl,
        },
        buttons: [
          {
            title: "대화 보기",
            link: {
              mobileWebUrl: shareUrl,
              webUrl: shareUrl,
            },
          },
        ],
      });
    } catch {
      fallbackToSharer();
    }
  }, [conversationTitle, shareUrl]);

  return {
    handleCopyShareLink,
    handleOpenShareDialog,
    handleShareToKakao,
    isCreatingShareLink,
    isShareDialogOpen,
    setIsShareDialogOpen,
    shareError,
    shareUrl,
  };
}

export function useChatViewState({
  hasMessages,
  hasProfile,
  isAuthenticated,
  isReadOnly,
  isSending,
  kakaoReady,
  question,
  requestError,
  scrollDependency,
}: UseChatViewStateParams) {
  const [messageScrollContainer, setMessageScrollContainer] = useState<HTMLDivElement | null>(
    null,
  );
  const [emptyStateScrollContainer, setEmptyStateScrollContainer] =
    useState<HTMLDivElement | null>(null);
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);

  const hasQuestion = question.trim().length > 0;
  const canSubmit = hasQuestion && !isSending;
  const remainingCharacters = 140 - question.length;

  const submitButtonLabel = useMemo(() => {
    if (isSending) {
      return "루모 AI 답변 생성 중";
    }

    if (isAuthenticated) {
      return "질문 보내기";
    }

    return "로그인 후 전송";
  }, [isAuthenticated, isSending]);

  const helperText = useMemo(() => {
    if (isReadOnly) {
      return "이 대화는 공유 시점까지의 내용만 표시됩니다.";
    }

    if (!isAuthenticated) {
      return "채팅 전송과 채팅 내역은 로그인 후에만 사용할 수 있습니다.";
    }

    if (!hasProfile) {
      return "질문을 보내기 전에 출생 프로필을 먼저 등록해 주세요.";
    }

    if (!kakaoReady) {
      return "카카오 연동 키가 없어 현재 로그인 버튼은 비활성화됩니다.";
    }

    return "중요한 결정은 전문가와 상담하세요.";
  }, [hasProfile, isAuthenticated, isReadOnly, kakaoReady]);

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

    return () => {
      container.removeEventListener("scroll", updateScrollButton);
      window.removeEventListener("resize", updateScrollButton);
    };
  }, [activeScrollContainer, hasMessages, requestError, scrollDependency]);

  const handleScrollToBottom = useCallback(() => {
    if (!activeScrollContainer) {
      return;
    }

    activeScrollContainer.scrollTo({
      top: activeScrollContainer.scrollHeight,
      behavior: "smooth",
    });
  }, [activeScrollContainer]);

  return {
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
  };
}
