# Nova home — Projects em cards e o detalhe do projeto

O protótipo vive em **`/testes/prototipo-nova-home`** (rota `noindex`, fora de produção; a home publicada continua intocada em `/`). Ele existe pra decidir olhando, não descrevendo — três escolhas que o Figma não fecha estão num painel de troca na própria página.

Fonte: arquivo `Oktavio` (`H0X3JmAFN32LWINqemEhXs`), frames **card `124:562`**, **seção `124:1280`** e **detalhe `133:248`** ("Project details Modal estilo Vault do Emil"). Contrato geral entre Figma e repositório: [figma-workflow.md](figma-workflow.md).

## Os arquivos

| Arquivo | O que é |
|---|---|
| `testes/prototipo-nova-home.html` | a página; carrega `main.css` + `flat-type.css` + o CSS do protótipo, nessa ordem |
| `testes/prototipo.css` | só classes com prefixo `p` (`.pcard`, `.pjt`, `.pdrawer`, `.pgal`); não sobrescreve nenhuma regra de produção |
| `testes/prototipo.mjs` | o carrossel, a superfície de detalhe e a galeria |
| `tests/ui/proto-nova-home.test.mjs` | roda no `npm run test:product-ui` |

`portfolio.mjs` continua dono de tudo que não mudou (Writing, Personal, Life, contribuições, lightbox). A seção Projects do protótipo não tem `data-list="projects"`, então o renderer de produção não monta rows ali e o módulo novo assume a seção inteira.

## O que bate com o frame

Nada disso precisou de token novo: `--ls-tight` é exatamente o `-0.16px` a 16px do frame, `--lh-base` e `--lh-snug` são o 1.6 e o 1.5, e os raios 12/16/24 já existem.

**Card** — 266×332, padding 20, raio 16, fundo `--white`. Ícone de expandir de 16 no topo à direita, marca de 64×64 (raio 12, borda `--line`) no meio, título em `text/16-medium` `--ink` e descrição em `text/16-regular` `--muted` com gap 6. `justify-content: space-between`, então o ar em volta da marca é sobra dividida (~66 de cada lado), não um gap fixo.

**Seção** — cabeçalho com o título à esquerda e a pílula de setas à direita, 24 até a lista, cards com gap 16. A pílula tem fundo `--bg`, borda `--line` e raio total; o botão ativo é `--white` com a seta `--ink`, o desabilitado é transparente com a seta `--faint`.

**Detalhe** — folha de 1000 com padding 20 e raio 24, alça de 48×4 em `--line`. Imagem principal 960×400 raio 16, depois 40 de respiro e 40 entre blocos. Galeria com gap 16 alternando duas meias (472×400) e uma inteira (960×400). "In practice" e "Links" em `--faint`, primeiro destaque em `--ink` e os demais em `--muted`.

## Decisões que a IA tomou (o frame não diz)

- **A seta pixelada** (`Arrow Pixelate`, `110:325`) não existia em código. Virou SVG de cinco `<rect>` de 2px em `currentColor`, pra herdar a cor do estado do botão.
- **A marca de 64** está vazia no frame. Usa o favicon do primeiro link — o mesmo que a row de Projects já mostra hoje. Falhou, o `<img>` sai e sobra o quadrado.
- **O fill da marca** no frame é branco a 5%, que em Dark é o `--ink-a5` do site e em Light some. Em código é `--ink-a5` nos dois modos.
- **O ícone de expandir** exporta igual nos dois estados do frame (os dois SVGs são byte a byte idênticos), então a cor virou decisão: `--faint`.
- **O passo do carrossel** sai do layout real (card + gap), não de um número repetido no JS.
- **O estado das setas** nasce do `scrollLeft` da trilha, não de um índice próprio: arrastar, rolar no trackpad e dar Tab pro próximo card mexem no scroll sem passar pelas setas.
- **Foco atrás:** a página sai da ordem de foco (`inert` em `main`) enquanto a folha está aberta. O `.cmd-modal` do site não faz isso, mas ele é pequeno e esta folha cobre quase tudo.
- **O topbar sai por opacidade, nunca por `transform`** — o estado escondido dele já é um `translate(-50%, …) scale()`, e sobrescrever a propriedade inteira joga a barra pra fora do centro. Foi o primeiro bug da implementação.
- **O wash** é o `--wash-bg` + blur do `.cmd-wash`, igual às outras camadas do site. Sozinho ele quase não vela uma página quase branca; quem separa é o blur. Com a escala da página atrás, dá o par "scale-and-blur" que o próprio prompt de drawer deste repositório descreve (`prompts.mjs`).

## Os três eixos em aberto

Trocáveis no painel da página, persistidos em `localStorage`:

1. **Carrossel — sangra × coluna.** No frame os quatro cards somam 1112 dentro de uma coluna de 640 e o corte só acontece na borda dos 1440. `sangra` leva a trilha até a borda da janela (`margin-right: calc(50% - 50vw)`, que `html { overflow-x: clip }` já protege); `coluna` respeita os 640. O resto da página inteira é coluna centrada, então sangrar é uma quebra deliberada de ritmo.
2. **Detalhe — drawer × modal.** Vaul é a biblioteca de drawer do Emil, e a alça do frame é a dela: o `drawer` sobe de baixo, arrasta pra fechar (distância **ou** velocidade) e escala a página atrás. O `modal` usa a geometria do `.cmd-modal` (`--ease-pop`, scale 0.96 → 1) pra que os dois modais do site continuem lendo como uma superfície só, e troca a alça por um botão de fechar — uma alça que não arrasta é uma promessa falsa.
3. **Hover do card — anel × fill.** O Figma desenhou anel (`--line`, sem preenchimento). O site decidiu em 29/08/2026 que row é **só fill** em `--row-hover`, sem anel e sem transição, conferido no HTML do Emil e do Jakub ([figma-workflow.md](figma-workflow.md)). As duas superfícies convivem na mesma página, então dá pra comparar de perto.

## De onde vem o conteúdo

Tudo sai de `window.PORTFOLIO_CONTENT` — em produção, servido pelo Worker a partir do D1 do Studio. Dois campos entraram:

- **`summary`** — a linha curta do card. Registro diferente do `role`: o card diz o que o projeto é ("Founding design for a medical-education company"), o `role` diz a disciplina ("Interactive Product + Campaigns · Medical Education"). Writing já usava o campo com o mesmo sentido. No Studio: **"Resumo na home"**.
- **`gallery`** — `[{src, alt, caption}]`. No Studio: **"Galeria do projeto"**. Semeado só no Caderno de Erros, com quatro telas reais do produto baixadas da própria home dele e abertas uma a uma antes de entrar (regra 7 do `AGENTS.md`, aplicada a imagem).

Quedas graciosas, pra rota funcionar hoje com os dados que já estão no ar: sem `summary` o card mostra o `role`; sem `gallery` a galeria é montada das capas dos `subprojects` (a Escola da Bel já tem cinco); sem nenhum dos dois o bloco não aparece.

**Consequência prática:** o `portfolio-content.js` do repositório é semente e vale no `dev:admin`; o site publicado só mostra `summary` e `gallery` depois que forem preenchidos no Studio.

## O que ficou de fora, de propósito

- **Upload de imagem.** O Studio salva URL, não arquivo, e o Worker não tem bucket. A galeria vem do dashboard como campo de URL. Upload de verdade é R2 + rota no Worker + UI — trabalho separado, e é o que falta pra experiência ser "subir foto pelo dashboard".
- **A renomeação de Writing pra "Experiences"**, que o frame mostra. O protótipo testa uma mudança de cada vez.
- **Contributions no frame** e as seções abaixo de Projects continuam pendentes do lado do Figma (ver o fim de [figma-workflow.md](figma-workflow.md)).

## Divergências de conteúdo no frame

- O card do Caderno de Erros trazia "plataform"; em código entrou "platform".
- O frame mostra quatro projetos; o conteúdo tem sete, e o carrossel mostra todos (a lista de rows cortava no quarto com "show more").
- O perfil do frame diz "Visual Designer · GOW Studio"; produção diz "Product & Visual Designer · GOW Design". O protótipo seguiu produção.
