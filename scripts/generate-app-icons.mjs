/**
 * Gera os ícones oficiais do GeoFogo Ceará.
 *
 * A identidade visual reproduz o ícone do cabeçalho:
 * - gradiente orange-500 → red-600;
 * - ícone Flame do lucide-react;
 * - chama branca;
 * - cantos arredondados.
 *
 * Arquivos gerados:
 * - public/favicon.svg
 * - public/icon-192-v2.png
 * - public/icon-512-v2.png
 * - public/icon-512-maskable-v2.png
 * - public/apple-touch-icon-v2.png
 */

import {
  mkdir,
  writeFile,
} from 'node:fs/promises';

import path from 'node:path';
import process from 'node:process';

import React from 'react';

import {
  renderToStaticMarkup,
} from 'react-dom/server';

import {
  Flame,
} from 'lucide-react';

import sharp from 'sharp';

const ROOT_DIRECTORY =
  process.cwd();

const PUBLIC_DIRECTORY =
  path.join(
    ROOT_DIRECTORY,
    'public',
  );

const COLORS = {
  orange:
    '#f97316',

  red:
    '#dc2626',

  white:
    '#ffffff',
};

/**
 * Renderiza o mesmo ícone Flame usado no AppShell.
 */
function createFlameSvg(
  size,
  strokeWidth,
) {
  return renderToStaticMarkup(
    React.createElement(
      Flame,
      {
        xmlns:
          'http://www.w3.org/2000/svg',

        width:
          size,

        height:
          size,

        viewBox:
          '0 0 24 24',

        fill:
          'none',

        color:
          COLORS.white,

        stroke:
          COLORS.white,

        strokeWidth,

        strokeLinecap:
          'round',

        strokeLinejoin:
          'round',
      },
    ),
  );
}

/**
 * SVG utilizado pelo favicon.
 */
function createFaviconSvg() {
  const flame =
    createFlameSvg(
      30,
      2.1,
    );

  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="64"
  height="64"
  viewBox="0 0 64 64"
>
  <defs>
    <linearGradient
      id="geofogo-gradient"
      x1="8"
      y1="6"
      x2="56"
      y2="58"
      gradientUnits="userSpaceOnUse"
    >
      <stop
        offset="0"
        stop-color="${COLORS.orange}"
      />
      <stop
        offset="1"
        stop-color="${COLORS.red}"
      />
    </linearGradient>
  </defs>

  <rect
    x="2"
    y="2"
    width="60"
    height="60"
    rx="15"
    fill="url(#geofogo-gradient)"
  />

  <g
    transform="translate(17 17)"
  >
    ${flame}
  </g>
</svg>
`.trim();
}

/**
 * Cria o fundo quadrado arredondado usado nos ícones
 * normais do PWA e no Apple Touch Icon.
 */
function createStandardBackgroundSvg(
  canvasSize,
) {
  const margin =
    Math.round(
      canvasSize *
        0.075,
    );

  const squareSize =
    canvasSize -
    margin *
      2;

  const radius =
    Math.round(
      squareSize *
        0.22,
    );

  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${canvasSize}"
  height="${canvasSize}"
  viewBox="0 0 ${canvasSize} ${canvasSize}"
>
  <defs>
    <linearGradient
      id="geofogo-gradient"
      x1="${margin}"
      y1="${margin}"
      x2="${canvasSize - margin}"
      y2="${canvasSize - margin}"
      gradientUnits="userSpaceOnUse"
    >
      <stop
        offset="0"
        stop-color="${COLORS.orange}"
      />
      <stop
        offset="1"
        stop-color="${COLORS.red}"
      />
    </linearGradient>
  </defs>

  <rect
    x="${margin}"
    y="${margin}"
    width="${squareSize}"
    height="${squareSize}"
    rx="${radius}"
    fill="url(#geofogo-gradient)"
  />
</svg>
`.trim();
}

/**
 * O ícone maskable usa o fundo até as bordas.
 *
 * Android e outros sistemas podem recortar o arquivo
 * como círculo, quadrado arredondado ou outra forma.
 */
function createMaskableBackgroundSvg(
  canvasSize,
) {
  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${canvasSize}"
  height="${canvasSize}"
  viewBox="0 0 ${canvasSize} ${canvasSize}"
>
  <defs>
    <linearGradient
      id="geofogo-gradient"
      x1="0"
      y1="0"
      x2="${canvasSize}"
      y2="${canvasSize}"
      gradientUnits="userSpaceOnUse"
    >
      <stop
        offset="0"
        stop-color="${COLORS.orange}"
      />
      <stop
        offset="1"
        stop-color="${COLORS.red}"
      />
    </linearGradient>
  </defs>

  <rect
    width="${canvasSize}"
    height="${canvasSize}"
    fill="url(#geofogo-gradient)"
  />
</svg>
`.trim();
}

async function createStandardPng(
  outputName,
  size,
) {
  const flameSize =
    Math.round(
      size *
        0.43,
    );

  const flameSvg =
    createFlameSvg(
      flameSize,
      2,
    );

  const backgroundSvg =
    createStandardBackgroundSvg(
      size,
    );

  await sharp(
    Buffer.from(
      backgroundSvg,
    ),
  )
    .composite([
      {
        input:
          Buffer.from(
            flameSvg,
          ),

        gravity:
          'centre',
      },
    ])
    .png({
      compressionLevel:
        9,

      adaptiveFiltering:
        true,
    })
    .toFile(
      path.join(
        PUBLIC_DIRECTORY,
        outputName,
      ),
    );
}

async function createMaskablePng() {
  const size =
    512;

  /**
   * Mantém a chama dentro da zona segura central.
   */
  const flameSize =
    190;

  const flameSvg =
    createFlameSvg(
      flameSize,
      2,
    );

  const backgroundSvg =
    createMaskableBackgroundSvg(
      size,
    );

  await sharp(
    Buffer.from(
      backgroundSvg,
    ),
  )
    .composite([
      {
        input:
          Buffer.from(
            flameSvg,
          ),

        gravity:
          'centre',
      },
    ])
    .png({
      compressionLevel:
        9,

      adaptiveFiltering:
        true,
    })
    .toFile(
      path.join(
        PUBLIC_DIRECTORY,
        'icon-512-maskable-v2.png',
      ),
    );
}

async function main() {
  await mkdir(
    PUBLIC_DIRECTORY,
    {
      recursive:
        true,
    },
  );

  await writeFile(
    path.join(
      PUBLIC_DIRECTORY,
      'favicon.svg',
    ),
    createFaviconSvg(),
    'utf8',
  );

  await createStandardPng(
    'icon-192-v2.png',
    192,
  );

  await createStandardPng(
    'icon-512-v2.png',
    512,
  );

  await createStandardPng(
    'apple-touch-icon-v2.png',
    180,
  );

  await createMaskablePng();

  console.log(
    [
      '',
      'Ícones do GeoFogo Ceará gerados:',
      '',
      '  public/favicon.svg',
      '  public/icon-192-v2.png',
      '  public/icon-512-v2.png',
      '  public/icon-512-maskable-v2.png',
      '  public/apple-touch-icon-v2.png',
      '',
    ].join(
      '\n',
    ),
  );
}

main().catch(
  (error) => {
    console.error(
      'Falha ao gerar os ícones:',
      error,
    );

    process.exitCode =
      1;
  },
);