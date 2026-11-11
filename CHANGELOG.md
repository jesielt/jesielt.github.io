# Registro de mudanças

A versão oficial é a que está no ar (jesielt.github.io). Ela só muda no push.
Os ajustes do dia a dia ficam nos commits; aqui entra o resumo de cada versão publicada.

Numeração: `maior.menor.correção`
- **maior**: o jogo muda de verdade (um objetivo, um modo novo)
- **menor**: entra coisa nova (nuvens, mar novo...)
- **correção**: ajustes e consertos

A versão atual também fica na constante `VERSAO`, no começo de `planeta/jogo.js`,
e aparece embaixo do nome, no canto da tela (e no console do navegador).

## 2.0.3 — ainda não publicada

- Celular: pra capturar, toca na própria esfera (com folga em volta, pro dedo não errar).
  O ícone do mouse some no celular; no lugar dele, um anel dourado pulsa em volta da esfera
  quando ela está perto o bastante

## 2.0.2 — 11/11/2026

- Celular e tablet: o jogo agora funciona no toque (no computador nada muda)
  - Joystick: encosta o dedão no lado esquerdo da tela e arrasta pra andar (quanto mais longe, mais forte)
  - Arrastar o dedo no resto da tela vira a câmera; dá pra andar e olhar ao mesmo tempo
  - Botões grandes à direita: ▲ subir, ▼ descer, ⚡ dash (um toque liga, outro desliga)
  - Botões pequenos: recomeçar (caveira, pede confirmação) e não mergulhar (nadador)
  - Pra capturar uma esfera, toca no ícone que aparece em cima dela (agora maior)
  - Radar, altura, velocidade e esferas sobem pro canto de cima; o painel de teclado e mouse some
  - Primeiro toque abre em tela cheia e, se o celular deixar, trava deitado; em pé aparece "vire o celular de lado"
  - Resolução um pouco menor no celular, pra rodar mais leve

## 2.0.1 — 10/11/2026

- Correção: logo depois de uma atualização, o navegador podia misturar a página nova
  com o estilo e o jogo antigos guardados no cache (botões gigantes, céu rosa). Agora
  cada versão pede os arquivos por um endereço próprio
- Correção: depois de pegar as esferas com o atalho de teste 1-2-3, o R (ou ficar sem ar)
  não devolvia as esferas nem clareava o céu

## 2.0.0 — 10/11/2026

- Céu sem rosa: verde em cima, verde-amarelado embaixo, como no anime
- Neblina do horizonte mais fraca, em verde-amarelado em vez de rosa
- Nuvens de verdade no alto (por volta de 37 a 49 m): dá pra subir, atravessar e ver de cima
- Mar de lago: calmo, um pouco turvo e transparente, reflete o céu e brilha com o sol;
  a base das ilhas aparece de leve embaixo d'água
- Velocidade em km/h no canto esquerdo de cima do radar, com o "V" saiyajin
- Espirro: com o dash (Shift), a 1,5 m da água ou menos, a espuma abre pros dois lados
- As 7 esferas sorteadas pelo mundo, cada uma pra um lado (de 600 a 5000 de distância),
  todas no radar; metade cai numa ilha, metade no fundo do mar
- Esferas de vidro laranja com volume (miolo claro, borda funda e levemente transparente)
- No radar, cada esfera tem um triângulo vazado apontando pra ela: maior = mais perto
- Captura: perto da esfera aparece o botão direito do mouse; clicou, ela vai pra caixinha
  redonda embaixo do radar, mostrando as estrelas dela
- Juntou as 7: o céu escurece aos poucos (verde-escuro, quase noite) e o planeta perde o
  brilho; caem raios de verdade das nuvens até o mar, iluminando tudo
- Fundo do mar: dá pra mergulhar, até uns 7 m de fundo. As ilhas descem como montanhas até um chão irregular,
  com montinhos e algas balançando
- Debaixo d'água: tudo esverdeado, bolhinhas (mais quanto mais rápido), movimento mais
  fraco, choque ao entrar na água e sem espirro
- Fôlego: barra azul de 40 s; se acabar, você volta pro começo e perde as esferas
- As esferas também afundam devagar e rolam pelo fundo (não somem mais)
- Grama das ilhas lisa, com manchas escuras e grandes em degradê, espalhadas sem padrão (sem pinceladas); as manchas viraram
  terra compactada (sem grama em cima), com uma borda escura separando da grama
- Mergulhou rápido (com dash): estouro de centenas de bolhas espalhadas numa bola à sua frente,
  também mergulhando na vertical
- Bolhas de verdade na água (não mais desenhadas na tela): ficam no lugar delas e você
  passa por elas nadando
- "Não mergulhar": clique duplo com o botão direito liga/desliga, com um botão de ícone
  (nadador com X) embaixo dos controles; ligado, dá pra voar rente à água à vontade
- Controles do canto um pouco menores
- Pegou a última esfera debaixo d'água: o céu só começa a escurecer quando você sai
- Céu escuro: as copas das árvores escurecem junto com o resto
- Fôlego em 20% ou menos: a barra fica vermelha e pisca
- Ícone do nadador mais grosso e legível
- Para testes (teclado numérico): 1-2-3 pega todas as esferas; 4-5-6 leva pra 499 m de altura
- "Não mergulhar" avisa quando troca: ligou, anéis brancos saem do botão até perto das teclas; desligou,
  eles vêm de longe e encolhem até a borda dele
- Triângulos do radar em branco
- Abertura: no primeiro clique, "FIND", "THE", "BALLS" em letras saiyajin semitransparentes, uma por cima
  da outra, chegando grandes e diminuindo até sumir
- Terra seca das ilhas com textura de terra batida (tom esfumado, granulado fino e
  pedrinhas miúdas) e beirada recortada, com pontas de terra entrando na grama como
  pinceladas; a borda entre a terra e a grama ficou
  com metade da largura, em azul escuro
- Tecla R (também no painel, ao lado do W, com uma caveirinha cinza-clara de aviso): recomeça do
  ponto de partida
- Mar mais opaco visto de cima: as encostas das ilhas não aparecem mais lá embaixo
- Embaixo d'água, a beira da ilha não sobra mais pra fora da encosta
- Dá pra subir até o espaço: de 200 m pra cima o céu vai ficando rarefeito e escuro, e em
  500 m vira espaço, preto e cheio de estrelas. Lá embaixo aparece o planeta Namek inteiro,
  verde com faixas claras tortas espalhadas por ele todo e um brilho azul na borda, e ele passa embaixo de você conforme
  você voa. Descendo, tudo volta
- No espaço não tem ar: acima de 500 m a barra de fôlego (40 s) aparece; acabou, recomeça
- Versão na tela, embaixo do nome; clicar no nome abre o GitHub; nome e versão na fonte Orbitron

## 1.0.0 — 10/11/2026

Primeira versão publicada.

- Voo em primeira pessoa num planeta de ilhas, com mar verde infinito
- Ilhas com rochas rosa e grama azul, árvores de copa azul, graminhas e manchas no gramado
- Céu em degradê com neblina e um planeta listrado no céu
- Radar, medidor de altura, dash com Shift
- Esfera de 4 estrelas escondida numa ilha, achada pelo radar
- A página inicial abre direto o Planeta
