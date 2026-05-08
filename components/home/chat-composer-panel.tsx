"use client";

import { ArrowDown, ArrowUp, ChevronDown, Compass, Paintbrush, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  toolSelectionKeys,
  toneOptions,
  toolCatalog,
  type ConversationSession,
} from "@/lib/lumo-content";

interface ChatComposerPanelProps {
  canSubmit: boolean;
  hasMessages: boolean;
  isAuthenticated: boolean;
  question: string;
  remainingCharacters: number;
  selectedProfileCount: number;
  selectedToneId: ConversationSession["toneId"];
  selectedToneLabel: string;
  selectedTools: ConversationSession["tools"];
  showScrollToBottomButton: boolean;
  submitButtonLabel: string;
  onOpenProfileDialog: () => void;
  onQuestionChange: (value: string) => void;
  onRequestLogin: () => void;
  onScrollToBottom: () => void;
  onSubmit: () => void;
  onToggleTool: (toolKey: (typeof toolSelectionKeys)[number]) => void;
  onToneChange: (value: ConversationSession["toneId"]) => void;
}

export function ChatComposerPanel({
  canSubmit,
  hasMessages,
  isAuthenticated,
  question,
  remainingCharacters,
  selectedProfileCount,
  selectedToneId,
  selectedToneLabel,
  selectedTools,
  showScrollToBottomButton,
  submitButtonLabel,
  onOpenProfileDialog,
  onQuestionChange,
  onRequestLogin,
  onScrollToBottom,
  onSubmit,
  onToggleTool,
  onToneChange,
}: ChatComposerPanelProps) {
  return (
    <Card className="relative mx-2 mb-2 shrink-0 rounded-[28px] border border-white/10 bg-white/5 py-0 shadow-lg shadow-black/10 backdrop-blur-xl">
      {showScrollToBottomButton ? (
        <div className="pointer-events-none absolute inset-x-0 -top-18 z-20 flex justify-center">
          <Button
            type="button"
            size="icon"
            className="pointer-events-auto size-10 rounded-full border border-white/10 bg-[#12141d]/95 text-zinc-100 shadow-lg shadow-black/30 hover:bg-white/8 md:size-11"
            onClick={onScrollToBottom}
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
            data-tutorial="composer"
            className="field-sizing-fixed h-18 max-h-18 resize-none overflow-y-auto rounded-[18px] border border-white/10 bg-[#12141d] px-3 pt-2 pr-10 pb-12 text-[14px] leading-6 text-zinc-100 [-ms-overflow-style:none] [scrollbar-width:none] placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0 md:h-20 md:max-h-20 md:rounded-[22px] md:px-4 md:pt-3 md:pb-12 md:text-[15px] [&::-webkit-scrollbar]:hidden"
            rows={2}
            maxLength={140}
            value={question}
            onChange={(event) => {
              onQuestionChange(event.target.value);
            }}
            placeholder={hasMessages ? "이어서 더 물어보세요..." : "메시지를 입력하세요..."}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-end justify-end gap-1 px-3 pb-3 md:px-4">
            <div className="text-[11px] text-zinc-500 tabular-nums md:text-xs">
              {remainingCharacters} / 140
            </div>
            <Button
              type="button"
              disabled={!canSubmit}
              className="pointer-events-auto size-9 rounded-xl bg-zinc-50 text-zinc-950 shadow-lg shadow-black/20 hover:bg-zinc-200 md:size-10"
              onClick={onSubmit}
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
                  data-tutorial="tools-btn"
                  className="h-7 rounded-full px-2 text-[12px] text-zinc-200 hover:bg-white/6 hover:text-white md:h-9 md:px-2.5 md:text-sm"
                >
                  <Compass className="size-4" />
                  도구 + {selectedTools.length}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                data-tutorial="tools-menu"
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
                      disabled={selectedTools.length === 1 && selectedTools.includes(toolKey)}
                      className="items-start py-2"
                      onCheckedChange={() => {
                        onToggleTool(toolKey);
                      }}
                      onSelect={(event) => {
                        event.preventDefault();
                      }}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-zinc-100">{toolInfo.label}</span>
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

            {isAuthenticated ? (
              <Button
                type="button"
                variant="ghost"
                data-tutorial="profile-btn"
                className="h-7 rounded-full px-2 text-[12px] text-zinc-200 hover:bg-white/6 hover:text-white md:h-9 md:px-2.5 md:text-sm"
                onClick={onOpenProfileDialog}
              >
                <UserRound className="size-4" />
                프로필 + {selectedProfileCount}
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                data-tutorial="profile-btn"
                className="h-7 rounded-full px-2 text-[12px] text-zinc-200 hover:bg-white/6 hover:text-white md:h-9 md:px-2.5 md:text-sm"
                onClick={onRequestLogin}
              >
                <UserRound className="size-4" />
                프로필 + {selectedProfileCount}
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  data-tutorial="tone-btn"
                  className="h-7 rounded-full px-2 text-[12px] text-zinc-200 hover:bg-white/6 hover:text-white md:h-9 md:px-2.5 md:text-sm"
                >
                  <Paintbrush className="size-4" />
                  {selectedToneLabel}
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                data-tutorial="tone-menu"
                className="w-72 border-white/10 bg-[#12141d] text-zinc-100"
              >
                <DropdownMenuLabel>상담 톤</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={selectedToneId} onValueChange={onToneChange}>
                  {toneOptions.map((toneOption) => (
                    <DropdownMenuRadioItem
                      key={toneOption.id}
                      value={toneOption.id}
                      className="items-start py-2"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-zinc-100">{toneOption.label}</span>
                        <span className="text-xs text-zinc-500">{toneOption.summary}</span>
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
  );
}
