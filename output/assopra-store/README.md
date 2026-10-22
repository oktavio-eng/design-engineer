# Assopra Store

Textos e apresentação aprovados em 22/10/2026. Publicado em https://oktavio.vercel.app/ na mesma data, com Meta e Assopra antes da CloudFaster. Studio/D1 revisão 23 → 24; 24 assets conferidos por SHA-256 no domínio público. O ZIP preserva o pacote de revisão anterior à publicação.

## Entrega

- `final/index.html`: apresentação com os textos completos e as 23 imagens individuais.
- `final/images/`: 9 MacBooks e 4 iPhones em PNG transparente, 7 componentes para masonry e 3 campanhas recortadas das telas fornecidas no Figma.
- `final/copy.md`: textos aprovados em inglês.
- `final/media.json`: ordem, descrições, dimensões, apresentação e referência ao nó-fonte.
- `crop-manifest.json`: arquivo-fonte, nó Figma e coordenadas de cada recorte, em pixels da fonte preservada.
- `sources/`: capturas integrais, estrutura e inventário dos nós. `sources/manifest.json` identifica cada origem; `sources/checksums.json` registra dimensões e SHA-256. Não são arquivos `.fig` editáveis.
- `crops/`: os 23 recortes antes da composição em aparelhos.
- `qa/`: contact sheet, capturas da apresentação em 1440, 768 e 390px e resultado da verificação.
- `assopra-store-final.zip`: arquivos finais portáveis, sem pranchas de revisão ou fontes intermediárias.

Os três banners são recortes das campanhas já presentes na home do Figma. Não foram recebidos arquivos externos de campanha. Imagens e autoria com IA foram confirmadas pelo Otavio; nenhum material novo foi gerado nesta etapa.

## Apresentação e regeneração

Na raiz do repositório:

```sh
python3 -m http.server 8766 --bind 127.0.0.1 --directory output/assopra-store
```

Abrir `http://127.0.0.1:8766/final/`. Com o servidor ativo, `node output/assopra-store/build.mjs` recompõe os assets usando os dois SVGs existentes em `assets/projects/devices/`. `node output/assopra-store/verify.mjs` verifica imagens, erros, overflow e transparência, além de gerar as capturas de QA. Os scripts usam o Chromium local documentado nesta máquina.

Os nove recortes desktop têm proporção 1,6:1, idêntica à área de tela do MacBook (1060 × 662,5), preenchendo-a por completo sem esticar. Os mockups preservam a proporção dos dispositivos e das telas; há espaço superior nos iPhones para a ilha dinâmica não encobrir o conteúdo. Nenhum título, número, legenda ou fundo de prancha foi incorporado aos PNGs finais. `device-render.html` é um intermediário técnico usado para exportar somente os aparelhos.

Os componentes permanecem individuais. A apresentação aplica gap 16px, raio 16px e borda de 1px preto a 8% via CSS, sem drop shadow e sem fundo cinza externo. As sombras externas originais dos painéis de busca, filtros e seleção rápida foram excluídas pelos recortes. As cores internas foram preservadas. Nenhuma tela mobile foi inventada.

A produção e o Studio foram atualizados após a autorização explícita do Otavio. Figma permaneceu sem alterações. Ver docs/nova-home-projetos.md para a verificação da publicação.
