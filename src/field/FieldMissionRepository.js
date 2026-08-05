/**
 * FieldMissionRepository
 *
 * Centraliza a persistência das missões operacionais.
 *
 * No futuro esta implementação poderá ser substituída
 * por SQLite no APK sem alterar os componentes.
 */

import {
  db,
} from '../storage/indexedDb';

import {
  FIELD_MISSION_STATUS,
  normalizeFieldMission,
} from './FieldMissionModel';

class FieldMissionRepositoryImpl {
  async save(
    mission,
  ) {
    const normalized =
      normalizeFieldMission({
        ...mission,

        updated_date:
          Date.now(),
      });

    if (!normalized?.id) {
      throw new Error(
        'Não é possível salvar uma missão inválida.',
      );
    }

    await db.put(
      db.stores.fieldMissions,
      normalized,
    );

    return normalized;
  }

  async getById(
    missionId,
  ) {
    if (!missionId) {
      return null;
    }

    const record =
      await db.get(
        db.stores.fieldMissions,
        missionId,
      );

    return normalizeFieldMission(
      record,
    );
  }

  async getAll() {
    const records =
      await db.getAll(
        db.stores.fieldMissions,
      );

    return records
      .map(
        normalizeFieldMission,
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

  async getActiveMission() {
    const missions =
      await this.getAll();

    return (
      missions.find(
        (mission) =>
          mission.status ===
          FIELD_MISSION_STATUS.ACTIVE,
      ) ||
      null
    );
  }

  async getVisibleMissions() {
    const missions =
      await this.getAll();

    return missions.filter(
      (mission) =>
        mission.visible !==
        false,
    );
  }

  async delete(
    missionId,
  ) {
    if (!missionId) {
      return;
    }

    await db.delete(
      db.stores.fieldMissions,
      missionId,
    );
  }

  async clear() {
    await db.clear(
      db.stores.fieldMissions,
    );
  }
}

export const FieldMissionRepository =
  new FieldMissionRepositoryImpl();