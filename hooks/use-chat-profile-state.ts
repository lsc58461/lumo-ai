import { useCallback, useEffect, useMemo, useState } from "react";

import type { ProfileSelectOption, SavedProfileOption } from "@/components/home/profile-types";
import {
  defaultChatProfileFields,
  getPrimarySelectedProfile,
  parseChatProfile,
  resolveSavedProfileValues,
  serializeChatProfile,
  serializeProfileSelection,
  summarizeChatProfile,
  supportedBirthLocations,
  type ChatProfileFields,
  type SavedProfileRecord,
} from "@/lib/profile";

interface UseChatProfileStateParams {
  availableProfiles: SavedProfileRecord[];
  currentProfile: string;
  selectedProfileIds: string[];
  onDeleteProfile: (profileId: string) => Promise<string>;
  onSaveProfile: (
    profile: string,
    profileId?: string,
    currentSelectionIds?: string[],
  ) => Promise<string>;
  onSelectSavedProfile: (profileIds: string[]) => void;
  setProfile: (profile: string) => void;
}

export function useChatProfileState({
  availableProfiles,
  currentProfile,
  selectedProfileIds,
  onDeleteProfile,
  onSaveProfile,
  onSelectSavedProfile,
  setProfile,
}: UseChatProfileStateParams) {
  const locationOptions = useMemo<ProfileSelectOption[]>(
    () => supportedBirthLocations.map((location) => ({ value: location, label: location })),
    [],
  );
  const calendarTypeOptions = useMemo<ProfileSelectOption[]>(
    () => [
      { value: "양력", label: "양력", description: "일반적인 양력 생일 기준" },
      { value: "음력", label: "음력", description: "음력 생일 기준으로 환산" },
    ],
    [],
  );
  const birthTimeModeOptions = useMemo<ProfileSelectOption[]>(
    () => [
      { value: "known", label: "시각 입력", description: "시주와 ASC/MC 계산에 반영" },
      { value: "unknown", label: "시각 모름", description: "시주와 시간축 계산은 제외" },
    ],
    [],
  );
  const savedProfileOptions = useMemo<SavedProfileOption[]>(
    () =>
      availableProfiles.map((savedProfile) => ({
        id: savedProfile.id,
        value: savedProfile.value,
        summary: summarizeChatProfile(parseChatProfile(savedProfile.value)),
      })),
    [availableProfiles],
  );

  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [pendingDeleteProfileValue, setPendingDeleteProfileValue] = useState<string | null>(
    null,
  );
  const [isDeletingProfile, setIsDeletingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<ChatProfileFields>(defaultChatProfileFields);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);

  useEffect(() => {
    const handleTutorialCloseProfileDialog = () => {
      setIsProfileDialogOpen(false);
      setIsAddingProfile(false);
      setEditingProfileId(null);
    };

    window.addEventListener(
      "lumo:tutorial-close-profile-dialog",
      handleTutorialCloseProfileDialog,
    );

    return () => {
      window.removeEventListener(
        "lumo:tutorial-close-profile-dialog",
        handleTutorialCloseProfileDialog,
      );
    };
  }, []);

  const handleProfileDialogOpenChange = useCallback((open: boolean): void => {
    setIsProfileDialogOpen(open);

    if (!open) {
      setIsAddingProfile(false);
      setEditingProfileId(null);
    }
  }, []);

  const handleOpenProfileDialog = useCallback(
    (showAddForm = false): void => {
      setEditingProfileId(null);
      setProfileDraft(parseChatProfile(getPrimarySelectedProfile(currentProfile)));
      setIsAddingProfile(showAddForm || savedProfileOptions.length === 0);
      setIsProfileDialogOpen(true);
    },
    [currentProfile, savedProfileOptions.length],
  );

  const handleStartAddProfile = useCallback((): void => {
    setEditingProfileId(null);
    setProfileDraft(defaultChatProfileFields);
    setIsAddingProfile(true);
  }, []);

  const handleBackToProfileList = useCallback((): void => {
    setEditingProfileId(null);
    setIsAddingProfile(false);
    setProfileDraft(parseChatProfile(getPrimarySelectedProfile(currentProfile)));
  }, [currentProfile]);

  const handleSaveProfile = useCallback(async (): Promise<void> => {
    setIsSavingProfile(true);

    try {
      const serializedProfile = serializeChatProfile(profileDraft);
      const nextSelectionValue = await onSaveProfile(
        serializedProfile,
        editingProfileId ?? undefined,
        selectedProfileIds,
      );

      setProfile(nextSelectionValue || serializedProfile);
      setEditingProfileId(null);
      setProfileDraft(defaultChatProfileFields);
      setIsAddingProfile(false);
    } finally {
      setIsSavingProfile(false);
    }
  }, [editingProfileId, onSaveProfile, profileDraft, selectedProfileIds, setProfile]);

  const handleToggleSavedProfile = useCallback(
    (nextProfileId: string): void => {
      const isSelected = selectedProfileIds.includes(nextProfileId);
      let nextSelectedProfileIds = selectedProfileIds;

      if (isSelected) {
        nextSelectedProfileIds = selectedProfileIds.filter(
          (selectedProfileId) => selectedProfileId !== nextProfileId,
        );
      } else if (selectedProfileIds.length < 2) {
        nextSelectedProfileIds = [...selectedProfileIds, nextProfileId];
      }

      const nextSelectedProfiles = resolveSavedProfileValues(
        availableProfiles,
        nextSelectedProfileIds,
      );

      const nextSelectionValue = serializeProfileSelection(nextSelectedProfiles);

      setProfile(nextSelectionValue);
      setProfileDraft(parseChatProfile(nextSelectedProfiles[0] ?? ""));
      onSelectSavedProfile(nextSelectedProfileIds);
    },
    [availableProfiles, onSelectSavedProfile, selectedProfileIds, setProfile],
  );

  const handleEditSavedProfile = useCallback(
    (savedProfileId: string): void => {
      const savedProfile = savedProfileOptions.find((option) => option.id === savedProfileId);

      if (!savedProfile) {
        return;
      }

      setEditingProfileId(savedProfileId);
      setProfileDraft(parseChatProfile(savedProfile.value));
      setIsAddingProfile(true);
    },
    [savedProfileOptions],
  );

  const handleRequestDeleteSavedProfile = useCallback((savedProfileId: string): void => {
    setPendingDeleteProfileValue(savedProfileId);
  }, []);

  const handleDeleteProfileDialogOpenChange = useCallback(
    (open: boolean): void => {
      if (!open && !isDeletingProfile) {
        setPendingDeleteProfileValue(null);
      }
    },
    [isDeletingProfile],
  );

  const handleDeleteSavedProfile = useCallback(async (): Promise<void> => {
    if (!pendingDeleteProfileValue) {
      return;
    }

    setIsDeletingProfile(true);

    try {
      const nextSelectionValue = await onDeleteProfile(pendingDeleteProfileValue);

      setProfile(nextSelectionValue);

      if (editingProfileId === pendingDeleteProfileValue) {
        setEditingProfileId(null);
        setProfileDraft(defaultChatProfileFields);
        setIsAddingProfile(false);
      }
    } finally {
      setIsDeletingProfile(false);
      setPendingDeleteProfileValue(null);
    }
  }, [editingProfileId, onDeleteProfile, pendingDeleteProfileValue, setProfile]);

  return {
    birthTimeModeOptions,
    calendarTypeOptions,
    editingProfileId,
    handleBackToProfileList,
    handleDeleteProfileDialogOpenChange,
    handleDeleteSavedProfile,
    handleEditSavedProfile,
    handleOpenProfileDialog,
    handleProfileDialogOpenChange,
    handleRequestDeleteSavedProfile,
    handleSaveProfile,
    handleStartAddProfile,
    handleToggleSavedProfile,
    isAddingProfile,
    isDeletingProfile,
    isProfileDialogOpen,
    isSavingProfile,
    locationOptions,
    pendingDeleteProfileValue,
    profileDraft,
    savedProfileOptions,
    setProfileDraft,
  };
}
