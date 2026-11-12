// Planeta — etapa 1: voar em primeira pessoa sobre a água.
// Unidades do mundo ≈ metros. y é a altura; a água fica em y = 0.

// A biblioteca de 3D vem de um link. Carregando assim, o jogo funciona
// tanto no site quanto abrindo o index.html direto (duplo clique).
// Versão oficial (a que vai pro ar no próximo push). Ver CHANGELOG.md.
const VERSAO = '2.1.0';
console.log(`Planeta v${VERSAO}`);
// aparece na tela, embaixo do nome (o número vem só daqui)
document.getElementById('versao').textContent = 'v' + VERSAO;

// Tela de toque (celular/tablet): troca teclado e mouse por joystick, arrastar pra
// olhar e botões grandes. No computador nada muda.
const TOQUE = matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;
if (TOQUE) {
  document.body.classList.add('toque');
  document.getElementById('convite').textContent = 'toque pra voar';
}

// O jogo fica dividido em arquivos menores, na pasta js/ (um assunto por arquivo).
// Eles dividem as mesmas variáveis (são scripts comuns, não módulos), então a
// ORDEM abaixo importa: um arquivo só pode usar, na hora em que carrega, o que
// veio antes dele. Dentro de funções (que rodam depois) pode usar qualquer um.
// Arquivo novo: criar em js/ e pôr na lista, no lugar certo da ordem.
const PARTES = [
  'cena',       // ajustes de sensação, cores, cena, câmera, luz
  'ceu',        // céu, satélites, nuvens
  'agua',       // superfície do mar e fundo
  'ilhas',      // ilhas, rochas, grama, árvores, saia submersa, quais ilhas existem
  'fauna',      // bichos (sapos)
  'controles',  // teclado, mouse, toque, abertura
  'movimento',  // voo, andar, pouso, queda, colisão, atualizar()
  'esferas',    // as 7 esferas e a captura
  'painel',     // radar, risquinhos de velocidade, altura e velocidade na tela
  'espirro',    // espirro da água no dash rente ao mar
  'mergulho',   // debaixo d'água, bolhas, ar, recomeçar, céu escuro e raios
  'espaco',     // subir até o espaço: planeta visto de fora, estrelas
  'som',        // vento e passos
  'laco',       // laço principal (sempre por último)
];

import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js').then(THREE => {
  window.THREE = THREE;
  for (const nome of PARTES) {
    const s = document.createElement('script');
    s.src = `js/${nome}.js?v=${VERSAO}`;
    s.async = false; // roda na ordem da lista
    s.onerror = () => console.error(`Planeta: não carregou js/${nome}.js`);
    document.body.appendChild(s);
  }
});
