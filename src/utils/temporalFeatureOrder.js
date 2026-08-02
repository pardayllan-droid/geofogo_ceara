/**
 * temporalFeatureOrder
 *
 * Ordena feições temporais antes de enviá-las ao MapLibre.
 *
 * A ordem do array é:
 * - feições antigas primeiro;
 * - feições recentes por último.
 *
 * Assim, as mais recentes são renderizadas sobre as antigas.
 */

function isFeatureCollection(
  data,
) {
  return (
    data?.type ===
      'FeatureCollection' &&
    Array.isArray(data.features)
  );
}

function cloneWithSortedFeatures(
  collection,
  compareFunction,
) {
  if (!isFeatureCollection(collection)) {
    return {
      type: 'FeatureCollection',
      features: [],
    };
  }

  return {
    ...collection,

    features: [
      ...collection.features,
    ].sort(compareFunction),
  };
}

const FIRE_EVENT_AGE_PRIORITY = {
  unknown: -1,
  'over-96h': 0,
  '48-to-96h': 1,
  '24-to-48h': 2,
  'up-to-24h': 3,
};

/**
 * Ordena eventos de fogo:
 *
 * desconhecido
 * > 96 h
 * 48–96 h
 * 24–48 h
 * até 24 h
 */
export function sortFireEventsForRendering(
  collection,
) {
  return cloneWithSortedFeatures(
    collection,

    (
      firstFeature,
      secondFeature,
    ) => {
      const firstClass =
        firstFeature
          ?.properties
          ?.fire_age_class ||
        'unknown';

      const secondClass =
        secondFeature
          ?.properties
          ?.fire_age_class ||
        'unknown';

      const firstPriority =
        FIRE_EVENT_AGE_PRIORITY[
          firstClass
        ] ?? -1;

      const secondPriority =
        FIRE_EVENT_AGE_PRIORITY[
          secondClass
        ] ?? -1;

      if (
        firstPriority !==
        secondPriority
      ) {
        return (
          firstPriority -
          secondPriority
        );
      }

      /*
       * Na mesma classe, o evento com dt_maxima
       * mais recente fica por último.
       */
      const firstTimestamp =
        new Date(
          firstFeature
            ?.properties
            ?.dt_maxima ||
          0,
        ).getTime();

      const secondTimestamp =
        new Date(
          secondFeature
            ?.properties
            ?.dt_maxima ||
          0,
        ).getTime();

      return (
        firstTimestamp -
        secondTimestamp
      );
    },
  );
}

/**
 * Ordena Frentes de fogo pela classe oficial:
 *
 * classe 0 = mais de 24 h
 * classe 1 = 12–24 h
 * classe 2 = 6–12 h
 *
 * Na mesma classe, o maior intervalo é mais antigo
 * e deve ser desenhado antes.
 */
export function sortFireFrontsForRendering(
  collection,
) {
  return cloneWithSortedFeatures(
    collection,

    (
      firstFeature,
      secondFeature,
    ) => {
      const firstClass =
        Number(
          firstFeature
            ?.properties
            ?.classe,
        );

      const secondClass =
        Number(
          secondFeature
            ?.properties
            ?.classe,
        );

      const firstPriority =
        Number.isFinite(firstClass)
          ? firstClass
          : -1;

      const secondPriority =
        Number.isFinite(secondClass)
          ? secondClass
          : -1;

      if (
        firstPriority !==
        secondPriority
      ) {
        /*
         * 0 primeiro, depois 1 e finalmente 2.
         */
        return (
          firstPriority -
          secondPriority
        );
      }

      const firstInterval =
        Number(
          firstFeature
            ?.properties
            ?.intervalo,
        );

      const secondInterval =
        Number(
          secondFeature
            ?.properties
            ?.intervalo,
        );

      /*
       * Maior intervalo = mais antigo = primeiro.
       * Menor intervalo = mais recente = por último.
       */
      if (
        Number.isFinite(
          firstInterval,
        ) &&
        Number.isFinite(
          secondInterval,
        )
      ) {
        return (
          secondInterval -
          firstInterval
        );
      }

      return 0;
    },
  );
}