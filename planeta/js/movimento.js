// ---------------------------------------------------------------------
// Voo
// ---------------------------------------------------------------------
const vel = new THREE.Vector3();
const frente = new THREE.Vector3();
const direita = new THREE.Vector3();
const desejo = new THREE.Vector3();
let inclinacao = 0;
let giro = 0; // velocidade angular do olhar
let yawAntes = 0;

function suavizar(atual, alvo, rapidez, dt) {
  return atual + (alvo - atual) * (1 - Math.exp(-rapidez * dt));
}

// ---------------------------------------------------------------------
// Andar: voando a 1 m de um chão (ilha ou rocha), o jogador pousa; a câmera abaixa
// (flexão do joelho) e sobe à altura de pé. Andando: WASD move, Shift corre, Espaço decola.
// Na beira da ilha, escorrega para o mar; ao sair da ponta de uma rocha, cai.
// (17,5 unidades ≈ 1 m sentido)
// ---------------------------------------------------------------------
const ANDAR = {
  pousa: 17.5, // 1 m: voando a esta altura de um chão, pousa
  olhos: 29.75,        // 1,7 m: altura dos olhos de pé
  vel: 25, // ~1,4 m/s andando
  correr: 85, // ~4,9 m/s com Shift
  acel: 10, // rapidez para ganhar ou perder velocidade (maior = mais firme)
  degrau: 8, // ~45 cm: sobe sem voar
  passoAndando: 13, // ~75 cm entre passos
  passoCorrendo: 20,
  balanco: 0.55, // oscilação vertical da cabeça a cada passo (~3 cm)
  beira: 5, // ~30 cm da beira da ilha: escorrega
  decola: 40, // impulso vertical ao pressionar Espaço
  agacha: 5, // abaixamento da câmera no pouso (~30 cm)
  olhosEscorregando: 6, // escorregando, a posição é sentada
  raioPe: 4, // largura do corpo para colisão com paredes ao andar
};
let modo = 'voo';         // 'voo' | 'andar' | 'escorregar' | 'cair'
let tempoFauna = 0;
let pesY = 0; // altura dos pés (andando)
let olhosAgora = ANDAR.olhos; // altura dos olhos acima dos pés (varia no pouso)
let velQueda = 0; // queda de rocha ou escorregamento
let fasePasso = 0; // contagem de passos (cada inteiro = um pé no chão)
let balancoAgora = 0;
let tPouso = -1; // animação do pouso (-1 = inativa)
let pouso = { alt0: 0, dip: 0 };
const escorrega = { x: 0, z: 0, vel: 0 };
const _corpo = new THREE.Vector3();

// chão mais alto sob (x, z) que não passe de maxY: topo da ilha ou de uma rocha
function chaoSob(x, z, maxY) {
  let melhor = null;
  for (const ilha of ilhasPerto()) {
    for (const s of ilha.solidos) {
      if (s.mapa) { // rocha de relevo: altura no ponto
        const hy = alturaNoMapa(s, x, z);
        if (hy === -Infinity || hy > maxY || (melhor && hy <= melhor.h)) continue;
        melhor = { h: hy, s, beira: Infinity };
        continue;
      }
      if (s.h > maxY || (melhor && s.h <= melhor.h)) continue;
      const dx = x - s.x, dz = z - s.z;
      const c = Math.cos(s.giro), sn = Math.sin(s.giro);
      const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
      let larg = s.afina;
      larg *= formaDoSolido(s, Math.atan2(lz / s.rz, lx / s.rx));
      const q = Math.hypot(lx / (s.rx * larg), lz / (s.rz * larg));
      if (q >= 1) continue;
      melhor = { h: s.h, s, beira: (1 - q) * Math.min(s.rx, s.rz) * larg };
    }
  }
  return melhor;
}

// andando, rochas mais altas que um degrau são paredes: empurra para fora
function empurrarDaParede(s) {
  if (s.h <= pesY + ANDAR.degrau || pesY + olhosAgora < s.base) return;
  if (s.mapa) { afastarDoRelevo(s, pesY + ANDAR.degrau); return; }
  const p = camera.position;
  const dx = p.x - s.x, dz = p.z - s.z;
  const c = Math.cos(s.giro), sn = Math.sin(s.giro);
  const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
  const t = Math.min(1, Math.max(0, (pesY - s.base) / (s.h - s.base)));
  let larg = 1 + (s.afina - 1) * t;
  larg *= formaDoSolido(s, Math.atan2(lz / s.rz, lx / s.rx));
  const ex = s.rx * larg + ANDAR.raioPe, ez = s.rz * larg + ANDAR.raioPe;
  const q = Math.hypot(lx / ex, lz / ez);
  if (q >= 1) return;
  const fx = lx / q, fz = lz / q;
  p.x = s.x + fx * c + fz * sn;
  p.z = s.z - fx * sn + fz * c;
  const d = Math.hypot(dx, dz) || 1;
  const nx = dx / d, nz = dz / d;
  const contra = vel.x * nx + vel.z * nz;
  if (contra < 0) { vel.x -= contra * nx; vel.z -= contra * nz; }
}

// pouso: abaixa rapidamente (joelho) e sobe à altura de pé
function pousar(alt0, dip) {
  pouso.alt0 = alt0;
  pouso.dip = Math.max(0, Math.min(dip, alt0 - 2));
  olhosAgora = alt0;
  tPouso = 0;
}
const POUSO_DESCE = 0.11, POUSO_SOBE = 0.5;
function animarPouso(dt) {
  if (tPouso < 0) return;
  tPouso += dt;
  const fundo = pouso.alt0 - pouso.dip;
  if (tPouso < POUSO_DESCE) {
    olhosAgora = pouso.alt0 - pouso.dip * Math.sin((tPouso / POUSO_DESCE) * Math.PI / 2);
  } else {
    const u = Math.min(1, (tPouso - POUSO_DESCE) / POUSO_SOBE);
    olhosAgora = fundo + (ANDAR.olhos - fundo) * (1 - Math.pow(1 - u, 3));
    if (u >= 1) tPouso = -1;
  }
}

// voando a 1 m de um chão, pousa (segurando Espaço, continua voando)
function verificarPouso() {
  if (submerso || segurando('subir')) return;
  const p = camera.position;
  const c = chaoSob(p.x, p.z, p.y);
  if (!c || p.y - c.h > ANDAR.pousa) return;
  if (c.s.ondas && c.beira < ANDAR.beira * 2) return; // sobre a beira: não pousa (escorregaria imediatamente)
  modo = 'andar';
  pesY = c.h;
  vel.y = 0;
  velQueda = 0;
  const alt0 = Math.max(2, p.y - c.h);
  pousar(alt0, ANDAR.agacha);
  tocarPasso(false, 0, true);
}

function comecarEscorregar(s) {
  modo = 'escorregar';
  tPouso = -1;
  const p = camera.position;
  let dx = s ? p.x - s.x : vel.x, dz = s ? p.z - s.z : vel.z;
  if (!dx && !dz) { dx = -Math.sin(yaw); dz = -Math.cos(yaw); }
  const d = Math.hypot(dx, dz);
  escorrega.x = dx / d;
  escorrega.z = dz / d;
  escorrega.vel = Math.max(Math.hypot(vel.x, vel.z), 25);
  velQueda = 0;
}

function escorregar(dt) {
  const p = camera.position;
  p.x += escorrega.x * escorrega.vel * dt;
  p.z += escorrega.z * escorrega.vel * dt;
  escorrega.vel = suavizar(escorrega.vel, 18, 2, dt);
  velQueda -= GRAVIDADE * 0.6 * dt;
  pesY += velQueda * dt;
  const fundo = chaoDoMar(p.x, p.z);
  if (pesY < fundo) { pesY = fundo; velQueda = 0; }
  olhosAgora = suavizar(olhosAgora, ANDAR.olhosEscorregando, 5, dt);
  p.y = pesY + olhosAgora;
  vel.set(escorrega.x * escorrega.vel, velQueda, escorrega.z * escorrega.vel);
  // na água: volta ao voo (que, submerso, é o nado)
  const superficie = semMergulho ? AJUSTE.alturaOlhos : 0;
  if (p.y < superficie) {
    if (semMergulho) p.y = superficie;
    modo = 'voo';
    olhosAgora = ANDAR.olhos;
  }
}

// C duas vezes em sequência: abandona o voo e cai. No chão, pouso com abaixamento
// proporcional à velocidade da queda; na água, mergulho; Espaço durante a queda retoma o voo.
function desistirDoVoo() {
  if (modo !== 'voo' || submerso) return;
  modo = 'cair';
  tPouso = -1;
}
function cair(dt, u) {
  const p = camera.position;
  if (u > 0) { modo = 'voo'; return; }
  const yAntes = p.y;
  vel.y -= GRAVIDADE * dt;
  const ar = Math.exp(-0.4 * dt);
  vel.x *= ar;
  vel.z *= ar;
  p.addScaledVector(vel, dt);
  const c = chaoSob(p.x, p.z, yAntes);
  if (c && p.y - c.h <= ANDAR.pousa) {
    const impacto = -vel.y;
    modo = 'andar';
    pesY = c.h;
    vel.y = 0;
    velQueda = 0;
    const alt0 = Math.max(2, Math.min(ANDAR.pousa, p.y - c.h));
    pousar(alt0, ANDAR.agacha + Math.min(10, impacto * 0.04));
    tocarPasso(false, 0, true);
    return;
  }
  for (const ilha of ilhasPerto()) for (const s of ilha.solidos) colidir(s); // paredes
  const superficie = semMergulho ? AJUSTE.alturaOlhos : 0;
  if (p.y < superficie) {
    if (semMergulho) { p.y = superficie; vel.y = 0; }
    modo = 'voo'; // na água: volta ao voo (mergulho normal)
  }
}

function atualizarAndar(dt, f, l, u) {
  if (modo === 'escorregar') { escorregar(dt); return; }
  if (modo === 'cair') { cair(dt, u); return; }
  const p = camera.position;
  if (u > 0) { // Espaço: decola
    modo = 'voo';
    tPouso = -1;
    olhosAgora = ANDAR.olhos;
    vel.y = ANDAR.decola;
    return;
  }
  // move no plano do chão, na direção do olhar (o ângulo vertical não interfere)
  let dx = -Math.sin(yaw) * f + Math.cos(yaw) * l;
  let dz = -Math.cos(yaw) * f - Math.sin(yaw) * l;
  const m = Math.hypot(dx, dz);
  if (m > 1) { dx /= m; dz /= m; }
  const correndo = segurando('dash');
  const alvo = correndo ? ANDAR.correr : ANDAR.vel;
  // chegando do voo com embalo: desacelera gradualmente
  const rap = Math.hypot(vel.x, vel.z) > alvo * 1.05 ? 2.5 : ANDAR.acel;
  vel.x = suavizar(vel.x, dx * alvo, rap, dt);
  vel.z = suavizar(vel.z, dz * alvo, rap, dt);
  vel.y = 0;
  p.x += vel.x * dt;
  p.z += vel.z * dt;
  for (const ilha of ilhasPerto()) for (const s of ilha.solidos) empurrarDaParede(s);
  esbarrarNaFauna();

  const c = chaoSob(p.x, p.z, pesY + ANDAR.degrau);
  if (!c) { comecarEscorregar(null); escorregar(dt); return; }
  if (c.s.ondas && c.beira < ANDAR.beira && pesY <= c.h + 0.5) { comecarEscorregar(c.s); escorregar(dt); return; }

  let noChao = true;
  if (pesY > c.h + 0.01 && velQueda === 0 && pesY - c.h < ANDAR.degrau / 2) pesY = c.h; // descida de encosta: acompanha o chão
  if (pesY > c.h + 0.01) { // no ar: saiu da ponta de uma rocha
    noChao = false;
    velQueda -= GRAVIDADE * dt;
    pesY += velQueda * dt;
    if (pesY <= c.h) {
      pesY = c.h;
      noChao = true;
      if (velQueda < -40) { pousar(olhosAgora, Math.min(10, -velQueda * 0.05)); tocarPasso(false, 0, true); }
      velQueda = 0;
    }
  } else {
    pesY = c.h > pesY ? suavizar(pesY, c.h, 18, dt) : c.h; // degrau: sobe suavemente
    velQueda = 0;
  }
  animarPouso(dt);

  // passos: oscilação da cabeça e som a cada pé no chão
  const vh = Math.hypot(vel.x, vel.z);
  if (noChao && vh > 2) {
    const antes = Math.floor(fasePasso);
    fasePasso += vh * dt / (correndo ? ANDAR.passoCorrendo : ANDAR.passoAndando);
    const agora = Math.floor(fasePasso);
    if (agora !== antes) tocarPasso(correndo, agora % 2);
  }
  balancoAgora = suavizar(balancoAgora, noChao ? Math.min(1, vh / ANDAR.vel) * (correndo ? 1.6 : 1) : 0, 6, dt);
  p.y = pesY + olhosAgora + ANDAR.balanco * balancoAgora * Math.abs(Math.sin(Math.PI * fasePasso));
}

// ponto do corpo para colisão e captura: voando, os olhos; andando, rente ao chão
function pontoDoCorpo() {
  if (modo === 'voo' || modo === 'cair') return camera.position;
  return _corpo.set(camera.position.x, pesY + R_ESFERA, camera.position.z);
}

// Cada sólido é tratado como cilindro oval (que pode afinar no topo; a plataforma
// da ilha mantém o contorno irregular).
const FOLGA_LADO = 1.5; // distância mínima entre os olhos e uma parede
function colidir(s) {
  const p = camera.position;
  const olhos = AJUSTE.alturaOlhos;
  if (p.y >= s.h + olhos) return;
  if (p.y < s.base) return; // abaixo do sólido (submerso): tratado pela encosta
  if (s.mapa) { colidirComRelevo(s); return; }
  // converte a posição para o referencial do sólido (desfaz a rotação)
  const dx = p.x - s.x, dz = p.z - s.z;
  const c = Math.cos(s.giro), sn = Math.sin(s.giro);
  const lx = dx * c - dz * sn;
  const lz = dx * sn + dz * c;
  // largura na altura atual (a rocha afina para cima)
  const t = Math.min(1, Math.max(0, (p.y - s.base) / (s.h - s.base)));
  let larg = 1 + (s.afina - 1) * t;
  larg *= formaDoSolido(s, Math.atan2(lz / s.rz, lx / s.rx));
  const ex = s.rx * larg + FOLGA_LADO, ez = s.rz * larg + FOLGA_LADO;
  const q = Math.hypot(lx / ex, lz / ez);
  if (q >= 1) return;

  if (p.y > s.h - 2.5) {
    // chegada por cima: mantém-se na altura dos olhos
    p.y = s.h + olhos;
    if (vel.y < 0) vel.y = 0;
    return;
  }
  // colisão lateral: empurra para fora e desliza em volta
  const fx = lx / q, fz = lz / q;
  p.x = s.x + fx * c + fz * sn;
  p.z = s.z - fx * sn + fz * c;
  const d = Math.hypot(dx, dz) || 1;
  const nx = dx / d, nz = dz / d;
  const contra = vel.x * nx + vel.z * nz;
  if (contra < 0) { vel.x -= contra * nx; vel.z -= contra * nz; }
}


// Relevo das rochas (mapa de alturas). Parede: onde o chão passa de `limite`.
// Empurra o jogador morro abaixo, em passos curtos, até sair da parede, e
// anula a velocidade contra ela.
const _desce = new THREE.Vector3();
function alturaComFolga(s, x, z, f) {
  // a mais alta entre o ponto e quatro em volta: o corpo tem largura
  return Math.max(alturaNoMapa(s, x, z), alturaNoMapa(s, x + f, z), alturaNoMapa(s, x - f, z),
    alturaNoMapa(s, x, z + f), alturaNoMapa(s, x, z - f));
}
function afastarDoRelevo(s, limite, folga = ANDAR.raioPe) {
  const p = camera.position;
  if (alturaComFolga(s, p.x, p.z, folga) <= limite) return;
  descidaNoMapa(s, p.x, p.z, _desce);
  for (let k = 0; k < 40 && alturaComFolga(s, p.x, p.z, folga) > limite; k++) {
    p.x += _desce.x; p.z += _desce.z;
  }
  const contra = vel.x * _desce.x + vel.z * _desce.z;
  if (contra < 0) { vel.x -= contra * _desce.x; vel.z -= contra * _desce.z; }
}
// voando: chegando por cima, fica na altura dos olhos sobre o relevo; de lado, é parede
function colidirComRelevo(s) {
  const p = camera.position;
  const olhos = AJUSTE.alturaOlhos;
  const hy = alturaComFolga(s, p.x, p.z, FOLGA_LADO);
  if (hy === -Infinity || p.y >= hy + olhos) return;
  if (p.y > hy - 2.5) {
    p.y = hy + olhos;
    if (vel.y < 0) vel.y = 0;
    return;
  }
  afastarDoRelevo(s, p.y - 2.5, FOLGA_LADO);
}

// copa da árvore: esfera que empurra para fora (o tronco fino é atravessável)
const _d = new THREE.Vector3();
function colidirCopa(copa) {
  _d.set(camera.position.x - copa.x, camera.position.y - copa.y, camera.position.z - copa.z);
  const dist = _d.length();
  const min = copa.r + FOLGA_LADO;
  if (dist >= min) return;
  _d.divideScalar(dist || 1);
  camera.position.set(copa.x, copa.y, copa.z).addScaledVector(_d, min);
  const contra = vel.dot(_d);
  if (contra < 0) vel.addScaledVector(_d, -contra);
}

function voar(dt, f, l, u) {
  desejo.set(0, 0, 0)
    .addScaledVector(frente, f)
    .addScaledVector(direita, l);
  desejo.y += u;
  if (desejo.lengthSq() > 1) desejo.normalize();

  // debaixo d'água: menos impulso, mais atrito, dash fraco
  const nerf = submerso ? AGUA.nerf : 1;
  const dashLigado = segurando('dash');
  const fator = dashLigado ? (submerso ? AGUA.dash : AJUSTE.dash) : 1;
  vel.addScaledVector(desejo, AJUSTE.acel * fator * nerf * dt);
  // arranque: o dash engata quase de imediato, sem esperar a inércia (só fora d'água)
  if (dashLigado && !submerso && vel.length() < AJUSTE.velMax * fator * 0.95) {
    vel.addScaledVector(desejo, AJUSTE.arranqueDash * dt);
  }
  vel.multiplyScalar(Math.exp(-AJUSTE.arrasto * (submerso ? AGUA.arrasto : 1) * dt)); // inércia
  // acima do limite (ex.: Shift solto): desacelera suavemente
  const limite = AJUSTE.velMax * fator * nerf;
  const v = vel.length();
  if (v > limite) vel.setLength(suavizar(v, limite, 2.5, dt));

  camera.position.addScaledVector(vel, dt);

  // mergulho permitido: o chão é o fundo do mar ou a encosta submersa de uma ilha
  const chaoAqui = chaoDoMar(camera.position.x, camera.position.z) + AJUSTE.alturaOlhos;
  if (camera.position.y < chaoAqui) {
    camera.position.y = chaoAqui;
    if (vel.y < 0) vel.y = 0;
  }
  // "não mergulhar" ativo: a superfície funciona como chão
  if (semMergulho && !submerso && camera.position.y < AJUSTE.alturaOlhos) {
    camera.position.y = AJUSTE.alturaOlhos;
    if (vel.y < 0) vel.y = 0;
  }
  // entrada na água: perde quase todo o embalo
  const agoraSubmerso = camera.position.y < 0;
  if (agoraSubmerso && !submerso) {
    explosaoDeBolhas(vel.length()); // entrada rápida (dash): muitas bolhas de uma vez
    vel.multiplyScalar(AGUA.choque);
  }
  submerso = agoraSubmerso;

  // colisão com ilhas e rochas
  for (const ilha of ilhasPerto()) {
    for (const s of ilha.solidos) colidir(s);
    for (const copa of ilha.copas) colidirCopa(copa);
  }
  verificarPouso();
}

function atualizar(dt) {
  if (!(dt > 0)) return; // tempo nulo ou inválido: retorna (evita divisão por zero)
  // direções a partir do olhar
  frente.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  direita.set(Math.cos(yaw), 0, -Math.sin(yaw));

  // teclas + joystick do celular (força de 0 a 1 conforme o afastamento do dedo)
  const lim1 = x => Math.max(-1, Math.min(1, x));
  const f = lim1((segurando('frente') ? 1 : 0) - (segurando('tras') ? 1 : 0) + joy.f);
  const l = lim1((segurando('direita') ? 1 : 0) - (segurando('esquerda') ? 1 : 0) + joy.l);
  const u = (segurando('subir') ? 1 : 0) - (segurando('descer') ? 1 : 0);

  if (modo === 'voo') voar(dt, f, l, u);
  else atualizarAndar(dt, f, l, u);
  atualizarEsfera(dt);
  tempoFauna += dt;
  atualizarFauna(dt, tempoFauna);

  // o campo de visão abre com a velocidade e a câmera inclina de lado
  const rapidez = vel.length() / AJUSTE.velMax; // 1 = velocidade normal, 2 = dash
  const abre = (AJUSTE.fovVeloz - AJUSTE.fovParado) * (rapidez <= 1 ? rapidez : 1 + (rapidez - 1) * 0.6);
  camera.fov = suavizar(camera.fov, AJUSTE.fovParado + abre, 4, dt);
  camera.updateProjectionMatrix();
  // inclinação: para dentro da curva ao girar o mouse e para o lado com A/D
  // (girar à direita = yaw diminuindo = inclina à direita, como um avião)
  giro = suavizar(giro, (yaw - yawAntes) / dt, 10, dt);
  yawAntes = yaw;
  let alvoInclina = (giro * AJUSTE.inclinaCurva - l * AJUSTE.inclinaLado) * (modo === 'voo' ? 1 : 0.25);
  alvoInclina = Math.max(-AJUSTE.inclinaMax, Math.min(AJUSTE.inclinaMax, alvoInclina));
  inclinacao = suavizar(inclinacao, alvoInclina, 5, dt);

  camera.rotation.set(pitch, yaw, inclinacao);

  // céu e água acompanham a câmera
  ceu.position.copy(camera.position);
  for (const sat of satelites) sat.sprite.position.copy(camera.position).add(sat.dir);
  atualizarNuvens(dt);
  agua.position.x = Math.round(camera.position.x / LADRILHO) * LADRILHO;
  agua.position.z = Math.round(camera.position.z / LADRILHO) * LADRILHO;
  leito.position.x = camera.position.x;
  leito.position.z = camera.position.z;
  atualizarIlhas();
  // grama visível apenas nas ilhas próximas
  for (const ilha of ilhas.values()) {
    if (!ilha) continue;
    const longe = Math.hypot(ilha.x - camera.position.x, ilha.z - camera.position.z);
    ilha.tufos.visible = longe < DIST_TUFOS + Math.max(ilha.solidos[0].rx, ilha.solidos[0].rz);
  }

  // o desenho do mouse desloca-se na direção do movimento e retorna
  empurraoMouse.x = suavizar(empurraoMouse.x, 0, 10, dt);
  empurraoMouse.y = suavizar(empurraoMouse.y, 0, 10, dt);
  const mx = Math.max(-6, Math.min(6, empurraoMouse.x * 0.15));
  const my = Math.max(-6, Math.min(6, empurraoMouse.y * 0.15));
  desenhoMouse.style.setProperty('--mx', mx.toFixed(1) + 'px');
  desenhoMouse.style.setProperty('--my', my.toFixed(1) + 'px');
}
