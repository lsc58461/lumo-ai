import { ObjectId } from "mongodb";
import { cache } from "react";

import { defaultChatProfile, formatConversationUpdatedAt } from "@/lib/chat-session";
import { CONVERSATIONS_COLLECTION } from "@/lib/conversation-collection";
import {
  type ChatMessage,
  type ConversationPreview,
  featuredPromptSeeds,
  type ConversationSession,
  type PromptTemplate,
} from "@/lib/lumo-content";
import { getMongoDatabase } from "@/lib/mongodb";
import {
  resolveSavedProfileValues,
  serializeProfileSelection,
  type SavedProfileRecord,
} from "@/lib/profile";

interface PromptTemplateDocument {
  slug: string;
  title: string;
  summary: string;
  prompt: string;
  category: string;
  tools: PromptTemplate["tools"];
  tone: PromptTemplate["tone"];
  accent?: PromptTemplate["accent"];
  featured?: boolean;
  order?: number;
}

interface ChatMessageDocument {
  id?: string;
  role: ChatMessage["role"];
  content: string;
  createdAt?: string;
  toolResults?: ChatMessage["toolResults"];
  followUpSuggestions?: ChatMessage["followUpSuggestions"];
}

interface ConversationSessionDocument {
  slug?: string;
  title: string;
  focus: string;
  preview: string;
  updatedAt: string | Date;
  profile: string;
  toneId: PromptTemplate["tone"];
  tools: PromptTemplate["tools"];
  messages: ChatMessageDocument[];
  featured?: boolean;
  userId?: string;
  _id?: {
    toString(): string;
  };
}

interface ConversationPreviewDocument {
  slug?: string;
  title: string;
  focus: string;
  preview: string;
  updatedAt: string | Date;
  _id?: {
    toString(): string;
  };
}

interface SharedConversationDocument extends ConversationSessionDocument {
  shareId: string;
  sharedAt: string | Date;
  sourceConversationId?: string;
}

interface UserProfileDocument {
  userId: string;
  activeProfileId?: string;
  activeProfileIds?: string[];
  name?: string | null;
  image?: string | null;
  updatedAt: string | Date;
}

interface SavedProfileDocument {
  _id?: ObjectId;
  userId: string;
  value: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface UserDocument {
  _id?: ObjectId | string;
  name?: string | null;
  image?: string | null;
}

function buildUserIdQuery(userId: string) {
  const clauses: Record<string, ObjectId | string>[] = [{ _id: userId }];

  if (ObjectId.isValid(userId)) {
    clauses.push({ _id: new ObjectId(userId) });
  }

  return clauses.length === 1 ? clauses[0] : { $or: clauses };
}

function mapPromptTemplate(document: PromptTemplateDocument): PromptTemplate {
  return {
    id: document.slug,
    title: document.title,
    summary: document.summary,
    prompt: document.prompt,
    category: document.category,
    tools: document.tools,
    tone: document.tone,
    accent: document.accent ?? "gold",
  };
}

function mapConversationSession(document: ConversationSessionDocument): ConversationSession {
  return {
    id: document._id?.toString() ?? document.slug ?? `conversation-${document.title}`,
    title: document.title,
    focus: document.focus,
    updatedAt: formatConversationUpdatedAt(document.updatedAt),
    preview: document.preview,
    profile: document.profile,
    toneId: document.toneId,
    tools: document.tools,
    messages: (document.messages ?? []).map((message, index) => ({
      id: message.id ?? `${document.title}-${index}`,
      role: message.role,
      content: message.content,
      toolResults: message.toolResults,
      followUpSuggestions: message.followUpSuggestions,
      createdAt:
        message.createdAt ??
        (typeof document.updatedAt === "string"
          ? document.updatedAt
          : document.updatedAt.toISOString()),
    })),
  };
}

function mapConversationPreview(document: ConversationPreviewDocument): ConversationPreview {
  return {
    id: document._id?.toString() ?? document.slug ?? `conversation-${document.title}`,
    title: document.title,
    focus: document.focus,
    updatedAt: formatConversationUpdatedAt(document.updatedAt),
    preview: document.preview,
  };
}

function mapSavedProfileRecord(document: SavedProfileDocument): SavedProfileRecord {
  return {
    id: document._id?.toString() ?? "",
    value: document.value,
  };
}

export const getHomePageData = cache(async (userId?: string, shareId?: string) => {
  const database = await getMongoDatabase();
  const promptDocumentsPromise = database
    .collection<PromptTemplateDocument>("promptTemplates")
    .find({ featured: true })
    .sort({ order: 1, title: 1 })
    .limit(6)
    .toArray();
  const conversationPreviewDocumentsPromise =
    userId && !shareId
      ? database
          .collection<ConversationPreviewDocument>(CONVERSATIONS_COLLECTION)
          .find(
            { userId },
            {
              projection: {
                title: 1,
                focus: 1,
                preview: 1,
                updatedAt: 1,
              },
            },
          )
          .sort({ updatedAt: -1 })
          .limit(12)
          .toArray()
      : Promise.resolve([] as ConversationPreviewDocument[]);
  const userProfilePromise = userId
    ? database.collection<UserProfileDocument>("userProfiles").findOne({ userId })
    : Promise.resolve(null);
  const savedProfilesPromise = userId
    ? database
        .collection<SavedProfileDocument>("savedProfiles")
        .find({ userId })
        .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
        .toArray()
    : Promise.resolve([] as SavedProfileDocument[]);
  const userDocumentPromise = userId
    ? database.collection<UserDocument>("users").findOne(buildUserIdQuery(userId))
    : Promise.resolve(null);
  const sharedConversationPromise = shareId
    ? database
        .collection<SharedConversationDocument>("sharedConversationSnapshots")
        .findOne({ shareId })
    : Promise.resolve(null);
  const [
    promptDocuments,
    conversationPreviewDocuments,
    userProfileDocument,
    savedProfileDocuments,
    userDocument,
    sharedConversationDocument,
  ] = await Promise.all([
    promptDocumentsPromise,
    conversationPreviewDocumentsPromise,
    userProfilePromise,
    savedProfilesPromise,
    userDocumentPromise,
    sharedConversationPromise,
  ]);

  const mappedSharedConversation = sharedConversationDocument
    ? mapConversationSession(sharedConversationDocument)
    : null;
  const initialProfiles = savedProfileDocuments.map(mapSavedProfileRecord);
  const initialActiveProfileIds = userProfileDocument?.activeProfileIds ?? [];
  const initialProfileValues = resolveSavedProfileValues(
    initialProfiles,
    initialActiveProfileIds,
  );

  return {
    featuredPrompts:
      promptDocuments.length > 0 ? promptDocuments.map(mapPromptTemplate) : featuredPromptSeeds,
    conversationPreviews:
      mappedSharedConversation || conversationPreviewDocuments.length === 0
        ? []
        : conversationPreviewDocuments.map(mapConversationPreview),
    initialProfiles,
    initialActiveProfileIds,
    initialProfile: serializeProfileSelection(initialProfileValues) || defaultChatProfile,
    initialUserName:
      (userProfileDocument?.name ?? userDocument?.name ?? undefined) || undefined,
    initialUserImage:
      (userProfileDocument?.image ?? userDocument?.image ?? undefined) || undefined,
    sharedConversation: mappedSharedConversation,
    isSharedView: Boolean(mappedSharedConversation),
  };
});
