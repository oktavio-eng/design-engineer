# Design Engineer, Plan

Um documento pessoal de transição de carreira — de design visual pra design engineering. Site vivo em [oktavio.vercel.app](https://oktavio.vercel.app/).

Documenta a estratégia, referências de craft, cursos, leituras e o plano de 4 fases pra essa transição. A tese central: prova pública supera credencial — portfolio e código aberto acima de diploma.

## Stack

Sem build step e sem dependência de runtime via npm — as duas libs que o site usa (som e smooth scroll) estão vendoradas em `vendor/`:

```
index.html            — a home: o portfólio (dados em portfolio-content.js, página em portfolio.mjs)
wiki.html             — /wiki: o plano (era a home até 16/08/2026)
changelog.html        — /changelog
prompts.html          — /prompts (dados + página em prompts.mjs)
content.js            — as coleções da wiki → window.SITE_CONTENT
portfolio-content.js  — as coleções do portfólio → window.PORTFOLIO_CONTENT
script.js             — a interação da wiki (painel, modais, animações)
chrome.js             — tema + navbar nas outras páginas
cmd.mjs               — busca ⌘K, em todas as páginas
contrib.mjs           — gráfico de contribuições (dados em data/contributions.json)
favicons.js           — favicon() + cascata de fallback
intro.js              — a saudação em 6 idiomas antes do conteúdo (home e wiki)
mail.js               — o composer de e-mail (envelope na navbar)
cursor.mjs            — o ponteiro estilo iPadOS
sound.mjs             — som de interação (cuelume, vendorado)
scroll.mjs            — smooth scroll (Lenis, vendorado)
vendor/
  cuelume/      — sons sintetizados via Web Audio (MIT)
  lenis/        — smooth scroll (MIT)
data/
  contributions.json — o calendário do GitHub, atualizado 1×/dia por GitHub Action
styles/
  main.css      — componentes, importa os tokens
  tokens/       — cores, tipografia, motion, spacing, radius
favicon.svg
avatar.webp
og.jpg
```

Deploy automático na Vercel a cada push na `main`.

## Craft

O design system usa tokens em OKLCH, tipografia Geist, e uma cascata de três colunas inspirada no floguo.com. Ver [`AGENTS.md`](AGENTS.md) pras regras completas de craft e convenções do projeto — leitura obrigatória antes de qualquer edição, humana ou por agente de IA.

## Roadmap

[`PORTFOLIO.md`](PORTFOLIO.md) documenta o plano de reaproveitar essa mesma base (design system + máquina de interação) pra construir um portfolio separado, com projetos de cliente, pessoais e uma galeria.

## Desenvolvimento local

```bash
python3 -m http.server 8000
```

Nunca abrir via `file://` — os caminhos de `styles/main.css` e `script.js` são absolutos e não resolvem sem servidor.

## Studio de conteúdo

Dashboard com edição, rascunhos e lixeira das coleções do portfólio, usando Cloudflare D1. Rode `npm ci` e `npm run dev:admin`, depois abra `http://127.0.0.1:8787/admin` (`admin` / `admin123`, somente local). Setup, arquitetura, testes e migração de mensagens em [docs/studio.md](docs/studio.md). Em produção o Studio roda num Cloudflare Worker próprio, atrás do Cloudflare Access; o site público lê o conteúdo dele pelos rewrites do `vercel.json`.
