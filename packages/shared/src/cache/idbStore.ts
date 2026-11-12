/**
 * Minimal IndexedDB KV store, no dependency. Chosen over localStorage
 * because catalog + lecture-list payloads can run into the hundreds of
 * KB once a few batches are cached, and localStorage is a synchronous
 * 5MB string store that would block the main thread on every read.
 */
const DB_NAME = "coaching-cache";
const STORE = "kv";
const VERSION = 1;

type Entry<T> = { value: T; storedAt: number; ttlMs: number };

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function idbGet<T>(key: string): Promise<Entry<T> | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null; // private-browsing / storage disabled — cache is best-effort
  }
}

export async function idbSet<T>(key: string, value: T, ttlMs: number): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ value, storedAt: Date.now(), ttlMs } satisfies Entry<T>, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* best-effort */
  }
}

export function isFresh(entry: Entry<unknown>): boolean {
  return Date.now() - entry.storedAt < entry.ttlMs;
}

export async function idbClear(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
  }
}
