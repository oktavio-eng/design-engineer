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

## Segurança (29/08/2026)

O que protege o quê — em ordem de importância:

1. **2FA na conta do Supabase e do GitHub.** A chave no `mail.js` só insere; quem lê tudo é quem entra na sua conta. Não dá pra fazer por código — Supabase: *Account → Security*; GitHub: *Settings → Password and authentication*.
2. **RLS insert-only** (acima). A `service_role` nunca entra no repositório; se um dia precisar ler a tabela por código, é função serverless com env var.
3. **Throttle no banco** (`messages_throttle`, trigger `before insert` em `schema.sql`): mais de 10 linhas no último minuto ou 200 no último dia → insert recusado. Global, não por IP (o PostgREST não entrega o IP do cliente pro trigger de forma confiável). Protege a cota do plano free contra um loop com a chave pública. A função é `security definer` porque `anon` não tem `SELECT` pra fazer o `count`.
4. **Honeypot** (`#mailTrap` em `mail.js`): input de texto fora da tela (não `display:none` — bot pula campo que não renderiza), `tabindex="-1"` + `aria-hidden`. Preenchido → `sendMail()` não posta nada e toca a coreografia de "sent" mesmo assim, pra o bot não ter o que adaptar. Se spam humano/serviço passar por isso, o próximo degrau é Cloudflare Turnstile (o Web3Forms tem suporte nativo).
5. **`maxlength`** 254 / 5000 nos dois campos, espelhando os `CHECK`s — a mensagem longa demais para no teclado, não num `400` que a folha nunca mostraria (o Web3Forms aceitaria e a linha sumiria em silêncio).
6. **Headers** em `vercel.json`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (ninguém embute o site num iframe pra clickjacking), `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` desligando câmera/microfone/geolocalização/pagamento/USB. HSTS a Vercel já manda. **Sem CSP** de propósito: cada página tem um `<script>` inline (o anti-flash do tema) — nonce não existe em site estático e hash quebraria a cada edição do trecho; fica pra quando/se esse script virar arquivo.
7. **Transparência (LGPD art. 9):** "Used only to reply." no passo do e-mail, no mesmo slot `.composer__to` que o passo da mensagem usa pro endereço — mas em `--muted`, não `--faint` (`.composer__note`): o axe do Storybook barrou o contraste, e uma frase que a pessoa tem direito de ler não pode ser decorativa. Não é banner de cookie — o site não tem cookie nem analytics; `localStorage` de tema/painel/intro é armazenamento funcional e não pede consentimento.
8. **Retenção** é decisão, não código: apague as linhas depois de responder (ou a cada 6 meses). Se quiser automatizar, `pg_cron` no Supabase com `delete from messages where created_at < now() - interval '180 days'` — não está no `schema.sql` porque apagar mensagem é escolha sua.
9. **XSS não existe hoje** porque as mensagens só aparecem no dashboard. No dia em que forem renderizadas numa página, escapar HTML vira obrigatório.

Mudou o `schema.sql`? Rode ele de novo no SQL Editor — é idempotente (`create or replace` / `drop … if exists`).

## Testes

- `tests/ui/mail-composer.test.mjs` (`npm run test:product-ui`) roda o fluxo real na home: seta com campo vazio → aviso + `aria-invalid`; `nome@gmail` → aviso de formato; endereço válido → avança; envia com Web3Forms e Supabase interceptados e confere o corpo do `POST /rest/v1/messages`; axe no estado inválido. O teste troca `SUPABASE_URL`/`SUPABASE_ANON_KEY` por valores de mentira reescrevendo `mail.js` na rota, pra nunca gravar na tabela de produção. Cobre também a linha de transparência, os `maxlength`, o honeypot fora do Tab/AT e o envio com honeypot preenchido (zero requests, estado "sent" mesmo assim).
- `stories/patterns.stories.js` → *Mail composer · email validation* espelha o markup do passo do e-mail com o hint visível, pra fixar o CSS e a baseline de acessibilidade do estado inválido (mesma abordagem da story do ⌘K: o markup é espelhado, o controlador de validação é uma cópia de três linhas).
