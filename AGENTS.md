# AGENTS.md — Design Engineer Wiki

Contexto para qualquer agente de IA (Cursor, Claude Code, etc.) que for editar este repositório. Leia isto antes de mexer no `index.html`, `styles.css` ou `script.js`.

## O que é este projeto

Um site pessoal single-page do Otavio (GOW Studio) — um "plano de transição de carreira" pra design engineer, com estudo de referências (Rauno Freiberg, Emil Kowalski, Jakub Krehel, floguo, Paco Coursey, shadcn, etc.), cursos, leituras e craft references. Também funciona como prova pública de trabalho (portfolio > diploma).

- **Stack:** três arquivos estáticos, zero build step — `index.html` (markup), `styles.css`, `script.js`. Servidos direto, sem bundler, sem framework.
  - `index.html` carrega os dois com `<link rel="stylesheet" href="/styles.css">` e `<script src="/script.js" defer>`.
  - O `defer` é o que faz o `script.js` rodar depois do parse do DOM — equivalente ao antigo script no fim do `</body>`. **Não troque `defer` por `async`**: o script consulta o DOM no topo do arquivo e quebraria.
  - Era um `index.html` único com CSS e JS inline até 01/08/2026. Se você encontrar documentação ou memória falando em "arquivo único", está desatualizada.
- **Deploy:** Vercel, projeto **`design-engineer`** (team ID `team_mMftBNlEUa18031DuM84fBHt`). **NUNCA crie um projeto novo na Vercel — sempre atualize o existente.**
- **URL de produção:** `design-engineer-phi.vercel.app`
- **Repo:** conectado ao GitHub (`oktavio-eng/design-engineer`) — push na `main` dispara deploy automático.

## Regras inegociáveis

1. **Nunca crie um novo projeto Vercel.** Sempre atualize o `design-engineer` existente.
2. **Os quatro arquivos andam juntos** em qualquer deploy: `index.html`, `styles.css`, `script.js`, `favicon.svg`. Subir o HTML sem o CSS/JS derruba o site inteiro, não só o estilo.
3. **Antes de qualquer deploy/commit**, valide: HTML bem formado (tags fechando corretamente) e `node --check script.js` sem erro. Rode local antes de subir (`python3 -m http.server` na raiz e abra no browser — abrir o `index.html` via `file://` não serve, os caminhos absolutos `/styles.css` e `/script.js` não resolvem).
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

## Padrões já implementados (não reinventar)

**Toggle "ver mais/ver menos" da lista de pessoas** (`.extras` / `.extras-inner`):
- Implementação correta: `grid-template-rows: 0fr → 1fr` no wrapper, transição de **320ms** na altura + fade de **240ms** nas rows, tudo controlado por um único `classList.toggle("expanded")`.
- **Não volte para** um sistema baseado em `setTimeout` + `display: none` — essa era a versão antiga e quebrada (dava um "salto" seco no collapse porque a altura colapsava num frame só). Foi corrigido de propósito, não é acidente de código legado.

**Fallback de favicon externo** (para referências tipo Framer-hosted que o Google favicon service não indexa):
- Cascata: Google favicon service → DuckDuckGo → `/favicon.ico` da própria origem → `img.remove()` no fracasso total.
- Função `window.favFallback`, no topo do `script.js`. Os `<img>` chamam via `onerror="favFallback(this)"` — é o único handler inline que sobrou no HTML.
- **`sweepFavicons()` logo abaixo dela não é redundante.** Como o `script.js` é `defer`, um ícone pode falhar *antes* da função existir; nesse caso o `onerror` estoura e o ícone quebrado fica na tela. A varredura pega os `img.fav` que já estão em estado de falha (`complete && naturalWidth === 0`) e reaplica a cascata. Se algum dia o script voltar a ser inline no `<head>`, aí sim ela vira redundante — até lá, não remova.
- De novo: nunca deixar placeholder quadrado neutro ou espaço vazio reservado — ou mostra o favicon, ou remove o elemento e o texto flui até a margem.

**Persistência: só `localStorage`** (largura da sidebar e comentários).
- Passa por dois helpers no `script.js`, `readStored(key)` / `writeStored(key, value)`, com `try/catch` — `localStorage` **lança exceção** (não retorna `null`) em Safari private mode, storage de terceiros bloqueado e quota estourada. Persistência aqui é conveniência: engole a falha e segue.
- Chaves: `panel-width` e `plan-comments-v2`.
- **Não reintroduza `window.storage`.** O site nasceu como Claude Artifact, e `window.storage.get()/.set()` é a API de persistência *daquele sandbox* — não existe em browser nenhum. Em produção era `undefined`, toda chamada lançava `TypeError`, e só "funcionava" porque o `catch` caía no `localStorage`. O custo: `loadPanelWidth()` e `loadComments()` eram `async` só por causa do `await`, então a largura da sidebar aplicava um microtask atrasada e dava flash de layout no load. Removido em 01/08/2026 — as quatro funções são síncronas agora.

**Tooltips de glossário** (`.gloss` / `.gloss-tip`): termos técnicos (ex. "OKLCH", "cmdk") têm span com tooltip explicativo, acessível via `tabindex="0"`.

## Antes de commitar/dar push

- [ ] HTML valida (tags balanceadas)
- [ ] `node --check script.js` passa
- [ ] Os quatro arquivos (`index.html`, `styles.css`, `script.js`, `favicon.svg`) estão consistentes entre si no commit
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
