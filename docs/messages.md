# Mensagens do composer — validação e arquivo no D1

O que acontece quando alguém clica no envelope da navbar, digita e envia. O componente em si (markup, dois passos, crossfade do ícone) está descrito no cabeçalho de `mail.js` e em [architecture.md](architecture.md); este doc cobre só o que entrou em 29/08/2026: a validação do e-mail e o arquivo das mensagens.

## Validação do e-mail (29/08/2026)

- **O passo do e-mail deixou de ser pulável.** Até 28/08 a seta avançava com o campo vazio (decisão de 23/08, "quem me mandou" era opcional). Agora `advance()` em `mail.js` roda `validateEmail()` antes de trocar de passo, e `sendMail()` roda de novo antes de postar — se o endereço estiver ruim na hora do envio, volta pro passo do e-mail com o aviso, sem enviar.
- **Regra:** o padrão do WHATWG pra `input[type=email]` (`EMAIL_RE`), com uma exigência a mais — pelo menos um ponto no domínio. Browsers aceitam `nome@gmail`; aqui isso é quase sempre um typo, então não passa. A mesma regex é validada novamente no Worker, pra que a validação do browser seja UX e a do banco seja a regra.
- **Como o erro aparece:** uma linha de texto abaixo do campo (`#mailReplyHint`, `role="alert"`, ligada por `aria-describedby`), o textarea recebe `aria-invalid="true"`, e o passo dá um shake horizontal curto (`.composer__step.is-invalid`, ±4px, `--duration-320`; desligado sob `prefers-reduced-motion`). Foco fica no campo. Digitar limpa tudo. Dois textos: `Add your email so I can reply.` (vazio) e `That email doesn't look right.` (malformado).
- **Cor:** `--muted`, não vermelho. A paleta não tem token de "danger" e o site é monocromático de propósito — a frase carrega o significado, o shake carrega o momento. Se um dia entrar um token de erro, é aqui que ele se aplica primeiro.
- **Falha de envio também fala agora.** Antes, Web3Forms respondendo erro virava só um `console.error` e o botão ficava parado. Agora `#mailTextHint` mostra `Couldn't send — try again.` e o passo da mensagem faz o mesmo shake. Só acontece quando *nenhum* dos dois destinos abaixo aceitou.

## Onde a mensagem vai parar

Dois destinos em paralelo (`Promise.allSettled` em `sendMail()`):

1. Web3Forms entrega o e-mail no endereço já configurado.
2. `POST /api/contact` arquiva no D1, através do Worker. O navegador não recebe credenciais do banco.

“Sent” aparece quando pelo menos um destino aceita a mensagem. Se ambos falharem, o composer preserva os campos e mostra o erro. O desenho, os estados e as animações do composer permanecem os mesmos.

A integração D1 está implementada e disponível no servidor local. A troca em produção depende do Worker e do rewrite `/api/contact`. O histórico do Supabase (3 mensagens de 29/08/2026) foi importado no D1 remoto em 05/09/2026, com IDs e datas preservados; o Supabase não foi apagado. Consulte [studio.md](studio.md) para setup, limites, autenticação, testes e ordem de migração.

## Validação e armazenamento

O Worker valida tipo/tamanho do JSON, origem permitida, e-mail, mensagem (1–5000 caracteres), página de origem e honeypot. O D1 mantém o limite global anterior de 10 mensagens por minuto e 200 por dia. Nenhum IP ou user agent é armazenado nas mensagens.

Campos recebidos: `id` (UUID), `created_at` (data UTC), `email`, `message` e `page`. A leitura exige autenticação administrativa; o endpoint público só recebe mensagens. Estados de leitura e arquivamento e a caixa de entrada estão descritos em [studio.md](studio.md). O dashboard escapa o conteúdo antes de exibi-lo. A frase “Used only to reply.” e os limites dos campos permanecem no composer.

A retenção continua manual. A migração não apaga dados do Supabase; `supabase/schema.sql` documenta a estrutura anterior.

## Testes

`tests/ui/mail-composer.test.mjs` verifica e-mail vazio/malformado, envio, falha dos dois destinos, honeypot, foco e acessibilidade com Web3Forms e `/api/contact` interceptados. `tests/admin/worker.test.mjs` verifica o arquivo real em D1 temporário, validação e throttle, sem serviços remotos. A story de validação do composer mantém os estados visuais existentes.
