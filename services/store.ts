export type DocumentData = Record<string, unknown>;
export interface Transaction {
  get<T>(path: string): Promise<T | null>;
  getMany<T>(paths: string[]): Promise<(T | null)[]>;
  set(path: string, data: DocumentData): void;
  delete(path: string): void;
}
export interface DocumentStore {
  get<T>(path: string): Promise<T | null>;
  getMany<T>(paths: string[]): Promise<(T | null)[]>;
  set(path: string, data: DocumentData): Promise<void>;
  query<T>(
    collection: string,
    filters?: { field: string; value: string }[],
  ): Promise<T[]>;
  transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
}
