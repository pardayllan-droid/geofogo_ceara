/**
 * StatsPanel
 *
 * Resumo operacional do GeoFogo Ceará.
 *
 * Exibe apenas as informações prioritárias:
 * - eventos ativos;
 * - área total afetada;
 * - alertas ativos;
 * - maior evento;
 * - última atualização.
 *
 * Interações:
 * - Eventos ativos: abre e fecha uma lista ordenada por idade;
 * - Evento da lista: centraliza no mapa e abre o popup;
 * - Área total: restaura o enquadramento do Ceará;
 * - Alertas ativos: abre a aba de alertas;
 * - Maior evento: centraliza no maior evento e abre o popup.
 */

import {
  useMemo,
  useState,
} from 'react';

import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Clock,
  Flame,
  LocateFixed,
  Maximize,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';

import {
  AppCore,
} from '../../core/AppCore';

import {
  EventBus,
  EVENTS,
} from '../../core/EventBus';

import {
  formatAreaHectares,
  formatNumber,
} from '../../utils/formatters';

import {
  timeAgoShort,
} from '../../utils/dates';

const EVENT_AGE_COLORS = {
  recent:
    '#ff2323',

  day:
    '#ff2323',

  medium:
    '#ff9e17',

  attention:
    '#ff9e17',

  old:
    '#ffb1b0',

  veryOld:
    '#c8c8c8',
};

function firstValue(
  ...values
) {
  for (
    const value
    of values
  ) {
    if (
      value !== undefined &&
      value !== null &&
      String(value).trim()
    ) {
      return value;
    }
  }

  return null;
}

function getEventId(
  feature,
) {
  return firstValue(
    feature?.id,
    feature?.properties
      ?.id_evento,
    feature?.properties
      ?.id,
    feature?.properties
      ?.identificador,
  );
}

function getEventMunicipality(
  feature,
) {
  const properties =
    feature?.properties ||
    {};

  return (
    firstValue(
      properties.municipio,
      properties.municipality,
      properties.nome_municipio,
      properties.nomeMunicipio,
      properties.nome,
    ) ||
    'Município não identificado'
  );
}

function getEventLastDetection(
  feature,
) {
  const properties =
    feature?.properties ||
    {};

  return firstValue(
    properties.dt_maxima,
    properties.data_fim,
    properties.updated_date,
    properties.updated_at,
  );
}

function getEventTimestamp(
  feature,
) {
  const value =
    getEventLastDetection(
      feature,
    );

  if (!value) {
    return 0;
  }

  const timestamp =
    new Date(
      value,
    ).getTime();

  return Number.isFinite(
    timestamp,
  )
    ? timestamp
    : 0;
}

function getEventAgeHours(
  feature,
) {
  const timestamp =
    getEventTimestamp(
      feature,
    );

  if (!timestamp) {
    return null;
  }

  return Math.max(
    0,
    (
      Date.now() -
      timestamp
    ) /
      (
        60 *
        60 *
        1000
      ),
  );
}

function getEventAgeColor(
  feature,
) {
  const properties =
    feature?.properties ||
    {};

  /**
   * Primeiro tentamos aproveitar campos de cor ou classe
   * que já tenham sido adicionados pelo enriquecimento.
   */
  const enrichedColor =
    firstValue(
      properties
        .fire_age_color,
      properties
        .event_age_color,
      properties
        .age_color,
      properties
        .temporal_color,
      properties
        .cor_idade,
    );

  if (enrichedColor) {
    return enrichedColor;
  }

  const enrichedClass =
    firstValue(
      properties
        .fire_age_class,
      properties
        .event_age_class,
      properties
        .age_class,
      properties
        .temporal_class,
      properties
        .classe_idade,
    );

  if (
    enrichedClass &&
    EVENT_AGE_COLORS[
      enrichedClass
    ]
  ) {
    return EVENT_AGE_COLORS[
      enrichedClass
    ];
  }

  /**
   * Fallback calculado diretamente por dt_maxima.
   */
  const ageHours =
    getEventAgeHours(
      feature,
    );

  if (ageHours === null) {
    return '#c8c8c8';
  }

  if (ageHours <= 24) {
    return '#ff2323';
  }

  if (ageHours <= 48) {
    return '#ff9e17';
  }

  if (ageHours <= 96) {
    return '#ffb1b0';
  }

  return '#c8c8c8';
}

function getEventArea(
  feature,
) {
  const properties =
    feature?.properties ||
    {};

  const candidates = [
    properties.area,
    properties.area_m2,
    properties.area_total,
    properties.area_total_evento,
    properties.event_area,
    properties.area_calculada,
  ];

  for (
    const candidate
    of candidates
  ) {
    const numeric =
      Number(
        candidate,
      );

    if (
      Number.isFinite(
        numeric,
      ) &&
      numeric >= 0
    ) {
      return numeric;
    }
  }

  return null;
}

function getEventPersistence(
  feature,
) {
  const value =
    Number(
      feature
        ?.properties
        ?.persistencia_dias,
    );

  if (
    !Number.isFinite(
      value,
    )
  ) {
    return null;
  }

  return value;
}

function focusFeature(
  feature,
) {
  if (!feature) {
    return;
  }

  const eventId =
    getEventId(
      feature,
    );

  EventBus.emit(
    EVENTS.MAP_FOCUS_FIRE_EVENT,
    {
      eventId,
      feature,
    },
  );

  /**
   * O useGeoFogo já trata layer:click e abre
   * o popup com o polígono original.
   */
  EventBus.emit(
    'layer:click',
    {
      feature,
      layerId:
        'fire-events',
    },
  );
}

/**
 * Solicita ao mapa que restaure exatamente o mesmo
 * enquadramento utilizado na inicialização.
 */
function resetMapToCeara() {
  if (
    !AppCore.cearaBoundary
      ?.features
      ?.length
  ) {
    console.warn(
      '[StatsPanel] Limite do Ceará indisponível para restaurar o mapa.',
    );

    return;
  }

  EventBus.emit(
    EVENTS.MAP_RESET_INITIAL_VIEW,
    {
      source:
        'stats-total-area',
    },
  );
}

export default function StatsPanel({
  stats,
  online,
  syncing,
  onOpenAlerts,
}) {
  const [
    eventsExpanded,
    setEventsExpanded,
  ] = useState(
    false,
  );

  const orderedEvents =
    useMemo(
      () => {
        const features =
          AppCore.fireEvents
            ?.features ||
          [];

        return [
          ...features,
        ].sort(
          (
            first,
            second,
          ) =>
            getEventTimestamp(
              second,
            ) -
            getEventTimestamp(
              first,
            ),
        );
      },
      [
        stats?.eventsCount,
        stats?.lastUpdated,
      ],
    );

  if (!stats) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground">
        Carregando resumo...
      </div>
    );
  }

  const largestEventFeature =
    stats.largestEvent
      ?.feature ||
    null;

  const largestMunicipality =
    largestEventFeature
      ? getEventMunicipality(
          largestEventFeature,
        )
      : '—';

  function handleSelectEvent(
    feature,
  ) {
    focusFeature(
      feature,
    );

    /**
     * Recolhe a lista para liberar espaço no celular.
     */
    setEventsExpanded(
      false,
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <BarChart3 className="h-4 w-4 text-amber-500" />

        <h2 className="text-sm font-semibold">
          Resumo
        </h2>

        <div className="ml-auto flex items-center gap-1.5">
          {online ? (
            <Wifi className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-red-500" />
          )}

          <span className="text-[10px] text-muted-foreground">
            {online
              ? syncing
                ? 'Sincronizando'
                : 'Online'
              : 'Offline'}
          </span>
        </div>
      </div>

      <div className="space-y-2 p-3">
        <InteractiveCard
          icon={Flame}
          label="Eventos ativos"
          value={formatNumber(
            stats.eventsCount,
          )}
          color="#ef4444"
          expanded={
            eventsExpanded
          }
          onClick={() =>
            setEventsExpanded(
              (
                current,
              ) =>
                !current,
            )
          }
          actionLabel={
            eventsExpanded
              ? 'Fechar lista de eventos'
              : 'Abrir lista de eventos'
          }
        />

        {eventsExpanded && (
          <EventDrawer
            events={
              orderedEvents
            }
            onSelect={
              handleSelectEvent
            }
          />
        )}

        <InteractiveCard
          icon={Maximize}
          label="Área total afetada"
          value={formatAreaHectares(
            stats.totalArea,
          )}
          color="#f97316"
          onClick={
            resetMapToCeara
          }
          actionLabel="Restaurar enquadramento do Ceará"
        />

        <InteractiveCard
          icon={AlertTriangle}
          label="Alertas ativos"
          value={formatNumber(
            stats.alertsCount,
          )}
          color="#f59e0b"
          onClick={
            onOpenAlerts
          }
          actionLabel="Abrir painel de alertas"
        />

        {stats.largestEvent ? (
          <InteractiveCard
            icon={LocateFixed}
            label="Maior evento"
            value={formatAreaHectares(
              stats
                .largestEvent
                .area,
            )}
            description={
              largestMunicipality
            }
            color="#dc2626"
            onClick={() =>
              focusFeature(
                largestEventFeature,
              )
            }
            actionLabel="Localizar maior evento"
          />
        ) : (
          <StaticCard
            icon={LocateFixed}
            label="Maior evento"
            value="—"
            description="Nenhum evento disponível"
            color="#94a3b8"
          />
        )}

        <StaticCard
          icon={RefreshCw}
          label="Atualização"
          value={timeAgoShort(
            stats.lastUpdated,
          )}
          description={
            syncing
              ? 'Sincronização em andamento'
              : online
                ? 'Dados operacionais'
                : 'Dados armazenados'
          }
          color="#3b82f6"
        />

        {stats.fromCache && (
          <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
            <Clock className="h-3 w-3" />

            Dados em cache — modo offline
          </div>
        )}
      </div>
    </div>
  );
}

function EventDrawer({
  events,
  onSelect,
}) {
  if (
    !events.length
  ) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
        Nenhum evento ativo disponível.
      </div>
    );
  }

  return (
    <div
      className="
        overflow-hidden
        rounded-xl
        border border-red-500/20
        bg-card
        shadow-sm
      "
    >
      <div className="border-b border-border/60 bg-red-500/5 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
          Mais recentes primeiro
        </p>
      </div>

      <div className="max-h-72 overflow-y-auto overscroll-auto">
        {events.map(
          (
            feature,
            index,
          ) => {
            const eventId =
              getEventId(
                feature,
              ) ||
              `event-${index}`;

            const municipality =
              getEventMunicipality(
                feature,
              );

            const lastDetection =
              getEventLastDetection(
                feature,
              );

            const area =
              getEventArea(
                feature,
              );

            const persistence =
              getEventPersistence(
                feature,
              );

            const color =
              getEventAgeColor(
                feature,
              );

            return (
              <button
                type="button"
                key={
                  eventId
                }
                onClick={() =>
                  onSelect(
                    feature,
                  )
                }
                className="
                  group
                  flex w-full
                  items-start gap-2.5
                  border-b border-border/50
                  px-3 py-2.5
                  text-left
                  transition-colors
                  last:border-b-0
                  hover:bg-accent/50
                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-inset
                  focus-visible:ring-amber-500
                "
              >
                <span
                  className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full shadow-sm"
                  style={{
                    background:
                      color,
                  }}
                />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">
                    {municipality}
                  </span>

                  <span className="mt-0.5 block text-[10px] text-muted-foreground">
                    {lastDetection
                      ? `Atualizado ${timeAgoShort(
                          lastDetection,
                        )}`
                      : 'Data não disponível'}
                  </span>

                  <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                    {area !==
                      null && (
                      <span>
                        Área:{' '}
                        {formatAreaHectares(
                          area,
                        )}
                      </span>
                    )}

                    {persistence !==
                      null && (
                      <span>
                        Persistência:{' '}
                        {persistence.toLocaleString(
                          'pt-BR',
                          {
                            maximumFractionDigits:
                              1,
                          },
                        )}{' '}
                        {persistence ===
                        1
                          ? 'dia'
                          : 'dias'}
                      </span>
                    )}
                  </span>
                </span>

                <LocateFixed className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-50 transition-opacity group-hover:opacity-100" />
              </button>
            );
          },
        )}
      </div>
    </div>
  );
}

function InteractiveCard({
  icon: Icon,
  label,
  value,
  description,
  color,
  onClick,
  expanded = false,
  actionLabel,
}) {
  const ExpansionIcon =
    expanded
      ? ChevronUp
      : ChevronDown;

  return (
    <button
      type="button"
      onClick={
        onClick
      }
      disabled={
        typeof onClick !==
        'function'
      }
      aria-expanded={
        label ===
        'Eventos ativos'
          ? expanded
          : undefined
      }
      aria-label={
        actionLabel ||
        label
      }
      className="
        group
        flex w-full
        items-center gap-3
        rounded-lg
        bg-accent/30
        px-3 py-2.5
        text-left
        transition-all
        hover:bg-accent/60
        active:scale-[0.99]
        disabled:cursor-default
        disabled:hover:bg-accent/30
        focus-visible:outline-none
        focus-visible:ring-2
        focus-visible:ring-amber-500
      "
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{
          background:
            `${color}20`,
        }}
      >
        <Icon
          className="h-4 w-4"
          style={{
            color,
          }}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-muted-foreground">
          {label}
        </div>

        <div className="text-sm font-semibold">
          {value}
        </div>

        {description && (
          <div className="truncate text-[10px] text-muted-foreground">
            {description}
          </div>
        )}
      </div>

      {label ===
      'Eventos ativos' ? (
        <ExpansionIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
      ) : (
        <LocateFixed className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-40 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  );
}

function StaticCard({
  icon: Icon,
  label,
  value,
  description,
  color,
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-accent/30 px-3 py-2.5">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{
          background:
            `${color}20`,
        }}
      >
        <Icon
          className="h-4 w-4"
          style={{
            color,
          }}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-muted-foreground">
          {label}
        </div>

        <div className="text-sm font-semibold">
          {value}
        </div>

        {description && (
          <div className="truncate text-[10px] text-muted-foreground">
            {description}
          </div>
        )}
      </div>
    </div>
  );
}