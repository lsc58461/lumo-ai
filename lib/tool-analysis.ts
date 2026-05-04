import {
  toolCatalog,
  type ToolExecutionResult,
  type ToolKey,
  type ToolPillarCell,
  type ToolPreviewBadge,
  type ToolTarotCard,
  type ToolZiweiPalace,
} from "@/lib/lumo-content";
import { parseChatProfile } from "@/lib/profile";

interface ParsedBirthProfile {
  raw: string;
  name?: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  gender: string;
  calendarType: "양력" | "음력";
  birthTimeKnown: boolean;
  location?: string;
}

interface ToolAnalysisInput {
  profile: string;
  question: string;
  tools: ToolKey[];
}

const heavenlyStems: ToolPillarCell[] = [
  { hanja: "甲", label: "갑", element: "wood" },
  { hanja: "乙", label: "을", element: "wood" },
  { hanja: "丙", label: "병", element: "fire" },
  { hanja: "丁", label: "정", element: "fire" },
  { hanja: "戊", label: "무", element: "earth" },
  { hanja: "己", label: "기", element: "earth" },
  { hanja: "庚", label: "경", element: "metal" },
  { hanja: "辛", label: "신", element: "metal" },
  { hanja: "壬", label: "임", element: "water" },
  { hanja: "癸", label: "계", element: "water" },
];

const earthlyBranches: ToolPillarCell[] = [
  { hanja: "子", label: "자", element: "water" },
  { hanja: "丑", label: "축", element: "earth" },
  { hanja: "寅", label: "인", element: "wood" },
  { hanja: "卯", label: "묘", element: "wood" },
  { hanja: "辰", label: "진", element: "earth" },
  { hanja: "巳", label: "사", element: "fire" },
  { hanja: "午", label: "오", element: "fire" },
  { hanja: "未", label: "미", element: "earth" },
  { hanja: "申", label: "신", element: "metal" },
  { hanja: "酉", label: "유", element: "metal" },
  { hanja: "戌", label: "술", element: "earth" },
  { hanja: "亥", label: "해", element: "water" },
];

const zodiacSigns = [
  "양자리",
  "황소자리",
  "쌍둥이자리",
  "게자리",
  "사자자리",
  "처녀자리",
  "천칭자리",
  "전갈자리",
  "사수자리",
  "염소자리",
  "물병자리",
  "물고기자리",
];

const tarotDeck = [
  "태양",
  "별",
  "은둔자",
  "힘",
  "정의",
  "달",
  "절제",
  "연인",
  "마법사",
  "전차",
  "세계",
  "운명의 수레바퀴",
];

const ziweiPalaces = [
  "명궁",
  "형제",
  "부처",
  "자녀",
  "재백",
  "질액",
  "천이",
  "복역",
  "관록",
  "전택",
  "복덕",
  "부모",
];

const ziweiStars = [
  "자미",
  "천부",
  "태양",
  "태음",
  "무곡",
  "천기",
  "천상",
  "거문",
  "칠살",
  "파군",
  "염정",
  "탐랑",
];

const nakshatras = [
  "아슈위니",
  "바라니",
  "끄리띠까",
  "로히니",
  "미리가시라",
  "아르드라",
  "푸나르바수",
  "푸시야",
  "아슐레샤",
  "마가",
  "푸르바 팔구니",
  "우타라 팔구니",
];

function hashString(value: string): number {
  return [...value].reduce((accumulator, char, index) => {
    return (accumulator * 31 + char.charCodeAt(0) + index) % 1_000_003;
  }, 7);
}

function modulo(value: number, length: number): number {
  return ((value % length) + length) % length;
}

function parseBirthProfile(rawProfile: string): ParsedBirthProfile {
  const normalizedProfile = rawProfile.replace(/\s+/g, " ").trim();
  const structuredProfile = parseChatProfile(normalizedProfile);

  if (structuredProfile.birthDate) {
    const [year, month, day] = structuredProfile.birthDate.split("-").map(Number);
    const [hour, minute] = structuredProfile.birthTime.split(":").map(Number);

    return {
      raw: normalizedProfile,
      name: structuredProfile.name.trim() || undefined,
      year,
      month,
      day,
      hour: structuredProfile.birthTimeKnown ? hour : 12,
      minute: structuredProfile.birthTimeKnown ? minute : 0,
      gender: structuredProfile.gender || "미입력",
      calendarType: structuredProfile.calendarType || "양력",
      birthTimeKnown: structuredProfile.birthTimeKnown,
    };
  }

  const structuredMatch = normalizedProfile.match(
    /(\d{4})\D+(\d{1,2})\D+(\d{1,2}).*?(?:(오전|오후)\s*)?(\d{1,2})\D+(\d{1,2})?\D*.*?(남|여|남자|여자)?(?:,|\s)?(.*)?$/,
  );

  if (structuredMatch) {
    const [, year, month, day, meridiem, hour, minute, gender, location] = structuredMatch;
    const parsedHour = Number(hour);
    let normalizedHour = parsedHour;

    if (meridiem === "오후" && parsedHour < 12) {
      normalizedHour = parsedHour + 12;
    }

    if (meridiem === "오전" && parsedHour === 12) {
      normalizedHour = 0;
    }

    return {
      raw: normalizedProfile,
      year: Number(year),
      month: Number(month),
      day: Number(day),
      hour: normalizedHour,
      minute: Number(minute ?? 0),
      gender: gender?.startsWith("여") ? "여" : "남",
      calendarType: normalizedProfile.includes("음력") ? "음력" : "양력",
      birthTimeKnown: true,
      location:
        location
          ?.replace(/출생|생시|출생지/g, "")
          .replace(/[ ,]+$/g, "")
          .trim() || undefined,
    };
  }

  const fallbackSeed = hashString(normalizedProfile);

  return {
    raw: normalizedProfile,
    year: 1990 + modulo(fallbackSeed, 20),
    month: modulo(fallbackSeed, 12) + 1,
    day: modulo(fallbackSeed, 28) + 1,
    hour: modulo(fallbackSeed, 24),
    minute: modulo(fallbackSeed, 60),
    gender: fallbackSeed % 2 === 0 ? "남" : "여",
    calendarType: "양력",
    birthTimeKnown: true,
  };
}

function formatBirthArgs(profile: ParsedBirthProfile, includeLocation = false): string {
  const locationText = includeLocation && profile.location ? ` · ${profile.location}` : "";
  const timeText = profile.birthTimeKnown
    ? `${String(profile.hour).padStart(2, "0")}:${String(profile.minute).padStart(2, "0")}`
    : "시각 모름";
  const nameText = profile.name ? `${profile.name} · ` : "";

  return `${nameText}${profile.year}.${profile.month}.${profile.day} · ${profile.calendarType} · ${timeText} · ${profile.gender}${locationText}`;
}

function createExecutionId(toolKey: ToolKey): string {
  const randomPart = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2);

  return `tool-${toolKey}-${randomPart}`;
}

function buildSajuResult(profile: ParsedBirthProfile, question: string): ToolExecutionResult {
  const seed = hashString(`${profile.raw}:${question}:saju`);
  const heavenly = [
    heavenlyStems[modulo(profile.hour + profile.day + seed, heavenlyStems.length)],
    heavenlyStems[modulo(profile.day + seed, heavenlyStems.length)],
    heavenlyStems[modulo(profile.month + seed, heavenlyStems.length)],
    heavenlyStems[modulo(profile.year + seed, heavenlyStems.length)],
  ];
  const earthly = [
    earthlyBranches[modulo(Math.floor(profile.hour / 2) + seed, earthlyBranches.length)],
    earthlyBranches[modulo(profile.day + seed, earthlyBranches.length)],
    earthlyBranches[modulo(profile.month + seed, earthlyBranches.length)],
    earthlyBranches[modulo(profile.year + seed, earthlyBranches.length)],
  ];

  return {
    id: createExecutionId("saju"),
    toolKey: "saju",
    label: toolCatalog.saju.label,
    status: "success",
    args: formatBirthArgs(profile),
    summary:
      "일주와 월주 축이 강하게 잡혀 있어 중요한 선택은 타이밍을 늦추기보다 흐름을 타는 쪽이 유리합니다.",
    variant: "saju",
    pillars: {
      headers: ["시주", "일주", "월주", "년주"],
      heavenly,
      earthly,
      note: "혹시 만세력이 다르게 나왔다면 출생지나 양력/음력 여부를 다시 확인해 보세요.",
    },
  };
}

function buildZiweiResult(profile: ParsedBirthProfile, question: string): ToolExecutionResult {
  const seed = hashString(`${profile.raw}:${question}:ziwei`);
  const palaces: ToolZiweiPalace[] = ziweiPalaces.map((palace, index) => {
    let emphasis: ToolZiweiPalace["emphasis"];

    if (palace === "명궁") {
      emphasis = "ming";
    } else if (palace === "부처" || palace === "재백") {
      emphasis = "core";
    }

    return {
      name: palace,
      stars: [
        ziweiStars[modulo(seed + index * 3, ziweiStars.length)],
        ziweiStars[modulo(seed + index * 5 + 2, ziweiStars.length)],
      ].filter((star, starIndex, stars) => stars.indexOf(star) === starIndex),
      branch: earthlyBranches[modulo(seed + index, earthlyBranches.length)].label,
      emphasis,
    };
  });

  return {
    id: createExecutionId("ziwei"),
    toolKey: "ziwei",
    label: toolCatalog.ziwei.label,
    status: "success",
    args: formatBirthArgs(profile),
    summary: "명궁과 재백궁에 힘이 실려 있어 실무 감각과 장기적인 축적형 운이 같이 보입니다.",
    variant: "ziwei",
    grid: {
      palaces,
      centerTitle: "자미두수",
      centerLines: ["화육국", "명주 무곡 · 신주 천기", "큰 흐름은 축적형, 승부는 후반형"],
    },
  };
}

function createPlacement(
  label: string,
  signIndex: number,
  degreeSeed: number,
  tone: ToolPreviewBadge["tone"],
) {
  return {
    label,
    value: zodiacSigns[modulo(signIndex, zodiacSigns.length)],
    subvalue: `${String(modulo(degreeSeed, 30)).padStart(2, "0")}° ${String(
      modulo(degreeSeed * 7, 60),
    ).padStart(2, "0")}'`,
    tone,
  } satisfies ToolPreviewBadge;
}

function buildAstrologyResult(
  profile: ParsedBirthProfile,
  question: string,
): ToolExecutionResult {
  const seed = hashString(`${profile.raw}:${question}:astrology`);

  return {
    id: createExecutionId("astrology"),
    toolKey: "astrology",
    label: toolCatalog.astrology.label,
    status: "success",
    args: formatBirthArgs(profile, true),
    summary:
      "상승점과 태양이 감정선보다 방향성을 더 크게 끌고 가는 타입으로, 큰 인생 테마가 선명한 편입니다.",
    variant: "astrology",
    placements: [
      createPlacement("ASC", profile.hour + seed, seed + profile.minute, "cyan"),
      createPlacement("MC", profile.month + seed, seed + profile.day, "emerald"),
      createPlacement("☉ 태양", profile.day + seed, seed + profile.year, "rose"),
      createPlacement("☽ 달", profile.month + profile.day + seed, seed + profile.hour, "amber"),
    ],
  };
}

function buildTarotResult(profile: ParsedBirthProfile, question: string): ToolExecutionResult {
  const seed = hashString(`${profile.raw}:${question}:tarot`);
  const cards: ToolTarotCard[] = ["현재", "장애", "조언"].map((slot, index) => {
    let meaning = "상대 반응을 기다리기보다 내 기준을 먼저 세우는 쪽이 유리합니다.";

    if (index === 0) {
      meaning = "지금 감정과 현실이 동시에 움직이며 선택 압박이 커지는 구간입니다.";
    } else if (index === 1) {
      meaning = "머릿속 결론이 너무 빨라서 관계나 타이밍을 놓칠 수 있습니다.";
    }

    return {
      slot,
      name: tarotDeck[modulo(seed + index * 2, tarotDeck.length)],
      meaning,
    };
  });

  return {
    id: createExecutionId("tarot"),
    toolKey: "tarot",
    label: toolCatalog.tarot.label,
    status: "success",
    args: formatBirthArgs(profile),
    summary: "감정선은 분명하지만 상대의 속도를 과대해석하지 않는 쪽이 결과가 안정적입니다.",
    variant: "tarot",
    cards,
  };
}

function buildSukyoResult(profile: ParsedBirthProfile, question: string): ToolExecutionResult {
  const seed = hashString(`${profile.raw}:${question}:sukyo`);

  return {
    id: createExecutionId("sukyo"),
    toolKey: "sukyo",
    label: toolCatalog.sukyo.label,
    status: "success",
    args: formatBirthArgs(profile),
    summary: "관계 운에서는 속도보다 리듬과 간격 조절이 더 중요하게 잡히는 패턴입니다.",
    variant: "sukyo",
    badges: [
      {
        label: "관계 리듬",
        value: seed % 2 === 0 ? "가까울수록 안정" : "거리감이 필요",
        tone: "violet",
      },
      {
        label: "충돌 포인트",
        value: seed % 3 === 0 ? "답장 속도" : "감정 온도차",
        tone: "rose",
      },
      {
        label: "잘 맞는 방식",
        value: seed % 5 === 0 ? "생활 루틴 공유" : "명확한 역할 분담",
        tone: "emerald",
      },
      { label: "한 줄 결론", value: "감정보다 호흡을 맞추면 오래 갑니다", tone: "amber" },
    ],
  };
}

function buildMahaboteResult(
  profile: ParsedBirthProfile,
  question: string,
): ToolExecutionResult {
  const seed = hashString(`${profile.raw}:${question}:mahabote`);

  return {
    id: createExecutionId("mahabote"),
    toolKey: "mahabote",
    label: toolCatalog.mahabote.label,
    status: "success",
    args: formatBirthArgs(profile),
    summary: "숫자와 방향의 흐름으로 보면 확장보다 정리와 재배치가 먼저인 시기입니다.",
    variant: "mahabote",
    badges: [
      { label: "탄생 코드", value: String(modulo(seed, 7) + 1), tone: "amber" },
      {
        label: "행운 방향",
        value: ["동", "남동", "남", "서남", "서", "북서", "북"][modulo(seed, 7)],
        tone: "cyan",
      },
      {
        label: "강점",
        value: seed % 2 === 0 ? "축적형 집중력" : "순간 판단력",
        tone: "emerald",
      },
      { label: "주의", value: seed % 3 === 0 ? "무리한 확장" : "과감한 단절", tone: "rose" },
    ],
  };
}

function buildVedicResult(profile: ParsedBirthProfile, question: string): ToolExecutionResult {
  const seed = hashString(`${profile.raw}:${question}:vedic`);

  return {
    id: createExecutionId("vedic"),
    toolKey: "vedic",
    label: toolCatalog.vedic.label,
    status: "success",
    args: formatBirthArgs(profile, true),
    summary:
      "라그나와 월궁성이 현실 판단과 감정의 타이밍을 따로 끌고 가는 타입이라 조급함만 줄이면 적중률이 높습니다.",
    variant: "vedic",
    placements: [
      createPlacement("Lagna", profile.hour + seed, seed + profile.hour, "amber"),
      createPlacement("Moon", profile.day + seed, seed + profile.minute, "cyan"),
      {
        label: "Nakshatra",
        value: nakshatras[modulo(seed, nakshatras.length)],
        subvalue: seed % 2 === 0 ? "직관형" : "계산형",
        tone: "violet",
      },
      {
        label: "Dasha",
        value: seed % 2 === 0 ? "목성 운" : "금성 운",
        subvalue: seed % 2 === 0 ? "확장과 학습" : "관계와 감정",
        tone: "rose",
      },
    ],
  };
}

function normalizeToolKey(toolKey: ToolKey): ToolKey {
  return toolKey === "compatibility" ? "sukyo" : toolKey;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isElementTone(value: unknown): value is ToolPillarCell["element"] {
  return ["wood", "fire", "earth", "metal", "water"].includes(String(value));
}

function isBadgeTone(value: unknown): value is ToolPreviewBadge["tone"] {
  return ["amber", "cyan", "emerald", "rose", "violet", "slate"].includes(String(value));
}

function parseToolPillarCell(value: unknown): ToolPillarCell | null {
  if (!isRecord(value) || typeof value.hanja !== "string" || typeof value.label !== "string") {
    return null;
  }

  if (!isElementTone(value.element)) {
    return null;
  }

  return {
    hanja: value.hanja,
    label: value.label,
    element: value.element,
  };
}

function parsePreviewBadge(value: unknown): ToolPreviewBadge | null {
  if (!isRecord(value) || typeof value.label !== "string" || typeof value.value !== "string") {
    return null;
  }

  return {
    label: value.label,
    value: value.value,
    subvalue: typeof value.subvalue === "string" ? value.subvalue : undefined,
    tone: isBadgeTone(value.tone) ? value.tone : undefined,
  };
}

function parseTarotCard(value: unknown): ToolTarotCard | null {
  if (
    !isRecord(value) ||
    typeof value.slot !== "string" ||
    typeof value.name !== "string" ||
    typeof value.meaning !== "string"
  ) {
    return null;
  }

  return {
    slot: value.slot,
    name: value.name,
    meaning: value.meaning,
  };
}

function parseZiweiPalace(value: unknown): ToolZiweiPalace | null {
  if (
    !isRecord(value) ||
    typeof value.name !== "string" ||
    !Array.isArray(value.stars) ||
    !value.stars.every((star) => typeof star === "string") ||
    typeof value.branch !== "string"
  ) {
    return null;
  }

  const emphasis = ["ming", "shen", "core"].includes(String(value.emphasis))
    ? (value.emphasis as ToolZiweiPalace["emphasis"])
    : undefined;

  return {
    name: value.name,
    stars: value.stars,
    branch: value.branch,
    emphasis,
  };
}

function parseSajuPillars(
  value: unknown,
): Extract<ToolExecutionResult, { variant: "saju" }>["pillars"] | null {
  if (!isRecord(value) || !Array.isArray(value.headers)) {
    return null;
  }

  const heavenly = Array.isArray(value.heavenly) ? value.heavenly.map(parseToolPillarCell) : [];
  const earthly = Array.isArray(value.earthly) ? value.earthly.map(parseToolPillarCell) : [];

  if (
    !value.headers.every((header) => typeof header === "string") ||
    heavenly.some((cell) => cell === null) ||
    earthly.some((cell) => cell === null) ||
    heavenly.length === 0 ||
    earthly.length === 0 ||
    typeof value.note !== "string"
  ) {
    return null;
  }

  return {
    headers: value.headers,
    heavenly: heavenly as ToolPillarCell[],
    earthly: earthly as ToolPillarCell[],
    note: value.note,
  };
}

function parseZiweiGrid(
  value: unknown,
): Extract<ToolExecutionResult, { variant: "ziwei" }>["grid"] | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.palaces) ||
    typeof value.centerTitle !== "string" ||
    !Array.isArray(value.centerLines) ||
    !value.centerLines.every((line) => typeof line === "string")
  ) {
    return null;
  }

  const palaces = value.palaces.map(parseZiweiPalace);

  if (palaces.some((palace) => palace === null) || palaces.length === 0) {
    return null;
  }

  return {
    palaces: palaces as ToolZiweiPalace[],
    centerTitle: value.centerTitle,
    centerLines: value.centerLines,
  };
}

function parseBadgeArray(value: unknown): ToolPreviewBadge[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const badges = value.map(parsePreviewBadge);

  if (badges.some((badge) => badge === null) || badges.length === 0) {
    return null;
  }

  return badges as ToolPreviewBadge[];
}

function parseTarotCardArray(value: unknown): ToolTarotCard[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const cards = value.map(parseTarotCard);

  if (cards.some((card) => card === null) || cards.length === 0) {
    return null;
  }

  return cards as ToolTarotCard[];
}

export function mergeStructuredToolAnalysisResult(
  baseResult: ToolExecutionResult,
  payload: unknown,
): ToolExecutionResult {
  if (!isRecord(payload)) {
    return baseResult;
  }

  const summary =
    typeof payload.summary === "string" && payload.summary.trim().length > 0
      ? payload.summary.trim()
      : baseResult.summary;

  switch (baseResult.variant) {
    case "saju": {
      const pillars = parseSajuPillars(payload.pillars) ?? baseResult.pillars;

      return {
        ...baseResult,
        summary,
        pillars,
      };
    }
    case "ziwei": {
      const grid = parseZiweiGrid(payload.grid) ?? baseResult.grid;

      return {
        ...baseResult,
        summary,
        grid,
      };
    }
    case "astrology":
    case "vedic": {
      const placements = parseBadgeArray(payload.placements) ?? baseResult.placements;

      return {
        ...baseResult,
        summary,
        placements,
      };
    }
    case "tarot": {
      const cards = parseTarotCardArray(payload.cards) ?? baseResult.cards;

      return {
        ...baseResult,
        summary,
        cards,
      };
    }
    case "sukyo":
    case "mahabote": {
      const badges = parseBadgeArray(payload.badges) ?? baseResult.badges;

      return {
        ...baseResult,
        summary,
        badges,
      };
    }
    default:
      return baseResult;
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled tool execution result: ${JSON.stringify(value)}`);
}

export function createToolAnalysisResults({
  profile,
  question,
  tools,
}: ToolAnalysisInput): ToolExecutionResult[] {
  const parsedProfile = parseBirthProfile(profile);

  return tools
    .map((toolKey) => normalizeToolKey(toolKey))
    .map((toolKey) => {
      switch (toolKey) {
        case "saju":
          return buildSajuResult(parsedProfile, question);
        case "astrology":
          return buildAstrologyResult(parsedProfile, question);
        case "ziwei":
          return buildZiweiResult(parsedProfile, question);
        case "tarot":
          return buildTarotResult(parsedProfile, question);
        case "sukyo":
          return buildSukyoResult(parsedProfile, question);
        case "mahabote":
          return buildMahaboteResult(parsedProfile, question);
        case "vedic":
          return buildVedicResult(parsedProfile, question);
        default:
          return buildSajuResult(parsedProfile, question);
      }
    });
}

export function buildToolAnalysisMessage(toolResults: ToolExecutionResult[]): string {
  return toolResults
    .map((result) => {
      switch (result.variant) {
        case "saju":
          return `[${result.label} 분석]\n- ${result.summary}\n- 일주 ${result.pillars.heavenly[1].hanja}${result.pillars.earthly[1].hanja}, 월주 ${result.pillars.heavenly[2].hanja}${result.pillars.earthly[2].hanja}`;
        case "ziwei":
          return `[${result.label} 분석]\n- ${result.summary}\n- 중심 해석: ${result.grid.centerLines.join(" / ")}`;
        case "astrology":
        case "vedic":
          return `[${result.label} 분석]\n- ${result.summary}\n- 핵심 포인트: ${result.placements.map(({ label, value }) => `${label} ${value}`).join(", ")}`;
        case "tarot":
          return `[${result.label} 분석]\n- ${result.summary}\n- 카드: ${result.cards.map(({ slot, name }) => `${slot} ${name}`).join(", ")}`;
        case "sukyo":
        case "mahabote":
          return `[${result.label} 분석]\n- ${result.summary}\n- 포인트: ${result.badges.map(({ label, value }) => `${label} ${value}`).join(", ")}`;
        default:
          return assertNever(result);
      }
    })
    .join("\n\n");
}
