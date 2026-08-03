/**
 * TrailRepository
 *
 * Centraliza a persistência dos trilhos.
 *
 * O FieldController não deve acessar diretamente
 * a store fieldTrails.
 *
 * No futuro, a implementação poderá usar:
 * - IndexedDB na Web/PWA;
 * - SQLite no APK;
 * - sincronização remota.
 */

import {
  db,
} from '../storage/indexedDb';

import {
  isTrailOpen,
  normalizeTrail,
} from './TrailModel';

class TrailRepositoryImpl {
  async save(
    trail,
  ) {
    if (!trail?.id) {
      throw new Error(
        'Não é possível salvar um trilho sem identificador.',
      );
    }

    const normalized =
      normalizeTrail({
        ...trail,

        updated_date:
          Date.now(),
      });

    await db.put(
      db.stores.fieldTrails,
      normalized,
    );

    return normalized;
  }

  async getById(
    trailId,
  ) {
    if (!trailId) {
      return null;
    }

    const trail =
      await db.get(
        db.stores.fieldTrails,
        trailId,
      );

    return normalizeTrail(
      trail,
    );
  }

  async getAll() {
    const records =
      await db.getAll(
        db.stores.fieldTrails,
      );

    return records
      .map(
        normalizeTrail,
      )
      .filter(
        Boolean,
      )
      .sort(
        (
          first,
          second,
        ) =>
          (
            second.startedAt ||
            0
          ) -
          (
            first.startedAt ||
            0
          ),
      );
  }

  async getOpenTrail() {
    const trails =
      await this.getAll();

    return (
      trails.find(
        isTrailOpen,
      ) ||
      null
    );
  }

  async delete(
    trailId,
  ) {
    if (!trailId) {
      return;
    }

    await db.delete(
      db.stores.fieldTrails,
      trailId,
    );
  }

  async clear() {
    await db.clear(
      db.stores.fieldTrails,
    );
  }
}

export const TrailRepository =
  new TrailRepositoryImpl();