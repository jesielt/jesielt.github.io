// ---------------------------------------------------------------------
// Braço direito em primeira pessoa: aparece só no disparo da bola de energia
// (clique esquerdo com o cursor travado): sobe já puxado para trás, carrega,
// empurra para a frente, solta a bola e desce.
// Modelo: "Low Poly FPS Arms", de BIGMACorSomething, licença CC BY 4.0
// (modelos/braco-glb.js). O modelo não tem animação: o braço é posicionado
// a cada quadro girando os ossos (cinemática inversa de dois ossos).
//
// O braço tem cena e câmera próprias, desenhadas por cima do cenário depois
// de limpar a profundidade: assim não atravessa paredes. Unidades da cena do
// braço: metros a partir dos olhos (x direita, y cima, -z frente).
// ---------------------------------------------------------------------
const AJUSTE_BRACO = {
  escala: 0.01, // modelo em centímetros → metros (braço de ~55 cm)
  ombro: [0.24, -0.34, -0.02], // posição do ombro direito em relação aos olhos
  cotovelo: [1, -1, 0.3], // direção para onde o cotovelo aponta
  pele: '#f1c19a',
  manga: '#2f4ea6',
  luva: '#2f4ea6', // luva sem dedos
  raioBrilho: 0.035, // raio da bola carregada na palma (m)
  corBrilho: '#ffd84a',
};

// Poses da mão: posição do pulso, direção dos dedos e para onde a palma olha.
const POSES_BRACO = {
  repouso: { mao: [0.30, -0.62, -0.28], dedos: [0, 0.3, -1], palma: [-0.2, -1, 0] }, // abaixo da tela
  puxado: { mao: [0.22, -0.13, -0.26], dedos: [0.05, 1, 0.15], palma: [-0.2, 0, -1] },
  lancado: { mao: [0.12, -0.14, -0.46], dedos: [0, 1, -0.25], palma: [-0.15, 0.05, -1] },
};
// [nome, pose de destino, duração em s]. "lanca" termina soltando a bola.
const FASES_BRACO = [
  ['puxa', 'puxado', 0.16],
  ['carrega', 'puxado', 0.10],
  ['lanca', 'lancado', 0.08],
  ['segura', 'lancado', 0.12],
  ['desce', 'repouso', 0.28],
];

const cenaBraco = new THREE.Scene();
const camBraco = new THREE.PerspectiveCamera(AJUSTE.fovParado, 1, 0.01, 10);
const hemiBraco = new THREE.HemisphereLight('#e8f6d0', '#9fb3e6', LUZ_CEU);
const solBraco = new THREE.DirectionalLight('#fff4e0', LUZ_SOL);
cenaBraco.add(hemiBraco, solBraco, solBraco.target);
// luz amarela da energia na palma
const luzPalma = new THREE.PointLight(AJUSTE_BRACO.corBrilho, 0, 0, 2);
cenaBraco.add(luzPalma);

// Brilho da palma: o mesmo visual da bola (poder.js).
const brilhoPalma = visualDaBola();
brilhoPalma.visible = false;
cenaBraco.add(brilhoPalma);

let braco = null; // ossos e eixos do modelo, depois de carregado
const estadoBraco = { fase: -1, t: 0, de: null, atual: null, fila: false };

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4();

// Matriz ortonormal: x = eixo, y = lado (tornado perpendicular ao eixo).
function baseOrtonormal(eixo, lado, m) {
  const x = _v1.copy(eixo).normalize();
  const y = _v2.copy(lado).addScaledVector(x, -lado.dot(x)).normalize();
  const z = _v3.crossVectors(x, y);
  return m.makeBasis(x, y, z);
}

// Gira o osso para que seu eixo local aponte em `dir` e seu lado local fique
// o mais perto possível de `lado` (ambos no espaço da cena do braço).
function orientarOsso(o, dir, lado) {
  baseOrtonormal(dir, lado, _m1).multiply(o.baseInv);
  _q1.setFromRotationMatrix(_m1);
  o.osso.parent.getWorldQuaternion(_q2);
  o.osso.quaternion.copy(_q2.invert().multiply(_q1));
  o.osso.updateMatrixWorld(true);
}

function montarBraco(modelo) {
  modelo.scale.setScalar(AJUSTE_BRACO.escala);
  modelo.rotation.y = Math.PI; // de frente para -z
  const raiz = new THREE.Group();
  raiz.add(modelo);
  cenaBraco.add(raiz);
  raiz.updateMatrixWorld(true);

  const achar = prefixo => {
    let r = null;
    modelo.traverse(o => { if (!r && o.name.startsWith(prefixo)) r = o; });
    return r;
  };
  const ombro = achar('mixamorigRightArm_');
  const antebraco = achar('mixamorigRightForeArm_');
  const mao = achar('mixamorigRightHand_');
  const dedo = achar('mixamorigRightHandMiddle1_');
  const indicador = achar('mixamorigRightHandIndex1_');
  const minimo = achar('mixamorigRightHandPinky1_');
  // braço esquerdo: os vértices se reduzem a um ponto (invisível)
  achar('mixamorigLeftArm_').scale.setScalar(0);

  const pos = o => o.getWorldPosition(new THREE.Vector3());
  const pO = pos(ombro), pA = pos(antebraco), pM = pos(mao), pD = pos(dedo);
  // normal da palma na pose original (aponta para fora da palma)
  const palma = new THREE.Vector3().crossVectors(pos(indicador).sub(pos(minimo)), _v1.copy(pD).sub(pM)).normalize();
  // eixo (para o próximo osso) e lado (palma), no referencial de cada osso
  const preparar = (osso, ate) => {
    const q = osso.getWorldQuaternion(new THREE.Quaternion()).invert();
    const eixo = ate.clone().sub(pos(osso)).normalize().applyQuaternion(q);
    const lado = palma.clone().applyQuaternion(q);
    const baseInv = baseOrtonormal(eixo, lado, new THREE.Matrix4()).transpose();
    return { osso, baseInv };
  };
  braco = {
    raiz,
    ombro: preparar(ombro, pA), antebraco: preparar(antebraco, pM), mao: preparar(mao, pD),
    a: pA.distanceTo(pO), b: pM.distanceTo(pA),
  };
  // o ombro fica na posição ajustada (girar os ossos não o desloca)
  raiz.position.fromArray(AJUSTE_BRACO.ombro).sub(pO);

  const cores = { Bodymat: AJUSTE_BRACO.pele, Topmat: AJUSTE_BRACO.manga, Glovemat: AJUSTE_BRACO.luva };
  modelo.traverse(o => {
    if (!o.isSkinnedMesh) return;
    o.material = new THREE.MeshLambertMaterial({ color: cores[o.material.name] || AJUSTE_BRACO.pele });
    o.frustumCulled = false; // a caixa de contorno é a da pose original
  });
  // compila já os programas de desenho: evita travada no primeiro disparo
  raiz.visible = brilhoPalma.visible = true;
  renderer.compile(cenaBraco, camBraco);
  raiz.visible = brilhoPalma.visible = false;
}

// Carrega o carregador de GLB e o modelo (em base64) sem travar a abertura.
(() => {
  const s = document.createElement('script');
  s.src = `modelos/braco-glb.js?v=${VERSAO}`;
  const arquivo = new Promise((ok, falha) => { s.onload = ok; s.onerror = falha; });
  document.body.appendChild(s);
  Promise.all([import('three/addons/loaders/GLTFLoader.js'), arquivo]).then(([{ GLTFLoader }]) => {
    const bin = Uint8Array.from(atob(BRACO_GLB), c => c.charCodeAt(0));
    BRACO_GLB = null;
    new GLTFLoader().parse(bin.buffer, '', g => montarBraco(g.scene), e => console.error('Planeta: braço', e));
  }).catch(e => console.error('Planeta: não carregou o braço', e));
})();

// ---------------------------------------------------------------------
// Animação
// ---------------------------------------------------------------------
function copiarPose(p) {
  return {
    mao: new THREE.Vector3().fromArray(p.mao),
    dedos: new THREE.Vector3().fromArray(p.dedos).normalize(),
    palma: new THREE.Vector3().fromArray(p.palma).normalize(),
  };
}
function misturarPose(de, ate, k, saida) {
  saida.mao.lerpVectors(de.mao, ate.mao, k);
  saida.dedos.lerpVectors(de.dedos, ate.dedos, k).normalize();
  saida.palma.lerpVectors(de.palma, ate.palma, k).normalize();
  return saida;
}
const POSES_V = Object.fromEntries(Object.entries(POSES_BRACO).map(([n, p]) => [n, copiarPose(p)]));
estadoBraco.atual = copiarPose(POSES_BRACO.repouso);

// Clique esquerdo: dispara se o braço está parado, segurando ou descendo;
// durante a puxada e o empurrão, guarda um disparo para logo depois.
function pedirDisparo() {
  if (!braco) return;
  const f = estadoBraco.fase;
  if (f === -1 || f >= 3) iniciarFase(0);
  else estadoBraco.fila = true;
}
function iniciarFase(n) {
  estadoBraco.fase = n;
  estadoBraco.t = 0;
  const a = estadoBraco.atual;
  estadoBraco.de = { mao: a.mao.clone(), dedos: a.dedos.clone(), palma: a.palma.clone() };
}

const suave = k => k * k * (3 - 2 * k);
const _pulso = new THREE.Vector3(), _cot = new THREE.Vector3(), _u = new THREE.Vector3(), _w = new THREE.Vector3();
const _ombro = new THREE.Vector3().fromArray(AJUSTE_BRACO.ombro);
const _poloCot = new THREE.Vector3().fromArray(AJUSTE_BRACO.cotovelo).normalize();
const _centroPalma = new THREE.Vector3();

function atualizarBraco(dt) {
  if (!braco) return;
  const e = estadoBraco;
  if (e.fase === -1) { braco.raiz.visible = false; brilhoPalma.visible = false; luzPalma.intensity = 0; return; }

  e.t += dt;
  const [nome, alvo, dur] = FASES_BRACO[e.fase];
  const k = Math.min(1, e.t / dur);
  // empurrão: rápido no início; descida: lenta no início
  const kk = nome === 'lanca' ? 1 - (1 - k) ** 3 : nome === 'desce' ? k * k : suave(k);
  misturarPose(e.de, POSES_V[alvo], kk, e.atual);
  if (k >= 1) {
    if (nome === 'lanca') soltarDaPalma();
    if (e.fila && nome === 'lanca') { e.fila = false; iniciarFase(0); }
    else if (e.fase + 1 < FASES_BRACO.length) iniciarFase(e.fase + 1);
    else e.fase = -1;
  }

  posarBraco(e.atual);
  braco.raiz.visible = true;

  // brilho: cresce na puxada, pulsa ao carregar, some ao soltar
  const fase = FASES_BRACO[Math.max(0, e.fase)][0];
  const carregando = e.fase >= 0 && e.fase <= 2 && !(nome === 'lanca' && k >= 1);
  brilhoPalma.visible = carregando;
  luzPalma.intensity = carregando ? 0.6 : 0;
  if (carregando) {
    const cresce = fase === 'puxa' ? suave(Math.min(1, e.t / FASES_BRACO[0][2])) : 1;
    const pulso = 1 + 0.08 * Math.sin(performance.now() * 0.05);
    brilhoPalma.scale.setScalar(AJUSTE_BRACO.raioBrilho * cresce * pulso);
    brilhoPalma.position.copy(centroDaPalma(_centroPalma));
    luzPalma.position.copy(brilhoPalma.position);
  }
}

// Centro da bola na palma: um pouco à frente do meio da mão.
function centroDaPalma(saida) {
  const p = estadoBraco.atual;
  return saida.copy(p.mao).addScaledVector(p.dedos, 0.07).addScaledVector(p.palma, 0.045);
}

// Cinemática inversa: cotovelo no plano entre ombro, pulso e a direção do cotovelo.
function posarBraco(pose) {
  const { a, b } = braco;
  _u.subVectors(pose.mao, _ombro);
  const d = Math.min(Math.max(_u.length(), Math.abs(a - b) + 1e-3), (a + b) * 0.999);
  _u.normalize();
  _pulso.copy(_ombro).addScaledVector(_u, d);
  const cosA = (a * a + d * d - b * b) / (2 * a * d);
  _w.copy(_poloCot).addScaledVector(_u, -_poloCot.dot(_u)).normalize();
  _cot.copy(_ombro).addScaledVector(_u, a * cosA).addScaledVector(_w, a * Math.sqrt(Math.max(0, 1 - cosA * cosA)));

  braco.raiz.updateMatrixWorld(true);
  orientarOsso(braco.ombro, _v1.subVectors(_cot, _ombro).clone(), pose.palma);
  orientarOsso(braco.antebraco, _v1.subVectors(_pulso, _cot).clone(), pose.palma);
  orientarOsso(braco.mao, pose.dedos, pose.palma);
}

// Fim do empurrão: a bola passa da palma para o cenário (poder.js), na mesma
// posição e tamanho aparentes.
function soltarDaPalma() {
  centroDaPalma(_centroPalma);
  const dist = _centroPalma.length();
  lancarBola(_centroPalma.clone().divideScalar(dist), AJUSTE_BRACO.raioBrilho / dist);
}

// Desenha o braço por cima do cenário. Chamar logo após desenhar a cena.
function desenharBraco() {
  if (!braco || !braco.raiz.visible) return;
  camBraco.fov = camera.fov;
  camBraco.aspect = camera.aspect;
  camBraco.updateProjectionMatrix();
  // sol e céu do braço acompanham os do cenário, vistos da câmera
  _q1.copy(camera.quaternion).invert();
  solBraco.position.copy(DIR_SOL).applyQuaternion(_q1);
  hemiBraco.position.set(0, 1, 0).applyQuaternion(_q1);
  hemiBraco.intensity = hemi.intensity;
  solBraco.intensity = sol.intensity;
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(cenaBraco, camBraco);
  renderer.autoClear = true;
}

document.addEventListener('mousedown', e => {
  if (e.button !== 0 || document.pointerLockElement !== canvas || !caixaAjuda.hidden) return;
  pedirDisparo();
});
