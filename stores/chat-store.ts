import { create } from "zustand";

import { defaultChatProfile, defaultChatQuestion } from "@/lib/chat-session";
import {
  toolSelectionKeys,
  type PromptTemplate,
  type ToneId,
  type ToolKey,
} from "@/lib/lumo-content";

interface ChatStore {
  initialized: boolean;
  profile: string;
  selectedToneId: ToneId;
  selectedTools: ToolKey[];
  question: string;
  initialize: (prompts: PromptTemplate[], initialProfile?: string) => void;
  startNewChat: (prompts: PromptTemplate[], initialProfile?: string) => void;
  syncConversationContext: (profile: string, toneId: ToneId, tools: ToolKey[]) => void;
  setProfile: (profile: string) => void;
  setSelectedToneId: (toneId: ToneId) => void;
  setQuestion: (question: string) => void;
  applyPrompt: (prompt: PromptTemplate) => void;
  toggleTool: (toolKey: ToolKey) => void;
}

function getStoredDefaultTone(fallback: ToneId): ToneId {
  if (typeof window === "undefined") return fallback;
  return (localStorage.getItem("lumo:default-tone") as ToneId) ?? fallback;
}

function getStoredDefaultTools(fallback: ToolKey[]): ToolKey[] {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem("lumo:default-tools");
    if (stored) {
      const parsed = JSON.parse(stored) as ToolKey[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  return fallback;
}

function getDraftState(prompts: PromptTemplate[], initialProfile?: string) {
  const firstPrompt = prompts[0];
  const promptTone: ToneId = firstPrompt?.tone ?? "clear";
  const promptTools: ToolKey[] = firstPrompt?.tools ?? ["saju", "astrology"];

  return {
    initialized: true,
    profile: initialProfile ?? defaultChatProfile,
    selectedToneId: getStoredDefaultTone(promptTone),
    selectedTools: getStoredDefaultTools(promptTools),
    question: defaultChatQuestion,
  };
}

export const useChatStore = create<ChatStore>()((set, get) => ({
  initialized: false,
  profile: defaultChatProfile,
  selectedToneId: "clear",
  selectedTools: ["saju", "astrology"],
  question: defaultChatQuestion,
  initialize(prompts, initialProfile) {
    if (get().initialized) {
      return;
    }

    set(getDraftState(prompts, initialProfile));
  },
  startNewChat(prompts, initialProfile) {
    set(getDraftState(prompts, initialProfile));
  },
  syncConversationContext(profile, selectedToneId, selectedTools) {
    set({
      initialized: true,
      profile: profile ?? defaultChatProfile,
      selectedToneId,
      selectedTools:
        selectedTools.length > 0 ? selectedTools : (["saju", "astrology"] as ToolKey[]),
      question: "",
    });
  },
  setProfile(profile) {
    set({ profile });
  },
  setSelectedToneId(selectedToneId) {
    set({ selectedToneId });
  },
  setQuestion(question) {
    set({ question });
  },
  applyPrompt(prompt) {
    set({
      question: prompt.prompt,
      selectedTools: prompt.tools,
      selectedToneId: prompt.tone,
    });
  },
  toggleTool(toolKey) {
    set((state) => {
      if (state.selectedTools.includes(toolKey)) {
        if (state.selectedTools.length === 1) {
          return state;
        }

        return {
          selectedTools: state.selectedTools.filter((currentTool) => currentTool !== toolKey),
        };
      }

      return {
        selectedTools: toolSelectionKeys.filter((currentTool) =>
          [...state.selectedTools, toolKey].includes(currentTool),
        ),
      };
    });
  },
}));
