"use client";

import { BadgeCheck, ChevronsUpDown, HandHeart, LogOut } from "lucide-react";
import type { Session } from "next-auth";
import { signOut } from "next-auth/react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

interface AuthActionsProps {
  session: Session | null;
  kakaoReady: boolean;
  onOpenLoginModal: () => void;
}

function AuthActions({ session, kakaoReady, onOpenLoginModal }: AuthActionsProps) {
  const donationUrl = "https://qr.kakaopay.com/FLrur50TX";
  const userName = session?.user?.name?.split(" ").at(0) ?? "손님";
  const accountLabel = "카카오 로그인";
  const userAvatar = session?.user?.image ?? "";
  const { isMobile } = useSidebar();
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [isDeleteConfirmDialogOpen, setIsDeleteConfirmDialogOpen] = useState(false);
  const [isDonationDialogOpen, setIsDonationDialogOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState("");
  const [deleteConsentText, setDeleteConsentText] = useState("");
  const deleteConsentPhrase = "동의합니다";

  const handleSignOut = useCallback(async (): Promise<void> => {
    await signOut({ callbackUrl: "/" });
  }, []);

  const handleDeleteAccount = useCallback(async (): Promise<void> => {
    if (isDeletingAccount) {
      return;
    }

    setDeleteAccountError("");
    setIsDeletingAccount(true);

    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
      });
      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "회원 탈퇴 처리에 실패했습니다.");
      }

      setIsDeleteConfirmDialogOpen(false);
      setIsAccountDialogOpen(false);
      setDeleteConsentText("");
      await signOut({ callbackUrl: "/" });
    } catch (error) {
      setDeleteAccountError(
        error instanceof Error ? error.message : "회원 탈퇴 처리에 실패했습니다.",
      );
    } finally {
      setIsDeletingAccount(false);
    }
  }, [isDeletingAccount]);

  if (session?.user) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="h-auto rounded-[24px] border border-white/10 bg-white/4 px-3 py-3 text-zinc-100 data-[state=open]:bg-white/8 data-[state=open]:text-white"
              >
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={userAvatar} alt={userName} />
                  <AvatarFallback className="rounded-lg bg-white/8 text-zinc-100">
                    {userName.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{userName}</span>
                  <span className="truncate text-xs text-zinc-400">{accountLabel}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="min-w-56 rounded-lg border-white/10 bg-[#12141d] text-zinc-100"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-2 py-2 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={userAvatar} alt={userName} />
                    <AvatarFallback className="rounded-lg bg-white/8 text-zinc-100">
                      {userName.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{userName}</span>
                    <span className="truncate text-xs text-zinc-400">{accountLabel}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                onClick={() => {
                  setIsDonationDialogOpen(true);
                }}
              >
                <HandHeart className="size-4" />
                후원하기
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                onClick={() => {
                  setIsAccountDialogOpen(true);
                }}
              >
                <BadgeCheck className="size-4" />
                계정
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="size-4" />
                로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog open={isDonationDialogOpen} onOpenChange={setIsDonationDialogOpen}>
            <DialogContent className="border-white/10 bg-[#12141d] text-zinc-100 sm:max-w-md">
              <DialogHeader>
                <DialogTitle>후원하기</DialogTitle>
                <DialogDescription className="text-zinc-400">
                  루모 AI를 계속 다듬고 더 좋은 상담 경험을 만드는 데 큰 도움이 됩니다.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-[24px] border border-cyan-300/15 bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-50">
                  마음에 들었다면 작은 후원으로 응원해 주세요. 후원은 새로운 기능 개선과
                  안정화에 바로 사용되고, 서버 유지에도 큰 도움이 됩니다.
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/4 p-4">
                  <div className="flex justify-center rounded-[24px] bg-white p-4">
                    <QRCodeSVG
                      value={donationUrl}
                      title="카카오페이 후원 QR"
                      size={256}
                      bgColor="#ffffff"
                      fgColor="#111827"
                      includeMargin
                      className="rounded-[20px]"
                    />
                  </div>
                  <p className="mt-4 text-center text-sm leading-6 text-zinc-400">
                    카카오페이 앱으로 QR을 스캔하거나 아래 버튼으로 바로 이동할 수 있습니다.
                  </p>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl border-white/10 bg-transparent text-zinc-100 hover:bg-white/8 hover:text-white"
                  onClick={() => {
                    setIsDonationDialogOpen(false);
                  }}
                >
                  닫기
                </Button>
                <Button asChild className="rounded-2xl bg-zinc-50 text-black hover:bg-zinc-200">
                  <a href={donationUrl} target="_blank" rel="noreferrer" className="text-black">
                    후원하러가기
                  </a>
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isAccountDialogOpen} onOpenChange={setIsAccountDialogOpen}>
            <DialogContent className="border-white/10 bg-[#12141d] text-zinc-100 sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>계정</DialogTitle>
                <DialogDescription className="text-zinc-400">
                  내 정보와 계정 관리를 여기서 확인할 수 있습니다.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-[24px] border border-white/10 bg-white/4 p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 rounded-2xl">
                      <AvatarImage src={userAvatar} alt={userName} />
                      <AvatarFallback className="rounded-2xl bg-white/8 text-zinc-100">
                        {userName.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-white">{userName}</div>
                      <div className="truncate text-sm text-zinc-400">{accountLabel}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                  <div className="text-sm font-semibold tracking-[0.18em] text-zinc-500 uppercase">
                    내 정보
                  </div>
                  <div className="mt-4 space-y-3 text-sm text-zinc-300">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-zinc-500">이름</span>
                      <span className="text-right text-zinc-100">
                        {session.user.name ?? userName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-zinc-500">로그인</span>
                      <span className="text-right text-zinc-100">{accountLabel}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-red-400/20 bg-red-500/10 p-4">
                  <div className="text-sm font-semibold tracking-[0.18em] text-red-100 uppercase">
                    회원 탈퇴
                  </div>
                  <p className="mt-3 text-sm leading-6 text-red-50/85">
                    회원 탈퇴 시 저장된 프로필과 대화 기록을 다시 확인할 수 없습니다.
                  </p>
                  {deleteAccountError ? (
                    <p className="mt-3 text-sm leading-6 text-red-100">{deleteAccountError}</p>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isDeletingAccount}
                    className="mt-4 w-full rounded-2xl border-red-400/30 bg-transparent text-red-100 hover:bg-red-500/10 hover:text-red-50 sm:w-auto"
                    onClick={() => {
                      setDeleteAccountError("");
                      setDeleteConsentText("");
                      setIsDeleteConfirmDialogOpen(true);
                    }}
                  >
                    {isDeletingAccount ? "탈퇴 처리 중" : "회원 탈퇴"}
                  </Button>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:justify-end">
                <div className="flex w-full gap-2 sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isDeletingAccount}
                    className="flex-1 rounded-2xl border-white/10 bg-transparent text-zinc-100 hover:bg-white/8 hover:text-white sm:flex-none"
                    onClick={() => {
                      setIsAccountDialogOpen(false);
                    }}
                  >
                    닫기
                  </Button>
                  <Button
                    type="button"
                    disabled={isDeletingAccount}
                    className="flex-1 rounded-2xl bg-zinc-50 text-zinc-950 hover:bg-zinc-200 sm:flex-none"
                    onClick={handleSignOut}
                  >
                    로그아웃
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={isDeleteConfirmDialogOpen}
            onOpenChange={(open) => {
              setIsDeleteConfirmDialogOpen(open);

              if (!open && !isDeletingAccount) {
                setDeleteConsentText("");
              }
            }}
          >
            <DialogContent className="border-red-400/20 bg-[#12141d] text-zinc-100 sm:max-w-md">
              <DialogHeader>
                <DialogTitle>회원 탈퇴 확인</DialogTitle>
                <DialogDescription className="text-zinc-400">
                  탈퇴를 진행하려면 아래 입력칸에 {deleteConsentPhrase} 를 정확히 입력해 주세요.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-[24px] border border-red-400/20 bg-red-500/10 p-4 text-sm leading-6 text-red-50/90">
                  이 작업은 되돌릴 수 없으며, 저장된 프로필과 채팅 기록이 함께 삭제됩니다.
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium text-zinc-200">확인 문구 입력</div>
                  <Input
                    aria-label="회원 탈퇴 동의 문구 입력"
                    className="h-12 rounded-2xl border-white/10 bg-black/20 text-zinc-100 placeholder:text-zinc-500"
                    value={deleteConsentText}
                    onChange={(event) => {
                      setDeleteConsentText(event.target.value);
                    }}
                    placeholder={deleteConsentPhrase}
                  />
                </div>

                {deleteAccountError ? (
                  <p className="text-sm leading-6 text-red-100">{deleteAccountError}</p>
                ) : null}
              </div>

              <DialogFooter className="gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isDeletingAccount}
                  className="rounded-2xl border-white/10 bg-transparent text-zinc-100 hover:bg-white/8 hover:text-white"
                  onClick={() => {
                    setIsDeleteConfirmDialogOpen(false);
                  }}
                >
                  취소
                </Button>
                <Button
                  type="button"
                  disabled={
                    isDeletingAccount || deleteConsentText.trim() !== deleteConsentPhrase
                  }
                  className="rounded-2xl bg-red-500 text-white hover:bg-red-400 disabled:bg-red-500/40"
                  onClick={handleDeleteAccount}
                >
                  {isDeletingAccount ? "탈퇴 처리 중" : "회원 탈퇴 진행"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <Button
      type="button"
      disabled={!kakaoReady}
      className="w-full rounded-[24px] border border-white/10 bg-white/5 text-zinc-100 hover:bg-white/8"
      onClick={onOpenLoginModal}
    >
      로그인하기
    </Button>
  );
}

export default AuthActions;
