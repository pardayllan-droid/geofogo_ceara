/**
 * DiagnosticPanel
 *
 * Painel temporário de diagnóstico do GeoFogo Ceará.
 *
 * Objetivos:
 * - permitir diagnóstico em tablets e celulares sem DevTools;
 * - mostrar quantidades reais armazenadas no AppCore;
 * - mostrar o estado das camadas registradas;
 * - mostrar o resultado detalhado da sincronização;
 * - mostrar erros do ErrorManager;
 * - permitir copiar/selecionar um relatório textual.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clipboard,
  Database,
  Map,
  RefreshCw,
  Server,
  Smartphone,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react';

import { AppCore } from '../../core/AppCore';
import {
  EventBus,
  EVENTS,
} from '../../core/EventBus';
import { ErrorManager } from '../../core/ErrorManager';
import { LayerManager } from '../../layers/LayerManager';
import { SyncEngine } from '../../sync/SyncEngine';

const EMPTY_COLLECTION = {
  type: 'FeatureCollection',
  features: [],
};

function countFeatures(collection) {
  return Array.isArray(collection?.features)
    ? collection.features.length
    : 0;
}

function formatDate(timestamp) {
  if (!timestamp) {
    return 'Nunca';
  }

  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(timestamp));
  } catch {
    return String(timestamp);
  }
}

function normalizeError(error) {
  if (!error) {
    return null;
  }

  if (typeof error === 'string') {
    return {
      message: error,
      detail: error,
    };
  }

  return {
    module:
      error.module ||
      error.context?.module ||
      'desconhecido',

    message:
      error.message ||
      error.detail ||
      'Erro sem mensagem.',

    detail:
      error.detail ||
      error.error ||
      error.message ||
      String(error),

    context: error.context || null,
    timestamp: error.timestamp || null,
  };
}

function getLayerFeatureCount(layer) {
  const sourceId = `src-${layer.id}`;

  /*
   * _sources é uma estrutura interna do LayerManager.
   * Seu uso aqui é intencional e restrito ao diagnóstico.
   */
  const source =
    LayerManager._sources?.get?.(sourceId);

  return countFeatures(source?.data);
}

function getMapLayerState(layer) {
  const map = LayerManager._map;

  if (!map) {
    return {
      sourceCreated: false,
      layerCreated: false,
      outlineCreated: false,
    };
  }

  return {
    sourceCreated: Boolean(
      map.getSource?.(`src-${layer.id}`),
    ),

    layerCreated: Boolean(
      map.getLayer?.(layer.id),
    ),

    outlineCreated: Boolean(
      map.getLayer?.(`${layer.id}-outline`),
    ),
  };
}

function readDiagnosticState() {
  const syncInfo =
    typeof SyncEngine.getState === 'function'
      ? SyncEngine.getState()
      : {
          state: SyncEngine.state,
          syncing: Boolean(SyncEngine.syncing),
          progress: SyncEngine.progress || {},
        };

  const layers =
    LayerManager.getAllLayers?.() || [];

  const layerDetails = layers.map((layer) => ({
    id: layer.id,
    label:
      layer.label ||
      layer.name ||
      layer.title ||
      layer.id,

    group: layer.group || 'Outros',
    visible: layer.visible !== false,
    loading: Boolean(layer.loading),
    error: normalizeError(layer.error),
    lastUpdated: layer.lastUpdated || null,
    featureCount: getLayerFeatureCount(layer),
    ...getMapLayerState(layer),
  }));

  const errors = ErrorManager.all()
    .map(normalizeError)
    .filter(Boolean);

  return {
    generatedAt: Date.now(),

    browser: {
      online:
        typeof navigator === 'undefined'
          ? true
          : navigator.onLine !== false,

      userAgent:
        typeof navigator === 'undefined'
          ? 'Indisponível'
          : navigator.userAgent,

      language:
        typeof navigator === 'undefined'
          ? 'Indisponível'
          : navigator.language,

      standalone:
        typeof window !== 'undefined' &&
        (
          window.matchMedia?.(
            '(display-mode: standalone)',
          )?.matches ||
          window.navigator?.standalone === true
        ),
    },

    application: {
      initialized: Boolean(AppCore.initialized),
      mapReady: Boolean(
        LayerManager.isReady?.(),
      ),

      bbox:
        AppCore.cearaBbox || null,

      syncState:
        syncInfo?.state ||
        SyncEngine.state ||
        'desconhecido',

      syncing: Boolean(
        syncInfo?.syncing ??
          SyncEngine.syncing,
      ),

      syncProgress:
        syncInfo?.progress ||
        SyncEngine.progress ||
        {},
    },

    data: {
      boundary: countFeatures(
        AppCore.cearaBoundary,
      ),

      municipalities: countFeatures(
        AppCore.municipalities,
      ),

      conservationUnits: countFeatures(
        AppCore.conservationUnits,
      ),

      fireEvents: countFeatures(
        AppCore.fireEvents,
      ),

      fireFronts: countFeatures(
        AppCore.fireFronts,
      ),

      alerts: Array.isArray(AppCore.alerts)
        ? AppCore.alerts.length
        : 0,
    },

    layers: layerDetails,
    errors,
  };
}

function buildReport(snapshot) {
  const lines = [];

  lines.push('DIAGNÓSTICO GEOFOGO CEARÁ');
  lines.push(
    `Gerado em: ${formatDate(
      snapshot.generatedAt,
    )}`,
  );

  lines.push('');
  lines.push('APLICAÇÃO');
  lines.push(
    `Inicializada: ${
      snapshot.application.initialized
        ? 'sim'
        : 'não'
    }`,
  );

  lines.push(
    `Mapa conectado: ${
      snapshot.application.mapReady
        ? 'sim'
        : 'não'
    }`,
  );

  lines.push(
    `Internet: ${
      snapshot.browser.online
        ? 'online'
        : 'offline'
    }`,
  );

  lines.push(
    `Modo instalado/PWA: ${
      snapshot.browser.standalone
        ? 'sim'
        : 'não'
    }`,
  );

  lines.push(
    `Sincronização: ${snapshot.application.syncState}`,
  );

  lines.push(
    `Sincronizando agora: ${
      snapshot.application.syncing
        ? 'sim'
        : 'não'
    }`,
  );

  lines.push(
    `BBOX do Ceará: ${
      snapshot.application.bbox ||
      'não calculada'
    }`,
  );

  const progress =
    snapshot.application.syncProgress || {};

  if (progress.message) {
    lines.push(
      `Mensagem: ${progress.message}`,
    );
  }

  if (progress.current) {
    lines.push(
      `Tarefa atual: ${progress.current}`,
    );
  }

  if (Array.isArray(progress.completed)) {
    lines.push(
      `Tarefas concluídas: ${
        progress.completed.join(', ') ||
        'nenhuma'
      }`,
    );
  }

  if (Array.isArray(progress.failed)) {
    lines.push(
      `Tarefas com falha: ${
        progress.failed.join(', ') ||
        'nenhuma'
      }`,
    );
  }

  lines.push('');
  lines.push('DADOS NO APPCORE');
  lines.push(
    `Limite do Ceará: ${snapshot.data.boundary}`,
  );
  lines.push(
    `Municípios: ${snapshot.data.municipalities}`,
  );
  lines.push(
    `Unidades de Conservação: ${snapshot.data.conservationUnits}`,
  );
  lines.push(
    `Eventos de fogo: ${snapshot.data.fireEvents}`,
  );
  lines.push(
    `Frentes de fogo: ${snapshot.data.fireFronts}`,
  );
  lines.push(
    `Alertas: ${snapshot.data.alerts}`,
  );

  lines.push('');
  lines.push('CAMADAS DO MAPA');

  if (snapshot.layers.length === 0) {
    lines.push(
      'Nenhuma camada registrada.',
    );
  } else {
    snapshot.layers.forEach((layer) => {
      lines.push('');
      lines.push(
        `${layer.label} [${layer.id}]`,
      );

      lines.push(
        `- grupo: ${layer.group}`,
      );

      lines.push(
        `- visível: ${
          layer.visible ? 'sim' : 'não'
        }`,
      );

      lines.push(
        `- feições na fonte: ${layer.featureCount}`,
      );

      lines.push(
        `- source criada: ${
          layer.sourceCreated
            ? 'sim'
            : 'não'
        }`,
      );

      lines.push(
        `- layer criada: ${
          layer.layerCreated
            ? 'sim'
            : 'não'
        }`,
      );

      lines.push(
        `- outline criada: ${
          layer.outlineCreated
            ? 'sim'
            : 'não'
        }`,
      );

      lines.push(
        `- última atualização: ${formatDate(
          layer.lastUpdated,
        )}`,
      );

      if (layer.error) {
        lines.push(
          `- erro: ${layer.error.detail}`,
        );
      }
    });
  }

  lines.push('');
  lines.push('ERROS');

  if (snapshot.errors.length === 0) {
    lines.push(
      'Nenhum erro registrado no ErrorManager.',
    );
  } else {
    snapshot.errors.forEach(
      (error, index) => {
        lines.push('');
        lines.push(
          `${index + 1}. Módulo: ${
            error.module
          }`,
        );

        lines.push(
          `Mensagem: ${error.message}`,
        );

        lines.push(
          `Detalhe: ${error.detail}`,
        );

        if (error.timestamp) {
          lines.push(
            `Horário: ${formatDate(
              error.timestamp,
            )}`,
          );
        }

        if (error.context) {
          try {
            lines.push(
              `Contexto: ${JSON.stringify(
                error.context,
              )}`,
            );
          } catch {
            lines.push(
              'Contexto: não serializável',
            );
          }
        }
      },
    );
  }

  lines.push('');
  lines.push('DISPOSITIVO');
  lines.push(
    `Idioma: ${snapshot.browser.language}`,
  );
  lines.push(
    `User agent: ${snapshot.browser.userAgent}`,
  );

  return lines.join('\n');
}

function StatusIcon({
  ok,
  warning = false,
}) {
  if (warning) {
    return (
      <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
    );
  }

  if (ok) {
    return (
      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
    );
  }

  return (
    <XCircle className="h-4 w-4 shrink-0 text-red-500" />
  );
}

function MetricRow({
  label,
  value,
  ok,
  warning = false,
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2">
        <StatusIcon
          ok={ok}
          warning={warning}
        />

        <span className="text-xs text-foreground">
          {label}
        </span>
      </div>

      <span className="shrink-0 text-xs font-semibold text-foreground">
        {value}
      </span>
    </div>
  );
}

export default function DiagnosticPanel({
  onSync,
  syncing = false,
}) {
  const [snapshot, setSnapshot] =
    useState(() => readDiagnosticState());

  const [copyState, setCopyState] =
    useState('');

  const refresh = useCallback(() => {
    setSnapshot(readDiagnosticState());
  }, []);

  useEffect(() => {
    refresh();

    const events = [
      EVENTS.APP_READY,
      EVENTS.MAP_READY,
      EVENTS.CONNECTION_CHANGED,
      EVENTS.SYNC_STARTED,
      EVENTS.SYNC_PROGRESS,
      EVENTS.SYNC_COMPLETED,
      EVENTS.SYNC_FAILED,
      EVENTS.LAYER_REGISTERED,
      EVENTS.LAYER_VISIBILITY_CHANGED,
      EVENTS.LAYER_DATA_UPDATED,
      EVENTS.DATA_UPDATED,
      EVENTS.ERROR,
    ];

    const unsubs = events.map((event) =>
      EventBus.on(event, refresh),
    );

    const intervalId =
      window.setInterval(refresh, 2000);

    return () => {
      unsubs.forEach((unsubscribe) =>
        unsubscribe?.(),
      );

      window.clearInterval(intervalId);
    };
  }, [refresh]);

  const report = useMemo(
    () => buildReport(snapshot),
    [snapshot],
  );

  const copyReport = useCallback(async () => {
    setCopyState('');

    try {
      if (
        navigator.clipboard &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(
          report,
        );

        setCopyState(
          'Relatório copiado.',
        );

        return;
      }

      /*
       * No Edge Android o acesso à área de
       * transferência pode ser bloqueado.
       * Nesse caso, selecionamos a caixa de
       * texto para cópia manual.
       */
      const textarea =
        document.getElementById(
          'geofogo-diagnostic-report',
        );

      textarea?.focus();
      textarea?.select();
      textarea?.setSelectionRange?.(
        0,
        report.length,
      );

      setCopyState(
        'Texto selecionado. Use Copiar no menu do Android.',
      );
    } catch (error) {
      console.warn(
        '[DiagnosticPanel] Falha ao copiar:',
        error,
      );

      const textarea =
        document.getElementById(
          'geofogo-diagnostic-report',
        );

      textarea?.focus();
      textarea?.select();

      setCopyState(
        'Não foi possível copiar automaticamente. O texto foi selecionado.',
      );
    }
  }, [report]);

  const forceSync =
    useCallback(async () => {
      setCopyState('');

      try {
        await onSync?.();
      } finally {
        refresh();
      }
    }, [onSync, refresh]);

  const syncState =
    snapshot.application.syncState;

  const hasSyncError =
    syncState === 'error' ||
    syncState === 'partial' ||
    snapshot.errors.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">
            Diagnóstico
          </h2>

          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Estado interno do GeoFogo
          </p>
        </div>

        <button
          type="button"
          onClick={refresh}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Atualizar diagnóstico"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <section>
          <div className="mb-2 flex items-center gap-2">
            <Activity className="h-4 w-4 text-amber-500" />

            <h3 className="text-xs font-semibold uppercase tracking-wide">
              Aplicação
            </h3>
          </div>

          <div className="rounded-lg border border-border bg-background px-3">
            <MetricRow
              label="Aplicação inicializada"
              value={
                snapshot.application.initialized
                  ? 'Sim'
                  : 'Não'
              }
              ok={
                snapshot.application.initialized
              }
            />

            <MetricRow
              label="Mapa conectado"
              value={
                snapshot.application.mapReady
                  ? 'Sim'
                  : 'Não'
              }
              ok={
                snapshot.application.mapReady
              }
            />

            <MetricRow
              label="Conexão"
              value={
                snapshot.browser.online
                  ? 'Online'
                  : 'Offline'
              }
              ok={snapshot.browser.online}
            />

            <MetricRow
              label="Sincronização"
              value={syncState}
              ok={
                syncState === 'success'
              }
              warning={
                syncState === 'syncing' ||
                syncState === 'checking' ||
                syncState === 'partial'
              }
            />

            <MetricRow
              label="BBOX calculada"
              value={
                snapshot.application.bbox
                  ? 'Sim'
                  : 'Não'
              }
              ok={Boolean(
                snapshot.application.bbox,
              )}
            />
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2">
            <Database className="h-4 w-4 text-amber-500" />

            <h3 className="text-xs font-semibold uppercase tracking-wide">
              Dados carregados
            </h3>
          </div>

          <div className="rounded-lg border border-border bg-background px-3">
            <MetricRow
              label="Limite do Ceará"
              value={`${snapshot.data.boundary} feição(ões)`}
              ok={
                snapshot.data.boundary > 0
              }
            />

            <MetricRow
              label="Municípios"
              value={`${snapshot.data.municipalities} feição(ões)`}
              ok={
                snapshot.data.municipalities >=
                100
              }
              warning={
                snapshot.data.municipalities >
                  0 &&
                snapshot.data.municipalities <
                  100
              }
            />

            <MetricRow
              label="Unidades de Conservação"
              value={`${snapshot.data.conservationUnits} feição(ões)`}
              ok={
                snapshot.data
                  .conservationUnits > 0
              }
            />

            <MetricRow
              label="Eventos de fogo"
              value={`${snapshot.data.fireEvents} feição(ões)`}
              ok={
                snapshot.data.fireEvents > 0
              }
              warning={
                snapshot.data.fireEvents === 0 &&
                snapshot.browser.online
              }
            />

            <MetricRow
              label="Frentes de fogo"
              value={`${snapshot.data.fireFronts} feição(ões)`}
              ok={
                snapshot.data.fireFronts > 0
              }
              warning={
                snapshot.data.fireFronts === 0
              }
            />

            <MetricRow
              label="Alertas"
              value={snapshot.data.alerts}
              ok={snapshot.data.alerts > 0}
              warning={
                snapshot.data.alerts === 0
              }
            />
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2">
            <Map className="h-4 w-4 text-amber-500" />

            <h3 className="text-xs font-semibold uppercase tracking-wide">
              Camadas do mapa
            </h3>
          </div>

          <div className="space-y-2">
            {snapshot.layers.length === 0 ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
                Nenhuma camada foi registrada.
              </div>
            ) : (
              snapshot.layers.map((layer) => {
                const completelyReady =
                  layer.sourceCreated &&
                  layer.layerCreated;

                return (
                  <div
                    key={layer.id}
                    className="rounded-lg border border-border bg-background p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">
                          {layer.label}
                        </p>

                        <p className="truncate text-[10px] text-muted-foreground">
                          {layer.id}
                        </p>
                      </div>

                      <StatusIcon
                        ok={completelyReady}
                        warning={
                          !completelyReady &&
                          layer.featureCount > 0
                        }
                      />
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                      <span className="text-muted-foreground">
                        Feições
                      </span>

                      <span className="text-right font-medium">
                        {layer.featureCount}
                      </span>

                      <span className="text-muted-foreground">
                        Source
                      </span>

                      <span className="text-right font-medium">
                        {layer.sourceCreated
                          ? 'criada'
                          : 'ausente'}
                      </span>

                      <span className="text-muted-foreground">
                        Layer
                      </span>

                      <span className="text-right font-medium">
                        {layer.layerCreated
                          ? 'criada'
                          : 'ausente'}
                      </span>

                      <span className="text-muted-foreground">
                        Visível
                      </span>

                      <span className="text-right font-medium">
                        {layer.visible
                          ? 'sim'
                          : 'não'}
                      </span>
                    </div>

                    {layer.error && (
                      <div className="mt-2 rounded-md bg-red-500/10 p-2 text-[11px] text-red-700 dark:text-red-300">
                        {layer.error.detail}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2">
            <Server className="h-4 w-4 text-amber-500" />

            <h3 className="text-xs font-semibold uppercase tracking-wide">
              Sincronização
            </h3>
          </div>

          <div className="rounded-lg border border-border bg-background p-3 text-xs">
            <p>
              <span className="text-muted-foreground">
                Mensagem:
              </span>{' '}
              {snapshot.application
                .syncProgress?.message ||
                'Nenhuma mensagem.'}
            </p>

            <p className="mt-2">
              <span className="text-muted-foreground">
                Tarefa atual:
              </span>{' '}
              {snapshot.application
                .syncProgress?.currentLabel ||
                snapshot.application
                  .syncProgress?.current ||
                'Nenhuma'}
            </p>

            <p className="mt-2">
              <span className="text-muted-foreground">
                Concluídas:
              </span>{' '}
              {snapshot.application
                .syncProgress?.completed?.join?.(
                  ', ',
                ) || 'Nenhuma'}
            </p>

            <p className="mt-2">
              <span className="text-muted-foreground">
                Falhas:
              </span>{' '}
              {snapshot.application
                .syncProgress?.failed?.join?.(
                  ', ',
                ) || 'Nenhuma'}
            </p>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />

            <h3 className="text-xs font-semibold uppercase tracking-wide">
              Erros registrados
            </h3>
          </div>

          {snapshot.errors.length === 0 ? (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-700 dark:text-green-300">
              Nenhum erro registrado.
            </div>
          ) : (
            <div className="space-y-2">
              {snapshot.errors.map(
                (error, index) => (
                  <div
                    key={`${error.module}-${error.timestamp}-${index}`}
                    className="rounded-lg border border-red-500/30 bg-red-500/10 p-3"
                  >
                    <p className="text-xs font-semibold text-red-700 dark:text-red-300">
                      {error.module}
                    </p>

                    <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                      {error.message}
                    </p>

                    {error.detail !==
                      error.message && (
                      <p className="mt-2 break-words text-[11px] text-red-700/80 dark:text-red-300/80">
                        {error.detail}
                      </p>
                    )}

                    {error.timestamp && (
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        {formatDate(
                          error.timestamp,
                        )}
                      </p>
                    )}
                  </div>
                ),
              )}
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-amber-500" />

            <h3 className="text-xs font-semibold uppercase tracking-wide">
              Relatório
            </h3>
          </div>

          <textarea
            id="geofogo-diagnostic-report"
            value={report}
            readOnly
            rows={12}
            className="w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-[10px] leading-relaxed text-foreground"
            aria-label="Relatório de diagnóstico"
          />

          {copyState && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {copyState}
            </p>
          )}
        </section>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
        <button
          type="button"
          onClick={forceSync}
          disabled={syncing}
          className="flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              syncing ? 'animate-spin' : ''
            }`}
          />

          Sincronizar
        </button>

        <button
          type="button"
          onClick={copyReport}
          className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-accent"
        >
          <Clipboard className="h-4 w-4" />
          Copiar
        </button>
      </div>

      {hasSyncError && (
        <div className="border-t border-red-500/20 bg-red-500/10 px-3 py-2 text-center text-[10px] text-red-700 dark:text-red-300">
          Foram detectadas falhas. Copie o relatório e envie para análise.
        </div>
      )}
    </div>
  );
}