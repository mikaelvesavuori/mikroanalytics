import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { StorageProvider } from "mikroauth";

interface AuthStorageRow {
  expires_at: number | null;
  value: string;
}

interface AuthCollectionRow {
  expires_at: number | null;
  items_json: string;
}

export class SqliteAuthStorageProvider implements StorageProvider {
  private readonly database: DatabaseSync;

  constructor(filename: string) {
    if (filename !== ":memory:") {
      mkdirSync(dirname(filename), { recursive: true });
    }

    this.database = new DatabaseSync(filename);
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA synchronous = NORMAL;

      CREATE TABLE IF NOT EXISTS auth_storage (
        storage_key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expires_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS auth_collections (
        collection_key TEXT PRIMARY KEY,
        items_json TEXT NOT NULL,
        expires_at INTEGER
      );
    `);
  }

  async set(key: string, value: string, expirySeconds?: number): Promise<void> {
    this.database
      .prepare(
        `
          INSERT INTO auth_storage (storage_key, value, expires_at)
          VALUES (?, ?, ?)
          ON CONFLICT(storage_key) DO UPDATE SET
            value = excluded.value,
            expires_at = excluded.expires_at
        `,
      )
      .run(key, value, calculateExpiry(expirySeconds));
  }

  async get(key: string): Promise<string | null> {
    const row = this.database
      .prepare("SELECT value, expires_at FROM auth_storage WHERE storage_key = ?")
      .get(key) as AuthStorageRow | undefined;

    if (!row) {
      return null;
    }

    if (hasExpired(row.expires_at)) {
      await this.delete(key);
      return null;
    }

    return row.value;
  }

  async delete(key: string): Promise<void> {
    this.database.prepare("DELETE FROM auth_storage WHERE storage_key = ?").run(key);
    this.database.prepare("DELETE FROM auth_collections WHERE collection_key = ?").run(key);
  }

  async addToCollection(
    collectionKey: string,
    item: string,
    expirySeconds?: number,
  ): Promise<void> {
    const collection = await this.readCollection(collectionKey);
    const items = collection?.items ?? [];

    if (!items.includes(item)) {
      items.push(item);
    }

    this.database
      .prepare(
        `
          INSERT INTO auth_collections (collection_key, items_json, expires_at)
          VALUES (?, ?, ?)
          ON CONFLICT(collection_key) DO UPDATE SET
            items_json = excluded.items_json,
            expires_at = excluded.expires_at
        `,
      )
      .run(
        collectionKey,
        JSON.stringify(items),
        expirySeconds ? calculateExpiry(expirySeconds) : (collection?.expiresAt ?? null),
      );
  }

  async removeFromCollection(collectionKey: string, item: string): Promise<void> {
    const collection = await this.readCollection(collectionKey);

    if (!collection) {
      return;
    }

    this.database
      .prepare("UPDATE auth_collections SET items_json = ? WHERE collection_key = ?")
      .run(
        JSON.stringify(collection.items.filter((collectionItem) => collectionItem !== item)),
        collectionKey,
      );
  }

  async getCollection(collectionKey: string): Promise<string[]> {
    return (await this.readCollection(collectionKey))?.items ?? [];
  }

  async getCollectionSize(collectionKey: string): Promise<number> {
    return (await this.getCollection(collectionKey)).length;
  }

  async removeOldestFromCollection(collectionKey: string): Promise<string | null> {
    const collection = await this.readCollection(collectionKey);

    if (!collection || collection.items.length === 0) {
      return null;
    }

    const [oldest, ...remaining] = collection.items;
    this.database
      .prepare("UPDATE auth_collections SET items_json = ? WHERE collection_key = ?")
      .run(JSON.stringify(remaining), collectionKey);

    return oldest ?? null;
  }

  async findKeys(pattern: string): Promise<string[]> {
    this.removeExpiredRows();

    const matcher = new RegExp(`^${wildcardToRegExp(pattern)}$`);
    const rows = this.database.prepare("SELECT storage_key FROM auth_storage").all() as {
      storage_key: string;
    }[];

    return rows.map((row) => row.storage_key).filter((key) => matcher.test(key));
  }

  close(): void {
    this.database.close();
  }

  private async readCollection(
    collectionKey: string,
  ): Promise<{ expiresAt: number | null; items: string[] } | null> {
    const row = this.database
      .prepare("SELECT items_json, expires_at FROM auth_collections WHERE collection_key = ?")
      .get(collectionKey) as AuthCollectionRow | undefined;

    if (!row) {
      return null;
    }

    if (hasExpired(row.expires_at)) {
      await this.delete(collectionKey);
      return null;
    }

    return {
      expiresAt: row.expires_at,
      items: parseCollectionItems(row.items_json),
    };
  }

  private removeExpiredRows(): void {
    const now = Date.now();
    this.database
      .prepare("DELETE FROM auth_storage WHERE expires_at IS NOT NULL AND expires_at < ?")
      .run(now);
    this.database
      .prepare("DELETE FROM auth_collections WHERE expires_at IS NOT NULL AND expires_at < ?")
      .run(now);
  }
}

function calculateExpiry(expirySeconds?: number): number | null {
  return expirySeconds ? Date.now() + expirySeconds * 1000 : null;
}

function hasExpired(expiresAt: number | null): boolean {
  return typeof expiresAt === "number" && expiresAt < Date.now();
}

function parseCollectionItems(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function wildcardToRegExp(pattern: string): string {
  return pattern
    .split("")
    .map((character) => {
      if (character === "*") {
        return ".*";
      }

      if (character === "?") {
        return ".";
      }

      return character.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
    })
    .join("");
}
