# Design Engineer, Plan

Um documento pessoal de transição de carreira — de design visual pra design engineering. Site vivo em [design-engineer-phi.vercel.app](https://design-engineer-phi.vercel.app/).

Documenta a estratégia, referências de craft, cursos, leituras e o plano de 4 fases pra essa transição. A tese central: prova pública supera credencial — portfolio e código aberto acima de diploma.

## Stack

Zero-dependency, sem build step:

```
index.html    — markup + data
script.js     — toda a interação (painel, busca ⌘K, animações)
styles/
  main.css      — componentes, importa os tokens
  tokens/       — cores, tipografia, motion, spacing, radius
favicon.svg
avatar.webp
og.jpg
```

Deploy automático na Vercel a cada push na `main`.

## Craft

O design system usa tokens em OKLCH, tipografia Inter, e uma cascata de três colunas inspirada no floguo.com. Ver [`AGENTS.md`](AGENTS.md) pras regras completas de craft e convenções do projeto — leitura obrigatória antes de qualquer edição, humana ou por agente de IA.

## Roadmap

[`PORTFOLIO.md`](PORTFOLIO.md) documenta o plano de reaproveitar essa mesma base (design system + máquina de interação) pra construir um portfolio separado, com projetos de cliente, pessoais e uma galeria.

## Desenvolvimento local

```bash
python3 -m http.server 8000
```

Nunca abrir via `file://` — os caminhos de `styles/main.css` e `script.js` são absolutos e não resolvem sem servidor.
