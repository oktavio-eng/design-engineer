# Portfólio — `/` (a home desde 16/08/2026; nasceu como `/portfolio`)

**Estado:** a página existe e está no ar como `/` — a home do site (link "home" na navbar; o plano virou `/wiki`, e `/portfolio` redireciona pra `/`). Decisão de 16/08/2026: mora **neste site**, não num repo/projeto Vercel novo — o roteiro abaixo (§1–§8) foi escrito antes de o JS virar compartilhado (`content.js`, `favicons.js`, `cmd.mjs`, `chrome.js`) e previa cópia; hoje o portfólio reusa tudo isso sem duplicar nada. Se um dia for pra um domínio próprio, é mover arquivos, não refazer.

## 0. O que existe e onde

| Peça | Arquivo | Notas |
| --- | --- | --- |
| Página | `index.html` (era `portfolio.html`) | Mesmo head/topbar das outras páginas; seções: perfil, What I do, Writing, Contributions, Projects, Personal projects, Life, Gallery. Seções nascem `hidden` e só aparecem quando têm conteúdo. **`Client work` foi removida em 22/08/2026** — os três templates falsos (`client-a/b/c`) eram redundantes com `Projects`, que já é trabalho real. |
| Conteúdo | `portfolio-content.js` | `window.PORTFOLIO_CONTENT = { projects, personal, life, writing, gallery }`. **`projects` tem 6 entradas reais, todas `draft: true`** até você revisar bio/items e tirar a flag uma a uma (ver §9). Drafts só aparecem em localhost ou com `?draft` na URL; em produção a seção some. |
| Página (JS) | `portfolio.mjs` | Renderiza listas/writing/galeria, busca `data/contributions.json`, e é dono do lightbox. `initPortfolioPage()` não chama mais `renderGallery()` — **galeria pausada a pedido do Otavio em 22/08/2026**; a seção fica `hidden` sem conteúdo (o lightbox do avatar do perfil continua funcionando, é independente da galeria). Reativar é uma linha: chamar `renderGallery(root)` de novo ali. |
| Detalhe de projeto | `cmd.mjs` | Clicar numa linha (`data-open="projects:key"`) abre o **mesmo modal do ⌘K** direto (sem botão de voltar — `.cmd-modal--direct`). ⌘K também indexa Projects / Personal projects / Life em toda página. |
| Gráfico GitHub | `contrib.mjs` + `data/contributions.json` + `scripts/fetch-contributions.mjs` + `.github/workflows/contributions.yml` | Dados **reais** de `oktavio-eng`, lidos do calendário público (sem token). A Action roda 1×/dia e commita só se mudou; commit em `main` dispara o deploy. Rodar à mão: `node scripts/fetch-contributions.mjs`. |
| Galeria + lightbox | `.gallery*` / `.lightbox*` em `main.css`, `portfolio.mjs` | Grid 3 col (2 no celular), `aspect-ratio` fixo, mesma casca "lift" do ícone de doc e do gráfico. Lightbox: wash + figura, Escape/wash/× fecham, foco volta pra miniatura, ⌘K por cima fecha. Imagem que falha some da grade. Seção pausada — ver linha acima. |
| Cromo | `chrome.js` | Tema + navbar reveal-on-scroll, compartilhado por changelog/prompts/portfolio (era inline em cada uma). |
| Testes | `tests/ui/portfolio-page.test.mjs`, `stories/portfolio.stories.js` (Writing, Contributions, Gallery, Projects List), 3 casos visuais | Cobrem: seções, gráfico do JSON, linha→modal direto, avatar→lightbox, ⌘K, drafts escondidos em produção (servido como `portfolio.test`), 320px, axe. |

## 9. O que só você faz (o gargalo real)

- [ ] **Revisar as 6 entradas de `projects` em `portfolio-content.js`** linha por linha (bio/items com meu melhor esforço, não confirmado palavra por palavra) e tirar `draft: true` uma a uma conforme aprovar. Enquanto isso a seção "Projects" não aparece no site publicado; pra revisar no ar: `/?draft`.
- [ ] Revisar os textos de **What I do**, **Personal projects** e **Life** — escrevi com o que sei; é sua voz que tem que estar ali.
- [ ] **Writing**: hoje aponta pras páginas que existem (plano, changelog, prompts). Quando houver artigo de verdade, é `{title, description, href}` no array.
- [ ] **Galeria**: pausada por enquanto (22/08/2026). Quando quiser reativar: fotos reais em `/photos/*.webp`, tratadas, com `width`/`height` e legenda (ver a regra de peso em §4), depois voltar a chamar `renderGallery(root)` em `initPortfolioPage()`.
- [ ] `og.jpg`/`favicon`: decidir se o portfólio usa a marca GOW (hoje usa).

---

*O roteiro original segue abaixo, como registro do plano — os pontos que mudaram estão anotados.*

## 1. O que se copia sem pensar

Estes são o produto, não o andaime. Vão inteiros:

- `styles/` **na íntegra** (`main.css` + os cinco arquivos em `tokens/`). Tokens OKLCH, tipografia Inter, cascata de colunas, glass/squircle, sombras em camadas, curvas de easing. É aqui que mora o "mesmo design".
- **A máquina do** `script.js`**:** painel lateral redimensionável, modais, helpers `readStored`/`writeStored`, `esc()`. A busca ⌘K (modal de detalhe + botão de voltar) mora em `cmd.mjs` e roda em toda página; a cascata de fallback de favicon (`favicon()` + `favFallback` + `sweepFavicons`) em `favicons.js`; as coleções em `content.js`.
- **A malha de animação:** `.stagger` (entrada das seções) e `.p-stagger` (entrada do conteúdo do painel).
- **Topbar:** logo, nav com `IntersectionObserver` marcando a seção ativa, auto-hide após 1200ms, ícones sociais (X + envelope + tema — em toda página desde 16/08/2026), composer de e-mail (`mail.js`, compartilhado). A home também toca a intro (`intro.js`) desde 16/08/2026.

**Regra que continua valendo:** arquivos estáticos, zero build step, `<script defer>` — nunca `async`.

## 2. O que muda: só o conteúdo e os nomes das coleções


| Hoje                         | No portfolio                          |
| ---------------------------- | ------------------------------------- |
| `people` (6 + 6 extras)      | `clients` (removida 22/08/2026, virou `projects`) — projetos de cliente |
| `courses`                    | `personal` — projetos pessoais        |
| `readings`                   | `life` — vida                         |
| `refs`                       | *(some, ou vira a galeria)*           |
| `phases` (01–04, expansível) | *(opcional)* processo / como trabalho |
| The principle                | posicionamento: o que faço e pra quem |
| Their aesthetic, decoded     | *(some, ou vira "como eu trabalho")*  |


Cada entrada tem que caber na forma que o `render()` já espera — não invente campo novo sem mexer no render:

```js
{ name: "…", role: "…", bio: "…", items: ["…"], links: [["Rótulo", "https://…"]] }
```

Pra um projeto de cliente isso vira: `name` = cliente/projeto, `role` = "o que era + ano", `bio` = o problema e o resultado, `items` = decisões de craft, `links` = site no ar, estudo de caso, repo.

## 2b. Duas peças novas do index do portfólio (já construídas — 16/08/2026)

Além das coleções, o index do portfólio ganha duas seções que o site atual não tem, e os componentes já existem em `styles/main.css` (bloco "Portfolio components") + Storybook (`stories/portfolio.stories.js`, "Patterns/Portfolio"):

- **Writing** — lista de artigos no formato do jakub.kr: `.doc-list > a.doc-item` com o ícone de documento (`.doc-icon > .doc-icon__page > 5× .doc-icon__line`), título (`.doc-item__title`) e resumo de uma linha (`.doc-item__desc`, o campo `summary` de cada entrada — curto de propósito; `bio` é só o modal). A linha inteira é o link; hover é preenchimento instantâneo em `--row-hover`, sem sombra e sem transição, de propósito. Desde 29/08/2026 as medidas vêm do componente `Article` do Figma (`docs/figma-workflow.md`). Marcação de referência está na story.
- **Contributions** — o gráfico de contribuições do GitHub como no site do Noé Chagué, no azul do site (`--contrib-0…4`, nível 3 = `#00B9FF`). Marcação `.contrib > .contrib__card > .contrib__grid + .contrib__meta`; `contrib.mjs` exporta `renderContributions(root, days)` e preenche a grade a partir de um array de `{date, count}` (371 dias). **Dado: resolvido** — `data/contributions.json` vem do calendário público (`scripts/fetch-contributions.mjs`, sem token), atualizado 1×/dia pela Action `contributions.yml`; ver §0. **Hover (16/08/2026):** cada célula mostra a leitura do GitHub ("3 contributions on Aug 12"; ano só quando não é o corrente; "No contributions" no zero) numa `.contrib__tip` — uma só pra grade inteira, `position: fixed` no `<body>` (o card é `overflow: hidden` e a grade rola na horizontal), com a mesma superfície do `.gloss-tip`. Timing pelos tokens `--tip-*` em `tokens/motion.css`: a primeira espera `--tip-delay` e escala da célula (`--tip-in`, `--ease-out`); trocar de célula é instantâneo (`.contrib__tip--instant`, sem delay nem transição — hover repetido dezenas de vezes por passada é onde o motion sai da frente, regra do Emil) e ela fica "quente" por `--tip-warm` depois de sair. Célula em hover ganha anel de 1px (`.is-hover`, na cor da borda do card, `--line` — `--muted` lia como preto) e `cursor: pointer`, também sem transição. Vira pra baixo se não couber acima; scroll esconde; tap mostra e tap fora esconde no touch; reduced motion mantém só o fade. A grade continua `aria-hidden` — a tooltip é decorativa e o total do rodapé segue sendo o resumo acessível. Story `ContributionsHover` + smoke em `tests/ui/portfolio-page.test.mjs`.

## 3. Os cinco pontos de extensão do código

Tudo que você precisa tocar no `script.js` está nestes cinco lugares. Fora deles, o arquivo não muda.

1. **Os objetos de dados** ([content.js](content.js)) — trocar `people`/`phases`/`refs`/`courses`/`readings` pelas coleções novas (publicadas em `window.SITE_CONTENT`; o `script.js` desempacota no topo).
2. **O registro** `lists` ([script.js:551-586](script.js#L551-L586)) — é o extension point de verdade. Cada tipo é `{ els: <NodeList do DOM>, get: <el → entrada>, idAttr: <sufixo do data-attr> }`. Um tipo novo = uma entrada aqui + um `data-client="acme"` no HTML + a chave no objeto de dados. Nada mais.
3. **O delegador de clique fora do painel** ([script.js:722-735](script.js#L722-L735)) — tem uma lista literal de `closest("[data-ref]")`, `[data-course]`, `[data-reading]`. Precisa listar os novos atributos, senão clicar numa linha fecha o painel em vez de abrir.
4. **O índice da busca** ([cmd.mjs](cmd.mjs), as chamadas `add("Grupo", …)` em `initCommandMenu`) — uma linha por coleção. Os nomes de grupo aparecem como cabeçalho na lista de resultados.
5. **A nav da topbar** — os `href="#secao"` no HTML precisam bater com os `id` das `<section>`; o `IntersectionObserver` se liga sozinho a partir disso ([script.js:657-679](script.js#L657-L679)).

**Armadilha de CSS:** `.stagger` tem delays escritos à mão até `nth-child(9)` ([styles/main.css:784-816](styles/main.css#L784-L816)) e `.p-stagger` até `nth-child(5)`. Se o portfolio tiver mais seções que isso, as extras entram **sem delay** (todas juntas) e a cascata quebra. Estender as regras junto.

## 4. A galeria — a única parte que exige decisão de design

O `AGENTS.md` diz, com todas as letras: *"Sem ícones decorativos, sem imagens de capa. O documento tem que se sustentar em texto puro."* Uma galeria de fotos contradiz isso de frente. Não é motivo pra não fazer — é motivo pra fazer **deliberadamente**, e o AGENTS.md já prevê isso na seção "Seja flexível quando eu pedir".

A saída que preserva a coerência: **a foto é conteúdo, não decoração**. O índice tipográfico continua puro; a galeria é uma superfície própria onde a imagem é o assunto. Concretamente:

- ~~**Aba = seção com âncora**~~ Superado: com o JS compartilhado, `/portfolio` é uma página própria e a galeria é uma seção dela. O motivo original: o `script.js` pega elementos por ID no topo e chama `.addEventListener` neles ([script.js:432](script.js#L432), [script.js:487](script.js#L487)) — numa página que não tenha esses IDs ele estoura `TypeError` e **nada** funciona. Um segundo arquivo exigiria separar o JS em compartilhado + por página. Fica pra depois, se um dia valer.
- **O lightbox já existe.** `avatar-wash` + `avatar-viewer` ([script.js:882-905](script.js#L882-L905)) é um visualizador de imagem cheio, com wash, Escape e clique-fora prontos. Hoje ele é hard-wired numa imagem só (`avatarBig.src` é setado uma vez no load). Vira `openAvatar(src, alt)` e serve a galeria inteira — não escreva um lightbox novo.
- **Grid:** CSS Grid com `aspect-ratio` fixo por célula. `aspect-ratio` não é opcional: sem ele o layout pula conforme as fotos carregam, e "toda transição interrompível" não sobrevive a um salto de layout.
- **Peso.** Hoje o site inteiro tem ~90KB. Uma galeria é outra ordem de grandeza. `.webp`, `width`/`height` no `<img>`, `loading="lazy"` em tudo abaixo da dobra, e um teto consciente de quantas fotos entram.
- **Falha de imagem:** vale a regra 4 do AGENTS.md — ou carrega, ou o elemento **sai** do DOM. Nada de quadrado cinza.



## 5. O que não levar

- **Sistema de comentários** (`plan-comments-v2`, "add a note", painel `cpanel`): são notas pra você mesmo num documento de estudo. Num portfolio público, é ruído — e qualquer visitante vê o campo. Remover o `cpanel`, `loadComments`/`persistComments`, `itemHtml(...)` com `data-c`, e o `noteBlock`.
- **Modal "About this document"** com o histórico de versões: é meta-conteúdo deste documento. Ou some, ou vira um "sobre" de verdade.
- `og.jpg`**,** `favicon.svg`**,** `avatar.webp`**:** trocar. O favicon atual é o logo GOW — decidir se o portfolio usa a mesma marca.



## 6. Repo e deploy (superado — ver topo)

- ~~**Repo novo**, cópia dos arquivos.~~ Decisão de 16/08/2026: página neste site. Não é fork nem branch deste — os dois vão divergir no primeiro dia.
- **Projeto Vercel novo.** A regra 1 do AGENTS.md ("nunca crie um projeto novo na Vercel") vale **só pro** `design-engineer`; um site novo é um projeto novo, e é o certo. Deixar isso escrito no AGENTS.md do repo novo, senão um agente futuro lê a regra fora de contexto e trava.
- Copiar o `AGENTS.md` adaptado junto. Ele é o que impede a próxima IA de desfazer o craft.



## 7. Verificação (o que salva o site)

Não há build step: a Vercel publica erro de sintaxe sem reclamar e o site cai inteiro, em silêncio. Único teste que existe:

1. `node --check script.js` e HTML com tags balanceadas.
2. `python3 -m http.server` na raiz + browser (nunca `file://` — os caminhos `/styles/main.css` e `/script.js` são absolutos).
3. Dirigir o site de verdade: abrir ⌘K, buscar, abrir um projeto, voltar, abrir a galeria, ampliar uma foto, fechar. Console sem erro, favicons resolvendo.
4. Mobile e `prefers-reduced-motion` ligado.

Existe um driver Playwright pronto que faz isso de ponta a ponta (foi o que validou o botão de voltar) — vale versionar um equivalente no repo novo em vez de reescrever na hora.

## 8. O que preparar antes de começar

Isto é a parte que só você faz, e é o gargalo real — o código é o mais rápido:

- [ ] Lista de projetos de cliente, com **permissão pra publicar** cada um (NDA, cliente que não quer aparecer, número que não pode sair). Decidir caso a caso *antes* de escrever.
- [ ] Pra cada projeto: problema, o que você fez, resultado, 2–4 decisões de craft, links.
- [ ] Projetos pessoais: mesma coisa, com repo/demo quando houver.
- [ ] "Vida": definir o que isso é — o que entra e o que não entra é a decisão editorial mais difícil das quatro.
- [ ] Fotos selecionadas, tratadas, exportadas em `.webp`, com legenda.

---

**Ordem sugerida de execução:** conteúdo pronto (§8) → copiar os três arquivos → trocar dados e os cinco pontos de extensão (§3) → tirar o que não vai (§5) → galeria por último (§4), que é a única parte com design novo → verificar (§7) → repo e deploy (§6).