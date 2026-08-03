# AGENTS.md — Design Engineer Wiki

Contexto para qualquer agente de IA (Cursor, Claude Code, etc.) que for editar este repositório. Leia isto antes de mexer no `index.html`, `styles/` ou `script.js`.

## O que é este projeto

Um site pessoal single-page do Otavio (GOW Studio) — um "plano de transição de carreira" pra design engineer, com estudo de referências (Rauno Freiberg, Emil Kowalski, Jakub Krehel, floguo, Paco Coursey, shadcn, etc.), cursos, leituras e craft references. Também funciona como prova pública de trabalho (portfolio > diploma).

- **Stack:** arquivos estáticos, zero build step — `index.html` (markup), `styles/` (CSS), `script.js`. Servidos direto, sem bundler, sem framework.
  - `index.html` carrega `<link rel="stylesheet" href="/styles/main.css">` e `<script src="/script.js" defer>`.
  - `styles/main.css` é o que sobrou do antigo `styles.css` depois da extração de tokens — as regras de componente, todas consumindo variáveis via `var()`. Ele começa com cinco `@import`, um por arquivo em `styles/tokens/`: `colors.css`, `motion.css`, `spacing.css`, `typography.css`, `radius.css`. `@import` é nativo do CSS (sem bundler processando nada) — o browser busca os cinco arquivos antes de aplicar o resto de `main.css`, então a ordem dos `@import` no topo do arquivo importa e não pode ter regra alguma antes deles.
  - Qualquer valor novo (cor, timing, espaçamento, tipografia, raio) deve nascer como variável no arquivo de token certo, não como literal solto em `main.css`. Se o valor já existe em outro token com o mesmo número, reuse — não duplique.
  - `--panel-w` (em `styles/tokens/spacing.css`) é lido/escrito por `script.js` via `style.setProperty`/`getComputedStyle` no `documentElement` — não renomeie essa variável nem a mova pra fora de um seletor `:root` alcançável globalmente.
  - O `defer` é o que faz o `script.js` rodar depois do parse do DOM — equivalente ao antigo script no fim do `</body>`. **Não troque `defer` por `async`**: o script consulta o DOM no topo do arquivo e quebraria.
  - Era um `index.html` único com CSS e JS inline até 01/08/2026, depois virou `index.html` + `styles.css` + `script.js`, e em seguida `styles.css` foi quebrado em `styles/main.css` + `styles/tokens/*.css`. Se você encontrar documentação ou memória falando em "arquivo único" ou em `styles.css` na raiz, está desatualizada.
- **Deploy:** Vercel, projeto **`design-engineer`** (team ID `team_mMftBNlEUa18031DuM84fBHt`). **NUNCA crie um projeto novo na Vercel — sempre atualize o existente.**
- **URL de produção:** `design-engineer-phi.vercel.app`
- **Repo:** conectado ao GitHub (`oktavio-eng/design-engineer`) — push na `main` dispara deploy automático.

## Regras inegociáveis

1. **Nunca crie um novo projeto Vercel.** Sempre atualize o `design-engineer` existente.
2. **Os arquivos andam juntos** em qualquer deploy: `index.html`, `styles/main.css`, os cinco arquivos em `styles/tokens/`, `script.js`, `favicon.svg`. Subir o HTML sem o CSS completo (main.css + tokens) derruba o site inteiro, não só o estilo — `main.css` sozinho, sem os tokens, quebra tudo porque cada `var()` fica sem definição.
3. **Antes de qualquer deploy/commit**, valide: HTML bem formado (tags fechando corretamente) e `node --check script.js` sem erro. Rode local antes de subir (`python3 -m http.server` na raiz e abra no browser — abrir o `index.html` via `file://` não serve, os caminhos absolutos `/styles/main.css` e `/script.js` não resolvem).
4. **Sem artefato visual quebrado.** Se um favicon, imagem ou asset externo falhar ao carregar, o padrão é remover o elemento do DOM (não deixar caixa vazia, ícone quebrado ou espaço reservado vazio).
5. **Prefira edições cirúrgicas.** Os arquivos são grandes (~1.200 linhas cada em CSS e JS) — localize o trecho exato antes de editar (`grep -n` ou busca por texto), não reescreva o arquivo inteiro pra mudanças pequenas.
6. **Não use APIs que não existem no browser.** Ver "Persistência" abaixo — o site já foi mordido por isso uma vez.
7. **Se for recuperar arquivo de produção, confira o conteúdo baixado.** No commit `610f8fa` ("Recovered site from production deployment") o `favicon.svg` entrou no repo contendo a **página de 404 da Vercel salva como texto** (`NOT_FOUND`, 79 bytes) — um `curl` de recuperação gravou a resposta de erro e ninguém abriu o arquivo. Rode `file` e `head` no que você baixou antes de commitar.

## Design system

**Cor:** tokens em **OKLCH** (não hex/rgb direto nos componentes). Se precisar gerar ou ajustar uma paleta, pensar em espaço perceptualmente uniforme — evita os problemas clássicos de contraste quebrado e "hue drift" que RGB/HSL têm.

**Tipografia:** **Inter**, uma família só, hierarquia por peso/cor/espaço — nunca por decoração. Sem ícones decorativos, sem imagens de capa. O documento tem que se sustentar em texto puro; espaçamento e ritmo carregam a hierarquia.

**Layout:** cascata de três colunas inspirada no floguo.com (estilo Finder/coluna), sidebar redimensionável com drag handle (linha tracejada de hint, opacidade baixa ~0.3).

**Motion:**
- Entrada de elementos: stagger animation via `@keyframes enter` (fade + `translateY` + blur leve).
- Toda transição precisa ser **interruptível** — nunca travar o usuário no meio de uma animação.
- Curvas de easing específicas por contexto, não uma curva genérica pra tudo (referência de craft: recent.design, deck.gallery).

### Tokens (`styles/tokens/`)

Extraídos de `styles.css` em 01/08/2026 (ver `tokens/extract-design-tokens` no histórico) — zero mudança visual, validado por diff estrutural do CSSOM (todas as 854 declarações do arquivo original batem com a versão tokenizada após resolver `var()`) e screenshot pixel-a-pixel (desktop + mobile) antes/depois.

- `colors.css` — `--bg`/`--ink`/`--muted`/`--faint`/`--line` (a paleta OKLCH original), variantes de alpha (`--white-a40`, `--shadow-a05`, `--ink-a5` etc.), o sistema de vidro (`--glass-bg`/`--glass-blur`/`--glass-sat`) e as sombras compostas reaproveitadas em mais de um lugar (`--shadow-glass-core`, `--shadow-card`, `--shadow-modal`).
- `motion.css` — as três curvas de easing (`--ease`, `--ease-out`, `--ease-pop`) e uma escala de durações nomeada pelo valor em ms (`--duration-120`, `--duration-250` etc.), cobrindo só os números que o arquivo realmente usa.
- `spacing.css` — `--panel-w`/`--topbar-h` (pré-existentes; `--panel-w` é lido/escrito por `script.js`, não renomear) mais `--cpanel-w`/`--border-w` (novos, mesma ideia) e uma escala genérica `--space-N` (px) pra todo o resto — padding, margin, gap, largura/altura, offsets de posição e de `transform`.
- `typography.css` — `--font-sans`, escala de `--fs-N` (font-size), `--fw-regular/medium/semibold`, `--lh-base/snug`, `--ls-tight/wide`.
- `radius.css` — escala `--radius-N` + `--radius-full` (999px, pill) e as variáveis de `corner-shape` (`--corner-sm`/`--corner-lg`) que já existiam.

Regra pra manter isso limpo: **todo valor novo de cor, timing, espaçamento, tipografia ou raio nasce como token**, no arquivo certo — nunca como literal solto em `main.css`. Se o número já existe como token (mesmo px/ms/oklch), reuse em vez de criar um novo. Exceção proposital: os offsets internos de `box-shadow`/`backdrop-filter` blur/spread de UM sombra específica (ex. os `1px`/`2px`/`6px` da sombra de `.panel-close`) ficam literais dentro do próprio valor — só a cor vira token — pra não acoplar a "receita" de uma sombra à escala de espaçamento genérica; se a mesma sombra composta aparecer em 2+ lugares, aí sim vira token único (foi o caso de `--shadow-card` e `--shadow-modal`). Breakpoints de `@media` (560px, 900px) também ficam literais — CSS não permite `var()` dentro de media query condition em nenhum browser hoje.

## Padrões já implementados (não reinventar)

**Toggle "ver mais/ver menos" da lista de pessoas** (`.extras` / `.extras-inner`):
- Implementação correta: `grid-template-rows: 0fr → 1fr` no wrapper, transição de **320ms** na altura + fade de **240ms** nas rows, tudo controlado por um único `classList.toggle("expanded")`.
- **Não volte para** um sistema baseado em `setTimeout` + `display: none` — essa era a versão antiga e quebrada (dava um "salto" seco no collapse porque a altura colapsava num frame só). Foi corrigido de propósito, não é acidente de código legado.

**Fallback de favicon externo** (para referências tipo Framer-hosted que o Google favicon service não indexa):
- Cascata: Google favicon service → DuckDuckGo → `/favicon.ico` da própria origem → `img.remove()` no fracasso total.
- Função `window.favFallback`, no topo do `script.js`. Os `<img>` chamam via `onerror="favFallback(this)"` — é o único handler inline que sobrou no HTML.
- **`sweepFavicons()` logo abaixo dela não é redundante.** Como o `script.js` é `defer`, um ícone pode falhar *antes* da função existir; nesse caso o `onerror` estoura e o ícone quebrado fica na tela. A varredura pega os `img.fav` que já estão em estado de falha (`complete && naturalWidth === 0`) e reaplica a cascata. Se algum dia o script voltar a ser inline no `<head>`, aí sim ela vira redundante — até lá, não remova.
- De novo: nunca deixar placeholder quadrado neutro ou espaço vazio reservado — ou mostra o favicon, ou remove o elemento e o texto flui até a margem.

**Persistência: `localStorage` é a regra, com uma exceção pontual** (largura da sidebar e comentários usam a regra; a intro usa a exceção — ver abaixo).
- Passa por dois helpers no `script.js`, `readStored(key)` / `writeStored(key, value)`, com `try/catch` — `localStorage` **lança exceção** (não retorna `null`) em Safari private mode, storage de terceiros bloqueado e quota estourada. Persistência aqui é conveniência: engole a falha e segue.
- Chaves: `panel-width` e `plan-comments-v2`.
- **Não reintroduza `window.storage`.** O site nasceu como Claude Artifact, e `window.storage.get()/.set()` é a API de persistência *daquele sandbox* — não existe em browser nenhum. Em produção era `undefined`, toda chamada lançava `TypeError`, e só "funcionava" porque o `catch` caía no `localStorage`. O custo: `loadPanelWidth()` e `loadComments()` eram `async` só por causa do `await`, então a largura da sidebar aplicava um microtask atrasada e dava flash de layout no load. Removido em 01/08/2026 — as quatro funções são síncronas agora.
- **Exceção documentada: `sessionStorage` na intro** (chave `intro-shown-v1`, dentro da IIFE da intro no topo do `script.js`). `localStorage` está errado aqui de propósito: a intro é pra tocar uma vez por sessão de aba, não uma vez pra sempre — um reload cinco minutos depois não deveria repetir os ~7s de saudação, mas uma aba nova sim. Mesmo formato de `try/catch` engolindo falha dos helpers de `localStorage`, só que com `sessionStorage`. Chave versionada (`-v1`) segue o mesmo padrão de `plan-comments-v2` — se a sequência mudar de novo de um jeito que valha a pena rever, suba a versão pra forçar replay.

**Tooltips de glossário** (`.gloss` / `.gloss-tip`): termos técnicos (ex. "OKLCH", "cmdk") têm span com tooltip explicativo, acessível via `tabindex="0"`.

**Intro "hello screensaver"** (`.intro` no HTML, bloco `.intro*` em `main.css`, IIFE no topo do `script.js`): saudação em 6 idiomas antes do conteúdo, terminando em "Hello" e na bandeirinha, ordem ocidental → não-latino → "Hello". Total ≈ 5.1s (era ~17s com 20 idiomas e hold de 320ms/palavra, depois ~7.15s com 10 idiomas, depois ~5.6s com 7 idiomas — cortado a pedido em três passos, ver conta abaixo). Decisões que parecem estranhas e são de propósito:
- **A classe `.intro-playing` nasce no `<html>` do markup**, não no JS. É isso que faz o overlay pintar no primeiro frame — o `script.js` é `defer`, então qualquer classe que ele adicionasse chegaria depois do primeiro paint e daria flash do conteúdo. O JS só *remove* a classe. Consequência: todo caminho de saída (fim, skip, já visto nesta sessão, reduced motion) tem que tirar a classe, senão a página fica presa atrás de uma folha branca. O `<noscript>` no `<head>` cobre o caso sem JS.
- **O stagger do conteúdo é segurado com `animation-name: none`, não com `animation-play-state: paused`.** Pausar depende de retomar uma timeline que começou antes da página estar visível; zerar o `animation-name` faz o `enter` começar limpo quando a classe `.intro-done` entra. Não troque de volta.
- **`.intro-done` e a remoção de `.intro-playing` são dois momentos distintos**: `.intro-done` dissolve o overlay *e* libera o stagger no mesmo frame (é o cross-fade); a remoção da classe só acontece quando o fade termina, e é ela que apaga o elemento do DOM.
- **Toca uma vez por sessão de aba, via `sessionStorage`** (chave `intro-shown-v1`) — ver a exceção documentada na seção de Persistência acima. Pra forçar replay ao testar, abra uma aba nova (sessionStorage é por aba) em vez de só recarregar.
- Durações em `tokens/motion.css` (`--intro-*`), lidas de volta pelo `script.js` via `getComputedStyle` — mesmo padrão do `--panel-w`. Mexa nos tokens, não nos números do JS. `--intro-hold` (pausa por palavra) e `--intro-mark-hold` (pausa da marca antes de dissolver) são números **separados** de propósito — antes a marca reaproveitava `--intro-hold-last` (a pausa do "Hello"), acoplamento sem razão semântica que foi corrigido junto com o primeiro corte de 20→10 idiomas.
- A conta do total: 6 palavras não-finais (Ciao, Hola, Bonjour, Olá, こんにちは, 你好) a `2×--intro-fade + --intro-hold` (200+200+120 = 520ms) cada = 3.12s, mais "Hello" a `2×--intro-fade + --intro-hold-last` (200+200+1000 = 1.4s), mais a marca a `--intro-reveal + --intro-mark-hold` (400+150 = 550ms). Total ≈ 5.07s até liberar o conteúdo, mais os 500ms de `--intro-out` (que já rodam em cross-fade com o stagger) até o overlay sair do DOM.
- Os idiomas não-latinos (CJK, já que Merhaba/Здравствуйте/مرحبا saíram da lista no segundo corte) caem no `system-ui` do stack — Inter não cobre esses scripts, e isso é o comportamento esperado, não um bug de fonte.
- Testar isso em headless com `--virtual-time-budget` **não funciona**: animações que começam depois de um salto de tempo virtual não são amostradas, e a página sai em branco mesmo quando o código está certo. Valide em Chrome real.
- **Se for usar Playwright pra validar isso, não dispare duas instalações concorrentes.** `npx playwright install` (cache global do npx) e `npx playwright install` rodado de dentro de um `node_modules` local são processos separados que competem pelo mesmo lockfile (`~/Library/Caches/ms-playwright/__dirlock`) — a segunda instalação falha com "active lockfile found" e o download de `chromium`/`chromium-headless-shell` fica incompleto (diretório existe, executável não). Sintoma: `browserType.launch` reclama que o binário não existe mesmo depois do install "terminar". Rode só uma instalação por vez e espere ela de fato terminar antes de tentar `launch()`. Se travar de novo, o fallback mais simples é pular o Playwright inteiramente: abrir o `Google Chrome.app` já instalado com `--remote-debugging-port` e `--user-data-dir` num diretório descartável, e dirigir via Chrome DevTools Protocol (WebSocket nativo do Node, sem dependência nova) — real, headed, sem builds pra baixar, e sem risco de screenshot pegar outra janela: `Page.captureScreenshot` só retorna pixels da aba controlada, nunca da tela.

## Antes de commitar/dar push

- [ ] HTML valida (tags balanceadas)
- [ ] `node --check script.js` passa
- [ ] Os arquivos (`index.html`, `styles/main.css`, `styles/tokens/*.css`, `script.js`, `favicon.svg`) estão consistentes entre si no commit
- [ ] Servido por HTTP local (`python3 -m http.server`) e aberto no browser — console sem erro, CSS aplicado, favicons resolvendo
- [ ] Testado visualmente antes do push (o build da Vercel não pega erro de "craft" — só erro de build; e como não há build step, ele não pega nem erro de sintaxe)
- [ ] Nenhum "ver mais/menos" ou fallback de imagem voltou pro padrão antigo (`display:none` seco, placeholder quebrado)
- [ ] Nenhuma API inexistente no browser reintroduzida (`window.storage` e afins)

## Seja flexível quando eu pedir

As regras acima são o "estado estável" do craft — não são pra travar exploração. Quando eu pedir explicitamente pra:
- estudar uma referência nova (outro site, outro designer, outro sistema),
- testar uma direção visual diferente,
- ou revisar/substituir algum desses padrões,

trate isso como um convite pra propor algo novo e discutir trade-offs — não insista nas regras acima por padrão nesses momentos. As regras protegem contra regressão acidental, não contra evolução intencional do projeto.
