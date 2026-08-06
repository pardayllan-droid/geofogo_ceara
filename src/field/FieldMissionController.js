/**
 * FieldMissionController
 *
 * Responsável pela gestão das Missões operacionais.
 *
 * Não conhece GPS, mapa, trilhos ou marcadores.
 * Apenas administra as missões e informa qual está ativa.
 */

import { FieldMissionRepository } from './FieldMissionRepository';
import {
  createFieldMission,
  completeFieldMission,
  archiveFieldMission,
  setFieldMissionVisibility,
} from './FieldMissionModel';

class FieldMissionControllerClass {
  constructor() {
    this.missions = [];
    this.activeMissionId = null;
    this.listeners = [];
    this.initialized = false;
    this.initializePromise = null;
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

        const active =
          this.missions.find(
            (mission) =>
              mission.status ===
              'active',
          );

        this.activeMissionId =
          active?.id ??
          null;

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
    this.listeners.push(listener);

    return () => {
      this.listeners =
        this.listeners.filter(
          (item) => item !== listener,
        );
    };
  }

  notify() {
    this.listeners.forEach((listener) =>
      listener(this.getState()),
    );
  }

  getState() {
    return {
      missions: this.missions,
      activeMissionId: this.activeMissionId,
      activeMission: this.getActiveMission(),
    };
  }

  getActiveMission() {
    return (
      this.missions.find(
        (mission) =>
          mission.id === this.activeMissionId,
      ) || null
    );
  }

  async createMission(data) {
    const mission =
      createFieldMission(data);

    await FieldMissionRepository.save(
      mission,
    );

    this.missions.unshift(mission);

    this.activeMissionId = mission.id;

    this.notify();

    return mission;
  }

  async setActiveMission(id) {
    if (
      !this.missions.some(
        (mission) => mission.id === id,
      )
    ) {
      return;
    }

    this.activeMissionId = id;

    this.notify();
  }

  async renameMission(id, values) {
    const index =
      this.missions.findIndex(
        (mission) => mission.id === id,
      );

    if (index < 0) {
      return null;
    }

    const updated = {
      ...this.missions[index],
      ...values,
      updated_date: Date.now(),
    };

    await FieldMissionRepository.save(
      updated,
    );

    this.missions[index] = updated;

    this.notify();

    return updated;
  }

  async completeMission(id) {
    const mission =
      this.missions.find(
        (item) => item.id === id,
      );

    if (!mission) {
      return;
    }

    const completed =
      completeFieldMission(mission);

    await FieldMissionRepository.save(
      completed,
    );

    this.missions =
      this.missions.map((item) =>
        item.id === id
          ? completed
          : item,
      );

    this.notify();
  }

  async archiveMission(id) {
    const mission =
      this.missions.find(
        (item) => item.id === id,
      );

    if (!mission) {
      return;
    }

    const archived =
      archiveFieldMission(mission);

    await FieldMissionRepository.save(
      archived,
    );

    this.missions =
      this.missions.map((item) =>
        item.id === id
          ? archived
          : item,
      );

    this.notify();
  }

  async toggleVisibility(id) {
    const mission =
      this.missions.find(
        (item) => item.id === id,
      );

    if (!mission) {
      return;
    }

    const updated =
      setFieldMissionVisibility(
        mission,
        !mission.visible,
      );

    await FieldMissionRepository.save(
      updated,
    );

    this.missions =
      this.missions.map((item) =>
        item.id === id
          ? updated
          : item,
      );

    this.notify();
  }

  async deleteMission(id) {
    await FieldMissionRepository.delete(id);

    this.missions =
      this.missions.filter(
        (mission) => mission.id !== id,
      );

    if (this.activeMissionId === id) {
      this.activeMissionId = null;
    }

    this.notify();
  }
}

export const FieldMissionController =
  new FieldMissionControllerClass();