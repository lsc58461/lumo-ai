"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ChatDeleteProfileDialogProps {
  open: boolean;
  isDeletingProfile: boolean;
  canDelete: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}

export function ChatDeleteProfileDialog({
  open,
  isDeletingProfile,
  canDelete,
  onOpenChange,
  onConfirm,
}: ChatDeleteProfileDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#11131a] text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>프로필 삭제</DialogTitle>
          <DialogDescription className="text-zinc-400">
            선택한 출생 프로필을 삭제합니다. 이 작업은 되돌릴 수 없습니다.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="rounded-2xl border-white/10 bg-black/20 text-zinc-200 hover:bg-white/8 hover:text-white"
            disabled={isDeletingProfile}
            onClick={() => {
              onOpenChange(false);
            }}
          >
            취소
          </Button>
          <Button
            type="button"
            className="rounded-2xl bg-red-500/90 text-white hover:bg-red-500"
            disabled={!canDelete || isDeletingProfile}
            onClick={() => {
              onConfirm().catch(() => undefined);
            }}
          >
            삭제
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
