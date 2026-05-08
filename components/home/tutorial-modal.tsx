"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";

const TUTORIAL_SEEN_KEY = "lumo:tutorial-seen";

export function markTutorialSeen(): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TUTORIAL_SEEN_KEY, "true");
  }
}

export function isTutorialSeen(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(TUTORIAL_SEEN_KEY) === "true";
}

interface TutorialStepDef {
  readonly id: string;
  readonly target: string;
  readonly title: string;
  readonly description: string;
  readonly compactDescription?: string;
  readonly profilePreview: boolean;
  readonly overlaySelector?: string;
  readonly combineWithTarget?: boolean;
  readonly nextAction?: "open-target";
  readonly closeBeforeEnter?: boolean;
  readonly nextStepId?: string;
  readonly missingTargetStepId?: string;
  readonly nextDelayMs?: number;
}

interface StepPresenceOptions {
  readonly allowTargetOnly?: boolean;
}

const tutorialSteps: readonly TutorialStepDef[] = [
  {
    id: "profile-button",
    target: '[data-tutorial="profile-btn"]',
    title: "프로필 버튼부터 시작",
    description:
      "먼저 프로필 버튼 위치를 익혀두세요. 다음을 누르면 실제로 프로필 모달을 열고, 그 안에서 등록 흐름을 이어서 설명합니다.",
    compactDescription: "다음을 누르면 모달이 열립니다.",
    profilePreview: true,
    nextAction: "open-target",
    nextStepId: "profile-dialog",
    nextDelayMs: 80,
  },
  {
    id: "profile-dialog",
    target: '[data-tutorial="profile-dialog"]',
    title: "프로필 모달",
    description:
      "여기에서 저장된 프로필을 고르거나 관리할 수 있습니다. 새 프로필을 만들려면 아래의 새 프로필 추가 버튼으로 들어갑니다.",
    compactDescription: "저장된 프로필을 고르거나 관리하는 모달입니다.",
    profilePreview: false,
    nextStepId: "add-profile-button",
  },
  {
    id: "add-profile-button",
    target: '[data-tutorial="add-profile-btn"]',
    title: "새 프로필 추가 버튼",
    description:
      "이 버튼을 누르면 새 프로필 입력 폼이 열립니다. 다음을 누르면 실제로 버튼을 눌러서 입력 단계로 넘어갑니다.",
    compactDescription: "이 버튼으로 새 프로필 입력 폼을 엽니다.",
    profilePreview: false,
    nextAction: "open-target",
    nextStepId: "profile-form",
    missingTargetStepId: "profile-form",
    nextDelayMs: 80,
  },
  {
    id: "profile-form",
    target: '[data-tutorial="profile-form"]',
    title: "출생 프로필 입력 폼",
    description:
      "이름, 생년월일, 출생지, 성별, 음력/양력, 출생시각을 차례대로 입력하면 됩니다. 입력이 끝나면 저장 후 목록으로 돌아갈 수 있어요.",
    compactDescription: "이름, 생년월일 등 출생 정보를 입력하고 저장합니다.",
    profilePreview: false,
    nextStepId: "tools-button",
  },
  {
    id: "tools-button",
    target: '[data-tutorial="tools-btn"]',
    title: "도구 버튼",
    description:
      "현재 선택된 도구 수가 여기 보입니다. 다음을 누르면 실제로 드롭다운을 열어서 어떤 도구를 켜고 끌 수 있는지 보여줍니다.",
    compactDescription: "선택된 도구 수를 보여주는 버튼입니다.",
    profilePreview: false,
    nextAction: "open-target",
    nextStepId: "tools-menu",
    closeBeforeEnter: true,
    nextDelayMs: 220,
  },
  {
    id: "tools-menu",
    target: '[data-tutorial="tools-btn"]',
    title: "도구 드롭다운",
    description:
      "사주, 점성술, 자미두수, 타로 등을 조합할 수 있습니다. 여러 개를 함께 켜면 질문을 더 입체적으로 해석할 수 있어요.",
    compactDescription: "사주, 점성술, 타로 등 해석 도구를 고릅니다.",
    profilePreview: false,
    overlaySelector: '[data-tutorial="tools-menu"]',
    combineWithTarget: true,
    nextStepId: "tone-button",
  },
  {
    id: "tone-button",
    target: '[data-tutorial="tone-btn"]',
    title: "톤 버튼",
    description:
      "답변 분위기를 바꾸는 버튼입니다. 다음을 누르면 실제로 톤 목록을 열어 어떤 말투를 고를 수 있는지 보여줍니다.",
    compactDescription: "답변 말투와 분위기를 바꾸는 버튼입니다.",
    profilePreview: false,
    nextAction: "open-target",
    nextStepId: "tone-menu",
    closeBeforeEnter: true,
    nextDelayMs: 220,
  },
  {
    id: "tone-menu",
    target: '[data-tutorial="tone-btn"]',
    title: "톤 드롭다운",
    description:
      "맑고 단정하게부터 전략적으로 냉정하게까지 원하는 톤을 고를 수 있습니다. 질문 성격에 맞게 언제든 바꿀 수 있어요.",
    compactDescription: "원하는 말투와 답변 톤을 선택합니다.",
    profilePreview: false,
    overlaySelector: '[data-tutorial="tone-menu"]',
    combineWithTarget: true,
    nextStepId: "composer",
  },
  {
    id: "composer",
    target: '[data-tutorial="composer"]',
    title: "질문을 입력하고 전송하세요",
    description:
      "결혼, 이직, 궁합, 재물처럼 지금 마음에 걸린 질문을 한 줄로 입력하고 전송해 보세요. 루모 AI가 도구를 조합해 분석해 드립니다.",
    compactDescription: "질문을 입력하고 전송하면 루모 AI가 분석해 드립니다.",
    profilePreview: false,
    closeBeforeEnter: true,
  },
];

const PADDING = 10;
const TOOLTIP_WIDTH = 300;

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getExpandedRect(
  targetRect: DOMRect,
  overlayRect: DOMRect,
  combineWithTarget: boolean,
): SpotlightRect {
  if (!combineWithTarget) {
    return {
      top: overlayRect.top - PADDING,
      left: overlayRect.left - PADDING,
      width: overlayRect.width + PADDING * 2,
      height: overlayRect.height + PADDING * 2,
    };
  }

  const top = Math.min(targetRect.top, overlayRect.top) - PADDING;
  const left = Math.min(targetRect.left, overlayRect.left) - PADDING;
  const right = Math.max(targetRect.right, overlayRect.right) + PADDING;
  const bottom = Math.max(targetRect.bottom, overlayRect.bottom) + PADDING;

  return {
    top,
    left,
    width: right - left,
    height: bottom - top,
  };
}

function isStepPresent(stepDef: TutorialStepDef, options?: StepPresenceOptions): boolean {
  const targetElement = document.querySelector(stepDef.target);
  if (!targetElement) {
    return false;
  }

  if (!stepDef.overlaySelector || options?.allowTargetOnly) {
    return true;
  }

  return document.querySelector(stepDef.overlaySelector) !== null;
}

function activateElement(element: HTMLElement): void {
  element.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      pointerType: "mouse",
      button: 0,
    }),
  );
  element.dispatchEvent(
    new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      button: 0,
    }),
  );
  element.dispatchEvent(
    new MouseEvent("mouseup", {
      bubbles: true,
      cancelable: true,
      button: 0,
    }),
  );
  element.click();
}

function ProfilePreview({ compact = false }: { compact?: boolean }) {
  const fields = ["이름", "생년월일", "출생 시간", "출생지", "성별", "음력 / 양력"];
  const previewFields = compact ? fields.slice(0, 4) : fields;

  return (
    <div
      className={`rounded-xl border border-white/10 bg-black/30 ${compact ? "mt-2 px-2.5 py-2" : "mt-2.5 px-3 py-2.5"}`}
    >
      <div className={`flex flex-wrap ${compact ? "gap-1" : "gap-1.5"}`}>
        {previewFields.map((field) => (
          <span
            key={field}
            className={`rounded-full border border-white/10 bg-white/6 text-zinc-300 ${compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-[11px]"}`}
          >
            {field}
          </span>
        ))}
      </div>
      <p
        className={`text-zinc-500 ${compact ? "mt-1.5 text-[10px] leading-4" : "mt-2 text-[11px] leading-4"}`}
      >
        최대 2개 프로필 동시 사용
      </p>
    </div>
  );
}

interface TutorialOverlayProps {
  open: boolean;
  onClose: () => void;
}

function TutorialOverlay({ open, onClose }: TutorialOverlayProps) {
  const [step, setStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const sendEscape = useCallback(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
  }, []);

  const closeProfileDialog = useCallback(() => {
    window.dispatchEvent(new CustomEvent("lumo:tutorial-close-profile-dialog"));
  }, []);

  const closeOpenDropdowns = useCallback(() => {
    const toolsMenu = document.querySelector('[data-tutorial="tools-menu"]');
    if (toolsMenu) {
      const toolsButton = document.querySelector<HTMLElement>('[data-tutorial="tools-btn"]');
      if (toolsButton) {
        activateElement(toolsButton);
      }
    }

    const toneMenu = document.querySelector('[data-tutorial="tone-menu"]');
    if (toneMenu) {
      const toneButton = document.querySelector<HTMLElement>('[data-tutorial="tone-btn"]');
      if (toneButton) {
        activateElement(toneButton);
      }
    }
  }, []);

  const syncStepUi = useCallback(
    (stepData: TutorialStepDef) => {
      switch (stepData.id) {
        case "profile-button":
        case "tools-button":
        case "tone-button":
        case "composer": {
          closeProfileDialog();
          closeOpenDropdowns();
          sendEscape();
          return;
        }
        case "profile-dialog": {
          if (!isStepPresent(stepData, { allowTargetOnly: true })) {
            const profileButton = document.querySelector<HTMLElement>(
              '[data-tutorial="profile-btn"]',
            );
            if (profileButton) {
              activateElement(profileButton);
            }
          }
          return;
        }
        case "add-profile-button": {
          if (isStepPresent(stepData, { allowTargetOnly: true })) {
            return;
          }

          const backButton = Array.from(document.querySelectorAll("button")).find((button) =>
            button.textContent?.includes("목록으로"),
          );
          if (backButton instanceof HTMLElement) {
            backButton.click();
            return;
          }

          if (!document.querySelector('[data-tutorial="profile-dialog"]')) {
            const profileButton = document.querySelector<HTMLElement>(
              '[data-tutorial="profile-btn"]',
            );
            if (profileButton) {
              activateElement(profileButton);
            }
          }
          return;
        }
        case "profile-form": {
          if (isStepPresent(stepData, { allowTargetOnly: true })) {
            return;
          }

          const addButton = document.querySelector<HTMLElement>(
            '[data-tutorial="add-profile-btn"]',
          );
          if (addButton) {
            activateElement(addButton);
            return;
          }

          const profileButton = document.querySelector<HTMLElement>(
            '[data-tutorial="profile-btn"]',
          );
          if (!document.querySelector('[data-tutorial="profile-dialog"]') && profileButton) {
            activateElement(profileButton);
            window.setTimeout(() => {
              const delayedAddButton = document.querySelector<HTMLElement>(
                '[data-tutorial="add-profile-btn"]',
              );
              if (delayedAddButton) {
                activateElement(delayedAddButton);
              }
            }, 120);
          }
          return;
        }
        case "tools-menu": {
          if (!isStepPresent(stepData)) {
            const toolsButton = document.querySelector<HTMLElement>(
              '[data-tutorial="tools-btn"]',
            );
            if (toolsButton) {
              activateElement(toolsButton);
            }
          }
          break;
        }
        case "tone-menu": {
          if (!isStepPresent(stepData)) {
            const toneButton = document.querySelector<HTMLElement>(
              '[data-tutorial="tone-btn"]',
            );
            if (toneButton) {
              activateElement(toneButton);
            }
          }
          break;
        }
        default:
          break;
      }
    },
    [closeOpenDropdowns, closeProfileDialog, sendEscape],
  );

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (open) {
      document.body.dataset.lumoTutorialOpen = "true";
      return;
    }

    delete document.body.dataset.lumoTutorialOpen;
  }, [open]);

  const moveToStep = useCallback((nextStepId: string | undefined) => {
    if (!nextStepId) {
      setStep((current) => current + 1);
      return;
    }

    const nextStepIndex = tutorialSteps.findIndex(
      (tutorialStep) => tutorialStep.id === nextStepId,
    );
    if (nextStepIndex >= 0) {
      setStep(nextStepIndex);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      window.onresize = null;
      return undefined;
    }

    const stepData = tutorialSteps[step];
    if (!stepData) {
      return undefined;
    }

    if (stepData.closeBeforeEnter) {
      sendEscape();
    }

    const setBaseRect = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      const element = document.querySelector(stepData.target);
      if (!element) {
        setSpotlightRect(null);
        return;
      }

      const rect = element.getBoundingClientRect();

      if (stepData.overlaySelector) {
        const overlayElement = document.querySelector(stepData.overlaySelector);
        if (overlayElement) {
          const overlayRect = overlayElement.getBoundingClientRect();
          setSpotlightRect(
            getExpandedRect(rect, overlayRect, stepData.combineWithTarget ?? false),
          );
          return;
        }
      }

      setSpotlightRect({
        top: rect.top - PADDING,
        left: rect.left - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      });
    };

    setBaseRect();
    window.onresize = setBaseRect;
    window.addEventListener("scroll", setBaseRect, true);
    const intervalId = window.setInterval(setBaseRect, 120);

    const syncTimeoutId = window.setTimeout(
      () => {
        syncStepUi(stepData);
        setBaseRect();
      },
      stepData.closeBeforeEnter ? 80 : 0,
    );

    return () => {
      window.clearTimeout(syncTimeoutId);
      window.clearInterval(intervalId);
      window.removeEventListener("scroll", setBaseRect, true);
    };
  }, [open, sendEscape, step, syncStepUi]);

  const handleClose = useCallback(() => {
    closeProfileDialog();
    sendEscape();
    delete document.body.dataset.lumoTutorialOpen;
    markTutorialSeen();
    onClose();
    setStep(0);
  }, [closeProfileDialog, onClose, sendEscape]);

  const handleNext = useCallback(() => {
    const currentStep = tutorialSteps[step];
    if (!currentStep) {
      handleClose();
      return;
    }

    if (step >= tutorialSteps.length - 1) {
      handleClose();
      return;
    }

    if (currentStep.nextAction === "open-target") {
      const targetElement = document.querySelector<HTMLElement>(currentStep.target);
      if (!targetElement) {
        moveToStep(currentStep.missingTargetStepId ?? currentStep.nextStepId);
        return;
      }

      activateElement(targetElement);

      const nextStep = tutorialSteps.find(
        (tutorialStep) => tutorialStep.id === currentStep.nextStepId,
      );

      if (!nextStep) {
        window.setTimeout(() => {
          moveToStep(currentStep.nextStepId);
        }, currentStep.nextDelayMs ?? 220);
        return;
      }

      const startedAt = window.performance.now();
      const maxWaitMs = Math.max(600, (currentStep.nextDelayMs ?? 220) + 800);
      const tryAdvance = () => {
        if (isStepPresent(nextStep)) {
          moveToStep(currentStep.nextStepId);
          return;
        }

        if (window.performance.now() - startedAt >= maxWaitMs) {
          if (nextStep.overlaySelector && !currentStep.missingTargetStepId) {
            return;
          }

          moveToStep(currentStep.missingTargetStepId ?? currentStep.nextStepId);
          return;
        }

        window.setTimeout(tryAdvance, 80);
      };

      window.setTimeout(tryAdvance, currentStep.nextDelayMs ?? 220);
      return;
    }

    moveToStep(currentStep.nextStepId);
  }, [handleClose, moveToStep, step]);

  if (!open || typeof document === "undefined") return null;

  const currentStep = tutorialSteps[step];
  if (!currentStep) return null;
  const isLastStep = step === tutorialSteps.length - 1;
  const { width, height } = viewport;
  const isCompactViewport = width <= 640 || height <= 720;
  const stepDescription =
    isCompactViewport && currentStep.compactDescription
      ? currentStep.compactDescription
      : currentStep.description;
  const tooltipWidth = isCompactViewport ? Math.max(232, width - 16) : TOOLTIP_WIDTH;
  const compactTooltipHeight = Math.min(232, Math.max(172, Math.round(height * 0.31)));

  let tooltipTop: number | undefined;
  let tooltipBottom: number | undefined;
  let tooltipLeft = 16;

  if (isCompactViewport) {
    if (spotlightRect) {
      const compactMargin = 10;
      const centeredLeft = Math.min(
        Math.max(spotlightRect.left + spotlightRect.width / 2 - tooltipWidth / 2, 8),
        width - tooltipWidth - 8,
      );
      const spaceAbove = spotlightRect.top - compactMargin;
      const spaceBelow = height - (spotlightRect.top + spotlightRect.height) - compactMargin;

      if (spaceAbove >= compactTooltipHeight || spaceAbove > spaceBelow) {
        tooltipTop = Math.max(8, spotlightRect.top - compactTooltipHeight - compactMargin);
        tooltipLeft = centeredLeft;
      } else if (spaceBelow >= compactTooltipHeight) {
        tooltipTop = Math.min(
          height - compactTooltipHeight - 8,
          spotlightRect.top + spotlightRect.height + compactMargin,
        );
        tooltipLeft = centeredLeft;
      } else {
        tooltipBottom = 10;
        tooltipLeft = Math.max(8, (width - tooltipWidth) / 2);
      }
    } else {
      tooltipBottom = 10;
      tooltipLeft = Math.max(8, (width - tooltipWidth) / 2);
    }
  } else if (spotlightRect) {
    const spaceAbove = spotlightRect.top;
    const spaceBelow = height - (spotlightRect.top + spotlightRect.height);
    const spaceRight = width - (spotlightRect.left + spotlightRect.width);
    const leftAligned = Math.min(Math.max(spotlightRect.left, 16), width - tooltipWidth - 16);

    if (spaceAbove >= 180) {
      tooltipBottom = height - spotlightRect.top + 12;
      tooltipLeft = leftAligned;
    } else if (spaceBelow >= 180) {
      tooltipTop = spotlightRect.top + spotlightRect.height + 12;
      tooltipLeft = leftAligned;
    } else if (spaceRight >= TOOLTIP_WIDTH + 24) {
      tooltipTop = Math.max(16, Math.min(spotlightRect.top, height - 240));
      tooltipLeft = spotlightRect.left + spotlightRect.width + 16;
    } else {
      tooltipTop = Math.max(16, spotlightRect.top - 220);
      tooltipLeft = Math.max(16, (width - tooltipWidth) / 2);
    }
  } else {
    tooltipTop = height / 2 - 100;
    tooltipLeft = (width - tooltipWidth) / 2;
  }

  const cornerRadius = 12;

  return createPortal(
    <>
      <svg
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width,
          height,
          display: "block",
          zIndex: 49,
          cursor: "default",
        }}
      >
        <defs>
          <mask id="lumo-tutorial-mask">
            <rect x={0} y={0} width={width} height={height} fill="white" />
            {spotlightRect ? (
              <rect
                x={spotlightRect.left}
                y={spotlightRect.top}
                width={spotlightRect.width}
                height={spotlightRect.height}
                rx={cornerRadius}
                fill="black"
              />
            ) : null}
          </mask>
        </defs>
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="rgba(0,0,0,0.75)"
          mask="url(#lumo-tutorial-mask)"
        />
      </svg>

      {spotlightRect ? (
        <div
          style={{
            position: "fixed",
            top: spotlightRect.top,
            left: spotlightRect.left,
            width: spotlightRect.width,
            height: spotlightRect.height,
            borderRadius: cornerRadius,
            border: "1.5px solid rgba(103,232,249,0.55)",
            boxShadow: "0 0 0 1px rgba(103,232,249,0.14)",
            zIndex: 51,
            pointerEvents: "none",
          }}
        />
      ) : null}

      <div style={{ position: "fixed", inset: 0, zIndex: 52, pointerEvents: "none" }}>
        <div
          className={`absolute border border-white/12 bg-[#0d0f1a] shadow-2xl shadow-black/60 ${isCompactViewport ? "rounded-[18px] px-3 py-3" : "rounded-[20px] px-4 py-4"}`}
          style={{
            width: tooltipWidth,
            maxWidth: `calc(100vw - ${isCompactViewport ? 24 : 32}px)`,
            maxHeight: isCompactViewport ? "min(31vh, 232px)" : "min(60vh, 420px)",
            top: tooltipTop,
            bottom: tooltipBottom,
            left: tooltipLeft,
            pointerEvents: "all",
            overflowY: "auto",
          }}
        >
          <div
            className={`font-semibold tracking-[0.2em] text-cyan-300/70 uppercase ${isCompactViewport ? "mb-1 text-[9px]" : "mb-1 text-[10px]"}`}
          >
            {step + 1} / {tutorialSteps.length}
          </div>
          <div
            className={
              isCompactViewport
                ? "text-[13px] leading-5 font-semibold text-white"
                : "text-sm font-semibold text-white"
            }
          >
            {currentStep.title}
          </div>
          <p
            className={
              isCompactViewport
                ? "mt-1 text-[11px] leading-4 text-zinc-400"
                : "mt-1.5 text-xs leading-5 text-zinc-400"
            }
          >
            {stepDescription}
          </p>
          {currentStep.profilePreview && !isCompactViewport ? <ProfilePreview /> : null}

          <div
            className={`flex items-center justify-between gap-2 ${isCompactViewport ? "mt-2.5" : "mt-3"}`}
          >
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className={`h-auto rounded-full px-1.5 py-0 text-zinc-500 shadow-none hover:bg-transparent hover:text-zinc-300 ${isCompactViewport ? "text-[10px]" : "text-xs"}`}
              onClick={handleClose}
            >
              건너뛰기
            </Button>
            <div className="flex items-center gap-2">
              {step > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className={`rounded-full border-white/10 bg-transparent text-zinc-300 shadow-none hover:bg-white/8 hover:text-zinc-100 ${isCompactViewport ? "px-2 py-1 text-[10px]" : "px-3 py-1 text-xs"}`}
                  onClick={() => {
                    setStep((current) => Math.max(0, current - 1));
                  }}
                >
                  이전
                </Button>
              ) : null}
              <Button
                type="button"
                size="xs"
                className={`rounded-full bg-zinc-50 font-medium text-zinc-950 shadow-none hover:bg-zinc-200 ${isCompactViewport ? "px-2 py-1 text-[10px]" : "px-3 py-1 text-xs"}`}
                onClick={handleNext}
              >
                {isLastStep ? "시작하기" : "다음"}
              </Button>
            </div>
          </div>

          <div className={`flex justify-center gap-1 ${isCompactViewport ? "mt-2" : "mt-3"}`}>
            {tutorialSteps.map((tutorialStep) => (
              <div
                key={tutorialStep.id}
                className={(() => {
                  const activeClass = isCompactViewport
                    ? "h-1.5 w-3.5 bg-cyan-300"
                    : "h-1.5 w-4 bg-cyan-300";
                  const inactiveClass = isCompactViewport
                    ? "size-1 bg-white/20"
                    : "size-1.5 bg-white/20";

                  return `rounded-full transition-all duration-200 ${tutorialStep.id === currentStep.id ? activeClass : inactiveClass}`;
                })()}
              />
            ))}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

export default TutorialOverlay;
