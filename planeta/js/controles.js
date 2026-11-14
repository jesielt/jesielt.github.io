// ---------------------------------------------------------------------
// Teclas (setas e WASD equivalem)
// ---------------------------------------------------------------------
const MAPA = {
  KeyW: 'frente',   ArrowUp: 'frente',
  KeyS: 'tras',     ArrowDown: 'tras',
  KeyA: 'esquerda', ArrowLeft: 'esquerda',
  KeyD: 'direita',  ArrowRight: 'direita',
  Space: 'subir',
  KeyC: 'descer',
  ShiftLeft: 'dash', ShiftRight: 'dash',
  KeyR: 'recomecar', // volta ao início (como ao acabar o ar)
  KeyM: 'mudo', // liga/desliga o som
  KeyH: 'ajuda', // mostra/oculta a lista de comandos
};
// o Shift direito acende o mesmo desenho do Shift esquerdo
const DESENHO = { ShiftRight: 'ShiftLeft' };

const apertadas = new Set();
let ultimoC = -1e9; // detecta o C pressionado duas vezes em sequência

function segurando(acao) {
  for (const codigo of apertadas) if (MAPA[codigo] === acao) return true;
  return false;
}

function marcarTecla(codigo, ligada) {
  const alvo = DESENHO[codigo] || codigo;
  document.querySelectorAll(`[data-tecla="${alvo}"]`)
    .forEach(el => el.classList.toggle('ativa', ligada));
}

function apertar(codigo) {
  if (!(codigo in MAPA)) return false;
  if (codigo === 'KeyR' && !apertadas.has(codigo)) recomecar();
  if (codigo === 'KeyM' && !apertadas.has(codigo)) alternarMudo();
  if (codigo === 'KeyH' && !apertadas.has(codigo)) alternarAjuda();
  if (codigo === 'KeyC' && !apertadas.has(codigo)) {
    const agora = performance.now();
    if (agora - ultimoC < 350) { desistirDoVoo(); ultimoC = -1e9; } else ultimoC = agora;
  }
  apertadas.add(codigo);
  marcarTecla(codigo, true);
  return true;
}

// Ajuda: ao abrir, o cursor é liberado (para clicar no X); um clique no jogo
// trava o cursor de novo.
const caixaAjuda = document.getElementById('ajuda');
function alternarAjuda(abrir = caixaAjuda.hidden) {
  caixaAjuda.hidden = !abrir;
  if (abrir && document.pointerLockElement) document.exitPointerLock();
}
document.getElementById('fecharAjuda').addEventListener('click', () => alternarAjuda(false));

function soltar(codigo) {
  if (apertadas.delete(codigo)) marcarTecla(codigo, false);
}

// Atalhos de teste (teclado numérico): 1-2-3 captura todas as esferas;
// 4-5-6 leva a 499 m (logo abaixo do espaço).
let codigoTeste = '';
window.addEventListener('keydown', e => {
  if (apertar(e.code)) e.preventDefault(); // impede a rolagem da página com setas e espaço
  if (/^Numpad\d$/.test(e.code)) {
    codigoTeste = (codigoTeste + e.code.slice(-1)).slice(-3);
    if (codigoTeste === '123') { codigoTeste = ''; pegarTodasAsEsferas(); }
    if (codigoTeste === '789') { codigoTeste = ''; mostrarFormasDasRochas(); } // teste: formas de rocha lado a lado
    if (codigoTeste === '456') { codigoTeste = ''; camera.position.y = 499 * ESCALA_SENTIDA; vel.set(0, 0, 0); } // teste: quase no espaço
  }
});
window.addEventListener('keyup', e => soltar(e.code));
window.addEventListener('blur', () => [...apertadas].forEach(soltar));

// clicar ou tocar nas teclas do painel equivale a pressioná-las
document.querySelectorAll('[data-tecla]').forEach(el => {
  const codigo = el.dataset.tecla;
  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch (erro) { /* ignorado */ }
    apertar(codigo);
  });
  const fim = () => soltar(codigo);
  el.addEventListener('pointerup', fim);
  el.addEventListener('pointercancel', fim);
  el.addEventListener('lostpointercapture', fim);
});

// ---------------------------------------------------------------------
// Mouse: o clique trava o cursor na tela; Esc libera (regra do navegador)
// ---------------------------------------------------------------------
const convite = document.getElementById('convite');
const desenhoMouse = document.getElementById('mouse');
const botaoEsq = document.getElementById('mouseEsq');
const botaoDir = document.getElementById('mouseDir');

let yaw = 0; // giro horizontal
let pitch = 0; // giro vertical
const empurraoMouse = { x: 0, y: 0 }; // deslocamento do desenho do mouse (efeito visual)

// Se o navegador não permitir travar o cursor, clicar e arrastar move o olhar.
let arrastando = false;

// Abertura: no primeiro clique, "FIND", "THE" e "BALLS" em letras saiyajin, crescendo e sumindo.
// Cada letra é formada por blocos numa grade 10×10 (tabela em Referências).
const LETRAS_SAIYAJIN = {
  A: [[0, 0, 10, 3], [2.5, 6.5, 5.5, 3.5]],
  B: [[0, 0, 3.2, 10], [6.8, 0, 3.2, 5.2]],
  D: [[0, 0, 3.4, 10], [6.6, 0, 3.4, 4], [6.6, 6, 3.4, 4]],
  E: [[0, 0, 10, 3], [0, 5, 3, 2.5], [0, 7, 10, 3]],
  F: [[0, 0, 3.2, 10], [4.6, 0, 5.4, 3.4], [7, 0, 3, 10]],
  H: [[1.5, 0, 7, 3.8, 1.9], [0, 6.3, 10, 3.7, 1.8]],
  I: [[0.8, 0, 3.4, 2.6], [0, 6.8, 10, 3.2]],
  L: [[0, 0.6, 3.4, 9.4], [6.4, 0, 3.6, 10], [4.8, 7.4, 2, 2.6]],
  N: [[0, 0, 10, 3], [7, 2.5, 3, 2.5], [0, 4.5, 10, 1.4], [0, 5.5, 3, 2], [0, 7.2, 10, 2.8]],
  S: [[0, 0, 8.8, 2.6], [7, 1, 3, 5.4], [0, 6, 10, 4]],
  T: [[0, 0, 4.4, 3], [1.9, 0, 2.5, 10], [0, 7, 4.4, 3], [5.8, 0, 4.2, 10]],
  W: [[0, 0, 10, 3.4, 1.5], [4.2, 5, 3.6, 3.6, 1]],
};
function palavraSaiyajin(texto) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  const passo = 13.5;
  svg.setAttribute('viewBox', `-1 -1 ${texto.length * passo - 3.5 + 2} 12`);
  svg.setAttribute('aria-label', texto);
  [...texto].forEach((l, n) => {
    for (const [x, y, w, h, r = 0.7] of LETRAS_SAIYAJIN[l]) {
      const ret = document.createElementNS(ns, 'rect');
      ret.setAttribute('x', x + n * passo); ret.setAttribute('y', y);
      ret.setAttribute('width', w); ret.setAttribute('height', h);
      ret.setAttribute('rx', r);
      svg.appendChild(ret);
    }
  });
  return svg;
}
let abriu = false;
function abertura() {
  if (abriu) return;
  abriu = true;
  const caixa = document.createElement('div');
  caixa.className = 'abertura';
  ['FIND', 'THE', 'BALLS'].forEach((p, k) => {
    const svg = palavraSaiyajin(p);
    svg.style.animationDelay = (0.15 + k * 0.42) + 's';
    caixa.appendChild(svg);
  });
  document.body.appendChild(caixa);
  setTimeout(() => caixa.remove(), 2500);
}

canvas.addEventListener('click', () => {
  convite.classList.add('escondido');
  abertura();
  if (TOQUE || document.pointerLockElement === canvas) return; // toque: sem trava de cursor
  try {
    const pedido = canvas.requestPointerLock();
    if (pedido && pedido.catch) pedido.catch(() => {});
  } catch (erro) { /* sem trava: modo arrastar */ }
});
document.addEventListener('pointerlockchange', () => {
  // liberado com Esc: o convite volta a aparecer. No toque não há trava; o
  // evento disparado pela tela cheia o faria reaparecer.
  if (TOQUE) return;
  convite.classList.toggle('escondido', document.pointerLockElement === canvas);
});
canvas.addEventListener('mousedown', () => { arrastando = true; });
window.addEventListener('mouseup', () => { arrastando = false; });
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas && !arrastando) return;
  yaw -= e.movementX * AJUSTE.sensibilidade;
  pitch -= e.movementY * AJUSTE.sensibilidade;
  const limite = Math.PI / 2 - 0.01;
  pitch = Math.max(-limite, Math.min(limite, pitch));
  empurraoMouse.x += e.movementX;
  empurraoMouse.y += e.movementY;
});
document.addEventListener('mousedown', e => {
  if (e.button === 0) botaoEsq.classList.add('ativa');
  if (e.button === 2) botaoDir.classList.add('ativa');
});
document.addEventListener('mouseup', e => {
  if (e.button === 0) botaoEsq.classList.remove('ativa');
  if (e.button === 2) botaoDir.classList.remove('ativa');
});
document.addEventListener('contextmenu', e => e.preventDefault());

// ---------------------------------------------------------------------
// Celular: dedo no lado esquerdo da tela = joystick (movimento); em qualquer outro
// lugar = arrasto para olhar. Cada dedo é rastreado em separado, permitindo mover
// e olhar ao mesmo tempo.
// ---------------------------------------------------------------------
const joy = { f: 0, l: 0, dedo: null, cx: 0, cy: 0 };
const joyBase = document.getElementById('joystick');
const joyBola = joyBase.querySelector('.joy-bola');
const olhares = new Map(); // dedo → última posição

function moverJoystick(x, y) {
  let dx = x - joy.cx, dy = y - joy.cy;
  const d = Math.hypot(dx, dy), r = AJUSTE.raioJoystick;
  if (d > r) { dx *= r / d; dy *= r / d; }
  joyBola.style.transform = `translate(${dx}px, ${dy}px)`;
  // zona morta pequena: o dedo apenas encostado não move
  const forca = d < 6 ? 0 : 1;
  joy.l = forca * dx / r;
  joy.f = forca * -dy / r;
}
function soltarJoystick() {
  joy.dedo = null; joy.f = 0; joy.l = 0;
  joyBola.style.transform = '';
  joyBase.classList.remove('ativo');
  joyBase.style.left = joyBase.style.top = '';
}
if (TOQUE) {
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault(); // evita o evento de mouse simulado após o toque
    if (tocouNaEsfera(e.clientX, e.clientY)) return; // toque na esfera: captura (sem mover nem girar)
    try { canvas.setPointerCapture(e.pointerId); } catch (erro) { /* ignorado */ }
    if (joy.dedo === null && e.clientX < window.innerWidth * 0.42) {
      joy.dedo = e.pointerId;
      joy.cx = e.clientX; joy.cy = e.clientY;
      joyBase.style.left = e.clientX + 'px';
      joyBase.style.top = e.clientY + 'px';
      joyBase.classList.add('ativo');
      moverJoystick(e.clientX, e.clientY);
    } else {
      olhares.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerId === joy.dedo) { moverJoystick(e.clientX, e.clientY); return; }
    const antes = olhares.get(e.pointerId);
    if (!antes) return;
    const dx = e.clientX - antes.x, dy = e.clientY - antes.y;
    antes.x = e.clientX; antes.y = e.clientY;
    yaw -= dx * AJUSTE.sensibilidadeToque;
    pitch -= dy * AJUSTE.sensibilidadeToque;
    const limite = Math.PI / 2 - 0.01;
    pitch = Math.max(-limite, Math.min(limite, pitch));
  });
  const fimDedo = e => {
    if (e.pointerId === joy.dedo) soltarJoystick();
    olhares.delete(e.pointerId);
  };
  canvas.addEventListener('pointerup', fimDedo);
  canvas.addEventListener('pointercancel', fimDedo);
  window.addEventListener('blur', () => {
    soltarJoystick(); olhares.clear();
    document.getElementById('toqueDash').classList.remove('ativa');
  });

  // primeiro toque: tela cheia e, se permitido, trava em paisagem
  canvas.addEventListener('pointerdown', () => {
    if (document.fullscreenElement) return;
    const el = document.documentElement;
    const pedir = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!pedir) return;
    try {
      const p = pedir.call(el, { navigationUI: 'hide' });
      if (p && p.then) p.then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
    } catch (erro) { /* sem tela cheia */ }
  });

  // dash: um toque liga, outro desliga (o polegar esquerdo está no joystick)
  MAPA.ToqueDash = 'dash';
  const botaoDash = document.getElementById('toqueDash');
  botaoDash.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (apertadas.has('ToqueDash')) soltar('ToqueDash'); else apertar('ToqueDash');
    botaoDash.classList.toggle('ativa', apertadas.has('ToqueDash'));
  });

  document.getElementById('toqueAjuda').addEventListener('click', () => alternarAjuda());

  // recomeçar pede confirmação (as esferas são perdidas)
  document.getElementById('toqueRecomecar').addEventListener('click', () => {
    if (confirm('Recomeçar do início? Você perde as esferas.')) recomecar();
  });
}
