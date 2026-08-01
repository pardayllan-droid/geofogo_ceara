/**
 * Definições declarativas de camadas do GeoFogo Ceará.
 * Cada camada tem configuração completa: id, título, grupo, fonte, estilo, cache, etc.
 * Novas camadas podem ser adicionadas aqui sem alterar o componente do mapa.
 */

export const LAYER_GROUPS = {
  BASE: 'Mapas-base',
  LIMITS: 'Limites territoriais',
  FIRE: 'Incêndios',
  PROTECTED: 'Áreas protegidas',
  SENSITIVE: 'Áreas Sensíveis',
  RESOURCES: 'Recursos operacionais',
  INFRA: 'Infraestrutura',
};

export const BASE_MAPS = {
  standard: {
    id: 'standard',
    title: 'Padrão',
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap',
        },
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    },
  },
  light: {
    id: 'light',
    title: 'Claro',
    style: {
      version: 8,
      sources: {
        carto: {
          type: 'raster',
          tiles: ['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© CARTO © OpenStreetMap',
        },
      },
      layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
    },
  },
  dark: {
    id: 'dark',
    title: 'Escuro',
    style: {
      version: 8,
      sources: {
        carto: {
          type: 'raster',
          tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© CARTO © OpenStreetMap',
        },
      },
      layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
    },
  },
  satellite: {
    id: 'satellite',
    title: 'Satélite',
    style: {
      version: 8,
      sources: {
        esri: {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: '© Esri',
        },
      },
      layers: [{ id: 'esri', type: 'raster', source: 'esri' }],
    },
  },
};

export const LAYER_DEFINITIONS = [
  {
    id: 'ceara-boundary',
    title: 'Limite do Ceará',
    group: LAYER_GROUPS.LIMITS,
    sourceType: 'geojson',
    geometryType: 'polygon',
    defaultVisible: true,
    minZoom: 4,
    maxZoom: 22,
    zIndex: 10,
    opacity: 1,
    cachePolicy: 'cache-first',
    interactive: true,
    paint: {
      'fill-color': '#f59e0b',
      'fill-opacity': 0.03,
      'line-color': '#f59e0b',
      'line-width': 2,
      'line-opacity': 0.9,
    },
  },
  {
    id: 'municipalities',
    title: 'Municípios',
    group: LAYER_GROUPS.LIMITS,
    sourceType: 'geojson',
    geometryType: 'polygon',
    defaultVisible: true,
    minZoom: 6,
    maxZoom: 22,
    zIndex: 20,
    opacity: 0.6,
    cachePolicy: 'cache-first',
    interactive: true,
    paint: {
      'fill-color': '#94a3b8',
      'fill-opacity': 0.04,
      'line-color': '#64748b',
      'line-width': 0.5,
      'line-opacity': 0.5,
    },
  },
  {
    id: 'conservation-units',
    title: 'Unidades de Conservação',
    group: LAYER_GROUPS.PROTECTED,
    sourceType: 'geojson',
    geometryType: 'polygon',
    defaultVisible: true,
    minZoom: 5,
    maxZoom: 22,
    zIndex: 30,
    opacity: 0.5,
    cachePolicy: 'cache-first',
    interactive: true,
    paint: {
      'fill-color': '#22c55e',
      'fill-opacity': 0.25,
      'line-color': '#16a34a',
      'line-width': 1,
      'line-opacity': 0.8,
    },
  },
  {
    id: 'indigenous-lands',
    title: 'Terras Indígenas',
    group: LAYER_GROUPS.SENSITIVE,
    sourceType: 'geojson',
    geometryType: 'polygon',
    defaultVisible: true,
    minZoom: 5,
    maxZoom: 22,
    zIndex: 35,
    opacity: 0.65,
    cachePolicy: 'network-first',
    interactive: true,
    paint: {
      'fill-color': '#a855f7',
      'fill-opacity': 0.22,
      'line-color': '#7e22ce',
      'line-width': 1.2,
      'line-opacity': 0.9,
    },
  },
  {
    id: 'fire-events',
    title: 'Eventos de fogo',
    group: LAYER_GROUPS.FIRE,
    sourceType: 'geojson',
    geometryType: 'polygon',
    defaultVisible: true,
    minZoom: 5,
    maxZoom: 22,
    zIndex: 50,
    opacity: 0.75,
    cachePolicy: 'network-first',
    interactive: true,
    refreshInterval: 15 * 60 * 1000,
    paint: {
      'fill-color': [
        'match',

        [
          'get',
          'fire_age_class',
        ],

        'up-to-24h',
        '#ff2323',

        '24-to-48h',
        '#ff9e17',

        '48-to-96h',
        '#ffb1b0',

        'over-96h',
        '#c8c8c8',

        /*
        * Cor de fallback para evento sem dt_maxima
        * ou ainda não classificado.
        */
        '#c8c8c8',
      ],

      'fill-opacity':
        0.55,

      'line-color': [
        'match',

        [
          'get',
          'fire_age_class',
        ],

        'up-to-24h',
        '#b91c1c',

        '24-to-48h',
        '#c26700',

        '48-to-96h',
        '#dc7c7a',

        'over-96h',
        '#888888',

        '#888888',
      ],

      'line-width':
        1.25,

      'line-opacity':
        0.95,
    },
    markerColor: '#ef4444',
  },
  {
    id:
      'fire-events-markers',

    title:
      'Marcadores dos eventos',

    group:
      LAYER_GROUPS.FIRE,

    sourceType:
      'geojson',

    geometryType:
      'point',

    /*
    * Força o MapLibre a criar uma layer symbol,
    * e não uma layer circle.
    */
    mapLayerType:
      'symbol',

    symbol:
      true,

    defaultVisible:
      true,

    minZoom:
      5,

    maxZoom:
      22,

    zIndex:
      51,

    opacity:
      1,

    cachePolicy:
      'network-first',

    interactive:
      true,

    derivedFrom:
      'fire-events',

    layout: {
      /*
      * Escolhe um marcador da mesma cor usada
      * na classificação temporal do evento.
      */
      'icon-image': [
        'match',

        [
          'get',
          'fire_age_class',
        ],

        'up-to-24h',
        'fire-event-pin-red',

        '24-to-48h',
        'fire-event-pin-orange',

        '48-to-96h',
        'fire-event-pin-pink',

        'over-96h',
        'fire-event-pin-gray',

        'fire-event-pin-gray',
      ],

      'icon-size':
        0.72,

      /*
      * A ponta inferior do marcador representa
      * a coordenada real do evento.
      */
      'icon-anchor':
        'bottom',

      'icon-allow-overlap':
        true,

      'icon-ignore-placement':
        true,
    },

    paint: {
      'icon-opacity':
        1,
    },
  },
  {
    id:
      'fire-fronts',

    title:
      'Frentes de fogo',

    group:
      LAYER_GROUPS.FIRE,

    sourceType:
      'geojson',

    /*
    * A camada mv_deteccoes_classificadas
    * retorna Polygon.
    */
    geometryType:
      'polygon',

    defaultVisible:
      false,

    minZoom:
      5,

    maxZoom:
      22,

    zIndex:
      45,

    opacity:
      1,

    cachePolicy:
      'network-first',

    interactive:
      true,

    paint: {
      /*
      * Classificação oficial do SIPAM:
      *
      * 2 = detecção entre 6 e 12 horas
      * 1 = detecção entre 12 e 24 horas
      * 0 = detecção há mais de 24 horas
      */
      'fill-color': [
        'match',

        [
          'to-number',
          [
            'get',
            'classe',
          ],
        ],

        2,
        '#d96b0b',

        1,
        '#e9ad18',

        0,
        '#808080',

        /*
        * Fallback para feição sem classe válida.
        */
        '#808080',
      ],

      'fill-opacity':
        0.78,

      /*
      * O contorno segue a mesma classificação,
      * utilizando tons um pouco mais escuros.
      */
      'line-color': [
        'match',

        [
          'to-number',
          [
            'get',
            'classe',
          ],
        ],

        2,
        '#a94700',

        1,
        '#b98100',

        0,
        '#5f5f5f',

        '#5f5f5f',
      ],

      'line-width':
        1.2,

      'line-opacity':
        0.95,
    },
  },
  {
    id: 'alert-buffers',
    title: 'Buffer de alertas',
    group: LAYER_GROUPS.FIRE,
    sourceType: 'geojson',
    geometryType: 'polygon',
    defaultVisible: false,
    minZoom: 5,
    maxZoom: 22,
    zIndex: 45,
    opacity: 0.15,
    cachePolicy: 'local-first',
    interactive: false,
    paint: {
      'fill-color': '#f97316',
      'fill-opacity': 0.12,
      'line-color': '#f97316',
      'line-width': 0.5,
      'line-opacity': 0.4,
      'line-dasharray': [2, 2],
    },
  },
  {
    id: 'field-trail',
    title: 'Trilha do Modo Campo',
    group: LAYER_GROUPS.RESOURCES,
    sourceType: 'geojson',
    geometryType: 'linestring',
    defaultVisible: true,
    minZoom: 5,
    maxZoom: 22,
    zIndex: 60,
    opacity: 1,
    cachePolicy: 'local-first',
    interactive: false,
    paint: {
      'line-color': '#3b82f6',
      'line-width': 3,
      'line-opacity': 0.9,
    },
  },
  {
    id: 'field-points',
    title: 'Pontos do Modo Campo',
    group: LAYER_GROUPS.RESOURCES,
    sourceType: 'geojson',
    geometryType: 'point',
    defaultVisible: true,
    minZoom: 5,
    maxZoom: 22,
    zIndex: 61,
    opacity: 1,
    cachePolicy: 'local-first',
    interactive: true,
    paint: {
      'circle-radius': 5,
      'circle-color': '#3b82f6',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  },
  {
    id: 'field-position',
    title: 'Posição atual (Modo Campo)',
    group: LAYER_GROUPS.RESOURCES,
    sourceType: 'geojson',
    geometryType: 'point',
    defaultVisible: true,
    minZoom: 1,
    maxZoom: 22,
    zIndex: 70,
    opacity: 1,
    cachePolicy: 'local-first',
    interactive: false,
    paint: {
      'circle-radius': 8,
      'circle-color': '#2563eb',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 3,
    },
  },
];