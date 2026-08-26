# AGENTS.md — Design Engineer Wiki

Contexto para qualquer agente de IA (Cursor, Claude Code, etc.) que for editar este repositório. Leia isto antes de mexer no `wiki.html`, `styles/` ou `script.js`.

Este arquivo é o índice — curto de propósito, porque é carregado em toda sessão. Decisões de craft detalhadas (o "por quê", as datas, o que foi rejeitado) moram em `docs/*.md`; abra o doc certo quando a tarefa cair no tópico dele. Regra: cada fato mora em um arquivo só, o resto linka pra ele. (Reorganizado em 22/08/2026 — o arquivo tinha crescido pra 254 linhas / 59KB, ver git history se quiser a versão antiga.)

## Skills compartilhadas

As skills pessoais instaladas nesta máquina ficam fora do repositório, mas Codex e Claude Code devem carregá-las quando o pedido corresponder ao escopo descrito aqui. O `AGENTS.md` só define o roteamento; as instruções completas e as fontes canônicas continuam dentro de cada skill.

### `vocabulary` — vocabulário preciso de design e UI

Carregue a skill `vocabulary` **antes de responder ou editar** quando a tarefa envolver:

- descobrir o nome exato de um conceito descrito de forma vaga ("como chama aquele espaço entre duas letras?");
- distinguir termos próximos ou frequentemente confundidos, como kerning/tracking, badge/tag, tooltip/popover, opacity/visibility, modal/sheet/drawer, voice/tone ou variables/tokens;
- escrever ou revisar specs, documentação, comentários, nomes de componentes ou commits em que terminologia de design/UI imprecisa possa gerar ambiguidade;
- validar o uso de termos de tipografia, cor, iconografia, layout, interação, motion, acessibilidade, arquitetura da informação, copywriting, análise ou componentes.

No Codex, invoque como `$vocabulary`; no Claude Code, como `/vocabulary`. A invocação implícita também é esperada quando o pedido corresponder ao escopo acima. Use a definição exata da fonte canônica da skill e exponha a distinção relevante entre termos próximos; não force jargão quando linguagem simples for mais clara e não invente um termo se a skill não trouxer um correspondente. Se a skill não estiver disponível na máquina ou sessão atual, informe isso brevemente em vez de fingir que consultou a fonte.

## O que é este projeto

Um site pessoal single-page do Otavio (GOW Studio) — um "plano de transição de carreira" pra design engineer, com estudo de referências (Rauno Freiberg, Emil Kowalski, Jakub Krehel, floguo, Paco Coursey, shadcn, etc.), cursos, leituras e craft references. Também funciona como prova pública de trabalho (portfolio > diploma).

- **Stack:** arquivos estáticos, zero build step — `wiki.html` (o plano, markup), `styles/` (CSS), `script.js` (interação da wiki) e os arquivos de JS compartilhados entre as páginas: `content.js`, `favicons.js`, `intro.js`, `mail.js`, `chrome.js`, `cmd.mjs`, `cursor.mjs` (mais `prompts.mjs`, da página `/prompts`). Servidos direto, sem bundler, sem framework. `/` é o portfólio, `/wiki` é o plano — detalhes de rotas, ordem de scripts, o que cada arquivo de JS faz e por quê, e a estrutura de `styles/main.css`/tokens estão em **[docs/architecture.md](docs/architecture.md)**.
- **Deploy:** Vercel, projeto **`design-engineer`** (team ID `team_mMftBNlEUa18031DuM84fBHt`). **NUNCA crie um projeto novo na Vercel — sempre atualize o existente.**
- **URL de produção:** `design-engineer-phi.vercel.app`
- **Repo:** conectado ao GitHub (`oktavio-eng/design-engineer`) — push na `main` dispara deploy automático.

## Docs por tópico

**Abra o doc correspondente antes de editar** qualquer coisa que caia num desses tópicos — o resumo de uma linha aqui existe pra achar o arquivo certo, não pra substituir a leitura dele.

- **[docs/architecture.md](docs/architecture.md)** — rotas, ordem de carregamento dos scripts, o que cada arquivo de JS compartilhado faz (`content.js`, `favicons.js`, `intro.js`, `mail.js`, `contrib.mjs`, `chrome.js`, `cursor.mjs`, `cmd.mjs`, portfolio), estrutura de `styles/main.css` + `@import` dos tokens.
- **[docs/design-system.md](docs/design-system.md)** — cor (OKLCH), tipografia (Geist/variable font), layout e ritmo vertical (medido contra emilkowal.ski), a decisão sidebar×modal, motion, e o inventário completo de `styles/tokens/*.css`.
- **[docs/patterns.md](docs/patterns.md)** — padrões já implementados que não devem ser "corrigidos" de volta pro jeito antigo: toggle ver mais/menos, fallback de favicon, persistência (`localStorage`/`sessionStorage`), tooltips de glossário, hover das listas, foco por vizinhança, ponteiro iPadOS, gráfico de contribuições abrindo nas semanas recentes.
- **[docs/storybook-and-tests.md](docs/storybook-and-tests.md)** — comandos, o contrato Storybook↔produção, cobertura de testes interativos, Definition of Done pra mudanças de UI, versão do Chromium do Playwright nesta máquina e a lição do PR #71 (rode a suíte antes do push).
- **[docs/intro-screensaver.md](docs/intro-screensaver.md)** — a saudação em 6 idiomas antes do conteúdo (`.intro`, `intro.js`): timing, por que corte seco, sessionStorage, bugs já corrigidos.
- **[docs/flat-type-experiment.md](docs/flat-type-experiment.md)** — o experimento de tipografia achatada (`styles/experiments/flat-type.css`): como reverter, por que a intro fica de fora, validação.

## Regras inegociáveis

1. **Nunca crie um novo projeto Vercel.** Sempre atualize o `design-engineer` existente.
2. **Os arquivos andam juntos** em qualquer deploy: `index.html`, `wiki.html`, `changelog.html`, `prompts.html`, `styles/main.css`, os cinco arquivos em `styles/tokens/`, `script.js`, `chrome.js`, `content.js`, `portfolio-content.js`, `favicons.js`, `intro.js`, `mail.js`, `cmd.mjs`, `prompts.mjs`, `portfolio.mjs`, `contrib.mjs`, `cursor.mjs`, `sound.mjs`, `vendor/cuelume/**`, `data/contributions.json`, `favicon.svg`. Subir o HTML sem o CSS completo (main.css + tokens) derruba o site inteiro, não só o estilo — `main.css` sozinho, sem os tokens, quebra tudo porque cada `var()` fica sem definição.
3. **Antes de qualquer deploy/commit**, valide: HTML bem formado (tags fechando corretamente) e `node --check` sem erro em `script.js`, `chrome.js`, `content.js`, `portfolio-content.js`, `favicons.js`, `intro.js`, `mail.js`, `cmd.mjs`, `prompts.mjs`, `portfolio.mjs`, `contrib.mjs`, `cursor.mjs` e `sound.mjs`. Rode local antes de subir (`python3 -m http.server` na raiz e abra no browser — abrir o `index.html` via `file://` não serve, os caminhos absolutos `/styles/main.css` e `/script.js` não resolvem).
4. **Sem artefato visual quebrado.** Se um favicon, imagem ou asset externo falhar ao carregar, o padrão é remover o elemento do DOM (não deixar caixa vazia, ícone quebrado ou espaço reservado vazio).
5. **Prefira edições cirúrgicas.** Os arquivos são grandes (~1.200 linhas cada em CSS e JS) — localize o trecho exato antes de editar (`grep -n` ou busca por texto), não reescreva o arquivo inteiro pra mudanças pequenas.
6. **Não use APIs que não existem no browser.** Ver "Persistência" em [docs/patterns.md](docs/patterns.md) — o site já foi mordido por isso uma vez.
7. **Se for recuperar arquivo de produção, confira o conteúdo baixado.** No commit `610f8fa` ("Recovered site from production deployment") o `favicon.svg` entrou no repo contendo a **página de 404 da Vercel salva como texto** (`NOT_FOUND`, 79 bytes) — um `curl` de recuperação gravou a resposta de erro e ninguém abriu o arquivo. Rode `file` e `head` no que você baixou antes de commitar.

## Antes de commitar/dar push

- [ ] HTML valida (tags balanceadas)
- [ ] `node --check` passa em `script.js`, `chrome.js`, `content.js`, `portfolio-content.js`, `favicons.js`, `intro.js`, `mail.js`, `cmd.mjs`, `prompts.mjs`, `portfolio.mjs`, `contrib.mjs`, `cursor.mjs`, `sound.mjs`
- [ ] Os arquivos (`index.html`, `wiki.html`, `changelog.html`, `prompts.html`, `styles/main.css`, `styles/tokens/*.css`, `script.js`, `chrome.js`, `content.js`, `portfolio-content.js`, `favicons.js`, `intro.js`, `mail.js`, `cmd.mjs`, `prompts.mjs`, `portfolio.mjs`, `contrib.mjs`, `cursor.mjs`, `sound.mjs`, `vendor/cuelume/**`, `data/contributions.json`, `favicon.svg`) estão consistentes entre si no commit
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
