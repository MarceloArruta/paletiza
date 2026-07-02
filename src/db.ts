// Client-side IndexedDB and LocalStorage safe wrappers to prevent browser clearing and sandbox security errors
function getSafeIndexedDB(): IDBFactory | null {
  try {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      return window.indexedDB;
    }
  } catch (e) {
    console.warn("IndexedDB access is blocked or restricted by the browser/iframe security policies.", e);
  }
  return null;
}

class IndexedDBSyncer {
  private dbName = 'palletizer_db';
  private storeName = 'key_value_store';
  private version = 1;
  private db: IDBDatabase | null = null;

  private init(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const indexedDB = getSafeIndexedDB();
      if (!indexedDB) {
        reject(new Error('IndexedDB is not supported or accessible on this platform.'));
        return;
      }

      if (this.db) {
        resolve(this.db);
        return;
      }

      try {
        const request = indexedDB.open(this.dbName, this.version);

        request.onerror = () => {
          reject(request.error || new Error('Unknown IndexedDB opening error'));
        };

        request.onsuccess = () => {
          this.db = request.result;
          resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName);
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const db = await this.init();
      return new Promise((resolve) => {
        try {
          const transaction = db.transaction(this.storeName, 'readonly');
          const store = transaction.objectStore(this.storeName);
          const request = store.get(key);
          request.onerror = () => {
            console.error('IndexedDB get error', request.error);
            resolve(null);
          };
          request.onsuccess = () => {
            resolve(request.result !== undefined ? (request.result as T) : null);
          };
        } catch (err) {
          console.error('IndexedDB get transaction error', err);
          resolve(null);
        }
      });
    } catch (e) {
      console.warn('Failed to get from IndexedDB, falling back to null', e);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const db = await this.init();
      return new Promise((resolve) => {
        try {
          const transaction = db.transaction(this.storeName, 'readwrite');
          const store = transaction.objectStore(this.storeName);
          const request = store.put(value, key);
          request.onerror = () => {
            console.error('IndexedDB set error', request.error);
            resolve();
          };
          request.onsuccess = () => {
            resolve();
          };
        } catch (err) {
          console.error('IndexedDB set transaction error', err);
          resolve();
        }
      });
    } catch (e) {
      console.warn('Failed to set in IndexedDB', e);
    }
  }
}

class SafeStorageUtility {
  private memoryStore: Record<string, string> = {};

  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window && window.localStorage !== null) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      console.warn(`LocalStorage blocked for reading key "${key}". using in-memory fallback.`);
    }
    return this.memoryStore[key] || null;
  }

  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window && window.localStorage !== null) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch (e) {
      console.warn(`LocalStorage blocked for writing key "${key}". using in-memory fallback.`);
    }
    this.memoryStore[key] = value;
  }

  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window && window.localStorage !== null) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch (e) {
      console.warn(`LocalStorage blocked for deleting key "${key}". using in-memory fallback.`);
    }
    delete this.memoryStore[key];
  }
}

export const idb = new IndexedDBSyncer();
export const safeStorage = new SafeStorageUtility();
