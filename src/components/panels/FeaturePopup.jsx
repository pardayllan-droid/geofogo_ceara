/**
 * FeaturePopup
 *
 * Exibe os detalhes da feição selecionada.
 *
 * Desktop:
 * - cartão flutuante no canto inferior esquerdo.
 *
 * Celular/tablet:
 * - gaveta inferior acima da navegação principal;
 * - cabeçalho fixo;
 * - conteúdo rolável;
 * - botão de fechar sempre visível.
 */

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import * as turf from '@turf/turf';

import {
  CalendarClock,
  Cloud,
  Download,
  Flame,
  MapPin,
  Shield,
  Timer,
  X,
} from 'lucide-react';

import {
  formatArea,
  formatCoords,
  formatDistance,
  formatHumidity,
  formatNumber,
  formatTemperature,
  formatWindDirection,
  formatWindSpeed,
} from '../../utils/formatters';

import {
  formatDate,
  timeAgoShort,
} from '../../utils/dates';

import {
  downloadFeatureAsKml,
} from '../../utils/kmlExporter';

import {
  loadWeatherForecast,
  parseForecastEntry,
  getCurrentEntry,
} from '../../services/weatherService';

import {
  AppCore,
} from '../../core/AppCore';

import {
  computeArea,
} from '../../spatial/SpatialEngine';

function isFireLayer(layerId) {
  return (
    layerId ===
      'fire-events' ||
    layerId ===
      'fire-events-markers'
  );
}

function getFeaturePoint(
  feature,
) {
  if (!feature?.geometry) {
    return null;
  }

  try {
    if (
      feature.geometry.type ===
      'Point'
    ) {
      const coordinates =
        feature.geometry
          .coordinates;

      if (
        Array.isArray(
          coordinates,
        ) &&
        Number.isFinite(
          Number(
            coordinates[0],
          ),
        ) &&
        Number.isFinite(
          Number(
            coordinates[1],
          ),
        )
      ) {
        return turf.point([
          Number(
            coordinates[0],
          ),
          Number(
            coordinates[1],
          ),
        ]);
      }
    }

    /*
     * pointOnFeature funciona para Polygon,
     * MultiPolygon, linhas e coleções, e retorna
     * um ponto localizado sobre a geometria.
     */
    return turf.pointOnFeature(
      feature,
    );
  } catch (error) {
    console.warn(
      '[FeaturePopup] Não foi possível obter ponto representativo:',
      error,
    );

    try {
      return turf.centerOfMass(
        feature,
      );
    } catch {
      return null;
    }
  }
}

function getFeatureCoordinates(
  feature,
) {
  const point =
    getFeaturePoint(feature);

  const coordinates =
    point?.geometry
      ?.coordinates;

  if (
    !Array.isArray(
      coordinates,
    ) ||
    coordinates.length < 2
  ) {
    return null;
  }

  const longitude =
    Number(coordinates[0]);

  const latitude =
    Number(coordinates[1]);

  if (
    !Number.isFinite(
      longitude,
    ) ||
    !Number.isFinite(
      latitude,
    )
  ) {
    return null;
  }

  return {
    longitude,
    latitude,
  };
}

function firstValue(
  values,
) {
  for (const value of values) {
    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ''
    ) {
      return value;
    }
  }

  return null;
}

function getMunicipalityName(
  properties,
) {
  return (
    firstValue([
      properties.municipio,
      properties.municipality,
      properties.nome_municipio,
      properties.nomeMunicipio,
    ]) ||
    'Evento sem município identificado'
  );
}

function formatPersistence(
  value,
) {
  const numeric =
    Number(value);

  if (!Number.isFinite(numeric)) {
    return '—';
  }

  const rounded =
    Number.isInteger(numeric)
      ? numeric
      : Number(
          numeric.toFixed(1),
        );

  return `${rounded} ${
    rounded === 1
      ? 'dia'
      : 'dias'
  }`;
}

export default function FeaturePopup({
  selectedFeature,
  onClose,
}) {
  const [weather, setWeather] =
    useState(null);

  const [
    weatherLoading,
    setWeatherLoading,
  ] = useState(false);

  const [
    downloadError,
    setDownloadError,
  ] = useState('');

  const {
    feature,
    layerId,
  } = selectedFeature || {};

  const properties =
    feature?.properties || {};

  const fireEvent =
    isFireLayer(layerId);

  const conservationUnit =
    layerId ===
    'conservation-units';

  const municipality =
    layerId ===
    'municipalities';

  const coordinates =
    useMemo(
      () =>
        getFeatureCoordinates(
          feature,
        ),
      [feature],
    );

  useEffect(() => {
    let cancelled = false;

    async function loadWeather() {
      if (
        !fireEvent ||
        !coordinates
      ) {
        return;
      }

      setWeather(null);
      setWeatherLoading(true);

      try {
        const result =
          await loadWeatherForecast(
            coordinates.latitude,
            coordinates.longitude,
          );

        if (
          cancelled ||
          !result
        ) {
          return;
        }

        const entry =
          getCurrentEntry(
            result.data,
          );

        const parsed =
          parseForecastEntry(
            entry,
          );

        if (!parsed) {
          return;
        }

        setWeather({
          ...parsed,

          fromCache:
            result.fromCache,

          updated:
            result.updated,
        });
      } catch (error) {
        console.error(
          '[FeaturePopup] Consulta meteorológica falhou:',
          error,
        );
      } finally {
        if (!cancelled) {
          setWeatherLoading(
            false,
          );
        }
      }
    }

    loadWeather();

    return () => {
      cancelled = true;
    };
  }, [
    fireEvent,
    coordinates,
  ]);

  useEffect(() => {
    function handleEscape(
      event,
    ) {
      if (
        event.key ===
        'Escape'
      ) {
        onClose?.();
      }
    }

    window.addEventListener(
      'keydown',
      handleEscape,
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleEscape,
      );
    };
  }, [onClose]);

  if (!feature) {
    return null;
  }

  const title =
    fireEvent
      ? getMunicipalityName(
          properties,
        )
      : firstValue([
          properties.nome,
          properties.municipio,
          properties.name,
          properties.Nome,
        ]) ||
        'Feição';

  function handleKmlDownload() {
    setDownloadError('');

    try {
      const datePart =
        properties.dt_maxima
          ? String(
              properties.dt_maxima,
            ).slice(0, 10)
          : 'sem-data';

      downloadFeatureAsKml(
        feature,
        {
          name: title,

          fileName:
            `evento-${title}-${datePart}`,
        },
      );
    } catch (error) {
      console.error(
        '[FeaturePopup] Não foi possível gerar o KML:',
        error,
      );

      setDownloadError(
        'Não foi possível gerar o arquivo KML.',
      );
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Fechar detalhes da feição"
        onClick={onClose}
        className="fixed inset-0 z-[44] hidden bg-black/25 max-md:block"
      />

      <section
        className="
          fixed z-[45]
          left-0 right-0
          bottom-[calc(var(--geofogo-bottom-nav-height)+env(safe-area-inset-bottom,0px))]
          flex max-h-[calc(100dvh-9rem)] flex-col
          overflow-hidden
          rounded-t-2xl
          border border-b-0 border-border
          bg-card shadow-2xl

          md:left-4 md:right-auto
          md:bottom-4
          md:w-[420px]
          md:max-w-[calc(100vw-2rem)]
          md:max-h-[calc(100dvh-6rem)]
          md:rounded-xl
          md:border
        "
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhes: ${title}`}
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <header className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-border bg-accent/50 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {fireEvent && (
              <Flame className="h-4 w-4 shrink-0 text-orange-500" />
            )}

            {conservationUnit && (
              <Shield className="h-4 w-4 shrink-0 text-green-600" />
            )}

            {municipality && (
              <MapPin className="h-4 w-4 shrink-0 text-blue-500" />
            )}

            <span className="truncate text-sm font-semibold">
              {title}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Fechar"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="touch-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4">
          {fireEvent && (
            <FireEventDetails
              feature={feature}
              properties={
                properties
              }
              coordinates={
                coordinates
              }
            />
          )}

          {conservationUnit && (
            <ConservationUnitDetails
              properties={
                properties
              }
            />
          )}

          {municipality && (
            <MunicipalityDetails
              properties={
                properties
              }
            />
          )}

          {weatherLoading && (
            <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
              <Cloud className="h-3.5 w-3.5" />

              Consultando meteorologia...
            </div>
          )}

          {weather && (
            <WeatherBlock
              weather={weather}
            />
          )}

          {fireEvent && (
            <div className="mt-4 border-t border-border pt-3">
              <button
                type="button"
                onClick={
                  handleKmlDownload
                }
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-xs font-semibold transition-colors hover:bg-accent"
              >
                <Download className="h-4 w-4" />

                Baixar evento em KML
              </button>

              {downloadError && (
                <p className="mt-2 text-center text-[11px] text-destructive">
                  {downloadError}
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function FireEventDetails({
  feature,
  properties,
  coordinates,
}) {
  let area = null;

  try {
    area =
      computeArea(feature);
  } catch {
    area =
      Number(
        properties.area_total_evento,
      );
  }

  const nearestConservationUnit =
    AppCore.findNearestUC?.(
      feature,
    );

  const firstDetection =
    firstValue([
      properties.dt_minima,
      properties.data_inicio,
      properties.data_ini,
    ]);

  const lastDetection =
    firstValue([
      properties.dt_maxima,
      properties.updated_date,
      properties.data_fim,
    ]);

  return (
    <div className="space-y-2">
      <DetailRow
        label="Município"
        value={getMunicipalityName(
          properties,
        )}
        icon={MapPin}
      />

      <DetailRow
        label="Área"
        value={formatArea(area)}
      />

      <DetailRow
        label="Persistência"
        value={formatPersistence(
          properties.persistencia_dias,
        )}
        icon={Timer}
      />

      <DetailRow
        label="Detecções"
        value={formatNumber(
          properties.qtd_deteccoes,
        )}
        icon={Flame}
      />

      <DetailRow
        label="Primeira detecção"
        value={formatDate(
          firstDetection,
        )}
        icon={CalendarClock}
      />

      <DetailRow
        label="Última detecção"
        value={formatDate(
          lastDetection,
        )}
        icon={CalendarClock}
      />

      <DetailRow
        label="Atualizado"
        value={timeAgoShort(
          lastDetection,
        )}
      />

      <DetailRow
        label="Coordenadas"
        value={
          coordinates
            ? formatCoords(
                coordinates.longitude,
                coordinates.latitude,
              )
            : '—'
        }
      />

      {nearestConservationUnit && (
        <div className="mt-3 rounded-lg border border-green-500/20 bg-green-500/10 p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-green-700 dark:text-green-300">
            <Shield className="h-3.5 w-3.5" />

            UC mais próxima
          </div>

          <p className="text-xs font-medium">
            {firstValue([
              nearestConservationUnit
                .feature
                ?.properties
                ?.nome,

              nearestConservationUnit
                .feature
                ?.properties
                ?.name,
            ]) || '—'}
          </p>

          <p className="mt-1 text-[11px] text-muted-foreground">
            Distância:{' '}
            {formatDistance(
              nearestConservationUnit
                .distance,
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function ConservationUnitDetails({
  properties,
}) {
  return (
    <div className="space-y-2">
      <DetailRow
        label="Nome"
        value={
          properties.nome ||
          properties.name ||
          '—'
        }
      />

      <DetailRow
        label="Categoria"
        value={
          properties.categoria ||
          properties.category ||
          '—'
        }
      />

      <DetailRow
        label="Esfera"
        value={
          properties.esfera ||
          properties.sphere ||
          '—'
        }
      />

      <DetailRow
        label="Grupo"
        value={
          properties.grupo ||
          properties.group ||
          '—'
        }
      />

      <DetailRow
        label="Órgão gestor"
        value={
          properties.orgao_gestor ||
          properties.orgao ||
          '—'
        }
      />

      <DetailRow
        label="Município"
        value={
          properties.municipio ||
          '—'
        }
        icon={MapPin}
      />
    </div>
  );
}

function MunicipalityDetails({
  properties,
}) {
  return (
    <div className="space-y-2">
      <DetailRow
        label="Município"
        value={
          properties.nome ||
          properties.municipio ||
          properties.name ||
          '—'
        }
        icon={MapPin}
      />

      <DetailRow
        label="Código IBGE"
        value={
          properties.codigo_ibge ||
          properties.codarea ||
          properties.cod_ibge ||
          '—'
        }
      />
    </div>
  );
}

function WeatherBlock({
  weather,
}) {
  const windSpeed =
    formatWindSpeed(
      weather.windSpeed,
    );

  const windDirection =
    formatWindDirection(
      weather.windDir,
    );

  const windValue =
    windDirection === '—'
      ? windSpeed
      : `${windSpeed} ${windDirection}`;

  return (
    <div className="mt-4 border-t border-border/60 pt-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
        <Cloud className="h-3.5 w-3.5 text-blue-500" />

        Meteorologia

        {weather.fromCache && (
          <span className="ml-1 text-[10px] font-normal text-amber-600">
            (em cache)
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <WeatherItem
          label="Temp."
          value={formatTemperature(
            weather.temp,
          )}
        />

        <WeatherItem
          label="Sensação"
          value={formatTemperature(
            weather.feelsLike,
          )}
        />

        <WeatherItem
          label="Umidade"
          value={formatHumidity(
            weather.humidity,
          )}
        />

        <WeatherItem
          label="Vento"
          value={windValue}
        />

        <WeatherItem
          label="Chuva"
          value={
            weather.rainProb ===
              null ||
            weather.rainProb ===
              undefined
              ? '—'
              : `${Math.round(
                  weather.rainProb,
                )}%`
          }
        />

        <WeatherItem
          label="Condição"
          value={
            weather.condition ||
            '—'
          }
        />
      </div>
    </div>
  );
}

function WeatherItem({
  label,
  value,
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-accent/30 px-2 py-1.5">
      <span className="shrink-0 text-[11px] text-muted-foreground">
        {label}
      </span>

      <span className="truncate text-right text-[11px] font-semibold">
        {value}
      </span>
    </div>
  );
}

function DetailRow({
  label,
  value,
  icon: Icon,
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
        {Icon && (
          <Icon className="h-3 w-3" />
        )}

        {label}
      </span>

      <span className="break-words text-right font-medium">
        {value ?? '—'}
      </span>
    </div>
  );
}