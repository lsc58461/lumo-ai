import { MongoClient, ServerApiVersion, type Db } from "mongodb";

const globalForMongo = globalThis as typeof globalThis & {
  mongoClientPromise?: Promise<MongoClient>;
  mongoIndexPromises?: Map<string, Promise<void>>;
};

const mongoOptions = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
};

let mongoClientPromise: Promise<MongoClient> | undefined;

async function ensureMongoIndexes(database: Db): Promise<void> {
  await Promise.all([
    database.collection("userProfiles").createIndex({ userId: 1 }, { unique: true }),
    database.collection("savedProfiles").createIndex(
      {
        userId: 1,
        contentHash: 1,
      },
      {
        unique: true,
        name: "savedProfiles_userId_contentHash",
      },
    ),
    database.collection("savedProfiles").createIndex(
      {
        userId: 1,
        updatedAt: -1,
        createdAt: -1,
        _id: -1,
      },
      { name: "savedProfiles_userId_updatedAt_createdAt" },
    ),
    database.collection("conversations").createIndex(
      {
        userId: 1,
        updatedAt: -1,
      },
      { name: "conversations_userId_updatedAt" },
    ),
    database.collection("sharedConversationSnapshots").createIndex(
      { shareId: 1 },
      {
        unique: true,
        name: "sharedConversationSnapshots_shareId",
      },
    ),
    database
      .collection("sharedConversationSnapshots")
      .createIndex({ userId: 1 }, { name: "sharedConversationSnapshots_userId" }),
  ]);
}

async function ensureMongoIndexesOnce(database: Db): Promise<void> {
  const { databaseName } = database;

  if (!globalForMongo.mongoIndexPromises) {
    globalForMongo.mongoIndexPromises = new Map<string, Promise<void>>();
  }

  const existingPromise = globalForMongo.mongoIndexPromises.get(databaseName);

  if (existingPromise) {
    await existingPromise;
    return;
  }

  const nextPromise = ensureMongoIndexes(database).catch((error: unknown) => {
    globalForMongo.mongoIndexPromises?.delete(databaseName);
    throw error;
  });

  globalForMongo.mongoIndexPromises.set(databaseName, nextPromise);
  await nextPromise;
}

export function isMongoConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

export async function getMongoClient(): Promise<MongoClient> {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error(
      "Missing MONGODB_URI. Add the variable to .env.local before using MongoDB.",
    );
  }

  if (process.env.NODE_ENV === "development") {
    if (!globalForMongo.mongoClientPromise) {
      globalForMongo.mongoClientPromise = new MongoClient(mongoUri, mongoOptions).connect();
    }

    return globalForMongo.mongoClientPromise;
  }

  if (!mongoClientPromise) {
    mongoClientPromise = new MongoClient(mongoUri, mongoOptions).connect();
  }

  return mongoClientPromise;
}

export async function getMongoDatabase(
  databaseName = process.env.MONGODB_DB ?? "lumo_ai",
): Promise<Db> {
  const client = await getMongoClient();
  const database = client.db(databaseName);

  await ensureMongoIndexesOnce(database);

  return database;
}
