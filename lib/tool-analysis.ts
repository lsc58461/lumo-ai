import { Bazi } from "bazi.js";
import { Horoscope, Origin } from "circular-natal-horoscope-js";
import { Lunar, Solar } from "lunar-javascript";

import {
  toolCatalog,
  type ToolExecutionResult,
  type ToolKey,
  type ToolPillarCell,
  type ToolPreviewBadge,
  type ToolTarotCard,
  type ToolZiweiPalace,
} from "@/lib/lumo-content";
import { normalizeBirthLocationToken, parseChatProfile } from "@/lib/profile";

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

const wuXingLabels: Record<"木" | "火" | "土" | "金" | "水", string> = {
  木: "목",
  火: "화",
  土: "토",
  金: "금",
  水: "수",
};

const birthLocationCoordinates: Record<
  string,
  {
    latitude: number;
    longitude: number;
  }
> = {
  서울: { latitude: 37.5665, longitude: 126.978 },
  부산: { latitude: 35.1796, longitude: 129.0756 },
  대구: { latitude: 35.8714, longitude: 128.6014 },
  인천: { latitude: 37.4563, longitude: 126.7052 },
  광주: { latitude: 35.1595, longitude: 126.8526 },
  대전: { latitude: 36.3504, longitude: 127.3845 },
  울산: { latitude: 35.5384, longitude: 129.3114 },
  세종: { latitude: 36.48, longitude: 127.289 },
  수원: { latitude: 37.2636, longitude: 127.0286 },
  춘천: { latitude: 37.8813, longitude: 127.7298 },
  강릉: { latitude: 37.7519, longitude: 128.8761 },
  청주: { latitude: 36.6424, longitude: 127.489 },
  천안: { latitude: 36.8151, longitude: 127.1139 },
  전주: { latitude: 35.8242, longitude: 127.148 },
  목포: { latitude: 34.8118, longitude: 126.3922 },
  안동: { latitude: 36.5684, longitude: 128.7294 },
  포항: { latitude: 36.019, longitude: 129.3435 },
  창원: { latitude: 35.2281, longitude: 128.6811 },
  진주: { latitude: 35.1799, longitude: 128.1076 },
  제주: { latitude: 33.4996, longitude: 126.5312 },
};

function hashString(value: string): number {
  return [...value].reduce((accumulator, char, index) => {
    return (accumulator * 31 + char.charCodeAt(0) + index) % 1_000_003;
  }, 7);
}

function modulo(value: number, length: number): number {
  return ((value % length) + length) % length;
}

function getHeavenlyStemCell(hanja: string): ToolPillarCell {
  const stem = heavenlyStems.find((item) => item.hanja === hanja);

  if (!stem) {
    throw new Error(`알 수 없는 천간입니다: ${hanja}`);
  }

  return stem;
}

function getEarthlyBranchCell(hanja: string): ToolPillarCell {
  const branch = earthlyBranches.find((item) => item.hanja === hanja);

  if (!branch) {
    throw new Error(`알 수 없는 지지입니다: ${hanja}`);
  }

  return branch;
}

function toSolarBirthProfile(profile: ParsedBirthProfile): ParsedBirthProfile {
  if (profile.calendarType !== "음력") {
    return profile;
  }

  const lunar = Lunar.fromYmdHms(
    profile.year,
    profile.month,
    profile.day,
    profile.hour,
    profile.minute,
    0,
  );
  const solar = lunar.getSolar();

  return {
    ...profile,
    year: solar.getYear(),
    month: solar.getMonth(),
    day: solar.getDay(),
  };
}

function formatWuXingStrength(strength: {
  木: number;
  火: number;
  土: number;
  金: number;
  水: number;
}): string {
  return (Object.entries(strength) as [keyof typeof wuXingLabels, number][])
    .map(([key, value]) => `${wuXingLabels[key]} ${value}`)
    .join(" · ");
}

function createSajuSummary(profile: ParsedBirthProfile, bazi: Bazi): string {
  const siZhu = bazi.getSiZhu();
  const strengthAnalysis = bazi.getStrengthAnalysis();
  const yongShenAnalysis = bazi.getYongShenAnalysis();
  const shenShaAnalysis = bazi.getShenShaAnalysis();
  const shiShenConfig = bazi.getShiShenConfig();
  const topGoodStars = shenShaAnalysis.auspicious.slice(0, 2).map(({ name }) => name);
  const topCautionStars = shenShaAnalysis.inauspicious.slice(0, 2).map(({ name }) => name);
  const monthRole = shiShenConfig.monthGan.shiShen;
  const hourRole = shiShenConfig.hourGan.shiShen;
  const favoredElements = yongShenAnalysis.xiYongShen
    .map((item) => wuXingLabels[item])
    .join(", ");
  const cautionElements = yongShenAnalysis.jiShen.map((item) => wuXingLabels[item]).join(", ");
  const starSentence = [
    topGoodStars.length > 0 ? `길성은 ${topGoodStars.join(", ")}` : "",
    topCautionStars.length > 0 ? `주의 신살은 ${topCautionStars.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("이며 ");

  return [
    profile.birthTimeKnown
      ? `${siZhu.day.gan}${siZhu.day.zhi} 일주를 중심으로 ${strengthAnalysis.isStrong ? "신강" : "신약"} 판정이며, 월간 ${shiShenConfig.monthGan.gan}의 ${monthRole}와 시간 ${shiShenConfig.hourGan.gan}의 ${hourRole} 성향이 함께 두드러집니다.`
      : `${siZhu.day.gan}${siZhu.day.zhi} 일주를 중심으로 ${strengthAnalysis.isStrong ? "신강" : "신약"} 판정이며, 월간 ${shiShenConfig.monthGan.gan}의 ${monthRole} 흐름이 중심축으로 읽힙니다.`,
    `희용신은 ${favoredElements || "판단 보류"}, 기신은 ${cautionElements || "판단 보류"} 쪽으로 읽히며, 오행 세기는 눈에 보이는 글자 수가 아니라 월령과 지장간 가중치를 함께 반영한 기준으로 ${formatWuXingStrength(strengthAnalysis.wuXingStrength)}입니다.`,
    starSentence
      ? `${starSentence} 현재 질문은 타고난 강점을 밀어붙이기보다 균형을 맞추는 쪽에서 해석하는 편이 정확합니다.`
      : `${profile.birthTimeKnown ? "시주까지 반영된" : "시주를 제외한"} 원국 기준으로 균형과 편중을 함께 보는 해석이 유효합니다.`,
  ].join(" ");
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
      location: normalizeBirthLocationToken(structuredProfile.location) || undefined,
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
      location: normalizeBirthLocationToken(
        location
          ?.replace(/출생|생시|출생지/g, "")
          .replace(/[ ,]+$/g, "")
          .trim() ?? "",
      ),
    };
  }

  throw new Error("출생 정보를 정확히 해석할 수 없습니다. 프로필을 다시 저장해 주세요.");
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

function buildSajuResult(profile: ParsedBirthProfile, _question: string): ToolExecutionResult {
  const solarProfile = toSolarBirthProfile(profile);
  const bazi = new Bazi({
    year: solarProfile.year,
    month: solarProfile.month,
    day: solarProfile.day,
    hour: solarProfile.hour,
    minute: solarProfile.minute,
    gender: solarProfile.gender === "여" ? "female" : "male",
  });
  const siZhu = bazi.getSiZhu();
  const heavenly = [
    getHeavenlyStemCell(siZhu.hour.gan),
    getHeavenlyStemCell(siZhu.day.gan),
    getHeavenlyStemCell(siZhu.month.gan),
    getHeavenlyStemCell(siZhu.year.gan),
  ];
  const earthly = [
    getEarthlyBranchCell(siZhu.hour.zhi),
    getEarthlyBranchCell(siZhu.day.zhi),
    getEarthlyBranchCell(siZhu.month.zhi),
    getEarthlyBranchCell(siZhu.year.zhi),
  ];
  const visibleHeaders = profile.birthTimeKnown
    ? ["시주", "일주", "월주", "년주"]
    : ["일주", "월주", "년주"];
  const visibleHeavenly = profile.birthTimeKnown ? heavenly : heavenly.slice(1);
  const visibleEarthly = profile.birthTimeKnown ? earthly : earthly.slice(1);
  const strengthAnalysis = bazi.getStrengthAnalysis();
  const yongShenAnalysis = bazi.getYongShenAnalysis();

  return {
    id: createExecutionId("saju"),
    toolKey: "saju",
    label: toolCatalog.saju.label,
    status: "success",
    args: formatBirthArgs(profile),
    summary: createSajuSummary(profile, bazi),
    variant: "saju",
    pillars: {
      headers: visibleHeaders,
      heavenly: visibleHeavenly,
      earthly: visibleEarthly,
      note: [
        [
          `신강신약: ${strengthAnalysis.isStrong ? "신강" : "신약"}`,
          `희용신: ${yongShenAnalysis.xiYongShen.map((item) => wuXingLabels[item]).join(", ")}`,
        ].join(" · "),
        [
          profile.calendarType === "음력"
            ? "음력 입력을 양력으로 환산해 계산했습니다."
            : "양력 기준으로 계산했습니다.",
          profile.birthTimeKnown
            ? "출생시각을 반영했습니다."
            : "출생시각이 없어 시주는 표기하지 않았습니다.",
        ].join(" · "),
      ].join("\n"),
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

function formatDecimalDegrees(decimalDegrees: number): string {
  const degrees = Math.floor(decimalDegrees);
  const minutes = Math.floor((decimalDegrees - degrees) * 60);

  return `${String(degrees).padStart(2, "0")}° ${String(minutes).padStart(2, "0")}'`;
}

function createAstrologyPlacementFromChart(
  label: string,
  chart: {
    Sign: {
      zodiacStart: number;
      label: string;
    };
    ChartPosition: {
      Ecliptic: {
        DecimalDegrees: number;
      };
    };
    House?: {
      id: number;
    };
  },
  tone: ToolPreviewBadge["tone"],
): ToolPreviewBadge {
  const decimalDegrees = chart.ChartPosition.Ecliptic.DecimalDegrees;
  const signDegrees = decimalDegrees - chart.Sign.zodiacStart;
  const houseText = chart.House ? ` · ${chart.House.id}하우스` : "";

  return {
    label,
    value: zodiacSigns[Math.floor(chart.Sign.zodiacStart / 30)] ?? chart.Sign.label,
    subvalue: `${formatDecimalDegrees(signDegrees)}${houseText}`,
    tone,
  };
}

function createAstrologySummary(
  profile: ParsedBirthProfile,
  placements: ToolPreviewBadge[],
): string {
  const sun = placements.find(({ label }) => label === "☉ 태양");
  const moon = placements.find(({ label }) => label === "☽ 달");
  const mercury = placements.find(({ label }) => label === "☿ 수성");
  const venus = placements.find(({ label }) => label === "♀ 금성");

  return [
    `${sun?.value ?? "태양"} 태양과 ${moon?.value ?? "달"} 달 조합이라 핵심 방향성과 감정 반응의 결이 비교적 선명하게 드러나는 차트입니다.`,
    `${mercury?.value ?? "수성"} 수성은 사고와 표현 방식, ${venus?.value ?? "금성"} 금성은 관계 취향 쪽 색을 더하므로 이번 해석은 성향과 관계 패턴 중심으로 읽는 편이 정확합니다.`,
    profile.birthTimeKnown
      ? `${profile.location} 기준 좌표를 반영해 ASC·MC와 행성 하우스까지 실제 출생차트 계산으로 넣었습니다.`
      : `${profile.location} 기준 좌표를 반영했지만 출생시각이 없어 ASC·MC와 하우스는 제외하고 행성 위치만 실제 계산했습니다.`,
  ].join(" ");
}

function buildAstrologyResult(
  profile: ParsedBirthProfile,
  _question: string,
): ToolExecutionResult {
  const locationKey = normalizeBirthLocationToken(profile.location ?? "");
  const coordinates = birthLocationCoordinates[locationKey];

  if (!coordinates) {
    throw new Error("출생지는 서울, 대구, 부산처럼 지원되는 도시명으로 입력해 주세요.");
  }

  const solarProfile = toSolarBirthProfile(profile);
  const origin = new Origin({
    year: solarProfile.year,
    month: solarProfile.month - 1,
    date: solarProfile.day,
    hour: solarProfile.hour,
    minute: solarProfile.minute,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
  });
  const horoscope = new Horoscope({
    origin,
    houseSystem: "whole-sign",
    zodiac: "tropical",
    aspectPoints: [],
    aspectWithPoints: [],
    aspectTypes: [],
    customOrbs: {},
    language: "en",
  });
  const placements = [
    ...(profile.birthTimeKnown
      ? [
          createAstrologyPlacementFromChart("ASC", horoscope.Ascendant, "cyan"),
          createAstrologyPlacementFromChart("MC", horoscope.Midheaven, "emerald"),
        ]
      : []),
    createAstrologyPlacementFromChart("☉ 태양", horoscope.CelestialBodies.sun, "rose"),
    createAstrologyPlacementFromChart("☽ 달", horoscope.CelestialBodies.moon, "amber"),
    createAstrologyPlacementFromChart("☿ 수성", horoscope.CelestialBodies.mercury, "cyan"),
    createAstrologyPlacementFromChart("♀ 금성", horoscope.CelestialBodies.venus, "emerald"),
    createAstrologyPlacementFromChart("♂ 화성", horoscope.CelestialBodies.mars, "violet"),
  ];

  return {
    id: createExecutionId("astrology"),
    toolKey: "astrology",
    label: toolCatalog.astrology.label,
    status: "success",
    args: formatBirthArgs(profile, true),
    summary: createAstrologySummary(profile, placements),
    variant: "astrology",
    placements,
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

function toLunarBirthDate(profile: ParsedBirthProfile) {
  if (profile.calendarType === "음력") {
    return Lunar.fromYmdHms(
      profile.year,
      profile.month,
      profile.day,
      profile.hour,
      profile.minute,
      0,
    );
  }

  return Solar.fromYmdHms(
    profile.year,
    profile.month,
    profile.day,
    profile.hour,
    profile.minute,
    0,
  ).getLunar();
}

function getSukyoFlowSentence(xiuLuck: string): string {
  if (xiuLuck.includes("吉")) {
    return "사람과의 호흡을 너무 재기보다 자연스럽게 이어갈수록 장점이 살아납니다.";
  }

  if (xiuLuck.includes("凶")) {
    return "관계에서는 서두를수록 엇갈리기 쉬워서 속도 조절과 거리감 관리가 더 중요합니다.";
  }

  return "좋고 나쁨이 극단적으로 갈리기보다 타이밍과 말투에 따라 체감 차이가 큰 편입니다.";
}

function buildSukyoSummary(xiu: string, xiuLuck: string, gong: string, animal: string): string {
  const flowSentence = getSukyoFlowSentence(xiuLuck);

  return `${xiu}수 기준 ${gong}궁 흐름이 잡히고 상징 동물은 ${animal}이라 관계 해석은 분위기와 간격 조절을 중심으로 보는 편이 맞습니다. ${flowSentence}`;
}

function getSukyoLuckDescription(xiuLuck: string): string {
  if (xiuLuck.includes("吉")) {
    return "관계 흐름이 붙는 편";
  }

  if (xiuLuck.includes("凶")) {
    return "속도 조절이 중요한 편";
  }

  return "타이밍 영향이 큰 편";
}

function buildSukyoResult(profile: ParsedBirthProfile, _question: string): ToolExecutionResult {
  const lunarBirth = toLunarBirthDate(profile);
  const xiu = lunarBirth.getXiu();
  const xiuLuck = lunarBirth.getXiuLuck();
  const zheng = lunarBirth.getZheng();
  const animal = lunarBirth.getAnimal();
  const gong = lunarBirth.getGong();
  const xiuSong = lunarBirth.getXiuSong();

  return {
    id: createExecutionId("sukyo"),
    toolKey: "sukyo",
    label: toolCatalog.sukyo.label,
    status: "success",
    args: formatBirthArgs(profile),
    summary: buildSukyoSummary(xiu, xiuLuck, gong, animal),
    variant: "sukyo",
    badges: [
      {
        label: "본명숙",
        value: `${xiu}수`,
        subvalue: `${zheng}${animal}`,
        tone: "violet",
      },
      {
        label: "길흉",
        value: xiuLuck,
        subvalue: getSukyoLuckDescription(xiuLuck),
        tone: "rose",
      },
      {
        label: "궁",
        value: gong,
        subvalue: "관계 해석의 중심 궁",
        tone: "emerald",
      },
      {
        label: "숙요 해석",
        value: xiuSong.slice(0, 16),
        subvalue: xiuSong.length > 16 ? `${xiuSong.slice(0, 26)}...` : xiuSong,
        tone: "amber",
      },
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

  return {
    ...baseResult,
    summary,
  };
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
