# Studio — dashboard de conteúdo

Implementação local na branch `feat/content-dashboard`. O portfólio continua estático na Vercel; o Studio e o arquivo de mensagens usam um Worker com Cloudflare D1. A infraestrutura de produção e a importação das mensagens históricas ainda precisam ser configuradas e validadas antes do deploy.

## Testar localmente

Requer Node 22.12+ e as dependências de desenvolvimento:

```bash
npm ci
npm run dev:admin
```

Abra `http://127.0.0.1:8787/admin`: usuário `admin`, senha `admin123`. Essa senha funciona somente com `LOCAL_DEV=true` em localhost. O comando aplica as migrations ao D1 local, prepara os assets e inicia o Wrangler. O portfólio em `http://127.0.0.1:8787/` usa esse mesmo conteúdo.

Dados persistem em `.wrangler/state`, ignorado pelo Git. Testes usam bancos temporários separados e interceptam Web3Forms; não enviam mensagens reais. Após editar HTML, CSS ou JS estáticos com o servidor aberto, rode `npm run build:worker` e recarregue a página.

```bash
npm run test:admin
npm run build-storybook
npm run test:ui
```

## Conteúdo e interação

- Onze coleções: projetos, artigos, pessoais, vida, galeria, pessoas, referências, cursos, leituras, fases e prompts. A primeira leitura usa o conteúdo atual do repositório como seed, sem sobrescrever um D1 já inicializado.
- Editor nativo com campos aninhados, links, seções, pessoas e subprojetos. Identificadores permanecem estáveis. Novos conteúdos começam como rascunho; somente os visíveis entram nas páginas públicas.
- Exclusões vão para a lixeira e podem ser restauradas. O editor avisa sobre alterações não salvas; revisões do banco impedem que uma aba sobrescreva silenciosamente o trabalho de outra.
- Mensagens é uma caixa de entrada dedicada ao formulário de contato. Lista e leitura dividem a superfície no desktop; abaixo de 720px de largura disponível, a leitura ocupa a área da lista, com retorno e restauração do foco. Remetente, prévia, horário e indicador de não lida seguem o DS existente.
- Abrir uma mensagem registra a leitura no D1. É possível marcar como não lida, marcar toda a entrada como lida, arquivar e recuperar. Busca por e-mail ou texto, filtros Entrada/Não lidas/Arquivadas, atualização manual e paginação de 50 mensagens com cursor por data + ID. As mensagens antigas continuam acessíveis por “Carregar mais”. Exportar backup inclui todo o acervo, a lixeira e todas as mensagens, com estados de leitura e arquivo.
- A sidebar recolhe para uma coluna de ícones no desktop e esconde a navegação horizontal no celular. Preferências independentes são salvas em localStorage. Os grupos Portfólio, Biblioteca e Studio também recolhem independentemente, com estado salvo e sem contagens no menu. Botões mantêm nomes acessíveis; o controle anuncia seu estado e funciona por teclado.
- Tipografia (05/09/2026): nada no Studio fica abaixo de Medium — corpo, rótulos e números em 500 pelas fontes variáveis reais (`admin.html` pede `wght@100..900` para Geist e Geist Mono), e o que antes marcava ênfase com 500 sobre 400 sobe para 600. Acima do bloco do usuário na sidebar, um seletor de família com três posições (Geist Sans / Geist Mono / Geist Pixel) no modelo do controle de esforço do Codex: gatilho com o nome da família atual, popover em vidro com o nome, uma nota e um `input type=range` com marcadores e thumb circular; no rail recolhido vira ícone com tooltip e no celular migra para o topbar. Setas/Home/End trocam, Escape fecha e devolve o foco; a escolha fica em `localStorage` (`studio.typeface`) e `admin/theme.js` a restaura no `<head>` antes da primeira pintura. Geist Pixel é a exceção aceita ao piso: peso nativo único 400, sem negrito sintético, e eixo `ELSH` fixado em 1 (Square) — ver `docs/design-system.md`. Só o dashboard muda; os tokens globais e o portfólio público ficam como estão.
- Mesmo DS do portfólio: fundo externo e sidebar `--bg`, superfície principal `--white`, cards com `--radius-32`; botões, tags e controles compactos com `--radius-full`. Sem linhas divisórias. Hover, cursor e sons compartilham os componentes existentes. O cursor continua visível sobre inputs e acima dos diálogos nativos. Tooltips em controles de ícone compartilham o visual e os tokens de entrada/saída do gráfico de contribuições, aparecem por hover ou foco e fecham com Escape.

## Arquitetura

`admin.html`, `admin/*.mjs` e `styles/admin.css` compõem a interface. `cloudflare/worker.mjs` serve a API, os assets e os módulos públicos de conteúdo; `cloudflare/access.mjs` valida a identidade. `cloudflare/migrations` contém o esquema D1.

O acervo fica em uma linha JSON com revisão transacional em `cms_state` (limite de aplicação de 1,5 MB). Mensagens, sessões locais e tentativas de login ficam em tabelas separadas. O limite do acervo inclui lixeira e histórico; amplie o modelo antes de atingir esse tamanho. Imagens são URLs/caminhos, não uploads binários.

`admin/inbox.mjs` é o controlador compartilhado com a story da caixa de entrada. `cloudflare/messages.mjs` concentra consultas e ações de mensagens, sempre atrás da autenticação e proteção de origem/CSRF do Worker. A migration `0002_message_inbox.sql` adiciona `read_at` e `archived_at` sem alterar o conteúdo existente; mensagens históricas começam como não lidas. Arquivamento não exclui registros. “Responder por e-mail” abre o aplicativo de e-mail do administrador via `mailto:`.

`content-sync.js` sincroniza a lista HTML da wiki com os dados dinâmicos antes de `script.js`. Sem `CMS_BASE`, a versão estática permanece como hoje. O Worker gera `content.js`, `portfolio-content.js` e `prompts.mjs` com os conteúdos visíveis; os renderizadores públicos e seus modais são mantidos.

## Produção — checklist (etapa pendente)

A URL `/admin` não é um segredo. O acesso deve ser restringido pelo Cloudflare Access e novamente validado no Worker, por assinatura RS256, issuer, audience, validade e e-mail autorizado (`cloudflare/access.mjs`). Headers de identidade sem assinatura válida não concedem acesso. A senha simples nunca habilita login em um hostname público.

Estado em 05/09/2026, fim do dia: **no ar.** Worker `oktavio-studio` publicado em `https://oktavio-studio.oktavio.workers.dev`, D1 remoto com as duas migrations e as 3 mensagens do Supabase importadas, Cloudflare Access ativo (organização própria, IdP One-time PIN, aplicação cobrindo os quatro caminhos administrativos, policy com um único e-mail), `vercel.json` com os quatro rewrites e os três módulos fora do deploy estático (PR #89). Verificador 32/32 pelo domínio público e pelo Worker; um envio controlado pelo `/api/contact` de `oktavio.vercel.app` chegou ao D1. Os IDs de conta, banco e aplicação ficam no `wrangler.jsonc` (o que o deploy precisa) e no painel; não os repita aqui. Lições do dia: o `wrangler login` precisa dos escopos padrão (um login limitado a `workers:write`/`d1:write` não publica: "Authentication error" em `/workers/subdomain`); um `workers.dev` novo leva cerca de um minuto pra responder depois do primeiro deploy. Os passos abaixo continuam como procedimento de referência para recriar o ambiente; não repita o que já existe.

### 1. Conta e hostname **(você)**

```bash
npx wrangler login
npx wrangler whoami          # confirma a conta; anote o subdomínio *.workers.dev
```

O Worker se chama `oktavio-studio` e `workers_dev: true` publica em `https://oktavio-studio.<subdomínio>.workers.dev`. Esse é o **hostname do Studio** usado nos passos 3 e 5 (ou um domínio próprio, se preferir — aí é ele que entra no Access e nas rotas). Confira em Workers & Pages se já existe um Worker ou D1 com esse nome antes de criar duplicatas.

### 2. D1 remoto **(você)**

```bash
npx wrangler d1 create oktavio-studio
```

A saída traz `database_id = "xxxxxxxx-xxxx-…"`. Copie esse UUID para `wrangler.jsonc` → `d1_databases[0].database_id` (mantendo `binding: "DB"`, `database_name` e `migrations_dir`). Depois:

```bash
npx wrangler d1 migrations apply oktavio-studio --remote
```

Isso aplica `0001_studio.sql` e `0002_message_inbox.sql` (estados de leitura e arquivo). O `--local` já executado pelo `dev:admin` não prepara o remoto.

### 3. Cloudflare Access **(você)**

No painel Zero Trust (`one.dash.cloudflare.com`):

1. **Settings → Custom Pages → Team domain**: anote `<time>.cloudflareaccess.com`. Em `wrangler.jsonc`, `ACCESS_TEAM_DOMAIN` = `https://<time>.cloudflareaccess.com` — exatamente assim, minúsculas, sem barra final (o Worker valida com a regex `^https://[a-z0-9-]+\.cloudflareaccess\.com$`).
2. **Access → Applications → Add an application → Self-hosted**. Nome: `Studio`. Em *Application domain*, adicione o hostname do passo 1 **com caminho**, uma entrada por caminho: `/admin`, `/admin/*`, `/admin.html` e `/api/admin/*`. Não adicione o hostname sem caminho: `/api/contact`, `/content.js`, `/portfolio-content.js` e `/prompts.mjs` precisam continuar públicos, senão o site recebe a tela de login no lugar do JavaScript.
3. **Policy**: nome `Administrador`, ação *Allow*, regra *Include → Emails* com o seu e-mail. Identity provider: pelo menos *One-time PIN*. Duração de sessão a seu critério (o logout do Studio redireciona para `/cdn-cgi/access/logout`).
4. Salve e abra a aplicação → **Overview → Application Audience (AUD) Tag**. Esse hash é `ACCESS_AUD`.
5. `ADMIN_EMAIL` = o mesmo e-mail da policy (a comparação é sem distinção de maiúsculas).

Preencha os três campos em `wrangler.jsonc` → `vars`. `LOCAL_DEV` fica `"false"`. Nunca defina `ADMIN_PASSWORD` no remoto.

```bash
node scripts/check-studio-deploy.mjs   # deve responder "Configuração preenchida…"
```

O guard só confere que os campos existem; não prova que a policy está certa. O teste real é o passo 5.

### 4. Acervo e mensagens

- **Acervo do Studio local**: o seed do build vem dos arquivos do repositório, não do que você editou no dashboard. Se quiser levar o acervo local, use a seção **Transferir o acervo** abaixo (exportar → conferir → SQL → aplicar no remoto). Se preferir começar do seed, não faça nada: o primeiro save no remoto grava o seed.
- **Mensagens do Supabase**: seção **Migrar mensagens do Supabase** abaixo, com o export feito por você.

### 5. Publicar e testar o Worker **(você autoriza)**

```bash
npm run deploy:studio        # check-studio-deploy + build:worker + wrangler deploy
```

No hostname real: login com o e-mail autorizado abre o Studio; janela anônima recebe a tela do Access; `curl -I https://HOST/api/admin/content` responde 401 (não 200); `curl https://HOST/content.js`, `/portfolio-content.js`, `/prompts.mjs` devolvem JavaScript, não HTML; `curl -X POST https://HOST/api/contact` sem `Origin` válido responde 403. Salvar um conteúdo no Studio e ver `/portfolio-content.js` mudar fecha o ciclo.

### 6. Ligar o domínio público **(você autoriza)**

```bash
node scripts/configure-studio-origin.mjs https://HOST-REAL-DO-STUDIO   # só edita vercel.json
```

Confira o diff: quatro rewrites em `vercel.json` (`/api/contact`, `/content.js`, `/portfolio-content.js`, `/prompts.mjs`; clean URLs, redirect e headers preservados) **e** os três módulos acrescentados ao `.vercelignore` — a Vercel responde do filesystem antes de olhar os rewrites, então enquanto os arquivos estáticos subirem o Worker nunca é chamado. Os arquivos continuam no repositório (seed do build e `dev:admin`) e publique **no projeto Vercel existente `design-engineer`** com todos os arquivos públicos juntos (`AGENTS.md`). `.vercelignore` já exclui o dashboard. Não publicar o `mail.js` novo antes do rewrite de `/api/contact`: o e-mail continua chegando por Web3Forms, mas o arquivo D1 falharia em silêncio.

### 7. Pronto e rollback

```bash
node scripts/verify-studio-production.mjs https://HOST-REAL-DO-STUDIO   # só leitura; sai com 1 se algo falhar
```

O script confere, pelo domínio público e pelo host do Worker: MIME dos três módulos e ausência de HTML (404 da Vercel, login do Access) neles, público e Worker servindo o mesmo módulo (prova o rewrite), 401/redirect do Access em `/admin` e `/api/admin/*` anônimos e com header de e-mail forjado, 403 em `/api/contact` sem `Origin` válido (404 no público = rewrite ausente) e o preflight ecoando a origem pública (prova que o proxy da Vercel repassa `Origin`). Rodado em 05/09 contra o domínio atual: os módulos estáticos ainda respondem e `/api/contact` dá 404, como esperado antes do cutover.


Validar pelo `oktavio.vercel.app`: módulos públicos com MIME certo e sem HTML de login; drafts fora do público; um contato controlado aparece na caixa de entrada; export do admin traz acervo, lixeira e mensagens; admin/API rejeitam acesso anônimo em todos os hostnames. Antes do deploy, guardar a versão anterior do frontend/`vercel.json` e um backup (`/api/admin/export`). Reverter frontend **e** rewrites juntos se falhar; nunca apagar D1 nem Supabase durante a transição.


## Pendências pós-corte (do code review de 05/09/2026)

Revisão em oito ângulos sobre a árvore inteira antes do merge; os bugs claros foram corrigidos no próprio PR #89 (sanitização dos itens de fase em `content-sync.js`, `script.js` tolerando `/content.js` ausente, campo `prompt` fora da checagem de tags, boot do Studio mostrando erro em vez de travar, `stateFrom()` completando coleções novas com o seed). O que ficou, sem mudança de comportamento:

- **Duplicações**: engine de tooltip (`admin/tooltips.mjs` × `contrib.mjs`); toggle de tema (`admin/app.mjs` × `chrome.js`) e bootstrap de tema (`admin/theme.js` × as quatro páginas); `fail()` em três módulos do Worker; regex/limites do contato em quatro lugares; harness de browser copiado entre `inbox.test.mjs` e `dashboard.test.mjs`; splice do `prompts.mjs` em `worker.mjs` × `seed-content.mjs`.
- **Performance**: módulos públicos sem ETag/cache (cada visita relê o D1); `run_worker_first: true` manda CSS/vendor do Studio pelo Worker e verifica o JWT por asset; `updateContent` faz três passagens extras no blob; busca do Studio sem debounce; `renderList` do inbox reconstrói a lista a cada clique.
- **Arquitetura a observar**: `validateArchive` recusa um backup sem alguma das onze coleções; `/api/contact` exige `Origin === SITE_ORIGIN`, então previews da Vercel e o domínio antigo não arquivam no D1 (Web3Forms segue entregando); throttle global de 10/min e 200/dia; o 403 de origem sai sem CORS (irrelevante atrás do rewrite same-origin); no inbox, clicar em outra linha com uma escrita em voo é ignorado sem aviso; `tests/admin/migrations.mjs` só suporta um trigger por arquivo; `cursor.mjs` acoplado a classes do Studio (poderia usar `data-cursor="merge"`); `preview-head.html` carrega `admin.css` em todas as stories; o build sobe `.DS_Store` como asset (excluir em `scripts/build-worker.mjs`).
- **Operação**: pausar o projeto Supabase legado (chave publishable ainda no histórico do Git, só insere); restringir a chave do Web3Forms ao domínio no painel; as 3 mensagens importadas aparecem como não lidas.

## Transferir o acervo do Studio local

O acervo é uma linha só (`cms_state`: coleções, lixeira, atividade, revisão). `scripts/transfer-studio-content.mjs` e `cloudflare/content-transfer.mjs` (05/09/2026) movem essa linha sem copiar o SQLite, que também guarda sessões e tentativas de login.

```bash
node scripts/transfer-studio-content.mjs export .local/acervo.json                 # lê o D1 local (.wrangler/state), só leitura
node scripts/transfer-studio-content.mjs export .local/acervo.json --from-backup ~/Downloads/portfolio-backup.json   # ou a partir do "Exportar backup" do dashboard
node scripts/transfer-studio-content.mjs import .local/acervo.json .local/acervo-import.sql
npx wrangler d1 execute oktavio-studio --remote --file=.local/acervo-import.sql     # (você) depois do passo 2 do checklist
```

- Tudo passa por `validateArchive()`: as mesmas regras por conteúdo que o Worker aplica ao salvar, mais a forma da linha (11 coleções, identificadores, `slug` dos prompts, lixeira, até 100 atividades, limite de 1,5 MB). Drafts, identificadores e lixeira são preservados exatamente; de um backup, só `messages` é descartado.
- O SQL gerado é **uma** instrução idempotente. Sem flag, só preenche um banco vazio (`ON CONFLICT DO NOTHING`): um remoto já em uso fica intacto. Com `--replace-revision N`, substitui a linha apenas enquanto a revisão remota ainda for `N` e a avança para `N+1` — a mesma trava otimista das abas do Studio. O arquivo termina com `SELECT revision, length(data)`; o CLI diz qual revisão esperar, então `changes = 0`/revisão inalterada significa que nada foi gravado.
- Para saber a revisão remota antes de substituir: `npx wrangler d1 execute oktavio-studio --remote --command "SELECT revision, length(data) AS bytes FROM cms_state WHERE id = 1"`. Faça backup do remoto (`/api/admin/export`) antes de qualquer `--replace-revision`.
- `tests/admin/content-transfer.test.mjs` cobre o ciclo em dois D1 temporários: export fiel (drafts, lixeira, revisão), import em banco vazio servido pelo Worker com draft fora do público, recusa de sobrescrever, trava de revisão errada/certa, revisão continuando a avançar depois, arquivos inválidos e o CLI de ponta a ponta.

## Migrar mensagens do Supabase

Nenhum histórico remoto foi importado ainda. Exporte a tabela `public.messages` como uma lista JSON contendo `id`, `created_at`, `email`, `message` e `page`. Guarde o arquivo em `.local/`, nunca no Git. Dois caminhos, ambos **(você)**, porque exigem o painel ou a chave `service_role` do projeto (a chave `anon` do `mail.js` só insere, por RLS):

- **SQL Editor do Supabase**: rode `select json_agg(m order by m.created_at) from public.messages m;`, copie o valor da única célula e salve como `.local/messages.json`. Confira que começa com `[` e que `select count(*) from public.messages;` bate com o número de itens.
- **REST, da sua máquina**: `curl "https://<projeto>.supabase.co/rest/v1/messages?select=id,created_at,email,message,page&order=created_at.asc" -H "apikey: <service_role>" -H "Authorization: Bearer <service_role>" -o .local/messages.json`. A chave fica só no terminal; não entra em arquivo, log nem no frontend.

O conversor abaixo rejeita linhas fora do formato (UUID, data válida, e-mail ≤ 254, mensagem 1–5000, página ≤ 200) em vez de descartá-las em silêncio.

```bash
node scripts/import-supabase-messages.mjs .local/messages.json .local/messages-import.sql
npx wrangler d1 execute oktavio-studio --local --file=.local/messages-import.sql
```

O script preserva IDs e datas e produz `INSERT OR IGNORE`; execuções repetidas não duplicam IDs. Conferir o número de registros e os IDs do JSON contra o banco de destino. O trigger de limite permanece ativo: lotes muito recentes podem exigir intervalo entre execuções. Depois da verificação local, a importação remota usa o mesmo arquivo e `--remote` no lugar de `--local`, na etapa de publicação autorizada.

Não remover o banco de origem antes de conferir o histórico e testar um novo envio ponta a ponta. `supabase/schema.sql` permanece no repositório como referência do legado; nenhuma chave Supabase é necessária no novo frontend.
