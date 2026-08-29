# Fluxo Figma-first — craft desenhado, depois implementado

Desde 29/08/2026 o craft do site é decidido **no Figma, à mão**, e só depois implementado a partir do frame — em vez de descrever ajustes em texto e iterar em PRs (o jeito dos PRs #77–#83). Motivo: espaçamento, peso e ritmo se decidem melhor olhando do que descrevendo. Este doc é o contrato entre o arquivo do Figma e este repositório: o que cada um é fonte de, como a implementação é pedida, e o que já foi decidido lá e ainda não está aqui.

## Fontes de verdade

- **Figma** (arquivo `Oktavio`, key `H0X3JmAFN32LWINqemEhXs`) é a fonte da **intenção de craft**: medidas, cores, estados, conteúdo das rows.
- **Produção** (`oktavio.vercel.app`) + **`styles/tokens/`** são a fonte de **tudo que o frame não diz**: motion (duração, easing), foco, reduced-motion, comportamento, textos que não estão no frame.
- Quando o frame contradiz produção, o frame ganha — **desde que seja decisão** (ver "Decisões já tomadas"). Onde a IA interpretou, ela diz onde.

## O arquivo

| Página | id | o que tem |
|---|---|---|
| Screens › Home | `1:17` | frame `Home` `2:50` (1440 de largura; coluna de 640 centralizada, y=120) |
| Screens › Wiki / Changelog / Prompts | `1:18` / `1:19` / `1:20` | vazias ainda |
| Components › Geral | `1:10` | `Doc icon` (set `11:205`, variante Default `16:2`), `Article` (set `11:191`, `Status = Default 16:30 / Hover 11:192`, props de texto `Title` e `Resume`) |

**Variáveis espelham `styles/tokens/` um-pra-um**, com os mesmos nomes: coleção *Semantic Colors* (modos Light `4:0` / Dark `4:1`, `color/ink`, `color/muted`, `color/line`, `color/shadow-a06`…), *Space* (`space-N` = `--space-N`), *Radius* (`radius/N`), *Typography* (`font-size/*`, `font-weight/*`, `line-height/*`, `letter-spacing/tight|wide`), *Layout*, *Cursor*. Estilos de texto `text/{11..16}-{regular,medium,semibold}` e `code/{11..16}`. Variável nova ganha **Code syntax → Web = `var(--nome)`** pra deixar o mapeamento explícito (`color/row-hover` → `var(--row-hover)` é o primeiro exemplo).

Atenção: `get_variable_defs` do MCP lista só as variáveis **usadas** no nó — não conclua que as outras não existem (erro cometido em 29/08).

**Produção carrega `styles/experiments/flat-type.css` depois do `main.css`.** Comparar o Figma com o `main.css` sozinho dá valor errado (`--muted` é 0.48 no ar, não 0.52; `--fw-medium` é 400; tudo é 16px). Compare com a página servida.

## Como pedir

- **"analise"** = opinião e medição, sem mexer em nada. **"faz" / "ajusta"** = executa.
- **Agrupe ajustes pequenos numa mensagem** — cada turno relê a conversa inteira; três pedidos juntos custam quase o mesmo que um.
- **O que leva 10 segundos no Figma, faça na mão** (ligar um fill numa variável, trocar um texto). A IA entra pro que precisa de medição contra produção, matemática de cor, componentização ou código.
- **Tokens sincronizam quando decididos**, antes do componente que os consome (`--row-hover` entrou assim). Componentes e layout só com "implementa" + link do frame com `node-id`.
- **Sem PR até pedir.** Mudanças ficam num branch local/pushado; o PR é aberto quando você mandar. (Branch `token-row-hover` guarda o token + este doc até lá.)
- **Sessão nova pra cada implementação grande.** A memória persistente da IA guarda IDs, tokens, decisões e gotchas; a conversa longa só encarece.
- Implementação a partir do frame segue: ler o frame (`get_metadata` + `get_design_context`), comparar com produção **na mesma largura do frame**, listar os deltas, implementar, screenshot dos dois lados no PR.

## Decisões já tomadas no Figma (ainda não implementadas)

Registradas aqui pra não serem "corrigidas" de volta pro que produção faz hoje:

- **`Article`** (row de Writing/Projects): padding `space-6` (prod 8), gap ícone→texto `space-10` (prod 12), raio `radius/12` (prod 16), largura **652** = 640 + 2×6 — sangra 6px pra cada lado, ícone na borda da coluna, texto em +60. Título e descrição em `text/16-regular`, ink/muted.
- **Hover do `Article`**: **só fill**, em `color/row-hover` — sem `--shadow-lift`, sem anel, **sem transição** (Emil e Jakub não transicionam; conferido no HTML de produção deles: `hover:bg-[#F5F4F4]` e `hover-hover:hover:bg-[oklch(0.965_0_0)]`, sem classe `transition-*`). Em código: remover `transition: box-shadow` do `.doc-item`. **Pendente decidir** se as rows da wiki (`.row`, hoje "kept in sync" com o `.doc-item` em `main.css`) acompanham.
- **Gap entre rows** da lista: `space-4` (prod 8) → pitch 76.
- **`Doc icon`**: 50×60, borda `color/line`, página 44×54, cinco linhas de **4px** (16 / 30 26 / 20 12) — decisão do Otávio; a versão "igual a produção" (48×56, 3px, sombra) foi revertida em 29/08.
- **Segunda linha da row é curta.** Emil/Jakub usam 1–6 palavras (categoria ou tagline). Em prod, Writing reaproveita o `bio` do modal e a 2ª row quebra em duas linhas. Vai virar um campo `summary` em `portfolio-content.js` (renderer: `portfolio.mjs` linha ~155, `post.bio` → `post.summary`); Projects já usa `role`, que é o padrão certo. Taglines propostas: "Principle, phases, people, discards." / "Written down as it ships." / "Kept with their context."
- **`--row-hover`**: light `oklch(0.965 0.006 91.4)`, dark `var(--gray-955)` — por quê em [design-system.md](design-system.md) ("o cinza de hover tem que ter o matiz do fundo").

## Gotchas de escrever no Figma via MCP

- **Paint ligado a variável guarda uma cor-base**; o editor mostra a base quando não resolve o modo. Base preta → linhas pretas na página *Geral* (29/08). Sempre criar o paint com a base = valor Light da variável, e fixar `setExplicitVariableModeForCollection(Semantic Colors, Light)` em componente novo, como o frame Home tem.
- **Instância solta numa lista auto-layout vira `FILL`** — re-fixar `FIXED` + largura quando a largura importa (o `Article` de 652).
- **`maxWidth` antigo trava o `resize`** — o Container ficou em 618 até zerar o `maxWidth`; o jeito fiel a `main { max-width: 640px }` é `FILL` + `maxWidth` ligado em `space-640`.
- `createAutoLayout()` nasce com fill branco — limpar quando for só um agrupador.
- Screenshot de componente na página *Geral* pode sair com cores erradas; conferir numa instância na Home.
- Regras gerais: [`figma-use` skill] — no máximo ~10 operações por chamada, `return` com os IDs mutados, fonte carregada antes de qualquer texto (Geist Regular/Medium).

## Pendências no Figma (lado do Otávio)

- Ligar o fill da variante `Status=Hover` em `color/row-hover` (hoje branco literal `255,255,255`) e apagar a row de teste "Test · row-hover" ao lado da Home.
- `Resume` da 2ª instância de `Article` na Home está cortada ("…only counts if the") — trocar pela tagline.
- `description` dos componentes `Article`/`Doc icon` ainda descreve a versão antiga.
- `Doc icon` tem uma `Variant2` idêntica à Default — desenhar (hover?) ou apagar.
- Seção **Contributions** entre "What I do" e "Writing"; navbar; seções abaixo de Writing (Projects, Personal, Life); links "Read the wiki" / "the changelog".
