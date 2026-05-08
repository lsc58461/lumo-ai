import { ObjectId, type Db } from "mongodb";

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
  LUMO_FALLBACK_MODEL,
  LUMO_PRIMARY_MODEL,
  type ChatRequestPayload,
} from "@/lib/gemini";
import {
  type ChatMessage,
  type ConversationSession,
  type ToolExecutionResult,
} from "@/lib/lumo-content";
import { getMongoDatabase } from "@/lib/mongodb";
import { parseChatProfile, parseProfileSelection } from "@/lib/profile";
import {
  createToolAnalysisResults,
  mergeStructuredToolAnalysisResult,
} from "@/lib/tool-analysis";

export const CHAT_STREAM_JOBS_COLLECTION = "chatStreamJobs";

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
  activeProfileId?: string;
  activeProfileIds?: string[];
  name?: string | null;
  image?: string | null;
  updatedAt: string;
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

type ChatStreamJobStatus = "pending" | "processing" | "completed" | "failed";

type ChatStreamEventName = "tool" | "chunk" | "done" | "failure";

interface ChatStreamEventDocument {
  id: number;
  event: ChatStreamEventName;
  payload: unknown;
  createdAt: Date;
}

export interface ChatStreamJobDocument {
  _id?: ObjectId;
  userId: string;
  conversationId: ObjectId;
  request: ChatRequestPayload;
  status: ChatStreamJobStatus;
  events: ChatStreamEventDocument[];
  nextEventId: number;
  error?: string;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
}

export class LumoRouteError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
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

export function isChatMessageArray(value: unknown): value is ChatRequestPayload["messages"] {
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
        (!("toolResults" in message) ||
          message.toolResults === null ||
          Array.isArray(message.toolResults)),
    )
  );
}

export function isChatRequestPayload(value: unknown): value is ChatRequestPayload {
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

function sanitizeChatMessages(
  messages: ChatRequestPayload["messages"],
): ChatRequestPayload["messages"] {
  return messages
    .filter(({ content }) => content.trim().length > 0)
    .map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
      toolResults: Array.isArray(message.toolResults) ? message.toolResults : undefined,
    }));
}

async function upsertUserProfileDocument(
  database: Db,
  userId: string,
  userName?: string | null,
  userImage?: string | null,
): Promise<void> {
  await database.collection<UserProfileDocument>("userProfiles").updateOne(
    { userId },
    {
      $set: {
        userId,
        name: userName,
        image: userImage,
        updatedAt: new Date().toISOString(),
      },
      $setOnInsert: {
        activeProfileId: "",
        activeProfileIds: [],
      },
    },
    { upsert: true },
  );
}

async function ensureConversationForStream(
  body: ChatRequestPayload,
  sanitizedMessages: ChatMessageDocument[],
  userId: string,
  userName?: string | null,
  userImage?: string | null,
): Promise<ObjectId> {
  const database = await getMongoDatabase();
  await upsertUserProfileDocument(database, userId, userName, userImage);

  const conversations =
    database.collection<ConversationSessionDocument>(CONVERSATIONS_COLLECTION);

  if (body.conversationId && ObjectId.isValid(body.conversationId)) {
    const existingConversation = await conversations.findOne({
      _id: new ObjectId(body.conversationId),
      userId,
    });

    if (existingConversation?._id) {
      return existingConversation._id;
    }
  }

  const reservedConversationId = new ObjectId();
  const createdAt = new Date().toISOString();

  await conversations.insertOne({
    _id: reservedConversationId,
    userId,
    title: "제목 요약 중…",
    focus: deriveConversationFocus(body.question),
    preview: deriveConversationPreview(body.question),
    updatedAt: createdAt,
    createdAt,
    profile: body.profile,
    toneId: body.toneId,
    tools: body.tools,
    messages: sanitizedMessages,
    featured: false,
  });

  return reservedConversationId;
}

async function persistConversation(
  body: ChatRequestPayload,
  sanitizedMessages: ChatMessageDocument[],
  assistantText: string,
  userId: string,
  conversationId: ObjectId,
): Promise<{
  conversation: ConversationSession;
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
  const database = await getMongoDatabase();
  const conversations =
    database.collection<ConversationSessionDocument>(CONVERSATIONS_COLLECTION);
  const existingConversation = await conversations.findOne({
    _id: conversationId,
    userId,
  });
  const shouldPreserveExistingTitle = Boolean(
    existingConversation?.title &&
    existingConversation.title !== "새 채팅" &&
    existingConversation.title !== "제목 요약 중…",
  );

  const nextConversationDocument: ConversationSessionDocument = {
    ...fallbackConversationDocument,
    title: shouldPreserveExistingTitle
      ? (existingConversation?.title ?? fallbackConversationDocument.title)
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
    };
  }

  const insertResult = await conversations.insertOne({
    _id: conversationId,
    ...nextConversationDocument,
    featured: false,
  });

  return {
    conversation: mapConversationSession({
      ...nextConversationDocument,
      _id: insertResult.insertedId,
    }),
  };
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

function createSseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function waitForNextPoll(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function encodeSseEvent(
  encoder: TextEncoder,
  eventId: number,
  event: ChatStreamEventName,
  payload: unknown,
): Uint8Array {
  return encoder.encode(
    `id: ${eventId}\nevent: ${event}\ndata: ${JSON.stringify(payload)}\n\n`,
  );
}

async function appendStreamEvent(
  jobs: import("mongodb").Collection<ChatStreamJobDocument>,
  jobId: ObjectId,
  userId: string,
  nextEventId: number,
  event: ChatStreamEventName,
  payload: unknown,
): Promise<number> {
  await jobs.updateOne(
    {
      _id: jobId,
      userId,
    },
    {
      $push: {
        events: {
          id: nextEventId,
          event,
          payload,
          createdAt: new Date(),
        },
      },
      $set: {
        nextEventId: nextEventId + 1,
      },
    },
  );

  return nextEventId;
}

function createReplaySseResponse(
  jobs: import("mongodb").Collection<ChatStreamJobDocument>,
  jobId: ObjectId,
  userId: string,
  lastEventId: number,
  signal?: AbortSignal,
): Response {
  const encoder = new TextEncoder();

  return createSseResponse(
    new ReadableStream({
      async start(controller) {
        let latestEventId = lastEventId;
        let heartbeatTick = 0;

        const pollForEvents = async (): Promise<void> => {
          if (signal?.aborted) {
            controller.close();
            return;
          }

          const job = await jobs.findOne({
            _id: jobId,
            userId,
          });

          if (!job) {
            throw new LumoRouteError("채팅 스트림을 찾지 못했습니다.", 404);
          }

          const nextEvents = (job.events ?? []).filter(({ id }) => id > latestEventId);

          nextEvents.forEach((streamEvent) => {
            latestEventId = streamEvent.id;
            controller.enqueue(
              encodeSseEvent(encoder, streamEvent.id, streamEvent.event, streamEvent.payload),
            );
          });

          if (job.status === "completed" || job.status === "failed") {
            controller.close();
            return;
          }

          heartbeatTick += 1;

          if (heartbeatTick >= 30) {
            controller.enqueue(encoder.encode(`: keep-alive ${Date.now()}\n\n`));
            heartbeatTick = 0;
          }

          await waitForNextPoll(500);
          await pollForEvents();
        };

        try {
          await pollForEvents();
        } catch {
          controller.close();
        }
      },
    }),
  );
}

export async function createChatStreamJob(
  body: ChatRequestPayload,
  userId: string,
  userName?: string | null,
  userImage?: string | null,
): Promise<{
  streamId: string;
  streamUrl: string;
  conversationId: string;
}> {
  const sanitizedBody: ChatRequestPayload = {
    ...body,
    messages: sanitizeChatMessages(body.messages),
  };
  const sanitizedMessageDocuments = sanitizedBody.messages.map((message) =>
    toMessageDocument(message as ChatMessage),
  );
  const conversationId = await ensureConversationForStream(
    sanitizedBody,
    sanitizedMessageDocuments,
    userId,
    userName,
    userImage,
  );
  const streamId = new ObjectId();
  const database = await getMongoDatabase();

  await database.collection<ChatStreamJobDocument>(CHAT_STREAM_JOBS_COLLECTION).insertOne({
    _id: streamId,
    userId,
    conversationId,
    request: sanitizedBody,
    status: "pending",
    events: [],
    nextEventId: 0,
    createdAt: new Date(),
  });

  return {
    streamId: streamId.toString(),
    streamUrl: `/api/conversations/streams/${streamId.toString()}`,
    conversationId: conversationId.toString(),
  };
}

export async function createChatEventStreamResponse(
  streamId: string,
  userId: string,
  lastEventId = -1,
  signal?: AbortSignal,
): Promise<Response> {
  if (!ObjectId.isValid(streamId)) {
    throw new LumoRouteError("잘못된 채팅 스트림 ID입니다.", 400);
  }

  const database = await getMongoDatabase();
  const streamObjectId = new ObjectId(streamId);
  const jobs = database.collection<ChatStreamJobDocument>(CHAT_STREAM_JOBS_COLLECTION);
  const claimedJob = await jobs.findOneAndUpdate(
    {
      _id: streamObjectId,
      userId,
      status: "pending",
    },
    {
      $set: {
        status: "processing",
        processedAt: new Date(),
      },
      $unset: {
        error: "",
      },
    },
    { returnDocument: "after" },
  );

  if (!claimedJob) {
    const existingJob = await jobs.findOne({
      _id: streamObjectId,
      userId,
    });

    if (!existingJob) {
      throw new LumoRouteError("채팅 스트림을 찾지 못했습니다.", 404);
    }

    return createReplaySseResponse(jobs, streamObjectId, userId, lastEventId, signal);
  }

  const encoder = new TextEncoder();

  return createSseResponse(
    new ReadableStream({
      async start(controller) {
        let nextEventId = claimedJob.nextEventId ?? 0;

        const enqueueEvent = async (event: ChatStreamEventName, payload: unknown) => {
          const currentEventId = await appendStreamEvent(
            jobs,
            claimedJob._id,
            userId,
            nextEventId,
            event,
            payload,
          );

          nextEventId += 1;

          try {
            controller.enqueue(encodeSseEvent(encoder, currentEventId, event, payload));
          } catch {
            // Keep processing and persisting events even if the current SSE client disconnects.
          }
        };

        try {
          const { request, conversationId } = claimedJob;
          const sanitizedMessages = sanitizeChatMessages(request.messages).map((message) =>
            toMessageDocument(message as ChatMessage),
          );
          const requestTimestamp = claimedJob.createdAt.toISOString();
          const toolRunResult = await generateSequentialToolMessages(request, (message) => {
            enqueueEvent("tool", message).catch(() => undefined);
          });

          if (toolRunResult.skippedAll) {
            await enqueueEvent(
              "tool",
              createChatMessage(
                "tool",
                "분석 스킵됨\n선택한 도구 변경이 없어 기존 분석을 그대로 사용합니다.",
              ),
            );
          }

          const prompt = buildLumoChatPrompt({
            ...request,
            requestTimestamp,
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
              await enqueueEvent("chunk", { delta });
            }

            await readNextChunk();
          };

          await readNextChunk();

          if (!assistantText.trim()) {
            throw new LumoRouteError("루모 AI 응답이 비어 있습니다. 다시 시도해 주세요.", 502);
          }

          const persistedConversation = await persistConversation(
            request,
            [
              ...sanitizedMessages,
              ...toolRunResult.streamedMessages.map(({ message }) =>
                toMessageDocument(message),
              ),
            ],
            assistantText,
            userId,
            conversationId,
          );

          await jobs.updateOne(
            {
              _id: claimedJob._id,
              userId,
            },
            {
              $set: {
                status: "completed",
                completedAt: new Date(),
              },
              $unset: {
                error: "",
              },
            },
          );

          await enqueueEvent("done", persistedConversation.conversation);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "루모 AI 채팅 생성에 실패했습니다.";

          await jobs.updateOne(
            {
              _id: claimedJob._id,
              userId,
            },
            {
              $set: {
                status: "failed",
                failedAt: new Date(),
                error: message,
              },
            },
          );

          await enqueueEvent("failure", { error: message });
        } finally {
          controller.close();
        }
      },
    }),
  );
}
