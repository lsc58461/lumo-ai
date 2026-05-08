"use client";

import { Copy, Link2, MessageCircleMore } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ChatShareDialogProps {
  open: boolean;
  isCreatingShareLink: boolean;
  shareUrl: string;
  shareError: string;
  onOpenChange: (open: boolean) => void;
  onCopyShareLink: () => Promise<void>;
  onShareToKakao: () => Promise<void>;
}

export function ChatShareDialog({
  open,
  isCreatingShareLink,
  shareUrl,
  shareError,
  onOpenChange,
  onCopyShareLink,
  onShareToKakao,
}: ChatShareDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#12141d] text-zinc-100 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>대화 공유</DialogTitle>
          <DialogDescription className="text-zinc-400">
            공유 링크로 들어온 사용자는 채팅을 이어서 보낼 수 없고, 현재까지의 대화만 읽을 수
            있습니다.
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
            onClick={() => {
              onCopyShareLink().catch(() => undefined);
            }}
          >
            <Copy className="size-4" />
            링크 복사
          </Button>
          <Button
            type="button"
            disabled={!shareUrl}
            className="rounded-2xl bg-zinc-50 text-zinc-950 hover:bg-cyan-100"
            onClick={() => {
              onShareToKakao().catch(() => undefined);
            }}
          >
            <MessageCircleMore className="size-4" />
            카카오톡으로 공유
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
