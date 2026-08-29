# Mensagens do composer — validação e arquivo no Supabase

O que acontece quando alguém clica no envelope da navbar, digita e envia. O componente em si (markup, dois passos, crossfade do ícone) está descrito no cabeçalho de `mail.js` e em [architecture.md](architecture.md); este doc cobre só o que entrou em 29/08/2026: a validação do e-mail e o arquivo das mensagens.

## Validação do e-mail (29/08/2026)

- **O passo do e-mail deixou de ser pulável.** Até 28/08 a seta avançava com o campo vazio (decisão de 23/08, "quem me mandou" era opcional). Agora `advance()` em `mail.js` roda `validateEmail()` antes de trocar de passo, e `sendMail()` roda de novo antes de postar — se o endereço estiver ruim na hora do envio, volta pro passo do e-mail com o aviso, sem enviar.
- **Regra:** o padrão do WHATWG pra `input[type=email]` (`EMAIL_RE`), com uma exigência a mais — pelo menos um ponto no domínio. Browsers aceitam `nome@gmail`; aqui isso é quase sempre um typo, então não passa. A mesma regex vive no `CHECK` da tabela (abaixo), pra que a validação do browser seja UX e a do banco seja a regra.
- **Como o erro aparece:** uma linha de texto abaixo do campo (`#mailReplyHint`, `role="alert"`, ligada por `aria-describedby`), o textarea recebe `aria-invalid="true"`, e o passo dá um shake horizontal curto (`.composer__step.is-invalid`, ±4px, `--duration-320`; desligado sob `prefers-reduced-motion`). Foco fica no campo. Digitar limpa tudo. Dois textos: `Add your email so I can reply.` (vazio) e `That email doesn't look right.` (malformado).
- **Cor:** `--muted`, não vermelho. A paleta não tem token de "danger" e o site é monocromático de propósito — a frase carrega o significado, o shake carrega o momento. Se um dia entrar um token de erro, é aqui que ele se aplica primeiro.
- **Falha de envio também fala agora.** Antes, Web3Forms respondendo erro virava só um `console.error` e o botão ficava parado. Agora `#mailTextHint` mostra `Couldn't send — try again.` e o passo da mensagem faz o mesmo shake. Só acontece quando *nenhum* dos dois destinos abaixo aceitou.

## Onde a mensagem vai parar

Dois destinos, em paralelo (`Promise.allSettled` em `sendMail()`):

1. **Web3Forms** → e-mail pra `oktavio@gowstudio.pro` (desde 23/08, ver `mail.js`). É o canal primário.
2. **Supabase** → uma linha na tabela `public.messages` (desde 29/08). É a cópia/arquivo — pra reler, contar, exportar, sem depender da caixa de entrada.

"Sent" aparece quando **pelo menos um** dos dois deu certo. Perder a cópia não deve esconder a mensagem que chegou no e-mail, e vice-versa. A falha do outro vai pro console.

### Por que REST direto do browser, sem SDK e sem função serverless

- O site não tem bundler (ver AGENTS.md). `@supabase/supabase-js` precisaria ser vendorizado como o cuelume/Lenis; o insert é um `fetch` de dez linhas (`POST {URL}/rest/v1/messages`, headers `apikey` + `Authorization: Bearer` + `Prefer: return=minimal`), então o SDK não paga o peso.
- Uma função em `api/` na Vercel esconderia a chave, mas quebraria o fluxo de teste local (`python3 -m http.server` não roda função) e exigiria env vars no projeto. A chave **anon** é pública por desenho — o que ela consegue fazer é limitado pelo RLS, não pelo segredo.
- **RLS é o que segura:** `anon` só tem `INSERT`. Não existe policy de `SELECT`, então a chave que está no `mail.js` não lê nada de volta — nem a própria linha que acabou de inserir. Ler é no dashboard (Table Editor) ou com a service role key, que **nunca** entra no repositório.

### Setup (feito em 29/08/2026)

Projeto `kowjxmdbqlxerctikycm` (`https://kowjxmdbqlxerctikycm.supabase.co`), [`supabase/schema.sql`](../supabase/schema.sql) rodado no SQL Editor, e as duas constantes no topo de `mail.js` preenchidas com a Project URL e a chave **publishable** (`sb_publishable_…`, o formato novo que substitui a `anon` JWT — a API aceita as duas nos mesmos headers `apikey` + `Authorization: Bearer`; ficou a nova). Ler as mensagens: **Table Editor → messages** no dashboard.

Pra recriar do zero (projeto novo): **New project** → **SQL Editor → New query**, colar o `schema.sql` inteiro, **Run** (idempotente) → **Project Settings → API Keys**, copiar Project URL + publishable key pras constantes. Pra desligar o arquivo sem tirar código: esvaziar qualquer uma das duas constantes — `sendMail()` pula o insert e o envio segue só pelo Web3Forms.

### Esquema

| coluna       | tipo          | nota                                                     |
| ------------ | ------------- | -------------------------------------------------------- |
| `id`         | `uuid`        | `gen_random_uuid()`                                      |
| `created_at` | `timestamptz` | `now()`                                                  |
| `email`      | `text`        | `CHECK` com a mesma regex do `EMAIL_RE`, ≤ 254 chars     |
| `message`    | `text`        | 1–5000 chars depois de `btrim`                           |
| `page`       | `text`        | `location.pathname` de onde foi enviada (`/`, `/wiki`…)  |

Não guarda user agent, IP nem nada além disso — é um formulário de contato, não analytics.

## Testes

- `tests/ui/mail-composer.test.mjs` (`npm run test:product-ui`) roda o fluxo real na home: seta com campo vazio → aviso + `aria-invalid`; `nome@gmail` → aviso de formato; endereço válido → avança; envia com Web3Forms e Supabase interceptados e confere o corpo do `POST /rest/v1/messages`; axe no estado inválido. O teste troca `SUPABASE_URL`/`SUPABASE_ANON_KEY` por valores de mentira reescrevendo `mail.js` na rota, pra nunca gravar na tabela de produção.
- `stories/patterns.stories.js` → *Mail composer · email validation* espelha o markup do passo do e-mail com o hint visível, pra fixar o CSS e a baseline de acessibilidade do estado inválido (mesma abordagem da story do ⌘K: o markup é espelhado, o controlador de validação é uma cópia de três linhas).
