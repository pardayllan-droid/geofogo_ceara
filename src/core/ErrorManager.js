/**
 * ErrorManager
 *
 * Classifica e mantém erros recuperáveis da aplicação.
 * Uma falha isolada não deve derrubar todo o GeoFogo.
 *
 * Cada erro pode possuir uma chave própria por recurso.
 *
 * Exemplos:
 * - sipam:painel_do_fogo:mv_evento_filtro
 * - sipam:painel_do_fogo:mv_frente_deteccao
 * - weather
 * - storage
 */

import {
  EventBus,
  EVENTS,
} from './EventBus';

import {
  SIPAM_LAYERS,
} from '../services/sipamLayers';

const MESSAGES = {
  map:
    'Erro ao renderizar o mapa.',

  sipam:
    'Não foi possível atualizar os dados do SIPAM.',

  weather:
    'Os dados meteorológicos estão desatualizados.',

  layer:
    'Uma ou mais camadas estão temporariamente indisponíveis.',

  storage:
    'Erro ao acessar o armazenamento local.',

  sync:
    'Não foi possível concluir a sincronização de todas as camadas.',

  spatial:
    'Erro ao executar cálculos espaciais.',

  field:
    'Erro no Modo Campo.',

  conservation:
    'Não foi possível carregar as Unidades de Conservação.',
};

/**
 * Retorna uma mensagem adequada para cada camada SIPAM.
 */
function resolveSipamMessage(
  typeName,
) {
  if (
    typeName ===
    SIPAM_LAYERS.FIRE_EVENTS
  ) {
    return (
      'Não foi possível atualizar os eventos de fogo.'
    );
  }

  if (
    typeName ===
    SIPAM_LAYERS.FIRE_DETECTIONS
  ) {
    return (
      'Não foi possível atualizar as detecções classificadas.'
    );
  }

  return (
    'Não foi possível atualizar os dados do SIPAM.'
  );
}

/**
 * Resolve a mensagem pública que será apresentada
 * na interface.
 */
function resolveMessage(
  module,
  error,
  context = {},
) {
  /*
   * Permite que o módulo chamador defina uma
   * mensagem específica.
   */
  if (
    typeof context.userMessage ===
      'string' &&
    context.userMessage.trim()
  ) {
    return context.userMessage.trim();
  }

  if (module === 'sipam') {
    return resolveSipamMessage(
      context.typeName,
    );
  }

  return (
    MESSAGES[module] ||
    error?.message ||
    'Erro desconhecido.'
  );
}

/**
 * Cria uma chave exclusiva para o erro.
 */
function resolveErrorKey(
  module,
  context = {},
) {
  if (
    typeof context.errorKey ===
      'string' &&
    context.errorKey.trim()
  ) {
    return context.errorKey.trim();
  }

  /*
   * Cada camada do SIPAM mantém seu próprio estado.
   */
  if (
    module === 'sipam' &&
    context.typeName
  ) {
    return (
      `sipam:${context.typeName}`
    );
  }

  return module;
}

class ErrorManagerImpl {
  constructor() {
    this._errors =
      new Map();
  }

  /**
   * Registra ou atualiza um erro.
   */
  report(
    module,
    error,
    context = {},
  ) {
    const key =
      resolveErrorKey(
        module,
        context,
      );

    const entry = {
      key,
      module,

      message:
        resolveMessage(
          module,
          error,
          context,
        ),

      detail:
        error?.message ||
        String(error),

      context,
      timestamp:
        Date.now(),
    };

    this._errors.set(
      key,
      entry,
    );

    console.warn(
      `[ErrorManager:${key}]`,
      error,
    );

    EventBus.emit(
      EVENTS.ERROR,
      entry,
    );

    return entry;
  }

  /**
   * Remove um erro e informa a interface para que
   * ela atualize imediatamente sua lista.
   */
  clear(key) {
    const removed =
      this._errors.delete(
        key,
      );

    if (removed) {
      EventBus.emit(
        EVENTS.ERROR,
        {
          cleared: true,
          key,
        },
      );
    }

    return removed;
  }

  /**
   * Remove todos os erros pertencentes a um módulo.
   *
   * Exemplo:
   * clearModule('sipam')
   */
  clearModule(module) {
    let removedCount = 0;

    for (
      const [
        key,
        entry,
      ] of this._errors.entries()
    ) {
      if (
        entry?.module === module
      ) {
        this._errors.delete(
          key,
        );

        removedCount += 1;
      }
    }

    if (removedCount > 0) {
      EventBus.emit(
        EVENTS.ERROR,
        {
          cleared: true,
          module,
          removedCount,
        },
      );
    }

    return removedCount;
  }

  /**
   * Remove todos os erros registrados.
   */
  clearAll() {
    if (
      this._errors.size === 0
    ) {
      return false;
    }

    this._errors.clear();

    EventBus.emit(
      EVENTS.ERROR,
      {
        cleared: true,
        all: true,
      },
    );

    return true;
  }

  /**
   * Obtém um erro por sua chave completa.
   */
  get(key) {
    return (
      this._errors.get(key) ||
      null
    );
  }

  /**
   * Retorna todos os erros ativos.
   */
  all() {
    return Array.from(
      this._errors.values(),
    );
  }

  /**
   * Verifica se uma chave de erro está ativa.
   */
  has(key) {
    return this._errors.has(
      key,
    );
  }

  /**
   * Verifica se existe algum erro de um módulo.
   */
  hasModule(module) {
    return this.all().some(
      (entry) =>
        entry?.module ===
        module,
    );
  }
}

export const ErrorManager =
  new ErrorManagerImpl();