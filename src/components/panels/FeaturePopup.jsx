/**
 * FeaturePopup — exibe detalhes de uma feição selecionada no mapa.
 * Mostra atributos do evento de fogo, UC, município, etc.
 */
import { X, Flame, Shield, MapPin, Navigation, Clock, Cloud } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatArea, formatDistance, formatCoords } from '../../utils/formatters';
import { formatDate, timeAgoShort } from '../../utils/dates';
import * as turf from '@turf/turf';
import { loadWeatherForecast, parseForecastEntry, getCurrentEntry } from '../../services/weatherService';
import { AppCore } from '../../core/AppCore';
import { computeArea } from '../../spatial/SpatialEngine';

export default function FeaturePopup({ selectedFeature, onClose }) {
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const { feature, layerId } = selectedFeature || {};
  const props = feature?.properties || {};

  useEffect(() => {
    if (!feature) return;
    setWeather(null);

    // Para eventos de fogo, buscar meteorologia
    if (layerId === 'fire-events' || layerId === 'fire-events-markers') {
      loadWeather(feature);
    }
  }, [feature, layerId]);

  const loadWeather = async (feat) => {
    try {
      const pt = turf.centerOfMass(feat);
      const [lng, lat] = pt.geometry.coordinates;
      setWeatherLoading(true);
      const result = await loadWeatherForecast(lat, lng);
      if (result) {
        const entry = getCurrentEntry(result.data);
        setWeather({ ...parseForecastEntry(entry), fromCache: result.fromCache, updated: result.updated });
      }
    } catch (err) {
      console.error('[FeaturePopup] loadWeather falhou:', err);
    } finally {
      setWeatherLoading(false);
    }
  };

  if (!feature) return null;

  const isFireEvent = layerId === 'fire-events' || layerId === 'fire-events-markers';
  const isUC = layerId === 'conservation-units';
  const isMunicipality = layerId === 'municipalities';

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 md:left-4 md:translate-x-0 md:bottom-4 z-30 w-[90vw] max-w-md bg-card rounded-xl shadow-2xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-accent/50 border-b border-border">
        <div className="flex items-center gap-2">
          {isFireEvent && <Flame className="w-4 h-4 text-orange-500" />}
          {isUC && <Shield className="w-4 h-4 text-green-600" />}
          {isMunicipality && <MapPin className="w-4 h-4 text-blue-500" />}
          <span className="text-sm font-semibold truncate">
            {props.nome || props.municipio || props.name || props.Nome || 'Feição'}
          </span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-accent">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-1.5 max-h-[40vh] overflow-y-auto">
        {isFireEvent && <FireEventDetails feature={feature} props={props} />}
        {isUC && <UCDetails props={props} />}
        {isMunicipality && <MunicipalityDetails props={props} />}

        {weather && (
          <WeatherBlock weather={weather} loading={weatherLoading} />
        )}
        {isFireEvent && !weather && weatherLoading && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
            <Cloud className="w-3 h-3" />
            Consultando meteorologia...
          </div>
        )}
      </div>
    </div>
  );
}

function FireEventDetails({ feature, props }) {
  const nearestUC = AppCore.findNearestUC(feature);
  const area = computeArea(feature);

  return (
    <>
      <DetailRow label="Identificador" value={props.id || props.identificador || '—'} />
      <DetailRow label="Município" value={props.municipio || props.municipality || '—'} icon={MapPin} />
      <DetailRow label="Situação" value={props.situacao || props.status || '—'} />
      <DetailRow label="Área" value={formatArea(area)} />
      <DetailRow label="Data inicial" value={formatDate(props.data_inicio || props.data_ini)} icon={Clock} />
      <DetailRow label="Última atualização" value={formatDate(props.updated_date || props.data_fim)} />
      {props.fonte && <DetailRow label="Fonte" value={props.fonte} />}
      {feature.geometry?.coordinates && (
        <DetailRow
          label="Coordenadas"
          value={formatCoords(
            Array.isArray(feature.geometry.coordinates[0])
              ? feature.geometry.coordinates[0][0]
              : feature.geometry.coordinates[0],
            Array.isArray(feature.geometry.coordinates[0])
              ? feature.geometry.coordinates[0][1]
              : feature.geometry.coordinates[1]
          )}
        />
      )}
      {nearestUC && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 mb-1">
            <Shield className="w-3 h-3" />
            UC mais próxima
          </div>
          <div className="text-xs text-muted-foreground">
            {nearestUC.feature.properties?.nome || nearestUC.feature.properties?.name || '—'}
          </div>
          <div className="text-xs text-muted-foreground">
            Distância: {formatDistance(nearestUC.distance)}
          </div>
        </div>
      )}
    </>
  );
}

function UCDetails({ props }) {
  return (
    <>
      <DetailRow label="Nome" value={props.nome || props.name || '—'} />
      <DetailRow label="Categoria" value={props.categoria || props.category || '—'} />
      <DetailRow label="Esfera" value={props.esfera || props.sphere || '—'} />
      <DetailRow label="Grupo" value={props.grupo || props.group || '—'} />
      <DetailRow label="Órgão gestor" value={props.orgao_gestor || props.orgao || '—'} />
      <DetailRow label="Município" value={props.municipio || '—'} icon={MapPin} />
      <DetailRow label="Situação" value={props.situacao || '—'} />
    </>
  );
}

function MunicipalityDetails({ props }) {
  return (
    <>
      <DetailRow label="Município" value={props.nome || props.name || '—'} icon={MapPin} />
      <DetailRow label="Código IBGE" value={props.codarea || props.cod_ibge || '—'} />
    </>
  );
}

function WeatherBlock({ weather, loading }) {
  return (
    <div className="mt-2 pt-2 border-t border-border/50">
      <div className="flex items-center gap-1.5 text-xs font-medium mb-1.5">
        <Cloud className="w-3 h-3 text-blue-500" />
        Meteorologia
        {weather.fromCache && (
          <span className="text-[10px] text-amber-600 ml-1">(em cache)</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        <WeatherItem label="Temp." value={`${Math.round(weather.temp || 0)}°C`} />
        <WeatherItem label="Sensação" value={`${Math.round(weather.feelsLike || 0)}°C`} />
        <WeatherItem label="Umidade" value={`${Math.round(weather.humidity || 0)}%`} />
        <WeatherItem label="Vento" value={`${Math.round((weather.windSpeed || 0) * 3.6)} km/h`} />
        <WeatherItem label="Chuva" value={`${Math.round(weather.rainProb || 0)}%`} />
        <WeatherItem label="Condição" value={weather.condition || '—'} />
      </div>
    </div>
  );
}

function WeatherItem({ label, value }) {
  return (
    <div className="flex justify-between bg-accent/30 px-2 py-1 rounded">
      <span className="text-muted-foreground text-[11px]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function DetailRow({ label, value, icon: Icon }) {
  return (
    <div className="flex items-start justify-between gap-2 text-xs">
      <span className="text-muted-foreground flex items-center gap-1 flex-shrink-0">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </span>
      <span className="font-medium text-right truncate">{value}</span>
    </div>
  );
}