/**
 * FieldExportCard
 *
 * Exportação dos dados atualmente carregados no
 * módulo Campo.
 */

import {
  Download,
  FileText,
} from 'lucide-react';

import {
  FieldController,
} from '../../field/FieldController';

function downloadTextFile({
  content,
  filename,
  mimeType,
}) {
  const blob =
    new Blob(
      [
        content,
      ],
      {
        type:
          mimeType,
      },
    );

  const url =
    URL.createObjectURL(
      blob,
    );

  const anchor =
    document.createElement(
      'a',
    );

  anchor.href =
    url;

  anchor.download =
    filename;

  document.body.appendChild(
    anchor,
  );

  anchor.click();
  anchor.remove();

  window.setTimeout(
    () => {
      URL.revokeObjectURL(
        url,
      );
    },
    0,
  );
}

export default function FieldExportCard({
  onError,
}) {
  function handleExport(
    format,
  ) {
    try {
      const timestamp =
        new Date()
          .toISOString()
          .replaceAll(
            ':',
            '-',
          );

      if (
        format ===
        'geojson'
      ) {
        downloadTextFile({
          content:
            FieldController
              .exportGeoJSON(),

          filename:
            `geofogo-campo-${timestamp}.geojson`,

          mimeType:
            'application/geo+json',
        });

        return;
      }

      downloadTextFile({
        content:
          FieldController
            .exportGPX(),

        filename:
          `geofogo-campo-${timestamp}.gpx`,

        mimeType:
          'application/gpx+xml',
      });
    } catch (error) {
      onError?.(
        error?.message ||
          'Não foi possível exportar os dados.',
      );
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <p className="mb-2 text-xs font-semibold">
        Exportar dados carregados
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            handleExport(
              'geojson',
            )
          }
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-medium transition-colors hover:bg-accent/80"
        >
          <FileText className="h-3.5 w-3.5" />

          GeoJSON
        </button>

        <button
          type="button"
          onClick={() =>
            handleExport(
              'gpx',
            )
          }
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-medium transition-colors hover:bg-accent/80"
        >
          <Download className="h-3.5 w-3.5" />

          GPX
        </button>
      </div>
    </section>
  );
}