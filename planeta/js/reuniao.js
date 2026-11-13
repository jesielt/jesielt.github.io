// ---------------------------------------------------------------------
// Soltar e reunir: clique no botão direito captura; segurar solta a esfera de
// menor número que estiver na caixa (no toque, segurar a própria caixa). Com
// as 7 soltas juntas em terra, elas pulsam em amarelo, passam a brilhar
// (as estrelas somem no brilho e a luz delas ilumina em volta) e o céu
// escurece com raios.
// ---------------------------------------------------------------------
const SEGURAR = 0.5;       // segundos com o botão pressionado para soltar
const DIST_REUNIAO = 90;   // distância máxima de cada esfera ao centro do grupo (~5 m sentidos)
const PISCADAS = 5;        // pulsos antes do brilho fixo
const CICLO_PISCADA = 2;   // segundos por pulso: 1 s acendendo, 1 s apagando
const AVISO_SOLTAR = 5;    // segundos em que o ícone pisca antes de ficar fixo
const LUZ_REUNIAO = 60;    // intensidade máxima da luz das esferas
const COR_CASCA = new THREE.Color('#7a3300');   // emissivo normal (ver materialDaCasca)
const COR_BRILHO = new THREE.Color('#ffe14a');  // emissivo no brilho máximo

let segurandoDesde = -1;   // instante do aperto, em ms (-1 = solto)
let juntouAs7 = false;     // as 7 já estiveram na caixa ao mesmo tempo
let reuniao = -1;          // segundos desde o início do evento (-1 = inativo)
const iconeSoltar = document.getElementById('soltar');
let piscarSoltar = 0;

// Luz das esferas: criada desde a abertura com intensidade 0. Acrescentar uma
// luz depois obrigaria a recompilar todos os materiais (travada visível).
const luzReuniao = new THREE.PointLight('#ffd75a', 0, 320, 1);
cena.add(luzReuniao);

// halo: brilho aditivo em volta de cada esfera
const texHalo = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255, 240, 150, 1)');
  gr.addColorStop(0.35, 'rgba(255, 200, 60, 0.55)');
  gr.addColorStop(1, 'rgba(255, 170, 30, 0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const halos = esferas.map(() => {
  const h = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texHalo, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  h.scale.set(R_ESFERA * 6, R_ESFERA * 6, 1);
  h.renderOrder = 3;
  h.visible = false;
  cena.add(h);
  return h;
});

// botão direito: clique (apertar e soltar antes de SEGURAR) captura; segurar solta
document.addEventListener('mousedown', ev => { if (ev.button === 2) segurandoDesde = performance.now(); });
document.addEventListener('mouseup', ev => {
  if (ev.button !== 2 || segurandoDesde < 0) return;
  segurandoDesde = -1;
  if (capturavel) capturar();
});
caixaEsferas.addEventListener('pointerdown', ev => { if (ev.pointerType !== 'mouse') segurandoDesde = performance.now(); });
for (const tipo of ['pointerup', 'pointercancel', 'pointerleave']) {
  caixaEsferas.addEventListener(tipo, () => { segurandoDesde = -1; });
}

// ilha cuja plataforma contém (x, z), entre as próximas do jogador
function ilhaSob(x, z) {
  for (const ilha of ilhasPerto()) {
    const s = ilha.solidos[0];
    const lx = (x - s.x) / s.rx, lz = (z - s.z) / s.rz;
    if (Math.hypot(lx, lz) < contorno(Math.atan2(lz, lx), s.ondas)) return ilha;
  }
  return null;
}

function soltarEsfera() {
  const e = esferas.find(x => x.capturada && x.sumindo <= 0);
  if (!e) return;
  e.capturada = false;
  const casa = caixaEsferas.querySelector(`[data-n="${e.n}"]`);
  if (casa) casa.classList.remove('pegou');
  // à frente do corpo, na direção do olhar, um pouco acima
  const corpo = pontoDoCorpo();
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const afasta = R_ESFERA + (modo === 'voo' ? RAIO_CORPO : RAIO_CORPO_ANDANDO) + 2;
  e.pos.set(corpo.x + fx * afasta, corpo.y + 3, corpo.z + fz * afasta);
  e.ilha = ilhaSob(e.pos.x, e.pos.z); // fora de ilha: cai no mar
  if (!e.casca) criarBola(e); // capturada pelo atalho de teste antes de pousar
  else {
    e.casca.scale.setScalar(1);
    e.estrelas.scale.set(R_ESFERA * 1.5, R_ESFERA * 1.5, 1);
    cena.add(e.casca, e.estrelas);
  }
  e.vel.set(vel.x * 0.5 + fx * 12, 8, vel.z * 0.5 + fz * 12);
  e.naAgua = e.pos.y < 0;
  e.avisoVisto = AVISO_CAPTURA; // sem o ícone de captura logo após soltar
}

// as 7 fora da caixa, paradas em terra e próximas umas das outras
function reunidasEmTerra() {
  let cx = 0, cz = 0;
  for (const e of esferas) {
    if (e.capturada || !e.casca || !e.ilha || e.naAgua || e.pos.y < 0) return false;
    if (e.vel.length() > 2) return false;
    cx += e.pos.x / 7; cz += e.pos.z / 7;
  }
  return esferas.every(e => Math.hypot(e.pos.x - cx, e.pos.z - cz) < DIST_REUNIAO);
}

// b: 0 = aparência normal, 1 = brilho máximo (estrelas encobertas pela luz).
// aura: halo e luz em volta (só durante os pulsos).
function aplicarBrilho(b, aura = true) {
  const a = aura ? b : 0;
  luzReuniao.position.set(0, 0, 0);
  esferas.forEach((e, k) => {
    if (!e.casca) return;
    e.casca.material.emissive.lerpColors(COR_CASCA, COR_BRILHO, b);
    e.estrelas.material.opacity = 1 - b;
    halos[k].visible = a > 0;
    halos[k].material.opacity = a * 0.9;
    halos[k].position.copy(e.pos);
    luzReuniao.position.addScaledVector(e.pos, 1 / 7);
  });
  luzReuniao.position.y += R_ESFERA * 3;
  luzReuniao.intensity = a * LUZ_REUNIAO;
}

function atualizarReuniao(dt) {
  if (segurandoDesde >= 0 && performance.now() - segurandoDesde > SEGURAR * 1000) {
    segurandoDesde = -1; // o mesmo aperto já não captura ao soltar o botão
    if (reuniao < 0) soltarEsfera();
  }
  // ícone: surge piscando quando as 7 estão na caixa, depois fica fixo
  if (!juntouAs7 && esferas.every(e => e.capturada)) {
    juntouAs7 = true;
    piscarSoltar = AVISO_SOLTAR;
    iconeSoltar.classList.add('visivel', 'piscando');
  }
  if (piscarSoltar > 0) {
    piscarSoltar -= dt;
    if (piscarSoltar <= 0) iconeSoltar.classList.remove('piscando');
  }
  if (reuniao < 0) {
    if (!juntouAs7 || !reunidasEmTerra()) return;
    reuniao = 0;
    iconeSoltar.classList.remove('visivel', 'piscando');
  }
  const antes = reuniao;
  reuniao += dt;
  const fim = PISCADAS * CICLO_PISCADA;
  // pulso em rampa: sobe de 0 a 1 na primeira metade do ciclo e desce na segunda
  const fase = (reuniao % CICLO_PISCADA) / CICLO_PISCADA;
  // depois dos pulsos: amarelas e sem estrelas, mas sem halo nem luz em volta
  if (reuniao < fim) aplicarBrilho(1 - Math.abs(fase * 2 - 1));
  else if (antes < fim) aplicarBrilho(1, false);
  if (antes < fim && reuniao >= fim) escurecerCeu();
}

// recomeço: tudo volta ao estado inicial
function reiniciarReuniao() {
  segurandoDesde = -1;
  juntouAs7 = false;
  reuniao = -1;
  piscarSoltar = 0;
  iconeSoltar.classList.remove('visivel', 'piscando');
  aplicarBrilho(0);
}
