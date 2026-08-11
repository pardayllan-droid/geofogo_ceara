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

const ACTIVE_MISSION_SETTING_KEY =
  'field-active-mission';

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

  /**
   * Persiste a missão explicitamente selecionada para
   * receber novos registros.
   *
   * missionId = null é um valor válido e significa:
   * "Sem missão".
   *
   * Esse estado é independente de mission.status.
   */
  async saveActiveMissionId(
    missionId,
  ) {
    await db.put(
      db.stores.settings,
      {
        missionId:
          missionId ??
          null,

        /*
         * Permite distinguir:
         *
         * - configuração nunca criada;
         * - configuração criada explicitamente como null.
         */
        hasSelection:
          true,
      },
      ACTIVE_MISSION_SETTING_KEY,
    );
  }

  /**
   * Recupera a seleção persistida.
   *
   * Retorna:
   *
   * {
   *   exists: false,
   *   missionId: null
   * }
   *
   * quando a configuração nunca foi salva.
   *
   * Quando o operador escolheu explicitamente
   * "Sem missão", retorna exists=true e missionId=null.
   */
  async getActiveMissionSelection() {
    const record =
      await db.get(
        db.stores.settings,
        ACTIVE_MISSION_SETTING_KEY,
      );

    if (
      !record ||
      record?.data
        ?.hasSelection !==
        true
    ) {
      return {
        exists:
          false,

        missionId:
          null,
      };
    }

    return {
      exists:
        true,

      missionId:
        record.data
          .missionId ??
        null,
    };
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

    await this.saveActiveMissionId(
      null,
    );
  }
}

export const FieldMissionRepository =
  new FieldMissionRepositoryImpl();