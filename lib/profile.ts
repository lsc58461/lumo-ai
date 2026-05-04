export interface ChatProfileFields {
  name: string;
  birthDate: string;
  gender: "남" | "여" | "";
  calendarType: "양력" | "음력" | "";
  birthTimeKnown: boolean;
  birthTime: string;
}

export const defaultChatProfileFields: ChatProfileFields = {
  name: "",
  birthDate: "",
  gender: "",
  calendarType: "",
  birthTimeKnown: false,
  birthTime: "",
};

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
  return [
    `이름:${fields.name.trim() || "미입력"}`,
    `생년월일:${fields.birthDate || "미입력"}`,
    `성별:${fields.gender || "미입력"}`,
    `달력:${fields.calendarType || "미입력"}`,
    `출생시각:${fields.birthTimeKnown ? fields.birthTime || "미입력" : "모름"}`,
  ].join(" | ");
}

export function isChatProfileComplete(fields: ChatProfileFields): boolean {
  return Boolean(fields.birthDate && fields.gender && fields.calendarType);
}

export function parseChatProfile(profile: string): ChatProfileFields {
  const normalizedProfile = profile.replace(/\s+/g, " ").trim();

  if (normalizedProfile.includes("이름:") || normalizedProfile.includes("생년월일:")) {
    const name = normalizedProfile.match(/이름\s*:\s*([^|]+)/)?.[1]?.trim() ?? "";
    const birthDate =
      normalizeDateToken(
        normalizedProfile.match(/생년월일\s*:\s*([^|]+)/)?.[1]?.trim() ?? "",
      ) || defaultChatProfileFields.birthDate;
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
  const genderMatch = normalizedProfile.match(/(남자|여자|남|여)/)?.[1] ?? "";
  const timeMatch = normalizeTimeToken(normalizedProfile);

  return {
    ...defaultChatProfileFields,
    birthDate: legacyDate || defaultChatProfileFields.birthDate,
    gender: normalizeGenderToken(genderMatch),
    birthTimeKnown: Boolean(timeMatch),
    birthTime: timeMatch || defaultChatProfileFields.birthTime,
  };
}

export function hasStoredChatProfile(profile: string): boolean {
  return isChatProfileComplete(parseChatProfile(profile));
}

export function summarizeChatProfile(fields: ChatProfileFields): string {
  const dateText = fields.birthDate ? fields.birthDate.replace(/-/g, ".") : "생년월일 미입력";
  const timeText = fields.birthTimeKnown ? fields.birthTime : "시각 모름";
  const nameText = fields.name.trim() || "이름 미입력";
  const genderText = fields.gender || "성별 미입력";
  const calendarText = fields.calendarType || "달력 미입력";

  return `${nameText} · ${dateText} · ${genderText} · ${calendarText} · ${timeText}`;
}
