"use client";

import { Check, Pencil, Trash2 } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  isChatProfileComplete,
  summarizeChatProfile,
  type ChatProfileFields,
} from "@/lib/profile";
import { cn } from "@/lib/utils";

import {
  ProfileDatePickerField,
  ProfileDropdownField,
  ProfileTimeInputField,
} from "./profile-fields";
import type { ProfileSelectOption, SavedProfileOption } from "./profile-types";

const selectedProfileButtonClassName =
  "border-cyan-300/45 bg-cyan-400/12 text-zinc-50 font-semibold shadow-[0_0_0_1px_rgba(103,232,249,0.18)]";

interface ChatProfileDialogProps {
  open: boolean;
  isAddingProfile: boolean;
  isDeletingProfile: boolean;
  isSavingProfile: boolean;
  editingProfileId: string | null;
  profileDraft: ChatProfileFields;
  savedProfileOptions: SavedProfileOption[];
  selectedProfileIds: string[];
  locationOptions: ProfileSelectOption[];
  calendarTypeOptions: ProfileSelectOption[];
  birthTimeModeOptions: ProfileSelectOption[];
  setProfileDraft: Dispatch<SetStateAction<ChatProfileFields>>;
  onOpenChange: (open: boolean) => void;
  onStartAddProfile: () => void;
  onBackToList: () => void;
  onToggleSavedProfile: (profileId: string) => void;
  onEditSavedProfile: (profileId: string) => void;
  onRequestDeleteSavedProfile: (profileId: string) => void;
  onSaveProfile: () => void;
}

export function ChatProfileDialog({
  open,
  isAddingProfile,
  isDeletingProfile,
  isSavingProfile,
  editingProfileId,
  profileDraft,
  savedProfileOptions,
  selectedProfileIds,
  locationOptions,
  calendarTypeOptions,
  birthTimeModeOptions,
  setProfileDraft,
  onOpenChange,
  onStartAddProfile,
  onBackToList,
  onToggleSavedProfile,
  onEditSavedProfile,
  onRequestDeleteSavedProfile,
  onSaveProfile,
}: ChatProfileDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-tutorial="profile-dialog"
        className="border-white/10 bg-[#12141d] text-zinc-100 sm:max-w-xl"
        onInteractOutside={(event) => {
          if (document.body.dataset.lumoTutorialOpen === "true") {
            event.preventDefault();
          }
        }}
        onPointerDownOutside={(event) => {
          if (document.body.dataset.lumoTutorialOpen === "true") {
            event.preventDefault();
          }
        }}
      >
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
              <div className="grid gap-1.5">
                {savedProfileOptions.map((savedProfileOption) => (
                  <div
                    key={savedProfileOption.id}
                    className="flex min-w-0 items-stretch gap-1.5"
                  >
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        !selectedProfileIds.includes(savedProfileOption.id) &&
                        selectedProfileIds.length >= 2
                      }
                      className={cn(
                        "h-auto min-h-11 min-w-0 flex-1 justify-between rounded-[18px] border-white/10 bg-black/20 px-3 py-2 text-left text-zinc-100 hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-50",
                        selectedProfileIds.includes(savedProfileOption.id) &&
                          "border-cyan-300/40 bg-cyan-400/10 text-zinc-50 shadow-[0_0_0_1px_rgba(103,232,249,0.15)]",
                      )}
                      onClick={() => {
                        onToggleSavedProfile(savedProfileOption.id);
                      }}
                    >
                      <span className="block min-w-0 flex-1 truncate leading-5">
                        {savedProfileOption.summary}
                      </span>
                      {selectedProfileIds.includes(savedProfileOption.id) ? (
                        <Check className="ml-2 size-4 shrink-0 text-cyan-100" />
                      ) : null}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-8 shrink-0 rounded-[14px] border-white/10 bg-black/20 text-zinc-300 hover:bg-white/8 hover:text-white"
                      aria-label="프로필 수정"
                      onClick={() => {
                        onEditSavedProfile(savedProfileOption.id);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={isDeletingProfile}
                      className="size-8 shrink-0 rounded-[14px] border-white/10 bg-black/20 text-zinc-300 hover:bg-rose-400/15 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="프로필 삭제"
                      onClick={() => {
                        onRequestDeleteSavedProfile(savedProfileOption.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                data-tutorial="add-profile-btn"
                className="rounded-2xl bg-zinc-50 text-zinc-950 hover:bg-zinc-200"
                onClick={onStartAddProfile}
              >
                새 프로필 추가
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div data-tutorial="profile-form" className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-zinc-200">
                  {editingProfileId ? "프로필 수정" : "새 프로필 추가"}
                </div>
                {savedProfileOptions.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 rounded-full px-3 text-xs text-zinc-400 hover:bg-white/6 hover:text-white"
                    onClick={onBackToList}
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

            <ProfileDatePickerField
              label="생년월일"
              value={profileDraft.birthDate}
              onChange={(value) => {
                setProfileDraft((current) => ({
                  ...current,
                  birthDate: value,
                }));
              }}
            />

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
                <ProfileTimeInputField
                  disabled={!profileDraft.birthTimeKnown}
                  onChange={(value) => {
                    setProfileDraft((current) => ({
                      ...current,
                      birthTime: value,
                    }));
                  }}
                  value={profileDraft.birthTime}
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
                onClick={onSaveProfile}
              >
                저장 후 목록으로
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
