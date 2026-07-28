/**
 * LayerPanel — painel de camadas gerado a partir do LayerRegistry.
 * Exibe nome, grupo, visibilidade, opacidade, última atualização e erro.
 */
import { Layers, ChevronDown, AlertCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { timeAgoShort } from '../../utils/dates';

export default function LayerPanel({ layerGroups, onToggle, onOpacity, onSync }) {
  const [expandedGroups, setExpandedGroups] = useState(new Set(Array.from(layerGroups.keys())));

  const toggleGroup = (group) => {
    const next = new Set(expandedGroups);
    if (next.has(group)) next.delete(group);
    else next.add(group);
    setExpandedGroups(next);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-semibold">Camadas</h2>
        </div>
        <button
          onClick={onSync}
          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          title="Sincronizar"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {Array.from(layerGroups.entries()).map(([group, layers]) => (
          <div key={group} className="border-b border-border/50">
            <button
              onClick={() => toggleGroup(group)}
              className="flex items-center justify-between w-full px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent/50"
            >
              <span>{group}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedGroups.has(group) ? '' : '-rotate-90'}`} />
            </button>
            {expandedGroups.has(group) && (
              <div className="pb-2">
                {layers.map((layer) => (
                  <LayerRow
                    key={layer.id}
                    layer={layer}
                    onToggle={onToggle}
                    onOpacity={onOpacity}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function LayerRow({ layer, onToggle, onOpacity }) {
  const [showOpacity, setShowOpacity] = useState(false);

  return (
    <div className="px-4 py-1.5 hover:bg-accent/30">
      <div className="flex items-center gap-2">
        <button
          onClick={() => onToggle(layer.id, !layer.visible)}
          className="text-muted-foreground hover:text-foreground"
        >
          {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 opacity-40" />}
        </button>
        <button
          onClick={() => setShowOpacity(!showOpacity)}
          className="flex-1 text-left text-xs truncate"
        >
          {layer.title}
        </button>
        {layer.error && <AlertCircle className="w-3 h-3 text-destructive" />}
        {layer.lastUpdated && (
          <span className="text-[10px] text-muted-foreground/60">{timeAgoShort(layer.lastUpdated)}</span>
        )}
      </div>
      {showOpacity && (
        <div className="mt-1.5 pl-6 pr-1">
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            defaultValue={layer.opacity}
            onChange={(e) => onOpacity(layer.id, parseFloat(e.target.value))}
            className="w-full h-1 accent-amber-500"
          />
        </div>
      )}
    </div>
  );
}