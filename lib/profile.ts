export interface ChatProfileFields {
  name: string;
  birthDate: string;
  location: string;
  gender: "남" | "여" | "";
  calendarType: "양력" | "음력" | "";
  birthTimeKnown: boolean;
  birthTime: string;
}

export const defaultChatProfileFields: ChatProfileFields = {
  name: "",
  birthDate: "",
  location: "",
  gender: "",
  calendarType: "",
  birthTimeKnown: false,
  birthTime: "",
};

export const supportedBirthLocations = [
  "서울",
  "부산",
  "대구",
  "인천",
  "광주",
  "대전",
  "울산",
  "세종",
  "수원",
  "춘천",
  "강릉",
  "청주",
  "천안",
  "전주",
  "목포",
  "안동",
  "포항",
  "창원",
  "진주",
  "제주",
] as const;

const birthLocationAliases: Record<string, (typeof supportedBirthLocations)[number]> = {
  서울: "서울",
  부산: "부산",
  대구: "대구",
  인천: "인천",
  광주: "광주",
  대전: "대전",
  울산: "울산",
  세종: "세종",
  수원: "수원",
  춘천: "춘천",
  강릉: "강릉",
  청주: "청주",
  천안: "천안",
  전주: "전주",
  목포: "목포",
  안동: "안동",
  포항: "포항",
  창원: "창원",
  진주: "진주",
  제주: "제주",
};

const PROFILE_SELECTION_PREFIX = "__LUMO_PROFILE_SELECTION__:";

export interface SavedProfileRecord {
  id: string;
  value: string;
}

export function normalizeBirthLocationToken(value: string): string {
  const normalizedValue = value
    .trim()
    .replace(/\s+/g, "")
    .replace(/(특별자치도|특별자치시|특별시|광역시|자치시|시)$/u, "");

  return birthLocationAliases[normalizedValue] ?? "";
}

export function normalizeProfileSelection(profiles: string[]): string[] {
  return Array.from(
    new Set(profiles.map((profile) => profile.trim()).filter((profile) => profile.length > 0)),
  ).slice(0, 2);
}

export function normalizeProfileIds(profileIds: string[]): string[] {
  return Array.from(
    new Set(profileIds.map((profileId) => profileId.trim()).filter((profileId) => profileId)),
  ).slice(0, 2);
}

export function resolveSavedProfileValues(
  profiles: SavedProfileRecord[],
  profileIds: string[],
): string[] {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile.value]));

  return normalizeProfileSelection(
    normalizeProfileIds(profileIds)
      .map((profileId) => profileById.get(profileId) ?? "")
      .filter((profile) => profile.length > 0),
  );
}

export function serializeProfileSelection(profiles: string[]): string {
  const normalizedProfiles = normalizeProfileSelection(profiles);

  if (normalizedProfiles.length === 0) {
    return "";
  }

  if (normalizedProfiles.length === 1) {
    return normalizedProfiles[0] ?? "";
  }

  return `${PROFILE_SELECTION_PREFIX}${JSON.stringify(normalizedProfiles)}`;
}

export function parseProfileSelection(profileValue: string): string[] {
  const normalizedProfileValue = profileValue.trim();

  if (!normalizedProfileValue) {
    return [];
  }

  if (!normalizedProfileValue.startsWith(PROFILE_SELECTION_PREFIX)) {
    return [normalizedProfileValue];
  }

  try {
    const parsedProfiles = JSON.parse(
      normalizedProfileValue.slice(PROFILE_SELECTION_PREFIX.length),
    ) as unknown;

    if (!Array.isArray(parsedProfiles)) {
      return [];
    }

    return normalizeProfileSelection(
      parsedProfiles.filter((profile) => typeof profile === "string"),
    );
  } catch {
    return [];
  }
}

export function getPrimarySelectedProfile(profileValue: string): string {
  return parseProfileSelection(profileValue)[0] ?? "";
}

export function replaceProfileInSelection(
  selectionValue: string,
  previousProfile: string,
  nextProfile: string,
): string {
  const nextProfiles = parseProfileSelection(selectionValue).map((profile) =>
    profile === previousProfile ? nextProfile : profile,
  );

  return serializeProfileSelection(nextProfiles);
}

function normalizeGenderToken(value: string): ChatProfileFields["gender"] {
  if (value.startsWith("여")) {
    return "여";
  }

  if (value.startsWith("남")) {
    return "남";
  }

  return "";
}

function normalizeDateToken(value: string): string {
  const match = value.match(/(\d{4})\D?(\d{1,2})\D?(\d{1,2})/);

  if (!match) {
    return "";
  }

  const [, year, month, day] = match;

  return [year, month.padStart(2, "0"), day.padStart(2, "0")].join("-");
}

function normalizeTimeToken(value: string): string {
  const meridiemMatch = value.match(/(오전|오후)\s*(\d{1,2})\D?(\d{1,2})?/);

  if (meridiemMatch) {
    const [, meridiem, rawHour, rawMinute] = meridiemMatch;
    let hour = Number(rawHour);

    if (meridiem === "오후" && hour < 12) {
      hour += 12;
    }

    if (meridiem === "오전" && hour === 12) {
      hour = 0;
    }

    return `${String(hour).padStart(2, "0")}:${String(Number(rawMinute ?? 0)).padStart(2, "0")}`;
  }

  const timeMatch = value.match(/(\d{1,2})\D?(\d{1,2})/);

  if (!timeMatch) {
    return "";
  }

  const [, hour, minute] = timeMatch;

  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

export function serializeChatProfile(fields: ChatProfileFields): string {
  const normalizedLocation = normalizeBirthLocationToken(fields.location);

  return [
    `이름:${fields.name.trim() || "미입력"}`,
    `생년월일:${fields.birthDate || "미입력"}`,
    `출생지:${normalizedLocation || "미입력"}`,
    `성별:${fields.gender || "미입력"}`,
    `달력:${fields.calendarType || "미입력"}`,
    `출생시각:${fields.birthTimeKnown ? fields.birthTime || "미입력" : "모름"}`,
  ].join(" | ");
}

export function isChatProfileComplete(fields: ChatProfileFields): boolean {
  const hasRequiredFields =
    fields.birthDate &&
    normalizeBirthLocationToken(fields.location) &&
    fields.gender &&
    fields.calendarType;

  return Boolean(hasRequiredFields);
}

export function parseChatProfile(profile: string): ChatProfileFields {
  const primaryProfile = getPrimarySelectedProfile(profile);
  const normalizedProfile = (primaryProfile || profile).replace(/\s+/g, " ").trim();

  if (normalizedProfile.includes("이름:") || normalizedProfile.includes("생년월일:")) {
    const name = normalizedProfile.match(/이름\s*:\s*([^|]+)/)?.[1]?.trim() ?? "";
    const birthDate =
      normalizeDateToken(
        normalizedProfile.match(/생년월일\s*:\s*([^|]+)/)?.[1]?.trim() ?? "",
      ) || defaultChatProfileFields.birthDate;
    const location =
      normalizeBirthLocationToken(
        normalizedProfile.match(/출생지\s*:\s*([^|]+)/)?.[1]?.trim() ?? "",
      ) || defaultChatProfileFields.location;
    const genderToken =
      normalizedProfile.match(/성별\s*:\s*([^|]+)/)?.[1]?.trim() ??
      defaultChatProfileFields.gender;
    const calendarToken =
      normalizedProfile.match(/달력\s*:\s*([^|]+)/)?.[1]?.trim() ??
      defaultChatProfileFields.calendarType;
    const birthTimeToken =
      normalizedProfile.match(/출생시각\s*:\s*([^|]+)/)?.[1]?.trim() ??
      defaultChatProfileFields.birthTime;
    const birthTimeKnown = !["모름", "미상", "알 수 없음"].includes(birthTimeToken);

    return {
      name: name === "미입력" ? "" : name,
      birthDate,
      location,
      gender: normalizeGenderToken(genderToken),
      calendarType: ["양력", "음력"].includes(calendarToken)
        ? (calendarToken as ChatProfileFields["calendarType"])
        : "",
      birthTimeKnown,
      birthTime: birthTimeKnown
        ? normalizeTimeToken(birthTimeToken) || defaultChatProfileFields.birthTime
        : defaultChatProfileFields.birthTime,
    };
  }

  const legacyDate = normalizeDateToken(normalizedProfile);
  const legacyLocation = normalizeBirthLocationToken(normalizedProfile);
  const genderMatch = normalizedProfile.match(/(남자|여자|남|여)/)?.[1] ?? "";
  const timeMatch = normalizeTimeToken(normalizedProfile);

  return {
    ...defaultChatProfileFields,
    birthDate: legacyDate || defaultChatProfileFields.birthDate,
    location: legacyLocation || defaultChatProfileFields.location,
    gender: normalizeGenderToken(genderMatch),
    birthTimeKnown: Boolean(timeMatch),
    birthTime: timeMatch || defaultChatProfileFields.birthTime,
  };
}

export function hasStoredChatProfile(profile: string): boolean {
  const selectedProfiles = parseProfileSelection(profile);

  return (
    selectedProfiles.length > 0 &&
    selectedProfiles.every((selectedProfile) =>
      isChatProfileComplete(parseChatProfile(selectedProfile)),
    )
  );
}

export function summarizeChatProfile(fields: ChatProfileFields): string {
  const dateText = fields.birthDate ? fields.birthDate.replace(/-/g, ".") : "생년월일 미입력";
  const locationText = normalizeBirthLocationToken(fields.location) || "출생지 미입력";
  const timeText = fields.birthTimeKnown ? fields.birthTime : "시각 모름";
  const nameText = fields.name.trim() || "이름 미입력";
  const genderText = fields.gender || "성별 미입력";
  const calendarText = fields.calendarType || "달력 미입력";

  return `${nameText} · ${dateText} · ${locationText} · ${genderText} · ${calendarText} · ${timeText}`;
}

export function summarizeProfileSelection(profileValue: string): string {
  const selectedProfiles = parseProfileSelection(profileValue);

  if (selectedProfiles.length === 0) {
    return "프로필 미선택";
  }

  if (selectedProfiles.length === 1) {
    return summarizeChatProfile(parseChatProfile(selectedProfiles[0] ?? ""));
  }

  return selectedProfiles
    .map((profile) => parseChatProfile(profile))
    .map((fields) => fields.name.trim() || `${fields.location || "미입력"} 프로필`)
    .join(" + ");
}
