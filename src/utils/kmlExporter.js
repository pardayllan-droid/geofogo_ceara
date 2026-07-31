/**
 * kmlExporter
 *
 * Converte uma feição GeoJSON selecionada para KML
 * e inicia o download diretamente no navegador.
 *
 * Suporta:
 * - Point
 * - MultiPoint
 * - LineString
 * - MultiLineString
 * - Polygon
 * - MultiPolygon
 */

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function sanitizeFileName(value) {
  return String(value || 'feicao')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'feicao';
}

function coordinateToKml(coordinate) {
  if (
    !Array.isArray(coordinate) ||
    coordinate.length < 2
  ) {
    return '';
  }

  const longitude = Number(coordinate[0]);
  const latitude = Number(coordinate[1]);
  const altitude = Number(coordinate[2] ?? 0);

  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude)
  ) {
    return '';
  }

  return `${longitude},${latitude},${
    Number.isFinite(altitude)
      ? altitude
      : 0
  }`;
}

function coordinatesToKml(coordinates) {
  if (!Array.isArray(coordinates)) {
    return '';
  }

  return coordinates
    .map(coordinateToKml)
    .filter(Boolean)
    .join(' ');
}

function pointToKml(coordinates) {
  const coordinate =
    coordinateToKml(coordinates);

  if (!coordinate) {
    return '';
  }

  return `
    <Point>
      <coordinates>${coordinate}</coordinates>
    </Point>
  `;
}

function lineStringToKml(coordinates) {
  const coordinateText =
    coordinatesToKml(coordinates);

  if (!coordinateText) {
    return '';
  }

  return `
    <LineString>
      <tessellate>1</tessellate>
      <coordinates>${coordinateText}</coordinates>
    </LineString>
  `;
}

function polygonToKml(coordinates) {
  if (
    !Array.isArray(coordinates) ||
    coordinates.length === 0
  ) {
    return '';
  }

  const outerRing =
    coordinatesToKml(coordinates[0]);

  if (!outerRing) {
    return '';
  }

  const innerBoundaries =
    coordinates
      .slice(1)
      .map((ring) => {
        const ringCoordinates =
          coordinatesToKml(ring);

        if (!ringCoordinates) {
          return '';
        }

        return `
          <innerBoundaryIs>
            <LinearRing>
              <coordinates>${ringCoordinates}</coordinates>
            </LinearRing>
          </innerBoundaryIs>
        `;
      })
      .join('');

  return `
    <Polygon>
      <tessellate>1</tessellate>

      <outerBoundaryIs>
        <LinearRing>
          <coordinates>${outerRing}</coordinates>
        </LinearRing>
      </outerBoundaryIs>

      ${innerBoundaries}
    </Polygon>
  `;
}

function multiGeometryToKml(
  geometries,
) {
  const content =
    geometries
      .filter(Boolean)
      .join('');

  if (!content) {
    return '';
  }

  return `
    <MultiGeometry>
      ${content}
    </MultiGeometry>
  `;
}

function geometryToKml(geometry) {
  if (!geometry) {
    return '';
  }

  const {
    type,
    coordinates,
  } = geometry;

  switch (type) {
    case 'Point':
      return pointToKml(
        coordinates,
      );

    case 'MultiPoint':
      return multiGeometryToKml(
        coordinates.map(
          pointToKml,
        ),
      );

    case 'LineString':
      return lineStringToKml(
        coordinates,
      );

    case 'MultiLineString':
      return multiGeometryToKml(
        coordinates.map(
          lineStringToKml,
        ),
      );

    case 'Polygon':
      return polygonToKml(
        coordinates,
      );

    case 'MultiPolygon':
      return multiGeometryToKml(
        coordinates.map(
          polygonToKml,
        ),
      );

    default:
      throw new Error(
        `Geometria não suportada para KML: ${type}`,
      );
  }
}

function createDescription(
  properties = {},
) {
  const rows = [
    [
      'Município',
      properties.municipio ||
        properties.municipality ||
        properties.nome_municipio,
    ],

    [
      'Área informada',
      properties.area_total_evento,
    ],

    [
      'Persistência',
      properties.persistencia_dias,
    ],

    [
      'Quantidade de detecções',
      properties.qtd_deteccoes,
    ],

    [
      'Primeira detecção',
      properties.dt_minima,
    ],

    [
      'Última detecção',
      properties.dt_maxima,
    ],

    [
      'Unidade de Conservação',
      properties.nome_unidade_conservacao,
    ],
  ];

  const tableRows =
    rows
      .filter(
        ([, value]) =>
          value !== undefined &&
          value !== null &&
          String(value).trim() !== '',
      )
      .map(
        ([label, value]) => `
          <tr>
            <td><strong>${escapeXml(label)}</strong></td>
            <td>${escapeXml(value)}</td>
          </tr>
        `,
      )
      .join('');

  return `
    <![CDATA[
      <table>
        ${tableRows}
      </table>
    ]]>
  `;
}

export function createFeatureKml(
  feature,
  {
    name,
  } = {},
) {
  if (
    feature?.type !== 'Feature' ||
    !feature.geometry
  ) {
    throw new Error(
      'Não foi informada uma feição GeoJSON válida.',
    );
  }

  const properties =
    feature.properties || {};

  const placemarkName =
    name ||
    properties.municipio ||
    properties.municipality ||
    properties.nome ||
    'Evento de fogo';

  const geometry =
    geometryToKml(
      feature.geometry,
    );

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(placemarkName)}</name>

    <Style id="fire-event-style">
      <LineStyle>
        <color>ff2323ff</color>
        <width>2</width>
      </LineStyle>

      <PolyStyle>
        <color>662323ff</color>
        <fill>1</fill>
        <outline>1</outline>
      </PolyStyle>
    </Style>

    <Placemark>
      <name>${escapeXml(placemarkName)}</name>
      <description>${createDescription(properties)}</description>
      <styleUrl>#fire-event-style</styleUrl>

      ${geometry}
    </Placemark>
  </Document>
</kml>`;
}

export function downloadFeatureAsKml(
  feature,
  {
    name,
    fileName,
  } = {},
) {
  const properties =
    feature?.properties || {};

  const displayName =
    name ||
    properties.municipio ||
    properties.municipality ||
    properties.nome ||
    'evento-de-fogo';

  const kml =
    createFeatureKml(
      feature,
      {
        name: displayName,
      },
    );

  const blob =
    new Blob(
      [kml],
      {
        type:
          'application/vnd.google-earth.kml+xml;charset=utf-8',
      },
    );

  const objectUrl =
    URL.createObjectURL(blob);

  const anchor =
    document.createElement('a');

  anchor.href = objectUrl;

  anchor.download =
    `${sanitizeFileName(
      fileName || displayName,
    )}.kml`;

  document.body.appendChild(
    anchor,
  );

  anchor.click();
  anchor.remove();

  window.setTimeout(
    () => {
      URL.revokeObjectURL(
        objectUrl,
      );
    },
    1000,
  );
}