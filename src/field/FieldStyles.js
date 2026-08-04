/**
 * FieldStyles
 *
 * Catálogo central de estilos visuais do módulo Campo.
 *
 * Responsabilidades:
 * - definir a aparência padrão de cada categoria de marcador;
 * - definir a aparência padrão dos trilhos;
 * - normalizar estilos carregados do armazenamento;
 * - permitir personalizações sem misturar aparência
 *   com as regras operacionais.
 *
 * Nesta fase, os estilos já serão persistidos nos dados,
 * mas o MapLibre ainda não os utilizará.
 */

export const FIELD_MARKER_ICON = {
  FLAME:
    'flame',

  VEHICLE:
    'vehicle',

  WATER:
    'water',

  BLOCKAGE:
    'blockage',

  RISK:
    'risk',

  SERVICE:
    'service',

  OBSERVATION:
    'observation',
};

export const FIELD_MARKER_SIZE = {
  SMALL:
    'small',

  MEDIUM:
    'medium',

  LARGE:
    'large',
};

export const FIELD_TRAIL_PATTERN = {
  SOLID:
    'solid',

  DASHED:
    'dashed',
};

/**
 * Presets padrão por categoria.
 *
 * As chaves correspondem aos valores usados em
 * FIELD_POINT_CATEGORY.
 */
export const MARKER_STYLE_PRESETS = {
  'active-fire': {
    preset:
      'active-fire',

    iconId:
      FIELD_MARKER_ICON.FLAME,

    color:
      '#dc2626',

    size:
      FIELD_MARKER_SIZE.MEDIUM,
  },

  vehicle: {
    preset:
      'vehicle',

    iconId:
      FIELD_MARKER_ICON.VEHICLE,

    color:
      '#f97316',

    size:
      FIELD_MARKER_SIZE.MEDIUM,
  },

  'water-source': {
    preset:
      'water-source',

    iconId:
      FIELD_MARKER_ICON.WATER,

    color:
      '#2563eb',

    size:
      FIELD_MARKER_SIZE.MEDIUM,
  },

  blockage: {
    preset:
      'blockage',

    iconId:
      FIELD_MARKER_ICON.BLOCKAGE,

    color:
      '#eab308',

    size:
      FIELD_MARKER_SIZE.MEDIUM,
  },

  risk: {
    preset:
      'risk',

    iconId:
      FIELD_MARKER_ICON.RISK,

    color:
      '#991b1b',

    size:
      FIELD_MARKER_SIZE.MEDIUM,
  },

  service: {
    preset:
      'service',

    iconId:
      FIELD_MARKER_ICON.SERVICE,

    color:
      '#16a34a',

    size:
      FIELD_MARKER_SIZE.MEDIUM,
  },

  observation: {
    preset:
      'observation',

    iconId:
      FIELD_MARKER_ICON.OBSERVATION,

    color:
      '#7c3aed',

    size:
      FIELD_MARKER_SIZE.MEDIUM,
  },
};

export const DEFAULT_MARKER_STYLE = {
  ...MARKER_STYLE_PRESETS.observation,
};

export const DEFAULT_TRAIL_STYLE = {
  color:
    '#16a34a',

  width:
    4,

  opacity:
    0.9,

  linePattern:
    FIELD_TRAIL_PATTERN.SOLID,
};

const VALID_MARKER_SIZES =
  new Set(
    Object.values(
      FIELD_MARKER_SIZE,
    ),
  );

const VALID_TRAIL_PATTERNS =
  new Set(
    Object.values(
      FIELD_TRAIL_PATTERN,
    ),
  );

function isHexColor(
  value,
) {
  return (
    typeof value ===
      'string' &&
    /^#[0-9a-fA-F]{6}$/.test(
      value,
    )
  );
}

function cloneStyle(
  style,
) {
  return {
    ...style,
  };
}

/**
 * Retorna uma cópia do preset associado à categoria.
 */
export function getMarkerStylePreset(
  category,
) {
  const preset =
    MARKER_STYLE_PRESETS[
      category
    ] ||
    DEFAULT_MARKER_STYLE;

  return cloneStyle(
    preset,
  );
}

/**
 * Normaliza o estilo de um marcador.
 *
 * Estilos antigos ou incompletos recebem os valores
 * padrão da categoria.
 */
export function normalizeMarkerStyle(
  style,
  category =
    'observation',
) {
  const preset =
    getMarkerStylePreset(
      category,
    );

  const source =
    style &&
    typeof style ===
      'object'
      ? style
      : {};

  return {
    preset:
      typeof source.preset ===
        'string' &&
      source.preset.trim()
        ? source.preset
        : preset.preset,

    iconId:
      typeof source.iconId ===
        'string' &&
      source.iconId.trim()
        ? source.iconId
        : preset.iconId,

    color:
      isHexColor(
        source.color,
      )
        ? source.color
        : preset.color,

    size:
      VALID_MARKER_SIZES.has(
        source.size,
      )
        ? source.size
        : preset.size,
  };
}

/**
 * Normaliza o estilo visual de um trilho.
 */
export function normalizeTrailStyle(
  style,
) {
  const source =
    style &&
    typeof style ===
      'object'
      ? style
      : {};

  const numericWidth =
    Number(
      source.width,
    );

  const numericOpacity =
    Number(
      source.opacity,
    );

  return {
    color:
      isHexColor(
        source.color,
      )
        ? source.color
        : DEFAULT_TRAIL_STYLE.color,

    width:
      Number.isFinite(
        numericWidth,
      ) &&
      numericWidth >= 1 &&
      numericWidth <= 12
        ? numericWidth
        : DEFAULT_TRAIL_STYLE.width,

    opacity:
      Number.isFinite(
        numericOpacity,
      ) &&
      numericOpacity >= 0 &&
      numericOpacity <= 1
        ? numericOpacity
        : DEFAULT_TRAIL_STYLE.opacity,

    linePattern:
      VALID_TRAIL_PATTERNS.has(
        source.linePattern,
      )
        ? source.linePattern
        : DEFAULT_TRAIL_STYLE.linePattern,
  };
}