/**
 * IndexedDB wrapper — armazenamento offline para limite, municípios, UCs,
 * eventos, frentes, meteorologia, alertas, configurações e trilhas do Modo Campo.
 */

const DB_NAME = 'geofogo-ceara';
const DB_VERSION = 2;

const STORES = {
  boundary: 'boundary',
  municipalities: 'municipalities',
  conservationUnits: 'conservationUnits',
  indigenousLands: 'indigenousLands',
  fireEvents: 'fireEvents',
  fireFronts: 'fireFronts',
  weather: 'weather',
  alerts: 'alerts',
  settings: 'settings',
  fieldTrails: 'fieldTrails',
  fieldPoints: 'fieldPoints',
  metadata: 'metadata',
};

let _db = null;

export async function initDB() {
  if (_db) return _db;

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const [name, key] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      }
    };

    req.onsuccess = (e) => {
      _db = e.target.result;
      resolve(_db);
    };

    req.onerror = () => reject(req.error);
  });
}

function tx(storeName, mode = 'readonly') {
  return _db.transaction(storeName, mode).objectStore(storeName);
}

export const db = {
  async get(store, key) {
    return new Promise((resolve, reject) => {
      const r = tx(store).get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  },

  async put(store, value, key) {
    const record = key !== undefined
      ? { id: key, data: value, updated_date: Date.now() }
      : { ...value, updated_date: Date.now() };
    return new Promise((resolve, reject) => {
      const r = tx(store, 'readwrite').put(record);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  },

  async getMeta(store, key) {
    const rec = await this.get(store, key);
    return rec;
  },

  async setMeta(store, key, data) {
    return this.put(store, data, key);
  },

  async getAll(store) {
    return new Promise((resolve, reject) => {
      const r = tx(store).getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error);
    });
  },

  async clear(store) {
    return new Promise((resolve, reject) => {
      const r = tx(store, 'readwrite').clear();
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  },

  async delete(store, key) {
    return new Promise((resolve, reject) => {
      const r = tx(store, 'readwrite').delete(key);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  },

  stores: STORES,
};