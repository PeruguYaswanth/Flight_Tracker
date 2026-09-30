import { Collection, Db, MongoClient } from 'mongodb';
import { config } from './environment';

export interface UserDocument {
  /** Public user id (UUID) - what tokens, notifications and tracked flights refer to. */
  id: string;
  name: string;
  /** Always trimmed + lower-cased; unique. */
  email: string;
  /** scrypt hash (hex) of the password with `salt`. The password itself is never stored. */
  passwordHash: string;
  salt: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionDocument {
  /** SHA-256 of the session token - the token itself is never stored. */
  tokenHash: string;
  userId: string;
  createdAt: Date;
  /** MongoDB removes the session automatically after this time (TTL index). */
  expiresAt: Date;
}

export const USERS_COLLECTION = 'users';
export const SESSIONS_COLLECTION = 'sessions';

let client: MongoClient | null = null;
let db: Db | null = null;
let connecting: Promise<Db> | null = null;

async function connect(): Promise<Db> {
  if (!config.mongodbUri) {
    throw Object.assign(new Error('MONGODB_URI is not configured.'), { code: 'DATABASE_NOT_CONFIGURED' });
  }
  const c = new MongoClient(config.mongodbUri, { serverSelectionTimeoutMS: 5000 });
  await c.connect();
  const database = c.db(config.mongodbDbName);
  await database.collection<UserDocument>(USERS_COLLECTION).createIndexes([
    { key: { email: 1 }, name: 'email_unique', unique: true },
    { key: { id: 1 }, name: 'id_unique', unique: true },
  ]);
  await database.collection<SessionDocument>(SESSIONS_COLLECTION).createIndexes([
    { key: { tokenHash: 1 }, name: 'tokenHash_unique', unique: true },
    { key: { expiresAt: 1 }, name: 'expiresAt_ttl', expireAfterSeconds: 0 },
  ]);
  client = c;
  db = database;
  // Safe facts only - never the URI (it may contain credentials).
  console.log(`[Database] MongoDB connected: true | Database: ${database.databaseName} | Collections: ${USERS_COLLECTION}, ${SESSIONS_COLLECTION}`);
  return database;
}

/**
 * The application database, connecting on first use. A failed attempt is
 * retried on the next call rather than leaving the process permanently
 * without account storage.
 */
export async function getDb(): Promise<Db> {
  if (db) return db;
  if (!connecting) {
    connecting = connect().finally(() => {
      connecting = null;
    });
  }
  return connecting;
}

export async function usersCollection(): Promise<Collection<UserDocument>> {
  return (await getDb()).collection<UserDocument>(USERS_COLLECTION);
}

export async function sessionsCollection(): Promise<Collection<SessionDocument>> {
  return (await getDb()).collection<SessionDocument>(SESSIONS_COLLECTION);
}

export async function closeDb(): Promise<void> {
  await client?.close();
  client = null;
  db = null;
}
