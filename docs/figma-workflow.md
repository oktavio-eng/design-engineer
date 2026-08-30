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

## Decisões já tomadas no Figma

Registradas aqui pra não serem "corrigidas" de volta pro que produção fazia. Cada uma diz se já está em código.

- **`Article`** (row de Writing/Projects) — **implementado 29/08/2026** (`.doc-item` em `main.css`, branch `token-row-hover`): padding `space-6` (era 8), gap ícone→texto `space-10` (era 12), raio `radius/12` (era 16), largura **652** = 640 + 2×6 — sangra 6px pra cada lado, ícone na borda da coluna. Título e descrição em `text/16-regular`, ink/muted (em código o título segue `--fw-medium`, que a página servida resolve pra 400 via `flat-type.css` — mesmo resultado; só muda se o experimento sair). Medido na página local a 1440: row em x=394/652 de largura, padding 6, gap 10, raio 12.
- **Hover do `Article`** — **implementado 29/08/2026**: **só fill**, em `color/row-hover` — sem `--shadow-lift`, sem anel, **sem transição** (Emil e Jakub não transicionam; conferido no HTML de produção deles: `hover:bg-[#F5F4F4]` e `hover-hover:hover:bg-[oklch(0.965_0_0)]`, sem classe `transition-*`). O `transition: box-shadow` saiu do `.doc-item`. **Pendente decidir** se as rows da wiki (`.row`, que ainda levantam como card `--white` + `--shadow-lift`) acompanham — até lá `.row` e `.doc-item` deixaram de ser "um padrão só".
- **Gap entre rows** da lista — **implementado 29/08/2026**: `space-4` (era 8) → row 72, pitch 76, como no frame.
- **`Doc icon`** — **implementado 29/08/2026** (`.doc-icon` em `main.css`): 50×60, borda `color/line`, **sem sombra**, página 44×54 (borda, padding 6, raio 6), cinco linhas de **4px** (16 / 30 26 / 20 12; 4px entre linhas, 6px entre "parágrafos") — decisão do Otávio; a versão "igual a produção" (48×56, 3px, sombra) foi revertida em 29/08. Tokens novos `--space-26`/`--space-30` (código) = `space-26`/`space-30` (Figma, ligados nas larguras das linhas). Com isso a seção Writing bate com o frame: texto em +60, row 72, pitch 76. **`Status=Hover` do ícone** (segunda edição do Otávio, 29/08): a página interna ganha `0 1px 4px` a 5% de preto — em código `--shadow-doc-hover` (`colors.css`, sobre `--shadow-a05`, que zera no dark como toda sombra do site), aplicado em `.doc-item:hover .doc-icon__page`, **sem transição** (mesma regra da row; interpretação da IA — o Figma não diz motion). O efeito no Figma foi ligado em `color/shadow-a05` e a instância do ícone dentro de `Article › Status=Hover` foi trocada pra `Status=Hover` (estava em Default).
- **Segunda linha da row é curta** — **implementado 29/08/2026**: campo `summary` em `portfolio-content.js` (Writing), renderer `portfolio.mjs` lê `post.summary`; `bio` continua sendo só o parágrafo do modal. O texto das três rows é o das instâncias na Home (`"The plan itself: principle, phases, people, and what got discarded."`, `"Written down as it ships."`, `"Kept with the context that made them useful."`); Emil/Jakub usam 1–6 palavras, então se quiser encurtar a 1ª e a 3ª as taglines propostas continuam valendo ("Principle, phases, people, discards." / "Kept with their context.") — troque no Figma e peça pra sincronizar. Projects já usa `role`, que é o padrão certo.
- **`--row-hover`** — **implementado 29/08/2026** (token) e consumido pelo `.doc-item:hover` desde a mesma data: light `oklch(0.965 0.006 91.4)`, dark `var(--gray-955)` — por quê em [design-system.md](design-system.md) ("o cinza de hover tem que ter o matiz do fundo").

## Gotchas de escrever no Figma via MCP

- **Paint ligado a variável guarda uma cor-base**; o editor mostra a base quando não resolve o modo. Base preta → linhas pretas na página *Geral* (29/08). Sempre criar o paint com a base = valor Light da variável, e fixar `setExplicitVariableModeForCollection(Semantic Colors, Light)` em componente novo, como o frame Home tem.
- **Instância solta numa lista auto-layout vira `FILL`** — re-fixar `FIXED` + largura quando a largura importa (o `Article` de 652).
- **`maxWidth` antigo trava o `resize`** — o Container ficou em 618 até zerar o `maxWidth`; o jeito fiel a `main { max-width: 640px }` é `FILL` + `maxWidth` ligado em `space-640`.
- `createAutoLayout()` nasce com fill branco — limpar quando for só um agrupador.
- Screenshot de componente na página *Geral* pode sair com cores erradas; conferir numa instância na Home.
- Regras gerais: [`figma-use` skill] — no máximo ~10 operações por chamada, `return` com os IDs mutados, fonte carregada antes de qualquer texto (Geist Regular/Medium).

## Pendências no Figma (lado do Otávio)

- Apagar a row de teste "Test · row-hover" ao lado da Home (se ainda estiver lá).
- O fill do `Card` dentro do `Doc icon` (`2:100` / `11:207`) é branco literal, não ligado a variável — no modo Dark do Figma a página ficaria branca. Em código é `--white` (dark → `--gray-955`, o mesmo valor de `--row-hover` dark, então em hover só as bordas da página aparecem — é o que já acontecia antes). Ligar em `color/white` (ou decidir outra cor pro dark) pra o Figma parar de mentir nesse modo.

Feitas em 29/08/2026: `space-26`/`space-30` criadas na coleção Space e ligadas nas linhas do `Doc icon` (as duas variantes); fill do `Status=Hover` ligado em `color/row-hover` (já estava ligado quando a IA foi conferir — checar com `use_figma` antes de "corrigir" o que o doc diz); `Resume` da 2ª instância trocada por "Written down as it ships."; `description` das duas variantes do `Article` reescrita pra spec atual.
- Seção **Contributions** entre "What I do" e "Writing"; navbar; seções abaixo de Writing (Projects, Personal, Life); links "Read the wiki" / "the changelog".
