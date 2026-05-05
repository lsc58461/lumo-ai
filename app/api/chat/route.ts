import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  createChatMessage,
  deriveConversationFocus,
  deriveConversationPreview,
  deriveConversationTitle,
  formatConversationUpdatedAt,
} from "@/lib/chat-session";
import { CONVERSATIONS_COLLECTION } from "@/lib/conversation-collection";
import {
  buildToolAnalysisPrompt,
  buildToolMessageLabel,
  buildLumoChatPrompt,
  getLumoAiClient,
  isLumoAiConfigured,
  LUMO_FALLBACK_MODEL,
  LUMO_PRIMARY_MODEL,
  type ChatRequestPayload,
} from "@/lib/gemini";
import {
  type ChatMessage,
  type ConversationSession,
  type ToolExecutionResult,
} from "@/lib/lumo-content";
import { getMongoDatabase, isMongoConfigured } from "@/lib/mongodb";
import { parseChatProfile, parseProfileSelection } from "@/lib/profile";
import {
  createToolAnalysisResults,
  mergeStructuredToolAnalysisResult,
} from "@/lib/tool-analysis";

export const runtime = "nodejs";

interface ChatMessageDocument {
  id: string;
  role: ChatMessage["role"];
  content: string;
  createdAt: string;
  toolResults?: ToolExecutionResult[];
  followUpSuggestions?: string[];
}

interface ConversationSessionDocument {
  _id?: ObjectId;
  userId?: string;
  title: string;
  focus: string;
  preview: string;
  updatedAt: string;
  createdAt: string;
  profile: string;
  toneId: ChatRequestPayload["toneId"];
  tools: ChatRequestPayload["tools"];
  messages: ChatMessageDocument[];
  featured?: boolean;
}

interface UserProfileDocument {
  userId: string;
  activeProfile: string;
  activeProfiles?: string[];
  profiles: string[];
  name?: string | null;
  image?: string | null;
  updatedAt: string;
}

class LumoRouteError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

interface ToolAnalysisMessage {
  toolKey: ChatRequestPayload["tools"][number];
  message: ChatMessage;
}

interface ToolAnalysisRunResult {
  promptMessages: ToolAnalysisMessage[];
  streamedMessages: ToolAnalysisMessage[];
  skippedAll: boolean;
}

function buildToolResultCacheKey(result: ToolExecutionResult): string {
  return `${result.toolKey}::${result.args}`;
}

function findLatestResolvedToolBlock(
  messages: ChatRequestPayload["messages"],
): ChatRequestPayload["messages"] {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (!message || message.role !== "assistant") {
      // Skip non-assistant messages until the last completed assistant turn is found.
    } else {
      const toolBlock: ChatRequestPayload["messages"] = [];
      let cursor = index - 1;

      while (cursor >= 0 && messages[cursor]?.role === "tool") {
        const toolMessage = messages[cursor];

        if (toolMessage?.toolResults?.length) {
          toolBlock.unshift(toolMessage);
        }

        cursor -= 1;
      }

      if (toolBlock.length > 0) {
        return toolBlock;
      }
    }
  }

  return [];
}

function sanitizeGeneratedTitle(rawTitle: string, fallbackTitle: string): string {
  const normalizedTitle = rawTitle
    .replace(/["'“”‘’]/g, "")
    .split(/\r?\n/)[0]
    ?.replace(/\s+/g, " ")
    .trim();

  if (!normalizedTitle) {
    return fallbackTitle;
  }

  if (normalizedTitle.length <= 18) {
    return normalizedTitle;
  }

  return `${normalizedTitle.slice(0, 17)}…`;
}

async function generateTitleWithModel(
  prompt: string,
  model: string | undefined,
): Promise<string> {
  if (!model) {
    return "";
  }

  const lumoAi = getLumoAiClient();
  const response = await lumoAi.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: 0,
      topP: 1,
    },
  });

  return response.text?.trim() ?? "";
}

async function generateConversationTitle(
  question: string,
  assistantText: string,
  tools: ChatRequestPayload["tools"],
): Promise<string> {
  const fallbackTitle = deriveConversationTitle(question, tools);

  try {
    const titlePrompt = [
      "다음 대화를 위한 채팅방 제목을 한국어로 아주 짧게 만들어라.",
      "조건:",
      "- 한 줄만 출력",
      "- 18자 이내",
      "- 따옴표, 설명, 마침표 금지",
      "- 핵심 주제만 자연스럽게 요약",
      `질문: ${question}`,
      `답변 요약 참고: ${assistantText.slice(0, 400)}`,
    ].join("\n");

    const generatedTitle = await generateTitleWithModel(titlePrompt, LUMO_PRIMARY_MODEL).catch(
      async () => generateTitleWithModel(titlePrompt, LUMO_FALLBACK_MODEL),
    );

    if (!generatedTitle) {
      return fallbackTitle;
    }

    return sanitizeGeneratedTitle(generatedTitle, fallbackTitle);
  } catch {
    return fallbackTitle;
  }
}

function isChatMessageArray(value: unknown): value is ChatRequestPayload["messages"] {
  return (
    Array.isArray(value) &&
    value.every(
      (message) =>
        message &&
        typeof message === "object" &&
        "role" in message &&
        (message.role === "user" || message.role === "assistant" || message.role === "tool") &&
        "content" in message &&
        typeof message.content === "string" &&
        (!("toolResults" in message) || Array.isArray(message.toolResults)),
    )
  );
}

function isChatRequestPayload(value: unknown): value is ChatRequestPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<ChatRequestPayload>;

  return (
    (typeof payload.conversationId === "undefined" ||
      typeof payload.conversationId === "string") &&
    typeof payload.profile === "string" &&
    typeof payload.question === "string" &&
    typeof payload.toneId === "string" &&
    Array.isArray(payload.tools) &&
    isChatMessageArray(payload.messages)
  );
}

function normalizeLumoError(error: unknown): {
  message: string;
  retryable: boolean;
  status: number;
} {
  let message = "루모 AI 답변 생성 중 알 수 없는 오류가 발생했습니다.";
  let retryable = false;
  let status = 500;

  if (error instanceof Error && error.message) {
    message = error.message;
  }

  if (message.startsWith("{")) {
    try {
      const parsed = JSON.parse(message) as {
        error?: {
          code?: number;
          message?: string;
          status?: string;
        };
      };

      if (parsed.error?.message) {
        message = parsed.error.message;
      }

      if (typeof parsed.error?.code === "number") {
        status = parsed.error.code;
      }

      if (
        parsed.error?.status === "UNAVAILABLE" ||
        parsed.error?.status === "RESOURCE_EXHAUSTED"
      ) {
        retryable = true;
        status = parsed.error.status === "RESOURCE_EXHAUSTED" ? 429 : 503;
        message = "루모 AI 응답이 몰리는 중입니다. 잠시 후 다시 시도해 주세요.";
      }
    } catch {
      message = "루모 AI 응답을 해석하는 중 오류가 발생했습니다.";
    }
  }

  return {
    message,
    retryable,
    status,
  };
}

function mapConversationSession(
  document: ConversationSessionDocument,
  fallbackId?: string,
): ConversationSession {
  return {
    id: document._id?.toString() ?? fallbackId ?? `chat-${Date.now()}`,
    title: document.title,
    focus: document.focus,
    preview: document.preview,
    updatedAt: formatConversationUpdatedAt(document.updatedAt),
    profile: document.profile,
    toneId: document.toneId,
    tools: document.tools,
    messages: document.messages,
  };
}

function toMessageDocument(message: ChatMessage): ChatMessageDocument {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    toolResults: message.toolResults,
    followUpSuggestions: message.followUpSuggestions,
  };
}

async function persistConversation(
  body: ChatRequestPayload,
  sanitizedMessages: ChatMessageDocument[],
  assistantText: string,
  userId: string,
  userName?: string | null,
  userImage?: string | null,
): Promise<{
  conversation: ConversationSession;
  saved: boolean;
}> {
  const assistantMessage = createChatMessage("assistant", assistantText);
  const generatedTitle = await generateConversationTitle(
    body.question,
    assistantText,
    body.tools,
  );
  const fallbackConversationDocument: ConversationSessionDocument = {
    title: generatedTitle,
    focus: deriveConversationFocus(body.question),
    preview: deriveConversationPreview(assistantText),
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    profile: body.profile,
    toneId: body.toneId,
    tools: body.tools,
    messages: [...sanitizedMessages, toMessageDocument(assistantMessage)],
  };

  if (!isMongoConfigured()) {
    return {
      conversation: mapConversationSession(
        fallbackConversationDocument,
        body.conversationId ?? `chat-${Date.now()}`,
      ),
      saved: false,
    };
  }

  try {
    const database = await getMongoDatabase();
    const selectedProfiles = parseProfileSelection(body.profile);
    const primaryProfile = selectedProfiles[0] ?? body.profile;

    await database.collection<UserProfileDocument>("userProfiles").updateOne(
      { userId },
      {
        $set: {
          userId,
          activeProfile: primaryProfile,
          activeProfiles: selectedProfiles.length > 0 ? selectedProfiles : [primaryProfile],
          name: userName,
          image: userImage,
          updatedAt: new Date().toISOString(),
        },
        $addToSet: {
          profiles: {
            $each: selectedProfiles.length > 0 ? selectedProfiles : [primaryProfile],
          },
        },
      },
      { upsert: true },
    );
    const conversations =
      database.collection<ConversationSessionDocument>(CONVERSATIONS_COLLECTION);
    let existingConversation: ConversationSessionDocument | null = null;

    if (body.conversationId && ObjectId.isValid(body.conversationId)) {
      const conversationObjectId = new ObjectId(body.conversationId);
      existingConversation = await conversations.findOne({
        _id: conversationObjectId,
        userId,
      });
    }

    const nextConversationDocument: ConversationSessionDocument = {
      ...fallbackConversationDocument,
      title:
        existingConversation?.title && existingConversation.title !== "새 채팅"
          ? existingConversation.title
          : fallbackConversationDocument.title,
      createdAt: existingConversation?.createdAt ?? fallbackConversationDocument.createdAt,
      userId,
    };

    if (existingConversation?._id) {
      await conversations.updateOne(
        {
          _id: existingConversation._id,
          userId,
        },
        {
          $set: nextConversationDocument,
        },
        { upsert: true },
      );

      return {
        conversation: mapConversationSession({
          ...nextConversationDocument,
          _id: existingConversation._id,
        }),
        saved: true,
      };
    }

    const insertResult = await conversations.insertOne({
      ...nextConversationDocument,
      featured: false,
    });

    return {
      conversation: mapConversationSession({
        ...nextConversationDocument,
        _id: insertResult.insertedId,
      }),
      saved: true,
    };
  } catch {
    return {
      conversation: mapConversationSession(
        fallbackConversationDocument,
        body.conversationId ?? `local-${Date.now()}`,
      ),
      saved: false,
    };
  }
}

async function generateLumoReplyStream(prompt: string, modelIndex: number) {
  const models = [LUMO_PRIMARY_MODEL, LUMO_FALLBACK_MODEL];
  const currentModel = models[modelIndex];

  if (!currentModel) {
    throw new LumoRouteError(
      "루모 AI 응답이 몰리는 중입니다. 잠시 후 다시 시도해 주세요.",
      503,
    );
  }

  try {
    const lumoAi = getLumoAiClient();
    return await lumoAi.models.generateContentStream({
      model: currentModel,
      contents: prompt,
      config: {
        temperature: 0.85,
        topP: 0.95,
      },
    });
  } catch (error) {
    if (error instanceof LumoRouteError) {
      throw error;
    }

    const normalizedError = normalizeLumoError(error);

    if (normalizedError.retryable && modelIndex < models.length - 1) {
      return generateLumoReplyStream(prompt, modelIndex + 1);
    }

    throw new LumoRouteError(normalizedError.message, normalizedError.status);
  }
}

async function generateLumoReply(prompt: string, modelIndex: number): Promise<string> {
  const models = [LUMO_PRIMARY_MODEL, LUMO_FALLBACK_MODEL];
  const currentModel = models[modelIndex];

  if (!currentModel) {
    throw new LumoRouteError(
      "루모 AI 응답이 몰리는 중입니다. 잠시 후 다시 시도해 주세요.",
      503,
    );
  }

  try {
    const lumoAi = getLumoAiClient();
    const response = await lumoAi.models.generateContent({
      model: currentModel,
      contents: prompt,
      config: {
        temperature: 0,
        topP: 1,
      },
    });

    return response.text ?? "";
  } catch (error) {
    const normalizedError = normalizeLumoError(error);

    if (normalizedError.retryable && modelIndex < models.length - 1) {
      return generateLumoReply(prompt, modelIndex + 1);
    }

    throw new LumoRouteError(normalizedError.message, normalizedError.status);
  }
}

async function generateLumoJsonReply(prompt: string, modelIndex: number): Promise<unknown> {
  const models = [LUMO_PRIMARY_MODEL, LUMO_FALLBACK_MODEL];
  const currentModel = models[modelIndex];

  if (!currentModel) {
    throw new LumoRouteError(
      "루모 AI 응답이 몰리는 중입니다. 잠시 후 다시 시도해 주세요.",
      503,
    );
  }

  try {
    const lumoAi = getLumoAiClient();
    const response = await lumoAi.models.generateContent({
      model: currentModel,
      contents: prompt,
      config: {
        temperature: 0.15,
        topP: 0.9,
        responseMimeType: "application/json",
      },
    });
    const rawText = response.text?.trim();

    if (!rawText) {
      throw new LumoRouteError("도구 분석 응답이 비어 있습니다. 다시 시도해 주세요.", 502);
    }

    return JSON.parse(rawText) as unknown;
  } catch (error) {
    if (error instanceof LumoRouteError) {
      throw error;
    }

    const normalizedError = normalizeLumoError(error);

    if (normalizedError.retryable && modelIndex < models.length - 1) {
      return generateLumoJsonReply(prompt, modelIndex + 1);
    }

    throw new LumoRouteError(normalizedError.message, normalizedError.status);
  }
}

async function generateSequentialToolMessages(
  body: ChatRequestPayload,
  onToolMessage: (message: ChatMessage) => void,
): Promise<ToolAnalysisRunResult> {
  const promptMessages: ToolAnalysisMessage[] = [];
  const streamedMessages: ToolAnalysisMessage[] = [];
  const selectedProfiles = parseProfileSelection(body.profile);
  const normalizedProfiles = selectedProfiles.length > 0 ? selectedProfiles : [body.profile];
  const previousToolBlock = findLatestResolvedToolBlock(body.messages);
  const previousToolMessageByCacheKey = new Map(
    previousToolBlock.flatMap((message) =>
      (message.toolResults ?? []).map((result) => [
        buildToolResultCacheKey(result),
        {
          toolKey: result.toolKey,
          message: {
            id: message.id,
            role: "tool" as const,
            content: message.content,
            createdAt: message.createdAt,
            toolResults: message.toolResults,
          },
        } satisfies ToolAnalysisMessage,
      ]),
    ),
  );

  async function processNext(
    profileIndex: number,
    toolIndex: number,
    currentProfileMessages: ToolAnalysisMessage[],
  ): Promise<void> {
    const selectedProfile = normalizedProfiles[profileIndex];

    if (!selectedProfile) {
      return;
    }

    const toolKey = body.tools[toolIndex];

    if (!toolKey) {
      await processNext(profileIndex + 1, 0, []);
      return;
    }

    const baseToolResults = createToolAnalysisResults({
      profile: selectedProfile,
      question: body.question,
      tools: body.tools,
    });
    const baseToolResult = baseToolResults.find((result) => result.toolKey === toolKey);

    if (!baseToolResult) {
      throw new LumoRouteError("도구 분석 UI 결과를 생성하지 못했습니다.", 500);
    }

    const cachedToolMessage = previousToolMessageByCacheKey.get(
      buildToolResultCacheKey(baseToolResult),
    );

    if (cachedToolMessage) {
      currentProfileMessages.push(cachedToolMessage);
      promptMessages.push(cachedToolMessage);
      await processNext(profileIndex, toolIndex + 1, currentProfileMessages);
      return;
    }

    const profileFields = parseChatProfile(selectedProfile);
    const profileLabel = profileFields.name.trim() || `프로필 ${profileIndex + 1}`;
    const prompt = buildToolAnalysisPrompt({
      profile: selectedProfile,
      question: body.question,
      toolKey,
      seedResult: baseToolResult,
      previousToolAnalyses: currentProfileMessages.map(
        ({ toolKey: previousToolKey, message }) => ({
          toolKey: previousToolKey,
          content: message.content,
        }),
      ),
      messages: body.messages,
    });
    const structuredPayload = await generateLumoJsonReply(prompt, 0).catch(async () => ({
      summary: (await generateLumoReply(prompt, 0)).trim(),
    }));
    const mergedToolResult = mergeStructuredToolAnalysisResult(
      baseToolResult,
      structuredPayload,
    );
    const nextToolResult = {
      ...mergedToolResult,
      label: `${profileLabel} · ${mergedToolResult.label}`,
    };
    const nextToolMessage = createChatMessage(
      "tool",
      `[${buildToolMessageLabel(toolKey)} · ${profileLabel}]\n${nextToolResult.summary}`,
      {
        toolResults: [nextToolResult],
      },
    );

    currentProfileMessages.push({
      toolKey,
      message: nextToolMessage,
    });
    promptMessages.push({
      toolKey,
      message: nextToolMessage,
    });
    streamedMessages.push({
      toolKey,
      message: nextToolMessage,
    });

    onToolMessage(nextToolMessage);

    await processNext(profileIndex, toolIndex + 1, currentProfileMessages);
  }

  await processNext(0, 0, []);

  return {
    promptMessages,
    streamedMessages,
    skippedAll: promptMessages.length > 0 && streamedMessages.length === 0,
  };
}

export async function POST(request: Request) {
  const body = (await request.json()) as unknown;

  if (!isChatRequestPayload(body)) {
    return NextResponse.json({ error: "잘못된 채팅 요청 형식입니다." }, { status: 400 });
  }

  if (!body.profile.trim() || !body.question.trim()) {
    return NextResponse.json(
      { error: "출생 정보와 질문을 모두 입력해 주세요." },
      { status: 400 },
    );
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const userName = session?.user?.name ?? null;
  const userImage = session?.user?.image ?? null;

  if (!userId) {
    return NextResponse.json(
      { error: "로그인 후에만 채팅을 보낼 수 있습니다." },
      { status: 401 },
    );
  }

  if (!isLumoAiConfigured()) {
    return NextResponse.json(
      { error: "루모 AI 연결 키가 없어 아직 채팅을 생성할 수 없습니다." },
      { status: 503 },
    );
  }

  try {
    const sanitizedMessages = body.messages
      .filter(({ content }) => content.trim().length > 0)
      .map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
        toolResults: message.toolResults,
      }));

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const enqueueEvent = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        };

        try {
          const toolRunResult = await generateSequentialToolMessages(
            {
              ...body,
              messages: sanitizedMessages,
            },
            (message) => {
              enqueueEvent({ type: "tool", message });
            },
          );

          if (toolRunResult.skippedAll) {
            enqueueEvent({
              type: "tool",
              message: createChatMessage(
                "tool",
                "분석 스킵됨\n선택한 도구 변경이 없어 기존 분석을 그대로 사용합니다.",
              ),
            });
          }

          const prompt = buildLumoChatPrompt({
            ...body,
            messages: [
              ...toolRunResult.promptMessages.map(({ message }) => toMessageDocument(message)),
              ...sanitizedMessages,
            ],
          });
          const responseStream = await generateLumoReplyStream(prompt, 0);
          let assistantText = "";
          const iterator = responseStream[Symbol.asyncIterator]();

          const readNextChunk = async (): Promise<void> => {
            const { value, done } = await iterator.next();

            if (done) {
              return;
            }

            const delta = value?.text ?? "";

            if (delta) {
              assistantText += delta;
              enqueueEvent({ type: "chunk", delta });
            }

            await readNextChunk();
          };

          await readNextChunk();

          if (!assistantText.trim()) {
            throw new LumoRouteError("루모 AI 응답이 비어 있습니다. 다시 시도해 주세요.", 502);
          }

          const persistedConversation = await persistConversation(
            body,
            [
              ...sanitizedMessages,
              ...toolRunResult.streamedMessages.map(({ message }) =>
                toMessageDocument(message),
              ),
            ],
            assistantText,
            userId,
            userName,
            userImage,
          );

          enqueueEvent({
            type: "done",
            conversation: persistedConversation.conversation,
            saved: persistedConversation.saved,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "루모 AI 채팅 생성에 실패했습니다.";
          enqueueEvent({ type: "error", error: message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof LumoRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "루모 AI 채팅 생성 중 알 수 없는 오류가 발생했습니다.",
      },
      { status: 500 },
    );
  }
}
