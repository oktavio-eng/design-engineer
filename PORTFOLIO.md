# Roteiro — Portfolio sobre a estrutura deste site

Task futura. Reaproveitar **exatamente** o design system e a máquina deste site (`design-engineer`), trocando o conteúdo: em vez de pessoas/cursos/leituras/referências, entram **projetos de clientes**, **projetos pessoais**, **vida** e uma **galeria de fotos**.

Leia o [AGENTS.md](AGENTS.md) antes — ele descreve o craft que este roteiro assume como dado.

---

## 1. O que se copia sem pensar

Estes são o produto, não o andaime. Vão inteiros:

- `styles/` **na íntegra** (`main.css` + os cinco arquivos em `tokens/`). Tokens OKLCH, tipografia Inter, cascata de colunas, glass/squircle, sombras em camadas, curvas de easing. É aqui que mora o "mesmo design".
- **A máquina do** `script.js`**:** painel lateral redimensionável, modais, busca ⌘K com o modal de detalhe + botão de voltar, cascata de fallback de favicon (`favFallback` + `sweepFavicons`), helpers `readStored`/`writeStored`, `esc()`, `favicon()`.
- **A malha de animação:** `.stagger` (entrada das seções) e `.p-stagger` (entrada do conteúdo do painel).
- **Topbar:** logo, nav com `IntersectionObserver` marcando a seção ativa, auto-hide após 1200ms, ícones sociais, composer de e-mail.

**Regra que continua valendo:** arquivos estáticos, zero build step, `<script defer>` — nunca `async`.

## 2. O que muda: só o conteúdo e os nomes das coleções


| Hoje                         | No portfolio                          |
| ---------------------------- | ------------------------------------- |
| `people` (6 + 6 extras)      | `clients` — projetos de cliente       |
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

## 3. Os cinco pontos de extensão do código

Tudo que você precisa tocar no `script.js` está nestes cinco lugares. Fora deles, o arquivo não muda.

1. **Os objetos de dados** ([script.js:34+](script.js#L34)) — trocar `people`/`phases`/`refs`/`courses`/`readings` pelas coleções novas.
2. **O registro** `lists` ([script.js:551-586](script.js#L551-L586)) — é o extension point de verdade. Cada tipo é `{ els: <NodeList do DOM>, get: <el → entrada>, idAttr: <sufixo do data-attr> }`. Um tipo novo = uma entrada aqui + um `data-client="acme"` no HTML + a chave no objeto de dados. Nada mais.
3. **O delegador de clique fora do painel** ([script.js:722-735](script.js#L722-L735)) — tem uma lista literal de `closest("[data-ref]")`, `[data-course]`, `[data-reading]`. Precisa listar os novos atributos, senão clicar numa linha fecha o painel em vez de abrir.
4. **O índice da busca** ([script.js:995-1006](script.js#L995-L1006)) — `add("Grupo", objeto)`, uma linha por coleção. Os nomes de grupo aparecem como cabeçalho na lista de resultados.
5. **A nav da topbar** — os `href="#secao"` no HTML precisam bater com os `id` das `<section>`; o `IntersectionObserver` se liga sozinho a partir disso ([script.js:657-679](script.js#L657-L679)).

**Armadilha de CSS:** `.stagger` tem delays escritos à mão até `nth-child(9)` ([styles/main.css:784-816](styles/main.css#L784-L816)) e `.p-stagger` até `nth-child(5)`. Se o portfolio tiver mais seções que isso, as extras entram **sem delay** (todas juntas) e a cascata quebra. Estender as regras junto.

## 4. A galeria — a única parte que exige decisão de design

O `AGENTS.md` diz, com todas as letras: *"Sem ícones decorativos, sem imagens de capa. O documento tem que se sustentar em texto puro."* Uma galeria de fotos contradiz isso de frente. Não é motivo pra não fazer — é motivo pra fazer **deliberadamente**, e o AGENTS.md já prevê isso na seção "Seja flexível quando eu pedir".

A saída que preserva a coerência: **a foto é conteúdo, não decoração**. O índice tipográfico continua puro; a galeria é uma superfície própria onde a imagem é o assunto. Concretamente:

- **Aba = seção com âncora** (`#galeria` na nav), não um segundo arquivo HTML. Motivo técnico duro: o `script.js` pega elementos por ID no topo e chama `.addEventListener` neles ([script.js:432](script.js#L432), [script.js:487](script.js#L487)) — numa página que não tenha esses IDs ele estoura `TypeError` e **nada** funciona. Um segundo arquivo exigiria separar o JS em compartilhado + por página. Fica pra depois, se um dia valer.
- **O lightbox já existe.** `avatar-wash` + `avatar-viewer` ([script.js:882-905](script.js#L882-L905)) é um visualizador de imagem cheio, com wash, Escape e clique-fora prontos. Hoje ele é hard-wired numa imagem só (`avatarBig.src` é setado uma vez no load). Vira `openAvatar(src, alt)` e serve a galeria inteira — não escreva um lightbox novo.
- **Grid:** CSS Grid com `aspect-ratio` fixo por célula. `aspect-ratio` não é opcional: sem ele o layout pula conforme as fotos carregam, e "toda transição interrompível" não sobrevive a um salto de layout.
- **Peso.** Hoje o site inteiro tem ~90KB. Uma galeria é outra ordem de grandeza. `.webp`, `width`/`height` no `<img>`, `loading="lazy"` em tudo abaixo da dobra, e um teto consciente de quantas fotos entram.
- **Falha de imagem:** vale a regra 4 do AGENTS.md — ou carrega, ou o elemento **sai** do DOM. Nada de quadrado cinza.



## 5. O que não levar

- **Sistema de comentários** (`plan-comments-v2`, "add a note", painel `cpanel`): são notas pra você mesmo num documento de estudo. Num portfolio público, é ruído — e qualquer visitante vê o campo. Remover o `cpanel`, `loadComments`/`persistComments`, `itemHtml(...)` com `data-c`, e o `noteBlock`.
- **Modal "About this document"** com o histórico de versões: é meta-conteúdo deste documento. Ou some, ou vira um "sobre" de verdade.
- `og.jpg`**,** `favicon.svg`**,** `avatar.webp`**:** trocar. O favicon atual é o logo GOW — decidir se o portfolio usa a mesma marca.



## 6. Repo e deploy

- **Repo novo**, cópia dos arquivos. Não é fork nem branch deste — os dois vão divergir no primeiro dia.
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