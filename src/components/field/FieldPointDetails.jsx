/**
 * FieldPointDetails
 *
 * Exibe os detalhes persistidos de um marcador de campo.
 *
 * Pode ser utilizado tanto dentro de uma missão
 * quanto na aba Sem missão.
 */

import {
  CalendarClock,
  Compass,
  Crosshair,
  LocateFixed,
  MapPin,
  Mountain,
  Satellite,
  X,
  Download,
  FileJson,
} from 'lucide-react';
import {
  EventBus,
  EVENTS,
} from '../../core/EventBus';
import {
  FieldController,
} from '../../field/FieldController';

import {
  downloadFieldExport,
  getFieldExportDateStamp,
  slugifyFieldExportName,
} from './fieldExportUtils';

function formatNumber(
  value,
  digits =
    6,
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return '—';
  }

  const numeric =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      numeric,
    )
  ) {
    return '—';
  }

  return numeric.toLocaleString(
    'pt-BR',
    {
      minimumFractionDigits:
        digits,

      maximumFractionDigits:
        digits,
    },
  );
}

function formatMeters(
  value,
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return '—';
  }

  const numeric =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      numeric,
    )
  ) {
    return '—';
  }

  return `${numeric.toLocaleString(
    'pt-BR',
    {
      maximumFractionDigits:
        1,
    },
  )} m`;
}

function formatHeading(
  value,
) {
  const numeric =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      numeric,
    )
  ) {
    return '—';
  }

  return `${numeric.toLocaleString(
    'pt-BR',
    {
      maximumFractionDigits:
        0,
    },
  )}°`;
}

function formatDateTime(
  value,
) {
  const numeric =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      numeric,
    )
  ) {
    return '—';
  }

  return new Date(
    numeric,
  ).toLocaleString(
    'pt-BR',
    {
      dateStyle:
        'short',

      timeStyle:
        'short',
    },
  );
}

function getCategoryLabel(
  category,
) {
  switch (
    category
  ) {
    case 'active-fire':
      return 'Foco ativo';

    case 'vehicle':
      return 'Viatura';

    case 'water-source':
      return 'Ponto d’água';

    case 'blockage':
      return 'Bloqueio';

    case 'risk':
      return 'Área de risco';

    case 'service':
      return 'Atendimento';

    case 'observation':
      return 'Observação';

    default:
      return 'Marcador';
  }
}

function getOriginLabel(
  origin,
) {
  switch (
    origin
  ) {
    case 'current-position':
      return 'Posição atual';

    case 'manual-coordinate':
      return 'Coordenada informada';

    default:
      return 'Indefinida';
  }
}

function getStatusLabel(
  status,
) {
  switch (
    status
  ) {
    case 'new':
      return 'Novo';

    case 'in-progress':
      return 'Em andamento';

    case 'verified':
      return 'Verificado';

    case 'completed':
      return 'Concluído';

    default:
      return 'Indefinido';
  }
}

export default function FieldPointDetails({
  point,
  onClose,
}) {
  if (!point) {
    return null;
  }

  const properties =
    point.properties ||
    {};

  const coordinates =
    point.geometry
      ?.coordinates ||
    [];

  const longitude =
    coordinates[0];

  const latitude =
    coordinates[1];

  const category =
    properties.category ||
    'observation';

  const label =
    properties.label ||
    getCategoryLabel(
      category,
    );

  const style =
    properties.style ||
    {};

  function handleFocusOnMap() {
    EventBus.emit(
      EVENTS.MAP_FOCUS_FIELD_FEATURE,
      {
        feature:
          point,
      },
    );
  }

  function handleExportGeoJSON() {
    const content =
      FieldController
        .exportGeoJSON({
          pointId:
            point.id,
        });

    const name =
      slugifyFieldExportName(
        label ||
        'marcador',
      );

    downloadFieldExport({
      content,

      filename:
        `geofogo-${name}-${getFieldExportDateStamp()}.geojson`,

      mimeType:
        'application/geo+json',
    });
  }

  function handleExportGPX() {
    const content =
      FieldController
        .exportGPX({
          pointId:
            point.id,
        });

    const name =
      slugifyFieldExportName(
        label ||
        'marcador',
      );

    downloadFieldExport({
      content,

      filename:
        `geofogo-${name}-${getFieldExportDateStamp()}.gpx`,

      mimeType:
        'application/gpx+xml',
    });
  }

  return (
    <section className="mt-2 rounded-lg border border-purple-500/30 bg-purple-500/5 p-3">
      <div className="flex items-start gap-2">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">
            {label}
          </p>

          <p className="mt-0.5 text-[9px] text-muted-foreground">
            {getCategoryLabel(
              category,
            )}
            {' · '}
            {getStatusLabel(
              properties.status,
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={
            onClose
          }
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Fechar detalhes"
          aria-label="Fechar detalhes do marcador"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <button
        type="button"
        onClick={
          handleFocusOnMap
        }
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-[10px] font-semibold text-blue-700 transition-colors hover:bg-blue-500/15 dark:text-blue-300"
      >
        <LocateFixed className="h-3.5 w-3.5" />

        Ir para
      </button>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={
            handleExportGeoJSON
          }
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-[10px] font-semibold transition-colors hover:bg-accent"
        >
          <FileJson className="h-3.5 w-3.5" />

          GeoJSON
        </button>

        <button
          type="button"
          onClick={
            handleExportGPX
          }
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-[10px] font-semibold transition-colors hover:bg-accent"
        >
          <Download className="h-3.5 w-3.5" />

          GPX
        </button>
      </div>

      {properties.observation && (
        <div className="mt-3 rounded-lg bg-accent/20 p-2.5">
          <p className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
            Observação
          </p>

          <p className="mt-1 text-[10px] leading-relaxed">
            {properties.observation}
          </p>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric
          icon={
            Crosshair
          }
          label="Latitude"
          value={
            formatNumber(
              latitude,
            )
          }
        />

        <Metric
          icon={
            Crosshair
          }
          label="Longitude"
          value={
            formatNumber(
              longitude,
            )
          }
        />

        <Metric
          icon={
            Mountain
          }
          label="Altitude"
          value={
            formatMeters(
              properties.altitude,
            )
          }
        />

        <Metric
          icon={
            Satellite
          }
          label="Precisão"
          value={
            formatMeters(
              properties.accuracy,
            )
          }
        />

        <Metric
          icon={
            Compass
          }
          label="Direção"
          value={
            formatHeading(
              properties.heading,
            )
          }
        />

        <Metric
          icon={
            Satellite
          }
          label="Precisão altitude"
          value={
            formatMeters(
              properties.altitudeAccuracy,
            )
          }
        />
      </div>

      <div className="mt-3 rounded-lg border border-border/70 bg-background/70 p-2.5">
        <div className="flex items-center gap-1.5">
          <CalendarClock className="h-3 w-3 text-muted-foreground" />

          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            Registro
          </p>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
          <Detail
            label="Criado em"
            value={
              formatDateTime(
                properties.timestamp ||
                point.created_date,
              )
            }
          />

          <Detail
            label="Origem"
            value={
              getOriginLabel(
                properties.origin,
              )
            }
          />

          <Detail
            label="Formato original"
            value={
              properties.originalCoordinateFormat ||
              '—'
            }
          />

          <Detail
            label="Trilho vinculado"
            value={
              point.trailId ||
              properties.trailId ||
              'Nenhum'
            }
          />
        </div>
      </div>

      <div className="mt-2 rounded-lg border border-border/70 bg-background/70 p-2.5">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          Aparência
        </p>

        <div className="mt-2 flex items-center gap-3">
          <span
            className="h-6 w-6 shrink-0 rounded-full border border-border"
            style={{
              backgroundColor:
                style.color ||
                '#7c3aed',
            }}
            title={
              style.color ||
              '#7c3aed'
            }
          />

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium">
              {style.color ||
                '#7c3aed'}
            </p>

            <p className="text-[9px] text-muted-foreground">
              Ícone:{' '}
              {style.iconId ||
                category}
              {' · '}
              Tamanho:{' '}
              {style.size ||
                'medium'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div className="rounded-lg bg-accent/30 p-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3 w-3" />

        <span className="text-[9px]">
          {label}
        </span>
      </div>

      <p className="mt-1 break-all text-[10px] font-semibold">
        {value}
      </p>
    </div>
  );
}

function Detail({
  label,
  value,
}) {
  return (
    <div>
      <p className="text-[8px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>

      <p className="mt-0.5 break-all text-[9px] font-medium">
        {value}
      </p>
    </div>
  );
}