"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Streamdown } from "streamdown";

import { toolCatalog, type ConversationSession } from "@/lib/lumo-content";
import { cn } from "@/lib/utils";

import ToolRunResults from "./tool-run-results";

interface ToolMessageBubbleProps {
  message: ConversationSession["messages"][number] & { role: "tool" };
}

interface ChatMessageBubbleProps {
  isReadOnly: boolean;
  isSending: boolean;
  message: ConversationSession["messages"][number] & { role: "assistant" | "user" };
  onFollowUpSelect: (question: string) => Promise<void>;
}

export function ToolMessageBubble({ message }: ToolMessageBubbleProps) {
  const [isOpen, setIsOpen] = useState(true);
  const isPending = message.pending;
  const hasResults = Boolean(message.toolResults?.length);
  const hasContent = Boolean(message.content);

  const toolLabels = useMemo(() => {
    if (!message.toolResults?.length) return [];
    const seen = new Set<string>();
    return message.toolResults
      .map((r) => toolCatalog[r.toolKey]?.label ?? r.toolKey)
      .filter((label) => {
        if (seen.has(label)) return false;
        seen.add(label);
        return true;
      });
  }, [message.toolResults]);

  return (
    <article className="w-full max-w-240 min-w-0 rounded-[24px] border border-cyan-300/15 bg-linear-to-br from-cyan-300/12 to-cyan-300/5 px-4 py-4 text-cyan-50 shadow-lg shadow-black/10 transition-all duration-500 md:px-5">
      <button
        type="button"
        className="flex w-full flex-wrap items-center gap-2 text-left"
        onClick={() => setIsOpen((v) => !v)}
      >
        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/12 px-2.5 py-1 text-[10px] font-semibold tracking-[0.22em] text-cyan-100/80 uppercase">
          단계별 도구 분석
        </span>
        {isPending ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/15 bg-black/10 px-2.5 py-1 text-[11px] text-cyan-100/85">
            <Loader2 className="size-3 animate-spin text-cyan-300" />
            분석중
          </span>
        ) : (
          <>
            {toolLabels.map((label) => (
              <span
                key={label}
                className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-medium text-cyan-200/80"
              >
                {label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/15 bg-black/10 px-2.5 py-1 text-[11px] text-cyan-100/80">
              완료
            </span>
          </>
        )}
        <span className="ml-auto text-cyan-300/60">
          <ChevronDown
            className={cn(
              "size-4 transition-transform duration-300",
              isOpen ? "rotate-0" : "-rotate-90",
            )}
          />
        </span>
      </button>

      {isOpen && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-300">
          {isPending && !hasResults && (
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-3">
              <div className="rounded-2xl border border-cyan-300/25 bg-cyan-300/8 px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-cyan-300 opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-cyan-300" />
                  </span>
                  <div className="text-[10px] tracking-[0.18em] text-cyan-100/70 uppercase">
                    Step 1 · 진행중
                  </div>
                </div>
                <div className="mt-2 space-y-1.5">
                  <div className="h-2 w-3/4 animate-pulse rounded-full bg-cyan-300/30" />
                  <div
                    className="h-2 w-1/2 animate-pulse rounded-full bg-cyan-300/20"
                    style={{ animationDelay: "200ms" }}
                  />
                </div>
              </div>
              <div className="hidden h-px bg-cyan-300/18 md:block" />
              <div className="rounded-2xl border border-white/8 bg-white/3 px-3 py-2.5 text-zinc-500">
                <div className="text-[10px] tracking-[0.18em] text-zinc-600 uppercase">
                  Step 2 · 대기중
                </div>
                <div className="mt-2 space-y-1.5">
                  <div className="h-2 w-2/3 rounded-full bg-white/8" />
                  <div className="h-2 w-2/5 rounded-full bg-white/5" />
                </div>
              </div>
            </div>
          )}
          {isPending && (
            <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-black/20">
              <div className="absolute inset-y-0 w-1/3 animate-[tool-loading-bar_1.8s_ease-in-out_infinite] rounded-full bg-linear-to-r from-transparent via-cyan-300/90 to-transparent" />
            </div>
          )}
          {hasResults && (
            <div
              className={cn(
                "mt-3",
                isPending && "animate-in fade-in slide-in-from-bottom-1 duration-500",
              )}
            >
              <ToolRunResults toolResults={message.toolResults!} />
            </div>
          )}
          {!hasResults && hasContent && (
            <p className="mt-3 text-sm leading-7 wrap-break-word whitespace-pre-wrap md:text-[15px]">
              {message.content}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

export function ChatMessageBubble({
  isReadOnly,
  isSending,
  message,
  onFollowUpSelect,
}: ChatMessageBubbleProps) {
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
          {!isReadOnly && message.followUpSuggestions?.length ? (
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
}
