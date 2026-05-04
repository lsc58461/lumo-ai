export const toolCatalog = {
  saju: {
    label: "사주",
    blurb: "운의 흐름을 잘 봐요",
  },
  astrology: {
    label: "점성술",
    blurb: "인생 테마를 한눈에",
  },
  ziwei: {
    label: "자미두수",
    blurb: "디테일의 끝판왕",
  },
  tarot: {
    label: "타로",
    blurb: "연애나 심리에 강해요",
  },
  sukyo: {
    label: "숙요",
    blurb: "궁합이 잘 맞아요",
  },
  mahabote: {
    label: "마하보테",
    blurb: "미얀마의 숨겨진 비기",
  },
  vedic: {
    label: "베딕",
    blurb: "가장 뛰어난 적중률",
  },
  compatibility: {
    label: "궁합",
    blurb: "이전 궁합 도구 호환용",
    hidden: true,
  },
} as const;

export type ToolKey = keyof typeof toolCatalog;

export const toolSelectionKeys: ToolKey[] = [
  "saju",
  "astrology",
  "ziwei",
  "tarot",
  "sukyo",
  "mahabote",
  "vedic",
];

export interface PromptTemplate {
  id: string;
  title: string;
  summary: string;
  prompt: string;
  category: string;
  tools: ToolKey[];
  tone: ToneId;
  accent: PromptAccent;
}

export interface ToolPillarCell {
  hanja: string;
  label: string;
  element: "wood" | "fire" | "earth" | "metal" | "water";
}

export interface ToolPreviewBadge {
  label: string;
  value: string;
  subvalue?: string;
  tone?: "amber" | "cyan" | "emerald" | "rose" | "violet" | "slate";
}

export interface ToolTarotCard {
  slot: string;
  name: string;
  meaning: string;
}

export interface ToolZiweiPalace {
  name: string;
  stars: string[];
  branch: string;
  emphasis?: "ming" | "shen" | "core";
}

interface BaseToolExecutionResult {
  id: string;
  toolKey: ToolKey;
  label: string;
  status: "success";
  args: string;
  summary: string;
}

export interface SajuToolExecutionResult extends BaseToolExecutionResult {
  variant: "saju";
  pillars: {
    headers: string[];
    heavenly: ToolPillarCell[];
    earthly: ToolPillarCell[];
    note: string;
  };
}

export interface ZiweiToolExecutionResult extends BaseToolExecutionResult {
  variant: "ziwei";
  grid: {
    palaces: ToolZiweiPalace[];
    centerTitle: string;
    centerLines: string[];
  };
}

export interface AstrologyToolExecutionResult extends BaseToolExecutionResult {
  variant: "astrology";
  placements: ToolPreviewBadge[];
}

export interface TarotToolExecutionResult extends BaseToolExecutionResult {
  variant: "tarot";
  cards: ToolTarotCard[];
}

export interface SukyoToolExecutionResult extends BaseToolExecutionResult {
  variant: "sukyo";
  badges: ToolPreviewBadge[];
}

export interface MahaboteToolExecutionResult extends BaseToolExecutionResult {
  variant: "mahabote";
  badges: ToolPreviewBadge[];
}

export interface VedicToolExecutionResult extends BaseToolExecutionResult {
  variant: "vedic";
  placements: ToolPreviewBadge[];
}

export type ToolExecutionResult =
  | SajuToolExecutionResult
  | ZiweiToolExecutionResult
  | AstrologyToolExecutionResult
  | TarotToolExecutionResult
  | SukyoToolExecutionResult
  | MahaboteToolExecutionResult
  | VedicToolExecutionResult;

export type ChatRole = "user" | "assistant" | "tool";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  pending?: boolean;
  toolResults?: ToolExecutionResult[];
}

export interface ConversationPreview {
  id: string;
  title: string;
  focus: string;
  updatedAt: string;
  preview: string;
}

export interface ConversationSession extends ConversationPreview {
  profile: string;
  toneId: ToneId;
  tools: ToolKey[];
  messages: ChatMessage[];
}

export type ToneId = "clear" | "warm" | "direct";
export type PromptAccent = "gold" | "teal" | "rose";

export const toneOptions: {
  id: ToneId;
  label: string;
  summary: string;
}[] = [
  {
    id: "clear",
    label: "맑고 단정하게",
    summary: "감정 과잉 없이 핵심부터 정리합니다.",
  },
  {
    id: "warm",
    label: "다정하지만 정확하게",
    summary: "위로보다 해석을 먼저 주고, 말투는 부드럽게 갑니다.",
  },
  {
    id: "direct",
    label: "현실 감각 있게",
    summary: "오늘 당장 할 행동까지 끌어내는 톤입니다.",
  },
];

export const featuredPromptSeeds: PromptTemplate[] = [
  {
    id: "essence-map",
    title: "타고난 기질의 골격 지도",
    summary: "사주와 점성술을 함께 써서 내가 원래 어떤 속도와 결을 가진 사람인지 읽습니다.",
    prompt:
      "내 사주와 점성술을 함께 보고, 타고난 기질과 쉽게 무너지는 지점을 입체적으로 분석해줘.",
    category: "기질",
    tools: ["saju", "astrology", "ziwei"],
    tone: "clear",
    accent: "gold",
  },
  {
    id: "career-tilt",
    title: "진로와 공부의 방향 보정",
    summary: "지금 배우는 일이 맞는지, 어디에 시간을 써야 하는지 진로 축을 다시 세웁니다.",
    prompt:
      "지금 시작하려는 공부와 커리어 방향이 내 운의 흐름과 맞는지, 올해 기준으로 현실적으로 봐줘.",
    category: "진로",
    tools: ["saju", "astrology", "vedic"],
    tone: "direct",
    accent: "teal",
  },
  {
    id: "love-weather",
    title: "연애의 온도와 거리감",
    summary: "감정 패턴, 끌리는 유형, 관계에서 반복되는 실수를 정교하게 짚는 질문입니다.",
    prompt:
      "내 연애 패턴을 사주와 타로로 같이 보고, 끌리는 사람의 유형과 내가 반복하는 실수를 설명해줘.",
    category: "연애",
    tools: ["tarot", "saju", "ziwei"],
    tone: "warm",
    accent: "rose",
  },
  {
    id: "timing-window",
    title: "움직여야 하는 타이밍 찾기",
    summary:
      "이직, 고백, 이사, 시작과 종료의 창이 언제 열리는지 흐름 중심으로 보는 질문입니다.",
    prompt:
      "올해 남은 기간 중에 내가 가장 과감하게 움직여야 하는 시기와 조심해야 하는 시기를 알려줘.",
    category: "타이밍",
    tools: ["saju", "astrology", "vedic"],
    tone: "direct",
    accent: "gold",
  },
  {
    id: "money-rhythm",
    title: "돈이 들어오는 리듬 읽기",
    summary: "재물운을 막연하게 보지 않고, 돈이 새는 습관과 들어오는 흐름을 함께 읽습니다.",
    prompt:
      "내 재물운을 단순히 좋다 나쁘다가 아니라, 돈이 들어오는 방식과 새는 습관까지 같이 분석해줘.",
    category: "재물",
    tools: ["saju", "ziwei", "mahabote"],
    tone: "clear",
    accent: "teal",
  },
  {
    id: "compatibility-arc",
    title: "둘 사이의 리듬과 마찰점",
    summary: "궁합을 감정 소비가 아니라 리듬과 생활 패턴의 충돌로 읽는 무료 버전 질문입니다.",
    prompt:
      "우리 둘의 궁합을 감정 궁합, 생활 리듬, 장기적으로 부딪히는 패턴으로 나눠서 분석해줘.",
    category: "궁합",
    tools: ["sukyo", "tarot", "vedic"],
    tone: "warm",
    accent: "rose",
  },
];

export function toConversationPreview(
  conversationSession: ConversationSession,
): ConversationPreview {
  return {
    id: conversationSession.id,
    title: conversationSession.title,
    focus: conversationSession.focus,
    updatedAt: conversationSession.updatedAt,
    preview: conversationSession.preview,
  };
}

export const conversationSessionSeeds: ConversationSession[] = [
  {
    id: "thread-1",
    title: "1997.11.04 부산 출생 · 사주 · 점성술",
    focus: "공부를 다시 시작해도 되는가",
    updatedAt: "오늘",
    preview: "상반기보다 하반기에 선택이 선명해지는 흐름이라는 진단이 남아 있습니다.",
    profile: "1997년 11월 4일 오후 8시 18분 부산 출생, 여자",
    toneId: "clear",
    tools: ["saju", "astrology"],
    messages: [
      {
        id: "thread-1-user-1",
        role: "user",
        content: "공부를 다시 시작해도 되는지, 지금 방향을 바꿔도 되는지 보고 싶어.",
        createdAt: "2026-05-05T09:30:00.000Z",
      },
      {
        id: "thread-1-assistant-1",
        role: "assistant",
        content:
          "루모 AI 기준으로 보면 상반기보다 하반기에 선택이 선명해지는 흐름이 강합니다. 조급하게 결론을 내리기보다, 2개월 안에 다시 쓸 공부 리듬을 먼저 만들면 방향 전환이 훨씬 안정적으로 붙습니다.",
        createdAt: "2026-05-05T09:31:00.000Z",
      },
    ],
  },
  {
    id: "thread-2",
    title: "2000.03.18 서울 출생 · 사주 · 타로",
    focus: "끌리는 사람보다 편한 사람이 맞는가",
    updatedAt: "어제",
    preview: "감정의 속도보다 관계를 붙잡는 생활 리듬이 더 중요하다는 메모가 정리돼 있습니다.",
    profile: "2000년 3월 18일 오전 11시 서울 출생, 여자",
    toneId: "warm",
    tools: ["saju", "tarot"],
    messages: [
      {
        id: "thread-2-user-1",
        role: "user",
        content: "연애할 때 늘 끌리는 사람만 보면 불안해져. 편한 사람이 맞는지 궁금해.",
        createdAt: "2026-05-04T14:00:00.000Z",
      },
      {
        id: "thread-2-assistant-1",
        role: "assistant",
        content:
          "루모 AI가 보기에는 감정의 속도보다 생활 리듬을 맞출 수 있는 사람이 더 오래 갑니다. 강한 끌림은 시작을 열지만, 실제 관계를 지키는 힘은 편안함과 일상 호흡 쪽에 더 실려 있습니다.",
        createdAt: "2026-05-04T14:01:00.000Z",
      },
    ],
  },
  {
    id: "thread-3",
    title: "1993.08.27 대전 출생 · 사주 · 점성술",
    focus: "새는 돈과 버는 돈의 구조",
    updatedAt: "2일 전",
    preview: "올해는 확장보다 현금흐름을 정리하는 쪽이 강하다는 요약이 보관돼 있습니다.",
    profile: "1993년 8월 27일 오전 7시 대전 출생, 남자",
    toneId: "direct",
    tools: ["saju", "astrology"],
    messages: [
      {
        id: "thread-3-user-1",
        role: "user",
        content: "재물운이 궁금한데, 돈이 왜 자꾸 새는지도 같이 보고 싶어.",
        createdAt: "2026-05-03T10:40:00.000Z",
      },
      {
        id: "thread-3-assistant-1",
        role: "assistant",
        content:
          "지금은 확장보다 현금흐름을 다듬는 시기입니다. 큰 수입을 노리기보다 반복 지출과 충동 결제를 먼저 줄이는 쪽이 바로 체감됩니다. 루모 AI 기준으로는 자산을 늘리는 것보다 누수를 막는 행동이 먼저입니다.",
        createdAt: "2026-05-03T10:41:00.000Z",
      },
    ],
  },
  {
    id: "thread-4",
    title: "궁합 샘플 · 궁합 · 타로",
    focus: "감정 표현과 생활 패턴의 충돌",
    updatedAt: "3일 전",
    preview: "상대의 속도보다 내 반응 습관을 먼저 읽어야 한다는 해설 구조가 남아 있습니다.",
    profile: "두 사람의 출생 정보를 함께 비교한 궁합 샘플",
    toneId: "warm",
    tools: ["compatibility", "tarot"],
    messages: [
      {
        id: "thread-4-user-1",
        role: "user",
        content: "서로 좋아하는데 자꾸 생활 패턴 때문에 부딪혀. 이 관계가 맞는지 보고 싶어.",
        createdAt: "2026-05-02T20:10:00.000Z",
      },
      {
        id: "thread-4-assistant-1",
        role: "assistant",
        content:
          "이 관계는 감정 자체보다 생활 리듬 충돌이 핵심입니다. 좋아하는 마음은 남아 있지만, 서로의 속도를 이해하지 못하면 작은 문제도 크게 번집니다. 루모 AI는 감정 확인보다 먼저 일상 패턴 조율을 권합니다.",
        createdAt: "2026-05-02T20:11:00.000Z",
      },
    ],
  },
];

export const conversationPreviewSeeds: ConversationPreview[] =
  conversationSessionSeeds.map(toConversationPreview);
