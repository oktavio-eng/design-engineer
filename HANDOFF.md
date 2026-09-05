# Continuação do Studio — 05/09/2026

Este arquivo registra o estado do trabalho para continuar em outra ferramenta. Leia primeiro `AGENTS.md` e depois este documento. Pedidos novos do usuário prevalecem sobre este registro.

## Quando você chegar — 5 comandos, nesta ordem (05/09/2026, deixado pelo Claude Code)

**Atualização 17h: passos 1 e 2 feitos.** O usuário refez `npx wrangler login` com os escopos padrão (o login limitado do Codex não tinha `workers_scripts:write` e o `deploy` falhava com "Authentication error" em `/workers/subdomain`) e rodou `npm run deploy:studio`: Worker `oktavio-studio` publicado, versão `e61e8982-61f7-40b1-8312-e13c40601d60`, em `https://oktavio-studio.oktavio.workers.dev`. Verificador logo depois: **26/32**; as 6 falhas são todas do domínio público sem rewrite (`/api/contact` 404 na Vercel, módulos públicos ainda estáticos), esperadas até o passo 4. Access na borda confirmado: `/admin` e `/api/admin/*` anônimos ou com e-mail forjado → 302 para `oktavio.cloudflareaccess.com`. Faltam: login real com PIN (passo 3), corte na Vercel (4) e verificação final (5). Detalhe cosmético: o build subiu `styles/.DS_Store` e `vendor/.DS_Store` como assets — excluir em `scripts/build-worker.mjs` numa próxima.


Tudo abaixo já está preparado e revisado; nada foi commitado nem publicado. **A ordem importa**: o `vercel.json` desta branch já redireciona `/content.js`, `/portfolio-content.js`, `/prompts.mjs` e `/api/contact` para `oktavio-studio.oktavio.workers.dev`, e esse host responde 404 (Worker não publicado; conferido às 16h) até o passo 1. Se der push na `main` antes do passo 1, o site perde os scripts de conteúdo.

```bash
cd /Users/oktavio/Projects/design-engineer
# 1. Publicar o Worker (guard + build + wrangler deploy). Único passo que o Claude não pôde rodar.
npm run deploy:studio
# 2. Verificar no host real (só leitura; sai com 1 se algo falhar).
node scripts/verify-studio-production.mjs https://oktavio-studio.oktavio.workers.dev
# 3. Entrar no Studio: https://oktavio-studio.oktavio.workers.dev/admin → tela do Cloudflare Access → PIN no Gmail.
#    Esperado: caixa de entrada com as 3 mensagens de 29/08; salvar qualquer conteúdo e ver /portfolio-content.js mudar no host do Worker.
# 4. Corte na Vercel: commit desta branch, PR e merge na `main` (deploy automático no projeto design-engineer).
#    O vercel.json e o .vercelignore já estão editados; conferir com `git diff vercel.json`.
# 5. Verificar pelo domínio público e guardar o CHANGELOG.
node scripts/verify-studio-production.mjs https://oktavio-studio.oktavio.workers.dev   # agora também checa oktavio.vercel.app
```

Rollback se o passo 5 falhar: reverter o merge (frontend **e** `vercel.json` juntos); o Worker e o D1 podem ficar no ar, o site volta a servir os módulos estáticos. Nunca apagar D1 nem Supabase durante a transição. Depois de tudo, revogar os dois tokens colados no chat (Cloudflare `studio-access` e Supabase).

## Revisão de 05/09, 16h (code review em 8 ângulos, depois da retomada)

Rodado sobre a árvore de trabalho inteira. **Nenhum bug bloqueante.** Corrigido na hora (suítes rodadas depois: `test:admin` 13/13, `test:product-ui` 17/17):

- `content-sync.js`: sanitizador de lista branca nos itens de fase vindos do CMS (antes `innerHTML` cru — um sink de XSS armazenado que o site não tinha); comparação entrada × seed independente da ordem das chaves (`canon()`).
- `script.js`: `window.SITE_CONTENT || {}` com coleções vazias por padrão, pra uma falha do Worker em `/content.js` não derrubar a wiki inteira.
- `admin/schema.mjs`: o campo `prompt` fica fora da checagem de tags (é renderizado como texto nos dois lados) — antes nenhum prompt com `<` podia ser salvo.
- `admin/app.mjs`: `api()` anexa `status` ao erro e o boot mostra o cartão de login/erro em qualquer falha que não seja 401 (antes ficava preso em "Abrindo seu studio…").
- `cloudflare/worker.mjs`: `stateFrom()` mescla coleções que existam no seed e faltem na linha `cms_state` salva (coleção nova depois do primeiro save não derruba mais as rotas públicas nem o save).
- `mail.js`: comentários que citavam uma CHECK de regex inexistente na migration.
- Falso positivo descartado: `script.js personRow()` e o ⌘K já tratam `{ ref }` para pessoa ausente/rascunho com `if (!p) return`.
- `docs/messages.md`, `CHANGELOG.md`: fatos desatualizados (Supabase já importado; arquivos públicos da branch sem bullet).

Adiado, sem mudança de comportamento (qualidade/performance; retomar depois do cutover):

- Duplicações: engine de tooltip (`admin/tooltips.mjs` × `contrib.mjs`), toggle de tema (`admin/app.mjs` × `chrome.js`), bootstrap de tema (`admin/theme.js` × 4 páginas), `fail()` em três módulos do Worker, regex/limites do contato em quatro lugares, harness de browser copiado entre `inbox.test.mjs` e `dashboard.test.mjs`, splice do `prompts.mjs` em `worker.mjs` × `seed-content.mjs`.
- Performance: módulos públicos sem ETag/cache (cada visita relê o D1 — já era o item (j)); `run_worker_first: true` manda CSS/vendor do Studio pelo Worker e verifica o JWT RSA por asset; `updateContent` faz três passagens extras no blob; busca do Studio sem debounce; `renderList` do inbox reconstrói a lista a cada clique.
- Arquitetura a observar: `validateArchive` ainda recusa um backup sem alguma das 11 coleções; `/api/contact` exige `Origin === SITE_ORIGIN`, então previews da Vercel e o domínio antigo não arquivam no D1 (Web3Forms segue); throttle global de 10/min e 200/dia; o 403 de origem sai sem cabeçalhos CORS (irrelevante atrás do rewrite same-origin); no inbox, clicar em outra linha enquanto uma escrita está em voo é ignorado sem aviso; as 3 mensagens importadas aparecem como não lidas; `tests/admin/migrations.mjs` só suporta um trigger por arquivo; `cursor.mjs` acoplado a classes do Studio (poderia usar `data-cursor="merge"`); `preview-head.html` carrega `admin.css` em todas as stories; loop de re-hover em `people-persistent-selection` é a terceira cópia do mesmo contorno do Lenis.

## Retomada de 05/09/2026, 16h (Claude Code) — Access configurado, mensagens migradas, deploy pendente

O Codex encerrou às 15:24 (limite de uso) sem registrar que o usuário autorizou o Zero Trust Free (15:21) e entrou no Supabase (15:24). Feito nesta retomada, com token de API de Access fornecido pelo usuário e o resultado da consulta SQL do Supabase colado no chat:

- **Cloudflare Access pronto (via API, 15:38–15:41)**: organização `oktavio.cloudflareaccess.com` (nome "Oktavio Studio", sessão 24h); IdP One-time PIN (`2af6280c-…`); aplicação self-hosted `Studio` (id `b248e553-d8e2-4659-8da5-21ee5d769570`) cobrindo `oktavio-studio.oktavio.workers.dev` em `/admin`, `/admin/*`, `/admin.html`, `/api/admin/*`; policy `Administrador` = allow só `oktavio@gowstudio.pro`. AUD `770041307546001a17307fa6eb407784b9ec1b076b89572853f8ae7e973ae3a6`.
- `wrangler.jsonc` completo: `ACCESS_TEAM_DOMAIN=https://oktavio.cloudflareaccess.com`, `ACCESS_AUD` acima. `node scripts/check-studio-deploy.mjs` responde "Configuração preenchida". `build:worker` ok.
- **Mensagens do Supabase migradas**: `.local/messages.json` (3 linhas, fora do Git) → `scripts/import-supabase-messages.mjs` → `.local/messages-import.sql` → aplicado no D1 **remoto**. Consulta de volta confirma os 3 IDs (`5b9ac9a3…` setup-check de 29/08, "safe to delete"; `e8bf0d11…` e `d5a6cc04…` de oktavio@gowstudio.pro). Supabase intocado.
- **Worker NÃO publicado**: `wrangler deploy` (e `npm run deploy:studio`) foi barrado pelo classificador de permissões do Claude Code, duas vezes; não contornado. Confirmado por API que `workers/scripts` segue vazio. **Próximo passo é o usuário rodar na raiz do projeto:** `npm run deploy:studio` (guard + build + deploy). Depois: `node scripts/verify-studio-production.mjs https://oktavio-studio.oktavio.workers.dev`, login no `/admin` com PIN por e-mail, e então o passo 6 de `docs/studio.md` (`configure-studio-origin.mjs` + commit/PR/merge na `main`).
- Tokens colados no chat (Cloudflare `studio-access`, Supabase access token — este não foi usado): o usuário deve revogá-los depois do deploy.
- Continua tudo sem commit, push ou deploy.

## Retomada de 05/09/2026 (Codex) — estado mais recente

- Claude encerrou o trabalho e o usuário autorizou a continuação. Permanecemos na branch `feat/content-dashboard`, no repositório real, sem commit, push ou deploy.
- **Corrigida a concorrência da caixa de entrada** (`admin/inbox.mjs`): uma ação que interrompe uma busca agora a retoma após sucesso **ou erro** da escrita. Se era paginação, conserva o cursor e as páginas anteriores; se o usuário mudar busca/filtro durante a escrita, consulta apenas a escolha mais recente depois que ela terminar. Respostas canceladas são descartadas mesmo se chegarem depois. Fechar uma mensagem não rouba o foco de uma busca já iniciada pelo usuário.
- **Cobertura**: `tests/admin/inbox-concurrency.test.mjs` acrescenta cinco cenários determinísticos (sucesso, falha, paginação, última busca, desmontagem). A story `MessageInbox` também segura uma resposta antiga durante uma escrita e verifica a recuperação, usando o controlador real e preservando o estado final dos baselines.
- **Validação nesta retomada**: sintaxe dos arquivos alterados, `build:worker`, `build-storybook` e quatro testes de API/banco passaram (`access`, `worker`, `production-access`, `content-transfer`). A story atualizada executou seu `play` completo no navegador do app (`data-play-done=true`, sem erros no console). Também foram exercitados pelo navegador os casos de sucesso/falha durante busca, descarte de resposta tardia, paginação interrompida, retorno de foco e escolha do último filtro durante gravação, em fixture isolada sem mensagens no D1 do usuário.
- **Atualização da validação (05/09, após retomada com execução autorizada fora do sandbox):** `test:admin` **13/13** passou, inclusive os cinco cenários de concorrência novos. `test:ui` completo também passou: Storybook **24/24**, smokes públicos **17/17**, visual **19/19**. Nenhuma baseline mudou. O bloqueio de lançamento do Chromium descrito anteriormente foi resolvido pela execução autorizada fora do sandbox.
- Para os testes de banco neste sandbox, usar `XDG_CONFIG_HOME=/tmp/studio-test-config WRANGLER_LOG_PATH=/tmp/studio-api-tests.log`: o Wrangler tentava escrever seu registro em `~/Library/Preferences/.wrangler/registry`, fora da permissão. Os bancos dos testes continuam temporários (`persist:false`); `.wrangler/state` não foi alterado.
- **Cloudflare remoto:** login Google confirmado no painel e Wrangler autenticado com autorização explícita para `account:read`, `user:read`, `workers:write`, `d1:write` e sessão persistente. Conta `843e0281e05ed362758615a004de933b`; D1 `oktavio-studio`, ID `9c0f040a-6b64-4a1d-9e26-263b0cb2dada`. Ambos os IDs e `ADMIN_EMAIL=oktavio@gowstudio.pro` estão em `wrangler.jsonc`. **Migrations 0001 e 0002 aplicadas e confirmadas no remoto** (5 tabelas contando `d1_migrations`).
- O painel Workers está vazio e mostra o subdomínio **`oktavio.workers.dev`**: o hostname esperado do Studio será **`oktavio-studio.oktavio.workers.dev`**. Ainda não há Worker publicado. Consulta do subdomínio pela API retornou 403 no token limitado; o hostname foi confirmado pelo painel autenticado, sem ampliar os escopos.
- **Access:** Zero Trust ainda não configurado. A revisão automática bloqueou clicar em `Get started` por criar configuração persistente. Foi solicitada autorização explícita ao usuário para criar a organização Free e a aplicação Studio restrita a `oktavio@gowstudio.pro` nos quatro caminhos administrativos; **aguardando resposta**. Não contornar essa aprovação. `ACCESS_TEAM_DOMAIN` e `ACCESS_AUD` continuam vazios.
- **Supabase:** projeto legado `kowjxmdbqlxerctikycm`, organização `design-engineer` (Free). Usuário entrou e retomou o projeto que estava pausado. O painel ainda mostrava `Coming up...` na última leitura; não foi exportada nenhuma mensagem. Próximo passo é ler/exportar `public.messages` quando ficar disponível, guardar em `.local/`, ensaiar/conferir e importar no D1. Nenhum dado Supabase foi apagado.
- Vercel e o site público permanecem intactos. O usuário pediu avançar na migração e colocar no ar com economia de sessão; completar Access e migração antes do corte descrito em `docs/studio.md`.

### Destino dos dez pontos da revisão

| Ponto | Encaminhamento |
| --- | --- |
| (a) Arquivo de contato antes do cutover | Manter o corte conjunto de `mail.js` + quatro rewrites + exclusões estáticas; não publicar o frontend desta branch isolado. Um toggle desligado apenas esconderia a falta do arquivo. Verificação real de uma mensagem no D1 continua obrigatória. |
| (b) Proxy repassar `Origin` | Manter a validação estrita; provar no host real com o verificador e um envio controlado. Depende do cutover, não de liberar novas origens. |
| (c) D1 como fonte de verdade | É a arquitetura do CMS solicitado: após o primeiro save, editar pelo Studio; os arquivos do repositório passam a ser seed. Levar alterações entre ambientes com o transferidor, não sobrescrever D1 no build. |
| (d) `Sec-Fetch-Site` redundante | Manter; o check adicional não remove nem substitui o `Origin`. |
| (e) Senha local padrão | Preservar a autorização do usuário para teste local. O teste de produção passou e o guard mantém `LOCAL_DEV=false`; nunca configurar essa senha no remoto. |
| (f) CSRF na renovação do Access | Manter a renovação única já implementada e testar expiração/login no ambiente real antes do corte. |
| (g) Concorrência do inbox | Corrigida nesta retomada; casos e limites de validação descritos acima. |
| (h) Duplicações de SQL/regex | Adiar refatoração sem mudança de comportamento; não bloqueiam a integração. |
| (i) Plano de execução da paginação | Otimização pendente de medição com volume real; a correção funcional e o desempate por ID já são cobertos. |
| (j) ETag/cache dos módulos | Adiar cache até medir uso; priorizar atualização imediata após saves. Não adicionar cache que possa manter conteúdo excluído publicamente. |

## Sessão de 05/09/2026 (Claude Code) — resultados e pendências

Tudo abaixo está **local, sem commit, push ou deploy**; Vercel e Cloudflare não foram tocados. Leia isto antes de qualquer outra seção deste arquivo.

### Feito e validado

- **Tipografia do Studio**: piso Medium (500) com ênfases em 600; seletor Geist Sans / Mono / Pixel acima do bloco do usuário (`admin/typeface.mjs`; sidebar, rail recolhido com tooltip, topbar no celular); Pixel no 400 nativo com `ELSH` 1 (Square); preferência em `localStorage` restaurada por `admin/theme.js`. Story `Typeface Switcher`, asserções no `tests/admin/dashboard.test.mjs`, baselines `studio-typeface-{light,pixel-dark}` e os três do inbox regenerados e inspecionados.
- **Transferência do acervo**: `cloudflare/content-transfer.mjs` + `scripts/transfer-studio-content.mjs` (export do D1 local ou de um backup; import gera SQL em fatias ≤ 40 KB montadas em `cms_import`, porque o D1 limita cada instrução a 100 KB; modo seguro só preenche banco vazio, `--replace-revision N` termina sempre em N+1). Teste em dois D1 temporários: `tests/admin/content-transfer.test.mjs`. O D1 local **não tem acervo salvo** (0 linhas em `cms_state`, 5 sessões, 0 mensagens): o Studio ainda serve o seed.
- **Produção simulada**: `tests/admin/production-access.test.mjs` — `LOCAL_DEV=false`, chave RSA de teste no lugar do Access; token válido entra, forjado/expirado/`nbf`/outro e-mail/aud/issuer/`alg none`/HS256/`kid` desconhecido/adulterado caem em 401; senha local e cookie não existem; config Access ausente falha fechada; módulos e `/api/contact` públicos sem vazar rascunho; assets do Studio servidos (não 302).
- **Verificador pós-deploy**: `scripts/verify-studio-production.mjs <host>` (só leitura). Rodado hoje contra `oktavio.vercel.app` + host inexistente: 4/32, como esperado antes do cutover (módulos estáticos, `/api/contact` 404).
- **Correções da revisão de código aplicadas**: rewrites da Vercel só disparam sem os arquivos estáticos → `configure-studio-origin.mjs` acrescenta os três módulos ao `.vercelignore`; `access.mjs` renova chaves uma vez em `kid` desconhecido e não cacheia resposta malformada; `admin/app.mjs` fora de localhost mostra "Entrar pelo Cloudflare Access" (reload) em vez do formulário de senha, `login()` uma vez no boot, renova CSRF uma vez num 403 de sessão; marcadores do `prompts.mjs` falham alto no Worker e no build; `check-studio-deploy` lê JSONC; smoke do composer registra o POST same-origin no honeypot; CLI do transferidor recusa flag sem valor e revisão não numérica.
- **Suítes (05/09, fim da sessão)**: `test:admin` 7/7; `test:ui` completo — Storybook 24/24 em 7 arquivos, smoke público 17/17, matriz visual 19/19.
- **Guard**: `node scripts/check-studio-deploy.mjs` recusa por `database_id`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_EMAIL`. `LOCAL_DEV` já é `false`.

### Pendências

1. **Revisões concluídas (10:20, 05/09)**: o `/security-review` (agente independente, leitura completa de Worker, Access, inbox, módulos gerados, scripts e diff de `mail.js`/`script.js`/`wiki.html`) **não encontrou vulnerabilidade de confiança ≥ 0,7** — nenhum achado HIGH ou MEDIUM. Do `/code-review`, todos os bugs claros foram corrigidos (ver "Correções da revisão de código aplicadas" acima); ficaram como **dúvidas para decisão do Otavio**: (a) `mail.js` posta em `/api/contact` sem kill switch — antes do cutover o arquivo D1 falha em silêncio (Web3Forms segue entregando; "Sent" não prova D1); (b) o Worker exige `Origin === SITE_ORIGIN` no contato — depende do proxy da Vercel repassar `Origin` (o verificador prova isso pelo preflight); (c) após o primeiro save no Studio, `content.js`/`portfolio-content.js`/`prompts.mjs` do repositório deixam de ser fonte de verdade (D1 manda) e `CMS_BASE`/`wiki.html` podem divergir — decisão de arquitetura; (d) `Sec-Fetch-Site` redundante com o check de `Origin`; (e) senha padrão `'admin123'` como fallback, só sob `local`; (f) CSRF derivado do JWT muda quando o Access re-emite o token (mitigado com uma renovação automática); (g) `admin/inbox.mjs`: ação disparada durante um `load()` em voo pode deixar a lista vazia até "Atualizar"; (h) duplicações de SQL em `messages.mjs` e do regex de identificador em três lugares (qualidade); (i) cursor de paginação `(created_at < ? OR ...)` não usa o índice composto (desempenho); (j) `/content.js` e irmãos sem ETag/cache — cada visita relê e reserializa o acervo (desempenho).
2. **Cutover** segue o checklist de `docs/studio.md` ("Produção — checklist"), todo dependente do Otavio: login, D1, migrations, Access (team domain, AUD, e-mail), export do Supabase, deploy do Worker, `configure-studio-origin.mjs`, deploy Vercel, `verify-studio-production.mjs`.
3. **Commit**: nada foi commitado nesta branch; 17 arquivos rastreados modificados + os novos untracked. O `CHANGELOG.md` já tem os blocos 2026-09-05 e 2026-09-04 (preâmbulo devolvido ao topo, datas em ISO).

## Onde trabalhar

- Projeto real e fonte de verdade: `/Users/oktavio/Projects/design-engineer`.
- Branch atual: `feat/content-dashboard`.
- As alterações estão locais, sem commit/push/PR/deploy. Há vários arquivos novos não rastreados que são parte da implementação; preserve todos. Não restaurar a branch nem apagar arquivos por estarem untracked.
- Uma cópia antiga existe em `/Users/oktavio/Documents/Codex/2026-09-04/hey-x20/work/dashboard`. **Não editar essa cópia**: o projeto real acima já recebeu e avançou o trabalho.
- Prévia: `http://127.0.0.1:8787/admin`. O Wrangler já estava rodando a partir do projeto real ao preparar este handoff. Verifique a porta antes de iniciar outro processo.
- Login exclusivamente local: usuário `admin`, senha `admin123`. Configuração e restrições em `docs/studio.md`.
- Preserve `.wrangler/state`: contém o banco local e as sessões do usuário. Testes usam bancos temporários separados.

## Tarefa de tipografia — CONCLUÍDA em 05/09/2026 (Claude Code)

Implementada e validada nesta sessão: piso Medium (500) em todo o Studio com ênfases em 600; seletor Geist Sans / Geist Mono / Geist Pixel acima do bloco do usuário (`admin/typeface.mjs`, wired em `admin/sidebar.mjs`, `admin/app.mjs`, `admin/theme.js`, `admin/tooltips.mjs`, `styles/admin.css`, `admin.html`, `.storybook/preview-head.html`); Pixel no 400 nativo com `ELSH` 1 (Square). Story, smoke real e baselines visuais em `stories/admin.stories.js`, `tests/admin/dashboard.test.mjs` e `tests/visual/`. Detalhes em `docs/studio.md`, `docs/design-system.md` e `CHANGELOG.md`. O texto abaixo é o pedido original, mantido como registro.

Último pedido do usuário:

> Quero que todas as fontes sejam no mínimo weight = medium e, em cima de Oktavio/Administrador, um switch para mudar o estilo da fonte para Geist Sans / Geist Mono / Geist Pixel, igual à força do modelo do Codex, usando as cores do nosso DS.

Decisão posterior, **já confirmada pelo usuário**: **preservar o desenho original da Geist Pixel**, sem engrossamento artificial. A Pixel tem peso nativo único 400; essa é a exceção aceita ao mínimo Medium. Sans e Mono devem usar ao menos 500. Não perguntar isso novamente.

O pedido e o levantamento abaixo são **históricos**; a implementação foi concluída pelo Claude conforme o início desta seção. Não refazer a tarefa de tipografia.

Direção de implementação:

1. Restringir o novo peso/família ao dashboard. Reutilizar `--fw-medium`, `--font-sans`, `--font-mono` e `--font-pixel`. Não mudar os tokens globais de forma que altere o portfólio público. Preservar pesos maiores onde houver ênfase.
2. Acima do bloco de usuário da sidebar, colocar um controle com três posições discretas e rótulo da família atual. A referência é o controle de esforço do Codex: trilho arredondado, marcadores e thumb circular, com as cores e motion do nosso DS. Pode usar um popover compacto acionado pelo nome da fonte para caber na sidebar.
3. Aplicar a escolha à interface inteira do Studio, incluindo formulários, editor, tooltip e avisos. Salvar a preferência no navegador; restaurar cedo para evitar flash da fonte padrão.
4. Manter acesso ao seletor com a sidebar recolhida e no celular. Preferir controles nativos, nomes acessíveis, teclado, Escape e retorno de foco. Botões só com ícone usam o tooltip já existente.
5. Sans/Mono carregam fonte variável real; não simular Medium. Pixel mantém desenho/peso original, conforme autorização acima. `docs/design-system.md` descreve o eixo `ELSH` da Pixel; decidir a variante intencionalmente.
6. Conferir fonte realmente carregada, pesos, cortes/overflow, foco, persistência, light/dark, 320px e reduced motion. Adicionar uma story do controlador real e testes do novo estado conforme o contrato do repositório.

Referência anexada pelo usuário para o seletor:
`/var/folders/zh/9qpngjq97417pkj_gnmqb14r0000gn/T/TemporaryItems/NSIRD_screencaptureui_WZ3bXB/Screenshot 2026-09-04 at 11.29.28 PM.png`
O nome real pode conter espaço Unicode antes de PM; procurar pelo prefixo se o caminho não resolver. A imagem mostra um popup branco, nome da opção acima e slider horizontal com posições discretas.

### Arquivos para essa tarefa

- `admin/sidebar.mjs`: markup da sidebar, grupos recolhíveis, bloco `.admin-sidebar-footer` com avatar/nome/logout; `setupSidebar()` controla os estados e devolve cleanup.
- `admin/app.mjs`: shell, editor, login, controle do tema e inicialização de tooltip/sidebar/inbox.
- `admin/theme.js`: execução antecipada no head; avaliar restauração da preferência tipográfica aqui.
- `admin.html`: carrega Geist e Geist Mono variáveis (`100..900`) e Geist Pixel com o eixo `ELSH` variável, conforme a implementação concluída.
- `.storybook/preview-head.html`: já carrega Geist variável, Geist Mono variável e Geist Pixel. Manter famílias/ranges consistentes com o admin.
- `styles/admin.css`: estilos isolados do dashboard; pesos controlados pelas variáveis `--studio-fw-body`/`--studio-fw-strong`, com a exceção nativa da Pixel. Há ajustes responsivos e regras finais que sobrescrevem regras anteriores; inspecionar a cascata antes de alterar.
- `styles/tokens/typography.css`: nomes de família e escala de pesos. `docs/design-system.md`: detalhes de fonte variável e Pixel.
- `admin/tooltips.mjs`: tooltip compartilhando superfície/timing da home, com suporte a popover, hover, foco, Escape e warm traversal.
- `stories/admin.stories.js`: stories reutilizam módulos reais. CSS do admin entra por `<link>` no preview head, **não importar `styles/admin.css` pelo JS da story**, pois o staticDir interfere no MIME do módulo Vite.

## Últimos ajustes concluídos

- Os títulos de grupos “Portfólio”, “Biblioteca” e “Studio” agora usam `--fs-14`, igual aos itens. Conferido no navegador: todos 14px.
- O texto “Your Studio Worskapce” foi removido da fonte, junto com o elemento `#eyebrow` do cabeçalho principal e sua atualização JS. O `margin-top` do H1 passou a zero para eliminar o espaço sobrando.
- As classes `.admin-eyebrow` usadas dentro do editor e na prévia “AO VIVO” continuam existindo; não apagar essas classes indiscriminadamente.
- `tests/admin/dashboard.test.mjs` foi atualizado para verificar a ausência de `#eyebrow` e passou depois da remoção. Assets locais já foram reconstruídos. Uma aba que ainda mostrar o texto antigo precisa recarregar.

## Estado aprovado do design — preservar

- Mesmo DS do portfólio: canvas e sidebar bege `--bg`, grande superfície branca `--white` com raio 32px, dark mode Dim dos tokens existentes.
- Sem linhas divisórias em sidebar, tabelas, cabeçalhos ou cards. Separação por espaço e preenchimentos.
- Cards de 32px; arredondamento completo só em botões, tags e controles/ícones pequenos. Não voltar ao raio gigante dos cards.
- Bandeira ao lado de GOW Design reduzida à metade: SVG 16×20px.
- Nenhuma contagem numérica na sidebar.
- Sidebar recolhe para rail de ícones no desktop, nav compacta no celular; grupos Portfólio/Biblioteca/Studio recolhem independentemente. Preferências persistentes.
- Cursor do portfólio funciona no dashboard e não desaparece sobre inputs. Ele também fica acima dos diálogos nativos. Não remover o craft de hover, sons e tooltip.

## Caixa de entrada concluída

O usuário confirmou que notificações devem ser **apenas mensagens do formulário**, não atividade do dashboard. O item “Mensagens” agora é essa central.

- `admin/inbox.mjs`: lista à esquerda e leitura à direita; indicador não lido, remetente, prévia, tempo, busca, filtros Entrada/Não lidas/Arquivadas, refresh, paginação de 50 itens, leitura automática ao abrir, marcar não lida, marcar todas, arquivar/restaurar, e `mailto:` para resposta.
- Container query em 720px de largura disponível: leitura substitui a lista e tem botão de voltar, com foco restaurado à mensagem. Cards continuam em 32px, sem divisórias.
- `cloudflare/messages.mjs`: consultas paginadas por data + ID, filtros e ações persistentes; integra a autenticação e proteção de origem/CSRF do Worker.
- `cloudflare/migrations/0002_message_inbox.sql`: adiciona `read_at` e `archived_at`, preservando conteúdo. **Já aplicada ao banco local**. Arquivar não exclui registros.
- Banco local da prévia estava sem mensagens reais. Os exemplos usados em testes/stories não foram inseridos nele.
- `tests/admin/inbox.test.mjs`: paginação, persistência, arquivo reversível, foco, falhas de rede, escape de HTML, temas, 320px e manutenção das páginas anteriores ao ler uma mensagem antiga.
- `tests/visual/baselines/studio-inbox-{light,dark,narrow}.png`: três baselines novos inspecionados. Os 14 baselines anteriores foram preservados.
- Bug já corrigido: o clique do leitor não pode ser confundido com clique da lista. Usar `.admin-inbox-row[data-message-id]` no handler, pois o leitor também tem `data-message-id`.

## Dashboard e infraestrutura já implementados

Leia `docs/studio.md` para o mapa completo, comandos e publicação pendente.

- Onze coleções editáveis: projetos, artigos, pessoais, vida, galeria, pessoas, referências, cursos, leituras, fases e prompts.
- Editor de conteúdo estruturado, drafts, prévia, lixeira/restauração, revisão otimista contra saves concorrentes e exportação de backup.
- Worker gera dados públicos dinâmicos; `content-sync.js` sincroniza a wiki sem reescrever seus renderizadores/modais.
- Formulário mantém Web3Forms e arquiva pelo endpoint D1 `/api/contact`; testes interceptam envio externo.
- Admin local só permite senha simples com `LOCAL_DEV=true` e hostname localhost. Produção exige validação do JWT Cloudflare Access; configuração real ainda pendente.
- Histórico do Supabase **importado no D1 remoto em 05/09/2026** (3 mensagens; ver o bloco do topo). Script usado: `scripts/import-supabase-messages.mjs`, fluxo em `docs/studio.md`.
- Produção/Vercel **não foi alterada**. Não criar projeto Vercel novo; não fazer deploy, push ou PR sem o usuário pedir. Campos remotos ainda têm placeholders e o guard de deploy deve recusá-los.

## Como rodar e validar

Antes de levar o projeto ao ar, seguir a seção **Integração de produção: Cloudflare + Supabase + Vercel**, abaixo. Ela registra o que ainda não foi feito e os pontos que exigem validação real entre os serviços.

Na raiz real do projeto:

```bash
npm run build:worker
# Recarregar a aba após mudar CSS/HTML/JS estáticos.
# Se o servidor não estiver rodando:
npm run dev:admin
```

O Wrangler serve `.worker-assets`, não os arquivos estáticos originais diretamente. `build:worker` recria esses assets com allowlist e gera o seed; não publica nada nem sobrescreve o banco local.

Dependências já instaladas. Neste Mac, o Chromium correspondente ao Playwright do projeto está disponível em:

```bash
export PLAYWRIGHT_BROWSERS_PATH=/Users/oktavio/Documents/Codex/2026-09-04/hey-x20/work/playwright
npm run test:admin
npm run build-storybook
npm run test:ui
```

Use esse caminho: o cache global padrão do Playwright teve uma instalação parcial. Não reinstalar browsers à toa nem iniciar instalações paralelas. Ferramentas em sandbox podem precisar de permissão para bind localhost, escrita no repo real e logs/cache do Wrangler/Storybook; isso não é uma falha do aplicativo.

Registro histórico da validação inicial, **superado pelos resultados datados no topo deste documento**:

- `test:admin`: 5 testes passaram.
- `build-storybook`: passou.
- `test:ui`: 23 testes Storybook, 17 testes de UI real e 17 comparações visuais passaram.
- Depois da remoção de `#eyebrow`, o teste específico `node --test tests/admin/dashboard.test.mjs` passou novamente.
- O peso mínimo global e o seletor de fonte foram implementados e validados posteriormente pelo Claude, conforme o topo deste documento.

Para regenerar somente baselines afetados, o runner visual agora aceita `VISUAL_CASES` com nomes separados por vírgula. Exemplo:

```bash
VISUAL_CASES=studio-inbox-light,studio-inbox-dark,studio-inbox-narrow UPDATE_VISUAL_BASELINES=1 npm run test:visual
```

Inspecionar cada imagem nova antes de aceitá-la; alterações de peso/família podem mudar intencionalmente os baselines do Studio, mas não devem alterar baselines do portfólio público. Capturas de testes reais ficam em `artifacts/admin/`, ignorado pelo Git.

## Integração de produção: Cloudflare + Supabase + Vercel

> Registro do handoff de 05/09. A versão mantida, com os comandos exatos e o estado do guard, é **"Produção — checklist" em `docs/studio.md`**; em caso de divergência, vale o doc.

### Estado real neste handoff

- **Implementado e testado localmente:** API Worker, binding D1 local, migrations, autenticação local/validador JWT Access, CRUD e mensagens, script de conversão de export Supabase e script de rewrites Vercel.
- **Ainda não realizado:** criação/configuração de D1 remoto, configuração das policies Access, publicação do Worker, export/import das mensagens reais, rewrites no domínio público, publicação na Vercel e testes ponta a ponta de produção.
- `wrangler.jsonc` ainda tem `database_id` zerado, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` e `ADMIN_EMAIL` vazios. `LOCAL_DEV` está corretamente `false` no arquivo e `SITE_ORIGIN` já está `https://oktavio.vercel.app`.
- `vercel.json` ainda contém somente clean URLs, redirect `/portfolio` e headers. **Nenhum dos quatro rewrites de integração foi configurado.**
- O guard `scripts/check-studio-deploy.mjs` deve falhar enquanto faltarem os campos. Preencher campos não comprova que Access e Vercel foram configurados corretamente; testar os serviços reais é indispensável.
- Este pedido foi para documentar a continuação, **não para executar agora um deploy ou desativar serviços**.

### Topologia pretendida

| Função | URL usada pelo navegador | Destino |
| --- | --- | --- |
| Portfólio, wiki, prompts e páginas públicas | `https://oktavio.vercel.app/…` | Projeto Vercel existente `design-engineer` |
| Contato | `POST https://oktavio.vercel.app/api/contact` | Rewrite para o Worker → D1; Web3Forms continua paralelo no frontend |
| Coleções da wiki | `https://oktavio.vercel.app/content.js` | Rewrite para o Worker, que retorna JavaScript com conteúdo publicado |
| Coleções da home | `https://oktavio.vercel.app/portfolio-content.js` | Rewrite para o Worker, que retorna JavaScript com conteúdo publicado |
| Prompts | `https://oktavio.vercel.app/prompts.mjs` | Rewrite para o Worker, que retorna o módulo com prompts publicados |
| Dashboard | `https://HOST-REAL-DO-STUDIO/admin` | Worker + Cloudflare Access |
| API administrativa | `https://HOST-REAL-DO-STUDIO/api/admin/*` | Worker autenticado → D1 |

O dashboard está planejado em hostname próprio/protegido do Worker, enquanto o público continua em `oktavio.vercel.app`. **Não existe rewrite de `/admin` na Vercel nesta implementação.** Se o usuário quiser o admin no mesmo hostname público, isso é uma mudança de arquitetura: validar cookies, headers/JWT do Access, redirecionamentos e proteção de todas as rotas, sem simplesmente adicionar um proxy irrestrito.

### 1. Confirmar conta, hostname e recursos existentes

Usar a conta Cloudflare do usuário e o projeto Vercel existente. Descobrir se já existe um D1/Worker apropriado antes de criar duplicatas. Confirmar o hostname real para o Studio e o e-mail autorizado no Access; esses dados não estão disponíveis no código.

O arquivo atual habilita `workers_dev` e desabilita preview URLs. Confirmar na conta/documentação vigente como aplicar Access ao hostname escolhido. Se for necessário domínio/subdomínio próprio, configurar isso e atualizar as rotas. Cobrir também qualquer hostname alternativo ativo; não deixar uma entrada paralela menos protegida.

### 2. Criar ou selecionar o D1 remoto e aplicar o esquema

Depois de autenticar na conta certa, usar o banco existente ou criar `oktavio-studio`, registrar seu ID real em `wrangler.jsonc`, preservando binding `DB` e `migrations_dir`.

```bash
# Apenas se o banco ainda não existir:
npx wrangler d1 create oktavio-studio
# Depois de conferir database_id e conta:
npx wrangler d1 migrations apply oktavio-studio --remote
```

Aplicar **0001 e 0002**, incluindo estados de leitura e arquivo. O comando local já executado não prepara o remoto.

**Conteúdo editado no Studio local:** o seed gerado pelo build vem dos arquivos do repositório, não do `.wrangler/state`. Se o usuário quiser publicar mudanças feitas no dashboard local, exportar e revisar esse acervo para importá-lo no `cms_state` remoto, preservando drafts e estrutura. **Existe desde 05/09/2026:** `node scripts/transfer-studio-content.mjs export|import` (biblioteca em `cloudflare/content-transfer.mjs`, teste em `tests/admin/content-transfer.test.mjs`) — ver "Transferir o acervo" em `docs/studio.md`. Não copiar o SQLite inteiro (também contém sessões e tentativas de login). Nunca sobrescrever conteúdo remoto já usado sem conferir e fazer backup.

### 3. Configurar e verificar Cloudflare Access

Configurar a aplicação/policy do Access para `/admin`, `/admin.html`, `/admin/*` e `/api/admin/*` no hostname real. Permitir apenas a identidade/e-mail do administrador. Preencher:

- `ACCESS_TEAM_DOMAIN`: origem HTTPS do time, no formato esperado por `cloudflare/access.mjs`.
- `ACCESS_AUD`: audience da aplicação correta.
- `ADMIN_EMAIL`: e-mail autorizado.
- `LOCAL_DEV`: manter `false` em produção.
- `SITE_ORIGIN`: manter exatamente `https://oktavio.vercel.app`, salvo mudança explícita de domínio.

O Worker valida assinatura RS256, issuer, audience, expiração/validade e e-mail; header `Cf-Access-Authenticated-User-Email` sozinho não concede acesso. Nunca afrouxar isso para fazer um teste passar.

Os quatro endpoints usados pelo site público na tabela acima **não podem exigir login do Access**. Proteger indiscriminadamente o hostname inteiro pode fazer o contato e os módulos JavaScript receberem a tela HTML de login em vez da resposta esperada. Rotas administrativas devem continuar protegidas, inclusive acessadas diretamente pelo hostname do Worker.

### 4. Migrar mensagens Supabase com conferência e corte incremental

1. Exportar a tabela real `public.messages` como lista JSON com `id`, `created_at`, `email`, `message`, `page`. Não há export real neste repositório. Usar acesso autorizado do usuário, guardar o arquivo em `.local/`, fora do Git, e não colocar credenciais de serviço no frontend, logs ou documentação.
2. Conferir contagem, unicidade de IDs, datas e formatos. O conversor rejeita conteúdo fora do formato; resolver casos inválidos sem descartar/truncar silenciosamente mensagens.
3. Gerar SQL e ensaiar em banco local de migração isolado. Não contaminar nem substituir o D1 de uso local do usuário.
4. Fazer backup de eventual D1 remoto já populado e executar a importação no banco remoto correto.

```bash
node scripts/import-supabase-messages.mjs .local/messages.json .local/messages-import.sql
# Após ensaio e conferência do banco de destino:
npx wrangler d1 execute oktavio-studio --remote --file=.local/messages-import.sql
```

O script preserva IDs/datas e usa `INSERT OR IGNORE`. Pode ser reexecutado sem duplicar IDs, mas o número impresso pelo conversor é **linhas preparadas**, não inserções confirmadas. Conferir no D1 a presença de todos os IDs exportados, contagem e campos completos; abrir amostras antigas/recentes na caixa de entrada.

O trigger de limite (10/minuto e 200/dia) é mantido pelo importador. Lotes muito recentes podem encontrar esse limite, inclusive quando ainda faltam registros antigos no arquivo. Ensaiar a ordem cronológica e os lotes; verificar importação parcial e retomar com segurança. Não desativar a proteção de contato no serviço público para contornar isso.

Manter o Supabase ativo durante o corte. Clientes com a versão antiga do frontend ainda aberta podem continuar gravando nele depois do deploy. Fazer export/import incremental posterior com os mesmos IDs e conferir novamente até encerrar essa janela. **Não pausar/apagar o Supabase só porque a primeira importação passou.**

### 5. Publicar e testar o Worker antes de apontar a Vercel

Executar verificações locais, conferir configuração, preparar assets e publicar o Worker no hostname aprovado:

```bash
node scripts/check-studio-deploy.mjs
npm run deploy:studio
```

O comando de deploy só deve ser executado quando o usuário autorizar publicar. Confirmar a policy Access antes de abrir acesso de produção.

Testar no hostname real: login autorizado, rejeição anônima, rejeição de identidade errada/header forjado, navegação e assets do admin, expiração/logout, saves autenticados e bloqueio de escrita sem CSRF/origem válida. Verificar também as rotas públicas diretamente: retornam JavaScript/JSON apropriados, não a tela do Access. Não preencher `ADMIN_PASSWORD=admin123` nem habilitar `LOCAL_DEV` remotamente.

### 6. Conectar o domínio público existente

Depois que o Worker estiver publicado e validado:

```bash
node scripts/configure-studio-origin.mjs https://HOST-REAL-DO-STUDIO
```

Esse script **só edita `vercel.json`**, acrescentando os quatro rewrites da tabela; não faz deploy. Conferir o diff e preservar clean URLs, redirects e headers existentes.

Publicar o frontend e os rewrites juntos no projeto Vercel **`design-engineer`**, vinculado a `oktavio.vercel.app`. `.vercelignore` exclui o admin/arquivos privados; os arquivos públicos e todos os tokens/vendors devem ir juntos conforme `AGENTS.md`.

Não publicar isoladamente `mail.js` modificado antes do rewrite: Web3Forms pode continuar entregando e o usuário ver “Sent”, mas o arquivo D1 falhar silenciosamente. Na implementação atual, “Sent” significa que **pelo menos um** dos dois destinos aceitou a mensagem; isso não é prova de gravação no D1.

O Worker usa `SITE_ORIGIN` para validar `Origin` no contato. Verificar a preservação desse header pelo proxy real da Vercel. Não trocar a validação por `*` ou liberar qualquer origem para contornar erro. Domínios de preview da Vercel não estão automaticamente autorizados: definir uma estratégia de staging restrita, se necessária, sem abrir o endpoint a qualquer origem.

### 7. Critério de pronto e rollback

Validar pelo domínio real `oktavio.vercel.app`, não apenas pela URL direta do Worker:

- `/content.js`, `/portfolio-content.js`, `/prompts.mjs`: status/MIME corretos, sem HTML de login, 404 ou redirecionamento indevido; conteúdo publicado atualiza após salvar no Studio. Conferir cache do CDN na prática.
- Home, wiki, prompts e modais abrem o conteúdo certo, inclusive pessoas/referências vinculadas. Drafts não aparecem publicamente. Exclusão/restauração se reflete nos dados públicos.
- Testar um contato controlado com autorização do usuário para o envio de e-mail real: conferir resposta HTTP de `/api/contact`, linha no D1 e recebimento por Web3Forms separadamente. Conferir que a mensagem aparece no admin e que leitura/arquivo sobrevivem ao reload.
- Não se basear apenas em “Sent”, tela bonita ou guard de config verde para declarar a integração concluída.
- Exportação do admin contém o acervo, lixeira e todas as mensagens/estados. Confrontar o histórico migrado com o Supabase, incluindo o delta durante o corte.
- Admin/API rejeitam acesso não autorizado em todos os hostnames ativos. Dados privados, exports, segredos, `.wrangler` e arquivos de dev não entram nos assets públicos.
- Conferir consumo e limites atuais do plano Cloudflare escolhido antes de encerrar a migração; nenhuma cota futura deve ser assumida a partir deste handoff.

Antes do deploy, registrar versão anterior do frontend/config Vercel e backup dos dados. Se a integração falhar, reverter frontend **e** rewrites de forma coerente, preservando D1 e Supabase para reconciliar mensagens recebidas durante a transição. Não apagar registros nem sobrescrever um banco com backup antigo automaticamente. Desativar o Supabase somente após conferência final e autorização explícita do usuário.

## Forma de trabalhar com o usuário

Conversar em português, avançar com o que já está autorizado e dar atualizações curtas. O usuário está entregando refinamentos visuais em sequência; preservar as decisões anteriores. Não recomeçar o dashboard e não pedir novamente confirmações já registradas aqui.
