/**
 * FieldModePanel — painel do Modo Campo.
 * GPS, trilha, pontos, observações, exportação GeoJSON/GPX.
 * Fora do Modo Campo: GPS desativado.
 */
import { Navigation, Play, Pause, Square, Download, FileText, Plus } from 'lucide-react';
import { useState } from 'react';
import { FieldController } from '../../field/FieldController';
import { formatDistance } from '../../utils/formatters';

export default function FieldModePanel({ fieldState, onStart, onStop, onToggleRecord, onAddPoint }) {
  const [obs, setObs] = useState('');
  const [label, setLabel] = useState('');

  const handleAddPoint = () => {
    onAddPoint(label, obs);
    setLabel('');
    setObs('');
  };

  const handleExport = (format) => {
    const data = format === 'geojson' ? FieldController.exportGeoJSON() : FieldController.exportGPX();
    const mime = format === 'geojson' ? 'application/geo+json' : 'application/gpx+xml';
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `geofogo-trilha-${Date.now()}.${format === 'geojson' ? 'geojson' : 'gpx'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!fieldState.active) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Navigation className="w-4 h-4 text-blue-500" />
          <h2 className="text-sm font-semibold">Modo Campo</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Navigation className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-xs text-muted-foreground mb-4">
            Inicie o Modo Campo para ativar o GPS, registrar trilhas e marcar pontos durante operações de campo.
          </p>
          <button
            onClick={onStart}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
          >
            <Navigation className="w-3.5 h-3.5" />
            Iniciar Modo Campo
          </button>
        </div>
      </div>
    );
  }

  const durationMin = Math.floor(fieldState.duration / 60000);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-blue-500" />
          <h2 className="text-sm font-semibold">Modo Campo</h2>
          {fieldState.recording && (
            <span className="flex items-center gap-1 text-[10px] text-red-500">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              REC
            </span>
          )}
        </div>
        <button
          onClick={onStop}
          className="p-1.5 rounded hover:bg-destructive/10 text-destructive"
          title="Encerrar"
        >
          <Square className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Métricas */}
        <div className="grid grid-cols-3 gap-2">
          <Metric label="Distância" value={formatDistance(fieldState.distance)} />
          <Metric label="Duração" value={`${durationMin}min`} />
          <Metric label="Velocidade" value={`${Math.round(fieldState.speed * 3.6)}km/h`} />
        </div>

        {/* Controles de gravação */}
        <div className="flex gap-2">
          <button
            onClick={onToggleRecord}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium ${
              fieldState.recording
                ? 'bg-amber-500/20 text-amber-600 hover:bg-amber-500/30'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {fieldState.recording ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {fieldState.recording ? 'Pausar' : 'Registrar'}
          </button>
        </div>

        {/* Pontos da trilha */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Pontos na trilha: <strong className="text-foreground">{fieldState.trailLength}</strong></span>
          <span>Pontos marcados: <strong className="text-foreground">{fieldState.pointsCount}</strong></span>
        </div>

        {/* Adicionar ponto */}
        <div className="space-y-2 p-2.5 rounded-lg bg-accent/30">
          <input
            type="text"
            placeholder="Rótulo do ponto"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded"
          />
          <input
            type="text"
            placeholder="Observação"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded"
          />
          <button
            onClick={handleAddPoint}
            className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
          >
            <Plus className="w-3 h-3" />
            Adicionar ponto
          </button>
        </div>

        {/* Exportar */}
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('geojson')}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-accent rounded-lg text-xs font-medium hover:bg-accent/80"
          >
            <FileText className="w-3.5 h-3.5" />
            GeoJSON
          </button>
          <button
            onClick={() => handleExport('gpx')}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-accent rounded-lg text-xs font-medium hover:bg-accent/80"
          >
            <Download className="w-3.5 h-3.5" />
            GPX
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center pt-1">
          Ao encerrar o Modo Campo, o GPS será desativado.
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="text-center px-2 py-1.5 rounded-lg bg-accent/30">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-xs font-semibold">{value}</div>
    </div>
  );
}