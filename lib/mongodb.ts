import { MongoClient, ServerApiVersion, type Db } from "mongodb";

const globalForMongo = globalThis as typeof globalThis & {
  mongoClientPromise?: Promise<MongoClient>;
};

const mongoOptions = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
};

let mongoClientPromise: Promise<MongoClient> | undefined;

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

  return client.db(databaseName);
}
