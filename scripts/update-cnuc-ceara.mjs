/**
 * Atualiza as Unidades de Conservação do Ceará a partir
 * do conjunto oficial do CNUC/MMA.
 *
 * Fluxo:
 * 1. consulta a API CKAN do Portal de Dados Abertos do MMA;
 * 2. localiza o shapefile mais recente do CNUC;
 * 3. baixa o ZIP;
 * 4. converte SHP/DBF para GeoJSON;
 * 5. filtra as UCs relacionadas ao Ceará;
 * 6. grava o resultado em public/data/cnuc/ucs-ceara.geojson.
 *
 * Requisitos:
 * - Node.js 18 ou superior;
 * - npm install --save-dev shpjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import shp from 'shpjs';

const PUBLIC_FALLBACK_RESOURCE = {
  name: 'Polígono CNUC 2025_08',
  format: 'ZIP',
  url:
    'https://dados.mma.gov.br/dataset/' +
    '44b6dc8a-dc82-4a84-8d95-1b0da7c85dac/' +
    'resource/6ba9a557-87e8-4882-acb7-b3e0f0ea192d/' +
    'download/shp_cnuc_2025_08.zip',
  yearMonth: 202508,
};

const __filename = fileURLToPath(
  import.meta.url,
);

const __dirname = path.dirname(
  __filename,
);

const PROJECT_ROOT = path.resolve(
  __dirname,
  '..',
);

const OUTPUT_DIRECTORY = path.join(
  PROJECT_ROOT,
  'public',
  'data',
  'cnuc',
);

const OUTPUT_FILE = path.join(
  OUTPUT_DIRECTORY,
  'ucs-ceara.geojson',
);

const METADATA_FILE = path.join(
  OUTPUT_DIRECTORY,
  'metadata.json',
);

const CKAN_PACKAGE_URL =
  'https://dados.mma.gov.br/api/3/action/package_show?id=unidadesdeconservacao';

const CEARA_BBOX = {
  west: -41.4215,
  south: -7.8575,
  east: -37.2532,
  north: -2.7845,
};

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      '',
    )
    .trim()
    .toLowerCase();
}

function normalizeKey(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]/g, '');
}

function getProperty(
  properties,
  candidateNames,
) {
  if (
    !properties ||
    typeof properties !== 'object'
  ) {
    return undefined;
  }

  const entries =
    Object.entries(properties);

  for (
    const candidate
    of candidateNames
  ) {
    const normalizedCandidate =
      normalizeKey(candidate);

    const match = entries.find(
      ([key]) =>
        normalizeKey(key) ===
        normalizedCandidate,
    );

    if (match) {
      return match[1];
    }
  }

  return undefined;
}

function isFeatureCollection(value) {
  return (
    value?.type ===
      'FeatureCollection' &&
    Array.isArray(value.features)
  );
}

function normalizeShapefileResult(
  value,
) {
  if (isFeatureCollection(value)) {
    return value;
  }

  /*
   * shpjs pode devolver um array quando o ZIP contém
   * mais de um shapefile.
   */
  if (Array.isArray(value)) {
    const polygonCollections =
      value.filter(
        (collection) =>
          isFeatureCollection(
            collection,
          ) &&
          collection.features.some(
            (feature) => {
              const type =
                feature?.geometry?.type;

              return (
                type === 'Polygon' ||
                type ===
                  'MultiPolygon'
              );
            },
          ),
      );

    if (
      polygonCollections.length === 0
    ) {
      throw new Error(
        'Nenhuma coleção de polígonos foi encontrada no ZIP do CNUC.',
      );
    }

    return {
      type: 'FeatureCollection',

      features:
        polygonCollections.flatMap(
          (collection) =>
            collection.features,
        ),
    };
  }

  throw new Error(
    'O shapefile não pôde ser convertido em uma FeatureCollection.',
  );
}

function walkCoordinates(
  coordinates,
  callback,
) {
  if (!Array.isArray(coordinates)) {
    return;
  }

  if (
    coordinates.length >= 2 &&
    Number.isFinite(
      Number(coordinates[0]),
    ) &&
    Number.isFinite(
      Number(coordinates[1]),
    )
  ) {
    callback(
      Number(coordinates[0]),
      Number(coordinates[1]),
    );

    return;
  }

  for (const item of coordinates) {
    walkCoordinates(
      item,
      callback,
    );
  }
}

function calculateGeometryBbox(
  geometry,
) {
  if (!geometry?.coordinates) {
    return null;
  }

  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  walkCoordinates(
    geometry.coordinates,
    (longitude, latitude) => {
      west = Math.min(
        west,
        longitude,
      );

      south = Math.min(
        south,
        latitude,
      );

      east = Math.max(
        east,
        longitude,
      );

      north = Math.max(
        north,
        latitude,
      );
    },
  );

  if (
    !Number.isFinite(west) ||
    !Number.isFinite(south) ||
    !Number.isFinite(east) ||
    !Number.isFinite(north)
  ) {
    return null;
  }

  return {
    west,
    south,
    east,
    north,
  };
}

function bboxIntersects(
  first,
  second,
) {
  return !(
    first.east < second.west ||
    first.west > second.east ||
    first.north < second.south ||
    first.south > second.north
  );
}

function propertyIndicatesCeara(
  properties,
) {
  const ufValue = getProperty(
    properties,
    [
      'uf',
      'sigla_uf',
      'estado',
      'unidade_federacao',
      'cd_uf',
      'codigo_uf',
    ],
  );

  if (
    ufValue !== undefined &&
    ufValue !== null
  ) {
    const normalized =
      normalizeText(ufValue);

    if (
      normalized === 'ce' ||
      normalized === '23' ||
      normalized === 'ceara'
    ) {
      return true;
    }

    /*
     * Algumas UCs abrangem mais de um estado:
     * "CE, PI", "CE/PI", "CE;PI".
     */
    const parts = normalized
      .split(
        /[,;/|]+/,
      )
      .map((part) =>
        part.trim(),
      );

    if (
      parts.includes('ce') ||
      parts.includes('ceara')
    ) {
      return true;
    }
  }

  const municipalityValue =
    getProperty(
      properties,
      [
        'municipio',
        'municipios',
        'município',
        'municípios',
      ],
    );

  if (municipalityValue) {
    /*
     * Não tentamos manter uma lista dos 184 municípios.
     * O município funciona somente como pista auxiliar.
     */
    const normalized =
      normalizeText(
        municipalityValue,
      );

    if (
      normalized.includes(
        '(ce)',
      ) ||
      normalized.includes(
        ' - ce',
      )
    ) {
      return true;
    }
  }

  return false;
}

function featureBelongsToCeara(
  feature,
) {
  if (
    propertyIndicatesCeara(
      feature?.properties,
    )
  ) {
    return true;
  }

  const featureBbox =
    calculateGeometryBbox(
      feature?.geometry,
    );

  if (!featureBbox) {
    return false;
  }

  /*
   * O recorte definitivo pelo polígono estadual será
   * feito pelo AppCore. Aqui usamos o BBOX para reduzir
   * o arquivo antes de colocá-lo na PWA.
   */
  return bboxIntersects(
    featureBbox,
    CEARA_BBOX,
  );
}

function normalizeProperties(
  properties = {},
) {
  const normalized = {
    ...properties,
  };

  normalized.nome_uc =
    getProperty(
      properties,
      [
        'nome_uc',
        'nome',
        'nome da uc',
        'nome_unidade',
      ],
    ) ??
    properties.nome_uc ??
    'Unidade de Conservação';

  normalized.esfera =
    getProperty(
      properties,
      [
        'esfera',
        'esfera administrativa',
        'jurisdicao',
      ],
    ) ??
    properties.esfera ??
    null;

  normalized.categoria =
    getProperty(
      properties,
      [
        'categoria',
        'categoria de manejo',
        'cat_manejo',
      ],
    ) ??
    properties.categoria ??
    null;

  normalized.grupo =
    getProperty(
      properties,
      [
        'grupo',
        'grupo de manejo',
      ],
    ) ??
    properties.grupo ??
    null;

  normalized.org_gestor =
    getProperty(
      properties,
      [
        'org_gestor',
        'orgao_gestor',
        'órgão gestor',
      ],
    ) ??
    properties.org_gestor ??
    null;

  normalized.uf =
    getProperty(
      properties,
      [
        'uf',
        'sigla_uf',
        'estado',
      ],
    ) ??
    properties.uf ??
    null;

  normalized.municipio =
    getProperty(
      properties,
      [
        'municipio',
        'municipios',
        'município',
      ],
    ) ??
    properties.municipio ??
    null;

  normalized.ha_total =
    getProperty(
      properties,
      [
        'ha_total',
        'area_ha',
        'área em ha',
        'area total',
      ],
    ) ??
    properties.ha_total ??
    null;

  normalized.cd_cnuc =
    getProperty(
      properties,
      [
        'cd_cnuc',
        'codigo_cnuc',
        'código cnuc',
      ],
    ) ??
    properties.cd_cnuc ??
    null;

  return normalized;
}

function normalizeFeature(
  feature,
  index,
) {
  return {
    type: 'Feature',

    id:
      feature.id ??
      getProperty(
        feature.properties,
        [
          'cd_cnuc',
          'codigo_cnuc',
          'uc_id',
        ],
      ) ??
      `cnuc-ce-${index + 1}`,

    properties:
      normalizeProperties(
        feature.properties,
      ),

    geometry:
      feature.geometry,
  };
}

function resourceScore(
  resource,
) {
  const combined = normalizeText(
    [
      resource?.name,
      resource?.description,
      resource?.format,
      resource?.url,
    ].join(' '),
  );

  let score = 0;

  if (
    combined.includes('2026')
  ) {
    score += 1000;
  }

  if (
    combined.includes('cnuc')
  ) {
    score += 200;
  }

  if (
    combined.includes('poligono') ||
    combined.includes('polígono')
  ) {
    score += 100;
  }

  if (
    combined.includes('shp') ||
    combined.includes('shapefile')
  ) {
    score += 80;
  }

  if (
    combined.includes('zip')
  ) {
    score += 50;
  }

  if (
    resource?.url
      ?.toLowerCase()
      .includes('.zip')
  ) {
    score += 50;
  }

  return score;
}

function extractYearMonth(
  resource,
) {
  const text = [
    resource?.name,
    resource?.description,
    resource?.url,
    resource?.created,
    resource?.last_modified,
  ].join(' ');

  const matches = [
    ...text.matchAll(
      /(20\d{2})[_\-. /](0?[1-9]|1[0-2])/g,
    ),
  ];

  if (matches.length === 0) {
    return 0;
  }

  return Math.max(
    ...matches.map(
      (match) =>
        Number(match[1]) * 100 +
        Number(match[2]),
    ),
  );
}

function selectLatestShapefileResource(
  resources,
) {
  const candidates = resources
    .filter((resource) => {
      const combined =
        normalizeText(
          [
            resource?.name,
            resource?.description,
            resource?.format,
            resource?.url,
          ].join(' '),
        );

      return (
        combined.includes('zip') ||
        combined.includes('shp') ||
        combined.includes(
          'shapefile',
        )
      );
    })
    .map((resource) => ({
      ...resource,

      score:
        resourceScore(resource),

      yearMonth:
        extractYearMonth(
          resource,
        ),
    }))
    .sort((first, second) => {
      if (
        second.yearMonth !==
        first.yearMonth
      ) {
        return (
          second.yearMonth -
          first.yearMonth
        );
      }

      return (
        second.score -
        first.score
      );
    });

  if (candidates.length === 0) {
    throw new Error(
      'Nenhum recurso SHP/ZIP foi encontrado no conjunto do CNUC.',
    );
  }

  return candidates[0];
}

async function fetchJson(
  url,
) {
  const response =
    await fetch(url, {
      headers: {
        Accept:
          'application/json',
      },
    });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ao consultar ${url}`,
    );
  }

  return response.json();
}

async function downloadArrayBuffer(
  resource,
) {
  console.info(
    `Baixando recurso: ${resource.url}`,
  );

  const response =
    await fetch(resource.url, {
      redirect: 'follow',

      headers: {
        Accept:
          'application/zip, application/octet-stream, */*',

        'User-Agent':
          'GeoFogo-Ceara-CNUC-Updater/1.0',
      },
    });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ao baixar ${resource.name}.`,
    );
  }

  const contentType =
    response.headers
      .get('content-type')
      ?.toLowerCase() || '';

  /*
   * SharePoint frequentemente redireciona para uma
   * página de login HTML em vez de entregar o ZIP.
   */
  if (
    contentType.includes('text/html')
  ) {
    throw new Error(
      `${resource.name} retornou HTML em vez do arquivo ZIP.`,
    );
  }

  const buffer =
    await response.arrayBuffer();

  /*
   * ZIP começa normalmente com:
   * 50 4B — caracteres "PK".
   */
  const signature =
    new Uint8Array(
      buffer.slice(0, 2),
    );

  if (
    signature[0] !== 0x50 ||
    signature[1] !== 0x4b
  ) {
    throw new Error(
      `${resource.name} não retornou um arquivo ZIP válido.`,
    );
  }

  return buffer;
}

async function main() {
  console.info(
    'Consultando o Portal de Dados Abertos do MMA...',
  );

  const packageResponse =
    await fetchJson(
      CKAN_PACKAGE_URL,
    );

  if (
    !packageResponse?.success ||
    !packageResponse?.result
  ) {
    throw new Error(
      'A API CKAN não retornou o conjunto do CNUC.',
    );
  }

  const dataset =
    packageResponse.result;

  const resource =
    selectLatestShapefileResource(
      dataset.resources ?? [],
    );

  console.info(
    'Recurso selecionado:',
    {
      name: resource.name,
      format: resource.format,
      url: resource.url,
      yearMonth:
        resource.yearMonth,
    },
  );

  let selectedResource =
  resource;

    let zipBuffer;

    try {
    zipBuffer =
        await downloadArrayBuffer(
        selectedResource,
        );
    } catch (error) {
    console.warn(
        '',
    );

    console.warn(
        `Não foi possível baixar ${selectedResource.name}:`,
        error.message,
    );

    const isSharePoint =
        selectedResource.url
        ?.toLowerCase()
        .includes(
            'sharepoint.com',
        );

    if (!isSharePoint) {
        throw error;
    }

    console.warn(
        'O recurso mais recente está protegido pelo SharePoint.',
    );

    console.warn(
        `Usando fallback público: ${PUBLIC_FALLBACK_RESOURCE.name}`,
    );

    selectedResource =
        PUBLIC_FALLBACK_RESOURCE;

    zipBuffer =
        await downloadArrayBuffer(
        selectedResource,
        );
    }

  console.info(
    'Convertendo shapefile para GeoJSON...',
  );

  const converted =
    await shp(zipBuffer);

  const fullCollection =
    normalizeShapefileResult(
      converted,
    );

  console.info(
    `Feições nacionais encontradas: ${fullCollection.features.length}`,
  );

  const cearaFeatures =
    fullCollection.features
      .filter(
        featureBelongsToCeara,
      )
      .filter(
        (feature) =>
          feature?.geometry &&
          (
            feature.geometry.type ===
              'Polygon' ||
            feature.geometry.type ===
              'MultiPolygon'
          ),
      )
      .map(
        normalizeFeature,
      );

  if (
    cearaFeatures.length === 0
  ) {
    throw new Error(
      'Nenhuma Unidade de Conservação relacionada ao Ceará foi encontrada.',
    );
  }

  const featureCollection = {
    type: 'FeatureCollection',

    metadata: {
      source:
        'Cadastro Nacional de Unidades de Conservação — CNUC/MMA',

      dataset:
        dataset.title,

        resource:
            selectedResource.name,

        resourceUrl:
            selectedResource.url,

        resourceYearMonth:
            selectedResource.yearMonth,

      generatedAt:
        new Date().toISOString(),

      bboxFilter:
        CEARA_BBOX,

      featureCount:
        cearaFeatures.length,
    },

    features:
      cearaFeatures,
  };

  await fs.mkdir(
    OUTPUT_DIRECTORY,
    {
      recursive: true,
    },
  );

  await fs.writeFile(
    OUTPUT_FILE,

    JSON.stringify(
      featureCollection,
    ),

    'utf8',
  );

  await fs.writeFile(
    METADATA_FILE,

    JSON.stringify(
      featureCollection.metadata,
      null,
      2,
    ),

    'utf8',
  );

  console.info(
    '',
  );

  console.info(
    'Atualização concluída.',
  );

  console.info(
    `UCs selecionadas: ${cearaFeatures.length}`,
  );

  console.info(
    `GeoJSON: ${OUTPUT_FILE}`,
  );

  console.info(
    `Metadados: ${METADATA_FILE}`,
  );
}

main().catch((error) => {
  console.error(
    '',
  );

  console.error(
    'Falha ao atualizar o CNUC:',
    error,
  );

  process.exitCode = 1;
});