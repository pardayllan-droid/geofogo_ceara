/**
 * AlertPanel — lista de alertas entre eventos de fogo e UCs.
 */
import { AlertTriangle, Flame, Shield, MapPin } from 'lucide-react';
import { CRITICALITY_COLORS } from '../../alerts/alertRules';
import { formatDistance, formatArea } from '../../utils/formatters';
import { timeAgoShort } from '../../utils/dates';

export default function AlertPanel({ alerts, onSelect }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <AlertTriangle className="w-4 h-4 text-red-500" />
        <h2 className="text-sm font-semibold">Alertas</h2>
        <span className="ml-auto text-xs text-muted-foreground">{alerts.length} ativos</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground text-center">
            Nenhum alerta ativo. Os alertas são calculados entre eventos de fogo e Unidades de Conservação.
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => onSelect?.(alert)}
              className="px-4 py-2.5 border-b border-border/50 hover:bg-accent/50 cursor-pointer"
            >
              <div className="flex items-start gap-2">
                <div
                  className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                  style={{ background: CRITICALITY_COLORS[alert.criticality] }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-3 h-3 text-orange-500 flex-shrink-0" />
                    <span className="text-xs font-medium truncate">{alert.eventName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Shield className="w-3 h-3 text-green-600 flex-shrink-0" />
                    <span className="text-xs text-muted-foreground truncate">{alert.ucName}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span style={{ color: CRITICALITY_COLORS[alert.criticality] }} className="font-medium">
                      {alert.criticality}
                    </span>
                    <span>{alert.intersects ? 'Interseção' : formatDistance(alert.distance)}</span>
                    {alert.eventArea > 0 && <span>{formatArea(alert.eventArea)}</span>}
                    <span className="flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5" />
                      {alert.municipio}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}