/**
 * FieldMissionModel
 *
 * Representa uma missão operacional do módulo Campo.
 *
 * Uma missão funciona como um agrupador persistente de:
 * - trilhos;
 * - marcadores;
 * - fotografias;
 * - anexos futuros.
 *
 * Os registros continuam existindo separadamente.
 * A relação é feita por missionId.
 */

export const FIELD_MISSION_STATUS = {
  ACTIVE:
    'active',

  COMPLETED:
    'completed',

  ARCHIVED:
    'archived',
};

function createId(
  prefix,
) {
  if (
    typeof crypto !==
      'undefined' &&
    typeof crypto.randomUUID ===
      'function'
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return (
    `${prefix}-` +
    `${Date.now()}-` +
    `${Math.random()
      .toString(16)
      .slice(2)}`
  );
}

function normalizeText(
  value,
) {
  return String(
    value ??
    '',
  ).trim();
}

export function createFieldMission({
  name,
  description =
    '',

  status =
    FIELD_MISSION_STATUS.ACTIVE,

  visible =
    true,

  startedAt =
    Date.now(),
} = {}) {
  const normalizedName =
    normalizeText(
      name,
    );

  if (!normalizedName) {
    throw new Error(
      'Informe o nome da missão.',
    );
  }

  const now =
    Date.now();

  const normalizedStartedAt =
    Number.isFinite(
      Number(
        startedAt,
      ),
    )
      ? Number(
          startedAt,
        )
      : now;

  return {
    id:
      createId(
        'mission',
      ),

    name:
      normalizedName,

    description:
      normalizeText(
        description,
      ),

    status,

    /**
     * Controla a visibilidade geral da missão no mapa.
     *
     * Quando false, todos os registros vinculados ficam
     * ocultos, sem serem apagados.
     */
    visible:
      Boolean(
        visible,
      ),

    startedAt:
      normalizedStartedAt,

    endedAt:
      null,

    created_date:
      now,

    updated_date:
      now,
  };
}

export function normalizeFieldMission(
  mission,
) {
  if (!mission?.id) {
    return null;
  }

  const name =
    normalizeText(
      mission.name,
    );

  if (!name) {
    return null;
  }

  return {
    id:
      mission.id,

    name,

    description:
      normalizeText(
        mission.description,
      ),

    status:
      Object.values(
        FIELD_MISSION_STATUS,
      ).includes(
        mission.status,
      )
        ? mission.status
        : FIELD_MISSION_STATUS.ACTIVE,

    visible:
      mission.visible !==
      false,

    startedAt:
      Number(
        mission.startedAt ||
        mission.created_date ||
        Date.now(),
      ),

    endedAt:
      mission.endedAt
        ? Number(
            mission.endedAt,
          )
        : null,

    created_date:
      Number(
        mission.created_date ||
        Date.now(),
      ),

    updated_date:
      Number(
        mission.updated_date ||
        Date.now(),
      ),
  };
}

export function completeFieldMission(
  mission,
) {
  if (!mission) {
    return mission;
  }

  const now =
    Date.now();

  return {
    ...mission,

    status:
      FIELD_MISSION_STATUS.COMPLETED,

    endedAt:
      mission.endedAt ||
      now,

    updated_date:
      now,
  };
}

export function archiveFieldMission(
  mission,
) {
  if (!mission) {
    return mission;
  }

  return {
    ...mission,

    status:
      FIELD_MISSION_STATUS.ARCHIVED,

    visible:
      false,

    updated_date:
      Date.now(),
  };
}

export function setFieldMissionVisibility(
  mission,
  visible,
) {
  if (!mission) {
    return mission;
  }

  return {
    ...mission,

    visible:
      Boolean(
        visible,
      ),

    updated_date:
      Date.now(),
  };
}