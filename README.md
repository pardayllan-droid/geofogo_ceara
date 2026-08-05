# 🔥 GeoFogo Ceará

Sistema geoespacial para monitoramento de incêndios florestais e apoio às operações de campo no Estado do Ceará.

**Monitoramento • Alertas • Operação em Campo • Offline • PWA**

---

## Sobre o projeto

O **GeoFogo Ceará** foi desenvolvido para reunir, em uma única aplicação cartográfica, informações relevantes ao monitoramento, planejamento e resposta a incêndios florestais.

A aplicação integra dados de eventos e frentes de fogo, limites territoriais, áreas ambientalmente sensíveis, meteorologia e registros operacionais de campo.

O projeto foi concebido para funcionar tanto em computadores quanto em dispositivos móveis, inclusive em condições de conectividade limitada.

---

## Principais funcionalidades

### Monitoramento de incêndios

- eventos de fogo obtidos por serviço WFS do SIPAM;
- frentes de fogo;
- classificação visual dos eventos pela idade da última detecção;
- área afetada em hectares;
- identificação do município;
- popup com informações operacionais;
- prévia da geometria;
- exportação em KML.

### Áreas Sensíveis

Atualmente são consideradas:

- Unidades de Conservação;
- Terras Indígenas.

A arquitetura permite incorporar futuramente outras categorias, como:

- comunidades quilombolas;
- assentamentos;
- áreas urbanizadas;
- hospitais;
- escolas;
- reservatórios;
- linhas de transmissão;
- subestações;
- torres de comunicação.

### Alertas geográficos

O sistema calcula a distância real entre eventos de fogo e Áreas Sensíveis.

Os alertas são classificados por criticidade:

- **Crítico** — interseção ou distância de até 500 metros;
- **Alto** — distância de até 1 quilômetro;
- **Atenção** — dentro da distância configurada pelo usuário.

A distância máxima de alerta pode ser alterada no painel de ajustes.

### Funcionamento offline

O GeoFogo utiliza IndexedDB e Service Worker para armazenar localmente:

- limite do Ceará;
- municípios;
- Unidades de Conservação;
- Terras Indígenas;
- eventos de fogo;
- frentes de fogo;
- alertas;
- configurações;
- trilhos;
- marcadores de campo.

Os dados previamente sincronizados permanecem disponíveis sem conexão com a internet.

### Diagnóstico integrado

A aplicação possui um painel técnico para acompanhar:

- inicialização;
- conexão do mapa;
- sincronização;
- validade do cache;
- fontes e camadas;
- quantidade de feições;
- renderização real do MapLibre;
- erros registrados;
- desempenho das etapas de carregamento.

### Modo Campo

O módulo Campo está sendo desenvolvido para apoiar operações realizadas com dispositivos móveis.

Recursos já implementados:

- ativação do GPS;
- posição atual no mapa;
- iniciar, pausar, retomar e finalizar trilhos;
- persistência progressiva dos trilhos;
- recuperação após interrupções;
- distância e duração;
- velocidade atual, média e máxima;
- tempo em movimento e parado;
- altitude;
- precisão média;
- criação de marcadores independentes ou vinculados a trilhos;
- categorias operacionais de marcadores;
- personalização de cor, ícone e tamanho;
- personalização da aparência dos trilhos;
- exportação em GeoJSON e GPX.

Categorias iniciais de marcadores:

- Foco ativo;
- Viatura;
- Ponto d’água;
- Bloqueio;
- Área de risco;
- Atendimento;
- Observação.

Em desenvolvimento:

- entrada manual de coordenadas;
- graus decimais;
- GMS;
- UTM;
- detecção automática de coordenadas copiadas;
- pré-visualização antes de salvar;
- navegação até um marcador;
- opção para ativar ou desativar a centralização automática na posição atual.

---

## Tecnologias

| Tecnologia | Finalidade |
|---|---|
| React | Interface |
| Vite | Desenvolvimento e build |
| JavaScript | Linguagem principal |
| MapLibre GL JS | Motor cartográfico |
| Turf.js | Processamento espacial |
| Tailwind CSS | Estilização |
| Lucide React | Ícones |
| IndexedDB | Persistência local |
| Service Worker | Cache offline |
| PWA | Instalação e execução móvel |
| Cloudflare Pages | Hospedagem |
| Capacitor | Futuro aplicativo Android |

---

## Arquitetura

A aplicação utiliza uma arquitetura modular:

```text
AppCore
├── SyncEngine
├── LayerManager
├── AlertEngine
├── SpatialEngine
├── FieldController
├── EventBus
├── ErrorManager
└── IndexedDB

| Prioridade | Item                                                     | Status          |
| ---------- | -------------------------------------------------------- | --------------- |
| 🔴         | Finalizar funções de GPS                                 | Em andamento    |
| 🔴         | Consolidar layout e diagramação                          | Parcial         |
| 🔴         | Testes completos (desktop + Android + PWA)               | Pendente        |
| 🟡         | Hospedagem Cloudflare Pages                              | Em andamento    |
| 🟡         | Segurança das chaves de API                              | Pendente        |
| 🟡         | Revisão do README                                        | Quase concluído |
| 🟢         | APK via Capacitor                                        | Depois da v1.0  |
