/**
 * CachePolicy
 *
 * Centraliza as regras de validade do cache do GeoFogo Ceará.
 *
 * Esta etapa não altera o comportamento da aplicação por si só.
 * O módulo apenas define:
 * - quais conjuntos de dados possuem cache;
 * - por quanto tempo cada cache é considerado válido;
 * - como verificar se um registro está ausente, válido ou vencido;
 * - como gerar informações legíveis para diagnóstico.
 */

const MINUTE_MS =
  60 * 1000;

const HOUR_MS =
  60 * MINUTE_MS;

const DAY_MS =
  24 * HOUR_MS;

/**
 * Políticas de cache da aplicação.
 *
 * Dados estáticos:
 * - limite do Ceará: 30 dias;
 * - municípios: 30 dias;
 * - Unidades de Conservação: 7 dias;
 * - Terras Indígenas: 7 dias.
 *
 * Dados dinâmicos:
 * - eventos de fogo: 15 minutos;
 * - frentes de fogo: 15 minutos;
 * - meteorologia: 45 minutos.
 *
 * Nesta primeira etapa, as políticas dinâmicas também ficam
 * registradas aqui, mas ainda não alteraremos o fluxo atual.
 */
export const CACHE_POLICIES =
  Object.freeze({
    boundary:
      Object.freeze({
        key:
          'boundary',

        label:
          'Limite do Ceará',

        category:
          'static',

        maxAgeMs:
          30 * DAY_MS,
      }),

    municipalities:
      Object.freeze({
        key:
          'municipalities',

        label:
          'Municípios',

        category:
          'static',

        maxAgeMs:
          30 * DAY_MS,
      }),

    conservationUnits:
      Object.freeze({
        key:
          'conservationUnits',

        label:
          'Unidades de Conservação',

        category:
          'static',

        maxAgeMs:
          7 * DAY_MS,
      }),

    indigenousLands:
      Object.freeze({
        key:
          'indigenousLands',

        label:
          'Terras Indígenas',

        category:
          'static',

        maxAgeMs:
          7 * DAY_MS,
      }),

    fireEvents:
      Object.freeze({
        key:
          'fireEvents',

        label:
          'Eventos de fogo',

        category:
          'dynamic',

        maxAgeMs:
          60 * MINUTE_MS,
      }),

    fireFronts:
      Object.freeze({
        key:
          'fireFronts',

        label:
          'Frentes de fogo',

        category:
          'dynamic',

        maxAgeMs:
          60 * MINUTE_MS,
      }),

    weather:
      Object.freeze({
        key:
          'weather',

        label:
          'Meteorologia',

        category:
          'dynamic',

        maxAgeMs:
          45 * MINUTE_MS,
      }),
  });

/**
 * Retorna uma política pelo nome.
 */
export function getCachePolicy(
  policyKey,
) {
  return (
    CACHE_POLICIES[
      policyKey
    ] ||
    null
  );
}

/**
 * Retorna todas as políticas de uma categoria.
 *
 * Categorias aceitas:
 * - static
 * - dynamic
 */
export function getCachePoliciesByCategory(
  category,
) {
  return Object.values(
    CACHE_POLICIES,
  ).filter(
    (policy) =>
      policy.category ===
      category,
  );
}

/**
 * Extrai a data de atualização de um registro do IndexedDB.
 *
 * Os serviços atuais utilizam principalmente:
 * - updated_date
 *
 * Os aliases abaixo deixam o módulo tolerante a registros
 * futuros ou legados.
 */
export function getCacheUpdatedAt(
  record,
) {
  const value =
    record?.updated_date ??
    record?.updatedAt ??
    record?.timestamp ??
    record?.metadata
      ?.updatedAt ??
    null;

  const numericValue =
    Number(value);

  if (
    Number.isFinite(
      numericValue,
    )
  ) {
    return numericValue;
  }

  if (
    typeof value ===
      'string' &&
    value.trim()
  ) {
    const parsed =
      new Date(
        value,
      ).getTime();

    return Number.isFinite(
      parsed,
    )
      ? parsed
      : null;
  }

  return null;
}

/**
 * Retorna a idade do cache em milissegundos.
 */
export function getCacheAgeMs(
  record,
  now = Date.now(),
) {
  const updatedAt =
    getCacheUpdatedAt(
      record,
    );

  const currentTime =
    Number(now);

  if (
    updatedAt === null ||
    !Number.isFinite(
      currentTime,
    )
  ) {
    return null;
  }

  return Math.max(
    0,
    currentTime -
      updatedAt,
  );
}

/**
 * Verifica se um registro possui dados utilizáveis.
 *
 * Aceita tanto FeatureCollection quanto outros formatos
 * futuros de cache.
 */
export function hasCachedData(
  record,
) {
  if (
    record === undefined ||
    record === null
  ) {
    return false;
  }

  const data =
    record?.data;

  if (
    data === undefined ||
    data === null
  ) {
    return false;
  }

  if (
    data?.type ===
      'FeatureCollection'
  ) {
    return Array.isArray(
      data.features,
    );
  }

  if (
    Array.isArray(data)
  ) {
    return true;
  }

  return (
    typeof data ===
    'object'
  );
}

/**
 * Verifica se um registro ainda está dentro do prazo
 * definido em uma política.
 */
export function isCacheFresh(
  record,
  policyOrKey,
  now = Date.now(),
) {
  const policy =
    typeof policyOrKey ===
      'string'
      ? getCachePolicy(
          policyOrKey,
        )
      : policyOrKey;

  if (
    !policy ||
    !Number.isFinite(
      policy.maxAgeMs,
    ) ||
    !hasCachedData(
      record,
    )
  ) {
    return false;
  }

  const ageMs =
    getCacheAgeMs(
      record,
      now,
    );

  if (ageMs === null) {
    return false;
  }

  return (
    ageMs <
    policy.maxAgeMs
  );
}

/**
 * Retorna true quando o cache deve ser atualizado.
 */
export function shouldRefreshCache(
  record,
  policyOrKey,
  {
    force =
      false,

    now =
      Date.now(),
  } = {},
) {
  if (force) {
    return true;
  }

  return !isCacheFresh(
    record,
    policyOrKey,
    now,
  );
}

/**
 * Retorna o estado detalhado de um cache.
 *
 * Possíveis estados:
 * - missing: registro ou dados ausentes;
 * - invalid: política inexistente ou data inválida;
 * - fresh: cache válido;
 * - stale: cache vencido.
 */
export function getCacheStatus(
  record,
  policyOrKey,
  now = Date.now(),
) {
  const policy =
    typeof policyOrKey ===
      'string'
      ? getCachePolicy(
          policyOrKey,
        )
      : policyOrKey;

  if (!policy) {
    return {
      status:
        'invalid',

      fresh:
        false,

      stale:
        false,

      missing:
        false,

      policy:
        null,

      updatedAt:
        null,

      ageMs:
        null,

      expiresAt:
        null,

      remainingMs:
        null,
    };
  }

  if (
    !hasCachedData(
      record,
    )
  ) {
    return {
      status:
        'missing',

      fresh:
        false,

      stale:
        false,

      missing:
        true,

      policy,

      updatedAt:
        getCacheUpdatedAt(
          record,
        ),

      ageMs:
        null,

      expiresAt:
        null,

      remainingMs:
        null,
    };
  }

  const updatedAt =
    getCacheUpdatedAt(
      record,
    );

  const ageMs =
    getCacheAgeMs(
      record,
      now,
    );

  if (
    updatedAt === null ||
    ageMs === null
  ) {
    return {
      status:
        'invalid',

      fresh:
        false,

      stale:
        false,

      missing:
        false,

      policy,

      updatedAt:
        null,

      ageMs:
        null,

      expiresAt:
        null,

      remainingMs:
        null,
    };
  }

  const expiresAt =
    updatedAt +
    policy.maxAgeMs;

  const remainingMs =
    expiresAt -
    Number(now);

  const fresh =
    remainingMs > 0;

  return {
    status:
      fresh
        ? 'fresh'
        : 'stale',

    fresh,

    stale:
      !fresh,

    missing:
      false,

    policy,

    updatedAt,

    ageMs,

    expiresAt,

    remainingMs:
      Math.max(
        0,
        remainingMs,
      ),
  };
}

/**
 * Formata uma duração para uso em diagnóstico.
 */
export function formatCacheDuration(
  milliseconds,
) {
  const value =
    Number(milliseconds);

  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    return '—';
  }

  if (value < MINUTE_MS) {
    const seconds =
      Math.floor(
        value / 1000,
      );

    return `${seconds} s`;
  }

  if (value < HOUR_MS) {
    const minutes =
      Math.floor(
        value /
          MINUTE_MS,
      );

    return `${minutes} min`;
  }

  if (value < DAY_MS) {
    const hours =
      Math.floor(
        value /
          HOUR_MS,
      );

    return `${hours} h`;
  }

  const days =
    Math.floor(
      value /
        DAY_MS,
    );

  return `${days} ${
    days === 1
      ? 'dia'
      : 'dias'
  }`;
}

/**
 * Gera um resumo amigável para o painel de diagnóstico.
 */
export function describeCacheStatus(
  record,
  policyOrKey,
  now = Date.now(),
) {
  const details =
    getCacheStatus(
      record,
      policyOrKey,
      now,
    );

  const label =
    details.policy
      ?.label ||
    'Cache';

  switch (
    details.status
  ) {
    case 'fresh':
      return {
        ...details,

        label,

        message:
          `${label}: válido por mais ${formatCacheDuration(
            details.remainingMs,
          )}.`,
      };

    case 'stale':
      return {
        ...details,

        label,

        message:
          `${label}: cache vencido há ${formatCacheDuration(
            Math.max(
              0,
              details.ageMs -
                details.policy
                  .maxAgeMs,
            ),
          )}.`,
      };

    case 'missing':
      return {
        ...details,

        label,

        message:
          `${label}: sem dados armazenados.`,
      };

    default:
      return {
        ...details,

        label,

        message:
          `${label}: estado do cache inválido.`,
      };
  }
}