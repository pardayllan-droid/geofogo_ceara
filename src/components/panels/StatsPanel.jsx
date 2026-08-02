/**
 * StatsPanel
 *
 * Estatísticas operacionais do GeoFogo Ceará.
 *
 * Exibe:
 * - eventos;
 * - área afetada;
 * - municípios atingidos;
 * - Áreas Sensíveis;
 * - alertas;
 * - estado da conexão.
 */

import {
  BarChart3,
  Flame,
  Map,
  Shield,
  AlertTriangle,
  Layers,
  Maximize,
  Clock,
  Wifi,
  WifiOff,
  Landmark,
} from 'lucide-react';

import {
  formatArea,
  formatNumber,
} from '../../utils/formatters';

import {
  timeAgoShort,
} from '../../utils/dates';

export default function StatsPanel({
  stats,
  online,
  syncing,
}) {
  if (!stats) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground">
        Carregando estatísticas...
      </div>
    );
  }

  const sensitiveAreasCount =
    stats.sensitiveAreasCount ??
    (
      Number(
        stats.ucsCount,
      ) ||
      0
    ) +
      (
        Number(
          stats.indigenousLandsCount,
        ) ||
        0
      );

  /**
   * Compatibilidade temporária:
   *
   * Os campos antigos ainda podem ser fornecidos pelo
   * AppCore enquanto os nomes genéricos são adotados.
   */
  const threatenedSensitiveAreas =
    stats.threatenedSensitiveAreas ??
    stats.threatenedUCs ??
    0;

  const eventsInSensitiveAreas =
    stats.eventsInSensitiveAreas ??
    stats.eventsInUCs ??
    0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <BarChart3 className="h-4 w-4 text-amber-500" />

        <h2 className="text-sm font-semibold">
          Estatísticas
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

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        <StatCard
          icon={Flame}
          label="Eventos ativos"
          value={formatNumber(
            stats.eventsCount,
          )}
          color="#ef4444"
        />

        <StatCard
          icon={Maximize}
          label="Área total afetada"
          value={formatArea(
            stats.totalArea,
          )}
          color="#f97316"
        />

        <StatCard
          icon={Map}
          label="Municípios atingidos"
          value={formatNumber(
            stats.municipiosCount,
          )}
          color="#3b82f6"
        />

        <StatCard
          icon={Layers}
          label="Áreas Sensíveis"
          value={formatNumber(
            sensitiveAreasCount,
          )}
          color="#d97706"
        />

        <StatCard
          icon={Shield}
          label="Unidades de Conservação"
          value={formatNumber(
            stats.ucsCount,
          )}
          color="#22c55e"
        />

        <StatCard
          icon={Landmark}
          label="Terras Indígenas"
          value={formatNumber(
            stats.indigenousLandsCount,
          )}
          color="#9333ea"
        />

        <StatCard
          icon={Shield}
          label="Áreas Sensíveis ameaçadas"
          value={formatNumber(
            threatenedSensitiveAreas,
          )}
          color="#eab308"
        />

        <StatCard
          icon={AlertTriangle}
          label="Eventos em Áreas Sensíveis"
          value={formatNumber(
            eventsInSensitiveAreas,
          )}
          color="#dc2626"
        />

        <StatCard
          icon={AlertTriangle}
          label="Alertas ativos"
          value={formatNumber(
            stats.alertsCount,
          )}
          color="#f59e0b"
        />

        {stats.largestEvent && (
          <div className="rounded-lg bg-accent/50 px-3 py-2 text-xs">
            <div className="mb-0.5 text-muted-foreground">
              Maior evento
            </div>

            <div className="font-medium">
              {formatArea(
                stats.largestEvent.area,
              )}
            </div>

            <div className="truncate text-[10px] text-muted-foreground">
              {stats.largestEvent
                .feature
                ?.properties
                ?.municipio ||
                stats.largestEvent
                  .feature
                  ?.properties
                  ?.nome ||
                '—'}
            </div>
          </div>
        )}

        {stats.fromCache && (
          <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
            <Clock className="h-3 w-3" />

            Dados em cache (modo offline)
          </div>
        )}

        <div className="pt-1 text-center text-[10px] text-muted-foreground">
          Atualizado{' '}
          {timeAgoShort(
            stats.lastUpdated,
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-accent/30 px-3 py-2.5">
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
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
      </div>
    </div>
  );
}