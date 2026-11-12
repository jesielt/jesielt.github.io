// Planeta: voo em primeira pessoa num mundo de ilhas e mar.
// y é a altura; a água fica em y = 0. Escala: ver ESCALA_SENTIDA (painel.js).

// three.js vem de um link via import(): funciona no site e abrindo o index.html direto.
// Versão oficial (muda no push). Ver CHANGELOG.md.
const VERSAO = '2.1.1';
console.log(`Planeta v${VERSAO}`);
// mostrada na tela, embaixo do nome
document.getElementById('versao').textContent = 'v' + VERSAO;

// Tela de toque: joystick, arrastar pra olhar e botões no lugar de teclado e mouse.
const TOQUE = matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;
if (TOQUE) {
  document.body.classList.add('toque');
  document.getElementById('convite').textContent = 'toque pra voar';
}

// Partes do jogo, uma por assunto, em js/. São scripts comuns (não módulos) e
// dividem as mesmas variáveis: ao carregar, um arquivo só usa o que veio antes
// na lista; dentro de funções, usa qualquer um. Arquivo novo: pôr na lista, na ordem.
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
