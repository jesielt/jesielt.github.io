// ---------------------------------------------------------------------
// As 7 esferas: de 1 a 7 estrelas, sorteadas pelo mundo, cada uma pra um
// lado de onde você começa, de 600 a 5000 de distância (≈35 a 285 m na
// sua régua). Metade cai numa ilha, metade no fundo do mar.
// O mundo só existe perto de você, então cada esfera distante "pousa" na
// ilha grande mais perto do ponto dela quando você chega a ~1600 de lá;
// até isso, o radar já aponta pro ponto.
// Você esbarra, ela rola; se cair no mar, afunda devagar e rola pelo fundo.
// Chegando perto, aparece o botão direito do mouse: clicou, capturou.
// Tamanho: um pouco maior que uma cabeça (~30 cm na sensação).
// ---------------------------------------------------------------------
const R_ESFERA = 4.3;      // raio, em unidades daqui de dentro (~49 cm de diâmetro na sensação)
const RAIO_CORPO = 2;      // "tamanho" do seu corpo pra esbarrar nela (voando)
const RAIO_CORPO_ANDANDO = 8; // andando: o corpo todo (~45 cm pros lados), pra dar pra chutar fácil
const GRAVIDADE = 170;     // ≈ 9,8 m/s² na escala sentida
const DIST_POUSO = 1600;   // a essa distância do ponto, a esfera escolhe a ilha e aparece
const DIST_CAPTURA = 24;   // perto assim (~1,4 m), dá pra capturar
const AVISO_CAPTURA = 3;   // segundos que o aviso "clique pra capturar" aparece em cada esfera
const esferas = [];        // uma por número de estrelas (1 a 7)
const inicio = new THREE.Vector3(); // onde você começou (volta pra cá se o ar acabar)
let yawInicio = 0;
for (let n = 1; n <= 7; n++) {
  esferas.push({
    n,
    alvo: new THREE.Vector3(),  // ponto do mundo onde ela deve ficar
    pos: new THREE.Vector3(), vel: new THREE.Vector3(),
    origem: new THREE.Vector3(),// onde ela pousou (volta pra cá se afundar)
    ilha: null,                 // a ilha onde ela está (guardada mesmo se a ilha sair da memória)
    afundando: false, capturada: false,
    sumindo: 0,                 // > 0: animação de captura em andamento
    casca: null, estrelas: null,
  });
}

// estrelas vermelhas arrumadas de 1 a 7, "flutuando" dentro da bola
const ARRUMACAO = {
  1: [[0, 0]],
  2: [[-12, -12], [12, 12]],
  3: [[0, -17], [-15, 11], [15, 11]],
  4: [[-12, -19], [17, -10], [-17, 10], [12, 19]], // losango meio torto, como na referência
  5: [[0, 0], [-19, -16], [19, -16], [-19, 16], [19, 16]],
  6: [[-19, -12], [0, -21], [19, -12], [-19, 12], [0, 21], [19, 12]],
  7: [[0, 0], [-20, -11], [0, -22], [20, -11], [-20, 11], [0, 22], [20, 11]],
};
// zoom > 1 aproxima as estrelas (usado nas bolinhas da caixinha)
function canvasDasEstrelas(n, zoom = 1) {
  const t = 128, c = document.createElement('canvas');
  c.width = c.height = t;
  const g = c.getContext('2d');
  const r = (n <= 4 ? 10 : n === 5 ? 9 : 8) * zoom;
  g.fillStyle = '#d8261c';
  for (const [x, y] of ARRUMACAO[n]) {
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const rr = k % 2 ? r * 0.45 : r;
      g.lineTo(64 + x * zoom + Math.cos(a) * rr, 64 + y * zoom + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  }
  return c;
}
function texturaDasEstrelas(n) {
  const tex = new THREE.CanvasTexture(canvasDasEstrelas(n));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const raioDaIlha = il => (il.solidos[0].rx + il.solidos[0].rz) / 2;

// Vidro laranja grosso: opaco, mas com "volume" — o miolo fica mais claro
// e quente (como luz lá dentro) e a borda mais funda e escura. As estrelas
// são desenhadas por cima (a casca não grava profundidade), então parecem
// estar dentro. Só fica transparente quando afunda.
function materialDaCasca() {
  const m = new THREE.MeshPhongMaterial({
    color: '#f7a02c', emissive: '#7a3300', specular: '#fff6e0', shininess: 90,
    transparent: true, opacity: 1, depthWrite: false,
  });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
      float deFrente = clamp( dot( normal, normalize( vViewPosition ) ), 0.0, 1.0 );
      float borda = pow( 1.0 - deFrente, 1.4 );
      outgoingLight = mix( outgoingLight * 1.08 + vec3( 0.30, 0.17, 0.02 ) * deFrente * deFrente,
                           outgoingLight * 0.6, borda );
      diffuseColor.a *= 1.0 - 0.3 * borda * borda; // bordinha levemente transparente
      #include <opaque_fragment>
    `);
  };
  return m;
}

// põe a esfera num lugar livre da ilha (num lado qualquer) e cria a bola
function pousarNaIlha(e, ilha) {
  const s = ilha.solidos[0];
  const angBase = Math.random() * Math.PI * 2;
  let lugar = null;
  for (let tent = 0; tent < 40 && !lugar; tent++) {
    const ang = angBase + (tent % 2 ? 1 : -1) * Math.floor(tent / 2) * 0.12;
    const t = contorno(ang, s.ondas) * (0.75 - (tent % 5) * 0.08);
    const px = s.x + Math.cos(ang) * t * s.rx, pz = s.z + Math.sin(ang) * t * s.rz;
    if (!encostaEmRocha(px, pz, R_ESFERA + 3, ilha.solidos)) lugar = { px, pz, ang };
  }
  if (!lugar) return null;
  e.ilha = ilha;
  e.pos.set(lugar.px, s.h + R_ESFERA, lugar.pz);
  criarBola(e);
  return lugar;
}

// Todas as 7 são sorteadas do mesmo jeito: cada uma pra um lado de onde
// você começa (com folga), a uma distância qualquer entre 600 e 5000.
function criarEsferas() {
  inicio.copy(camera.position);
  yawInicio = yaw;
  const giro = Math.random() * Math.PI * 2;
  const ordem = esferas.map((e, k) => k).sort(() => Math.random() - 0.5);
  ordem.forEach((k, setor) => {
    const e = esferas[k];
    const ang = giro + (setor * Math.PI * 2) / 7 + (Math.random() - 0.5) * 0.5;
    const dist = 600 + Math.random() * 4400;
    e.alvo.set(inicio.x + Math.cos(ang) * dist, 0, inicio.z + Math.sin(ang) * dist);
    e.pos.copy(e.alvo); // até pousar, o radar aponta pra cá
    e.querAgua = Math.random() < 0.5; // metade cai numa ilha, metade no fundo do mar
  });
}

// cria a bola (casca + estrelas) onde a esfera está
function criarBola(e) {
  e.origem.copy(e.pos);
  e.vel.set(0, 0, 0);
  // casca: vidro laranja grosso, com volume (ver materialDaCasca)
  e.casca = new THREE.Mesh(new THREE.SphereGeometry(R_ESFERA, 32, 20), materialDaCasca());
  e.casca.renderOrder = 1;
  // estrelas: sempre de frente pra você
  e.estrelas = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaDasEstrelas(e.n), transparent: true }));
  e.estrelas.scale.set(R_ESFERA * 1.5, R_ESFERA * 1.5, 1);
  e.estrelas.renderOrder = 2;
  e.casca.position.copy(e.pos);
  e.estrelas.position.copy(e.pos);
  cena.add(e.casca, e.estrelas);
}

// no fundo do mar: um lugar perto do ponto dela, longe da plataforma das ilhas
function pousarNaAgua(e) {
  for (let tent = 0; tent < 30; tent++) {
    const r = tent * 12;
    const a = Math.random() * Math.PI * 2;
    const x = e.alvo.x + Math.cos(a) * r, z = e.alvo.z + Math.sin(a) * r;
    const chao = chaoDoMar(x, z);
    if (chao > -25) continue; // em cima de ilha ou rente à plataforma: procura mais longe
    e.ilha = null;
    e.pos.set(x, chao + R_ESFERA, z);
    criarBola(e);
    return true;
  }
  return false;
}

// esfera distante: quando você chega perto do ponto dela, escolhe onde fica
function tentarPousar(e) {
  if (Math.hypot(e.alvo.x - camera.position.x, e.alvo.z - camera.position.z) > DIST_POUSO) return;
  if (e.querAgua && pousarNaAgua(e)) return;
  let melhor = null, nota = Infinity;
  for (const ilha of ilhas.values()) {
    if (!ilha) continue;
    const s = ilha.solidos[0];
    const d = Math.hypot(s.x - e.alvo.x, s.z - e.alvo.z);
    if (d > 1200) continue;
    const n = d + (raioDaIlha(ilha) >= 90 ? 0 : 400); // prefere as grandes
    if (n < nota) { nota = n; melhor = ilha; }
  }
  if (!(melhor && pousarNaIlha(e, melhor))) pousarNaAgua(e); // sem ilha boa: vai pro fundo
}

// a esfera está em cima da plataforma da ilha dela?
function emCimaDaIlha(e, x, z) {
  if (!e.ilha) return false; // esfera do fundo do mar
  const s = e.ilha.solidos[0];
  const lx = (x - s.x) / s.rx, lz = (z - s.z) / s.rz;
  return Math.hypot(lx, lz) < contorno(Math.atan2(lz, lx), s.ondas);
}

const _n = new THREE.Vector3();
function atualizarUmaEsfera(e, dt) {
  const p = e.pos, v = e.vel;

  // capturando: encolhe e sobe pra perto de você, depois some
  if (e.sumindo > 0) {
    e.sumindo -= dt;
    const k = Math.max(0, e.sumindo / 0.35);
    p.lerp(camera.position, 1 - Math.exp(-10 * dt));
    e.casca.scale.setScalar(k);
    e.estrelas.scale.set(R_ESFERA * 1.5 * k, R_ESFERA * 1.5 * k, 1);
    e.casca.position.copy(p);
    e.estrelas.position.copy(p);
    if (e.sumindo <= 0) cena.remove(e.casca, e.estrelas);
    return;
  }

  // você esbarrou nela? empurra (e você não atravessa)
  const corpo = pontoDoCorpo();
  _n.subVectors(p, corpo);
  const dist = _n.length();
  const min = R_ESFERA + (modo === 'voo' ? RAIO_CORPO : RAIO_CORPO_ANDANDO);
  if (dist < min) {
    _n.divideScalar(dist || 1);
    // empurra você pra fora dela (andando, só pro lado: os pés ficam no chão)
    const ex = p.x - _n.x * min - corpo.x, ey = p.y - _n.y * min - corpo.y, ez = p.z - _n.z * min - corpo.z;
    camera.position.x += ex;
    camera.position.z += ez;
    if (modo === 'voo') camera.position.y += ey;
    const aproxima = vel.dot(_n) - v.dot(_n); // quão rápido você vinha na direção dela
    if (aproxima > 0) {
      // andando/correndo o chute pega mais (o corpo todo empurra); voando, o toque é mais leve
      v.addScaledVector(_n, aproxima * (modo === 'voo' ? 1.3 : 2.2));
      vel.addScaledVector(_n, -aproxima * 0.35); // você perde um pouco de velocidade
      somDaEsfera(e, aproxima);
    }
  }

  const s = e.ilha ? e.ilha.solidos[0] : null;
  const sobreIlha = emCimaDaIlha(e, p.x, p.z);

  const naAgua = p.y < 0;
  if (naAgua && !e.naAgua) v.multiplyScalar(AGUA.choque); // tchibum: perde o embalo
  e.naAgua = naAgua;
  if (naAgua) {
    // debaixo d'água: afunda devagar (a água segura) e tudo freia ("nerfado")
    const gAgua = GRAVIDADE * AGUA.gravidadeEsfera;
    v.y -= gAgua * dt;
    v.multiplyScalar(Math.exp(-AGUA.arrastoEsfera * dt));
    p.addScaledVector(v, dt);
    const chao = chaoDoMar(p.x, p.z);
    if (p.y - R_ESFERA <= chao) {
      p.y = chao + R_ESFERA;
      if (v.y < 0) v.y = 0;
      // chão inclinado (encosta da ilha, montinho): rola morro abaixo
      const d = 1.5;
      const gx = (chaoDoMar(p.x + d, p.z) - chaoDoMar(p.x - d, p.z)) / (2 * d);
      const gz = (chaoDoMar(p.x, p.z + d) - chaoDoMar(p.x, p.z - d)) / (2 * d);
      v.x -= Math.max(-3, Math.min(3, gx)) * gAgua * dt;
      v.z -= Math.max(-3, Math.min(3, gz)) * gAgua * dt;
      v.x *= Math.exp(-1.2 * dt);
      v.z *= Math.exp(-1.2 * dt);
    }
  } else {
    v.y -= GRAVIDADE * dt;
    p.addScaledVector(v, dt);

    if (sobreIlha && p.y - R_ESFERA <= s.h) {
      // no chão: quica um tiquinho e rola com atrito da grama
      p.y = s.h + R_ESFERA;
      v.y = v.y < -15 ? -v.y * 0.3 : 0;
      v.x *= Math.exp(-0.7 * dt);
      v.z *= Math.exp(-0.7 * dt);
      if (Math.hypot(v.x, v.z) < 0.05) { v.x = 0; v.z = 0; }
    }

    // bate nos troncos das árvores (só a esfera: você atravessa, pra não enroscar voando)
    for (const arv of (e.ilha ? e.ilha.copas : [])) {
      if (p.y - R_ESFERA > arv.topo || p.y + R_ESFERA < arv.chao) continue;
      const dx = p.x - arv.x, dz = p.z - arv.z;
      const d = Math.hypot(dx, dz), min = arv.grossura + R_ESFERA;
      if (d >= min) continue;
      const nx = dx / (d || 1), nz = dz / (d || 1);
      p.x = arv.x + nx * min;
      p.z = arv.z + nz * min;
      const contra = v.x * nx + v.z * nz;
      if (contra < 0) { v.x -= 1.5 * contra * nx; v.z -= 1.5 * contra * nz; somDaEsfera(e, -contra); } // quica e perde metade
    }

    // 3) bate nos bichos (sapo de tabela!): quica neles e eles fogem
    for (const ilha of ilhasPerto()) {
      for (const b of ilha.fauna || []) {
        const sc = b.g.scale.x, raio = b.esp.raio * sc;
        const bx = ilha.x + b.g.position.x, bz = ilha.z + b.g.position.z, by = b.g.position.y;
        if (p.y - R_ESFERA > by + b.esp.altura * sc || p.y + R_ESFERA < by) continue;
        const dx = p.x - bx, dz = p.z - bz;
        const d = Math.hypot(dx, dz), min = raio + R_ESFERA;
        if (d >= min) continue;
        const nx = dx / (d || 1), nz = dz / (d || 1);
        p.x = bx + nx * min;
        p.z = bz + nz * min;
        const contra = v.x * nx + v.z * nz;
        if (contra < 0) { v.x -= 1.7 * contra * nx; v.z -= 1.7 * contra * nz; somDaEsfera(e, -contra); }
        assustar(b);
      }
    }

    // bate nas rochas da ilha e volta
    for (let n = 1; n < (e.ilha ? e.ilha.solidos.length : 0); n++) {
      const r = e.ilha.solidos[n];
      if (p.y - R_ESFERA >= r.h) continue;
      const dx = p.x - r.x, dz = p.z - r.z;
      const c = Math.cos(r.giro), sn = Math.sin(r.giro);
      const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
      const q = Math.hypot(lx / (r.rx + R_ESFERA), lz / (r.rz + R_ESFERA));
      if (q >= 1) continue;
      p.x = r.x + (lx / q) * c + (lz / q) * sn;
      p.z = r.z - (lx / q) * sn + (lz / q) * c;
      const d = Math.hypot(dx, dz) || 1;
      const nx = dx / d, nz = dz / d;
      const contra = v.x * nx + v.z * nz;
      if (contra < 0) { v.x -= 1.5 * contra * nx; v.z -= 1.5 * contra * nz; somDaEsfera(e, -contra); }
    }
  }

  // rolar: gira a casca em volta do eixo deitado, na medida do caminho andado
  const vh = Math.hypot(v.x, v.z);
  if (vh > 0.01) {
    _n.set(v.z, 0, -v.x).normalize();
    const giro = (vh * dt) / R_ESFERA;
    e.casca.rotateOnWorldAxis(_n, giro);
    // as estrelas viram junto, pro lado que ela rola na sua tela
    const lado = Math.sign(v.x * Math.cos(yaw) - v.z * Math.sin(yaw)) || 1;
    e.estrelas.material.rotation -= giro * lado;
  }
  e.casca.position.copy(p);
  e.estrelas.position.copy(p);
}

// ---------- captura ----------
const iconeCaptura = document.getElementById('capturar');
const caixaEsferas = document.getElementById('caixaEsferas');
// cada bolinha da caixinha mostra as estrelas dela (nada de número: a
// arrumação e a quantidade de estrelas já dizem qual é)
for (const casa of caixaEsferas.querySelectorAll('.casa')) {
  const n = Number(casa.dataset.n);
  const bola = casa.querySelector('.bola');
  bola.textContent = '';
  bola.setAttribute('aria-label', n === 1 ? '1 estrela' : `${n} estrelas`);
  bola.style.backgroundImage = `url(${canvasDasEstrelas(n, 1.9).toDataURL()}), ` +
    'radial-gradient(circle at 35% 30%, #ffe2a4 0%, #f7a02c 45%, #c8650f 100%)';
}
let capturavel = null; // a esfera que dá pra capturar agora (ou null)
const _tela = new THREE.Vector3();

function capturar() {
  const e = capturavel;
  if (!e || e.capturada) return;
  e.capturada = true;
  e.sumindo = 0.35;
  capturavel = null;
  iconeCaptura.classList.remove('visivel');
  const casa = caixaEsferas.querySelector(`[data-n="${e.n}"]`);
  if (casa) casa.classList.add('pegou');
  // pegou a última debaixo d'água: o céu só muda quando você sair (senão não dá pra ver)
  if (esferas.every(x => x.capturada)) {
    if (submerso) ceuPendente = true;
    else escurecerCeu();
  }
}
// dev: pega todas de uma vez (1-2-3 no teclado numérico)
function pegarTodasAsEsferas() {
  for (const e of esferas) {
    if (e.capturada) continue;
    capturavel = e;
    capturar();
    // a que ainda nem pousou (longe, sem bola 3D) não tem animação pra fazer
    if (!e.casca) e.sumindo = 0;
  }
}
document.addEventListener('mousedown', ev => { if (ev.button === 2) capturar(); });
iconeCaptura.addEventListener('click', capturar); // sem mouse (ex.: tablet com caneta): toca no ícone

// Celular: tocar na própria esfera captura (sem ícone de mouse).
// Folga generosa em volta, porque o dedo é grosso e a esfera é pequena na tela.
const _borda = new THREE.Vector3();
function esferaNaTela(e) {
  _tela.copy(e.pos).project(camera);
  if (_tela.z >= 1) return null; // atrás de você
  const x = (_tela.x + 1) / 2 * window.innerWidth;
  const y = (1 - _tela.y) / 2 * window.innerHeight;
  // raio na tela: projeta um ponto na borda (de lado, em relação ao olhar)
  _borda.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(R_ESFERA).add(e.pos).project(camera);
  const r = Math.abs((_borda.x - _tela.x) / 2 * window.innerWidth);
  return { x, y, r };
}
function tocouNaEsfera(x, y) {
  if (!capturavel) return false;
  const t = esferaNaTela(capturavel);
  if (!t || Math.hypot(x - t.x, y - t.y) > Math.max(t.r * 1.6, 44)) return false;
  capturar();
  return true;
}

function atualizarEsfera(dt) {
  capturavel = null;
  let maisPerto = DIST_CAPTURA;
  for (const e of esferas) {
    if (e.capturada && e.sumindo <= 0) continue;
    if (!e.casca) { tentarPousar(e); continue; }
    atualizarUmaEsfera(e, dt);
    if (e.capturada) continue;
    const d = pontoDoCorpo().distanceTo(e.pos);
    if (d < maisPerto) { maisPerto = d; capturavel = e; }
  }
  // o aviso (ícone do mouse / anel) aparece só nos primeiros 3 s perto de
  // cada esfera e depois some de vez; capturar continua funcionando igual
  let aviso = capturavel;
  if (aviso) {
    aviso.avisoVisto = (aviso.avisoVisto || 0) + dt;
    if (aviso.avisoVisto > AVISO_CAPTURA) aviso = null;
  }
  // celular: em vez do ícone de mouse, um anel pulsando em volta da esfera ("toca aqui")
  if (TOQUE) {
    const t = aviso && esferaNaTela(aviso);
    iconeCaptura.classList.toggle('visivel', !!t);
    if (t) {
      const d = Math.max(t.r * 2.4, 56);
      iconeCaptura.style.left = t.x + 'px';
      iconeCaptura.style.top = t.y + 'px';
      iconeCaptura.style.width = iconeCaptura.style.height = d + 'px';
    }
    return;
  }
  // ícone do botão direito em cima da esfera capturável
  if (aviso) {
    _tela.copy(aviso.pos);
    _tela.y += R_ESFERA * 1.8;
    _tela.project(camera);
    const naFrente = _tela.z < 1 && Math.abs(_tela.x) < 1.1 && Math.abs(_tela.y) < 1.1;
    iconeCaptura.classList.toggle('visivel', naFrente);
    if (naFrente) {
      iconeCaptura.style.left = ((_tela.x + 1) / 2 * window.innerWidth) + 'px';
      iconeCaptura.style.top = ((1 - _tela.y) / 2 * window.innerHeight) + 'px';
    }
  } else {
    iconeCaptura.classList.remove('visivel');
  }
}
