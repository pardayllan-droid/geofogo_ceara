/**
 * FieldController
 *
 * Controla as funcionalidades de campo:
 * - ativação do GPS;
 * - posição atual;
 * - criação, pausa, retomada e conclusão de trilhos;
 * - salvamento progressivo;
 * - recuperação de trilho interrompido;
 * - pontos independentes ou vinculados a trilhos;
 * - exportação GeoJSON e GPX.
 *
 * A implementação não acessa diretamente
 * navigator.geolocation. O acesso ao GPS é feito por
 * meio de um LocationProvider.
 *
 * No futuro:
 * - WebGeolocationProvider na Web/PWA;
 * - AndroidBackgroundLocationProvider no APK.
 */

import * as turf from '@turf/turf';

import {
  EventBus,
  EVENTS,
} from '../core/EventBus';

import {
  ErrorManager,
} from '../core/ErrorManager';

import {
  createTrail,
  completeTrail,
  normalizeTrail,
  pauseTrail,
  resumeTrail,
  TRAIL_STATUS,
} from './TrailModel';

import {
  TrailRepository,
} from './TrailRepository';

import {
  createFieldPoint,
  FIELD_POINT_CATEGORY,
  FIELD_POINT_ORIGIN,
} from './FieldPointModel';

import {
  FieldPointRepository,
} from './FieldPointRepository';

import {
  WebGeolocationProvider,
} from './location/WebGeolocationProvider';

import { FieldMissionController } from './FieldMissionController';

const EMPTY_FEATURE_COLLECTION = {
  type:
    'FeatureCollection',

  features:
    [],
};

/**
 * Qualidade mínima padrão aceita para registrar
 * uma amostra no trilho.
 *
 * Posições com precisão pior continuam sendo mostradas
 * como posição atual, mas não entram no trilho.
 */
const MAX_TRAIL_ACCURACY_METERS =
  50;

/**
 * Evita acumular vários pontos praticamente idênticos
 * em um intervalo muito curto.
 */
const MIN_SAMPLE_DISTANCE_METERS =
  2;

const MAX_STATIONARY_INTERVAL_MS =
  10_000;

/**
 * Limite conservador para rejeitar saltos evidentemente
 * incompatíveis com uma operação terrestre.
 *
 * 60 m/s equivale a 216 km/h.
 */
const MAX_PLAUSIBLE_SPEED_MPS =
  60;

const MOVING_SPEED_THRESHOLD_MPS =
  0.5;

function numericOrNull(
  value,
) {
  const numeric =
    Number(
      value,
    );

  return Number.isFinite(
    numeric,
  )
    ? numeric
    : null;
}

function escapeXml(
  value,
) {
  return String(
    value ??
    '',
  )
    .replaceAll(
      '&',
      '&amp;',
    )
    .replaceAll(
      '<',
      '&lt;',
    )
    .replaceAll(
      '>',
      '&gt;',
    )
    .replaceAll(
      '"',
      '&quot;',
    )
    .replaceAll(
      "'",
      '&apos;',
    );
}

function cloneData(
  value,
) {
  if (
    typeof structuredClone ===
    'function'
  ) {
    return structuredClone(
      value,
    );
  }

  return JSON.parse(
    JSON.stringify(
      value,
    ),
  );
}

function normalizeWebPosition(
  position,
) {
  const coords =
    position?.coords;

  const latitude =
    numericOrNull(
      coords?.latitude,
    );

  const longitude =
    numericOrNull(
      coords?.longitude,
    );

  if (
    latitude ===
      null ||
    longitude ===
      null
  ) {
    return null;
  }

  const timestamp =
    numericOrNull(
      position?.timestamp,
    ) ||
    Date.now();

  return turf.point(
    [
      longitude,
      latitude,
    ],
    {
      accuracy:
        numericOrNull(
          coords?.accuracy,
        ),

      altitude:
        numericOrNull(
          coords?.altitude,
        ),

      altitudeAccuracy:
        numericOrNull(
          coords?.altitudeAccuracy,
        ),

      heading:
        numericOrNull(
          coords?.heading,
        ),

      speed:
        Math.max(
          0,
          numericOrNull(
            coords?.speed,
          ) ||
          0,
        ),

      timestamp,
    },
  );
}

function calculateDistanceMeters(
  firstPoint,
  secondPoint,
) {
  try {
    return turf.distance(
      firstPoint,
      secondPoint,
      {
        units:
          'meters',
      },
    );
  } catch {
    return 0;
  }
}

function calculateDurationMs(
  trail,
) {
  if (!trail?.startedAt) {
    return 0;
  }

  const end =
    trail.endedAt ||
    Date.now();

  let paused =
    trail.totalPausedMs ||
    0;

  if (
    trail.status ===
      TRAIL_STATUS.PAUSED &&
    trail.pausedAt
  ) {
    paused +=
      Math.max(
        0,
        Date.now() -
          trail.pausedAt,
      );
  }

  return Math.max(
    0,
    end -
      trail.startedAt -
      paused,
  );
}

class FieldControllerImpl {
  constructor() {
    this.active =
      false;

    this.recording =
      false;

    this.currentPosition =
      null;

    this.currentTrail =
      null;

    /**
     * Todos os trilhos persistentes carregados.
     *
     * currentTrail continua representando somente o trilho
     * atualmente selecionado/em gravação.
     */
    this.trails =
      [];

    /**
     * Mantido por compatibilidade com a interface e
     * as camadas existentes.
     */
    this.trail =
      [];

    /**
     * Pontos carregados nesta sessão do Modo Campo.
     */
    this.points =
      [];

    this.locationProvider =
      new WebGeolocationProvider();

    this.permissionStatus =
      'unavailable';

    this.locationError =
      null;

    /**
     * Controla se o mapa deve acompanhar automaticamente
     * a posição atual.
     *
     * Desligado por padrão para permitir que o operador
     * explore o mapa sem ser reposicionado pelo GPS.
     */
    this.followPosition =
      false;

    this._listeners =
      [];

    this._persistenceQueue =
      Promise.resolve();

    this._starting =
      false;
  }

  /**
   * Permite substituir o provedor sem alterar o restante
   * da aplicação.
   *
   * No APK será usado para instalar o provedor Android.
   */
  setLocationProvider(
    provider,
  ) {
    if (
      !provider ||
      typeof provider.start !==
        'function' ||
      typeof provider.stop !==
        'function'
    ) {
      throw new Error(
        'O provedor de localização informado é inválido.',
      );
    }

    if (this.active) {
      throw new Error(
        'Não é possível trocar o provedor enquanto o Modo Campo está ativo.',
      );
    }

    this.locationProvider =
      provider;
  }

  async start() {
    if (
      this.active ||
      this._starting
    ) {
      return;
    }

    this._starting =
      true;

    try {
      /**
       * Carrega as missões antes de recuperar trilhos,
       * marcadores e iniciar o GPS.
       */
      await FieldMissionController.initialize();

      this.permissionStatus =
        await this.locationProvider
          .getPermissionStatus();

      if (
        this.permissionStatus ===
        'denied'
      ) {
        throw new Error(
          'Permissão de localização negada.',
        );
      }

      /**
       * Carrega todo o histórico para permitir a exibição de
       * várias missões simultaneamente.
       */
      this.trails =
        await TrailRepository
          .getAll();

      /**
       * Recupera um trilho deixado aberto por:
       * - fechamento inesperado;
       * - suspensão;
       * - recarga da aplicação;
       * - encerramento do processo pelo sistema.
       */
      const storedTrail =
        await TrailRepository
          .getCurrentOrLatestTrail();

      if (storedTrail) {
        this.currentTrail =
          normalizeTrail(
            storedTrail,
          );

        this.trail =
          Array.isArray(
            this.currentTrail
              .samples,
          )
            ? [
                ...this.currentTrail
                  .samples,
              ]
            : [];

        /**
         * Trilhos concluídos continuam carregados e visíveis,
         * mas não retomam automaticamente a gravação.
         */
        this.recording =
          this.currentTrail
            .status ===
          TRAIL_STATUS.ACTIVE;
      } else {
        this.currentTrail =
          null;

        this.trail =
          [];

        this.recording =
          false;
      }

      /**
       * Carrega os pontos persistentes para exibição
       * e exportação.
       */
      this.points =
        await FieldPointRepository
          .getAll();

      this.active =
        true;

      this.locationError =
        null;

      await this.locationProvider.start({
        onPosition:
          (position) => {
            this._onPosition(
              position,
            );
          },

        onError:
          (error) => {
            this.locationError =
              error?.message ||
              'Falha ao obter localização.';

            ErrorManager.report(
              'field',
              error,
              {
                operation:
                  'locationProvider.onError',

                provider:
                  this.locationProvider
                    .getProviderName?.() ||
                  'unknown',
              },
            );

            this._notify();
          },
      });

      EventBus.emit(
        EVENTS.FIELD_MODE_STARTED,
        {
          provider:
            this.locationProvider
              .getProviderName?.() ||
            'unknown',

          recoveredTrailId:
            storedTrail?.id ||
            null,
        },
      );

      this._notify();
    } catch (error) {
      this.active =
        false;

      this.recording =
        false;

      this.locationError =
        error?.message ||
        'Falha ao iniciar o Modo Campo.';

      throw error;
    } finally {
      this._starting =
        false;
    }
  }

  /**
   * Encerra o Modo Campo.
   *
   * Se houver um trilho em andamento, ele é concluído.
   */
  async stop() {
    if (!this.active) {
      return;
    }

    const trailToSave =
      this.currentTrail
        ? {
            ...this.currentTrail,

            /**
             * Ao encerrar o Campo, preservamos o estado.
             *
             * - active permanece active e poderá ser recuperado;
             * - paused permanece paused;
             * - completed permanece completed.
             */
            updated_date:
              Date.now(),
          }
        : null;

    if (trailToSave) {
      this.currentTrail =
        trailToSave;

      this.recording =
        false;

      this._queueTrailSave(
        trailToSave,
      );
    }

    this.active =
      false;

    this.recording =
      false;

    this.currentPosition =
      null;

    await this.locationProvider
      .stop();

    await this.flushPersistence();

    EventBus.emit(
      EVENTS.FIELD_MODE_STOPPED,
      {
        trailId:
          trailToSave?.id ||
          null,
      },
    );

    this._notify();
  }

  /**
   * Inicia um novo trilho ou retoma um trilho pausado.
   *
   * Mantém o nome startRecording por compatibilidade
   * temporária com o hook e o painel atuais.
   */
  startRecording({
    name =
      null,

    missionId =
      undefined,

    navigationTargetId =
      null,

    style =
      null,
  } = {}) {
    if (!this.active) {
      throw new Error(
        'Ative o Modo Campo antes de iniciar um trilho.',
      );
    }

    if (
      this.currentTrail
        ?.status ===
      TRAIL_STATUS.PAUSED
    ) {
      this.currentTrail =
        resumeTrail(
          this.currentTrail,
        );
    } else if (
      !this.currentTrail ||
      this.currentTrail
        .status ===
        TRAIL_STATUS.COMPLETED ||
      this.currentTrail
        .status ===
        TRAIL_STATUS.INTERRUPTED
    ) {
      const resolvedMissionId =
        missionId ===
          undefined
          ? FieldMissionController
              .getActiveMission()
              ?.id ||
            null
          : missionId;
      this.currentTrail =
        createTrail({
          name,

          missionId:
            resolvedMissionId,

          navigationTargetId,

          style,
        });

      this.trail =
        [];
    }

    this.recording =
      true;

    this.currentTrail.status =
      TRAIL_STATUS.ACTIVE;

    this._queueTrailSave(
      this.currentTrail,
    );

    this._notify();

    return this.currentTrail;
  }

  pauseRecording() {
    if (
      !this.currentTrail ||
      !this.recording
    ) {
      return;
    }

    this.currentTrail =
      pauseTrail(
        this.currentTrail,
      );

    this.recording =
      false;

    this._queueTrailSave(
      this.currentTrail,
    );

    this._notify();
  }

  /**
   * Finaliza apenas o trilho, mantendo o GPS e o
   * Modo Campo ativos.
   */
  async stopRecording() {
    if (!this.currentTrail) {
      return null;
    }

    this.currentTrail =
      completeTrail(
        this.currentTrail,
      );

    this.recording =
      false;

    this._queueTrailSave(
      this.currentTrail,
    );

    await this.flushPersistence();

    this._notify();

    return this.currentTrail;
  }

    _onPosition(
    rawPosition,
  ) {
    const point =
      normalizeWebPosition(
        rawPosition,
      );

    if (!point) {
      return;
    }

    /**
     * A posição atual sempre é atualizada, mesmo quando
     * a precisão ainda não é suficiente para o trilho.
     */
    this.currentPosition =
      point;

    this.permissionStatus =
      'granted';

    this.locationError =
      null;

    if (
      this.recording &&
      this.currentTrail
    ) {
      this._appendTrailSample(
        point,
      );
    }

    this._notify();
  }

  _appendTrailSample(
    point,
  ) {
    if (
      !this._shouldAcceptTrailSample(
        point,
      )
    ) {
      return false;
    }

    const previousPoint =
      this.trail.length >
        0
        ? this.trail[
            this.trail.length -
              1
          ]
        : null;

    const segmentDistance =
      previousPoint
        ? calculateDistanceMeters(
            previousPoint,
            point,
          )
        : 0;

    const currentTimestamp =
      point.properties
        ?.timestamp ||
      Date.now();

    const previousTimestamp =
      previousPoint
        ?.properties
        ?.timestamp ||
      currentTimestamp;

    const elapsedMs =
      Math.max(
        0,
        currentTimestamp -
          previousTimestamp,
      );

    const elapsedSeconds =
      elapsedMs /
      1000;

    const calculatedSpeed =
      elapsedSeconds >
        0
        ? segmentDistance /
          elapsedSeconds
        : 0;

    const reportedSpeed =
      Math.max(
        0,
        numericOrNull(
          point.properties
            ?.speed,
        ) ||
        0,
      );

    const effectiveSpeed =
      reportedSpeed >
        0
        ? reportedSpeed
        : calculatedSpeed;

    point.properties.speed =
      effectiveSpeed;

    this.trail.push(
      point,
    );

    const previousSampleCount =
      this.currentTrail
        .sampleCount ||
      0;

    const nextSampleCount =
      previousSampleCount +
      1;

    const previousAccuracyAverage =
      numericOrNull(
        this.currentTrail
          .averageAccuracyMeters,
      );

    const currentAccuracy =
      numericOrNull(
        point.properties
          ?.accuracy,
      );

    let averageAccuracyMeters =
      previousAccuracyAverage;

    if (
      currentAccuracy !==
      null
    ) {
      averageAccuracyMeters =
        previousAccuracyAverage ===
          null
          ? currentAccuracy
          : (
              previousAccuracyAverage *
                previousSampleCount +
              currentAccuracy
            ) /
            nextSampleCount;
    }

    const altitude =
      numericOrNull(
        point.properties
          ?.altitude,
      );

    const previousAltitudeAverage =
      numericOrNull(
        this.currentTrail
          .averageAltitudeMeters,
      );

    const previousAltitudeCount =
      this.currentTrail
        .altitudeSampleCount ||
      0;

    const nextAltitudeCount =
      altitude ===
        null
        ? previousAltitudeCount
        : previousAltitudeCount +
          1;

    let averageAltitudeMeters =
      previousAltitudeAverage;

    if (
      altitude !==
      null
    ) {
      averageAltitudeMeters =
        previousAltitudeAverage ===
          null
          ? altitude
          : (
              previousAltitudeAverage *
                previousAltitudeCount +
              altitude
            ) /
            nextAltitudeCount;
    }

    const moving =
      effectiveSpeed >=
      MOVING_SPEED_THRESHOLD_MPS;

    const nextDistance =
      (
        this.currentTrail
          .distanceMeters ||
        0
      ) +
      segmentDistance;

    const movingTimeMs =
      (
        this.currentTrail
          .movingTimeMs ||
        0
      ) +
      (
        moving
          ? elapsedMs
          : 0
      );

    const stoppedTimeMs =
      (
        this.currentTrail
          .stoppedTimeMs ||
        0
      ) +
      (
        moving
          ? 0
          : elapsedMs
      );

    this.currentTrail = {
      ...this.currentTrail,

      samples: [
        ...this.trail,
      ],

      distanceMeters:
        nextDistance,

      currentSpeedMps:
        effectiveSpeed,

      averageSpeedMps:
        movingTimeMs >
          0
          ? nextDistance /
            (
              movingTimeMs /
              1000
            )
          : 0,

      maximumSpeedMps:
        Math.max(
          this.currentTrail
            .maximumSpeedMps ||
            0,

          effectiveSpeed,
        ),

      movingTimeMs,

      stoppedTimeMs,

      minimumAltitudeMeters:
        altitude ===
          null
          ? this.currentTrail
              .minimumAltitudeMeters
          : this.currentTrail
                .minimumAltitudeMeters ===
              null
            ? altitude
            : Math.min(
                this.currentTrail
                  .minimumAltitudeMeters,
                altitude,
              ),

      averageAltitudeMeters,

      maximumAltitudeMeters:
        altitude ===
          null
          ? this.currentTrail
              .maximumAltitudeMeters
          : this.currentTrail
                .maximumAltitudeMeters ===
              null
            ? altitude
            : Math.max(
                this.currentTrail
                  .maximumAltitudeMeters,
                altitude,
              ),

      altitudeSampleCount:
        nextAltitudeCount,

      averageAccuracyMeters,

      sampleCount:
        nextSampleCount,

      updated_date:
        Date.now(),
    };

    /**
     * Cada amostra válida é persistida. A fila garante
     * que as gravações não se sobreponham.
     */
    this._queueTrailSave(
      this.currentTrail,
    );

    return true;
  }

  _shouldAcceptTrailSample(
    point,
  ) {
    const accuracy =
      numericOrNull(
        point?.properties
          ?.accuracy,
      );

    if (
      accuracy !==
        null &&
      accuracy >
        MAX_TRAIL_ACCURACY_METERS
    ) {
      return false;
    }

    if (
      this.trail.length ===
      0
    ) {
      return true;
    }

    const previousPoint =
      this.trail[
        this.trail.length -
          1
      ];

    const distance =
      calculateDistanceMeters(
        previousPoint,
        point,
      );

    const currentTimestamp =
      point.properties
        ?.timestamp ||
      Date.now();

    const previousTimestamp =
      previousPoint.properties
        ?.timestamp ||
      currentTimestamp;

    const elapsedMs =
      Math.max(
        1,
        currentTimestamp -
          previousTimestamp,
      );

    const calculatedSpeed =
      distance /
      (
        elapsedMs /
        1000
      );

    if (
      calculatedSpeed >
      MAX_PLAUSIBLE_SPEED_MPS
    ) {
      return false;
    }

    if (
      distance <
        MIN_SAMPLE_DISTANCE_METERS &&
      elapsedMs <
        MAX_STATIONARY_INTERVAL_MS
    ) {
      return false;
    }

    return true;
  }

  /**
   * Cria um ponto utilizando a posição atual.
   *
   * Assinatura compatível com o painel existente:
   *
   * addPoint(label, observation)
   *
   * O terceiro parâmetro já permite escolher:
   * - categoria;
   * - status;
   * - vínculo opcional ao trilho.
   */
  addPoint(
    label =
      '',

    observation =
      '',

    {
      category =
        FIELD_POINT_CATEGORY.OBSERVATION,

      style =
        null,

      status =
        'new',

      missionId =
        undefined,

      linkToActiveTrail =
        true,
    } = {},
  ) {
    if (!this.currentPosition) {
      throw new Error(
        'A posição atual ainda não está disponível.',
      );
    }

    const [
      longitude,
      latitude,
    ] =
      this.currentPosition
        .geometry
        .coordinates;

    const trailId =
      linkToActiveTrail
        ? this.currentTrail
            ?.id ||
          null
        : null;

    const resolvedMissionId =
      missionId ===
        undefined
        ? FieldMissionController
            .getActiveMission()
            ?.id ||
          null
        : missionId;

    const point =
      createFieldPoint({
        longitude,
        latitude,

        altitude:
          this.currentPosition
            .properties
            ?.altitude,

        accuracy:
          this.currentPosition
            .properties
            ?.accuracy,

        altitudeAccuracy:
          this.currentPosition
            .properties
            ?.altitudeAccuracy,

        heading:
          this.currentPosition
            .properties
            ?.heading,

        label,
        observation,
        category,
        style,
        status,

        origin:
          FIELD_POINT_ORIGIN.CURRENT_POSITION,

        missionId:
          resolvedMissionId,
        trailId,
      });

    this._registerPoint(
      point,
    );

    return point;
  }

  /**
   * Cria um ponto em qualquer coordenada, sem depender
   * da posição atual do usuário.
   *
   * Esta função será utilizada pela interface de entrada:
   * - graus decimais;
   * - GMS;
   * - graus e minutos decimais;
   * - UTM;
   * - futuramente MGRS.
   */
  addPointAtCoordinates({
    longitude,
    latitude,
    altitude =
      null,

    label =
      '',

    observation =
      '',

    category =
      FIELD_POINT_CATEGORY.OBSERVATION,

    style =
      null,

    status =
      'new',

    missionId =
      undefined,

    originalCoordinateFormat =
      'decimal-degrees',

    trailId =
      null,
  } = {}) {
    const resolvedMissionId =
      missionId ===
        undefined
        ? FieldMissionController
            .getActiveMission()
            ?.id ||
          null
        : missionId;

    const point =
      createFieldPoint({
        longitude,
        latitude,
        altitude,
        label,
        observation,
        category,
        style,
        status,

        origin:
          FIELD_POINT_ORIGIN.MANUAL_COORDINATE,

        missionId:
          resolvedMissionId,

        originalCoordinateFormat,

        /**
         * O vínculo só ocorre quando explicitamente
         * informado.
         */
        trailId,
      });

    this._registerPoint(
      point,
    );

    return point;
  }

  _registerPoint(
    point,
  ) {
    this.points = [
      point,
      ...this.points.filter(
        (existingPoint) =>
          existingPoint.id !==
          point.id,
      ),
    ];

    if (
      this.currentTrail &&
      point.trailId ===
        this.currentTrail.id
    ) {
      this.currentTrail = {
        ...this.currentTrail,

        pointCount:
          (
            this.currentTrail
              .pointCount ||
            0
          ) +
          1,

        updated_date:
          Date.now(),
      };

      this._queueTrailSave(
        this.currentTrail,
      );
    }

    this._queuePointSave(
      point,
    );

    this._notify();
  }

  /**
   * Ativa ou desativa o acompanhamento automático da
   * posição atual pelo mapa.
   *
   * A coleta GPS e a gravação do trilho continuam
   * funcionando mesmo quando esta opção está desligada.
   */
  setFollowPosition(
    enabled,
  ) {
    this.followPosition =
      Boolean(
        enabled,
      );

    this._notify();

    return this.followPosition;
  }

  getDuration() {
    return calculateDurationMs(
      this.currentTrail,
    );
  }

  getSpeed() {
    return (
      this.currentPosition
        ?.properties
        ?.speed ||
      0
    );
  }

  getTrailGeoJSON() {
    if (
      this.trail.length <
      2
    ) {
      return {
        ...EMPTY_FEATURE_COLLECTION,
      };
    }

    const line =
      turf.lineString(
        this.trail.map(
          (point) =>
            point.geometry
              .coordinates,
        ),
        {
          trailId:
            this.currentTrail
              ?.id ||
            null,

          missionId:
            this.currentTrail
              ?.missionId ||
            null,

          name:
            this.currentTrail
              ?.name ||
            'Trilho GeoFogo',

          status:
            this.currentTrail
              ?.status ||
            null,

          style:
            this.currentTrail
              ?.style ||
            null,

          distanceMeters:
            this.currentTrail
              ?.distanceMeters ||
            0,

          startedAt:
            this.currentTrail
              ?.startedAt ||
            null,

          endedAt:
            this.currentTrail
              ?.endedAt ||
            null,
        },
      );

    line.id =
      this.currentTrail
        ?.id ||
      undefined;

    return {
      type:
        'FeatureCollection',

      features: [
        line,
      ],
    };
  }

  /**
   * Retorna os registros associados a uma missão.
   *
   * Usado pelo gestor de Missões.
   */
  getMissionRecords(
    missionId,
  ) {
    if (!missionId) {
      return {
        trails: [],
        points: [],
      };
    }

    const trails =
      this.trails.filter(
        (trail) =>
          (
            trail.missionId ??
            null
          ) ===
          missionId,
      );

    const points =
      this.points.filter(
        (point) =>
          (
            point.missionId ??
            point.properties
              ?.missionId ??
            null
          ) ===
          missionId,
      );

    return {
      trails:
        trails.map(
          (trail) =>
            cloneData(
              trail,
            ),
        ),

      points:
        points.map(
          (point) =>
            cloneData(
              point,
            ),
        ),
    };
  }

  getUnassignedRecords() {
    const trails =
      this.trails.filter(
        (trail) =>
          !trail.missionId,
      );

    const points =
      this.points.filter(
        (point) =>
          !(
            point.missionId ??
            point.properties
              ?.missionId
          ),
      );

    return {
      trails:
        trails.map(
          (trail) =>
            cloneData(
              trail,
            ),
        ),

      points:
        points.map(
          (point) =>
            cloneData(
              point,
            ),
        ),
    };
  }

  /**
   * Retorna todos os trilhos que devem ser exibidos no mapa.
   *
   * A visibilidade da missão é aplicada aqui, antes dos
   * dados chegarem ao MapLibre.
   */
  getVisibleTrailsGeoJSON() {
    const features =
      [];

    for (
      const trail
      of this.trails
    ) {
      if (
        !trail ||
        !Array.isArray(
          trail.samples,
        ) ||
        trail.samples.length <
          2
      ) {
        continue;
      }

      if (
        !FieldMissionController
          .isRecordVisible(
            trail.missionId,
          )
      ) {
        continue;
      }

      const coordinates =
        trail.samples
          .map(
            (point) =>
              point?.geometry?.coordinates,
          )
          .filter(
            (coordinates) =>
              Array.isArray(
                coordinates,
              ) &&
              coordinates.length >=
                2,
          );

      if (
        coordinates.length <
          2
      ) {
        continue;
      }

      const line =
        turf.lineString(
          coordinates,
          {
            trailId:
              trail.id,

            missionId:
              trail.missionId ||
              null,

            name:
              trail.name ||
              'Trilho GeoFogo',

            status:
              trail.status ||
              null,

            style:
              trail.style ||
              null,

            distanceMeters:
              trail.distanceMeters ||
              0,

            startedAt:
              trail.startedAt ||
              null,

            endedAt:
              trail.endedAt ||
              null,
          },
        );

      line.id =
        trail.id;

      features.push(
        line,
      );
    }

    return {
      type:
        'FeatureCollection',

      features,
    };
  }

  /**
   * Por padrão retorna todos os pontos carregados.
   *
   * trailId:
   * - undefined: todos;
   * - null: somente independentes;
   * - string: somente pontos daquele trilho.
   */
  getPointsGeoJSON({
    trailId =
      undefined,
  } = {}) {
    const filteredPoints =
      trailId ===
        undefined
        ? this.points
        : this.points.filter(
            (point) =>
              (
                point.trailId ??
                point.properties
                  ?.trailId ??
                null
              ) ===
              trailId,
          );

    return {
      type:
        'FeatureCollection',

      features:
        filteredPoints.map(
          (point) =>
            cloneData(
              point,
            ),
        ),
    };
  }

  getVisiblePointsGeoJSON() {
    return {
      type:
        'FeatureCollection',

      features:
        this.points
          .filter(
            (point) => {
              const visible =
                (
                  point.visible ??
                  point.properties
                    ?.visible
                ) !==
                false;

              if (!visible) {
                return false;
              }

              const missionId =
                point.missionId ??
                point.properties
                  ?.missionId ??
                null;

              return (
                FieldMissionController
                  .isRecordVisible(
                    missionId,
                  )
              );
            },
          )
          .map(
            (point) =>
              cloneData(
                point,
              ),
          ),
    };
  }

  getPositionGeoJSON() {
    if (!this.currentPosition) {
      return {
        ...EMPTY_FEATURE_COLLECTION,
      };
    }

    return {
      type:
        'FeatureCollection',

      features: [
        this.currentPosition,
      ],
    };
  }

  exportGeoJSON({
    includeTrail =
      true,

    includePoints =
      true,

    pointTrailId =
      undefined,
  } = {}) {
    const features =
      [];

    if (includeTrail) {
      features.push(
        ...this.getTrailGeoJSON()
          .features,
      );
    }

    if (includePoints) {
      features.push(
        ...this.getPointsGeoJSON({
          trailId:
            pointTrailId,
        }).features,
      );
    }

    return JSON.stringify(
      {
        type:
          'FeatureCollection',

        features,
      },
      null,
      2,
    );
  }

  exportPointGeoJSON(
    pointId,
  ) {
    const point =
      this.points.find(
        (candidate) =>
          candidate.id ===
          pointId,
      );

    if (!point) {
      throw new Error(
        'Ponto de campo não encontrado.',
      );
    }

    return JSON.stringify(
      {
        type:
          'FeatureCollection',

        features: [
          point,
        ],
      },
      null,
      2,
    );
  }

  exportGPX({
    includeTrail =
      true,

    includePoints =
      true,

    pointTrailId =
      undefined,
  } = {}) {
    let gpx =
      '<?xml version="1.0" encoding="UTF-8"?>\n';

    gpx +=
      '<gpx version="1.1" creator="GeoFogo Ceará" xmlns="http://www.topografix.com/GPX/1/1">\n';

    if (
      includeTrail &&
      this.trail.length >
        0
    ) {
      gpx +=
        '<trk>';

      gpx +=
        `<name>${escapeXml(
          this.currentTrail
            ?.name ||
          'Trilho GeoFogo',
        )}</name>`;

      gpx +=
        '<trkseg>\n';

      for (
        const point
        of this.trail
      ) {
        const [
          longitude,
          latitude,
        ] =
          point.geometry
            .coordinates;

        const altitude =
          numericOrNull(
            point.properties
              ?.altitude,
          );

        const timestamp =
          point.properties
            ?.timestamp ||
          Date.now();

        gpx +=
          `<trkpt lat="${latitude}" lon="${longitude}">`;

        if (
          altitude !==
          null
        ) {
          gpx +=
            `<ele>${altitude}</ele>`;
        }

        gpx +=
          `<time>${new Date(
            timestamp,
          ).toISOString()}</time>`;

        gpx +=
          '</trkpt>\n';
      }

      gpx +=
        '</trkseg></trk>\n';
    }

    if (includePoints) {
      const points =
        this.getPointsGeoJSON({
          trailId:
            pointTrailId,
        }).features;

      for (
        const point
        of points
      ) {
        const [
          longitude,
          latitude,
        ] =
          point.geometry
            .coordinates;

        gpx +=
          `<wpt lat="${latitude}" lon="${longitude}">`;

        gpx +=
          `<name>${escapeXml(
            point.properties
              ?.label ||
            'Ponto',
          )}</name>`;

        if (
          point.properties
            ?.observation
        ) {
          gpx +=
            `<desc>${escapeXml(
              point.properties
                .observation,
            )}</desc>`;
        }

        gpx +=
          '</wpt>\n';
      }
    }

    gpx +=
      '</gpx>';

    return gpx;
  }

  /**
   * Altera a visibilidade individual de um trilho.
   */
  async setTrailVisibility(
    trailId,
    visible,
  ) {
    const trail =
      this.trails.find(
        (candidate) =>
          candidate.id ===
          trailId,
      );

    if (!trail) {
      throw new Error(
        'Trilho não encontrado.',
      );
    }

    const updatedTrail = {
      ...trail,

      visible:
        Boolean(
          visible,
        ),

      updated_date:
        Date.now(),
    };

    this._updateTrailCollection(
      updatedTrail,
    );

    if (
      this.currentTrail
        ?.id ===
      trailId
    ) {
      this.currentTrail =
        updatedTrail;
    }

    this._queueTrailSave(
      updatedTrail,
    );

    await this.flushPersistence();

    this._notify();

    return updatedTrail;
  }

  async toggleTrailVisibility(
    trailId,
  ) {
    const trail =
      this.trails.find(
        (candidate) =>
          candidate.id ===
          trailId,
      );

    if (!trail) {
      throw new Error(
        'Trilho não encontrado.',
      );
    }

    return this.setTrailVisibility(
      trailId,
      trail.visible ===
        false,
    );
  }

  _updateTrailCollection(
    trail,
  ) {
    if (!trail?.id) {
      return;
    }

    this.trails = [
      trail,

      ...this.trails.filter(
        (existingTrail) =>
          existingTrail.id !==
          trail.id,
      ),
    ];
  }

  _queueTrailSave(
    trail,
  ) {
    if (!trail?.id) {
      return;
    }

    this._updateTrailCollection(
      trail,
    );

    const snapshot =
      cloneData(
        trail,
      );

    this._persistenceQueue =
      this._persistenceQueue
        .catch(
          () => undefined,
        )
        .then(
          () =>
            TrailRepository.save(
              snapshot,
            ),
        )
        .catch(
          (error) => {
            ErrorManager.report(
              'storage',
              error,
              {
                operation:
                  'save-field-trail',

                trailId:
                  snapshot.id,
              },
            );
          },
        );
  }

  /**
   * Altera a visibilidade individual de um marcador.
   */
  async setPointVisibility(
    pointId,
    visible,
  ) {
    const index =
      this.points.findIndex(
        (point) =>
          point.id ===
          pointId,
      );

    if (index < 0) {
      throw new Error(
        'Marcador não encontrado.',
      );
    }

    const currentPoint =
      this.points[
        index
      ];

    const normalizedVisible =
      Boolean(
        visible,
      );

    const updatedPoint = {
      ...currentPoint,

      visible:
        normalizedVisible,

      properties: {
        ...currentPoint.properties,

        visible:
          normalizedVisible,
      },

      updated_date:
        Date.now(),
    };

    this.points = [
      ...this.points,
    ];

    this.points[
      index
    ] =
      updatedPoint;

    this._queuePointSave(
      updatedPoint,
    );

    await this.flushPersistence();

    this._notify();

    return updatedPoint;
  }

  async togglePointVisibility(
    pointId,
  ) {
    const point =
      this.points.find(
        (candidate) =>
          candidate.id ===
          pointId,
      );

    if (!point) {
      throw new Error(
        'Marcador não encontrado.',
      );
    }

    const visible =
      (
        point.visible ??
        point.properties
          ?.visible
      ) !==
      false;

    return this.setPointVisibility(
      pointId,
      !visible,
    );
  }

  _queuePointSave(
    point,
  ) {
    const snapshot =
      cloneData(
        point,
      );

    this._persistenceQueue =
      this._persistenceQueue
        .catch(
          () => undefined,
        )
        .then(
          () =>
            FieldPointRepository.save(
              snapshot,
            ),
        )
        .catch(
          (error) => {
            ErrorManager.report(
              'storage',
              error,
              {
                operation:
                  'save-field-point',

                pointId:
                  snapshot.id,
              },
            );
          },
        );
  }

  async flushPersistence() {
    await this._persistenceQueue
      .catch(
        () => undefined,
      );
  }

  _notify() {
    const state =
      this.getState();

    for (
      const listener
      of this._listeners
    ) {
      try {
        listener(
          state,
        );
      } catch {
        /**
         * Um listener defeituoso não deve interromper
         * a coleta GPS.
         */
      }
    }
  }

  subscribe(
    listener,
  ) {
    if (
      typeof listener !==
      'function'
    ) {
      return () => {};
    }

    this._listeners.push(
      listener,
    );

    return () => {
      this._listeners =
        this._listeners.filter(
          (candidate) =>
            candidate !==
            listener,
        );
    };
  }

  getState() {
    const independentPointsCount =
      this.points.filter(
        (point) =>
          !(
            point.trailId ??
            point.properties
              ?.trailId
          ),
      ).length;

    return {
      active:
        this.active,

      recording:
        this.recording,

      currentPosition:
        this.currentPosition,

      currentTrail:
        this.currentTrail,

      trailId:
        this.currentTrail
          ?.id ||
        null,

      trailStatus:
        this.currentTrail
          ?.status ||
        null,

      trailLength:
        this.trail.length,

      pointsCount:
        this.points.length,

      independentPointsCount,

      linkedPointsCount:
        this.points.length -
        independentPointsCount,

      distance:
        this.currentTrail
          ?.distanceMeters ||
        0,

      duration:
        this.getDuration(),

      speed:
        this.getSpeed(),

      averageSpeed:
        this.currentTrail
          ?.averageSpeedMps ||
        0,

      maximumSpeed:
        this.currentTrail
          ?.maximumSpeedMps ||
        0,

      movingTime:
        this.currentTrail
          ?.movingTimeMs ||
        0,

      stoppedTime:
        this.currentTrail
          ?.stoppedTimeMs ||
        0,

      minimumAltitude:
        this.currentTrail
          ?.minimumAltitudeMeters ??
        null,

      averageAltitude:
        this.currentTrail
          ?.averageAltitudeMeters ??
        null,

      maximumAltitude:
        this.currentTrail
          ?.maximumAltitudeMeters ??
        null,

      averageAccuracy:
        this.currentTrail
          ?.averageAccuracyMeters ??
        null,

      currentAccuracy:
        this.currentPosition
          ?.properties
          ?.accuracy ??
        null,

      permissionStatus:
        this.permissionStatus,

      locationError:
        this.locationError,

      followPosition:
        this.followPosition,

      locationProvider:
        this.locationProvider
          .getProviderName?.() ||
        'unknown',

      supportsBackgroundTracking:
        Boolean(
          this.locationProvider
            .supportsBackgroundTracking?.(),
        ),
    };
  }
}

export const FieldController =
  new FieldControllerImpl();