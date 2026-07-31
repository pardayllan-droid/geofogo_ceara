/**
 * Teste isolado da consulta de eventos de fogo do SIPAM.
 *
 * Uso:
 *
 * SIPAM_API_KEY="sua-chave" node scripts/test-sipam-events.mjs
 *
 * O script:
 * - consulta a mesma camada utilizada pelo GeoFogo;
 * - imprime status HTTP e Content-Type;
 * - verifica se a resposta é GeoJSON;
 * - mostra a quantidade de feições;
 * - mostra uma amostra segura da primeira feição;
 * - salva a resposta integral em um arquivo local.
 */

import {
  writeFile,
} from 'node:fs/promises';

const SIPAM_WFS_URL =
  'https://panorama.sipam.gov.br/geoserver/painel_do_fogo/ows';

const TYPE_NAME =
  'painel_do_fogo:mv_evento_filtro';

const CEARA_BBOX =
  '-41.4215,-7.8575,-37.2532,-2.7845';

const MAX_FEATURES = 500;
const TIMEOUT_MS = 45000;

const apiKey =
  process.env.SIPAM_API_KEY ||
  process.env.VITE_SIPAM_API_KEY ||
  '';

function buildUrl() {
  const params =
    new URLSearchParams({
      service: 'WFS',
      version: '1.0.0',
      request: 'GetFeature',
      typeName: TYPE_NAME,
      outputFormat:
        'application/json',
      srsName: 'EPSG:4326',
      bbox:
        `${CEARA_BBOX},EPSG:4326`,
      maxFeatures:
        String(MAX_FEATURES),
    });

  if (apiKey) {
    params.set(
      'api_key',
      apiKey,
    );
  }

  return `${SIPAM_WFS_URL}?${params.toString()}`;
}

function summarizeFeature(
  feature,
) {
  if (!feature) {
    return null;
  }

  return {
    id:
      feature.id ||
      feature.properties
        ?.id_evento ||
      feature.properties?.id ||
      null,

    geometryType:
      feature.geometry?.type ||
      null,

    properties:
      feature.properties
        ? {
            id_evento:
              feature.properties
                .id_evento,

            dt_minima:
              feature.properties
                .dt_minima,

            dt_maxima:
              feature.properties
                .dt_maxima,

            qtd_deteccoes:
              feature.properties
                .qtd_deteccoes,

            area_total_evento:
              feature.properties
                .area_total_evento,

            persistencia_dias:
              feature.properties
                .persistencia_dias,
          }
        : null,
  };
}

async function main() {
  const url = buildUrl();

  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(
      () => {
        const error =
          new Error(
            `Tempo limite de ${TIMEOUT_MS} ms excedido.`,
          );

        error.name =
          'TimeoutError';

        controller.abort(error);
      },
      TIMEOUT_MS,
    );

  console.log(
    '=== TESTE SIPAM — EVENTOS DE FOGO ===',
  );

  console.log(
    `Camada: ${TYPE_NAME}`,
  );

  console.log(
    `BBOX: ${CEARA_BBOX}`,
  );

  console.log(
    `Chave configurada: ${
      apiKey ? 'sim' : 'não'
    }`,
  );

  console.log('');

  try {
    const startedAt =
      Date.now();

    const response =
      await fetch(
        url,
        {
          headers: {
            Accept:
              'application/geo+json, application/json',
          },

          signal:
            controller.signal,
        },
      );

    const elapsedMs =
      Date.now() -
      startedAt;

    const contentType =
      response.headers
        .get('content-type') ||
      'não informado';

    const responseText =
      await response.text();

    await writeFile(
      'sipam-events-response.txt',
      responseText,
      'utf8',
    );

    console.log(
      `Status HTTP: ${response.status} ${response.statusText}`,
    );

    console.log(
      `Content-Type: ${contentType}`,
    );

    console.log(
      `Tempo da requisição: ${elapsedMs} ms`,
    );

    console.log(
      `Tamanho da resposta: ${responseText.length} caracteres`,
    );

    console.log('');

    if (!response.ok) {
      console.error(
        'RESULTADO: ERRO HTTP',
      );

      console.error(
        responseText.slice(
          0,
          1000,
        ),
      );

      process.exitCode = 1;
      return;
    }

    if (
      contentType
        .toLowerCase()
        .includes('xml') ||
      contentType
        .toLowerCase()
        .includes('html') ||
      responseText
        .trimStart()
        .startsWith('<')
    ) {
      console.error(
        'RESULTADO: O SIPAM NÃO RETORNOU GEOJSON.',
      );

      console.error(
        'Início da resposta:',
      );

      console.error(
        responseText.slice(
          0,
          1500,
        ),
      );

      process.exitCode = 1;
      return;
    }

    let data;

    try {
      data =
        JSON.parse(
          responseText,
        );
    } catch (error) {
      console.error(
        'RESULTADO: RESPOSTA NÃO É UM JSON VÁLIDO.',
      );

      console.error(
        error.message,
      );

      console.error(
        responseText.slice(
          0,
          1000,
        ),
      );

      process.exitCode = 1;
      return;
    }

    const validGeoJson =
      data?.type ===
        'FeatureCollection' &&
      Array.isArray(
        data.features,
      );

    if (!validGeoJson) {
      console.error(
        'RESULTADO: JSON RECEBIDO, MAS NÃO É UM FEATURECOLLECTION.',
      );

      console.error(
        JSON.stringify(
          data,
          null,
          2,
        ).slice(
          0,
          2000,
        ),
      );

      process.exitCode = 1;
      return;
    }

    console.log(
      'RESULTADO: CONSULTA CORRETA.',
    );

    console.log(
      `Feições retornadas: ${data.features.length}`,
    );

    console.log('');

    console.log(
      'Primeira feição:',
    );

    console.log(
      JSON.stringify(
        summarizeFeature(
          data.features[0],
        ),
        null,
        2,
      ),
    );

    console.log('');

    console.log(
      'Resposta integral salva em:',
    );

    console.log(
      'sipam-events-response.txt',
    );
  } catch (error) {
    console.error(
      'RESULTADO: FALHA NA REQUISIÇÃO.',
    );

    console.error(
      `Nome: ${error?.name || 'Error'}`,
    );

    console.error(
      `Mensagem: ${
        error?.message ||
        String(error)
      }`,
    );

    if (
      error?.cause
    ) {
      console.error(
        `Causa: ${
          error.cause
            ?.message ||
          String(error.cause)
        }`,
      );
    }

    process.exitCode = 1;
  } finally {
    clearTimeout(
      timeoutId,
    );
  }
}

main();