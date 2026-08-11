/**
 * IndexedDB wrapper
 *
 * Armazenamento offline para:
 * - dados cartográficos;
 * - eventos e alertas;
 * - configurações;
 * - trilhos;
 * - pontos de campo;
 * - fotografias de campo.
 */

const DB_NAME =
  'geofogo-ceara';

const DB_VERSION =
  4;

const STORES = {
  boundary:
    'boundary',

  municipalities:
    'municipalities',

  conservationUnits:
    'conservationUnits',

  indigenousLands:
    'indigenousLands',

  fireEvents:
    'fireEvents',

  fireFronts:
    'fireFronts',

  weather:
    'weather',

  alerts:
    'alerts',

  settings:
    'settings',

  /**
   * Missões operacionais.
   *
   * Cada missão organiza:
   * - trilhos;
   * - marcadores;
   * - fotografias;
   * - outros registros futuros.
   */
  fieldMissions:
    'fieldMissions',

  /**
   * Registros completos dos trilhos.
   */
  fieldTrails:
    'fieldTrails',

  /**
   * Pontos independentes ou opcionalmente
   * vinculados a um trilho.
   */
  fieldPoints:
    'fieldPoints',

  /**
   * Fotografias vinculadas a trilho, ponto
   * ou futuramente independentes.
   */
  fieldPhotos:
    'fieldPhotos',

  metadata:
    'metadata',
};

let _db =
  null;

export async function initDB() {
  if (_db) {
    return _db;
  }

  return new Promise(
    (
      resolve,
      reject,
    ) => {
      const request =
        indexedDB.open(
          DB_NAME,
          DB_VERSION,
        );

      request.onupgradeneeded =
        (event) => {
          const database =
            event.target.result;

          for (
            const [
              storeName,
            ]
            of Object.entries(
              STORES,
            )
          ) {
            if (
              !database
                .objectStoreNames
                .contains(
                  storeName,
                )
            ) {
              database.createObjectStore(
                storeName,
                {
                  keyPath:
                    'id',
                },
              );
            }
          }
        };

      request.onsuccess =
        (event) => {
          _db =
            event.target.result;

          /**
           * Outra aba pode atualizar a versão do banco.
           * Nesse caso esta conexão deve ser encerrada.
           */
          _db.onversionchange =
            () => {
              _db?.close();

              _db =
                null;
            };

          resolve(
            _db,
          );
        };

      request.onerror =
        () => {
          reject(
            request.error,
          );
        };

      request.onblocked =
        () => {
          console.warn(
            '[IndexedDB] Atualização bloqueada por outra aba aberta.',
          );
        };
    },
  );
}

function getDatabase() {
  if (!_db) {
    throw new Error(
      'O IndexedDB ainda não foi inicializado.',
    );
  }

  return _db;
}

function tx(
  storeName,
  mode =
    'readonly',
) {
  return getDatabase()
    .transaction(
      storeName,
      mode,
    )
    .objectStore(
      storeName,
    );
}

export const db = {
  async get(
    store,
    key,
  ) {
    return new Promise(
      (
        resolve,
        reject,
      ) => {
        const request =
          tx(
            store,
          ).get(
            key,
          );

        request.onsuccess =
          () => {
            resolve(
              request.result,
            );
          };

        request.onerror =
          () => {
            reject(
              request.error,
            );
          };
      },
    );
  },

  async put(
    store,
    value,
    key,
  ) {
    const record =
      key !== undefined
        ? {
            id: key,
            data: value,
            updated_date:
              Date.now(),
          }
        : {
            ...value,
            updated_date:
              Date.now(),
          };

    return new Promise(
      (
        resolve,
        reject,
      ) => {
        const transaction =
          getDatabase()
            .transaction(
              store,
              'readwrite',
            );

        const objectStore =
          transaction
            .objectStore(
              store,
            );

        let requestResult;

        const request =
          objectStore.put(
            record,
          );

        request.onsuccess =
          () => {
            /*
            * O request terminou, mas a transação ainda
            * pode abortar.
            *
            * Guardamos apenas o resultado e esperamos
            * transaction.oncomplete para resolver.
            */
            requestResult =
              request.result;
          };

        request.onerror =
          () => {
            /*
            * O erro da transação será tratado por
            * onabort/onerror abaixo.
            *
            * Não resolvemos nem rejeitamos aqui para
            * manter uma única fonte de término.
            */
          };

        transaction.oncomplete =
          () => {
            resolve(
              requestResult,
            );
          };

        transaction.onerror =
          () => {
            reject(
              transaction.error ||
                request.error ||
                new Error(
                  'Falha ao gravar no IndexedDB.',
                ),
            );
          };

        transaction.onabort =
          () => {
            reject(
              transaction.error ||
                request.error ||
                new Error(
                  'A transação de gravação no IndexedDB foi abortada.',
                ),
            );
          };
      },
    );
  },

  async getMeta(
    store,
    key,
  ) {
    return this.get(
      store,
      key,
    );
  },

  async setMeta(
    store,
    key,
    data,
  ) {
    return this.put(
      store,
      data,
      key,
    );
  },

  async getAll(
    store,
  ) {
    return new Promise(
      (
        resolve,
        reject,
      ) => {
        const request =
          tx(
            store,
          ).getAll();

        request.onsuccess =
          () => {
            resolve(
              request.result ||
              [],
            );
          };

        request.onerror =
          () => {
            reject(
              request.error,
            );
          };
      },
    );
  },

  async clear(
    store,
  ) {
    return new Promise(
      (
        resolve,
        reject,
      ) => {
        const transaction =
          getDatabase()
            .transaction(
              store,
              'readwrite',
            );

        const objectStore =
          transaction
            .objectStore(
              store,
            );

        const request =
          objectStore.clear();

        transaction.oncomplete =
          () => {
            resolve();
          };

        transaction.onerror =
          () => {
            reject(
              transaction.error ||
                request.error ||
                new Error(
                  'Falha ao limpar dados do IndexedDB.',
                ),
            );
          };

        transaction.onabort =
          () => {
            reject(
              transaction.error ||
                request.error ||
                new Error(
                  'A transação de limpeza do IndexedDB foi abortada.',
                ),
            );
          };
      },
    );
  },

  async delete(
    store,
    key,
  ) {
    return new Promise(
      (
        resolve,
        reject,
      ) => {
        const transaction =
          getDatabase()
            .transaction(
              store,
              'readwrite',
            );

        const objectStore =
          transaction
            .objectStore(
              store,
            );

        const request =
          objectStore.delete(
            key,
          );

        transaction.oncomplete =
          () => {
            resolve();
          };

        transaction.onerror =
          () => {
            reject(
              transaction.error ||
                request.error ||
                new Error(
                  'Falha ao excluir dado do IndexedDB.',
                ),
            );
          };

        transaction.onabort =
          () => {
            reject(
              transaction.error ||
                request.error ||
                new Error(
                  'A transação de exclusão do IndexedDB foi abortada.',
                ),
            );
          };
      },
    );
  },

  stores:
    STORES,
};