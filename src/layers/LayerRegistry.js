/**
 * LayerRegistry — registro central de definições de camadas.
 * Permite adicionar camadas sem alterar o componente principal do mapa.
 */
import { LAYER_DEFINITIONS, BASE_MAPS } from './LayerDefinitions';
import { LayerManager } from './LayerManager';

class LayerRegistryImpl {
  constructor() {
    this._definitions = [];
    this._baseMaps = new Map();
  }

  initialize() {
    Object.values(BASE_MAPS).forEach((bm) => this._baseMaps.set(bm.id, bm));
    LAYER_DEFINITIONS.forEach((def) => this._definitions.push(def));
  }

  register(definition) {
    this._definitions.push(definition);
    LayerManager.register(definition);
  }

  getBaseMap(id) {
    return this._baseMaps.get(id);
  }

  getBaseMaps() {
    return Array.from(this._baseMaps.values());
  }

  getDefinitions() {
    return [...this._definitions];
  }

  getDefinition(id) {
    return this._definitions.find((d) => d.id === id);
  }
}

export const LayerRegistry = new LayerRegistryImpl();