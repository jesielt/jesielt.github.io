# Registro de mudanças

A versão oficial é a que está no ar (jesielt.github.io). Ela só muda no push.
Os ajustes do dia a dia ficam nos commits; aqui entra o resumo de cada versão publicada.

Numeração: `maior.menor.correção`
- **maior**: o jogo muda de verdade (um objetivo, um modo novo)
- **menor**: entra coisa nova (nuvens, mar novo...)
- **correção**: ajustes e consertos

A versão atual também fica na constante `VERSAO`, no começo de `planeta/jogo.js`,
e aparece no console do navegador quando o jogo abre.

## 1.1.0 — ainda não publicada

- Céu sem rosa: verde em cima, verde-amarelado embaixo, como no anime
- Neblina do horizonte mais fraca, em verde-amarelado em vez de rosa
- Nuvens de verdade no alto (por volta de 37 a 49 m): dá pra subir, atravessar e ver de cima
- Mar de lago: calmo, um pouco turvo e transparente, reflete o céu e brilha com o sol;
  a base das ilhas aparece de leve embaixo d'água
- Velocidade em km/h no canto esquerdo de cima do radar, com o "V" saiyajin
- Espirro: com o dash (Shift), a 1,5 m da água ou menos, a espuma abre pros dois lados
- As 7 esferas: a de 4 estrelas perto de onde você começa, as outras 6 espalhadas
  (de 1500 a 5000 de distância), todas no radar; se cair no mar, a esfera volta pro lugar
- Esferas de vidro laranja com volume (miolo claro, borda funda e levemente transparente)
- No radar, cada esfera tem um triângulo vazado apontando pra ela: maior = mais perto
- Captura: perto da esfera aparece o botão direito do mouse; clicou, ela vai pra caixinha
  redonda embaixo do radar, mostrando as estrelas dela
- Juntou as 7: o céu escurece aos poucos (verde-escuro, quase noite), com raios e clarões
- Fundo do mar: dá pra mergulhar. As ilhas descem como montanhas até um chão irregular,
  com montinhos e algas balançando
- Debaixo d'água: tudo esverdeado, bolhinhas (mais quanto mais rápido), movimento mais
  fraco, choque ao entrar na água e sem espirro
- Fôlego: barra azul de 25 s; se acabar, você volta pro começo e perde as esferas
- As esferas também afundam devagar e rolam pelo fundo (não somem mais)
- Grama das ilhas com pinceladas finas, como nos cenários de Namek; as manchas viraram
  terra compactada (sem grama em cima)
- Mergulhou rápido (com dash): estouro de bolhas na tela
- "Não mergulhar": clique duplo com o botão direito liga/desliga, com um botão de ícone
  (nadador com X) embaixo dos controles; ligado, dá pra voar rente à água à vontade
- Controles do canto um pouco menores

## 1.0.0 — 10/11/2026

Primeira versão publicada.

- Voo em primeira pessoa num planeta de ilhas, com mar verde infinito
- Ilhas com rochas rosa e grama azul, árvores de copa azul, graminhas e manchas no gramado
- Céu em degradê com neblina e um planeta listrado no céu
- Radar, medidor de altura, dash com Shift
- Esfera de 4 estrelas escondida numa ilha, achada pelo radar
- A página inicial abre direto o Planeta
