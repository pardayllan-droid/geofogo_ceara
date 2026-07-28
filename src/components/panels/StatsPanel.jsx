/**
 * StatsPanel — estatísticas operacionais.
 */
import { BarChart3, Flame, Map, Shield, AlertTriangle, Layers, Maximize, Clock, Wifi, WifiOff } from 'lucide-react';
import { formatArea, formatNumber } from '../../utils/formatters';
import { CRITICALITY_COLORS, CRITICALITY } from '../../alerts/alertRules';
import { timeAgoShort } from '../../utils/dates';

export default function StatsPanel({ stats, online, syncing }) {
  if (!stats) {
    return (
      <div className="p-4 text-xs text-muted-foreground text-center">
        Carregando estatísticas...
      </div>
    );
  }

  const critCounts = stats.alertsCount
    ? { Crítico: 0, Alto: 0, Atenção: 0 }
    : null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <BarChart3 className="w-4 h-4 text-amber-500" />
        <h2 className="text-sm font-semibold">Estatísticas</h2>
        <div className="ml-auto flex items-center gap-1.5">
          {online ? (
            <Wifi className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-red-500" />
          )}
          <span className="text-[10px] text-muted-foreground">
            {online ? (syncing ? 'Sincronizando' : 'Online') : 'Offline'}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <StatCard
          icon={Flame}
          label="Eventos ativos"
          value={formatNumber(stats.eventsCount)}
          color="#ef4444"
        />
        <StatCard
          icon={Maximize}
          label="Área total afetada"
          value={formatArea(stats.totalArea)}
          color="#f97316"
        />
        <StatCard
          icon={Map}
          label="Municípios atingidos"
          value={formatNumber(stats.municipiosCount)}
          color="#3b82f6"
        />
        <StatCard
          icon={Shield}
          label="UCs ameaçadas"
          value={formatNumber(stats.threatenedUCs)}
          color="#22c55e"
        />
        <StatCard
          icon={AlertTriangle}
          label="Eventos dentro de UCs"
          value={formatNumber(stats.eventsInUCs)}
          color="#dc2626"
        />
        <StatCard
          icon={Layers}
          label="Alertas ativos"
          value={formatNumber(stats.alertsCount)}
          color="#f59e0b"
        />

        {stats.largestEvent && (
          <div className="px-3 py-2 rounded-lg bg-accent/50 text-xs">
            <div className="text-muted-foreground mb-0.5">Maior evento</div>
            <div className="font-medium">{formatArea(stats.largestEvent.area)}</div>
            <div className="text-[10px] text-muted-foreground truncate">
              {stats.largestEvent.feature?.properties?.municipio || stats.largestEvent.feature?.properties?.nome || '—'}
            </div>
          </div>
        )}

        {stats.fromCache && (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 text-xs text-amber-600">
            <Clock className="w-3 h-3" />
            Dados em cache (modo offline)
          </div>
        )}

        <div className="text-[10px] text-muted-foreground text-center pt-1">
          Atualizado {timeAgoShort(stats.lastUpdated)}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-accent/30">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}20` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}