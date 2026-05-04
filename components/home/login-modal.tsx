"use client";

import { LoaderCircle, LockKeyhole, MessageSquareMore, Sparkles } from "lucide-react";
import { signIn } from "next-auth/react";
import { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface LoginModalProps {
  kakaoReady: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function LoginModal({ kakaoReady, open, onOpenChange }: LoginModalProps) {
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = useCallback(async (): Promise<void> => {
    if (!kakaoReady || isSigningIn) {
      return;
    }

    setIsSigningIn(true);
    await signIn("kakao", { callbackUrl: "/" });
    setIsSigningIn(false);
  }, [isSigningIn, kakaoReady]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden border-white/10 bg-[#12141d] p-0 text-zinc-50 shadow-2xl shadow-black/50 sm:max-w-md">
        <div className="relative p-6">
          <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_60%)]" />

          <DialogHeader className="relative space-y-4 text-left">
            <Badge
              variant="outline"
              className="w-fit border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[11px] tracking-[0.24em] text-amber-100 uppercase"
            >
              Login Required
            </Badge>
            <div className="space-y-2">
              <DialogTitle className="font-display text-3xl tracking-tight text-white">
                로그인 후 루모 AI 채팅을 이어가세요.
              </DialogTitle>
              <DialogDescription className="text-sm leading-7 text-zinc-400">
                채팅 전송과 대화 내역 보관은 로그인 사용자에게만 열어 두었습니다. 카카오로 한
                번만 들어오면 이후 상담 흐름을 그대로 이어서 볼 수 있습니다.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="relative mt-6 grid gap-3">
            <div className="rounded-3xl border border-white/10 bg-white/4 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/6 p-2.5">
                  <MessageSquareMore className="size-4 text-zinc-100" />
                </div>
                <div className="space-y-1.5">
                  <div className="text-sm font-medium text-zinc-100">대화 기록 자동 저장</div>
                  <p className="text-sm leading-6 text-zinc-400">
                    로그인 후에는 이전에 나눴던 질문과 답변이 계정에 묶여 저장됩니다.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/4 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/6 p-2.5">
                  <Sparkles className="size-4 text-amber-100" />
                </div>
                <div className="space-y-1.5">
                  <div className="text-sm font-medium text-zinc-100">프로필과 톤 유지</div>
                  <p className="text-sm leading-6 text-zinc-400">
                    출생 정보, 선택한 해석 톤, 질문 흐름을 유지해서 더 자연스럽게 이어집니다.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator className="my-6 bg-white/10" />

          <div className="flex flex-col gap-3">
            <Button
              type="button"
              size="lg"
              disabled={!kakaoReady || isSigningIn}
              className="h-12 rounded-2xl bg-[#FEE500] text-[#191600] hover:bg-[#f5dd00]"
              onClick={handleSignIn}
            >
              {isSigningIn ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <LockKeyhole className="size-4" />
              )}
              카카오로 로그인
            </Button>
            <p className="text-xs leading-6 text-zinc-500">
              {kakaoReady
                ? "로그인하면 채팅 전송과 채팅 내역이 즉시 열립니다."
                : "카카오 연동 키가 아직 없어 로그인 버튼을 활성화할 수 없습니다."}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default LoginModal;
