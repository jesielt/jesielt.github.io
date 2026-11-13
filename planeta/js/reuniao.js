// ---------------------------------------------------------------------
// Soltar e reunir: segurar o botão direito solta a esfera de menor número que
// estiver na caixa (no toque, segurar a própria caixa). Com as 7 soltas juntas
// em terra, elas piscam em amarelo, passam a brilhar e o céu escurece com raios.
// ---------------------------------------------------------------------
const SEGURAR = 0.5;       // segundos com o botão pressionado para soltar
const DIST_REUNIAO = 90;   // distância máxima de cada esfera ao centro do grupo (~5 m sentidos)
const PISCADAS = 10, DUR_PISCADA = 0.3; // segundos por piscada
const AVISO_SOLTAR = 5;    // segundos em que o ícone pisca antes de ficar fixo
const COR_CASCA = new THREE.Color('#7a3300');   // emissivo normal (ver materialDaCasca)
const COR_PISCA = new THREE.Color('#fff200');
const COR_BRILHO = new THREE.Color('#ffb21e');

let segurandoDesde = -1;   // instante do aperto, em ms (-1 = solto)
let juntouAs7 = false;     // as 7 já estiveram na caixa ao mesmo tempo
let reuniao = -1;          // segundos desde o início do evento (-1 = inativo)
const iconeSoltar = document.getElementById('soltar');
let piscarSoltar = 0;

// botão direito: clique captura (se houver esfera ao alcance); segurar solta
document.addEventListener('mousedown', ev => {
  if (ev.button !== 2) return;
  if (capturavel) { capturar(); return; }
  segurandoDesde = performance.now();
});
document.addEventListener('mouseup', ev => { if (ev.button === 2) segurandoDesde = -1; });
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

function atualizarReuniao(dt) {
  if (segurandoDesde >= 0 && performance.now() - segurandoDesde > SEGURAR * 1000) {
    segurandoDesde = -1;
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
  const fim = PISCADAS * DUR_PISCADA;
  for (const e of esferas) {
    const m = e.casca.material;
    if (reuniao < fim) m.emissive.copy(reuniao % DUR_PISCADA < DUR_PISCADA / 2 ? COR_PISCA : COR_CASCA);
    else m.emissive.copy(COR_BRILHO);
  }
  if (antes < fim && reuniao >= fim) escurecerCeu();
}

// recomeço: tudo volta ao estado inicial
function reiniciarReuniao() {
  segurandoDesde = -1;
  juntouAs7 = false;
  reuniao = -1;
  piscarSoltar = 0;
  iconeSoltar.classList.remove('visivel', 'piscando');
  for (const e of esferas) if (e.casca) e.casca.material.emissive.copy(COR_CASCA);
}
