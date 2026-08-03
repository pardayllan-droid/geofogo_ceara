/**
 * FieldPointRepository
 *
 * Centraliza a persistência dos pontos de campo.
 *
 * Um ponto pode ser:
 * - independente;
 * - vinculado opcionalmente a um trilho.
 *
 * No APK, esta implementação poderá ser substituída
 * por SQLite sem alterar o FieldController.
 */

import {
  db,
} from '../storage/indexedDb';

import {
  normalizeFieldPoint,
} from './FieldPointModel';

class FieldPointRepositoryImpl {
  async save(
    point,
  ) {
    const normalized =
      normalizeFieldPoint(
        point,
      );

    if (!normalized?.id) {
      throw new Error(
        'Não é possível salvar um ponto de campo inválido.',
      );
    }

    const record = {
      ...normalized,

      updated_date:
        Date.now(),

      properties: {
        ...normalized.properties,

        updated_date:
          Date.now(),
      },
    };

    await db.put(
      db.stores.fieldPoints,
      record,
    );

    return record;
  }

  async getById(
    pointId,
  ) {
    if (!pointId) {
      return null;
    }

    const record =
      await db.get(
        db.stores.fieldPoints,
        pointId,
      );

    return normalizeFieldPoint(
      record,
    );
  }

  async getAll() {
    const records =
      await db.getAll(
        db.stores.fieldPoints,
      );

    return records
      .map(
        normalizeFieldPoint,
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
            second.properties
              ?.timestamp ||
            0
          ) -
          (
            first.properties
              ?.timestamp ||
            0
          ),
      );
  }

  async getByTrailId(
    trailId,
  ) {
    if (!trailId) {
      return [];
    }

    const all =
      await this.getAll();

    return all.filter(
      (point) =>
        (
          point.trailId ??
          point.properties
            ?.trailId
        ) ===
        trailId,
    );
  }

  async getIndependentPoints() {
    const all =
      await this.getAll();

    return all.filter(
      (point) =>
        !(
          point.trailId ??
          point.properties
            ?.trailId
        ),
    );
  }

  async delete(
    pointId,
  ) {
    if (!pointId) {
      return;
    }

    await db.delete(
      db.stores.fieldPoints,
      pointId,
    );
  }

  async clear() {
    await db.clear(
      db.stores.fieldPoints,
    );
  }
}

export const FieldPointRepository =
  new FieldPointRepositoryImpl();