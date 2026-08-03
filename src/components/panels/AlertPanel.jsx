/**
 * AlertPanel
 *
 * Lista os alertas entre eventos de fogo e Áreas Sensíveis.
 *
 * Áreas atualmente reconhecidas:
 * - Unidades de Conservação;
 * - Terras Indígenas.
 *
 * Ao selecionar um alerta, solicita ao mapa que:
 * - localize o evento associado;
 * - centralize/enquadre sua geometria;
 * - destaque visualmente a seleção, quando suportado.
 */

import {
  AlertTriangle,
  Flame,
  Shield,
  MapPin,
  LocateFixed,
} from 'lucide-react';

import {
  CRITICALITY_COLORS,
} from '../../alerts/alertRules';

import {
  formatDistance,
  formatAreaHectares,
} from '../../utils/formatters';

import {
  EventBus,
  EVENTS,
} from '../../core/EventBus';

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

function getSensitiveAreaType(
  alert,
) {
  return (
    alert?.sensitiveAreaType ||
    'conservation-unit'
  );
}

function getSensitiveAreaLabel(
  alert,
) {
  const type =
    getSensitiveAreaType(
      alert,
    );

  return (
    firstValue(
      alert?.sensitiveAreaLabel,

      type ===
        'indigenous-land'
        ? 'Terra Indígena'
        : null,

      type ===
        'conservation-unit'
        ? 'Unidade de Conservação'
        : null,
    ) ||
    'Área Sensível'
  );
}

function getSensitiveAreaName(
  alert,
) {
  return (
    firstValue(
      alert?.sensitiveAreaName,
      alert?.ucName,
    ) ||
    'Área Sensível sem nome'
  );
}

function getSensitiveAreaCategory(
  alert,
) {
  return (
    firstValue(
      alert?.sensitiveAreaCategory,
      alert?.ucCategory,
    ) ||
    '—'
  );
}

function getSensitiveAreaColor(
  alert,
) {
  const type =
    getSensitiveAreaType(
      alert,
    );

  switch (type) {
    case 'indigenous-land':
      return '#9333ea';

    case 'conservation-unit':
      return '#16a34a';

    case 'hospital':
      return '#dc2626';

    case 'school':
      return '#2563eb';

    case 'urban-area':
      return '#64748b';

    case 'reservoir':
      return '#0891b2';

    default:
      return '#d97706';
  }
}

function focusAlertOnMap(
  alert,
) {
  if (!alert?.eventId) {
    console.warn(
      '[AlertPanel] O alerta selecionado não possui eventId.',
      alert,
    );

    return;
  }

  EventBus.emit(
    EVENTS.MAP_FOCUS_FIRE_EVENT,
    {
      eventId:
        alert.eventId,

      alertId:
        alert.id,

      alert,
    },
  );
}

function handleKeyboardSelect(
  event,
  alert,
) {
  if (
    event.key !==
      'Enter' &&
    event.key !==
      ' '
  ) {
    return;
  }

  event.preventDefault();

  focusAlertOnMap(
    alert,
  );
}

export default function AlertPanel({
  alerts = [],
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-red-500" />

        <h2 className="text-sm font-semibold">
          Alertas
        </h2>

        <span className="ml-auto text-xs text-muted-foreground">
          {alerts.length}{' '}
          {alerts.length === 1
            ? 'ativo'
            : 'ativos'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            Nenhum alerta ativo. Os alertas são calculados entre eventos de
            fogo e Áreas Sensíveis.
          </div>
        ) : (
          alerts.map(
            (
              alert,
            ) => {
              const sensitiveLabel =
                getSensitiveAreaLabel(
                  alert,
                );

              const sensitiveName =
                getSensitiveAreaName(
                  alert,
                );

              const sensitiveCategory =
                getSensitiveAreaCategory(
                  alert,
                );

              const sensitiveColor =
                getSensitiveAreaColor(
                  alert,
                );

              return (
                <div
                  key={alert.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Centralizar no evento ${alert.eventName}`}
                  title="Centralizar este evento no mapa"
                  onClick={() =>
                    focusAlertOnMap(
                      alert,
                    )
                  }
                  onKeyDown={(
                    event,
                  ) =>
                    handleKeyboardSelect(
                      event,
                      alert,
                    )
                  }
                  className="
                    group cursor-pointer
                    border-b border-border/50
                    px-4 py-3
                    transition-colors
                    hover:bg-accent/50
                    focus-visible:outline-none
                    focus-visible:ring-2
                    focus-visible:ring-inset
                    focus-visible:ring-amber-500
                  "
                >
                  <div className="flex items-start gap-2">
                    <div
                      className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full"
                      style={{
                        background:
                          CRITICALITY_COLORS[
                            alert.criticality
                          ] ||
                          '#94a3b8',
                      }}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Flame className="h-3 w-3 flex-shrink-0 text-orange-500" />

                        <span className="truncate text-xs font-medium">
                          {alert.eventName ||
                            'Evento de fogo'}
                        </span>

                        <LocateFixed
                          className="
                            ml-auto h-3.5 w-3.5
                            flex-shrink-0
                            text-muted-foreground
                            opacity-50
                            transition-opacity
                            group-hover:opacity-100
                          "
                        />
                      </div>

                      <div className="mt-1 flex items-center gap-1.5">
                        <Shield
                          className="h-3 w-3 flex-shrink-0"
                          style={{
                            color:
                              sensitiveColor,
                          }}
                        />

                        <span
                          className="truncate text-[10px] font-semibold"
                          style={{
                            color:
                              sensitiveColor,
                          }}
                        >
                          {sensitiveLabel}
                        </span>
                      </div>

                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {sensitiveName}
                      </div>

                      {sensitiveCategory !==
                        '—' && (
                        <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                          {sensitiveCategory}
                        </div>
                      )}

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                        <span
                          className="font-semibold"
                          style={{
                            color:
                              CRITICALITY_COLORS[
                                alert
                                  .criticality
                              ] ||
                              '#94a3b8',
                          }}
                        >
                          {alert.criticality}
                        </span>

                        <span>
                          {alert.intersects
                            ? 'Interseção'
                            : formatDistance(
                                alert.distance,
                              )}
                        </span>

                        {alert.eventArea > 0 && (
                          <span>
                            {formatAreaHectares(
                              alert.eventArea,
                            )}
                          </span>
                        )}

                        <span className="flex min-w-0 items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5 flex-shrink-0" />

                          <span className="max-w-[140px] truncate">
                            {alert.municipio ||
                              '—'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            },
          )
        )}
      </div>
    </div>
  );
}