# Registro de mudanças

A versão oficial é a que está no ar (jesielt.github.io). Ela só muda no push.
Os ajustes do dia a dia ficam nos commits; aqui entra o resumo de cada versão publicada.

Numeração: `maior.menor.correção`
- **maior**: o jogo muda de verdade (um objetivo, um modo novo)
- **menor**: entra coisa nova (nuvens, mar novo...)
- **correção**: ajustes e consertos

A versão atual também fica na constante `VERSAO`, no começo de `planeta/jogo.js`,
e aparece embaixo do nome, no canto da tela (e no console do navegador).

## 2.2.2 — 14/11/2026

- Contador de visitas (`contador.js`), com registro em Google Apps Script

## 2.2.1 — 14/11/2026

Bola de energia:
- Carga de 1 s à frente do canhão antes do lançamento
- Bola vermelha com brilho de plasma e rastro curto
- Fumaça da explosão grande, densa e cinza; fuligem mais clara

## 2.2.0 — 14/11/2026

Braço-canhão e bola de energia:
- Braço mecânico de robô em primeira pessoa, do lado direito da tela
- Clique esquerdo: o braço se ergue e lança uma bola de energia vermelha, com tranco a cada tiro
- A bola explode ao tocar terra, rocha, árvore ou água, com clarão, luz e poeira; em terra deixa fuligem
- CREDITS.md com as bibliotecas de terceiros

## 2.1.7 — 14/11/2026

Celular:
- Ícone de girar o celular acima do convite "toque pra voar", sem sobrepor
- Barra de ar empurra altura e velocidade para cima quando aparece; a mesma regra de pilha vale para barras futuras

## 2.1.6 — 13/11/2026

Celular:
- Botão de soltar esfera no topo, ao centro
- Altura e velocidade embaixo, ao centro, entre os polegares
- ▲, ⚡ e ▼ desenhados em SVG: o ⚡ fica centrado entre ▲ e ▼ em qualquer aparelho

## 2.1.5 — 13/11/2026

Celular:
- Aviso de girar o celular virou ícone animado (celular em pé deitando)
- O convite "toque pra voar" não volta mais ao tocar nos botões
- Botão de soltar esfera (seta, bola e chão), visível com ao menos uma esfera na caixa; pisca com as 7 juntas
- Botão de ajuda (?), com lista própria dos controles de toque
- Botão de som (liga/desliga) no canto superior esquerdo
- Botões reorganizados: ▲, ⚡ e ▼ numa coluna; caveira, ? e não mergulhar ao lado

## 2.1.4 — 13/11/2026

- Visão mais longa: a neblina começa em 1500 e fecha em 3000 (antes 650 e 2200)
- Sombra cobre uma área maior em volta do jogador (raio 1000, antes 700)
- Ilhas surgem aos poucos na neblina, sem aparecer de repente no horizonte: são criadas já cobertas, com folga pelo tamanho de cada uma
- Ilhas, árvores e sapos não perdem a neblina ao irem para a borda da tela (neblina pela distância real, não pela profundidade). A água mantém a neblina de antes

## 2.1.1 — 12/11/2026

Nada muda no jogo; só por dentro:
- Código dividido em arquivos por assunto (planeta/js/), carregados pelo jogo.js
- Comentários do código mais curtos e diretos
- Classe do selo das teclas R e M com nome que diz o que é (com-selo)

## 2.1.0 — 11/11/2026

- Som de vento, feito na hora com ruído rosa (sem arquivo de áudio)
  - Parado: um sopro baixinho, tipo orla. Voando devagar sobe um pouco; rápido e no dash fica forte e encorpado (grave, sem chiado)
  - Rajadas lentas e diferentes em cada ouvido, pra não soar como chiado parado
  - Debaixo d'água fica abafado; subindo pro espaço vai sumindo (lá não tem ar)
  - Liga no primeiro clique, tecla ou toque (regra do navegador)
  - Para sozinho quando você troca de janela ou de aba, e volta quando você volta
- Tecla M liga/desliga o som (fica lembrado); no painel, um M com alto-falante cortado em cinza
- Andar: voando a 1 m do topo de uma ilha ou rocha, você pousa
  - A câmera dá uma abaixadinha (pancada no joelho) e levanta pra altura de pé (1,7 m)
  - Anda a ~1,4 m/s; com Shift corre a ~4,9 m/s; Espaço decola de volta pro voo (segurando Espaço, passa rente sem pousar)
  - A cabeça balança a cada passo; rochas viram parede (só sobe voando) e degrauzinhos sobe andando
  - Saiu da ponta de uma rocha: cai no chão de baixo, com abaixadinha na chegada
  - Escorregar: chegou na beira da ilha, escorrega sentado pro mar e lá vira o nado de sempre
  - Andando dá pra chutar a esfera e capturar de pé
- Som de passo robótico "clac-nhec" de corpo pesado (tum grave e encorpado + estalo metálico + servo rangendo baixinho), mais forte no pouso
- Árvores com tamanho de gente: distribuição natural de 2 a 20 m (a maioria entre ~4 e ~11 m)
  - Mais alta = mais velha = copa maior (da menor pra maior a copa dobra) e tronco um pouco mais grosso
- Montanhas: às vezes a ilha ganha uma rocha enorme e encorpada perto do centro (12 a 28 m; nas ilhas enormes até 35 m, às vezes duas; as bem altas são raras), com topo plano pra pousar
- C duas vezes rápido: desiste do voo e cai. No chão pousa (abaixadinha mais forte quanto maior a queda), na água mergulha; Espaço volta a voar
- Esferas maiores (~49 cm) e, andando, seu corpo esbarra nelas de mais longe e chuta mais forte (dá pra jogar futebol)
- Choque com a esfera faz um "tim" de vidro grave e baixinho (em você, nas árvores, nas rochas e nos sapos)
- O aviso de capturar aparece só nos primeiros 3 s perto de cada esfera e some de vez (capturar continua igual)
- Menos árvores por ilha (até 5 nas comuns, até ~12 nas enormes)
- Correndo na ilha o vento fica bem mais baixo que voando
- Fauna de Namek: sapos nas ilhas (só no chão, longe da água e das rochas). Ficam olhando em volta, dão pulinhos
  e fogem pulando quando você chega perto. Como todo bicho de Namek, têm anteninhas
  - Têm corpo: a esfera quica neles (dá pra tabelar) e você não atravessa; quem leva bolada ou esbarrão foge

## 2.0.3 — 11/11/2026

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
