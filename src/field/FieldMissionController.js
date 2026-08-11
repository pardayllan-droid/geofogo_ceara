/**
 * FieldMissionController
 *
 * Responsável pela gestão das Missões operacionais.
 *
 * Não conhece GPS, mapa, trilhos ou marcadores.
 * Apenas administra as missões e informa qual está ativa.
 */

import {
  FieldMissionRepository,
} from './FieldMissionRepository';

import {
  createFieldMission,
  completeFieldMission,
  archiveFieldMission,
  setFieldMissionVisibility,
} from './FieldMissionModel';

class FieldMissionControllerClass {
  constructor() {
    this.missions =
      [];

    this.activeMissionId =
      null;

    this.listeners =
      [];

    this.initialized =
      false;

    this.initializePromise =
      null;
  }

  async initialize() {
    if (
      this.initialized
    ) {
      return this.getState();
    }

    if (
      this.initializePromise
    ) {
      return this.initializePromise;
    }

    this.initializePromise =
      (async () => {
        this.missions =
          await FieldMissionRepository
            .getAll();

        const selection =
          await FieldMissionRepository
            .getActiveMissionSelection();

        if (
          selection.exists
        ) {
          /*
           * A seleção persistida é a fonte de verdade.
           *
           * null significa explicitamente "Sem missão".
           */
          if (
            selection.missionId ===
            null
          ) {
            this.activeMissionId =
              null;
          } else {
            const selectedMission =
              this.missions.find(
                (mission) =>
                  mission.id ===
                  selection.missionId,
              );

            /*
             * Missão removida ou registro inválido:
             * limpa a seleção em vez de escolher outra
             * missão automaticamente.
             */
            if (
              !selectedMission
            ) {
              this.activeMissionId =
                null;

              await FieldMissionRepository
                .saveActiveMissionId(
                  null,
                );
            } else {
              this.activeMissionId =
                selectedMission.id;
            }
          }
        } else {
          /*
           * Compatibilidade com instalações anteriores.
           *
           * Antes desta versão, a missão selecionada não
           * era persistida separadamente. No primeiro
           * carregamento após a atualização mantemos o
           * comportamento antigo uma única vez:
           *
           * - primeira missão com status active;
           * - ou Sem missão se não houver nenhuma.
           *
           * Em seguida persistimos a decisão para que os
           * próximos cold starts sejam determinísticos.
           */
          const legacyActive =
            this.missions.find(
              (mission) =>
                mission.status ===
                'active',
            );

          this.activeMissionId =
            legacyActive?.id ??
            null;

          await FieldMissionRepository
            .saveActiveMissionId(
              this.activeMissionId,
            );
        }

        this.initialized =
          true;

        this.notify();

        return this.getState();
      })();

    try {
      return await this.initializePromise;
    } finally {
      this.initializePromise =
        null;
    }
  }

  subscribe(listener) {
    this.listeners.push(
      listener,
    );

    return () => {
      this.listeners =
        this.listeners.filter(
          (item) =>
            item !==
            listener,
        );
    };
  }

  notify() {
    this.listeners.forEach(
      (listener) =>
        listener(
          this.getState(),
        ),
    );
  }

  getState() {
    return {
      missions:
        this.missions,

      activeMissionId:
        this.activeMissionId,

      activeMission:
        this.getActiveMission(),
    };
  }

  getActiveMission() {
    return (
      this.missions.find(
        (mission) =>
          mission.id ===
          this.activeMissionId,
      ) ||
      null
    );
  }

  async createMission(data) {
    const mission =
      createFieldMission(
        data,
      );

    await FieldMissionRepository
      .save(
        mission,
      );

    this.missions.unshift(
      mission,
    );

    this.activeMissionId =
      mission.id;

    await FieldMissionRepository
      .saveActiveMissionId(
        mission.id,
      );

    this.notify();

    return mission;
  }

  async setActiveMission(id) {
    const mission =
      this.missions.find(
        (candidate) =>
          candidate.id ===
          id,
      );

    if (!mission) {
      return;
    }

    this.activeMissionId =
      mission.id;

    await FieldMissionRepository
      .saveActiveMissionId(
        mission.id,
      );

    this.notify();
  }

  /**
   * Remove a missão ativa sem excluir, concluir ou
   * arquivar nenhuma missão.
   *
   * A partir desse momento, novos trilhos e marcadores
   * serão criados com missionId = null.
   *
   * A escolha "Sem missão" também é persistida.
   */
  async clearActiveMission() {
    this.activeMissionId =
      null;

    await FieldMissionRepository
      .saveActiveMissionId(
        null,
      );

    this.notify();

    return this.getState();
  }

  async renameMission(
    id,
    values,
  ) {
    const index =
      this.missions.findIndex(
        (mission) =>
          mission.id === id,
      );

    if (index < 0) {
      return null;
    }

    const updated = {
      ...this.missions[index],
      ...values,
      updated_date:
        Date.now(),
    };

    await FieldMissionRepository
      .save(
        updated,
      );

    this.missions[index] =
      updated;

    this.notify();

    return updated;
  }

  async completeMission(id) {
    const mission =
      this.missions.find(
        (item) =>
          item.id === id,
      );

    if (!mission) {
      return;
    }

    const completed =
      completeFieldMission(
        mission,
      );

    await FieldMissionRepository
      .save(
        completed,
      );

    this.missions =
      this.missions.map(
        (item) =>
          item.id === id
            ? completed
            : item,
      );

    /*
     * Uma missão concluída deixa de receber novos
     * registros.
     */
    if (
      this.activeMissionId ===
      id
    ) {
      this.activeMissionId =
        null;

      await FieldMissionRepository
        .saveActiveMissionId(
          null,
        );
    }

    this.notify();
  }

  async archiveMission(id) {
    const mission =
      this.missions.find(
        (item) =>
          item.id === id,
      );

    if (!mission) {
      return;
    }

    const archived =
      archiveFieldMission(
        mission,
      );

    await FieldMissionRepository
      .save(
        archived,
      );

    this.missions =
      this.missions.map(
        (item) =>
          item.id === id
            ? archived
            : item,
      );

    /*
     * Uma missão arquivada não pode continuar como
     * destino de novos registros.
     */
    if (
      this.activeMissionId ===
      id
    ) {
      this.activeMissionId =
        null;

      await FieldMissionRepository
        .saveActiveMissionId(
          null,
        );
    }

    this.notify();
  }

  /**
   * Informa se um registro associado a uma missão deve
   * aparecer no mapa.
   *
   * Regras:
   * - missionId null → registro avulso → visível;
   * - missão existente → respeita mission.visible;
   * - missão inexistente → registro órfão → permanece
   *   visível para não esconder dados antigos.
   */
  isRecordVisible(
    missionId,
  ) {
    if (!missionId) {
      return true;
    }

    const mission =
      this.missions.find(
        (candidate) =>
          candidate.id ===
          missionId,
      );

    if (!mission) {
      return true;
    }

    return (
      mission.visible !==
      false
    );
  }

  async toggleVisibility(id) {
    const mission =
      this.missions.find(
        (item) =>
          item.id === id,
      );

    if (!mission) {
      return;
    }

    const updated =
      setFieldMissionVisibility(
        mission,
        !mission.visible,
      );

    await FieldMissionRepository
      .save(
        updated,
      );

    this.missions =
      this.missions.map(
        (item) =>
          item.id === id
            ? updated
            : item,
      );

    this.notify();
  }

  async deleteMission(id) {
    await FieldMissionRepository
      .delete(
        id,
      );

    this.missions =
      this.missions.filter(
        (mission) =>
          mission.id !==
          id,
      );

    if (
      this.activeMissionId ===
      id
    ) {
      this.activeMissionId =
        null;

      await FieldMissionRepository
        .saveActiveMissionId(
          null,
        );
    }

    this.notify();
  }
}

export const FieldMissionController =
  new FieldMissionControllerClass();