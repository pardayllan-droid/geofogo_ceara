/**
 * MapView
 *
 * Cria o mapa MapLibre e coordena a instalação das
 * camadas operacionais do GeoFogo Ceará.
 *
 * Também recebe solicitações para centralizar o mapa
 * em eventos de fogo selecionados no painel de alertas.
 *
 * Importante:
 * map.isStyleLoaded() não é usado como condição principal.
 * Em mapas raster, ele pode permanecer falso enquanto
 * tiles continuam sendo baixados, embora o estilo já aceite
 * novas sources e layers.
 */

import {
  useCallback,
  useEffect,
  useRef,
} from 'react';

import {
  createMap,
  changeBaseMap as applyBaseMap,
  fitToCeara,
} from './MapController';

import {
  LayerManager,
} from '../layers/LayerManager';

import {
  EventBus,
  EVENTS,
} from '../core/EventBus';

import {
  ErrorManager,
} from '../core/ErrorManager';

import {
  AppCore,
} from '../core/AppCore';

import {
  FieldController,
} from '../field/FieldController';

const EMPTY_FEATURE_COLLECTION = {
  type:
    'FeatureCollection',

  features:
    [],
};

/**
 * Aplica à camada do trilho o padrão visual armazenado
 * em properties.style.linePattern.
 *
 * O MapLibre utilizado atualmente não permite que
 * line-dasharray seja lido individualmente de cada
 * feição. Como apenas um trilho é exibido por vez,
 * aplicamos o padrão diretamente na camada.
 */
function applyFieldTrailPattern(
  map,
  trailGeoJSON,
) {
  if (
    !map ||
    !map.getLayer?.(
      'field-trail',
    )
  ) {
    return false;
  }

  const trailFeature =
    trailGeoJSON
      ?.features
      ?.[0];

  const linePattern =
    trailFeature
      ?.properties
      ?.style
      ?.linePattern ||
    'solid';

  try {
    if (
      linePattern ===
      'dashed'
    ) {
      /**
       * Os valores representam:
       * [comprimento do traço, comprimento do espaço]
       *
       * Eles são multiplicados pela espessura atual
       * da linha pelo próprio MapLibre.
       */
      map.setPaintProperty(
        'field-trail',
        'line-dasharray',
        [
          2.5,
          1.8,
        ],
      );
    } else {
      /**
       * null restaura o padrão contínuo da camada.
       */
      map.setPaintProperty(
        'field-trail',
        'line-dasharray',
        null,
      );
    }

    return true;
  } catch (error) {
    console.warn(
      '[MapView] Não foi possível aplicar o padrão do trilho:',
      error,
    );

    return false;
  }
}

function isFeatureCollection(
  value,
) {
  return (
    value?.type ===
      'FeatureCollection' &&
    Array.isArray(
      value.features,
    )
  );
}

function featureCount(
  value,
) {
  return Array.isArray(
    value?.features,
  )
    ? value.features.length
    : 0;
}

/**
 * Verifica se o mapa já possui um objeto de estilo
 * utilizável, sem depender de isStyleLoaded().
 */
function mapHasStyle(
  map,
) {
  if (!map) {
    return false;
  }

  try {
    const style =
      map.getStyle?.();

    return Boolean(
      style &&
      Number(
        style.version,
      ) === 8 &&
      Array.isArray(
        style.layers,
      ),
    );
  } catch {
    return false;
  }
}

/**
 * Percorre recursivamente as coordenadas de uma geometria.
 */
function walkCoordinates(
  coordinates,
  callback,
) {
  if (
    !Array.isArray(
      coordinates,
    )
  ) {
    return;
  }

  if (
    coordinates.length >=
      2 &&
    Number.isFinite(
      Number(
        coordinates[0],
      ),
    ) &&
    Number.isFinite(
      Number(
        coordinates[1],
      ),
    )
  ) {
    callback(
      Number(
        coordinates[0],
      ),

      Number(
        coordinates[1],
      ),
    );

    return;
  }

  for (
    const item
    of coordinates
  ) {
    walkCoordinates(
      item,
      callback,
    );
  }
}

/**
 * Calcula o BBOX de uma feição GeoJSON.
 *
 * Retorno:
 * [west, south, east, north]
 */
function calculateFeatureBbox(
  feature,
) {
  const geometry =
    feature?.geometry;

  if (!geometry) {
    return null;
  }

  if (
    geometry.type ===
    'GeometryCollection'
  ) {
    const geometries =
      geometry.geometries ||
      [];

    let west =
      Infinity;

    let south =
      Infinity;

    let east =
      -Infinity;

    let north =
      -Infinity;

    for (
      const item
      of geometries
    ) {
      const bbox =
        calculateFeatureBbox({
          type:
            'Feature',

          geometry:
            item,

          properties:
            {},
        });

      if (!bbox) {
        continue;
      }

      west =
        Math.min(
          west,
          bbox[0],
        );

      south =
        Math.min(
          south,
          bbox[1],
        );

      east =
        Math.max(
          east,
          bbox[2],
        );

      north =
        Math.max(
          north,
          bbox[3],
        );
    }

    if (
      !Number.isFinite(
        west,
      ) ||
      !Number.isFinite(
        south,
      ) ||
      !Number.isFinite(
        east,
      ) ||
      !Number.isFinite(
        north,
      )
    ) {
      return null;
    }

    return [
      west,
      south,
      east,
      north,
    ];
  }

  if (
    !geometry.coordinates
  ) {
    return null;
  }

  let west =
    Infinity;

  let south =
    Infinity;

  let east =
    -Infinity;

  let north =
    -Infinity;

  walkCoordinates(
    geometry.coordinates,

    (
      longitude,
      latitude,
    ) => {
      west =
        Math.min(
          west,
          longitude,
        );

      south =
        Math.min(
          south,
          latitude,
        );

      east =
        Math.max(
          east,
          longitude,
        );

      north =
        Math.max(
          north,
          latitude,
        );
    },
  );

  if (
    !Number.isFinite(
      west,
    ) ||
    !Number.isFinite(
      south,
    ) ||
    !Number.isFinite(
      east,
    ) ||
    !Number.isFinite(
      north,
    )
  ) {
    return null;
  }

  return [
    west,
    south,
    east,
    north,
  ];
}

/**
 * Obtém o centro aproximado de uma feição por meio
 * de seu BBOX.
 */
function calculateFeatureCenter(
  feature,
) {
  const bbox =
    calculateFeatureBbox(
      feature,
    );

  if (!bbox) {
    return null;
  }

  const [
    west,
    south,
    east,
    north,
  ] = bbox;

  return [
    (
      west +
      east
    ) / 2,

    (
      south +
      north
    ) / 2,
  ];
}

/**
 * Tenta obter o identificador do evento independentemente
 * do nome utilizado pelo SIPAM.
 */
function getFeatureIdentifiers(
  feature,
) {
  const properties =
    feature?.properties ||
    {};

  return [
    feature?.id,

    properties.id,
    properties.ID,

    properties.eventId,
    properties.event_id,

    properties.identificador,
    properties.identificador_evento,

    properties.codigo,
    properties.cod_evento,
    properties.codigo_evento,

    properties.id_evento,
    properties.idEvento,

    properties.objectid,
    properties.OBJECTID,

    properties.fid,
    properties.FID,
  ]
    .filter(
      (
        value,
      ) =>
        value !==
          undefined &&
        value !==
          null &&
        String(
          value,
        ).trim() !==
          '',
    )
    .map(
      (
        value,
      ) =>
        String(
          value,
        ).trim(),
    );
}

/**
 * Localiza no AppCore o evento relacionado ao alerta.
 */
function findFireEventById(
  eventId,
) {
  if (
    eventId ===
      undefined ||
    eventId ===
      null
  ) {
    return null;
  }

  const target =
    String(
      eventId,
    ).trim();

  const features =
    AppCore.fireEvents
      ?.features ||
    [];

  return (
    features.find(
      (
        feature,
      ) =>
        getFeatureIdentifiers(
          feature,
        ).includes(
          target,
        ),
    ) ||
    null
  );
}

/**
 * Padding aplicado ao enquadrar um evento.
 *
 * No desktop, reserva espaço para o painel lateral.
 * No celular, reserva espaço para o painel inferior.
 */
function getFocusPadding() {
  const mobile =
    typeof window !==
      'undefined' &&
    window.innerWidth <
      768;

  if (mobile) {
    return {
      top:
        70,

      right:
        35,

      bottom:
        260,

      left:
        35,
    };
  }

  return {
    top:
      70,

    right:
      390,

    bottom:
      70,

    left:
      80,
  };
}

/**
 * Centraliza ou enquadra uma feição no mapa.
 */
function focusMapOnFeature(
  map,
  feature,
) {
  if (
    !map ||
    !feature?.geometry
  ) {
    return false;
  }

  try {
    if (
      feature.geometry.type ===
      'Point'
    ) {
      const coordinates =
        feature.geometry
          .coordinates;

      if (
        !Array.isArray(
          coordinates,
        ) ||
        coordinates.length <
          2
      ) {
        return false;
      }

      const longitude =
        Number(
          coordinates[0],
        );

      const latitude =
        Number(
          coordinates[1],
        );

      if (
        !Number.isFinite(
          longitude,
        ) ||
        !Number.isFinite(
          latitude,
        )
      ) {
        return false;
      }

      map.easeTo({
        center: [
          longitude,
          latitude,
        ],

        zoom:
          Math.max(
            map.getZoom?.() ||
              0,
            14,
          ),

        duration:
          900,
      });

      return true;
    }

    const bbox =
      calculateFeatureBbox(
        feature,
      );

    if (!bbox) {
      return false;
    }

    const [
      west,
      south,
      east,
      north,
    ] = bbox;

    const width =
      Math.abs(
        east -
        west,
      );

    const height =
      Math.abs(
        north -
        south,
      );

    /*
     * Para eventos muito pequenos, fitBounds pode aplicar
     * um zoom excessivo. Nesse caso, centralizamos usando
     * um zoom operacional.
     */
    if (
      width <
        0.00001 &&
      height <
        0.00001
    ) {
      const center =
        calculateFeatureCenter(
          feature,
        );

      if (!center) {
        return false;
      }

      map.easeTo({
        center,

        zoom:
          Math.max(
            map.getZoom?.() ||
              0,
            14,
          ),

        duration:
          900,
      });

      return true;
    }

    map.fitBounds(
      [
        [
          west,
          south,
        ],

        [
          east,
          north,
        ],
      ],
      {
        padding:
          getFocusPadding(),

        maxZoom:
          14,

        duration:
          900,
      },
    );

    return true;
  } catch (error) {
    ErrorManager.report(
      'map',
      error,
      {
        operation:
          'MapView.focusMapOnFeature',

        featureId:
          feature?.id ??
          feature?.properties
            ?.id ??
          null,
      },
    );

    return false;
  }
}

const FIRE_EVENT_MARKER_IMAGES = {
  'fire-event-pin-red':
    '#ff2323',

  'fire-event-pin-orange':
    '#ff9e17',

  'fire-event-pin-pink':
    '#ffb1b0',

  'fire-event-pin-gray':
    '#c8c8c8',
};

/**
 * Desenha um marcador no formato de pino.
 *
 * A imagem é gerada em resolução dupla para
 * permanecer nítida em telas de alta densidade.
 */
function createFireEventPinImage(
  fillColor,
) {
  const pixelRatio =
    2;

  const displayWidth =
    42;

  const displayHeight =
    56;

  const canvas =
    document.createElement(
      'canvas',
    );

  canvas.width =
    displayWidth *
    pixelRatio;

  canvas.height =
    displayHeight *
    pixelRatio;

  const context =
    canvas.getContext(
      '2d',
    );

  if (!context) {
    return null;
  }

  context.scale(
    pixelRatio,
    pixelRatio,
  );

  /*
   * Sombra do marcador.
   */
  context.save();

  context.shadowColor =
    'rgba(0, 0, 0, 0.35)';

  context.shadowBlur =
    4;

  context.shadowOffsetX =
    1;

  context.shadowOffsetY =
    3;

  /*
   * Formato de gota/pino.
   */
  context.beginPath();

  context.moveTo(
    21,
    53,
  );

  context.bezierCurveTo(
    18,
    46,
    7,
    34,
    7,
    21,
  );

  context.bezierCurveTo(
    7,
    10,
    13,
    4,
    21,
    4,
  );

  context.bezierCurveTo(
    29,
    4,
    35,
    10,
    35,
    21,
  );

  context.bezierCurveTo(
    35,
    34,
    24,
    46,
    21,
    53,
  );

  context.closePath();

  context.fillStyle =
    fillColor;

  context.fill();

  context.lineWidth =
    2;

  context.strokeStyle =
    'rgba(120, 0, 20, 0.55)';

  context.stroke();

  context.restore();

  /*
   * Círculo branco interno.
   */
  context.beginPath();

  context.arc(
    21,
    20,
    6,
    0,
    Math.PI *
      2,
  );

  context.fillStyle =
    '#ffffff';

  context.fill();

  context.lineWidth =
    1.5;

  context.strokeStyle =
    'rgba(0, 0, 0, 0.12)';

  context.stroke();

  return {
    imageData:
      context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ),

    pixelRatio,
  };
}

/**
 * Garante que os ícones existam no estilo atual.
 *
 * map.setStyle() remove imagens personalizadas,
 * então esta função deve ser chamada sempre que as
 * camadas operacionais forem reinstaladas.
 */
function ensureFireEventMarkerImages(
  map,
) {
  if (!map?.addImage) {
    return false;
  }

  for (
    const [
      imageId,
      fillColor,
    ]
    of Object.entries(
      FIRE_EVENT_MARKER_IMAGES,
    )
  ) {
    if (
      map.hasImage?.(
        imageId,
      )
    ) {
      continue;
    }

    const marker =
      createFireEventPinImage(
        fillColor,
      );

    if (!marker) {
      continue;
    }

    map.addImage(
      imageId,
      marker.imageData,
      {
        pixelRatio:
          marker.pixelRatio,
      },
    );
  }

  return true;
}

/**
 * Imagens utilizadas pelos marcadores do Modo Campo.
 *
 * Cada imagem é monocromática e registrada como SDF.
 * A cor final é aplicada pela expressão icon-color da
 * camada field-points.
 */
const FIELD_MARKER_IMAGES = {
  flame:
    'field-marker-flame',

  vehicle:
    'field-marker-vehicle',

  water:
    'field-marker-water',

  blockage:
    'field-marker-blockage',

  risk:
    'field-marker-risk',

  service:
    'field-marker-service',

  observation:
    'field-marker-observation',
};

/**
 * Cria uma imagem monocromática para ser usada como
 * ícone SDF pelo MapLibre.
 *
 * O desenho é gerado em resolução dupla para permanecer
 * nítido em telas móveis de alta densidade.
 */
function createFieldMarkerImage(
  iconId,
) {
  const pixelRatio =
    2;

  const displaySize =
    34;

  const canvas =
    document.createElement(
      'canvas',
    );

  canvas.width =
    displaySize *
    pixelRatio;

  canvas.height =
    displaySize *
    pixelRatio;

  const context =
    canvas.getContext(
      '2d',
    );

  if (!context) {
    return null;
  }

  context.scale(
    pixelRatio,
    pixelRatio,
  );

  context.clearRect(
    0,
    0,
    displaySize,
    displaySize,
  );

  context.fillStyle =
    '#ffffff';

  context.strokeStyle =
    '#ffffff';

  context.lineWidth =
    2.6;

  context.lineCap =
    'round';

  context.lineJoin =
    'round';

  switch (iconId) {
    case 'flame':
      drawFieldFlame(
        context,
      );
      break;

    case 'vehicle':
      drawFieldVehicle(
        context,
      );
      break;

    case 'water':
      drawFieldWater(
        context,
      );
      break;

    case 'blockage':
      drawFieldBlockage(
        context,
      );
      break;

    case 'risk':
      drawFieldRisk(
        context,
      );
      break;

    case 'service':
      drawFieldService(
        context,
      );
      break;

    case 'observation':
    default:
      drawFieldObservation(
        context,
      );
      break;
  }

  return {
    imageData:
      context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ),

    pixelRatio,
  };
}

/**
 * Foco ativo — chama.
 */
function drawFieldFlame(
  context,
) {
  context.beginPath();

  context.moveTo(
    17,
    3,
  );

  context.bezierCurveTo(
    20,
    9,
    27,
    12,
    27,
    21,
  );

  context.bezierCurveTo(
    27,
    28,
    22,
    32,
    17,
    32,
  );

  context.bezierCurveTo(
    10,
    32,
    6,
    27,
    6,
    21,
  );

  context.bezierCurveTo(
    6,
    15,
    10,
    11,
    14,
    7,
  );

  context.bezierCurveTo(
    14,
    12,
    16,
    14,
    18,
    16,
  );

  context.bezierCurveTo(
    21,
    13,
    20,
    8,
    17,
    3,
  );

  context.closePath();
  context.fill();

  /**
   * Recorte interno da chama.
   */
  context.save();

  context.globalCompositeOperation =
    'destination-out';

  context.beginPath();

  context.moveTo(
    17,
    17,
  );

  context.bezierCurveTo(
    20,
    21,
    21,
    24,
    19,
    28,
  );

  context.bezierCurveTo(
    14,
    28,
    12,
    25,
    13,
    22,
  );

  context.bezierCurveTo(
    14,
    20,
    16,
    19,
    17,
    17,
  );

  context.closePath();
  context.fill();

  context.restore();
}

/**
 * Viatura — silhueta de veículo operacional.
 */
function drawFieldVehicle(
  context,
) {
  context.fillRect(
    5,
    13,
    18,
    11,
  );

  context.beginPath();

  context.moveTo(
    23,
    16,
  );

  context.lineTo(
    28,
    16,
  );

  context.lineTo(
    31,
    21,
  );

  context.lineTo(
    31,
    24,
  );

  context.lineTo(
    23,
    24,
  );

  context.closePath();
  context.fill();

  context.beginPath();

  context.arc(
    11,
    26,
    3,
    0,
    Math.PI * 2,
  );

  context.arc(
    26,
    26,
    3,
    0,
    Math.PI * 2,
  );

  context.fill();

  /**
   * Sinalizador superior.
   */
  context.fillRect(
    13,
    9,
    7,
    3,
  );
}

/**
 * Ponto d’água — gota.
 */
function drawFieldWater(
  context,
) {
  context.beginPath();

  context.moveTo(
    17,
    3,
  );

  context.bezierCurveTo(
    15,
    8,
    8,
    16,
    8,
    22,
  );

  context.bezierCurveTo(
    8,
    28,
    12,
    32,
    17,
    32,
  );

  context.bezierCurveTo(
    23,
    32,
    27,
    28,
    27,
    22,
  );

  context.bezierCurveTo(
    27,
    16,
    20,
    8,
    17,
    3,
  );

  context.closePath();
  context.fill();
}

/**
 * Bloqueio — barreira com faixas diagonais.
 */
function drawFieldBlockage(
  context,
) {
  context.fillRect(
    4,
    11,
    26,
    11,
  );

  context.fillRect(
    8,
    22,
    4,
    8,
  );

  context.fillRect(
    22,
    22,
    4,
    8,
  );

  context.save();

  context.globalCompositeOperation =
    'destination-out';

  context.lineWidth =
    3;

  for (
    let x = 4;
    x <= 30;
    x += 8
  ) {
    context.beginPath();

    context.moveTo(
      x,
      21,
    );

    context.lineTo(
      x + 7,
      12,
    );

    context.stroke();
  }

  context.restore();
}

/**
 * Área de risco — triângulo com exclamação.
 */
function drawFieldRisk(
  context,
) {
  context.beginPath();

  context.moveTo(
    17,
    3,
  );

  context.lineTo(
    32,
    30,
  );

  context.lineTo(
    2,
    30,
  );

  context.closePath();
  context.fill();

  context.save();

  context.globalCompositeOperation =
    'destination-out';

  context.fillRect(
    15.5,
    11,
    3,
    10,
  );

  context.beginPath();

  context.arc(
    17,
    25,
    1.8,
    0,
    Math.PI * 2,
  );

  context.fill();

  context.restore();
}

/**
 * Atendimento — cruz operacional.
 */
function drawFieldService(
  context,
) {
  context.fillRect(
    13,
    4,
    8,
    26,
  );

  context.fillRect(
    4,
    13,
    26,
    8,
  );
}

/**
 * Observação — marcador simples.
 */
function drawFieldObservation(
  context,
) {
  context.beginPath();

  context.arc(
    17,
    14,
    10,
    Math.PI,
    0,
  );

  context.bezierCurveTo(
    27,
    23,
    20,
    29,
    17,
    33,
  );

  context.bezierCurveTo(
    14,
    29,
    7,
    23,
    7,
    14,
  );

  context.closePath();
  context.fill();

  context.save();

  context.globalCompositeOperation =
    'destination-out';

  context.beginPath();

  context.arc(
    17,
    14,
    3.5,
    0,
    Math.PI * 2,
  );

  context.fill();

  context.restore();
}

/**
 * Registra os ícones no estilo atual do mapa.
 *
 * As imagens precisam ser recriadas sempre que o
 * mapa-base for alterado, pois map.setStyle() remove
 * imagens adicionadas manualmente.
 */
function ensureFieldMarkerImages(
  map,
) {
  if (!map?.addImage) {
    return false;
  }

  for (
    const [
      iconId,
      imageId,
    ]
    of Object.entries(
      FIELD_MARKER_IMAGES,
    )
  ) {
    if (
      map.hasImage?.(
        imageId,
      )
    ) {
      continue;
    }

    const markerImage =
      createFieldMarkerImage(
        iconId,
      );

    if (!markerImage) {
      continue;
    }

    map.addImage(
      imageId,
      markerImage.imageData,
      {
        pixelRatio:
          markerImage.pixelRatio,

        /**
         * Necessário para permitir icon-color e
         * icon-halo-color.
         */
        sdf:
          true,
      },
    );
  }

  return true;
}

export default function MapView({
  baseMapId,
  onReady,
}) {
  const containerRef =
    useRef(
      null,
    );

  const mapRef =
    useRef(
      null,
    );

  const mountedRef =
    useRef(
      false,
    );

  const styleReadyRef =
    useRef(
      false,
    );

  const fittedRef =
    useRef(
      false,
    );

  const baseMapRef =
    useRef(
      baseMapId,
    );

  const installingRef =
    useRef(
      false,
    );

  const pendingInstallRef =
    useRef(
      false,
    );

  const retryTimerRef =
    useRef(
      null,
    );

  const pendingTimerRef =
    useRef(
      null,
    );

  const clearRetry =
    useCallback(
      () => {
        if (
          retryTimerRef.current ===
          null
        ) {
          return;
        }

        window.clearTimeout(
          retryTimerRef.current,
        );

        retryTimerRef.current =
          null;
      },
      [],
    );

  /**
   * Atualiza uma camada no LayerManager.
   */
  const updateLayer =
    useCallback(
      (
        layerId,
        data,
      ) => {
        if (
          !isFeatureCollection(
            data,
          )
        ) {
          return false;
        }

        try {
          return LayerManager.updateLayerData(
            layerId,
            data,
          );
        } catch (error) {
          ErrorManager.report(
            'layer',
            error,
            {
              operation:
                'MapView.updateLayer',

              layerId,

              featureCount:
                featureCount(
                  data,
                ),
            },
          );

          return false;
        }
      },
      [],
    );

  /**
   * Envia todos os dados existentes no AppCore
   * para o LayerManager.
   *
   * Coleções vazias também são enviadas para limpar
   * dados anteriores.
   */
  const updateAllLayerData =
    useCallback(
      () => {
        updateLayer(
          'ceara-boundary',

          AppCore.cearaBoundary ||
            EMPTY_FEATURE_COLLECTION,
        );

        updateLayer(
          'municipalities',

          AppCore.municipalities ||
            EMPTY_FEATURE_COLLECTION,
        );

        updateLayer(
          'conservation-units',

          AppCore.conservationUnits ||
            EMPTY_FEATURE_COLLECTION,
        );

        updateLayer(
          'indigenous-lands',

          AppCore.indigenousLands ||
            EMPTY_FEATURE_COLLECTION,
        );

        updateLayer(
          'fire-events',

          AppCore.fireEvents ||
            EMPTY_FEATURE_COLLECTION,
        );

        updateLayer(
          'fire-events-markers',

          AppCore
            .getFireEventMarkers
            ?.() ||
            EMPTY_FEATURE_COLLECTION,
        );

        updateLayer(
          'fire-fronts',

          AppCore.fireFronts ||
            EMPTY_FEATURE_COLLECTION,
        );

        updateLayer(
          'alert-buffers',

          AppCore
            .getAlertBuffers
            ?.() ||
            EMPTY_FEATURE_COLLECTION,
        );
      },
      [
        updateLayer,
      ],
    );

  /**
   * Retorna os dados atuais do AppCore relacionados
   * a uma camada específica.
   */
  const getLayerData =
    useCallback(
      (
        layerId,
      ) => {
        switch (
          layerId
        ) {
          case 'ceara-boundary':
            return (
              AppCore.cearaBoundary ||
              EMPTY_FEATURE_COLLECTION
            );

          case 'municipalities':
            return (
              AppCore.municipalities ||
              EMPTY_FEATURE_COLLECTION
            );

          case 'conservation-units':
            return (
              AppCore.conservationUnits ||
              EMPTY_FEATURE_COLLECTION
            );

          case 'indigenous-lands':
            return (
              AppCore.indigenousLands ||
              EMPTY_FEATURE_COLLECTION
            );

          case 'fire-events':
            return (
              AppCore.fireEvents ||
              EMPTY_FEATURE_COLLECTION
            );

          case 'fire-events-markers':
            return (
              AppCore
                .getFireEventMarkers
                ?.() ||
              EMPTY_FEATURE_COLLECTION
            );

          case 'fire-fronts':
            return (
              AppCore.fireFronts ||
              EMPTY_FEATURE_COLLECTION
            );

          case 'alert-buffers':
            return (
              AppCore
                .getAlertBuffers
                ?.() ||
              EMPTY_FEATURE_COLLECTION
            );

          default:
            return null;
        }
      },
      [],
    );

  /**
   * Atualiza apenas as camadas informadas pela tarefa
   * individual que acabou de ser concluída.
   */
  const updateAffectedLayers =
    useCallback(
      (
        affectedLayers,
      ) => {
        const map =
          mapRef.current;

        if (
          !mountedRef.current ||
          !map ||
          !Array.isArray(
            affectedLayers,
          ) ||
          affectedLayers.length ===
            0
        ) {
          return false;
        }

        const styleAvailable =
          styleReadyRef.current ||
          mapHasStyle(
            map,
          );

        if (
          !styleAvailable
        ) {
          return false;
        }

        try {
          LayerManager.setMap(
            map,
          );

          if (
            affectedLayers.includes(
              'fire-events-markers',
            )
          ) {
            ensureFireEventMarkerImages(
              map,
            );
          }

          let updatedCount =
            0;

          for (
            const layerId
            of affectedLayers
          ) {
            const data =
              getLayerData(
                layerId,
              );

            if (!data) {
              continue;
            }

            const updated =
              updateLayer(
                layerId,
                data,
              );

            if (updated) {
              updatedCount +=
                1;
            }
          }

          return (
            updatedCount >
            0
          );
        } catch (error) {
          ErrorManager.report(
            'layer',
            error,
            {
              operation:
                'MapView.updateAffectedLayers',

              affectedLayers:
                [
                  ...affectedLayers,
                ],
            },
          );

          return false;
        }
      },
      [
        getLayerData,
        updateLayer,
      ],
    );

  /**
   * Tenta instalar as camadas operacionais sem depender
   * de map.isStyleLoaded().
   */
  const installOperationalLayers =
    useCallback(
      ({
        reason =
          'manual',

        attempt =
          0,
      } = {}) => {
        const map =
          mapRef.current;

        if (
          !mountedRef.current ||
          !map
        ) {
          return false;
        }

        if (
          installingRef.current
        ) {
          pendingInstallRef.current =
            true;

          return false;
        }

        const styleAvailable =
          styleReadyRef.current ||
          mapHasStyle(
            map,
          );

        if (
          !styleAvailable
        ) {
          if (
            attempt <
            20
          ) {
            clearRetry();

            retryTimerRef.current =
              window.setTimeout(
                () => {
                  retryTimerRef.current =
                    null;

                  installOperationalLayers({
                    reason:
                      `${reason}:retry`,

                    attempt:
                      attempt +
                      1,
                  });
                },
                250,
              );
          }

          return false;
        }

        installingRef.current =
          true;

        pendingInstallRef.current =
          false;

        try {
          LayerManager.setMap(
            map,
          );

          /*
           * Imagens personalizadas precisam existir antes
           * da criação da layer symbol.
           */
          ensureFireEventMarkerImages(
            map,
          );

          /**
           * Os ícones do Campo também precisam existir antes da
           * criação da camada symbol field-points.
           */
          ensureFieldMarkerImages(
            map,
          );

          updateAllLayerData();

          try {
            map.resize();
          } catch {
            // Não impede o funcionamento das camadas.
          }

          const boundarySourceCreated =
            Boolean(
              map.getSource?.(
                'src-ceara-boundary',
              ),
            );

          const boundaryLayerCreated =
            Boolean(
              map.getLayer?.(
                'ceara-boundary',
              ),
            );

          const municipalitySourceCreated =
            Boolean(
              map.getSource?.(
                'src-municipalities',
              ),
            );

          const municipalityLayerCreated =
            Boolean(
              map.getLayer?.(
                'municipalities',
              ),
            );

          /*
           * Só registra erros após algumas tentativas,
           * evitando registrar falhas transitórias.
           */
          if (
            attempt >=
              3 &&
            featureCount(
              AppCore.cearaBoundary,
            ) >
              0 &&
            !boundaryLayerCreated
          ) {
            ErrorManager.report(
              'layer',

              new Error(
                'O limite do Ceará possui dados, mas não foi criado no mapa.',
              ),

              {
                operation:
                  'installOperationalLayers',

                reason,
                attempt,

                styleReadyEvent:
                  styleReadyRef.current,

                styleObjectAvailable:
                  mapHasStyle(
                    map,
                  ),

                isStyleLoaded:
                  map.isStyleLoaded?.() ??
                  false,

                sourceCreated:
                  boundarySourceCreated,
              },
            );
          }

          if (
            attempt >=
              3 &&
            featureCount(
              AppCore.municipalities,
            ) >
              0 &&
            !municipalityLayerCreated
          ) {
            ErrorManager.report(
              'layer',

              new Error(
                'Os municípios possuem dados, mas não foram criados no mapa.',
              ),

              {
                operation:
                  'installOperationalLayers',

                reason,
                attempt,

                featureCount:
                  featureCount(
                    AppCore.municipalities,
                  ),

                styleReadyEvent:
                  styleReadyRef.current,

                styleObjectAvailable:
                  mapHasStyle(
                    map,
                  ),

                isStyleLoaded:
                  map.isStyleLoaded?.() ??
                  false,

                sourceCreated:
                  municipalitySourceCreated,
              },
            );
          }

          /*
           * Enquadra o Ceará apenas na primeira
           * instalação bem-sucedida.
           */
          if (
            !fittedRef.current &&
            boundaryLayerCreated &&
            featureCount(
              AppCore.cearaBoundary,
            ) >
              0
          ) {
            const fitted =
              fitToCeara(
                map,
                AppCore.cearaBoundary,
              );

            if (fitted) {
              fittedRef.current =
                true;
            }
          }

          const territorialLayersMissing =
            (
              featureCount(
                AppCore.cearaBoundary,
              ) >
                0 &&
              !boundaryLayerCreated
            ) ||
            (
              featureCount(
                AppCore.municipalities,
              ) >
                0 &&
              !municipalityLayerCreated
            );

          if (
            territorialLayersMissing &&
            attempt <
              20
          ) {
            clearRetry();

            retryTimerRef.current =
              window.setTimeout(
                () => {
                  retryTimerRef.current =
                    null;

                  installOperationalLayers({
                    reason:
                      `${reason}:layer-retry`,

                    attempt:
                      attempt +
                      1,
                  });
                },
                300,
              );
          }

          return (
            boundaryLayerCreated ||
            municipalityLayerCreated
          );
        } catch (error) {
          ErrorManager.report(
            'layer',
            error,
            {
              operation:
                'installOperationalLayers',

              reason,
              attempt,

              styleReadyEvent:
                styleReadyRef.current,

              styleObjectAvailable:
                mapHasStyle(
                  map,
                ),

              isStyleLoaded:
                map.isStyleLoaded?.() ??
                false,
            },
          );

          return false;
        } finally {
          installingRef.current =
            false;

          if (
            pendingInstallRef.current &&
            mountedRef.current
          ) {
            pendingInstallRef.current =
              false;

            if (
              pendingTimerRef.current !==
              null
            ) {
              window.clearTimeout(
                pendingTimerRef.current,
              );
            }

            pendingTimerRef.current =
              window.setTimeout(
                () => {
                  pendingTimerRef.current =
                    null;

                  installOperationalLayers({
                    reason:
                      'pending-installation',
                  });
                },
                0,
              );
          }
        }
      },
      [
        clearRetry,
        updateAllLayerData,
      ],
    );

  /**
   * Cria e destrói o mapa.
   */
  useEffect(
    () => {
      mountedRef.current =
        true;

      if (
        !containerRef.current ||
        mapRef.current
      ) {
        return undefined;
      }

      const map =
        createMap(
          containerRef.current,
          {
            baseMapId:
              baseMapRef.current,
          },
        );

      mapRef.current =
        map;

      const handleLoad =
        () => {
          if (
            !mountedRef.current
          ) {
            return;
          }

          styleReadyRef.current =
            true;

          LayerManager.setMap(
            map,
          );

          onReady?.(
            map,
          );

          installOperationalLayers({
            reason:
              'map-load',
          });
        };

      const handleMapError =
        (
          event,
        ) => {
          const error =
            event?.error ||
            event ||
            new Error(
              'Erro desconhecido no MapLibre.',
            );

          /*
           * Erros em tiles raster não devem impedir
           * as camadas GeoJSON operacionais.
           */
          console.warn(
            '[MapView] Erro reportado pelo MapLibre:',
            error,
          );
        };

      map.on(
        'load',
        handleLoad,
      );

      map.on(
        'error',
        handleMapError,
      );

      return () => {
        mountedRef.current =
          false;

        styleReadyRef.current =
          false;

        clearRetry();

        if (
          pendingTimerRef.current !==
          null
        ) {
          window.clearTimeout(
            pendingTimerRef.current,
          );

          pendingTimerRef.current =
            null;
        }

        installingRef.current =
          false;

        pendingInstallRef.current =
          false;

        try {
          map.off(
            'load',
            handleLoad,
          );

          map.off(
            'error',
            handleMapError,
          );
        } catch {
          // O mapa pode já ter sido removido.
        }

        LayerManager.clearMap(
          map,
        );

        try {
          map.remove();
        } catch (error) {
          console.warn(
            '[MapView] Falha ao remover o mapa:',
            error,
          );
        }

        mapRef.current =
          null;
      };
    },
    [
      clearRetry,
      installOperationalLayers,
      onReady,
    ],
  );

  /**
   * Troca do mapa-base.
   */
  useEffect(
    () => {
      const map =
        mapRef.current;

      if (
        !map ||
        !baseMapId ||
        baseMapId ===
          baseMapRef.current
      ) {
        return;
      }

      baseMapRef.current =
        baseMapId;

      styleReadyRef.current =
        false;

      const changed =
        applyBaseMap(
          map,
          baseMapId,
        );

      if (!changed) {
        styleReadyRef.current =
          mapHasStyle(
            map,
          );
      }
    },
    [
      baseMapId,
    ],
  );

  /**
   * Atualiza as camadas quando:
   *
   * - uma tarefa individual termina;
   * - o AppCore conclui uma atualização geral;
   * - o estilo do mapa-base é substituído.
   */
  useEffect(
    () => {
      const handleSyncTaskCompleted =
        ({
          affectedLayers =
            [],
        } = {}) => {
          const updated =
            updateAffectedLayers(
              affectedLayers,
            );

          /*
           * Se o mapa ou o estilo ainda não estiverem
           * prontos, usamos a instalação geral como fallback.
           */
          if (
            !updated &&
            affectedLayers.length >
              0
          ) {
            installOperationalLayers({
              reason:
                'sync-task-completed:fallback',
            });
          }
        };

      const handleDataUpdated =
        () => {
          /*
           * Fechamento geral da atualização.
           *
           * Garante alertas, buffers e qualquer camada não
           * declarada em affectedLayers.
           */
          installOperationalLayers({
            reason:
              'data-updated',
          });
        };

      const handleMapReady =
        ({
          styleChanged =
            false,
        } = {}) => {
          styleReadyRef.current =
            true;

          /*
           * No carregamento inicial, handleLoad já instala
           * as camadas e notifica o componente pai.
           *
           * MAP_READY é usado aqui somente para reaplicar
           * os dados após uma troca de mapa-base.
           */
          if (!styleChanged) {
            return;
          }

          installOperationalLayers({
            reason:
              'map-ready:style-changed',
          });
        };

      const unsubscribeTask =
        EventBus.on(
          EVENTS.SYNC_TASK_COMPLETED,
          handleSyncTaskCompleted,
        );

      const unsubscribeData =
        EventBus.on(
          EVENTS.DATA_UPDATED,
          handleDataUpdated,
        );

      const unsubscribeMap =
        EventBus.on(
          EVENTS.MAP_READY,
          handleMapReady,
        );

      return () => {
        unsubscribeTask?.();
        unsubscribeData?.();
        unsubscribeMap?.();
      };
    },
    [
      installOperationalLayers,
      updateAffectedLayers,
    ],
  );

  /**
   * Restaura exatamente o enquadramento inicial do Ceará.
   *
   * Usa a mesma função executada após a primeira instalação
   * bem-sucedida das camadas territoriais.
   */
  useEffect(
    () => {
      const handleResetInitialView =
        () => {
          const map =
            mapRef.current;

          if (!map) {
            console.warn(
              '[MapView] O mapa ainda não está disponível para restaurar a vista inicial.',
            );

            return;
          }

          if (
            !AppCore.cearaBoundary
              ?.features
              ?.length
          ) {
            console.warn(
              '[MapView] O limite do Ceará não está disponível para restaurar a vista inicial.',
            );

            return;
          }

          try {
            map.resize();

            const restored =
              fitToCeara(
                map,
                AppCore.cearaBoundary,
              );

            if (!restored) {
              console.warn(
                '[MapView] Não foi possível restaurar o enquadramento inicial do Ceará.',
              );
            }
          } catch (error) {
            ErrorManager.report(
              'map',
              error,
              {
                operation:
                  'MapView.resetInitialView',
              },
            );
          }
        };

      const unsubscribe =
        EventBus.on(
          EVENTS.MAP_RESET_INITIAL_VIEW,
          handleResetInitialView,
        );

      return () => {
        unsubscribe?.();
      };
    },
    [],
  );

  /**
   * Centraliza o mapa em um evento selecionado
   * no painel de alertas.
   */
  useEffect(
    () => {
      if (
        !EVENTS.MAP_FOCUS_FIRE_EVENT
      ) {
        console.warn(
          '[MapView] MAP_FOCUS_FIRE_EVENT não está registrado no EventBus.',
        );

        return undefined;
      }

      const handleFocusFireEvent =
        ({
          eventId,
          alertId,
          feature,
        } = {}) => {
          const map =
            mapRef.current;

          if (!map) {
            console.warn(
              '[MapView] O mapa ainda não está disponível para centralização.',
            );

            return;
          }

          /*
           * O painel pode enviar diretamente a feição.
           * Caso não envie, procuramos pelo eventId.
           */
          const fireEvent =
            feature ||
            findFireEventById(
              eventId,
            );

          if (!fireEvent) {
            console.warn(
              '[MapView] Evento relacionado ao alerta não encontrado.',
              {
                eventId,
                alertId,

                availableEvents:
                  AppCore.fireEvents
                    ?.features
                    ?.length ||
                  0,
              },
            );

            return;
          }

          /*
           * Garante que o evento esteja instalado no mapa
           * antes de realizar a animação.
           */
          installOperationalLayers({
            reason:
              'focus-fire-event',
          });

          try {
            LayerManager.setVisibility?.(
              'fire-events',
              true,
            );

            LayerManager.setVisibility?.(
              'fire-events-markers',
              true,
            );
          } catch (error) {
            console.warn(
              '[MapView] Não foi possível ativar as camadas de eventos:',
              error,
            );
          }

          const focused =
            focusMapOnFeature(
              map,
              fireEvent,
            );

          if (!focused) {
            console.warn(
              '[MapView] Não foi possível centralizar no evento.',
              {
                eventId,
                alertId,

                geometryType:
                  fireEvent
                    ?.geometry
                    ?.type ||
                  null,
              },
            );
          }
        };

      const unsubscribe =
        EventBus.on(
          EVENTS.MAP_FOCUS_FIRE_EVENT,
          handleFocusFireEvent,
        );

      return () => {
        unsubscribe?.();
      };
    },
    [
      installOperationalLayers,
    ],
  );

  /**
   * Atualização das camadas do Modo Campo.
   */
  useEffect(
    () => {
      const updateFieldLayers =
        () => {
          const map =
            mapRef.current;

          if (
            !FieldController.active ||
            !map ||
            !styleReadyRef.current
          ) {
            return;
          }

          LayerManager.setMap(
            map,
          );

          /**
           * A posição atual deve ser desenhada sempre que
           * o Modo Campo estiver ativo.
           *
           * Isso independe de:
           * - estar gravando um trilho;
           * - centralização automática;
           * - existência de marcadores.
           */
          updateLayer(
            'field-position',
            FieldController
              .getPositionGeoJSON
              ?.() ||
              EMPTY_FEATURE_COLLECTION,
          );

          const trailGeoJSON =
            FieldController
              .getTrailGeoJSON
              ?.() ||
            EMPTY_FEATURE_COLLECTION;

          updateLayer(
            'field-trail',
            trailGeoJSON,
          );

          applyFieldTrailPattern(
            map,
            trailGeoJSON,
          );

          updateLayer(
            'field-points',
            FieldController
              .getPointsGeoJSON
              ?.() ||
              EMPTY_FEATURE_COLLECTION,
          );

          /**
           * A posição continua sendo atualizada e desenhada
           * independentemente do acompanhamento automático.
           *
           * O mapa só é reposicionado quando o usuário ativa
           * "Centralizar automaticamente".
           */
          if (
            FieldController
              .followPosition
          ) {
            const position =
              FieldController
                .currentPosition;

            const coordinates =
              position
                ?.geometry
                ?.coordinates;

            if (
              Array.isArray(
                coordinates,
              ) &&
              coordinates.length >=
                2
            ) {
              const longitude =
                Number(
                  coordinates[0],
                );

              const latitude =
                Number(
                  coordinates[1],
                );

              if (
                Number.isFinite(
                  longitude,
                ) &&
                Number.isFinite(
                  latitude,
                )
              ) {
                map.easeTo({
                  center: [
                    longitude,
                    latitude,
                  ],

                  zoom:
                    Math.max(
                      map.getZoom(),
                      14,
                    ),

                  duration:
                    500,
                });
              }
            }
          }
        };

      /**
       * Atualiza imediatamente sempre que o estado interno
       * do FieldController mudar.
       */
      const unsubscribeFieldState =
        FieldController.subscribe(
          () => {
            updateFieldLayers();
          },
        );

      /**
       * Faz uma primeira atualização ao montar o efeito.
       */
      updateFieldLayers();

      const intervalId =
        window.setInterval(
          updateFieldLayers,
          3000,
        );

      /**
       * Ao encerrar o Modo Campo, apenas a posição ao vivo
       * deve desaparecer.
       *
       * Trilhos e marcadores são registros persistentes e
       * devem continuar visíveis no mapa.
       */
      const unsubscribeStopped =
        EventBus.on(
          EVENTS.FIELD_MODE_STOPPED,
          () => {
            const map =
              mapRef.current;

            updateLayer(
              'field-position',
              EMPTY_FEATURE_COLLECTION,
            );

            const trailGeoJSON =
              FieldController
                .getTrailGeoJSON
                ?.() ||
              EMPTY_FEATURE_COLLECTION;

            updateLayer(
              'field-trail',
              trailGeoJSON,
            );

            updateLayer(
              'field-points',
              FieldController
                .getPointsGeoJSON
                ?.() ||
              EMPTY_FEATURE_COLLECTION,
            );

            applyFieldTrailPattern(
              map,
              trailGeoJSON,
            );
          },
        );

      return () => {
        window.clearInterval(
          intervalId,
          
        );

        unsubscribeFieldState?.();
        unsubscribeStopped?.();
      };
    },
    [
      updateLayer,
    ],
  );

  const fieldMarkerPreviewReadyRef =
    useRef(false);

  /**
   * Pré-visualização de marcador criado por coordenada
   * manual.
   *
   * A feição é temporária e não é persistida.
   */
  useEffect(
    () => {
      const handlePreview =
        ({
          longitude,
          latitude,
        } = {}) => {
          const map =
            mapRef.current;

          const lng =
            Number(
              longitude,
            );

          const lat =
            Number(
              latitude,
            );

          if (
            !map ||
            !Number.isFinite(
              lng,
            ) ||
            !Number.isFinite(
              lat,
            )
          ) {
            return;
          }

          const previewData = {
            type:
              'FeatureCollection',

            features: [
              {
                type:
                  'Feature',

                geometry: {
                  type:
                    'Point',

                  coordinates: [
                    lng,
                    lat,
                  ],
                },

                properties: {},
              },
            ],
          };

          if (
            !map.getSource(
              'field-marker-preview-source',
            )
          ) {
            map.addSource(
              'field-marker-preview-source',
              {
                type:
                  'geojson',

                data:
                  previewData,
              },
            );
          } else {
            map
              .getSource(
                'field-marker-preview-source',
              )
              .setData(
                previewData,
              );
          }

          if (
            !map.getLayer(
              'field-marker-preview-halo',
            )
          ) {
            map.addLayer({
              id:
                'field-marker-preview-halo',

              type:
                'circle',

              source:
                'field-marker-preview-source',

              paint: {
                'circle-radius':
                  15,

                'circle-color':
                  '#ffffff',

                'circle-opacity':
                  0.8,

                'circle-stroke-color':
                  '#2563eb',

                'circle-stroke-width':
                  3,
              },
            });
          }

          if (
            !map.getLayer(
              'field-marker-preview-center',
            )
          ) {
            map.addLayer({
              id:
                'field-marker-preview-center',

              type:
                'circle',

              source:
                'field-marker-preview-source',

              paint: {
                'circle-radius':
                  5,

                'circle-color':
                  '#2563eb',

                'circle-stroke-color':
                  '#ffffff',

                'circle-stroke-width':
                  2,
              },
            });
          }

          fieldMarkerPreviewReadyRef.current =
            true;

          map.easeTo({
            center: [
              lng,
              lat,
            ],

            zoom:
              Math.max(
                map.getZoom(),
                14,
              ),

            duration:
              900,
          });
        };

      const handleClear =
        () => {
          const map =
            mapRef.current;

          if (!map) {
            return;
          }

          const source =
            map.getSource(
              'field-marker-preview-source',
            );

          source?.setData?.(
            EMPTY_FEATURE_COLLECTION,
          );

          fieldMarkerPreviewReadyRef.current =
            false;
        };

      const unsubscribePreview =
        EventBus.on(
          EVENTS.MAP_PREVIEW_FIELD_MARKER,
          handlePreview,
        );

      const unsubscribeClear =
        EventBus.on(
          EVENTS.MAP_CLEAR_FIELD_MARKER_PREVIEW,
          handleClear,
        );

      return () => {
        unsubscribePreview?.();
        unsubscribeClear?.();
      };
    },
    [],
  );

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full"
      data-testid="geofogo-map"
    />
  );
}