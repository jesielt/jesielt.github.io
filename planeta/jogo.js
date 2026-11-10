// Planeta — etapa 1: voar em primeira pessoa sobre a água.
// Unidades do mundo ≈ metros. y é a altura; a água fica em y = 0.

// A biblioteca de 3D vem de um link. Carregando assim, o jogo funciona
// tanto no site quanto abrindo o index.html direto (duplo clique).
(async () => {
const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');

// ---------------------------------------------------------------------
// Ajustes de sensação (é aqui que a gente mexe pra deixar gostoso)
// ---------------------------------------------------------------------
const AJUSTE = {
  sensibilidade: 0.0022,  // quanto o olhar gira por pixel de mouse
  acel: 100,              // força do "empurrão" quando segura uma tecla
  arrasto: 1.2,           // inércia: menor = desliza mais depois de soltar
  velMax: 90,             // m/s
  dash: 2,                // segurando Shift: velocidade e força multiplicadas por isso
  arranqueDash: 450,      // empurrão extra enquanto o dash ainda não chegou na velocidade dele
  alturaOlhos: 3.5,       // seus olhos nunca chegam mais perto que isso do chão (3,5 aqui ≈ 20 cm na sensação)
  fovParado: 70,          // campo de visão parado...
  fovVeloz: 84,           // ...e no máximo da velocidade (dá sensação de vento)
  inclinaLado: 0.07,      // a câmera tomba um pouco quando vai de lado (A/D)
  inclinaCurva: 0.04,     // ...e tomba pra dentro da curva quando você vira o mouse
  inclinaMax: 0.2,
  neblinaPerto: 650,      // onde a perspectiva atmosférica começa
  neblinaLonge: 2200,     // onde tudo já virou cor de horizonte
};

const CORES = {
  horizonte: '#dbe7ac',
  agua: '#a6dba0',
  rocha: '#e9aab3',
  grama: '#7d9ce2',
  tronco: '#e6c3b4',
  tufo: '#6683d6',
  mancha: '#6283cf',
};

// ---------------------------------------------------------------------
// Cena, câmera e renderizador
// ---------------------------------------------------------------------
const canvas = document.getElementById('tela');
// logarithmicDepthBuffer: guarda a distância de cada pixel com precisão boa
// tanto perto quanto longe. Sem isso, lá do alto o topo das ilhas "briga"
// com a água (z-fighting) e as ilhas piscam/somem.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const cena = new THREE.Scene();
// neblina na cor do horizonte = quanto mais longe, mais desbotado
cena.fog = new THREE.Fog(CORES.horizonte, AJUSTE.neblinaPerto, AJUSTE.neblinaLonge);

// 0.5 = o mais perto que a câmera enxerga (bem menos que a altura mínima dos olhos)
const camera = new THREE.PerspectiveCamera(AJUSTE.fovParado, 1, 0.5, 6000);
camera.rotation.order = 'YXZ'; // primeiro gira pros lados, depois pra cima/baixo
camera.position.set(0, 40, 0);

function ajustarTela() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', ajustarTela);
ajustarTela();

cena.add(new THREE.HemisphereLight('#e8f6d0', '#9fb3e6', 2.2));
const sol = new THREE.DirectionalLight('#fff4e0', 1.6);
sol.position.set(-0.5, 1, 0.3);
cena.add(sol);

// ---------------------------------------------------------------------
// Céu: uma esfera gigante em volta da câmera, pintada por dentro
// ---------------------------------------------------------------------
const ceu = new THREE.Mesh(
  new THREE.SphereGeometry(5000, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    // h = quanto a direção aponta pra cima (0 = horizonte, 1 = zênite)
    fragmentShader: `
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        // de baixo pra cima: quase branco esverdeado -> verde-amarelado -> verde
        vec3 claro   = vec3(0.859, 0.906, 0.675); // = CORES.horizonte (#dbe7ac)
        vec3 amarelo = vec3(0.800, 0.878, 0.553);
        vec3 verdeCl = vec3(0.624, 0.824, 0.478);
        vec3 verde   = vec3(0.310, 0.702, 0.322);
        vec3 c = claro;
        c = mix(c, amarelo, smoothstep(0.00, 0.08, h));
        c = mix(c, verdeCl, smoothstep(0.08, 0.30, h));
        c = mix(c, verde,   smoothstep(0.30, 0.75, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  })
);
ceu.renderOrder = -1;
cena.add(ceu);

// ---------------------------------------------------------------------
// Satélites no céu: um planeta grande, creme com listras alaranjadas,
// e uma luazinha clara. Ficam "pregados" no céu (andam junto com você,
// então nunca chegam mais perto — igual à lua de verdade).
// ---------------------------------------------------------------------
function texturaDoSatelite(listras) {
  const t = 256, c = document.createElement('canvas');
  c.width = c.height = t;
  const g = c.getContext('2d');
  const m = t / 2, r = t * 0.46;
  g.save();
  g.beginPath(); g.arc(m, m, r, 0, Math.PI * 2); g.clip();
  const base = g.createRadialGradient(m - r * 0.3, m - r * 0.3, r * 0.1, m, m, r);
  base.addColorStop(0, '#fbf1cf');
  base.addColorStop(1, '#ecd9a6');
  g.fillStyle = base;
  g.fillRect(0, 0, t, t);
  if (listras) {
    // faixas onduladas, como num planeta gasoso pintado à mão
    let s = 5;
    const aleatorio = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 16; k++) {
      const y0 = m - r + aleatorio() * r * 2;
      const amp = 2 + aleatorio() * 6, freq = 0.02 + aleatorio() * 0.03, fase = aleatorio() * 6;
      g.strokeStyle = `rgba(224, 150, 80, ${0.25 + aleatorio() * 0.35})`;
      g.lineWidth = 1.5 + aleatorio() * 4;
      g.beginPath();
      for (let x = m - r; x <= m + r; x += 4) {
        const y = y0 + Math.sin(x * freq + fase) * amp;
        x === m - r ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.stroke();
    }
  }
  // sombra suave do lado oposto à luz
  const sombra = g.createRadialGradient(m - r * 0.35, m - r * 0.35, r * 0.6, m, m, r * 1.05);
  sombra.addColorStop(0, 'rgba(180, 140, 120, 0)');
  sombra.addColorStop(1, 'rgba(180, 140, 120, 0.35)');
  g.fillStyle = sombra;
  g.fillRect(0, 0, t, t);
  // atmosfera: um véu da cor do céu por cima tira a nitidez...
  g.fillStyle = 'rgba(205, 232, 170, 0.38)';
  g.fillRect(0, 0, t, t);
  g.restore();
  // ...e a borda some aos poucos, em vez de terminar num corte seco
  g.globalCompositeOperation = 'destination-in';
  const borda = g.createRadialGradient(m, m, r * 0.78, m, m, r);
  borda.addColorStop(0, 'rgba(0,0,0,1)');
  borda.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = borda;
  g.fillRect(0, 0, t, t);
  g.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const DIST_CEU = 3000;
function criarSatelite(listras, azimute, elevacao, graus) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texturaDoSatelite(listras), fog: false, depthWrite: false, transparent: true, opacity: 0.82,
  }));
  const tam = 2 * DIST_CEU * Math.tan((graus * Math.PI / 180) / 2);
  sprite.scale.set(tam, tam, 1);
  // direção no céu (azimute = pra que lado, elevação = quão alto)
  const dir = new THREE.Vector3(
    Math.sin(azimute) * Math.cos(elevacao), Math.sin(elevacao), -Math.cos(azimute) * Math.cos(elevacao)
  ).multiplyScalar(DIST_CEU);
  cena.add(sprite);
  return { sprite, dir };
}
const satelites = [
  criarSatelite(true, 0.5, 0.42, 9),    // o planetão listrado
];

// ---------------------------------------------------------------------
// Nuvens: poucas e ralas, achatadas embaixo, branco-esverdeadas como no
// anime. Também ficam "pregadas" no céu, um pouco na frente do planetão,
// e deslizam bem devagar pro lado.
// ---------------------------------------------------------------------
function texturaDaNuvem(semente) {
  const L = 512, A = 160, c = document.createElement('canvas');
  c.width = L; c.height = A;
  const g = c.getContext('2d');
  let s = semente;
  const aleatorio = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const base = A * 0.78; // linha de baixo, quase reta
  // bolotas macias lado a lado, maiores no meio
  const n = 6 + Math.floor(aleatorio() * 5);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = L * (0.12 + 0.76 * t) + (aleatorio() - 0.5) * 30;
    const meio = 1 - Math.abs(t - 0.5) * 1.6;
    const r = (22 + aleatorio() * 22) * (0.55 + meio * 0.7);
    const y = base - r * (0.45 + aleatorio() * 0.4);
    const grad = g.createRadialGradient(x, y - r * 0.3, r * 0.1, x, y, r * 1.6);
    grad.addColorStop(0, 'rgba(250, 255, 240, 0.85)');
    grad.addColorStop(0.5, 'rgba(228, 246, 222, 0.55)');
    grad.addColorStop(1, 'rgba(210, 238, 210, 0)');
    g.fillStyle = grad;
    g.beginPath(); g.ellipse(x, y, r * 1.6, r * 1.15, 0, 0, Math.PI * 2); g.fill();
  }
  // um fiapo comprido embaixo, que deixa a nuvem rala e esticada
  const fiapo = g.createRadialGradient(L / 2, base, 10, L / 2, base, L * 0.45);
  fiapo.addColorStop(0, 'rgba(225, 245, 220, 0.5)');
  fiapo.addColorStop(1, 'rgba(225, 245, 220, 0)');
  g.save(); g.translate(L / 2, base); g.scale(1, 0.09); g.translate(-L / 2, -base);
  g.fillStyle = fiapo; g.fillRect(0, 0, L, A * 12); g.restore();
  // corta a parte de baixo devagarinho: base achatada, sem borda seca
  g.globalCompositeOperation = 'destination-in';
  const corte = g.createLinearGradient(0, base - 6, 0, base + 12);
  corte.addColorStop(0, 'rgba(0,0,0,1)');
  corte.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = corte; g.fillRect(0, 0, L, A);
  g.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const DIST_NUVEM = 2800;
const nuvens = [];
{
  let s = 11;
  const aleatorio = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 11; i++) {
    const graus = 14 + aleatorio() * 18;           // largura no céu
    const tam = 2 * DIST_NUVEM * Math.tan((graus * Math.PI / 180) / 2);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texturaDaNuvem(101 + i * 977), fog: false, depthWrite: false, transparent: true,
      opacity: 0.45 + aleatorio() * 0.3,
    }));
    sprite.scale.set(tam, tam * 160 / 512, 1);
    cena.add(sprite);
    nuvens.push({
      sprite,
      azimute: (i / 11) * Math.PI * 2 + aleatorio() * 0.5,
      elevacao: 0.07 + aleatorio() * 0.38,
      vento: 0.004 + aleatorio() * 0.004,           // radianos por segundo
    });
  }
}
function posicionarNuvens(dt) {
  for (const n of nuvens) {
    n.azimute += n.vento * dt;
    n.sprite.position.set(
      Math.sin(n.azimute) * Math.cos(n.elevacao), Math.sin(n.elevacao), -Math.cos(n.azimute) * Math.cos(n.elevacao)
    ).multiplyScalar(DIST_NUVEM).add(camera.position);
  }
}

// ---------------------------------------------------------------------
// Água: um plano enorme que acompanha você (então nunca acaba)
// ---------------------------------------------------------------------
// ESCALA: ~17,5 unidades aqui dentro ≈ 1 m na sensação de quem joga
// (régua calibrada pela altura dos olhos rente à grama ≈ 20 cm).
const LADRILHO = 60; // tamanho, em metros, de cada repetição da textura

function texturaDaAgua() {
  const t = 256;
  const c = document.createElement('canvas');
  c.width = c.height = t;
  const g = c.getContext('2d');
  g.fillStyle = CORES.agua;
  g.fillRect(0, 0, t, t);
  let semente = 7;
  const aleatorio = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 90; i++) {
    const x = aleatorio() * t, y = aleatorio() * t;
    const larg = 6 + aleatorio() * 26;
    g.fillStyle = aleatorio() < 0.6 ? 'rgba(255,255,225,0.28)' : 'rgba(70,150,110,0.18)';
    // desenha também nas bordas vizinhas pra emenda não aparecer
    for (const dx of [-t, 0, t]) for (const dy of [-t, 0, t]) {
      g.beginPath();
      g.ellipse(x + dx, y + dy, larg, larg * 0.18, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

const TAM_AGUA = 12000;
const texAgua = texturaDaAgua();
texAgua.repeat.set(TAM_AGUA / LADRILHO, TAM_AGUA / LADRILHO);
// Camuflar a repetição: de longe, mistura uma SEGUNDA cópia da textura,
// girada e em outra escala, e uma variação de tom bem larga. A soma das
// duas quase nunca se repete. De perto continua só a primeira (como antes).
const matAgua = new THREE.MeshBasicMaterial({ map: texAgua });
matAgua.onBeforeCompile = (sh) => {
  sh.uniforms.corBase = { value: new THREE.Color(CORES.agua) };
  sh.fragmentShader = 'uniform vec3 corBase;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
    vec4 tA = texture2D( map, vMapUv );
    vec2 uvB = mat2( 0.8, -0.6, 0.6, 0.8 ) * vMapUv * 0.43 + vec2( 0.37, 0.71 );
    vec4 tB = texture2D( map, uvB );
    float longe = smoothstep( 150.0, 700.0, vFogDepth ); // 0 = perto, 1 = longe
    vec3 cor = corBase
      + ( tA.rgb - corBase ) * mix( 1.0, 0.7, longe )
      + ( tB.rgb - corBase ) * 0.75 * longe;
    // manchas de tom enormes (centenas de metros), só de longe
    vec2 q = vMapUv;
    float macro = sin( q.x * 0.21 + sin( q.y * 0.17 ) * 2.0 ) * sin( q.y * 0.19 + sin( q.x * 0.13 ) * 2.0 );
    cor *= 1.0 + 0.05 * macro * longe;
    diffuseColor.rgb *= cor;
  `);
};
const agua = new THREE.Mesh(new THREE.PlaneGeometry(TAM_AGUA, TAM_AGUA), matAgua);
agua.rotation.x = -Math.PI / 2;
cena.add(agua);

// ---------------------------------------------------------------------
// Ilhas: uma plataforma baixa logo acima da água, com 1 a 4 rochas em cima.
// O mundo é dividido em células (um quadriculado); cada célula pode ter
// uma ilha. Só existem as células perto de você — por isso nunca acaba.
// ---------------------------------------------------------------------
const CELULA = 340;
const ALCANCE = Math.ceil(AJUSTE.neblinaLonge / CELULA);
const AFINA = [0.4, 0.55, 0.7, 0.85]; // quanto o topo da rocha é mais fino que a base
const geosRocha = AFINA.map(t => new THREE.CylinderGeometry(t, 1, 1, 16));
const geoTopo = new THREE.CylinderGeometry(1.1, 1.1, 1, 16);
const matRocha = new THREE.MeshLambertMaterial({ color: CORES.rocha });
const matGrama = new THREE.MeshLambertMaterial({ color: CORES.grama });

// Mancha no gramado: um pedaço onde o solo embaixo é diferente e a grama
// fica num tom mais escuro. Formato de café derramado: redonda, borda ondulada.
// É uma "folha" fininha deitada um tiquinho acima da grama.
const matMancha = new THREE.MeshLambertMaterial({
  color: CORES.mancha,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, // nunca "briga" com a grama
});
// (cx, cz) = centro da mancha na ilha; a parte que passar da borda é
// "aparada" rente à borda, então a mancha nunca flutua em cima da água.
function geometriaMancha(r, cx, cz, ilha, i, j, sem) {
  const f1 = hash(i, j, sem) * 6.3, f2 = hash(i, j, sem + 1) * 6.3, f3 = hash(i, j, sem + 2) * 6.3;
  const achata = 0.7 + hash(i, j, sem + 3) * 0.3;
  const giro = hash(i, j, sem + 4) * Math.PI * 2;
  const cg = Math.cos(giro), sg = Math.sin(giro);
  const forma = new THREE.Shape();
  for (let k = 0; k <= 64; k++) {
    const a = (k / 64) * Math.PI * 2;
    const m = r * (1 + 0.16 * Math.sin(2 * a + f1) + 0.09 * Math.sin(3 * a + f2) + 0.05 * Math.sin(7 * a + f3));
    const lx = Math.cos(a) * m, lz = Math.sin(a) * m * achata;
    let px = cx + lx * cg - lz * sg, pz = cz + lx * sg + lz * cg;
    // passou da borda? puxa o ponto de volta pra cima da borda
    const q = Math.hypot(px / ilha.sx, pz / ilha.sz);
    const limite = contorno(Math.atan2(pz / ilha.sz, px / ilha.sx), ilha.ondas) * 0.985;
    if (q > limite) { px *= limite / q; pz *= limite / q; }
    k ? forma.lineTo(px, -pz) : forma.moveTo(px, -pz); // (deitar no chão troca o sinal do z)
  }
  const geo = new THREE.ShapeGeometry(forma);
  geo.rotateX(-Math.PI / 2); // deita no chão
  return geo;
}
const ilhas = new Map(); // "i,j" -> { grupo, geo, solidos, copas } ou null (célula vazia)

// graminha: um tufinho de 3 folhas finas em leque. É desenhado com "instâncias":
// a placa de vídeo recebe o desenho UMA vez e só a lista de posições de cada
// tufo — por isso milhares deles custam pouco.
function geometriaTufo() {
  const pos = [];
  for (let f = 0; f < 3; f++) {
    const giro = (f / 3) * Math.PI + 0.3;
    const c = Math.cos(giro), s = Math.sin(giro);
    const tomba = (f - 1) * 0.35; // folhas de fora pendem pros lados
    const base = 0.09;
    // triângulo: dois pontos na base, ponta lá em cima e um pouco tombada
    const pts = [[-base, 0, 0], [base, 0, 0], [tomba, 1, 0.15]];
    for (const [x, y, z] of pts) pos.push(x * c - z * s, y, x * s + z * c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}
const geoTufo = geometriaTufo();
const matTufo = new THREE.MeshLambertMaterial({ color: CORES.tufo, side: THREE.DoubleSide });
const DIST_TUFOS = 350; // além disso a graminha nem apareceria: some pra economizar

// árvore de Namek: tronco altíssimo e fininho + copa azul redonda e "peluda"
const geoTronco = new THREE.CylinderGeometry(0.7, 1, 1, 6);
const matTronco = new THREE.MeshLambertMaterial({ color: CORES.tronco });

function texturaDaCopa(semente) {
  const t = 128, c = document.createElement('canvas');
  c.width = c.height = t;
  const g = c.getContext('2d');
  let s = semente;
  const aleatorio = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const meio = t / 2, raio = t * 0.36;
  // corpo da copa: escuro embaixo, mais claro em cima
  const grad = g.createLinearGradient(0, meio - raio, 0, meio + raio);
  grad.addColorStop(0, '#5f84de');
  grad.addColorStop(0.55, '#3d5cc0');
  grad.addColorStop(1, '#283d8f');
  g.fillStyle = grad;
  g.beginPath(); g.arc(meio, meio, raio, 0, Math.PI * 2); g.fill();
  // bolinhas na borda deixam o contorno "peludo"
  for (let k = 0; k < 34; k++) {
    const a = (k / 34) * Math.PI * 2 + aleatorio() * 0.2;
    const r = raio * (0.95 + aleatorio() * 0.08);
    const x = meio + Math.cos(a) * r, y = meio + Math.sin(a) * r;
    g.fillStyle = y < meio ? '#557ad6' : '#2f479f';
    g.beginPath(); g.arc(x, y, 5 + aleatorio() * 6, 0, Math.PI * 2); g.fill();
  }
  // tufos de luz na parte de cima
  for (let k = 0; k < 18; k++) {
    const a = Math.PI * (1.05 + aleatorio() * 0.9);
    const r = raio * aleatorio() * 0.85;
    g.fillStyle = `rgba(150,180,245,${0.25 + aleatorio() * 0.3})`;
    g.beginPath();
    g.ellipse(meio + Math.cos(a) * r, meio + Math.sin(a) * r * 0.8, 6 + aleatorio() * 8, 3 + aleatorio() * 4, aleatorio(), 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const matsCopa = [11, 222, 3333].map(sem =>
  new THREE.SpriteMaterial({ map: texturaDaCopa(sem), alphaTest: 0.5 })
);

// número "aleatório" fixo pra cada célula: o mesmo lugar sempre tem a mesma coisa
function hash(i, j, s = 0) {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(s + 1, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// contorno irregular da ilha: em cada ângulo, quanto a borda estufa ou encolhe
function contorno(a, ondas) {
  return 1 + 0.13 * Math.sin(2 * a + ondas[0]) + 0.08 * Math.sin(5 * a + ondas[1]) + 0.04 * Math.sin(11 * a + ondas[2]);
}

// plataforma: um cilindro achatado com a borda "amassada" pelo contorno
function geometriaPlataforma(ondas) {
  const geo = new THREE.CylinderGeometry(1, 1.06, 1, 40);
  const pos = geo.attributes.position;
  for (let v = 0; v < pos.count; v++) {
    const x = pos.getX(v), z = pos.getZ(v);
    if (x === 0 && z === 0) continue;
    const k = contorno(Math.atan2(z, x), ondas);
    pos.setX(v, x * k);
    pos.setZ(v, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

// Ilha ENORME: só pode nascer em células "pares" (uma a cada 2x2), e as
// 8 células em volta ficam só com água pra ela ter espaço.
function ehEnorme(i, j) {
  return (i & 1) === 0 && (j & 1) === 0 && hash(i, j, 77) < 0.3;
}
function vizinhaDeEnorme(i, j) {
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
    if ((di || dj) && ehEnorme(i + di, j + dj)) return true;
  }
  return false;
}

function criarIlha(i, j) {
  const enorme = ehEnorme(i, j);
  if (!enorme && (vizinhaDeEnorme(i, j) || hash(i, j) > 0.5)) return null; // só água

  // raio médio: a maioria média/grande; as enormes vão de 190 a 300
  const tam = enorme
    ? 190 + hash(i, j, 1) * 110
    : 22 + hash(i, j, 1) ** 1.1 * 115;
  const varia = enorme ? 0.3 : 0.6; // enormes variam menos, pra caber no espaço delas
  const sx = tam * (1 - varia / 2 + hash(i, j, 2) * varia);  // largura...
  const sz = tam * (1 - varia / 2 + hash(i, j, 3) * varia);  // ...e profundidade diferentes
  const folga = Math.max(0, CELULA / 2 - Math.max(sx, sz) * 1.2);
  const x = (i + 0.5) * CELULA + (hash(i, j, 4) - 0.5) * 2 * folga;
  const z = (j + 0.5) * CELULA + (hash(i, j, 5) - 0.5) * 2 * folga;
  const alt = 1.2 + hash(i, j, 6) * 2.3;               // quanto a plataforma sai da água
  const FUNDO = 4;                                    // parte escondida embaixo d'água

  const grupo = new THREE.Group();
  grupo.position.set(x, 0, z);
  const solidos = [];

  // plataforma: lateral rosa, topo azul
  const ondas = [hash(i, j, 30) * 6.3, hash(i, j, 31) * 6.3, hash(i, j, 32) * 6.3];
  const geo = geometriaPlataforma(ondas);
  const plataforma = new THREE.Mesh(geo, [matRocha, matGrama, matGrama]);
  plataforma.scale.set(sx, alt + FUNDO, sz);
  plataforma.position.y = (alt + FUNDO) / 2 - FUNDO;
  grupo.add(plataforma);
  solidos.push({ x, z, rx: sx, rz: sz, base: -FUNDO, h: alt, afina: 1, giro: 0, ondas });

  // manchas no gramado: toda ilha tem pelo menos uma; as maiores chegam a 3.
  // Podem ficar em qualquer lugar, até encostar na borda: o centro fica no
  // mínimo a meio raio da borda, então no máximo ~20% da mancha é aparada.
  const geosManchas = [];
  const menor = Math.min(sx, sz);
  // (nas enormes, proporcional: de 4 a 6)
  const nManchas = enorme
    ? 2 + Math.floor(tam / 70)
    : Math.min(3, 1 + Math.floor((tam + hash(i, j, 9) * 20) / 45));
  for (let k = 0; k < nManchas; k++) {
    const sm = 600 + k * 10;
    const r = Math.min(18 + hash(i, j, sm) * 38, menor * 0.42); // 18 a 56 de raio
    const ang = hash(i, j, sm + 1) * Math.PI * 2;
    const ate = Math.hypot(Math.cos(ang) * sx, Math.sin(ang) * sz); // distância do centro até a borda "lisa"
    const maxT = Math.max(0, contorno(ang, ondas) - (0.5 * r) / ate);
    const t = Math.sqrt(hash(i, j, sm + 2)) * maxT; // raiz: espalha por igual, inclusive perto da borda
    const gm = geometriaMancha(r, Math.cos(ang) * t * sx, Math.sin(ang) * t * sz, { sx, sz, ondas }, i, j, sm + 3);
    const mancha = new THREE.Mesh(gm, matMancha);
    mancha.position.y = alt + 0.08;
    grupo.add(mancha);
    geosManchas.push(gm);
  }

  // rochas em cima: ilha maior comporta mais rochas (até 4)
  // (nas enormes, proporcional ao tamanho: de ~4 a ~11, nunca poucas)
  const maxRochas = enorme ? 1 + Math.floor(tam / 28) : Math.min(4, 1 + Math.floor(tam / 28));
  const n = enorme
    ? Math.ceil(maxRochas / 2) + Math.floor(hash(i, j, 7) * (maxRochas / 2 + 1))
    : 1 + Math.floor(hash(i, j, 7) * maxRochas);
  for (let k = 0; k < n; k++) {
    const s = 100 + k * 10;
    const ang = hash(i, j, s) * Math.PI * 2;
    const dist = Math.sqrt(hash(i, j, s + 1)) * (enorme ? 0.75 : 0.55); // nas enormes, espalha mais
    const px = Math.cos(ang) * dist * sx;
    const pz = Math.sin(ang) * dist * sz;

    const base = 5 + hash(i, j, s + 2) * Math.min(tam * 0.32, 28);
    const rx = base * (0.65 + hash(i, j, s + 3) * 0.7);
    const rz = base * (0.65 + hash(i, j, s + 4) * 0.7);
    const rh = 10 + hash(i, j, s + 5) ** 1.5 * 95;
    const tipo = Math.floor(hash(i, j, s + 6) * AFINA.length);
    const afina = AFINA[tipo];
    const giro = hash(i, j, s + 7) * Math.PI;

    const rocha = new THREE.Group();
    rocha.position.set(px, alt - 1, pz);
    rocha.rotation.y = giro;
    const corpo = new THREE.Mesh(geosRocha[tipo], matRocha);
    corpo.scale.set(rx, rh, rz);
    corpo.position.y = rh / 2;
    const topo = new THREE.Mesh(geoTopo, matGrama);
    topo.scale.set(rx * afina, 2.5, rz * afina);
    topo.position.y = rh;
    rocha.add(corpo, topo);
    grupo.add(rocha);

    solidos.push({ x: x + px, z: z + pz, rx, rz, base: alt - 1, h: alt - 1 + rh + 1.25, afina, giro });
  }

  // árvores: poucas e espalhadas, de 0 a 7 conforme o tamanho da ilha
  const copas = [];
  // (nas enormes, proporcional: de ~6 a ~20)
  const maxArvores = enorme ? Math.floor(tam / 15) : Math.min(7, Math.floor(tam / 15));
  const nArvores = enorme
    ? Math.floor(maxArvores / 2) + Math.floor(hash(i, j, 8) * (maxArvores / 2 + 1))
    : Math.floor(hash(i, j, 8) * (maxArvores + 1));
  for (let k = 0; k < nArvores; k++) {
    const r = 3 + hash(i, j, 300 + k) * 3.5;              // raio da copa
    // procura um lugar livre na ilha (até 6 tentativas)
    let lugar = null;
    for (let tent = 0; tent < 6 && !lugar; tent++) {
      const s = 400 + k * 20 + tent * 2;
      const ang = hash(i, j, s) * Math.PI * 2;
      const dist = Math.sqrt(hash(i, j, s + 1)) * 0.85 * contorno(ang, ondas);
      const px = Math.cos(ang) * dist * sx;
      const pz = Math.sin(ang) * dist * sz;
      if (!encostaEmRocha(x + px, z + pz, r + 2, solidos)) lugar = { px, pz };
    }
    if (!lugar) continue;

    const th = 22 + hash(i, j, 310 + k) * 45;             // altura do tronco
    plantar(lugar.px, alt, lugar.pz, r, th, hash(i, j, 320 + k));
  }

  // evento raro: ~10% das rochas têm uma árvore lá no topo plano
  for (let n = 1; n < solidos.length; n++) {
    if (hash(i, j, 500 + n * 10) > 0.1) continue;
    const roc = solidos[n];
    const r = 2.5 + hash(i, j, 501 + n * 10) * 2.5;        // copa um pouco menor
    const th = 14 + hash(i, j, 502 + n * 10) * 22;
    // um pouco fora do centro, mas sempre dentro do topo
    const a = hash(i, j, 503 + n * 10) * Math.PI * 2;
    const d = Math.min(roc.rx, roc.rz) * roc.afina * 0.4 * hash(i, j, 504 + n * 10);
    plantar(roc.x - x + Math.cos(a) * d, roc.h, roc.z - z + Math.sin(a) * d, r, th, hash(i, j, 505 + n * 10));
  }

  // planta uma árvore com o pé em (px, chao, pz), em coordenadas da ilha
  function plantar(px, chao, pz, r, th, sorteio) {
    const grossura = 0.35 + r * 0.05;
    const tronco = new THREE.Mesh(geoTronco, matTronco);
    tronco.scale.set(grossura, th, grossura);
    tronco.position.set(px, chao + th / 2 - 0.5, pz);
    // a copa é uma figura plana que sempre vira de frente pra você (2.5D)
    const copa = new THREE.Sprite(matsCopa[Math.floor(sorteio * matsCopa.length)]);
    copa.scale.set(r * 2.3, r * 2.3, 1);
    copa.position.set(px, chao + th + r * 0.6, pz);
    grupo.add(tronco, copa);
    // tronco: base, topo e grossura ficam guardados pra esfera poder bater nele
    copas.push({ x: x + px, y: chao + th + r * 0.6, z: z + pz, r, chao, topo: chao + th, grossura });
  }

  // graminhas: em moitinhas espalhadas pela ilha (mais ilha = mais moitas)
  const area = Math.PI * sx * sz;
  const nMoitas = Math.min(260, Math.floor(area / 160));
  const POR_MOITA = 10;
  const tufos = new THREE.InstancedMesh(geoTufo, matTufo, nMoitas * POR_MOITA);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const p3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  let usados = 0;
  for (let mo = 0; mo < nMoitas; mo++) {
    const sm = 1000 + mo * 40;
    const ang = hash(i, j, sm) * Math.PI * 2;
    const dist = Math.sqrt(hash(i, j, sm + 1)) * 0.92 * contorno(ang, ondas);
    const mx = Math.cos(ang) * dist * sx, mz = Math.sin(ang) * dist * sz;
    for (let k = 0; k < POR_MOITA; k++) {
      const a = hash(i, j, sm + 2 + k) * Math.PI * 2;
      const d = hash(i, j, sm + 20 + k) * 5;            // moita com ~5 m de raio
      const tx = mx + Math.cos(a) * d, tz = mz + Math.sin(a) * d;
      if (encostaEmRocha(x + tx, z + tz, 0.3, solidos)) continue;
      const tam = 0.6 + hash(i, j, sm + 30 + k) * 0.8;  // 0,6 a 1,4 aqui ≈ 3 a 8 cm na sensação
      e.set(0, a * 3, 0);
      m4.compose(p3.set(tx, alt, tz), q.setFromEuler(e), s3.set(tam, tam, tam));
      tufos.setMatrixAt(usados++, m4);
    }
  }
  tufos.count = usados;
  tufos.frustumCulled = false; // quem decide se aparece é a distância (lá no atualizar)
  grupo.add(tufos);

  cena.add(grupo);
  return { grupo, geo, geosManchas, tufos, x, z, solidos, copas };
}

// esse ponto (com essa folga) fica em cima de alguma rocha?
function encostaEmRocha(px, pz, folga, solidos) {
  for (let n = 1; n < solidos.length; n++) {
    const s = solidos[n];
    const dx = px - s.x, dz = pz - s.z;
    const c = Math.cos(s.giro), sn = Math.sin(s.giro);
    const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
    if (Math.hypot(lx / (s.rx + folga), lz / (s.rz + folga)) < 1) return true;
  }
  return false;
}

let celulaAtual = null;
function atualizarIlhas() {
  const ci = Math.floor(camera.position.x / CELULA);
  const cj = Math.floor(camera.position.z / CELULA);
  const chave = ci + ',' + cj;
  if (chave === celulaAtual) return;
  celulaAtual = chave;

  const precisa = new Set();
  for (let di = -ALCANCE; di <= ALCANCE; di++) {
    for (let dj = -ALCANCE; dj <= ALCANCE; dj++) {
      if (di * di + dj * dj > ALCANCE * ALCANCE) continue;
      const k = (ci + di) + ',' + (cj + dj);
      precisa.add(k);
      if (!ilhas.has(k)) ilhas.set(k, criarIlha(ci + di, cj + dj));
    }
  }
  // o que ficou longe some (e libera memória)
  for (const [k, ilha] of ilhas) {
    if (precisa.has(k)) continue;
    if (ilha) {
      cena.remove(ilha.grupo);
      ilha.geo.dispose();
      ilha.geosManchas.forEach(g => g.dispose());
      ilha.tufos.dispose();
    }
    ilhas.delete(k);
  }
}

// ilhas das 9 células em volta de você (as únicas em que dá pra bater)
function* ilhasPerto() {
  const ci = Math.floor(camera.position.x / CELULA);
  const cj = Math.floor(camera.position.z / CELULA);
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
    const ilha = ilhas.get((ci + di) + ',' + (cj + dj));
    if (ilha) yield ilha;
  }
}

// ---------------------------------------------------------------------
// Teclas (setinhas e WASD fazem a mesma coisa)
// ---------------------------------------------------------------------
const MAPA = {
  KeyW: 'frente',   ArrowUp: 'frente',
  KeyS: 'tras',     ArrowDown: 'tras',
  KeyA: 'esquerda', ArrowLeft: 'esquerda',
  KeyD: 'direita',  ArrowRight: 'direita',
  Space: 'subir',
  KeyC: 'descer',
  ShiftLeft: 'dash', ShiftRight: 'dash',
};
// o Shift da direita acende o mesmo desenho do Shift da esquerda
const DESENHO = { ShiftRight: 'ShiftLeft' };

const apertadas = new Set();

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
  apertadas.add(codigo);
  marcarTecla(codigo, true);
  return true;
}

function soltar(codigo) {
  if (apertadas.delete(codigo)) marcarTecla(codigo, false);
}

window.addEventListener('keydown', e => {
  if (apertar(e.code)) e.preventDefault(); // impede a página de rolar com setas/espaço
});
window.addEventListener('keyup', e => soltar(e.code));
window.addEventListener('blur', () => [...apertadas].forEach(soltar));

// clicar/tocar nas teclas do painel funciona como apertar de verdade
document.querySelectorAll('[data-tecla]').forEach(el => {
  const codigo = el.dataset.tecla;
  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    apertar(codigo);
  });
  const fim = () => soltar(codigo);
  el.addEventListener('pointerup', fim);
  el.addEventListener('pointercancel', fim);
  el.addEventListener('lostpointercapture', fim);
});

// ---------------------------------------------------------------------
// Mouse: clique prende o mouse na tela; Esc solta (regra do navegador)
// ---------------------------------------------------------------------
const convite = document.getElementById('convite');
const desenhoMouse = document.getElementById('mouse');
const botaoEsq = document.getElementById('mouseEsq');
const botaoDir = document.getElementById('mouseDir');

let yaw = 0;    // girar pros lados
let pitch = 0;  // olhar pra cima/baixo
const empurraoMouse = { x: 0, y: 0 }; // só pro desenho do mouse escorregar

// Se o navegador não deixar prender o mouse, dá pra olhar clicando e arrastando.
let arrastando = false;

canvas.addEventListener('click', () => {
  convite.classList.add('escondido');
  if (document.pointerLockElement === canvas) return;
  try {
    const pedido = canvas.requestPointerLock();
    if (pedido && pedido.catch) pedido.catch(() => {});
  } catch (erro) { /* sem trava: segue no modo arrastar */ }
});
document.addEventListener('pointerlockchange', () => {
  // soltou com Esc: mostra o convite de novo
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
// Voo
// ---------------------------------------------------------------------
const vel = new THREE.Vector3();
const frente = new THREE.Vector3();
const direita = new THREE.Vector3();
const desejo = new THREE.Vector3();
let inclinacao = 0;
let giro = 0;          // velocidade com que você está virando o olhar
let yawAntes = 0;

function suavizar(atual, alvo, rapidez, dt) {
  return atual + (alvo - atual) * (1 - Math.exp(-rapidez * dt));
}

// Cada sólido é tratado como um cilindro oval (que pode afinar no topo;
// a plataforma da ilha ainda tem o contorno irregular).
const FOLGA_LADO = 1.5; // distância mínima entre seus olhos e uma parede
function colidir(s) {
  const p = camera.position;
  const olhos = AJUSTE.alturaOlhos;
  if (p.y >= s.h + olhos) return;
  // traz a posição pro "jeito" do sólido (desfaz o giro dele)
  const dx = p.x - s.x, dz = p.z - s.z;
  const c = Math.cos(s.giro), sn = Math.sin(s.giro);
  const lx = dx * c - dz * sn;
  const lz = dx * sn + dz * c;
  // largura na altura em que você está (a rocha afina pra cima)
  const t = Math.min(1, Math.max(0, (p.y - s.base) / (s.h - s.base)));
  let larg = 1 + (s.afina - 1) * t;
  if (s.ondas) larg *= contorno(Math.atan2(lz / s.rz, lx / s.rx), s.ondas);
  const ex = s.rx * larg + FOLGA_LADO, ez = s.rz * larg + FOLGA_LADO;
  const q = Math.hypot(lx / ex, lz / ez);
  if (q >= 1) return;

  if (p.y > s.h - 2.5) {
    // chegou por cima: fica pairando na altura dos olhos
    p.y = s.h + olhos;
    if (vel.y < 0) vel.y = 0;
    return;
  }
  // bateu na lateral: empurra pra fora e escorrega em volta
  const fx = lx / q, fz = lz / q;
  p.x = s.x + fx * c + fz * sn;
  p.z = s.z - fx * sn + fz * c;
  const d = Math.hypot(dx, dz) || 1;
  const nx = dx / d, nz = dz / d;
  const contra = vel.x * nx + vel.z * nz;
  if (contra < 0) { vel.x -= contra * nx; vel.z -= contra * nz; }
}

// ---------------------------------------------------------------------
// Esfera de 4 estrelas: fica numa ilha perto de onde você começa.
// Você esbarra, ela rola; se cair no mar, afunda e some.
// Tamanho: um pouco maior que uma cabeça (~30 cm na sensação).
// ---------------------------------------------------------------------
const R_ESFERA = 2.6;      // raio, em unidades daqui de dentro
const RAIO_CORPO = 2;      // "tamanho" do seu corpo pra esbarrar nela
const GRAVIDADE = 170;     // ≈ 9,8 m/s² na escala sentida
const esfera = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(),
  ilha: null,              // a ilha onde ela está (guardada mesmo se a ilha sair da memória)
  afundando: false, sumiu: false,
  casca: null, estrelas: null,
};

function texturaDasEstrelas() {
  const t = 128, c = document.createElement('canvas');
  c.width = c.height = t;
  const g = c.getContext('2d');
  const estrela = (x, y, r) => {
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const rr = k % 2 ? r * 0.45 : r;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  };
  g.fillStyle = '#d8261c';
  // as 4 estrelas num losango meio torto, como na referência
  for (const [x, y] of [[-12, -19], [17, -10], [-17, 10], [12, 19]]) estrela(64 + x, 64 + y, 10);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function criarEsfera() {
  // escolhe uma ilha GRANDE (raio médio de 90 pra cima) entre as carregadas,
  // pra ter espaço pra brincar; se não tiver, fica a maior que tiver
  const raio = il => (il.solidos[0].rx + il.solidos[0].rz) / 2;
  const todas = [...ilhas.values()].filter(Boolean);
  if (!todas.length) return;
  const grandes = todas.filter(il => raio(il) >= 90);
  const ilha = grandes.length
    ? grandes[Math.floor(Math.random() * grandes.length)]
    : todas.reduce((a, b) => (raio(b) > raio(a) ? b : a));
  const s = ilha.solidos[0];

  // um lugar livre na ilha, num lado qualquer
  const angBase = Math.random() * Math.PI * 2;
  let lugar = null;
  for (let tent = 0; tent < 40 && !lugar; tent++) {
    const ang = angBase + (tent % 2 ? 1 : -1) * Math.floor(tent / 2) * 0.12;
    const t = contorno(ang, s.ondas) * (0.75 - (tent % 5) * 0.08);
    const px = s.x + Math.cos(ang) * t * s.rx, pz = s.z + Math.sin(ang) * t * s.rz;
    if (!encostaEmRocha(px, pz, R_ESFERA + 3, ilha.solidos)) lugar = { px, pz, ang };
  }
  if (!lugar) return;

  esfera.ilha = ilha;
  esfera.pos.set(lugar.px, s.h + R_ESFERA, lugar.pz);

  // casca: vidro laranja brilhante, meio translúcido
  esfera.casca = new THREE.Mesh(
    new THREE.SphereGeometry(R_ESFERA, 32, 20),
    new THREE.MeshPhongMaterial({
      color: '#f7a02c', emissive: '#6e2c00', specular: '#fff6e0', shininess: 90,
      transparent: true, opacity: 0.9, depthWrite: false,
    })
  );
  esfera.casca.renderOrder = 1;
  // estrelas: "flutuando" lá dentro, sempre de frente pra você
  esfera.estrelas = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaDasEstrelas(), transparent: true }));
  esfera.estrelas.scale.set(R_ESFERA * 1.5, R_ESFERA * 1.5, 1);
  esfera.estrelas.renderOrder = 2;
  cena.add(esfera.casca, esfera.estrelas);

  // você começa no alto, a uma distância em que ela aparece no radar,
  // pro lado de fora da ilha (mais ou menos) e olhando pra frente,
  // não pra ela: tem que procurar o pontinho laranja
  const angVoce = lugar.ang + (Math.random() - 0.5) * 2;
  const longe = 200 + Math.random() * 300;
  camera.position.set(esfera.pos.x + Math.cos(angVoce) * longe, 40, esfera.pos.z + Math.sin(angVoce) * longe);
  atualizarIlhas(); // carrega o mundo em volta do novo começo

}

// a esfera está em cima da plataforma da ilha dela?
function emCimaDaIlha(x, z) {
  const s = esfera.ilha.solidos[0];
  const lx = (x - s.x) / s.rx, lz = (z - s.z) / s.rz;
  return Math.hypot(lx, lz) < contorno(Math.atan2(lz, lx), s.ondas);
}

const _n = new THREE.Vector3();
function atualizarEsfera(dt) {
  if (!esfera.casca || esfera.sumiu) return;
  const p = esfera.pos, v = esfera.vel;

  // você esbarrou nela? empurra (e você não atravessa)
  _n.subVectors(p, camera.position);
  const dist = _n.length();
  const min = R_ESFERA + RAIO_CORPO;
  if (dist < min && !esfera.afundando) {
    _n.divideScalar(dist || 1);
    camera.position.copy(p).addScaledVector(_n, -min);
    const aproxima = vel.dot(_n) - v.dot(_n); // quão rápido você vinha na direção dela
    if (aproxima > 0) {
      v.addScaledVector(_n, aproxima * 1.3);
      vel.addScaledVector(_n, -aproxima * 0.35); // você perde um pouco de velocidade
    }
  }

  const s = esfera.ilha.solidos[0];
  const sobreIlha = emCimaDaIlha(p.x, p.z);

  if (esfera.afundando) {
    // na água: freia, desce devagar e vai sumindo
    v.x *= Math.exp(-2.5 * dt);
    v.z *= Math.exp(-2.5 * dt);
    v.y = suavizar(v.y, -3, 3, dt);
    p.addScaledVector(v, dt);
    const fundo = Math.min(1, Math.max(0, -p.y / (R_ESFERA * 3)));
    esfera.casca.material.opacity = 0.9 * (1 - fundo);
    esfera.estrelas.material.opacity = 1 - fundo;
    if (fundo >= 1) {
      cena.remove(esfera.casca, esfera.estrelas);
      esfera.sumiu = true;
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
    } else if (!sobreIlha && p.y - R_ESFERA <= 0) {
      esfera.afundando = true; // tchibum
    }

    // bate nos troncos das árvores (só a esfera: você atravessa, pra não enroscar voando)
    for (const arv of esfera.ilha.copas) {
      if (p.y - R_ESFERA > arv.topo || p.y + R_ESFERA < arv.chao) continue;
      const dx = p.x - arv.x, dz = p.z - arv.z;
      const d = Math.hypot(dx, dz), min = arv.grossura + R_ESFERA;
      if (d >= min) continue;
      const nx = dx / (d || 1), nz = dz / (d || 1);
      p.x = arv.x + nx * min;
      p.z = arv.z + nz * min;
      const contra = v.x * nx + v.z * nz;
      if (contra < 0) { v.x -= 1.5 * contra * nx; v.z -= 1.5 * contra * nz; } // quica e perde metade
    }

    // bate nas rochas da ilha e volta
    for (let n = 1; n < esfera.ilha.solidos.length; n++) {
      const r = esfera.ilha.solidos[n];
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
      if (contra < 0) { v.x -= 1.5 * contra * nx; v.z -= 1.5 * contra * nz; }
    }
  }

  // rolar: gira a casca em volta do eixo deitado, na medida do caminho andado
  const vh = Math.hypot(v.x, v.z);
  if (vh > 0.01) {
    _n.set(v.z, 0, -v.x).normalize();
    const giro = (vh * dt) / R_ESFERA;
    esfera.casca.rotateOnWorldAxis(_n, giro);
    // as estrelas viram junto, pro lado que ela rola na sua tela
    const lado = Math.sign(v.x * Math.cos(yaw) - v.z * Math.sin(yaw)) || 1;
    esfera.estrelas.material.rotation -= giro * lado;
  }
  esfera.casca.position.copy(p);
  esfera.estrelas.position.copy(p);
}

// copa da árvore: uma bola que te empurra pra fora (o tronco fino dá pra atravessar)
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

function atualizar(dt) {
  if (!(dt > 0)) return; // tempo zero (ou inválido): nada a fazer, e evita dividir por zero
  // direções a partir de pra onde você está olhando
  frente.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  direita.set(Math.cos(yaw), 0, -Math.sin(yaw));

  const f = (segurando('frente') ? 1 : 0) - (segurando('tras') ? 1 : 0);
  const l = (segurando('direita') ? 1 : 0) - (segurando('esquerda') ? 1 : 0);
  const u = (segurando('subir') ? 1 : 0) - (segurando('descer') ? 1 : 0);

  desejo.set(0, 0, 0)
    .addScaledVector(frente, f)
    .addScaledVector(direita, l);
  desejo.y += u;
  if (desejo.lengthSq() > 1) desejo.normalize();

  const dashLigado = segurando('dash');
  const fator = dashLigado ? AJUSTE.dash : 1;
  vel.addScaledVector(desejo, AJUSTE.acel * fator * dt);
  // arranque: o dash engata quase na hora, em vez de esperar a inércia
  if (dashLigado && vel.length() < AJUSTE.velMax * fator * 0.95) {
    vel.addScaledVector(desejo, AJUSTE.arranqueDash * dt);
  }
  vel.multiplyScalar(Math.exp(-AJUSTE.arrasto * dt)); // inércia
  // passou do limite (ex.: soltou o Shift): desacelera suave em vez de frear seco
  const limite = AJUSTE.velMax * fator;
  const v = vel.length();
  if (v > limite) vel.setLength(suavizar(v, limite, 2.5, dt));

  camera.position.addScaledVector(vel, dt);

  // não afundar na água
  if (camera.position.y < AJUSTE.alturaOlhos) {
    camera.position.y = AJUSTE.alturaOlhos;
    if (vel.y < 0) vel.y = 0;
  }

  // não atravessar ilhas e rochas
  for (const ilha of ilhasPerto()) {
    for (const s of ilha.solidos) colidir(s);
    for (const copa of ilha.copas) colidirCopa(copa);
  }
  atualizarEsfera(dt);

  // sensação: o campo de visão abre com a velocidade e a câmera tomba de lado
  const rapidez = vel.length() / AJUSTE.velMax; // 1 = velocidade normal, 2 = dash
  const abre = (AJUSTE.fovVeloz - AJUSTE.fovParado) * (rapidez <= 1 ? rapidez : 1 + (rapidez - 1) * 0.6);
  camera.fov = suavizar(camera.fov, AJUSTE.fovParado + abre, 4, dt);
  camera.updateProjectionMatrix();
  // tombar: pra dentro da curva quando vira o mouse, e pro lado quando aperta A/D
  // (virar pra direita = yaw diminuindo = tomba pra direita, como um avião)
  giro = suavizar(giro, (yaw - yawAntes) / dt, 10, dt);
  yawAntes = yaw;
  let alvoInclina = giro * AJUSTE.inclinaCurva - l * AJUSTE.inclinaLado;
  alvoInclina = Math.max(-AJUSTE.inclinaMax, Math.min(AJUSTE.inclinaMax, alvoInclina));
  inclinacao = suavizar(inclinacao, alvoInclina, 5, dt);

  camera.rotation.set(pitch, yaw, inclinacao);

  // céu e água acompanham você
  ceu.position.copy(camera.position);
  for (const sat of satelites) sat.sprite.position.copy(camera.position).add(sat.dir);
  posicionarNuvens(dt);
  agua.position.x = Math.round(camera.position.x / LADRILHO) * LADRILHO;
  agua.position.z = Math.round(camera.position.z / LADRILHO) * LADRILHO;
  atualizarIlhas();
  // graminha só aparece nas ilhas perto
  for (const ilha of ilhas.values()) {
    if (!ilha) continue;
    const longe = Math.hypot(ilha.x - camera.position.x, ilha.z - camera.position.z);
    ilha.tufos.visible = longe < DIST_TUFOS + Math.max(ilha.solidos[0].rx, ilha.solidos[0].rz);
  }

  // desenho do mouse escorrega na direção do movimento e volta
  empurraoMouse.x = suavizar(empurraoMouse.x, 0, 10, dt);
  empurraoMouse.y = suavizar(empurraoMouse.y, 0, 10, dt);
  const mx = Math.max(-6, Math.min(6, empurraoMouse.x * 0.15));
  const my = Math.max(-6, Math.min(6, empurraoMouse.y * 0.15));
  desenhoMouse.style.setProperty('--mx', mx.toFixed(1) + 'px');
  desenhoMouse.style.setProperty('--my', my.toFixed(1) + 'px');
}

// ---------------------------------------------------------------------
// Radar: o mundo visto de cima. Você é o pontinho amarelo no meio,
// e o mapa gira junto, então "pra cima" no radar é sempre pra onde você olha.
// ---------------------------------------------------------------------
const radar = document.getElementById('radar');
const rctx = radar.getContext('2d');
const RADAR_ALCANCE = 700; // metros do centro até a borda do radar
const RADAR_GRADE = 100;   // cada quadradinho = 100 m

function desenharRadar(tempo) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const lado = radar.clientWidth;
  if (radar.width !== Math.round(lado * dpr)) {
    radar.width = radar.height = Math.round(lado * dpr);
  }
  const R = lado / 2;
  const esc = R / RADAR_ALCANCE;
  const cx = camera.position.x, cz = camera.position.z;

  rctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // tela verde
  const fundo = rctx.createRadialGradient(R, R, 0, R, R, R);
  fundo.addColorStop(0, '#37b04f');
  fundo.addColorStop(1, '#1d7a33');
  rctx.fillStyle = fundo;
  rctx.fillRect(0, 0, lado, lado);

  // daqui pra frente desenha em metros do mundo, já girado
  rctx.save();
  rctx.translate(R, R);
  rctx.rotate(yaw);
  rctx.scale(esc, esc);
  rctx.translate(-cx, -cz);
  const px = 1 / esc; // 1 pixel de tela, medido em metros

  // quadriculado preso ao mundo (ele passa por baixo de você quando voa)
  rctx.strokeStyle = 'rgba(10, 50, 20, 0.55)';
  rctx.lineWidth = px;
  rctx.beginPath();
  const A = RADAR_ALCANCE * 1.5;
  const x0 = Math.floor((cx - A) / RADAR_GRADE) * RADAR_GRADE;
  const z0 = Math.floor((cz - A) / RADAR_GRADE) * RADAR_GRADE;
  for (let x = x0; x <= cx + A; x += RADAR_GRADE) { rctx.moveTo(x, cz - A); rctx.lineTo(x, cz + A); }
  for (let z = z0; z <= cz + A; z += RADAR_GRADE) { rctx.moveTo(cx - A, z); rctx.lineTo(cx + A, z); }
  rctx.stroke();

  // ilhas
  for (const ilha of ilhas.values()) {
    if (!ilha) continue;
    const s = ilha.solidos[0];
    if (Math.hypot(s.x - cx, s.z - cz) > RADAR_ALCANCE * 1.5 + Math.max(s.rx, s.rz)) continue;
    rctx.beginPath();
    for (let k = 0; k <= 36; k++) {
      const a = (k / 36) * Math.PI * 2;
      const m = contorno(a, s.ondas);
      const x = s.x + Math.cos(a) * m * s.rx, z = s.z + Math.sin(a) * m * s.rz;
      k ? rctx.lineTo(x, z) : rctx.moveTo(x, z);
    }
    rctx.fillStyle = 'rgba(170, 235, 150, 0.45)';
    rctx.fill();
    rctx.strokeStyle = 'rgba(225, 255, 210, 0.95)';
    rctx.lineWidth = 1.5 * px;
    rctx.stroke();
    // rochas como manchinhas mais claras
    rctx.fillStyle = 'rgba(235, 255, 225, 0.6)';
    for (let n = 1; n < ilha.solidos.length; n++) {
      const r = ilha.solidos[n];
      rctx.beginPath();
      rctx.ellipse(r.x, r.z, r.rx, r.rz, -r.giro, 0, Math.PI * 2);
      rctx.fill();
    }
  }
  rctx.restore();

  // esfera: ponto laranja piscando (se estiver longe, fica grudado na borda do radar)
  if (esfera.casca && !esfera.sumiu) {
    const dx = esfera.pos.x - cx, dz = esfera.pos.z - cz;
    let ex = (dx * Math.cos(yaw) - dz * Math.sin(yaw)) * esc;
    let ey = (dx * Math.sin(yaw) + dz * Math.cos(yaw)) * esc;
    const longe = Math.hypot(ex, ey), maximo = R - 9;
    if (longe > maximo) { ex *= maximo / longe; ey *= maximo / longe; }
    const pisca = 0.5 + 0.5 * Math.sin(tempo * 7);
    rctx.shadowColor = '#ff8a1c';
    rctx.shadowBlur = 6 + pisca * 10;
    rctx.fillStyle = `rgba(255, 140, 30, ${0.45 + pisca * 0.55})`;
    rctx.beginPath();
    rctx.arc(R + ex, R + ey, 4, 0, Math.PI * 2);
    rctx.fill();
    rctx.shadowBlur = 0;
  }

  // você: um pontinho amarelo pulsando, com um leque mostrando pra onde olha
  rctx.fillStyle = 'rgba(255, 245, 160, 0.18)';
  rctx.beginPath();
  rctx.moveTo(R, R);
  rctx.arc(R, R, R * 0.45, -Math.PI / 2 - 0.45, -Math.PI / 2 + 0.45);
  rctx.closePath();
  rctx.fill();

  const pulso = 0.5 + 0.5 * Math.sin(tempo * 5);
  rctx.shadowColor = '#fff27a';
  rctx.shadowBlur = 8 + pulso * 8;
  rctx.fillStyle = '#ffe94a';
  rctx.beginPath();
  rctx.arc(R, R, 3.5 + pulso * 1.2, 0, Math.PI * 2);
  rctx.fill();
  rctx.shadowBlur = 0;
}

// ---------------------------------------------------------------------
// Risquinhos de velocidade (estilo anime): aparecem nas bordas da tela
// durante o dash, e são sorteados de novo a cada quadro pra "tremer".
// ---------------------------------------------------------------------
const riscos = document.getElementById('riscos');
const kctx = riscos.getContext('2d');
let forcaRiscos = 0;

function desenharRiscos(dt) {
  const veloz = (vel.length() - AJUSTE.velMax) / AJUSTE.velMax; // 0 = normal, 1 = dash cheio
  const alvo = segurando('dash') ? Math.max(0, Math.min(1, veloz * 1.3)) : 0;
  forcaRiscos = suavizar(forcaRiscos, alvo, alvo > forcaRiscos ? 6 : 4, dt);

  const W = window.innerWidth, H = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (riscos.width !== Math.round(W * dpr) || riscos.height !== Math.round(H * dpr)) {
    riscos.width = Math.round(W * dpr);
    riscos.height = Math.round(H * dpr);
  }
  kctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  kctx.clearRect(0, 0, W, H);
  if (forcaRiscos < 0.02) return;

  const cx = W / 2, cy = H / 2;
  const n = Math.round(45 * forcaRiscos);
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2;
    const c0 = Math.cos(a), s0 = Math.sin(a);
    // distância do centro até a borda da tela nessa direção
    const borda = Math.min(cx / Math.max(Math.abs(c0), 1e-6), cy / Math.max(Math.abs(s0), 1e-6));
    // quanto o risco "invade" a tela: nos lados, cheio; em cima e embaixo, metade
    // (assim o meio limpo fica oval, não um retângulo tipo mini tela)
    const lateral = 1 - 0.5 * s0 * s0;
    const invade = borda * (0.15 + Math.random() * 0.3) * lateral;
    const r0 = borda - invade;                               // começa dentro da tela...
    const r1 = r0 + invade * (0.7 + Math.random() * 0.6);    // ...e vai até a borda (ou quase)
    const larg = 1 + Math.random() * 2.4;
    const c = Math.cos(a), s = Math.sin(a);
    // um triângulo bem fino: ponta pro centro, mais largo pra fora
    kctx.fillStyle = `rgba(255, 255, 250, ${(0.55 + Math.random() * 0.4) * forcaRiscos})`;
    kctx.beginPath();
    kctx.moveTo(cx + c * r0, cy + s * r0);
    kctx.lineTo(cx + c * r1 - s * larg, cy + s * r1 + c * larg);
    kctx.lineTo(cx + c * r1 + s * larg, cy + s * r1 - c * larg);
    kctx.closePath();
    kctx.fill();
  }
}

// ---------------------------------------------------------------------
// Altura acima do mar, já convertida pra escala que você sente
// (17,5 unidades aqui dentro ≈ 1 metro na sensação: com os olhos rente
// à grama, a 3,5 unidades, a sensação é de uns 20 cm)
// ---------------------------------------------------------------------
const ESCALA_SENTIDA = 17.5;
const alturaNum = document.getElementById('alturaNum');
let alturaMostrada = '';
function mostrarAltura() {
  const h = camera.position.y / ESCALA_SENTIDA;
  const texto = h < 10 ? h.toFixed(1).replace('.', ',') : String(Math.round(h));
  if (texto !== alturaMostrada) { alturaNum.textContent = texto; alturaMostrada = texto; }
}

// ondinhas: a textura da água desliza devagar
function animarAgua(tempo) {
  texAgua.offset.set(tempo * 0.01, Math.sin(tempo * 0.3) * 0.02);
}

// ---------------------------------------------------------------------
// Laço principal
// ---------------------------------------------------------------------
let antes = performance.now();
function quadro(agora) {
  const dt = Math.min((agora - antes) / 1000, 0.05);
  antes = agora;
  atualizar(dt);
  animarAgua(agora / 1000);
  renderer.render(cena, camera);
  desenharRadar(agora / 1000);
  desenharRiscos(dt);
  mostrarAltura();
  requestAnimationFrame(quadro);
}
atualizarIlhas();
criarEsfera();
requestAnimationFrame(quadro);

// atalho pra testar pelo console do navegador
window.planeta = { camera, vel, apertar, soltar, ilhas, esfera,
  passo(seg = 1 / 60) { atualizar(seg); renderer.render(cena, camera); desenharRadar(0); desenharRiscos(seg); mostrarAltura(); }, get yaw() { return yaw; }, set yaw(v) { yaw = v; }, get pitch() { return pitch; }, set pitch(v) { pitch = v; } };
})();
