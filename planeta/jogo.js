// Planeta: voo em primeira pessoa sobre ilhas e mar.
// Eixo y = altura; superfície da água em y = 0. Escala: ver ESCALA_SENTIDA (painel.js).

// three.js carregado por import(): funciona no site e com o index.html aberto direto.
// Versão oficial, alterada a cada publicação. Ver CHANGELOG.md.
const VERSAO = '2.2.3';
console.log(`Planeta v${VERSAO}`);
// Exibida na tela, abaixo do nome.
document.getElementById('versao').textContent = 'v' + VERSAO;

// Tela de toque: joystick, arrasto para olhar e botões no lugar de teclado e mouse.
const TOQUE = matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;
if (TOQUE) {
  document.body.classList.add('toque');
  document.getElementById('convite').setAttribute('aria-label', 'tap to fly');
}

// Partes do jogo em js/, uma por assunto. São scripts comuns (não módulos) e
// compartilham as variáveis: ao carregar, cada arquivo só acessa o que veio antes
// na lista; dentro de funções, acessa qualquer um. Arquivo novo entra na lista, na ordem.
const PARTES = [
  'cena', // ajustes, cores, cena, câmera, luz
  'ceu',        // céu, satélites, nuvens
  'agua',       // superfície do mar e fundo
  'rochas',     // rochas low-poly, contorno irregular, ruído 3D compartilhado
  'ilhas',      // ilhas, rochas, grama, árvores, saia submersa, quais ilhas existem
  'fauna', // fauna (sapos)
  'controles',  // teclado, mouse, toque, abertura
  'movimento',  // voo, andar, pouso, queda, colisão, atualizar()
  'esferas',    // as 7 esferas e a captura
  'reuniao',    // soltar esferas e reunir as 7 em terra
  'painel', // radar, linhas de velocidade, altura e velocidade
  'espirro', // espirro de água no dash rente ao mar
  'mergulho',   // debaixo d'água, bolhas, ar, recomeçar, céu escuro e raios
  'espaco', // subida ao espaço: planeta visto de fora, estrelas
  'poder', // bola de energia, explosão e fuligem
  'braco', // braço em primeira pessoa e disparo (clique esquerdo)
  'som',        // vento e passos
  'laco', // laço principal (sempre por último)
];

import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js').then(THREE => {
  window.THREE = THREE;
  for (const nome of PARTES) {
    const s = document.createElement('script');
    s.src = `js/${nome}.js?v=${VERSAO}`;
    s.async = false; // executa na ordem da lista
    s.onerror = () => console.error(`Planeta: não carregou js/${nome}.js`);
    document.body.appendChild(s);
  }
});
