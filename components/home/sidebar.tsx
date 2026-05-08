"use client";

import { CirclePlus, Clock3, Search, Trash2 } from "lucide-react";
import Image from "next/image";
import type { Session } from "next-auth";
import { useMemo, useState } from "react";

import AuthActions from "@/components/home/auth-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sidebar as AppSidebarShell,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import type { ConversationPreview } from "@/lib/lumo-content";
import { cn } from "@/lib/utils";
import LumoLogoImage from "@/public/lumo-ai-symbol-logo.png";

interface SidebarProps {
  activeConversationId: string;
  conversations: ConversationPreview[];
  kakaoReady: boolean;
  session: Session | null;
  onDeleteConversation: (conversationId: string) => Promise<void>;
  onNewChat: () => void;
  onOpenLoginModal: () => void;
  onSelectConversation: (conversationId: string) => void;
}

function Sidebar({
  activeConversationId,
  conversations,
  kakaoReady,
  session,
  onDeleteConversation,
  onNewChat,
  onOpenLoginModal,
  onSelectConversation,
}: SidebarProps) {
  const isAuthenticated = Boolean(session?.user);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const isSearching = normalizedSearchQuery.length > 0;
  const filteredConversations = useMemo(
    () =>
      normalizedSearchQuery.length === 0
        ? conversations
        : conversations.filter((conversation) =>
            conversation.title.toLowerCase().includes(normalizedSearchQuery),
          ),
    [conversations, normalizedSearchQuery],
  );
  const emptyConversationState = isSearching ? (
    <div className="rounded-[24px] border border-dashed border-white/10 bg-black/20 p-5 text-center">
      <div className="text-sm font-medium text-zinc-200">검색 결과가 없습니다.</div>
      <p className="mt-2 text-sm leading-6 text-zinc-500">다른 제목으로 다시 찾아보세요.</p>
    </div>
  ) : (
    <div className="rounded-[24px] border border-dashed border-white/10 bg-black/20 p-5 text-center">
      <div className="text-sm font-medium text-zinc-200">아직 저장된 채팅이 없습니다.</div>
      <p className="mt-2 text-sm leading-6 text-zinc-500">
        로그인한 상태에서 첫 질문을 보내면 이곳에 대화가 쌓입니다.
      </p>
    </div>
  );
  const conversationListContent =
    filteredConversations.length > 0
      ? filteredConversations.map((conversation) => {
          const isActive = activeConversationId === conversation.id;

          return (
            <SidebarMenuItem key={conversation.id}>
              <div
                className={cn(
                  "flex items-center gap-2 rounded-[22px] border px-3 py-2.5 transition-colors duration-200",
                  isActive
                    ? "border-cyan-300/25 bg-cyan-300/10 text-zinc-50 shadow-lg shadow-black/10"
                    : "border-white/10 bg-white/4 text-zinc-200 hover:bg-white/8 hover:text-white",
                )}
              >
                <SidebarMenuButton
                  type="button"
                  isActive={isActive}
                  className="h-auto min-w-0 flex-1 bg-transparent! p-0 text-left"
                  onClick={() => {
                    onSelectConversation(conversation.id);
                  }}
                >
                  <div className="truncate text-sm font-semibold text-inherit">
                    {conversation.title}
                  </div>
                </SidebarMenuButton>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 rounded-xl text-zinc-500 hover:bg-rose-400/15 hover:text-rose-300"
                  aria-label="채팅 삭제"
                  onClick={() => {
                    setPendingDeleteId(conversation.id);
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </SidebarMenuItem>
          );
        })
      : emptyConversationState;

  return (
    <>
      <Dialog
        open={Boolean(pendingDeleteId)}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <DialogContent className="max-w-sm border-white/10 bg-[#12141d] text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">채팅 삭제</DialogTitle>
            <DialogDescription className="text-zinc-400">
              이 채팅을 삭제하면 복구할 수 없습니다. 정말 삭제하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              className="rounded-2xl text-zinc-400 hover:text-zinc-100"
              disabled={isDeletingConversation}
              onClick={() => setPendingDeleteId(null)}
            >
              취소
            </Button>
            <Button
              type="button"
              className="rounded-2xl bg-rose-500/80 text-white hover:bg-rose-500"
              disabled={isDeletingConversation}
              onClick={async () => {
                if (!pendingDeleteId) return;
                setIsDeletingConversation(true);
                try {
                  await onDeleteConversation(pendingDeleteId);
                } finally {
                  setIsDeletingConversation(false);
                  setPendingDeleteId(null);
                }
              }}
            >
              {isDeletingConversation ? "삭제중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AppSidebarShell
        variant="floating"
        collapsible="offcanvas"
        className="border-sidebar-border/60 text-sidebar-foreground bg-transparent"
      >
        <SidebarHeader className="gap-3 p-3 pt-4">
          <div className="flex items-center gap-3 rounded-[28px] border border-white/10 bg-white/5 p-3 shadow-2xl shadow-black/15 backdrop-blur-2xl">
            <Image
              src={LumoLogoImage}
              width={72}
              height={72}
              alt="Lumo AI Logo"
              className="rounded-2xl"
            />
            <div className="min-w-0">
              <Badge
                variant="outline"
                className="border-cyan-300/15 bg-cyan-300/10 text-[10px] tracking-[0.24em] text-cyan-100 uppercase"
              >
                Lumo AI
              </Badge>
              <div className="mt-2 text-sm font-medium text-zinc-200">
                운명을 비추는 사주 채팅
              </div>
            </div>
          </div>

          <Button
            type="button"
            size="lg"
            className="h-12 rounded-2xl bg-zinc-50 text-zinc-950 hover:bg-zinc-200"
            onClick={onNewChat}
          >
            <CirclePlus className="size-4" />새 채팅
          </Button>
        </SidebarHeader>

        <SidebarContent className="px-3 pb-3">
          {isAuthenticated ? (
            <>
              <SidebarGroup className="rounded-[28px] border border-white/10 bg-black/20 p-3">
                <div className="flex items-center gap-2">
                  <Search className="size-4 text-zinc-500" />
                  <SidebarInput
                    aria-label="대화 검색"
                    className="border-0 bg-transparent px-0 text-zinc-100 shadow-none ring-0 focus-visible:border-0 focus-visible:ring-0"
                    placeholder="대화 찾기"
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                    }}
                  />
                </div>
              </SidebarGroup>

              <SidebarGroup className="px-1 pt-2">
                <div className="flex items-center justify-between">
                  <SidebarGroupLabel className="h-auto px-0 text-[11px] font-semibold tracking-[0.22em] text-zinc-500 uppercase">
                    최근 채팅
                  </SidebarGroupLabel>
                  <Clock3 className="size-4 text-zinc-500" />
                </div>
                <SidebarGroupContent className="mt-3">
                  <SidebarMenu className="gap-3">{conversationListContent}</SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </>
          ) : null}
        </SidebarContent>

        <SidebarFooter className="p-3 pt-0">
          {isAuthenticated ? (
            <AuthActions
              session={session}
              kakaoReady={kakaoReady}
              onOpenLoginModal={onOpenLoginModal}
            />
          ) : (
            <Button
              type="button"
              disabled={!kakaoReady}
              className="w-full rounded-2xl border border-white/10 bg-white/5 text-zinc-100 hover:bg-white/8"
              onClick={onOpenLoginModal}
            >
              로그인하기
            </Button>
          )}
        </SidebarFooter>
        <SidebarRail />
      </AppSidebarShell>
    </>
  );
}

export default Sidebar;
