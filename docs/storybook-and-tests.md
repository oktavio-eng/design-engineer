# Storybook e testes de UI

Linkado do índice em `AGENTS.md` — carregue este doc quando for adicionar/atualizar uma story, mexer em testes de UI, ou quando uma mudança de componente/padrão precisa do checklist de Definition of Done.

O Storybook é o inventário visual e a primeira rede de segurança de UI, sem refatorar o site para componentes: configuração em `.storybook/`, stories em `stories/`, runner em `vitest.config.mjs` e dependências/scripts em `package.json`. Ele importa diretamente `styles/main.css`, os tokens existentes e, opcionalmente, `styles/experiments/flat-type.css`; não mantém cópia dos estilos do site.

Comandos:

- `npm run storybook` — inventário e painel de testes em `http://localhost:6006`.
- `npm run build-storybook` — build isolado em `storybook-static/` (ignorado pelo Git).
- `npm run test-storybook` — smoke tests, funções `play` e axe em Chromium headless, uma vez. Os seis arquivos de story rodam **em série** (`fileParallelism: false`, desde 28/08/2026) — cada arquivo vive num iframe e, em paralelo, um iframe vizinho podia roubar o foco da janela e apagar o `:focus-visible` do que estava sob teste; ver o post-mortem do PR #77 abaixo antes de "otimizar" isso de volta.
- `npm run test-storybook:watch` — o mesmo runner em watch mode. No macOS, `vitest.config.mjs` usa o Google Chrome instalado quando ele está disponível; nos demais ambientes usa o Chromium do Playwright. Se esse binário não existir, rode uma única vez `npx playwright install chromium`; nunca dispare duas instalações concorrentes.
- `npm run test:product-ui` — smoke read-only do command palette na página real (`wiki.html` + `script.js`), servido por HTTP: Ctrl/⌘K, camadas de Escape, list→detail, races do foco atrasado, restauração do opener e invariante contra foco dentro de `aria-hidden`/`inert`.
- `npm run test:visual` — compara nove capturas do build em `storybook-static/` com `tests/visual/baselines/`; por isso exige `npm run build-storybook` antes. Para uma mudança visual intencional, rode `UPDATE_VISUAL_BASELINES=1 npm run test:visual`, inspecione cada PNG e então rode o comando normal de novo.
- `npm run test:ui` — gate de testes depois do build: stories/axe, smoke da página real e regressão visual.

**Versão do Chromium (26/08/2026):** `npm run test-storybook` (via `@vitest/browser-playwright`) e `test:visual`/`test:product-ui` (via `tests/ui/helpers/browser.mjs`) usam o Playwright **fixado no `package.json`**, que procura a revisão de Chromium *dele* em `~/Library/Caches/ms-playwright/` (hoje `chromium-1208` e `chromium_headless_shell-1208`). Um Playwright global mais novo baixa outra revisão (`-1234`) e **não** serve — o `launch` falha com "Executable doesn't exist" ou, pior, fica pendurado se houver uma instalação parada segurando o `__dirlock`. Solução limpa: `npx playwright install chromium chromium-headless-shell` a partir da raiz do repo (usa a versão fixada). Se a rede não colaborar, um atalho que funciona sem tocar no cache: um diretório temporário com symlinks `chromium-1208 → chromium-1234` e `chromium_headless_shell-1208 → chromium_headless_shell-1234`, passado em `PLAYWRIGHT_BROWSERS_PATH=<dir> npm run test:visual` — os 13 baselines existentes voltaram byte-idênticos com o Chromium 151 dessa revisão, então a comparação é válida. Nunca deixe uma instalação parcial no cache: apague `chromium*-1208` e `__dirlock` antes de tentar de novo.

O `@storybook/addon-a11y` roda axe e `parameters.a11y.test = "error"` é o padrão global: uma violação nova falha localmente e no CI. Uma dívida conhecida nunca libera a story inteira com `todo`/`off`: desabilite somente a regra no addon para aquela story, marque cada alvo com `data-a11y-debt` e use `expectOnlyA11yDebt()` no `play` para exigir a lista exata de `regra:alvo`. Se uma regra desabilitada puder mudar com o estado, rode a asserção exata em cada estado relevante, depois de esperar as animações terminarem; o scan final do addon enxerga apenas o estado em que o `play` termina. Se aparecer outra regra, outro alvo ou se uma dívida sumir, o teste falha e a baseline precisa ser reavaliada. As dívidas atuais incluem contraste de textos `--faint`, `aria-expanded` não permitido no input de busca, input nomeado apenas pelo placeholder e o salto de heading no detalhe do command menu; corrigi-las continua exigindo uma mudança de produto coordenada, não maquiagem no fixture.

As stories interativas são harnesses isolados porque `script.js` consulta e inicializa a página inteira no carregamento; importar esse arquivo numa story não é seguro. Copie só o menor markup/contrato necessário, use as classes reais de `main.css` e mantenha o controlador da story pequeno. Não adicione à fixture uma semântica ARIA que a produção ainda não tem: isso criaria uma aprovação falsa. O harness testa o CSS, os estados e o contrato compartilhado, mas não substitui o smoke da página completa. Se um controlador de produção for extraído para um módulo reutilizável no futuro, a story deve passar a importar esse módulo e apagar a cópia.

Cobertura interativa inicial:

- `.gloss`: ordem de Tab, foco visual e tooltip exposto por teclado e ponteiro; role/descrição acessível ainda não existem na produção e não são simulados na fixture.
- `.extras` / `.see-more`: Enter e Space, foco preservado, classe `expanded` e texto show more/show less. `aria-expanded`/`aria-controls` entraram na story quando entraram na produção (`wiki.html` + o `wireSeeMore()` do `script.js`), não antes — a story checa o estado anunciado e resolve o `aria-controls` por `getElementById`, porque um id que não existe é a falha que interessa. Como o padrão deixou de ser exclusivo do People, uma segunda story cobre People, Courses e References juntos: o CSS é chaveado só em `.expanded` (não `.people.expanded`), então uma seção sem a classe `.people` abre igual. A interseção com a seleção persistente (uma `.row.extra` revelada pelo show more sendo selecionada, lista continuando aberta) tem story própria; o toggle sobre a página real, o `aria-controls` contra os ids de produção e o cancelamento da animação `enter` sob `prefers-reduced-motion` ficam em `tests/ui/see-more-sections.test.mjs`, que é onde dá pra emular a media query e dirigir o `script.js` de verdade.
- command menu (fixture): Ctrl/⌘K, foco inicial, filtro, cursor com setas, `aria-selected`, foco no detalhe, Escape por camada, restauração do opener e races menores que o delay de foco. Os dois diálogos togglam `inert` junto com `aria-hidden`, como a produção (`cmd.mjs`) — a dívida `aria-hidden-focus` dos diálogos inativos saiu da baseline em 16/08/2026 porque foi corrigida no produto, não escondida. `aria-activedescendant` e lifecycle de `aria-expanded` não são inventados pela story enquanto a produção não os implementar.
- command menu (página real): o contrato frágil compartilhado é exercitado sobre o HTML/JS de produção, incluindo setas com foco retido, list→detail, camadas, races e restauração; a story continua sendo inventário visual, não substituto desse smoke. Um segundo teste no mesmo arquivo dirige a paleta em `/prompts` (⌘K por cima do modal de prompt troca de superfície em vez de empilhar; prompt achado por tag abre com a folha `.prompt-modal` e o botão de copiar; Escape só desfaz as camadas da própria paleta; só um `.cmd-modal` visível por vez) e em `/changelog` (pessoa abre sem nenhuma superfície da página existir; "Pages" navega).

A regressão visual usa apenas Playwright + o comparador já trazido pelo Vitest Browser. A matriz cobre tokens em light/dark, tipografia normal/Flat type, 320px, disclosure expandido e command palette aberto. Todas as capturas rodam com `prefers-reduced-motion: reduce`, esperam fontes, animações e dois frames idênticos; a story de tipografia também usa CDP para provar que Geist, Geist Mono e Geist Pixel foram realmente pintadas como webfonts. A comparação tem duas travas: até 4% no diff cru e até 0,8% depois do mesmo blur de 2px nas duas imagens. O primeiro impede uma divergência grande de passar; o segundo reduz ruído de rasterização dos glifos entre Chrome/macOS e Chromium/Linux e ainda reprova deslocamentos sintéticos de layout a partir de 4px nos casos estreitos e tipográficos. As duas métricas de todos os casos aparecem até no log verde. Em falha, `artifacts/visual/` recebe `actual` e `diff`; o diretório é ignorado pelo Git e publicado pelo CI.

O workflow `.github/workflows/storybook.yml` roda `npm ci`, build, stories/axe, smoke da página real e regressão visual em todo pull request, usando a imagem Playwright que corresponde à versão fixada no `package.json`. O build isolado e as capturas reais são publicados como artifacts por sete dias para revisão. É tooling de dev: o runtime e o deploy principal continuam sendo o site estático HTML/CSS/Vanilla JS, sem build de produção novo. O Framework Preset da Vercel permanece **Other** e `storybook-static/` não entra no deploy principal.

**Lição do PR #71 (26/08/2026, gráfico de contribuições no celular):** o fix foi validado a 390px e 1280px na página real e subiu sem rodar a suíte do Storybook — o CI quebrou duas vezes. Primeiro a story `Contributions Hover` (o evento `scroll` assíncrono do snap cancelava um hover feito no mesmo frame do render, ver [patterns.md](patterns.md)); depois a regressão visual (o baseline `portfolio-contrib-dark` mostrava a grade na posição antiga, e a mudança era intencional). Regras que saem disso:

1. **Página real passando não é prova de story passando.** A story exercita timing que a mão não reproduz (hover logo após o render), então `npm run test:ui` — ou no mínimo `test-storybook` + `test:visual` — roda **antes do push** em qualquer mudança de scroll, render ou timing de um componente que tem story, mesmo que isso signifique instalar o browser primeiro (ver "Versão do Chromium" acima). O CI é a última rede, não a primeira.
2. **Diff visual esperado:** regenere com `UPDATE_VISUAL_BASELINES=1`, inspecione, e **só o PNG da mudança entra no commit** — os outros têm que voltar byte-idênticos. Se não voltarem, o browser local não é o que gerou os baselines e o PNG novo não é confiável.
3. **Antes de decidir se é regressão ou baseline velho**, baixe o artifact do run que falhou (`gh run download <id> -n storybook-visual-evidence`) e olhe o `*-diff.png` e o `*-actual.png`.

**Lição do PR #77 (28/08/2026, smooth scroll com Lenis):** a suíte `test:product-ui` estava vermelha na `main` desde 26/08 por dois motivos alheios a qualquer PR — e por dois dias cada PR pareceu ter quebrado o CI (o #74 foi mergeado `UNSTABLE`). As causas e o que fica delas:

1. **Teste que espelha texto de produto precisa mudar no mesmo commit do texto.** `dd798ae` capitalizou os labels da navbar (`Home`, `Wiki`, …) e `tests/ui/navigation-pages.test.mjs` continuou esperando minúsculas. Se o `grep` do checklist não pega (é string de teste, não markup), rodar `test:product-ui` antes do push pega.
2. **Um `.mjs` de produto que importa um caminho absoluto do browser (`/vendor/...`) não pode ser importado pelo Node.** `prompts.mjs` passou a importar `/vendor/cuelume/index.js` (`a76c2cf`) e `tests/ui/prompts-page.test.mjs` fazia `import { PROMPTS } from "../../prompts.mjs"` — o arquivo inteiro falhava em `ERR_MODULE_NOT_FOUND` antes de qualquer teste rodar. O teste agora lê o dado pela própria página servida: `page.evaluate(() => import("/prompts.mjs").then((m) => m.PROMPTS))`. Regra: dado de produto entra nos testes pelo browser (que resolve `/vendor/` como a produção), nunca por import direto no Node. Vale pra `scroll.mjs`/`sound.mjs` e qualquer módulo novo que importe de `vendor/`.
3. **Uma suíte vermelha "conhecida" não é neutra.** Ela esconde a falha nova atrás da velha. Se um teste quebra por mudança intencional, o fix vai no mesmo PR — e se herdou uma suíte vermelha, conserte antes de somar mais um PR em cima.

**Post-mortem dos commits do PR #77 (28/08/2026):** quatro commits, três runs vermelhos/cancelados antes do verde. O que cada um ensinou, com a evidência:

| Commit | CI | Causa |
|---|---|---|
| `2ee5456` Lenis | ✖ | as duas falhas herdadas da `main` (labels, import do cuelume) |
| `a46ebed` fix dos testes | ✔ | — |
| `6d99f8a` só docs + changelog | ✖ | `Phase · Glossary`: `expect(tooltip).toBeVisible()` viu `.gloss-tip` com `opacity: 0` por 1s |
| rerun de `6d99f8a` | cancelado | o push seguinte cancelou o rerun (concurrency do workflow) — perdeu o dado de "é flake?" |
| `ad42a70` sem `sourceMappingURL` | ✔ | — |

1. **Não abrir PR em cima de suíte vermelha conhecida.** O Lenis subiu sabendo (memória, e o PR #74 antes) que `test:product-ui` falhava na `main`; o plano era "consertar num PR separado". Resultado: o primeiro run vermelho parecia culpa do Lenis, custou uma rodada de diagnóstico e o fix acabou entrando no mesmo PR de qualquer jeito. Regra: suíte vermelha herdada se conserta **antes** (PR próprio, mergeado primeiro) ou no **primeiro commit** do PR novo — nunca "depois".
2. **`Phase · Glossary` é frágil por design, não por acaso.** Mecanismo: o `play` faz `userEvent.tab()` → `expect(glossary).toHaveFocus()` → `waitFor(() => expect(tooltip).toBeVisible())`. `toHaveFocus` lê `document.activeElement`, que continua apontando pro `.gloss` mesmo quando o documento **não** tem o foco da janela; mas `:focus-visible` (que é o que liga `opacity: 1` no `.gloss-tip`, `main.css`) só casa enquanto o documento está focado. O Vitest em modo browser roda cada arquivo de story num iframe e os arquivos em paralelo (no run vermelho: 16,6s de testes em 12,9s de parede; `patterns.stories.js` levou 8,1s enquanto os outros cinco terminavam do lado) — um iframe vizinho que receba foco no meio do `waitFor` apaga o `:focus-visible` do nosso e o tooltip fica invisível até o timeout de 1s. É a mesma família da `Contributions Hover` do PR #71 (evento assíncrono fora do controle do `play`). Não tem histórico nos 25 runs anteriores e passou no run seguinte com o mesmo código: consistente com corrida, não com regressão. O que fazer quando um story depende de `:focus`/`:focus-visible`: ou (a) `fileParallelism: false` no projeto `storybook` de `vitest.config.mjs` (6 arquivos, ~13s — o custo é pequeno e elimina a classe inteira de corrida por foco), ou (b) o `play` esperar `document.hasFocus()` antes de asserir o estilo de foco. **Aplicado (a)** no PR seguinte ao #77 (28/08/2026): `fileParallelism: false` no projeto `storybook` de `vitest.config.mjs`, no nível do `test` — `browser.fileParallelism` existe mas está deprecado no Vitest 4 e só repassa pro de cima. Vale pra qualquer story que dependa de foco (command menu, see-more, gloss), não só essa.
3. **Rerun primeiro, push depois.** Um `gh run rerun --failed` em andamento é a única forma barata de separar flake de regressão; um push na mesma branch cancela ele. Se precisa dos dois, espere o rerun terminar.
4. **Vendorar é copiar e olhar o arquivo — inclusive o fim.** `lenis.mjs` veio com `//# sourceMappingURL=lenis.mjs.map` e o `.map` não; o Vite avisava "Failed to load source map" em todo run (inofensivo, mas ruído que atrapalha ler o log de uma falha real). Mesma lição da regra 7 do `AGENTS.md` (`favicon.svg` com a página 404 dentro): `head`, `tail` e `file` no que foi copiado, e ou traz o `.map` junto ou tira o ponteiro.
5. **O reporter do `node --test` imprime `ℹ fail 0`, não `# fail 0`.** Um `grep` errado nesse resumo fez um commit local condicional não acontecer sem ninguém perceber por uma rodada. Se for automatizar em cima do resumo, use `grep -E "fail [0-9]+$"`, ou só o exit code.

## UI / Storybook Contract

Storybook is not a parallel implementation of the UI. It renders and
tests the same production code whenever the architecture allows —
never a re-styled or re-built copy.

**Mental model:**
Figma defines design intent. Storybook exposes and validates the
real implementation's behavior in isolation. Production is the
single source of truth for behavior.

**When a change touches an existing component/pattern/state:**
Its story and tests must be kept in sync in the same PR. A change
is exempt only if it is style-only (color, spacing, typography)
with no new state, variant, or interaction added.

**When a change introduces something new, evaluate it for Storybook
inclusion if it meets any of:**

- reused in 2+ places in the app
- lives in `/components` or `/patterns` (not page-local markup)
- has multiple distinct visual/interactive states worth reviewing
  in isolation

**When in doubt:**
Prefer deterministic validation over additional judgment whenever
an applicable check already exists. If no deterministic Storybook
coverage check exists yet, explicitly determine whether the change
meets the inclusion or exemption criteria above rather than
silently skipping Storybook updates.

**Discovery loop:**
Storybook isn't only a documentation step after implementation. If
isolating a component in Storybook surfaces a missing or ambiguous
state (e.g. "selected + sidebar open" persisting after pointer
leave), that goes back into the real implementation — Storybook
found a gap, it doesn't just record one.

## Definition of Done para mudanças de UI

- [ ] A story existente foi atualizada ou uma story pequena cobre o novo estado relevante.
- [ ] Interações com estado têm `play`; caminhos de ponteiro importantes também passam por teclado quando aplicável.
- [ ] O teste confirma foco inicial, movimento de foco e retorno de foco para overlays quando esse contrato existir.
- [ ] Nome, role e estado acessíveis dos controles são verificáveis; axe passa sem nova exceção `todo`.
- [ ] `npm run build-storybook` passa.
- [ ] `npm run test:ui` passa em Chromium depois do build; se a mudança toca um controlador da página, o smoke product-real correspondente também foi atualizado.
- [ ] A matriz visual relevante cobre light/dark, Flat type, viewport estreito e reduced-motion; toda baseline atualizada foi inspecionada, não apenas regenerada.
- [ ] Foco por teclado nunca termina dentro de um ancestral `aria-hidden`/`inert`, e overlays restauram o opener após dismiss completo.
- [ ] Nenhum arquivo gerado de `storybook-static/` entrou no commit e nenhum comportamento de produção mudou só para satisfazer o harness.
