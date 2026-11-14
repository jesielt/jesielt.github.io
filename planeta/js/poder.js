// ---------------------------------------------------------------------
// Bola de energia: sai do bocal do braço-canhão (braco.js), voa na direção da mira, alonga-se
// um pouco no voo e explode ao tocar terra, rocha, árvore ou água. A explosão
// tem clarão, luz e poeira; em terra, deixa uma mancha de fuligem.
// Escala: 17,5 unidades ≈ 1 m sentido.
// ---------------------------------------------------------------------
const PODER = {
  raio: 4.4, // raio da bola carregada (unidades)
  velocidade: 650, // unidades/s
  alcance: 3000, // some depois desta distância sem tocar nada
  oval: 1.35, // alongamento na direção do voo
  tempoOval: 0.12, // s até atingir o alongamento
  // rastro: cada trecho some com a idade; o mais velho some primeiro
  vidaRastro: 1.5, // s até o trecho mais velho sumir
  quedaRastro: 5, // quanto maior, mais curto o trecho bem visível
  larguraRastro: 0.3, // largura junto à bola, em múltiplos do raio
  raioMancha: 2, // raio da fuligem, em múltiplos do raio da bola
  opacidadeFuligem: 0.55, // densidade do preto (1 = preto total)
  folgaMancha: 0.06, // afastamento da fuligem da superfície (evita cintilação)
  manchasMax: 60, // as mais antigas são removidas
  luzBola: 900, // intensidade da luz da bola em voo (cai com o quadrado da distância)
  luzExplosao: 6000, // intensidade do clarão da explosão
  raioExplosao: 2.2, // base do tamanho do clarão (unidades)
  tempoClarao: 0.35, // s
  // fumaça: uma nuvem grande que se expande, sobe e se desfaz
  diametroFumaca: 160, // unidades (~9 m)
  nPoeira: 22, // tufos por explosão
  tempoPoeira: 1.5, // s: estoura rápido, fica densa um instante e se desfaz
  opacidadeFumaca: 0.95,
  segueDensa: 0.35, // fração do tempo em que a fumaça fica densa antes de sumir
  corBola: '#ff1414', // halo, rastro e luz
  corCasca: '#c40812', // camada externa da bola: vermelho fechado, opaco
  opacidadeCasca: 0.45, // translúcida: o núcleo brilha através dela
  corNucleo: '#ffe2dc', // centro quente, quase branco: dá o aspecto de plasma
  tamanhoHalo: 3.4, // diâmetro do halo, em múltiplos do raio (maior = mais "fofo")
  corClarao: '#ffc4b5', // clarão da explosão
  corPoeira: '#aaa7a3', // cinza levemente quente
  corNevoa: '#e4f1ec', // poeira sobre a água
};

// Textura de brilho: branca, opaca no centro e transparente na borda (a cor
// vem do material).
function texturaDeBrilho() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.22, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// Mancha macia de contorno irregular (poeira e fuligem): vários discos borrados.
function texturaDeMancha(n, espalha, borda, alfa = 0.5) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, d = Math.random() * espalha;
    const x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d;
    const r = 64 - espalha - Math.random() * 10;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${alfa})`);
    g.addColorStop(borda, `rgba(255,255,255,${alfa * 0.6})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(c);
}
const texBrilho = texturaDeBrilho();
const texPoeira = texturaDeMancha(7, 14, 0.6, 0.8); // densa
const texFuligem = texturaDeMancha(10, 12, 0.75);

const geoBola = new THREE.SphereGeometry(1, 20, 14);
const matNucleo = new THREE.MeshBasicMaterial({ color: PODER.corNucleo, fog: false });
// Casca com mistura normal: o brilho aditivo somaria o vermelho ao verde do
// cenário e a bola ficaria amarelada.
const matCasca = new THREE.MeshBasicMaterial({
  color: PODER.corCasca, transparent: true, opacity: PODER.opacidadeCasca, depthWrite: false, fog: false,
});
const matHalo = new THREE.SpriteMaterial({
  map: texBrilho, color: PODER.corBola, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
});
// fuligem: escura, recebe luz e sombra como o chão
const matFuligem = new THREE.MeshLambertMaterial({
  color: '#16110c', map: texFuligem, transparent: true, opacity: PODER.opacidadeFuligem, depthWrite: false,
});
neblinaEsferica(matFuligem);

// Visual da bola com raio 1 (o grupo é escalado). Usado também na palma.
function visualDaBola() {
  const g = new THREE.Group();
  const casca = new THREE.Mesh(geoBola, matCasca);
  casca.scale.setScalar(1.25);
  const halo = new THREE.Sprite(matHalo);
  halo.scale.setScalar(PODER.tamanhoHalo);
  g.add(new THREE.Mesh(geoBola, matNucleo), casca, halo);
  return g;
}

// Luz única da bola e da explosão: fica sempre na cena (intensidade 0 em
// repouso), pois mudar o número de luzes recompila os materiais.
const luzPoder = new THREE.PointLight(PODER.corBola, 0, 0, 2);
cena.add(luzPoder);

// Exemplares visíveis só na compilação inicial (laco.js), ocultos no primeiro quadro.
const prototiposPoder = new THREE.Group();
prototiposPoder.add(visualDaBola(), new THREE.Sprite(new THREE.SpriteMaterial({ map: texPoeira, transparent: true, depthWrite: false })),
  new THREE.Mesh(new THREE.PlaneGeometry(1, 1), matFuligem));
cena.add(prototiposPoder);

let DecalGeometry = null;
import('three/addons/geometries/DecalGeometry.js').then(m => { DecalGeometry = m.DecalGeometry; })
  .catch(e => console.error('Planeta: não carregou DecalGeometry', e));

// ---------------------------------------------------------------------
// Colisão: raio contra as malhas das ilhas carregadas e contra o mar.
// ---------------------------------------------------------------------
const _infoIlha = new WeakMap();
// Malhas sólidas da ilha (sem tufos e algas, instanciados) e esfera que a contém.
function infoDaIlha(ilha) {
  let info = _infoIlha.get(ilha);
  if (info) return info;
  ilha.grupo.updateMatrixWorld(true);
  const bichos = new Set();
  for (const b of ilha.fauna || []) if (b && b.g) b.g.traverse(o => bichos.add(o));
  const malhas = [];
  ilha.grupo.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    malhas.push(o);
  });
  const esfera = new THREE.Box3().setFromObject(ilha.grupo).getBoundingSphere(new THREE.Sphere());
  info = { malhas, fixas: malhas.filter(m => !bichos.has(m)), esfera };
  _infoIlha.set(ilha, info);
  return info;
}

const _raio = new THREE.Raycaster();
const _dirT = new THREE.Vector3();
const _esfT = new THREE.Sphere(), _esfM = new THREE.Sphere();
const _normal3 = new THREE.Matrix3();
const _cima = new THREE.Vector3(0, 1, 0);
const _candidatas = [];

// Primeiro toque no segmento a→b: { dist, ponto, normal, agua, ilha } ou null.
function primeiroToque(a, b) {
  _dirT.subVectors(b, a);
  const len = _dirT.length();
  if (len < 1e-6) return null;
  _dirT.divideScalar(len);
  let melhor = null;
  // superfície do mar, de cima para baixo
  if (a.y > 0 && b.y <= 0) {
    const d = (a.y / (a.y - b.y)) * len;
    melhor = { dist: d, ponto: a.clone().addScaledVector(_dirT, d), normal: _cima.clone(), agua: true, ilha: null };
  }
  _esfT.center.lerpVectors(a, b, 0.5);
  _esfT.radius = len / 2;
  _raio.set(a, _dirT);
  for (const ilha of ilhas.values()) {
    if (!ilha) continue;
    const info = infoDaIlha(ilha);
    if (!info.esfera.intersectsSphere(_esfT)) continue;
    // só as malhas perto do segmento passam pelo teste de triângulos
    _candidatas.length = 0;
    for (const m of info.malhas) {
      _esfM.copy(m.geometry.boundingSphere).applyMatrix4(m.matrixWorld);
      if (_esfM.intersectsSphere(_esfT)) _candidatas.push(m);
    }
    if (!_candidatas.length) continue;
    _raio.far = melhor ? melhor.dist : len;
    const h = _raio.intersectObjects(_candidatas, false)[0];
    if (!h) continue;
    const n = h.face.normal.clone().applyMatrix3(_normal3.getNormalMatrix(h.object.matrixWorld)).normalize();
    if (n.dot(_dirT) > 0) n.negate();
    melhor = { dist: h.distance, ponto: h.point, normal: n, agua: false, ilha };
  }
  // fundo do mar
  if (!melhor && b.y < 0 && b.y < chaoDoMar(b.x, b.z)) {
    melhor = { dist: len, ponto: b.clone(), normal: _cima.clone(), agua: true, ilha: null };
  }
  return melhor;
}

// ---------------------------------------------------------------------
// Bolas em voo
// ---------------------------------------------------------------------
const bolas = [];
const _frenteCam = new THREE.Vector3();
const _prox = new THREE.Vector3();

// dirCam: direção da palma vista da câmera (unitária, espaço da câmera);
// razao: raio aparente da bola na palma ÷ distância. A bola surge no cenário
// onde tem o mesmo tamanho aparente.
function lancarBola(dirCam, razao) {
  const d0 = PODER.raio / razao;
  const dir = dirCam.clone().applyQuaternion(camera.quaternion);
  const inicio = camera.position.clone().addScaledVector(dir, d0);
  // algo entre os olhos e o ponto de saída: explode ali
  const perto = primeiroToque(camera.position, inicio);
  if (perto) { explodir(perto); return; }
  // mira: o que está no centro da tela
  _frenteCam.set(0, 0, -1).applyQuaternion(camera.quaternion);
  const longe = camera.position.clone().addScaledVector(_frenteCam, PODER.alcance);
  const alvo = primeiroToque(camera.position, longe);
  if (alvo && alvo.dist <= d0) { explodir(alvo); return; }
  const vel = (alvo ? alvo.ponto : longe).clone().sub(inicio).normalize().multiplyScalar(PODER.velocidade);
  const g = visualDaBola();
  g.position.copy(inicio);
  cena.add(g);
  const rastro = criarRastro();
  rastro.pontos.push({ p: inicio.clone(), t: performance.now() / 1000 });
  bolas.push({ g, vel, idade: 0, percorrido: 0, rastro });
}

// ---------------------------------------------------------------------
// Rastro: fita voltada para a câmera ao longo dos pontos por onde a bola
// passou. Cada ponto apaga com a própria idade, então o trecho mais velho some
// primeiro; depois da explosão o rastro termina de apagar sozinho.
// Brilho aditivo: a cor do vértice já carrega a transparência.
// ---------------------------------------------------------------------
const RASTRO_MAX = 256; // pontos por rastro
const rastros = [];
const matRastro = new THREE.MeshBasicMaterial({
  vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
});
// exemplar para a compilação inicial (cores por vértice geram outro programa)
prototiposPoder.add(new THREE.Mesh(new THREE.BufferGeometry()
  .setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3))
  .setAttribute('color', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3)), matRastro));
const _corRastro = new THREE.Color(), _corBranca = new THREE.Color('#ffffff');
const _tanRastro = new THREE.Vector3(), _ladoRastro = new THREE.Vector3(), _olhoRastro = new THREE.Vector3();
function criarRastro() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RASTRO_MAX * 6), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(RASTRO_MAX * 6), 3));
  const idx = [];
  for (let i = 0; i < RASTRO_MAX - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geo.setIndex(idx);
  geo.setDrawRange(0, 0);
  const malha = new THREE.Mesh(geo, matRastro);
  malha.frustumCulled = false;
  cena.add(malha);
  const r = { pontos: [], malha };
  rastros.push(r);
  return r;
}
// Remonta a fita. Devolve false quando o rastro apagou (e o remove).
function atualizarRastro(r, agora) {
  const P = PODER;
  while (r.pontos.length && agora - r.pontos[0].t > P.vidaRastro) r.pontos.shift();
  while (r.pontos.length > RASTRO_MAX) r.pontos.shift();
  const n = r.pontos.length;
  const geo = r.malha.geometry;
  if (n < 2) {
    geo.setDrawRange(0, 0);
    if (n === 0 && !bolas.some(b => b.rastro === r)) { cena.remove(r.malha); geo.dispose(); return false; }
    return true;
  }
  const pos = geo.attributes.position, cor = geo.attributes.color;
  for (let i = 0; i < n; i++) {
    const p = r.pontos[i].p;
    _tanRastro.subVectors(r.pontos[Math.min(n - 1, i + 1)].p, r.pontos[Math.max(0, i - 1)].p);
    _olhoRastro.subVectors(camera.position, p);
    _ladoRastro.crossVectors(_tanRastro, _olhoRastro).normalize();
    const vivo = Math.max(0, 1 - (agora - r.pontos[i].t) / P.vidaRastro) ** P.quedaRastro;
    const larg = P.raio * P.larguraRastro * Math.sqrt(vivo);
    pos.setXYZ(i * 2, p.x + _ladoRastro.x * larg, p.y + _ladoRastro.y * larg, p.z + _ladoRastro.z * larg);
    pos.setXYZ(i * 2 + 1, p.x - _ladoRastro.x * larg, p.y - _ladoRastro.y * larg, p.z - _ladoRastro.z * larg);
    // vermelho; levemente mais claro junto à bola
    _corRastro.set(P.corBola).lerp(_corBranca, 0.15 * vivo * vivo).multiplyScalar(vivo);
    cor.setXYZ(i * 2, _corRastro.r, _corRastro.g, _corRastro.b);
    cor.setXYZ(i * 2 + 1, _corRastro.r, _corRastro.g, _corRastro.b);
  }
  pos.needsUpdate = cor.needsUpdate = true;
  geo.setDrawRange(0, (n - 1) * 6);
  return true;
}

// ---------------------------------------------------------------------
// Explosão e fuligem
// ---------------------------------------------------------------------
const explosoes = [];
const manchas = [];
const _aux = new THREE.Object3D();
const _tamMancha = new THREE.Vector3();

function explodir(t) {
  const R = PODER.raioExplosao, D = PODER.diametroFumaca;
  const p = t.ponto.clone().addScaledVector(t.normal, R * 0.5);
  const clarao = new THREE.Sprite(matHalo.clone());
  clarao.material.color.set(PODER.corClarao);
  clarao.position.copy(p);
  const bolha = new THREE.Mesh(geoBola, matCasca.clone());
  bolha.material.opacity = 0.5;
  bolha.position.copy(p);
  clarao.renderOrder = bolha.renderOrder = 2; // acima da fuligem
  cena.add(clarao, bolha);
  const poeira = [];
  for (let k = 0; k < PODER.nPoeira; k++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texPoeira, color: t.agua ? PODER.corNevoa : PODER.corPoeira, transparent: true, depthWrite: false,
      opacity: 0, rotation: Math.random() * Math.PI * 2,
    }));
    // direção sorteada no hemisfério da superfície, com leve tendência para
    // cima. Velocidade inicial: o tufo percorre até ~1/4 do diâmetro (freio
    // exponencial de 5/s), formando uma nuvem do tamanho de diametroFumaca.
    const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
    if (v.dot(t.normal) < 0) v.addScaledVector(t.normal, -2 * v.dot(t.normal));
    v.addScaledVector(t.normal, 0.4).addScaledVector(_cima, 0.3).normalize().multiplyScalar(5 * D * 0.28 * (0.5 + Math.random() * 0.6));
    const base = p.clone();
    s.position.copy(base);
    s.renderOrder = 3; // acima da fuligem (renderOrder 1)
    cena.add(s);
    poeira.push({ s, v, base, cresce: 0.8 + Math.random() * 0.4 });
  }
  explosoes.push({ t: 0, p, clarao, bolha, poeira });
  if (!t.agua && t.ilha) manchar(t);
}

// Fuligem projetada nas malhas ao redor do toque (raio = PODER.raioMancha × raio da bola).
function manchar(t) {
  if (!DecalGeometry) return;
  const rm = PODER.raio * PODER.raioMancha;
  _aux.position.copy(t.ponto);
  _aux.lookAt(t.ponto.clone().add(t.normal));
  _aux.rotateZ(Math.random() * Math.PI * 2);
  _tamMancha.setScalar(rm * 2);
  for (const m of infoDaIlha(t.ilha).fixas) {
    _esfM.copy(m.geometry.boundingSphere).applyMatrix4(m.matrixWorld);
    if (_esfM.distanceToPoint(t.ponto) > rm) continue;
    const geo = new DecalGeometry(m, t.ponto, _aux.rotation, _tamMancha);
    const pos = geo.attributes.position, nor = geo.attributes.normal;
    if (!pos.count) { geo.dispose(); continue; }
    // a profundidade logarítmica ignora polygonOffset: afasta pela normal
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(i, pos.getX(i) + nor.getX(i) * PODER.folgaMancha, pos.getY(i) + nor.getY(i) * PODER.folgaMancha, pos.getZ(i) + nor.getZ(i) * PODER.folgaMancha);
    }
    const malha = new THREE.Mesh(geo, matFuligem);
    malha.receiveShadow = true;
    malha.renderOrder = 1;
    cena.add(malha);
    manchas.push(malha);
  }
  while (manchas.length > PODER.manchasMax) {
    const velha = manchas.shift();
    cena.remove(velha);
    velha.geometry.dispose();
  }
}

// Sprite plano junto à superfície fica cortado pela metade: desloca-o em direção
// à câmera em meia largura (sem passar dos olhos).
const _paraCam = new THREE.Vector3();
function aproximarDaCamera(s, base) {
  _paraCam.subVectors(camera.position, base);
  const d = _paraCam.length();
  s.position.copy(base).addScaledVector(_paraCam, Math.min(s.scale.x * 0.5, d - 1) / (d || 1));
}

function removerExplosao(e) {
  cena.remove(e.clarao, e.bolha);
  e.clarao.material.dispose();
  e.bolha.material.dispose();
  for (const q of e.poeira) { cena.remove(q.s); q.s.material.dispose(); }
}

function atualizarPoder(dt) {
  prototiposPoder.visible = false;
  const R = PODER.raio, RE = PODER.raioExplosao, D = PODER.diametroFumaca;
  const agora = performance.now() / 1000;

  for (let i = bolas.length - 1; i >= 0; i--) {
    const b = bolas[i];
    b.idade += dt;
    _prox.copy(b.g.position).addScaledVector(b.vel, dt);
    const toque = primeiroToque(b.g.position, _prox);
    b.percorrido += b.vel.length() * dt;
    if (toque || b.percorrido > PODER.alcance) {
      if (toque) { explodir(toque); b.rastro.pontos.push({ p: toque.ponto.clone(), t: agora }); }
      cena.remove(b.g);
      bolas.splice(i, 1);
      continue;
    }
    b.g.position.copy(_prox);
    b.rastro.pontos.push({ p: _prox.clone(), t: agora });
    b.g.lookAt(_prox.addScaledVector(b.vel, 1));
    const oval = 1 + (PODER.oval - 1) * Math.min(1, b.idade / PODER.tempoOval);
    b.g.scale.set(R, R, R * oval);
  }

  for (let i = explosoes.length - 1; i >= 0; i--) {
    const e = explosoes[i];
    e.t += dt;
    const kc = Math.min(1, e.t / PODER.tempoClarao);
    e.clarao.scale.setScalar(RE * (3 + 9 * kc));
    aproximarDaCamera(e.clarao, e.p);
    e.clarao.material.opacity = 1 - kc;
    e.bolha.scale.setScalar(RE * (1 + 3 * kc));
    e.bolha.material.opacity = 0.5 * (1 - kc) ** 2;
    e.clarao.visible = e.bolha.visible = kc < 1;
    const kp = Math.min(1, e.t / PODER.tempoPoeira);
    for (const q of e.poeira) {
      q.base.addScaledVector(q.v, dt);
      q.v.multiplyScalar(Math.exp(-5 * dt));
      q.base.y += D * 0.03 * dt; // fumaça quente sobe
      // tufo: estoura de 20% a ~70% do diâmetro da nuvem logo no início (a mancha
      // da textura ocupa ~70% do sprite)
      q.s.scale.setScalar(D * (0.2 + 0.5 * (1 - (1 - kp) ** 3)) * q.cresce);
      aproximarDaCamera(q.s, q.base);
      // densa até segueDensa; depois some depressa
      const some = kp < PODER.segueDensa ? 1 : (1 - (kp - PODER.segueDensa) / (1 - PODER.segueDensa)) ** 2;
      q.s.material.opacity = PODER.opacidadeFumaca * Math.min(1, e.t / 0.04) * some;
    }
    if (kp >= 1) { removerExplosao(e); explosoes.splice(i, 1); }
  }

  for (let i = rastros.length - 1; i >= 0; i--) {
    if (!atualizarRastro(rastros[i], agora)) rastros.splice(i, 1);
  }

  // luz: a explosão mais recente; sem explosão, a bola mais recente
  const ultima = explosoes[explosoes.length - 1];
  if (ultima && ultima.t < PODER.tempoClarao) {
    luzPoder.position.copy(ultima.p);
    luzPoder.intensity = PODER.luzExplosao * (1 - ultima.t / PODER.tempoClarao) ** 2;
  } else if (bolas.length) {
    luzPoder.position.copy(bolas[bolas.length - 1].g.position);
    luzPoder.intensity = PODER.luzBola;
  } else luzPoder.intensity = 0;
}
