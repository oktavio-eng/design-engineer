# Changelog

Notable changes to this site, in the order they landed on `main`. Newest first. This is the technical log — for the narrated version, see `/changelog` on the site itself.

**Formato (desde 06/09/2026):** um bullet por mudança diz *o quê*, *onde* (arquivo, token, componente) e o PR. O *porquê*, as contas e o que foi rejeitado moram no `docs/*.md` do tópico — o bullet só aponta. Quando o mês fecha, o bloco vai pra `docs/changelog/AAAA-MM.md` e este arquivo guarda só o mês corrente.

**Meses anteriores:** [agosto de 2026](docs/changelog/2026-08.md) (01/08–30/08 — recuperação do site, tokens, intro, ⌘K, `/prompts`, portfólio na home, Figma-first, Lenis, composer + Supabase).

## 2026-09-06

- Changelog reorganizado: agosto arquivado verbatim em `docs/changelog/2026-08.md` (link nos dois sentidos), bullets de setembro reescritos curtos com o porquê movido pros docs, regra de formato no topo deste arquivo e no `AGENTS.md`. Motivo e alternativas rejeitadas (arquivo por dia) em `docs/architecture.md` ("Documentação").
- Figma: variáveis do arquivo `Oktavio` sincronizadas com `styles/tokens/` via MCP — `color/line`, `color/row-dim`, `color/row-hover` (Light), `color/contrib-0` como alias de `color/line`, easings, `intro/*` e `tip/*` como aliases de `duration/*`, `glass/*`, `corner/*`; todas com Code syntax Web. `color/muted` e tipografia ficaram (flat-type). Valores, o que ficou de fora e um gotcha novo em `docs/figma-workflow.md` ("Sincronização de variáveis"). Sem mudança no repositório.
- `--bg` vai pra `#FAF9F5` = `oklch(0.982 0.0054 95.1)`: o 0.95 do #92 ficou escuro demais. A rampa (`--row-hover`, `--line`, `--muted`, `--row-dim`, `--code-url`) volta às relações de origem sobre o fundo novo; contas em sRGB de 8 bits nos comentários de `styles/tokens/colors.css`. Campos do editor do Studio ganham stroke `--ink-a8` e anel de foco tracejado `--ink-a10` (tokens novos) — desenho em `docs/studio.md`. Doze baselines light e quatro dark do site regeneradas (`docs/storybook-and-tests.md`, "Baselines dark defasadas"). Nada disso aparece no Studio publicado até `npm run deploy:studio`. (#93)
- Wiki: Shift Nudge (Matt D. Smith) em "Courses & materials" (status "Evaluate") e Matt D. Smith em "The people", com o curso linkado no modal. (#92)
- Dashboard: todo `border-radius: 32px` do `styles/admin.css` desce pra `--radius-24`; o modal do editor de conteúdo fica 100% branco com campos em `--bg`. `--bg` desceu pra L 0.95 com a rampa retunada e catorze baselines regeneradas — superado no mesmo dia pelo #93 acima. (#92)
- Caixa de entrada: seleção imediata durante gravações, só a última seleção fica na fila de leitura, voltar/buscar/filtrar cancela; renderização incremental por ID. Comportamento em `docs/studio.md` ("Ajustes da caixa de entrada"). Supabase legado pausado. (#91)
- `.DS_Store` fora dos assets do Worker; busca do Studio com debounce de 150 ms, cancelado ao navegar; `docs/studio.md` atualizado pro estado publicado.

## 2026-09-05 — Studio no ar (#89)

- **Corte feito no fim do dia.** Worker `oktavio-studio` publicado, PR mergeado pelo Otavio, Vercel no ar: verificador 32/32 pelo domínio público e pelo Worker; `/`, `/wiki`, `/prompts`, `/changelog` servindo os três módulos de conteúdo do Worker. Varredura de segredos no histórico: nada exposto. `HANDOFF.md` sai do repositório (fica local, ignorado); pendências do review em `docs/studio.md` ("Pendências pós-corte"). Passo a passo de produção e rollback em `docs/studio.md` ("Produção").
- Produção preparada: Cloudflare Access (org `oktavio.cloudflareaccess.com`, One-time PIN, policy só pro e-mail do Otavio), `wrangler.jsonc` completo, 3 mensagens do Supabase importadas no D1 remoto. `vercel.json` ganha os quatro `rewrites` pro Worker e `.vercelignore` tira `content.js`/`portfolio-content.js`/`prompts.mjs` do deploy estático — ordem obrigatória (Worker antes da `main`) em `docs/studio.md`. `wrangler deploy` é do Otavio (classificador do Claude Code barra).
- Code review (8 ângulos) sem bug bloqueante; corrigidos no PR: `content-sync.js` sanitiza os itens de fase vindos do D1 e compara entrada × seed sem depender da ordem das chaves (`canon()`); `script.js` tolera `/content.js` ausente; `admin/schema.mjs` deixa `prompt` fora da checagem de tags; `admin/app.mjs` mostra erro de boot em vez de travar; `stateFrom()` completa coleções novas com o seed. Lista do que ficou em `docs/studio.md`.
- Arquivos públicos: `mail.js` troca o insert do Supabase por `saveToArchive()` em `/api/contact` (`docs/messages.md`); `script.js` protege os `querySelector("a")` das linhas com `?.`; `cursor.mjs` inclui as rows do Studio no `MERGE`; `preview-head.html` carrega `admin.css`; CI roda `test:admin`; `wiki.html` carrega `content-sync.js` antes do `script.js`.
- Caixa de entrada: escritas que interrompem a leitura retomam a consulta, conservam o cursor e priorizam a última busca/filtro. `tests/admin/inbox-concurrency.test.mjs` + story `MessageInbox`.
- Tipografia do dashboard com piso Medium (500 corpo, 600 ênfase, só `.admin-page`) e seletor de família Sans/Mono/Pixel na sidebar, persistido em `localStorage.studio.typeface`. Geist Pixel entra pela primeira vez (400 nativo, `ELSH` 1). Desenho e exceções em `docs/studio.md` ("Tipografia") e `docs/design-system.md`. Story `Typeface Switcher`, asserções em `dashboard.test.mjs`, dois baselines novos.
- Transferência do acervo (`cloudflare/content-transfer.mjs`, `scripts/transfer-studio-content.mjs`): D1 local → JSON → SQL idempotente fatiado em 40 KB, `--replace-revision N`. Procedimento em `docs/studio.md` ("Transferir o acervo").
- Revisão de segurança da branch: fatiamento do import (limite de 100 KB por instrução do D1), `.vercelignore` pelo script de origem, rotação de chave no `access.mjs`, login pelo Access fora de localhost, guard `check-studio-deploy` lendo JSONC. `tests/admin/production-access.test.mjs` cobre token válido/forjado/expirado/`alg none`/`kid` desconhecido; `scripts/verify-studio-production.mjs <host>` repete só leitura.

## 2026-09-04 — Studio de conteúdo (branch local)

- Dashboard das onze coleções: editor estruturado, rascunhos, lixeira, mensagens, exportação; API Worker/D1 e migração do contato preparadas pra validação local. Coleções e regras em `docs/studio.md` ("Conteúdo e interação").
- DS compartilhado com o portfólio: sidebar e fundo `--bg`, superfície `--white`, cards sem divisórias, controles em cápsula; sidebar recolhível persistente, navegação por teclado, cursor visível sobre campos.
- Caixa de entrada com lista e leitura na mesma superfície (referência: Linear), filtros, busca, paginação, leitura persistente e arquivo reversível no D1. Cobertura de D1, autenticação, CRUD e modais; stories reutilizam os componentes reais.

## 2026-09-01

- Só conteúdo — reposicionamento pra Product Design e candidatura internacional; nenhum CSS, token ou JS mudou. Marca lê `GOW Design` em tudo que é público (role, footers, meta/OG, `favicon.svg`, `portfolio-content.js`, asserção do ⌘K); `projects` reordenado (Caderno de Erros, Sphera, Escola da Bel acima do show more); bios de `escola-da-bel` e `life.brazil` e os itens `f3`/`f4` de `content.js` + gêmeos estáticos em `wiki.html` reescritos. Deixado de propósito, pendente de copy: a nota "Discarded" da wiki, o bullet estático "Title: design engineer, not product designer" e a bio do `f3` sobre faixa salarial.
- `tests/ui/people-persistent-selection.test.mjs`: hover flake do CI de novo (Lenis re-resolve o elemento em hover quando o scroll termina); agora espera o `scrollY` parar, re-mira e lê `:hover` + fill juntos. Padrão em `docs/storybook-and-tests.md` ("Hover com Lenis"). Só teste.
