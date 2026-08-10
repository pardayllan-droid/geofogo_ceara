/**
 * SettingsPanel — configurações do GeoFogo Ceará.
 * Distância de alerta, mapa-base, intervalo de atualização.
 */
import { Settings, Ruler, Map, Clock } from 'lucide-react';
import { config } from '../../core/config';

export default function SettingsPanel({ alertDistanceKm, onAlertDistance, baseMaps, baseMapId, onBaseMap }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Settings className="w-4 h-4 text-amber-500" />
        <h2 className="text-sm font-semibold">Configurações</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Distância de alerta */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Ruler className="w-3.5 h-3.5 text-muted-foreground" />
            <label className="text-xs font-medium">Distância de alerta (UC)</label>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {config.alertDistances.map((d) => (
              <button
                key={d.value}
                onClick={() => onAlertDistance(d.value)}
                className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                  alertDistanceKm === d.value
                    ? 'bg-amber-500 text-white'
                    : 'bg-accent text-muted-foreground hover:bg-accent/80'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Distância padrão: 3 km. Alertas são calculados entre eventos de fogo e Unidades de Conservação.
          </p>
        </div>

        {/* Mapa-base */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Map className="w-3.5 h-3.5 text-muted-foreground" />
            <label className="text-xs font-medium">Mapa-base</label>
          </div>
          <div className="space-y-1">
            {baseMaps.map((bm) => (
              <button
                key={bm.id}
                onClick={() => onBaseMap(bm.id)}
                className={`flex items-center justify-between w-full px-3 py-2 rounded text-xs transition-colors ${
                  baseMapId === bm.id
                    ? 'bg-amber-500 text-white'
                    : 'bg-accent text-muted-foreground hover:bg-accent/80'
                }`}
              >
                <span>{bm.title}</span>
                {baseMapId === bm.id && <span className="text-[10px]">✓</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Informações */}
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <label className="text-xs font-medium">Sistema</label>
          </div>
          <div className="space-y-1 text-[11px] text-muted-foreground">
            <div className="flex justify-between">
              <span>Atualização de eventos</span>
              <span>{config.fireRefreshMinutes} min</span>
            </div>
            <div className="flex justify-between">
              <span>Cache meteorológico</span>
              <span>{config.weatherCacheMinutes} min</span>
            </div>
            <div className="flex justify-between">
              <span>Máx. feições SIPAM</span>
              <span>{config.sipamMaxFeatures}</span>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            GeoFogo Ceará — Monitoramento de incêndios florestais no Estado do Ceará.
            O GPS é ativado apenas no Modo Campo.
          </p>
        </div>
      </div>
    </div>
  );
}