import type { DocumentData, DocumentStore, Transaction } from "./store";
export class MemoryStore implements DocumentStore {
  private documents = new Map<string, DocumentData>();
  private pending: Promise<void> = Promise.resolve();
  async get<T>(path: string): Promise<T | null> {
    return structuredClone(this.documents.get(path) ?? null) as T | null;
  }
  async set(path: string, data: DocumentData) {
    await this.transaction(async (tx) => tx.set(path, data));
  }
  async getMany<T>(paths: string[]) {
    return Promise.all(paths.map((path) => this.get<T>(path)));
  }
  async query<T>(
    collection: string,
    filters: { field: string; value: string }[] = [],
  ): Promise<T[]> {
    return [...this.documents.entries()]
      .filter(
        ([path, d]) =>
          path.startsWith(`${collection}/`) &&
          path.split("/").length === 2 &&
          filters.every((f) => d[f.field] === f.value),
      )
      .map(([, d]) => structuredClone(d) as T);
  }
  async transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    const previous = this.pending;
    let release!: () => void;
    this.pending = new Promise<void>((r) => {
      release = r;
    });
    await previous;
    const snapshot = new Map(
      [...this.documents].map(([k, v]) => [k, structuredClone(v)]),
    );
    const tx: Transaction = {
      getMany: async <U>(paths: string[]) =>
        paths.map((p) => structuredClone(snapshot.get(p) ?? null) as U | null),
      get: async <U>(p: string) =>
        structuredClone(snapshot.get(p) ?? null) as U | null,
      set: (p, d) => {
        snapshot.set(p, structuredClone(d));
      },
      delete: (p) => {
        snapshot.delete(p);
      },
    };
    try {
      const result = await work(tx);
      this.documents = snapshot;
      return result;
    } finally {
      release();
    }
  }
}
