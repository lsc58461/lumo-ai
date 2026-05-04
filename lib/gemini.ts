import { GoogleGenAI } from "@google/genai";

import {
  toneOptions,
  toolCatalog,
  type ChatMessage,
  type ToneId,
  type ToolExecutionResult,
  type ToolKey,
} from "@/lib/lumo-content";

export const LUMO_PRIMARY_MODEL = "gemini-flash-lite-latest";
export const LUMO_FALLBACK_MODEL = "gemini-2.0-flash";

export const GEMINI_MODEL = LUMO_PRIMARY_MODEL;
export const GEMINI_FALLBACK_MODEL = LUMO_FALLBACK_MODEL;

export interface ChatRequestPayload {
  conversationId?: string;
  profile: string;
  question: string;
  toneId: ToneId;
  tools: ToolKey[];
  messages: Pick<ChatMessage, "id" | "role" | "content" | "createdAt" | "toolResults">[];
}

export type ReadingRequestPayload = ChatRequestPayload;

export function isLumoAiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export const isGeminiConfigured = isLumoAiConfigured;

export function getLumoAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("루모 AI 연결을 위해 GEMINI_API_KEY를 .env.local에 추가해 주세요.");
  }

  return new GoogleGenAI({ apiKey });
}

export const getGeminiClient = getLumoAiClient;

export function buildToolAnalysisPrompt(payload: {
  profile: string;
  question: string;
  toolKey: ToolKey;
  seedResult: ToolExecutionResult;
  previousToolAnalyses: {
    toolKey: ToolKey;
    content: string;
  }[];
  messages: ChatRequestPayload["messages"];
}): string {
  const tool = toolCatalog[payload.toolKey];
  const historyBlock = payload.messages.length
    ? payload.messages
        .slice(-6)
        .map((message) => {
          if (message.role === "assistant") {
            return `루모 AI: ${message.content}`;
          }

          if (message.role === "tool") {
            return `이전 도구 분석: ${message.content}`;
          }

          return `사용자: ${message.content}`;
        })
        .join("\n\n")
    : "이전 대화 없음";
  const previousAnalysesBlock = payload.previousToolAnalyses.length
    ? payload.previousToolAnalyses
        .map(({ toolKey, content }) => `[${toolCatalog[toolKey].label}]\n${content}`)
        .join("\n\n")
    : "이전 단계 분석 없음";
  const seedSummary = payload.seedResult.summary;
  const seedObject: Record<string, unknown> = (() => {
    switch (payload.seedResult.variant) {
      case "saju":
        return {
          summary: seedSummary,
          pillars: payload.seedResult.pillars,
        };
      case "ziwei":
        return {
          summary: seedSummary,
          grid: payload.seedResult.grid,
        };
      case "astrology":
      case "vedic":
        return {
          summary: seedSummary,
          placements: payload.seedResult.placements,
        };
      case "tarot":
        return {
          summary: seedSummary,
          cards: payload.seedResult.cards,
        };
      case "sukyo":
      case "mahabote":
        return {
          summary: seedSummary,
          badges: payload.seedResult.badges,
        };
      default:
        return {
          summary: seedSummary,
        };
    }
  })();

  return [
    `너는 루모 AI의 ${tool.label} 전문 분석 단계다.`,
    "이번 응답은 최종 상담이 아니라 현재 도구 단계의 구조화된 분석 데이터여야 한다.",
    "반드시 한국어로 작성하고 JSON 객체 하나만 반환한다. 마크다운, 코드블록, 설명 문장은 금지한다.",
    "summary는 1~3문장으로 쓰고, 나머지 키 구조는 아래 seed JSON과 동일하게 유지한다.",
    "seed JSON의 키 이름은 바꾸지 말고, 값만 이번 질문과 출생정보에 맞게 구체적으로 다시 작성한다.",
    "과장, 확정적 예언, 장황한 서론은 금지한다.",
    `출생 정보: ${payload.profile}`,
    `사용자 질문: ${payload.question}`,
    `현재 도구: ${tool.label} (${tool.blurb})`,
    "이전 대화:",
    historyBlock,
    "이전 단계 분석:",
    previousAnalysesBlock,
    "반환해야 할 JSON seed:",
    JSON.stringify(seedObject, null, 2),
    `지금은 ${tool.label} 기준으로만 한 단계 더 깊게 분석해라.`,
  ].join("\n");
}

export function buildToolMessageLabel(toolKey: ToolKey): string {
  return `${toolCatalog[toolKey].label} 분석`;
}

export function buildLumoChatPrompt(payload: ChatRequestPayload): string {
  const tone = toneOptions.find(({ id }) => id === payload.toneId) ?? toneOptions[0];
  const toolLabels = payload.tools.map((toolKey) => toolCatalog[toolKey].label).join(", ");
  const historyBlock = payload.messages.length
    ? payload.messages
        .slice(-8)
        .map((message) => {
          let speaker = "사용자";

          if (message.role === "assistant") {
            speaker = "루모 AI";
          } else if (message.role === "tool") {
            speaker = "도구 분석";
          }

          return `${speaker}: ${message.content}`;
        })
        .join("\n\n")
    : "이전 대화 없음";

  return [
    "너는 루모 AI의 한국어 사주 채팅 어시스턴트다.",
    "과장하거나 단정하지 말고, 사용자가 스스로 판단할 수 있게 흐름과 근거를 설명한다.",
    "모델명이나 내부 시스템을 드러내지 말고, 서비스 이름이 필요할 때만 루모 AI라고 말한다.",
    "답변은 멀티턴 대화처럼 자연스럽게 이어가되, 핵심 흐름과 지금 해볼 행동이 분명해야 한다.",
    "도구 분석 메시지가 있으면 그것들을 종합해 최종 결론을 내리고, 같은 내용을 반복하지 말고 한 단계 더 통합적으로 설명한다.",
    `사용 도구: ${toolLabels}`,
    `답변 톤: ${tone.label} (${tone.summary})`,
    `출생 정보: ${payload.profile}`,
    "이전 대화:",
    historyBlock,
    `이번 사용자 메시지: ${payload.question}`,
  ].join("\n");
}

export const buildReadingPrompt = buildLumoChatPrompt;
