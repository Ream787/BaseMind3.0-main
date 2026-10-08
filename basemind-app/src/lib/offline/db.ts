/**
 * Minimal IndexedDB key/value store.
 *
 * localStorage would be simpler but it's synchronous, capped around 5 MB, and
 * shared with the Supabase session — filling it up would log people out.
 * IndexedDB keeps the cache well clear of that.
 */

import { storagePrefix } from "@/lib/orgs";

const DB_NAME = "basemind-offline";
const DB_VERSION = 1;
const STORE = "kv";

/**
 * Keys are per group.
 *
 * Several Scout groups share one origin, so they share this database. Without
 * the prefix, opening the 2nd's equipment would read the 14th's cached rows
 * back off the device and show them as the 2nd's.
 */
const scoped = (key: string) => `${storagePrefix}${key}`;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  // A failed open shouldn't poison every later call (private browsing, quota).
  dbPromise.catch(() => {
    dbPromise = null;
  });

  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = run(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

/** Storage is best-effort: a failure here must never break the app. */
export async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    return await tx<T>("readonly", (store) => store.get(scoped(key)) as IDBRequest<T>);
  } catch {
    return undefined;
  }
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    await tx("readwrite", (store) => store.put(value, scoped(key)) as IDBRequest<IDBValidKey>);
  } catch {
    // Out of quota or blocked — carry on without a cache.
  }
}

export async function idbDelete(key: string): Promise<void> {
  try {
    await tx("readwrite", (store) => store.delete(scoped(key)) as IDBRequest<undefined>);
  } catch {
    /* ignore */
  }
}

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}
