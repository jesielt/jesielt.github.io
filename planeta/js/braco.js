// Braço-canhão do robô (1ª pessoa, lado direito). Ombro esférico > haste com
// colar > lançador: encaixe oco c/ fios, corpo abaulado, boca c/ brilho vermelho.
// Peças em LatheGeometry. Repouso p/ baixo; clique gira p/ cima e atira; tranco
// a cada tiro; abaixa após `espera` s. Molas amortecidas + atraso na rotação.
// Cena/câmera próprias por cima do cenário (não atravessa parede). Metros dos
// olhos: x dir, y cima, -z frente.
const AJUSTE_BRACO = {
  ombro: [0.20, -0.21, 0.05], // centro da junta do ombro, em relação aos olhos
  mira: [0.05, 0.02], // giro na posição de tiro [para a esquerda, para cima] (rad)
  // cores e materiais
  corBranco: '#ffffff',
  metalBranco: 0.35, asperezaBranco: 0.28, // tinta metálica brilhante
  corChumbo: '#2f343b', // juntas, boca e encaixe
  corInterior: '#0c0d0f', // dentro do encaixe e do cano
  corLinhas: '#8a929c', // ranhuras de painel
  serie: 'S402-O94', // número de série pintado no lançador
  corSerie: '#5b626b',
  serieFim: 0.89, // onde o texto termina na volta (0.875 = vinco do painel de cima à esquerda)
  serieAltura: 0.09, // posição ao longo do lançador (0 = trás, 1 = boca)
  serieTamanho: 40, // altura das letras em pixels da textura (40 ≈ 1,2 cm)
  brilhoBoca: 0.9, // brilho vermelho no fundo do cano, parado
  brilhoCarga: 3, // ...enquanto o braço sobe
  brilhoTiro: 6, // ...no instante do tiro
  // tempos (s)
  espera: 2, // depois do último tiro, até abaixar
  intervalo: 0.15, // mínimo entre tiros
  // peso: frequência (rad/s) e amortecimento (1 = sem passar do ponto) das molas
  molaGiro: [12, 0.65],
  molaRecuo: [16, 0.5],
  inercia: 0.35, // quanto do giro da câmera o braço deixa de acompanhar no instante
  // tranco do tiro (impulsos de velocidade)
  impulsoSobe: 3.2, // rad/s: cano sobe
  impulsoEsquerda: 1.6, // rad/s: cano vai para a esquerda
  impulsoRecuo: 1.3, // m/s: braço recua
  raioSaida: 0.03, // raio aparente da bola ao sair da boca (m)
};

const cenaBraco = new THREE.Scene();
const camBraco = new THREE.PerspectiveCamera(AJUSTE.fovParado, 1, 0.01, 10);
const hemiBraco = new THREE.HemisphereLight('#e8f6d0', '#9fb3e6', LUZ_CEU);
const solBraco = new THREE.DirectionalLight('#fff4e0', LUZ_SOL);
cenaBraco.add(hemiBraco, solBraco, solBraco.target);
// luz vermelha do fundo do cano: ilumina a boca por dentro e pisca no tiro
const luzBocal = new THREE.PointLight(PODER.corBola, 0, 0, 2);
cenaBraco.add(luzBocal);

// Reflexos do metal: ambiente em degradê (céu, horizonte, mar).
(() => {
  const g = new THREE.SphereGeometry(1, 32, 16);
  const cores = [], c = new THREE.Color();
  const ceu = new THREE.Color('#f4f8ff'), horiz = new THREE.Color(CORES.horizonte), mar = new THREE.Color(CORES.agua);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > 0) c.copy(horiz).lerp(ceu, Math.min(1, y * 1.6)); else c.copy(horiz).lerp(mar, Math.min(1, -y * 3));
    cores.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3));
  const amb = new THREE.Scene();
  amb.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const pmrem = new THREE.PMREMGenerator(renderer);
  cenaBraco.environment = pmrem.fromScene(amb, 0.04).texture;
  pmrem.dispose();
  g.dispose();
})();

// ---------------------------------------------------------------------
// Perfis. Pontos [raio, altura]; a altura cresce do ombro para a boca.
// ---------------------------------------------------------------------
// Arredonda cada canto do perfil (curva de Bézier quadrática de raio `r`).
function perfilBoleado(pontos, r, passos = 5) {
  const P = pontos.map(([x, y]) => new THREE.Vector2(x, y));
  const saida = [P[0]];
  const d1 = new THREE.Vector2(), d2 = new THREE.Vector2();
  for (let i = 1; i < P.length - 1; i++) {
    const A = P[i - 1], B = P[i], C = P[i + 1];
    d1.subVectors(A, B); d2.subVectors(C, B);
    const l1 = d1.length(), l2 = d2.length();
    if (l1 < 1e-9 || l2 < 1e-9) continue; // ponto repetido
    d1.divideScalar(l1); d2.divideScalar(l2);
    if (d1.dot(d2) < -0.94) { saida.push(B); continue; } // quase reto: sem canto
    const t = Math.min(r, l1 / 2, l2 / 2);
    const p1 = B.clone().addScaledVector(d1, t), p2 = B.clone().addScaledVector(d2, t);
    for (let k = 0; k <= passos; k++) {
      const s = k / passos;
      saida.push(new THREE.Vector2(
        (1 - s) ** 2 * p1.x + 2 * (1 - s) * s * B.x + s * s * p2.x,
        (1 - s) ** 2 * p1.y + 2 * (1 - s) * s * B.y + s * s * p2.y));
    }
  }
  saida.push(P[P.length - 1]);
  return saida;
}
// Trecho curvo (spline) do perfil, já como lista de pontos [raio, altura].
function curvaDoPerfil(pontos, n) {
  return new THREE.SplineCurve(pontos.map(([x, y]) => new THREE.Vector2(x, y))).getPoints(n).map(p => [p.x, p.y]);
}
function torneado(perfil, mat, segmentos = 48) {
  const m = new THREE.Mesh(new THREE.LatheGeometry(perfil, segmentos), mat);
  return m;
}

// Linhas de painel e número de série do lançador: textura em (volta, comprimento).
function desenharPainel(ctx) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1024, 512);
  ctx.strokeStyle = AJUSTE_BRACO.corLinhas;
  ctx.lineWidth = 3;
  // Topo do desenho = boca; x = volta em torno do eixo. Assim o texto fica de
  // pé (topo das letras para a boca) e sem espelhar, visto de fora.
  const v = f => (1 - f) * 512; // fração do comprimento (0 = trás, 1 = boca)
  ctx.beginPath();
  for (const f of [0.18, 0.66]) { ctx.moveTo(0, v(f)); ctx.lineTo(1024, v(f)); }
  // quatro painéis longitudinais entre as duas linhas
  for (let k = 0; k < 4; k++) { const x = (k + 0.5) * 256; ctx.moveTo(x, v(0.18)); ctx.lineTo(x, v(0.66)); }
  ctx.stroke();
  // fendas curtas perto da boca
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const x = (k + 0.25) * 128;
    ctx.moveTo(x, v(0.74)); ctx.lineTo(x, v(0.84));
  }
  ctx.stroke();
  // número de série na faixa de trás, terminando em `serieFim` da volta.
  // Um pixel vale mais na volta que no comprimento: o texto é estreitado
  // para não sair alongado.
  const S = AJUSTE_BRACO;
  ctx.save();
  ctx.translate(S.serieFim * 1024, v(S.serieAltura));
  ctx.scale(0.85, 1);
  ctx.font = `600 ${S.serieTamanho}px "Orbitron", "Arial Narrow", sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = S.corSerie;
  ctx.fillText(S.serie, 0, 0);
  ctx.restore();
}
function texturaDePainel() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  desenharPainel(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  // a fonte da página pode chegar depois: redesenha com ela
  if (document.fonts) document.fonts.load(`600 ${AJUSTE_BRACO.serieTamanho}px "Orbitron"`).then(() => {
    desenharPainel(c.getContext('2d'));
    t.needsUpdate = true;
  }).catch(() => {});
  return t;
}

// ---------------------------------------------------------------------
// Modelo. `pivo` fica no centro do ombro e gira; `recuo` desloca o braço ao
// longo do próprio eixo; `corrente` monta as peças ao longo de +y e é girada
// para que +y aponte para -z (frente quando o giro é zero).
// ---------------------------------------------------------------------
const pivo = new THREE.Group();
const recuo = new THREE.Group();
const corrente = new THREE.Group();
corrente.rotation.x = -Math.PI / 2;
pivo.add(recuo);
recuo.add(corrente);
cenaBraco.add(pivo);
let comprimentoBraco = 0; // do centro do ombro até a boca
const boca = new THREE.Object3D(); // fundo do cano: origem do brilho e da bola

const matBrilhoBoca = new THREE.MeshStandardMaterial({ color: '#000000', emissive: PODER.corBola, emissiveIntensity: 1 });

(() => {
  const A = AJUSTE_BRACO;
  const branco = new THREE.MeshPhysicalMaterial({
    color: A.corBranco, metalness: A.metalBranco, roughness: A.asperezaBranco,
    clearcoat: 0.6, clearcoatRoughness: 0.18, envMapIntensity: 0.8,
  });
  const brancoPainel = branco.clone();
  brancoPainel.map = texturaDePainel();
  const chumbo = new THREE.MeshStandardMaterial({ color: A.corChumbo, metalness: 0.75, roughness: 0.35, envMapIntensity: 0.9 });
  const interior = new THREE.MeshStandardMaterial({ color: A.corInterior, roughness: 0.9, side: THREE.DoubleSide });

  // ombro
  corrente.add(new THREE.Mesh(new THREE.SphereGeometry(0.054, 32, 20), chumbo));
  // haste: do ombro até o fundo do encaixe
  const yLanc = 0.37; // início do lançador
  const raioHaste = 0.026;
  corrente.add(torneado(perfilBoleado([[0, 0.03], [raioHaste, 0.03], [raioHaste, yLanc + 0.034], [0, yLanc + 0.034]], 0.006), branco, 40));
  // colar do cotovelo: anel de borda boleada
  const colar = torneado(perfilBoleado([[raioHaste, -0.016], [0.036, -0.016], [0.040, -0.007], [0.040, 0.007], [0.036, 0.016], [raioHaste, 0.016]], 0.004), chumbo, 48);
  colar.position.y = 0.30;
  corrente.add(colar);
  // colar menor junto ao ombro
  const colarOmbro = torneado(perfilBoleado([[raioHaste, -0.009], [0.033, -0.009], [0.033, 0.009], [raioHaste, 0.009]], 0.003), chumbo, 48);
  colarOmbro.position.y = 0.06;
  corrente.add(colarOmbro);

  // lançador, em coordenadas próprias (0 = borda de trás)
  const lanc = new THREE.Group();
  lanc.position.y = yLanc;
  corrente.add(lanc);
  // encaixe: aro chumbo e interior escuro onde a haste entra
  lanc.add(torneado([[0, 0.036], [0.036, 0.036], [0.036, -0.002]].map(([x, y]) => new THREE.Vector2(x, y)), interior, 48));
  lanc.add(torneado(perfilBoleado([[0.036, 0.004], [0.036, -0.008], [0.056, -0.008], [0.059, 0.004], [0.057, 0.012]], 0.004), chumbo));
  // fios dentro do encaixe, saindo do fundo e entrando na haste
  const cores = ['#4a1010', '#202226', '#3a2c18', '#202226'];
  cores.forEach((cor, k) => {
    const a = k * Math.PI / 2 + 0.4;
    const ponto = (r, y, da) => new THREE.Vector3(Math.cos(a + da) * r, y, Math.sin(a + da) * r);
    const curva = new THREE.CatmullRomCurve3([ponto(0.032, 0.034, 0), ponto(0.033, 0.02, 0.3), ponto(0.030, 0.006, 0.5), ponto(raioHaste + 0.001, -0.004, 0.62)]);
    lanc.add(new THREE.Mesh(new THREE.TubeGeometry(curva, 16, 0.0022, 6), new THREE.MeshStandardMaterial({ color: cor, roughness: 0.6 })));
  });
  // corpo branco abaulado: incha no meio e afina para a boca
  const corpo = perfilBoleado([[0.056, 0.010],
    ...curvaDoPerfil([[0.0595, 0.016], [0.0640, 0.045], [0.0655, 0.075], [0.0605, 0.112], [0.0505, 0.146], [0.0435, 0.161]], 24),
    [0.0420, 0.165]], 0.004);
  const geoCorpo = new THREE.LatheGeometry(corpo, 72);
  // textura ao longo do comprimento real (e não pelo índice do ponto):
  // v = 0 atrás, 1 na boca
  const pos = geoCorpo.attributes.position, uv = geoCorpo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setY(i, (pos.getY(i) - 0.010) / 0.155);
  lanc.add(new THREE.Mesh(geoCorpo, brancoPainel));
  // boca: colar chanfrado (borda viva levemente boleada) e cano escuro por dentro
  lanc.add(torneado(perfilBoleado([[0.0415, 0.163], [0.0455, 0.166], [0.0455, 0.176], [0.0410, 0.181], [0.0300, 0.181], [0.0300, 0.176]], 0.0015, 3), chumbo, 56));
  lanc.add(torneado([[0.0300, 0.176], [0.0300, 0.135], [0, 0.135]].map(([x, y]) => new THREE.Vector2(x, y)), interior, 48));
  const fundo = new THREE.Mesh(new THREE.CircleGeometry(0.029, 32), matBrilhoBoca);
  fundo.rotation.x = -Math.PI / 2; // virado para a boca
  fundo.position.y = 0.137;
  lanc.add(fundo);
  boca.position.y = 0.15;
  lanc.add(boca);
  comprimentoBraco = yLanc + 0.181;
})();

// clarão do tiro na boca: o mesmo visual da bola (poder.js)
const claraoBocal = visualDaBola();
claraoBocal.visible = false;
cenaBraco.add(claraoBocal);

pivo.position.fromArray(AJUSTE_BRACO.ombro);
const BAIXO = -Math.PI / 2; // giro em repouso: apontando para baixo
const estadoBraco = {
  fase: 'repouso', desdeTiro: 99, fila: false, flash: 99,
  giro: BAIXO, vGiro: 0, lado: 0, vLado: 0, rec: 0, vRec: 0,
  yawAntes: 0, pitchAntes: 0,
};
pivo.visible = false;

// compila já os programas de desenho: evita travada no primeiro tiro
pivo.visible = claraoBocal.visible = true;
renderer.compile(cenaBraco, camBraco);
pivo.visible = claraoBocal.visible = false;

// ---------------------------------------------------------------------
// Animação
// ---------------------------------------------------------------------
// Clique esquerdo: erguido, atira na hora; abaixado ou descendo, sobe e atira ao chegar.
function pedirDisparo() {
  const e = estadoBraco;
  if (e.fase === 'pronto') { if (e.desdeTiro >= AJUSTE_BRACO.intervalo) atirar(); return; }
  e.fila = true;
  if (e.fase === 'repouso') { e.yawAntes = yaw; e.pitchAntes = pitch; }
  e.fase = 'sobe';
}

const _ponta = new THREE.Vector3();
function atirar() {
  const A = AJUSTE_BRACO, e = estadoBraco;
  e.desdeTiro = 0;
  e.flash = 0;
  e.fila = false;
  // a bola sai da boca, na pose atual, vista da câmera
  pivo.updateMatrixWorld(true);
  corrente.localToWorld(_ponta.set(0, comprimentoBraco, 0));
  const dist = _ponta.length();
  lancarBola(_ponta.divideScalar(dist), A.raioSaida / dist);
  // tranco: impulso nas molas
  e.vGiro += A.impulsoSobe;
  e.vLado += A.impulsoEsquerda;
  e.vRec += A.impulsoRecuo;
}

// Mola amortecida (passo semi-implícito). Devolve [posição, velocidade].
function passoMola(x, v, alvo, [w, z], dt) {
  v += (w * w * (alvo - x) - 2 * z * w * v) * dt;
  return [x + v * dt, v];
}

const _origemBoca = new THREE.Vector3();
function atualizarBraco(dt) {
  const A = AJUSTE_BRACO, e = estadoBraco;
  if (e.fase === 'repouso') { pivo.visible = false; claraoBocal.visible = false; luzBocal.intensity = 0; return; }
  e.desdeTiro += dt;
  e.flash += dt;

  // inércia: o giro da câmera neste quadro é parcialmente devolvido ao braço
  const dYaw = Math.max(-0.1, Math.min(0.1, yaw - e.yawAntes));
  const dPitch = Math.max(-0.1, Math.min(0.1, pitch - e.pitchAntes));
  e.yawAntes = yaw; e.pitchAntes = pitch;
  e.lado -= dYaw * A.inercia;
  e.giro -= dPitch * A.inercia;

  // molas (em passos curtos: estáveis mesmo com quadros longos)
  const alvoGiro = e.fase === 'desce' ? BAIXO : 0;
  for (let n = Math.ceil(dt / (1 / 120)), h = dt / n; n > 0; n--) {
    [e.giro, e.vGiro] = passoMola(e.giro, e.vGiro, alvoGiro, A.molaGiro, h);
    [e.lado, e.vLado] = passoMola(e.lado, e.vLado, 0, A.molaGiro, h);
    [e.rec, e.vRec] = passoMola(e.rec, e.vRec, 0, A.molaRecuo, h);
  }

  if (e.fase === 'sobe' && e.giro > -0.08) { e.fase = 'pronto'; if (e.fila) atirar(); }
  else if (e.fase === 'pronto' && e.desdeTiro >= A.espera) e.fase = 'desce';
  else if (e.fase === 'desce' && e.giro < BAIXO + 0.05) {
    e.fase = 'repouso';
    e.giro = BAIXO; e.vGiro = e.lado = e.vLado = e.rec = e.vRec = 0;
  }

  // a mira entra aos poucos conforme o braço sobe
  const kMira = Math.max(0, Math.min(1, 1 - e.giro / BAIXO));
  pivo.rotation.set(e.giro + A.mira[1] * kMira, e.lado + A.mira[0] * kMira, 0, 'YXZ');
  recuo.position.z = Math.max(-0.01, e.rec);
  pivo.visible = e.fase !== 'repouso';

  // brilho do fundo do cano: pulsa parado, cresce na subida, estoura no tiro
  const pulso = 0.85 + 0.15 * Math.sin(performance.now() * 0.006);
  const flash = Math.max(0, 1 - e.flash / 0.12);
  const base = e.fase === 'sobe' ? A.brilhoCarga : A.brilhoBoca;
  matBrilhoBoca.emissiveIntensity = base * pulso + A.brilhoTiro * flash;
  pivo.updateMatrixWorld(true);
  boca.getWorldPosition(_origemBoca);
  luzBocal.position.copy(_origemBoca);
  luzBocal.intensity = 0.02 * matBrilhoBoca.emissiveIntensity;
  // clarão na saída da boca, no início do tiro
  claraoBocal.visible = flash > 0.3;
  corrente.localToWorld(claraoBocal.position.set(0, comprimentoBraco + 0.01, 0));
  claraoBocal.scale.setScalar(A.raioSaida * (0.6 + 0.9 * flash));
}

// Desenha o braço por cima do cenário. Chamar logo após desenhar a cena.
const _qCamInv = new THREE.Quaternion();
function desenharBraco() {
  if (!pivo.visible) return;
  camBraco.fov = camera.fov;
  camBraco.aspect = camera.aspect;
  camBraco.updateProjectionMatrix();
  // sol e céu do braço acompanham os do cenário, vistos da câmera
  _qCamInv.copy(camera.quaternion).invert();
  solBraco.position.copy(DIR_SOL).applyQuaternion(_qCamInv);
  hemiBraco.position.set(0, 1, 0).applyQuaternion(_qCamInv);
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
