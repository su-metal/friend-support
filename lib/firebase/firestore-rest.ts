import { googleAccessToken } from "./oauth";
import { firebaseProjectId } from "@/lib/env";
import type {
  DocumentData,
  DocumentStore,
  Transaction,
} from "@/services/store";
type Value = {
  stringValue?: string;
  timestampValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  nullValue?: null;
  mapValue?: { fields: Record<string, Value> };
  arrayValue?: { values?: Value[] };
};
type FirestoreDocument = { name: string; fields: Record<string, Value> };
function encode(value: unknown): Value {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number")
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  if (Array.isArray(value))
    return { arrayValue: { values: value.map(encode) } };
  if (typeof value === "object")
    return { mapValue: { fields: encodeFields(value as DocumentData) } };
  throw new Error("Unsupported Firestore value");
}
function encodeFields(value: DocumentData) {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, encode(v)]),
  );
}
function decode(value: Value): unknown {
  if ("timestampValue" in value) return new Date(value.timestampValue!);
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("arrayValue" in value)
    return (value.arrayValue?.values ?? []).map(decode);
  if ("mapValue" in value) return decodeFields(value.mapValue!.fields);
  return null;
}
function decodeFields(fields: Record<string, Value>) {
  return Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, decode(v)]),
  );
}
class FirestoreError extends Error {
  constructor(public status: number) {
    super(`Firestore request failed (${status})`);
  }
}
export class FirestoreRestStore implements DocumentStore {
  private token?: Promise<string>;
  private readonly database = `projects/${firebaseProjectId()}/databases/(default)`;
  private readonly base = process.env.FIRESTORE_EMULATOR_HOST
    ? `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1`
    : "https://firestore.googleapis.com/v1";
  private async request(path: string, init?: RequestInit) {
    const bearer = process.env.FIRESTORE_EMULATOR_HOST
      ? "owner"
      : await (this.token ??= googleAccessToken());
    const response = await fetch(`${this.base}/${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearer}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new FirestoreError(response.status);
    return response.json();
  }
  async get<T>(path: string, transaction?: string): Promise<T | null> {
    if (transaction) {
      const rows = (await this.request(`${this.database}/documents:batchGet`, {
        method: "POST",
        body: JSON.stringify({
          documents: [`${this.database}/documents/${path}`],
          transaction,
        }),
      })) as { found?: FirestoreDocument; missing?: string }[];
      const found = rows.find((r) => r.found)?.found;
      return found ? (decodeFields(found.fields ?? {}) as T) : null;
    }
    try {
      const doc = (await this.request(
        `${this.database}/documents/${path}`,
      )) as FirestoreDocument;
      return decodeFields(doc.fields ?? {}) as T;
    } catch (e) {
      if (e instanceof FirestoreError && e.status === 404) return null;
      throw e;
    }
  }
  async set(path: string, data: DocumentData) {
    await this.request(`${this.database}/documents/${path}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: encodeFields(data) }),
    });
  }
  async getMany<T>(
    paths: string[],
    transaction?: string,
  ): Promise<(T | null)[]> {
    const result: (T | null)[] = [];
    for (let i = 0; i < paths.length; i += 200) {
      const batch = paths.slice(i, i + 200);
      const rows = (await this.request(`${this.database}/documents:batchGet`, {
        method: "POST",
        body: JSON.stringify({
          documents: batch.map((path) => `${this.database}/documents/${path}`),
          ...(transaction ? { transaction } : {}),
        }),
      })) as { found?: FirestoreDocument; missing?: string }[];
      const found = new Map(
        rows
          .filter((r) => r.found)
          .map((r) => [r.found!.name, decodeFields(r.found!.fields ?? {})]),
      );
      result.push(
        ...batch.map(
          (path) =>
            (found.get(`${this.database}/documents/${path}`) as
              T | undefined) ?? null,
        ),
      );
    }
    return result;
  }
  async query<T>(
    collection: string,
    filters: { field: string; value: string }[] = [],
  ): Promise<T[]> {
    const fieldFilters = filters.map((f) => ({
      fieldFilter: {
        field: { fieldPath: f.field },
        op: "EQUAL",
        value: encode(f.value),
      },
    }));
    const result: T[] = [];
    let offset = 0;
    while (true) {
      const rows = (await this.request(`${this.database}/documents:runQuery`, {
        method: "POST",
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: collection }],
            ...(fieldFilters.length
              ? {
                  where:
                    fieldFilters.length === 1
                      ? fieldFilters[0]
                      : {
                          compositeFilter: { op: "AND", filters: fieldFilters },
                        },
                }
              : {}),
            limit: 200,
            offset,
          },
        }),
      })) as { document?: FirestoreDocument }[];
      const docs = rows
        .filter((r) => r.document)
        .map((r) => decodeFields(r.document!.fields) as T);
      result.push(...docs);
      if (docs.length < 200) break;
      offset += 200;
    }
    return result;
  }
  async transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { transaction } = (await this.request(
        `${this.database}/documents:beginTransaction`,
        {
          method: "POST",
          body: JSON.stringify({ options: { readWrite: {} } }),
        },
      )) as { transaction: string };
      const writes: unknown[] = [];
      const tx: Transaction = {
        get: <U>(path: string) => this.get<U>(path, transaction),
        getMany: <U>(paths: string[]) => this.getMany<U>(paths, transaction),
        set: (path, data) =>
          writes.push({
            update: {
              name: `${this.database}/documents/${path}`,
              fields: encodeFields(data),
            },
          }),
        delete: (path) =>
          writes.push({ delete: `${this.database}/documents/${path}` }),
      };
      try {
        const value = await work(tx);
        await this.request(`${this.database}/documents:commit`, {
          method: "POST",
          body: JSON.stringify({ transaction, writes }),
        });
        return value;
      } catch (error) {
        try {
          await this.request(`${this.database}/documents:rollback`, {
            method: "POST",
            body: JSON.stringify({ transaction }),
          });
        } catch {
          /* Transaction can already be aborted. */
        }
        if (
          error instanceof FirestoreError &&
          [409, 429, 503].includes(error.status) &&
          attempt < 4
        ) {
          await new Promise((r) => setTimeout(r, 40 * (attempt + 1)));
          continue;
        }
        throw error;
      }
    }
    throw new Error("Transaction retry exhausted");
  }
}
