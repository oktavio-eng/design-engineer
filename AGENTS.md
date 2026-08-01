# AGENTS.md — Design Engineer Wiki

Contexto para qualquer agente de IA (Cursor, Claude Code, etc.) que for editar este repositório. Leia isto antes de mexer no `index.html`.

## O que é este projeto

Um site pessoal single-page do Otavio (GOW Studio) — um "plano de transição de carreira" pra design engineer, com estudo de referências (Rauno Freiberg, Emil Kowalski, Jakub Krehel, floguo, Paco Coursey, shadcn, etc.), cursos, leituras e craft references. Também funciona como prova pública de trabalho (portfolio > diploma).

- **Stack:** um único `index.html` (HTML + CSS + JS inline, zero build step no runtime).
- **Deploy:** Vercel, projeto **`design-engineer`** (team ID `team_mMftBNlEUa18031DuM84fBHt`). **NUNCA crie um projeto novo na Vercel — sempre atualize o existente.**
- **URL de produção:** `design-engineer-phi.vercel.app`
- **Repo:** conectado ao GitHub (`oktavio-eng/design-engineer`) — push na `main` dispara deploy automático.

## Regras inegociáveis

1. **Nunca crie um novo projeto Vercel.** Sempre atualize o `design-engineer` existente.
2. **`favicon.svg` sempre acompanha `index.html`** em qualquer deploy — esquecer ele faz o favicon sumir.
3. **Antes de qualquer deploy/commit**, valide: HTML bem formado (tags fechando corretamente) e o JS embutido é sintaticamente válido (sem erros de parser). Rode local antes de subir.
4. **Sem artefato visual quebrado.** Se um favicon, imagem ou asset externo falhar ao carregar, o padrão é remover o elemento do DOM (não deixar caixa vazia, ícone quebrado ou espaço reservado vazio).
5. **Prefira edições cirúrgicas.** Este é um arquivo único e já grande — localize o trecho exato antes de editar (`grep -n` ou busca por texto), não reescreva o arquivo inteiro pra mudanças pequenas.

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
- Cascata: Google favicon service → DuckDuckGo → `img.remove()` no fracasso total.
- Função `window.favFallback` no `<head>`.
- De novo: nunca deixar placeholder quadrado neutro ou espaço vazio reservado — ou mostra o favicon, ou remove o elemento e o texto flui até a margem.

**Tooltips de glossário** (`.gloss` / `.gloss-tip`): termos técnicos (ex. "OKLCH", "cmdk") têm span com tooltip explicativo, acessível via `tabindex="0"`.

## Antes de commitar/dar push

- [ ] HTML valida (tags balanceadas)
- [ ] JS embutido sem erro de sintaxe
- [ ] `favicon.svg` está no commit se o `index.html` mudou algo relacionado a assets
- [ ] Testado visualmente no browser local antes do push (o build da Vercel não pega erro de "craft" — só erro de build)
- [ ] Nenhum "ver mais/menos" ou fallback de imagem voltou pro padrão antigo (`display:none` seco, placeholder quebrado)

## Seja flexível quando eu pedir

As regras acima são o "estado estável" do craft — não são pra travar exploração. Quando eu pedir explicitamente pra:
- estudar uma referência nova (outro site, outro designer, outro sistema),
- testar uma direção visual diferente,
- ou revisar/substituir algum desses padrões,

trate isso como um convite pra propor algo novo e discutir trade-offs — não insista nas regras acima por padrão nesses momentos. As regras protegem contra regressão acidental, não contra evolução intencional do projeto.
