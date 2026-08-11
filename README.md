# 🔥 GeoFogo Ceará

Sistema geoespacial para monitoramento de eventos de fogo e apoio às operações de campo no Estado do Ceará.

**Monitoramento • Alertas • Áreas Sensíveis • Operação em Campo • Offline • PWA**

---

## Sobre o projeto

O **GeoFogo Ceará** reúne, em uma única aplicação cartográfica, informações destinadas ao monitoramento, planejamento e apoio operacional relacionado a eventos de fogo no Estado do Ceará.

A aplicação integra:

* eventos e frentes de fogo;
* limites territoriais;
* municípios;
* Áreas Sensíveis;
* alertas espaciais;
* informações meteorológicas;
* estatísticas;
* registros operacionais de campo.

O projeto foi desenvolvido como aplicação web progressiva (**PWA**) para uso em computadores e dispositivos móveis, inclusive em situações de conectividade limitada.

---

## Principais funcionalidades

### Monitoramento de eventos de fogo

O GeoFogo apresenta no mapa eventos e frentes de fogo obtidos por serviços geoespaciais do SIPAM.

Entre as informações e recursos disponíveis estão:

* eventos de fogo;
* frentes de fogo;
* classificação visual dos eventos conforme o tempo desde a última detecção;
* geometria e área afetada;
* identificação do município;
* informações operacionais;
* enquadramento automático dos eventos no mapa;
* estatísticas e resumos;
* exportação de dados quando disponível.

A seleção de um evento pelos painéis de resumo apenas enquadra sua geometria no mapa. Os detalhes são apresentados quando o evento é selecionado diretamente no mapa.

---

## Áreas Sensíveis

A aplicação utiliza o conceito de **Áreas Sensíveis** para representar territórios ou estruturas que podem exigir atenção especial diante da proximidade de eventos de fogo.

Na versão 1.0 são consideradas:

* **Unidades de Conservação**;
* **Terras Indígenas**.

A arquitetura permite incorporar futuramente outras categorias de áreas sensíveis sem alterar o conceito geral do sistema.

---

## Alertas espaciais

O GeoFogo calcula espacialmente a relação entre eventos de fogo e Áreas Sensíveis, considerando interseção e distância.

A distância máxima para geração de alertas é configurável pelo usuário.

A classificação operacional é:

* **Crítico** — interseção ou distância de até 500 metros;
* **Alto** — acima de 500 metros e até 1 quilômetro;
* **Atenção** — acima de 1 quilômetro e até o limite configurado;
* acima do limite configurado — **não gera alerta**.

O painel **Resumo** apresenta uma legenda operacional expansível com:

* cores dos eventos conforme o tempo desde a última detecção;
* criticidade dos alertas;
* distância máxima de alerta atualmente configurada.

---

## Meteorologia

A previsão meteorológica é obtida através do **Open-Meteo**.

A integração atual disponibiliza informações como:

* temperatura;
* sensação térmica;
* umidade relativa;
* velocidade e direção do vento;
* rajadas;
* probabilidade de precipitação;
* condição meteorológica.

O Open-Meteo utilizado pelo GeoFogo não exige API key no endpoint público empregado pela aplicação.

Camadas meteorológicas dinâmicas de vento, temperatura e umidade não fazem parte da versão 1.0 e poderão ser avaliadas em versões futuras.

---

## Funcionamento offline

O GeoFogo utiliza **IndexedDB** para persistência de dados e **Service Worker/Workbox** para recursos da PWA e cache.

Depois de uma sincronização online, permanecem disponíveis localmente dados como:

* limite do Ceará;
* municípios;
* Áreas Sensíveis;
* eventos de fogo;
* frentes de fogo;
* alertas;
* preferências do usuário;
* Missões;
* trilhos;
* marcadores de campo.

A aplicação pode ser reiniciada sem conexão e recuperar os dados previamente armazenados.

### Mapa-base offline

O mapa-base utiliza **cache oportunista**.

Tiles que já tenham sido carregados anteriormente podem continuar disponíveis offline. Regiões do mapa nunca visualizadas anteriormente podem não possuir mapa-base quando não houver conexão.

Portanto, a versão 1.0 **não deve ser interpretada como possuindo download completo de mapas-base para uso offline**.

Os dados operacionais armazenados localmente permanecem independentes dessa limitação.

---

## Modo Campo

O **Modo Campo** oferece recursos para registro e consulta de informações operacionais em dispositivos móveis ou desktop.

O painel Campo pode ser consultado mesmo quando o modo operacional/GPS não está ativo.

### GPS

O sistema permite:

* ativar a localização;
* acompanhar a posição atual;
* centralizar o mapa na posição;
* utilizar a localização durante a gravação de trilhos e criação de registros.

### Trilhos

É possível:

* iniciar gravação;
* pausar;
* retomar;
* finalizar;
* armazenar progressivamente o percurso;
* recuperar trilhos persistidos;
* consultar distância e duração;
* consultar velocidade atual, média e máxima;
* consultar tempo em movimento e parado;
* registrar informações de altitude e precisão quando disponíveis;
* alterar a aparência do trilho;
* controlar sua visibilidade no mapa.

### Marcadores

Marcadores podem ser criados:

* utilizando a posição atual;
* através da entrada manual de coordenadas;
* vinculados a uma Missão;
* sem vínculo com uma Missão.

Os marcadores permitem personalização visual, incluindo propriedades como cor, ícone e tamanho.

As categorias operacionais disponíveis podem incluir, entre outras:

* Foco ativo;
* Viatura;
* Ponto d'água;
* Bloqueio;
* Área de risco;
* Atendimento;
* Observação.

---

## Missões e registros Sem missão

O Modo Campo organiza os registros em **Missões**.

Uma Missão pode agrupar trilhos e marcadores relacionados a uma determinada operação.

Apenas uma Missão pode estar selecionada como destino de novos registros por vez.

O comportamento é:

* selecionar uma Missão torna essa Missão o destino dos novos registros;
* tocar novamente na Missão selecionada a desmarca;
* quando nenhuma Missão está selecionada, novos registros são armazenados em **Sem missão**;
* a seleção da Missão é persistida entre reinicializações da aplicação;
* Missões arquivadas deixam de ser o destino ativo.

Trilhos e marcadores existentes permanecem disponíveis para consulta independentemente de o GPS estar ativo.

---

## Persistência dos registros de campo

Trilhos, marcadores e Missões são armazenados localmente no IndexedDB.

As gravações de campo utilizam uma fila de persistência e confirmação transacional. Trilhos são persistidos progressivamente durante sua utilização.

Antes de considerar determinadas operações concluídas, o sistema aguarda a confirmação das gravações pendentes e realiza uma nova tentativa quando uma falha transitória de persistência é detectada.

Essa estratégia reduz o risco de perda silenciosa de registros durante a operação.

---

## Exportação

Registros de campo podem ser exportados para utilização em outros sistemas geoespaciais.

A aplicação oferece exportações em:

* **GeoJSON**;
* **GPX**.

É possível exportar registros individualmente e registros organizados em Missões, conforme a opção disponível na interface.

A geração dos arquivos é local e pode funcionar sem conexão com a internet.

---

## Limitações conhecidas da versão 1.0

### GPS em segundo plano

Como a versão 1.0 é uma PWA executada pelo navegador/sistema operacional, o acompanhamento GPS pode ser interrompido quando o Android suspende a aplicação em segundo plano.

A versão 1.0 **não oferece garantia de rastreamento GPS contínuo em background**.

Uma implementação nativa ou baseada em tecnologias como Capacitor poderá ser avaliada futuramente caso seja necessário rastreamento contínuo fora do primeiro plano.

### Mapa-base offline

O cache de tiles é oportunista. Não existe, nesta versão, download prévio de uma área completa para navegação offline.

### Fontes externas

A atualização de eventos, frentes de fogo, Áreas Sensíveis e meteorologia depende da disponibilidade dos respectivos serviços externos.

Quando possível, a aplicação mantém os últimos dados válidos armazenados localmente para uso em situações de indisponibilidade ou ausência de conexão.

---

## Diagnóstico integrado

O GeoFogo possui um painel técnico de diagnóstico que permite acompanhar aspectos como:

* inicialização do núcleo;
* conexão e ciclo de vida do mapa;
* sincronização;
* leitura e processamento do cache;
* consultas remotas;
* quantidade de feições;
* fontes e camadas do MapLibre;
* cálculo espacial dos alertas;
* erros registrados;
* tempos das principais etapas de processamento.

Esse painel também permite diagnosticar problemas em dispositivos Android onde DevTools convencionais não estão disponíveis.

---

## Fontes de dados e serviços

A aplicação integra diferentes fontes conforme a natureza dos dados.

Entre elas:

* **SIPAM** — eventos e frentes de fogo e dados geoespaciais associados;
* **IBGE** — limites municipais e territoriais utilizados pela aplicação;
* fontes de **Áreas Sensíveis**, incluindo Unidades de Conservação e Terras Indígenas;
* **Open-Meteo** — previsão meteorológica.

A disponibilidade e atualização de dados externos dependem dos respectivos provedores.

---

## Segurança e credenciais

Variáveis com prefixo `VITE_*` utilizadas por uma aplicação Vite são incorporadas ao código entregue ao navegador e, portanto, **não devem ser tratadas como segredos**.

O GeoFogo evita persistir API keys e endpoints técnicos como preferências do usuário no IndexedDB.

URLs armazenadas para diagnóstico/cache são higienizadas quando necessário para evitar propagação desnecessária de credenciais.

O Open-Meteo utilizado pela aplicação não requer chave de API.

Credenciais de serviços que precisem ser verdadeiramente confidenciais não devem ser colocadas diretamente no frontend; nesses casos seria necessário utilizar um serviço intermediário/backend.

---

## Tecnologias

| Tecnologia               | Finalidade                       |
| ------------------------ | -------------------------------- |
| React                    | Interface da aplicação           |
| Vite                     | Desenvolvimento e build          |
| JavaScript               | Linguagem principal              |
| MapLibre GL JS           | Renderização cartográfica        |
| Turf.js                  | Processamento e análise espacial |
| Tailwind CSS             | Estilização                      |
| Lucide React             | Ícones                           |
| IndexedDB                | Persistência local               |
| Service Worker / Workbox | Cache e funcionamento PWA        |
| vite-plugin-pwa          | Integração PWA                   |
| Open-Meteo               | Meteorologia                     |

---

## Arquitetura

A aplicação utiliza uma arquitetura modular, com responsabilidades distribuídas entre componentes de interface, núcleo, serviços, processamento espacial, mapa e armazenamento.

Estrutura conceitual simplificada:

```text
GeoFogo Ceará
│
├── Interface React
│
├── AppCore
│   ├── SyncEngine
│   ├── AlertEngine
│   ├── SpatialEngine
│   ├── ErrorManager
│   └── EventBus
│
├── Mapa
│   ├── MapView
│   ├── LayerManager
│   └── LayerRegistry
│
├── Campo
│   ├── FieldController
│   └── FieldMissionController
│
├── Serviços
│   ├── SIPAM
│   ├── IBGE
│   ├── Áreas Sensíveis
│   └── Open-Meteo
│
└── Persistência
    └── IndexedDB
```

---

## Desenvolvimento

Instale as dependências:

```bash
npm install
```

Execute o ambiente de desenvolvimento:

```bash
npm run dev
```

Verificação de tipos:

```bash
npm run typecheck
```

Lint:

```bash
npm run lint
```

Build de produção:

```bash
npm run build
```

Verificação de whitespace/diffs antes de commits:

```bash
git diff --check
```

---

## Atualização de dados auxiliares

O projeto possui scripts auxiliares quando necessários para preparação de determinadas fontes de dados.

Por exemplo:

```bash
npm run update:cnuc
```

Esses scripts fazem parte do processo de preparação/manutenção de dados e não são necessários para a utilização normal da PWA pelo usuário final.

---

## Validação da versão 1.0

A preparação da versão 1.0 incluiu validações de:

* cold start;
* sincronização online;
* inicialização utilizando cache;
* funcionamento offline;
* persistência de Missões;
* persistência de trilhos e marcadores;
* exportação GeoJSON e GPX offline;
* retorno da conectividade;
* rotação retrato/paisagem;
* suspensão e retomada no Android;
* atualização da PWA;
* tratamento de falhas de persistência;
* desempenho do cálculo espacial de alertas;
* typecheck;
* lint;
* build de produção;
* `git diff --check`.

---

## Próximas evoluções

Possíveis evoluções após a versão 1.0 incluem:

* camadas meteorológicas dinâmicas de vento, temperatura e umidade;
* melhorias adicionais para mapas offline;
* avaliação de aplicativo Android nativo/Capacitor;
* suporte a GPS contínuo em background;
* inclusão de novas categorias de Áreas Sensíveis;
* atualização controlada das principais dependências.

Esses itens não fazem parte dos requisitos da versão 1.0.

---

## Licença

Consulte o arquivo `LICENSE` do repositório para os termos de uso e distribuição do projeto.
