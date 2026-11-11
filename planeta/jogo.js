// Planeta — etapa 1: voar em primeira pessoa sobre a água.
// Unidades do mundo ≈ metros. y é a altura; a água fica em y = 0.

// A biblioteca de 3D vem de um link. Carregando assim, o jogo funciona
// tanto no site quanto abrindo o index.html direto (duplo clique).
// Versão oficial (a que vai pro ar no próximo push). Ver CHANGELOG.md.
const VERSAO = '2.1.0';
console.log(`Planeta v${VERSAO}`);
// aparece na tela, embaixo do nome (o número vem só daqui)
document.getElementById('versao').textContent = 'v' + VERSAO;

// Tela de toque (celular/tablet): troca teclado e mouse por joystick, arrastar pra
// olhar e botões grandes. No computador nada muda.
const TOQUE = matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;
if (TOQUE) {
  document.body.classList.add('toque');
  document.getElementById('convite').textContent = 'toque pra voar';
}

(async () => {
const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');

// ---------------------------------------------------------------------
// Ajustes de sensação (é aqui que a gente mexe pra deixar gostoso)
// ---------------------------------------------------------------------
const AJUSTE = {
  sensibilidade: 0.0022,  // quanto o olhar gira por pixel de mouse
  sensibilidadeToque: 0.005, // ...e por pixel de dedo arrastado (celular)
  raioJoystick: 55,       // px: quanto o dedo anda do centro do joystick até a força máxima
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
  agua: '#5fae8a',       // superfície (meio-termo entre o menta antigo e o anime)
  aguaFunda: '#3d8a70',  // o que se vê lá embaixo, através da água turva
  rocha: '#e9aab3',
  grama: '#7d9ce2',
  tronco: '#e6c3b4',
  tufo: '#6683d6',
  mancha: '#c9b4a2',   // terra compactada, seca e dura (no anime, o chão aparecendo na grama)
};

// ---------------------------------------------------------------------
// Cena, câmera e renderizador
// ---------------------------------------------------------------------
const canvas = document.getElementById('tela');
// logarithmicDepthBuffer: guarda a distância de cada pixel com precisão boa
// tanto perto quanto longe. Sem isso, lá do alto o topo das ilhas "briga"
// com a água (z-fighting) e as ilhas piscam/somem.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
// no celular, resolução um pouco menor: a tela é pequena e o processador é mais fraco
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TOQUE ? 1.5 : 2));

const cena = new THREE.Scene();
// neblina na cor do horizonte = quanto mais longe, mais desbotado
cena.fog = new THREE.Fog(CORES.horizonte, AJUSTE.neblinaPerto, AJUSTE.neblinaLonge);

// 0.5 = o mais perto que a câmera enxerga (bem menos que a altura mínima dos olhos)
const camera = new THREE.PerspectiveCamera(AJUSTE.fovParado, 1, 0.5, 200000); // longe: lá do espaço o planeta é enorme
camera.rotation.order = 'YXZ'; // primeiro gira pros lados, depois pra cima/baixo
camera.position.set(0, 40, 0);

function ajustarTela() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', ajustarTela);
ajustarTela();

const hemi = new THREE.HemisphereLight('#e8f6d0', '#9fb3e6', 2.2);
cena.add(hemi);
const sol = new THREE.DirectionalLight('#fff4e0', 1.6);
sol.position.set(-0.5, 1, 0.3);
cena.add(sol);

// ---------------------------------------------------------------------
// Céu: uma esfera gigante em volta da câmera, pintada por dentro
// ---------------------------------------------------------------------
// O degradê do céu fica numa função só, porque a água usa a mesma pra
// refletir o céu. h = quanto a direção aponta pra cima (0 = horizonte, 1 = zênite)
// escuro: 0 = céu normal, 1 = céu escuro de quando junta as 7 esferas
const uniEscuro = { value: 0 };
// alto: 0 = até 200 m; vai a 1 em 500 m (espaço). O céu fica rarefeito e depois preto
const uniAlto = { value: 0 };
const CEU_GLSL = `
  uniform float escuro;
  uniform float alto;
  vec3 corDoCeu(float h) {
    // de baixo pra cima: verde-amarelado claro -> verde-amarelado -> verde
    vec3 claro   = vec3(0.859, 0.906, 0.675); // = CORES.horizonte (#dbe7ac)
    vec3 amarelo = vec3(0.800, 0.878, 0.553);
    vec3 verdeCl = vec3(0.624, 0.824, 0.478);
    vec3 verde   = vec3(0.310, 0.702, 0.322);
    vec3 c = claro;
    c = mix(c, amarelo, smoothstep(0.00, 0.08, h));
    c = mix(c, verdeCl, smoothstep(0.08, 0.30, h));
    c = mix(c, verde,   smoothstep(0.30, 0.75, h));
    // céu escuro: verde-azulado fundo, quase noite, mais claro no horizonte
    vec3 e = mix(vec3(0.12, 0.32, 0.25), vec3(0.06, 0.21, 0.18), smoothstep(0.0, 0.25, h));
    e = mix(e, vec3(0.02, 0.10, 0.10), smoothstep(0.25, 0.85, h));
    c = mix(c, e, escuro);
    // subindo: primeiro o ar fica rarefeito (azul-esverdeado fundo, apagado),
    // depois vira espaço (quase preto, um fio azul no horizonte)
    vec3 rarefeito = mix(vec3(0.28, 0.52, 0.55), vec3(0.08, 0.20, 0.30), smoothstep(0.0, 0.6, h));
    vec3 espaco = mix(vec3(0.05, 0.10, 0.18), vec3(0.005, 0.008, 0.02), smoothstep(0.0, 0.35, h));
    c = mix(c, rarefeito, smoothstep(0.0, 0.55, alto));
    c = mix(c, espaco, smoothstep(0.45, 1.0, alto));
    return c;
  }
`;
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
    uniforms: { escuro: uniEscuro, alto: uniAlto },
    fragmentShader: CEU_GLSL + `
      varying vec3 vDir;
      void main() {
        vec3 c = corDoCeu(vDir.y);
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
// Nuvens: coisas de verdade no mundo, lá no alto. Cada uma é um montinho
// de bolotas macias (sprites); embaixo, bolotas largas e achatadas fazem a
// base reta. Ficam espalhadas num quadriculado próprio, como as ilhas, e
// o vento leva todas juntas bem devagar. Dá pra subir e atravessar.
// ---------------------------------------------------------------------
const NUVEM = {
  alturaMin: 650,   // base da nuvem mais baixa (~37 m na sua régua)
  alturaMax: 850,
  celula: 900,      // uma chance de nuvem a cada 900 x 900
  chance: 0.45,
  opacidade: 0.6,   // rala: dá pra ver o céu através
  vento: new THREE.Vector3(4, 0, 1.5), // unidades por segundo
};
function texturaDaBolota() {
  const t = 128, c = document.createElement('canvas');
  c.width = c.height = t;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(t / 2, t / 2, 0, t / 2, t / 2, t / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.75)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, t, t);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const texBolota = texturaDaBolota();
const matNuvemTopo = new THREE.SpriteMaterial({
  map: texBolota, color: '#fbfff2', transparent: true, depthWrite: false, opacity: NUVEM.opacidade,
});
const matNuvemBase = new THREE.SpriteMaterial({
  map: texBolota, color: '#d3ebcf', transparent: true, depthWrite: false, opacity: NUVEM.opacidade,
});
const ceuDasNuvens = new THREE.Group(); // anda com o vento
cena.add(ceuDasNuvens);
const nuvens = new Map(); // "i,j" -> grupo ou null
const ALCANCE_NUVEM = Math.ceil(AJUSTE.neblinaLonge / NUVEM.celula);
let celulaNuvemAtual = '';

function criarNuvem(i, j) {
  if (hash(i, j, 900) > NUVEM.chance) return null;
  const grupo = new THREE.Group();
  const cx = (i + 0.2 + hash(i, j, 901) * 0.6) * NUVEM.celula;
  const cz = (j + 0.2 + hash(i, j, 902) * 0.6) * NUVEM.celula;
  const base = NUVEM.alturaMin + hash(i, j, 903) * (NUVEM.alturaMax - NUVEM.alturaMin);
  grupo.position.set(cx, base, cz);
  grupo.rotation.y = hash(i, j, 904) * Math.PI;
  const rx = 160 + hash(i, j, 905) * 220;   // comprimento
  const rz = rx * (0.35 + hash(i, j, 906) * 0.3);
  const alto = 70 + hash(i, j, 907) * 90;   // o quanto ela estufa pra cima no meio
  // bolotas de cima: mais altas e maiores no meio
  const n = 8 + Math.floor(hash(i, j, 908) * 9);
  for (let k = 0; k < n; k++) {
    const a = hash(i, j, 910 + k) * Math.PI * 2;
    const d = Math.sqrt(hash(i, j, 930 + k)) * 0.85;
    const meio = 1 - d * d;
    const r = (45 + hash(i, j, 950 + k) * 50) * (0.6 + meio * 0.6);
    const b = new THREE.Sprite(matNuvemTopo);
    b.position.set(Math.cos(a) * d * rx, r * 0.45 + meio * alto * hash(i, j, 970 + k), Math.sin(a) * d * rz);
    b.scale.set(r * 2.4, r * 2, 1);
    grupo.add(b);
  }
  // base: bolotas largas e baixinhas, um pouco mais escuras (sombra de baixo)
  const nb = 3 + Math.floor(hash(i, j, 990) * 3);
  for (let k = 0; k < nb; k++) {
    const t = nb === 1 ? 0 : k / (nb - 1) - 0.5;
    const b = new THREE.Sprite(matNuvemBase);
    b.position.set(t * rx * 1.3, 0, (hash(i, j, 991 + k) - 0.5) * rz * 0.6);
    const largura = rx * (1.1 - Math.abs(t));
    b.scale.set(largura, largura * 0.22, 1);
    b.renderOrder = -0.5; // a base fica atrás das bolotas de cima
    grupo.add(b);
  }
  ceuDasNuvens.add(grupo);
  return grupo;
}

function atualizarNuvens(dt) {
  ceuDasNuvens.position.addScaledVector(NUVEM.vento, dt);
  // posição de quem joga "dentro" do céu que está andando
  const px = camera.position.x - ceuDasNuvens.position.x;
  const pz = camera.position.z - ceuDasNuvens.position.z;
  const ci = Math.floor(px / NUVEM.celula), cj = Math.floor(pz / NUVEM.celula);
  const chave = ci + ',' + cj;
  if (chave === celulaNuvemAtual) return;
  celulaNuvemAtual = chave;
  const precisa = new Set();
  for (let di = -ALCANCE_NUVEM; di <= ALCANCE_NUVEM; di++) {
    for (let dj = -ALCANCE_NUVEM; dj <= ALCANCE_NUVEM; dj++) {
      if (di * di + dj * dj > ALCANCE_NUVEM * ALCANCE_NUVEM) continue;
      const k = (ci + di) + ',' + (cj + dj);
      precisa.add(k);
      if (!nuvens.has(k)) nuvens.set(k, criarNuvem(ci + di, cj + dj));
    }
  }
  for (const [k, grupo] of nuvens) {
    if (precisa.has(k)) continue;
    if (grupo) ceuDasNuvens.remove(grupo);
    nuvens.delete(k);
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
// Mar de lago: quase parado e meio turvo.
// - ondulação miudinha e lenta (só mexe no brilho, a superfície é plana)
// - reflete o céu: olhando rente, vira céu; olhando pra baixo, vira água
// - brilho suave do sol
// - um pouco transparente: dá pra ver de leve o que está logo embaixo
// As manchinhas da textura continuam, bem fracas, pra manter o jeito pintado.
// De longe, a camuflagem da repetição (segunda cópia girada + manchas largas).
const uniAgua = {
  escuro: uniEscuro,
  alto: uniAlto,
  tempo: { value: 0 },
  corBase: { value: new THREE.Color(CORES.agua) },
  solDir: { value: sol.position.clone().normalize() },
};
const matAgua = new THREE.MeshBasicMaterial({ map: texAgua, transparent: true, side: THREE.DoubleSide });
matAgua.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, uniAgua);
  sh.vertexShader = 'varying vec3 vMundo;\n' + sh.vertexShader.replace('#include <project_vertex>', `
    #include <project_vertex>
    vMundo = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
  `);
  sh.fragmentShader = 'uniform vec3 corBase;\nuniform float tempo;\nuniform vec3 solDir;\nvarying vec3 vMundo;\n'
    + CEU_GLSL + sh.fragmentShader.replace('#include <map_fragment>', `
    vec3 paraCamera = cameraPosition - vMundo;
    float dist = length( paraCamera );
    vec3 V = paraCamera / dist;

    // ondulação: algumas ondinhas em direções diferentes, somadas
    vec2 p = vMundo.xz;
    vec2 inc = vec2( 0.0 );
    inc += vec2( 0.80, 0.60 ) * cos( dot( p, vec2( 0.80, 0.60 ) ) * 0.11 + tempo * 0.55 );
    inc += vec2( -0.45, 0.89 ) * cos( dot( p, vec2( -0.45, 0.89 ) ) * 0.17 + tempo * 0.70 ) * 0.7;
    inc += vec2( 0.97, -0.24 ) * cos( dot( p, vec2( 0.97, -0.24 ) ) * 0.29 + tempo * 0.90 ) * 0.45;
    inc += vec2( -0.70, -0.71 ) * cos( dot( p, vec2( -0.70, -0.71 ) ) * 0.47 + tempo * 1.20 ) * 0.3;
    // de longe as ondinhas somem (senão viram chuvisco na tela)
    float forca = 0.025 * ( 1.0 - smoothstep( 60.0, 900.0, dist ) );
    vec3 N = normalize( vec3( -inc.x * forca, 1.0, -inc.y * forca ) );

    // quanto a água vira espelho: rente = muito, de cima = pouco
    float ndv = max( dot( N, V ), 0.0 );
    float espelho = 0.06 + 0.94 * pow( 1.0 - ndv, 4.0 );
    vec3 R = reflect( -V, N );
    vec3 ceu = pow( corDoCeu( max( R.y, 0.0 ) ), vec3( 2.2 ) ); // céu está em sRGB

    // cor do corpo da água, com as manchinhas bem fracas
    vec4 tA = texture2D( map, vMapUv );
    vec2 uvB = mat2( 0.8, -0.6, 0.6, 0.8 ) * vMapUv * 0.43 + vec2( 0.37, 0.71 );
    vec4 tB = texture2D( map, uvB );
    float longe = smoothstep( 150.0, 700.0, dist );
    vec3 corpo = corBase
      + ( tA.rgb - corBase ) * mix( 0.3, 0.2, longe )
      + ( tB.rgb - corBase ) * 0.35 * longe;
    vec2 q = vMapUv;
    float macro = sin( q.x * 0.21 + sin( q.y * 0.17 ) * 2.0 ) * sin( q.y * 0.19 + sin( q.x * 0.13 ) * 2.0 );
    corpo *= 1.0 + 0.05 * macro * longe;

    vec3 cor = mix( corpo, ceu, espelho );
    cor *= 1.0 - 0.45 * escuro; // céu escuro: o mar escurece junto
    // sol: um brilho fino e um halo largo e fraquinho
    float s = max( dot( R, solDir ), 0.0 );
    cor += vec3( 1.0, 0.98, 0.9 ) * ( pow( s, 400.0 ) * 0.7 + pow( s, 30.0 ) * 0.06 );

    diffuseColor.rgb = cor;
    // turva: de cima mostra só um pouco do que está embaixo; rente, nada
    diffuseColor.a = mix( 0.88, 1.0, espelho );
    // vista de baixo (você mergulhou): um teto claro, com a luz vindo de cima
    if ( cameraPosition.y < 0.0 ) {
      diffuseColor.rgb = mix( vec3( 0.42, 0.80, 0.66 ), vec3( 0.75, 0.95, 0.85 ), 1.0 - espelho ) + ( tA.rgb - corBase ) * 0.25;
      diffuseColor.a = 0.9;
    }
  `);
};
const agua = new THREE.Mesh(new THREE.PlaneGeometry(TAM_AGUA, TAM_AGUA), matAgua);
agua.rotation.x = -Math.PI / 2;
agua.renderOrder = -0.9;
cena.add(agua);

// Fundo: um chão escuro lá embaixo, só pra água turva ter o que mostrar
// quando você olha de cima (sem ele, apareceria o céu através da água).
const leito = new THREE.Mesh(
  new THREE.PlaneGeometry(TAM_AGUA, TAM_AGUA),
  new THREE.MeshBasicMaterial({ color: CORES.aguaFunda })
);
leito.rotation.x = -Math.PI / 2;
leito.position.y = -150; // bem abaixo do fundo do mar (só pra nunca aparecer buraco)
cena.add(leito);

// ---------------------------------------------------------------------
// Fundo do mar: um chão a ~120 de profundidade (≈6,9 m na sua régua), com
// ondulações e montinhos de terra espalhados — nunca 100% plano.
// A mesma conta existe em JS (pra você e as esferas pisarem nele) e no
// shader (pra desenhar), então os dois batem certinho.
// ---------------------------------------------------------------------
const PROF = 120;
function alturaDoFundo(x, z) {
  return -PROF
    + 3.5 * Math.sin(x * 0.021 + 1.3) * Math.sin(z * 0.017 + 0.4)
    + 2.0 * Math.sin(x * 0.053 + z * 0.041 + 2.1)
    + 1.2 * Math.sin(x * 0.11 - z * 0.09 + 0.7)
    + 7.0 * Math.pow(Math.max(0, Math.sin(x * 0.0083 + 5.0) * Math.sin(z * 0.0071 + 1.0)), 3);
}
const FUNDO_GLSL = `
  float alturaDoFundo( vec2 p ) {
    return -120.0
      + 3.5 * sin( p.x * 0.021 + 1.3 ) * sin( p.y * 0.017 + 0.4 )
      + 2.0 * sin( p.x * 0.053 + p.y * 0.041 + 2.1 )
      + 1.2 * sin( p.x * 0.11 - p.y * 0.09 + 0.7 )
      + 7.0 * pow( max( 0.0, sin( p.x * 0.0083 + 5.0 ) * sin( p.y * 0.0071 + 1.0 ) ), 3.0 );
  }
`;
const PASSO_FUNDO = 20; // o chão anda com você de 20 em 20 (pra não "nadar")
const geoFundo = new THREE.PlaneGeometry(2400, 2400, 120, 120);
geoFundo.rotateX(-Math.PI / 2);
const matFundo = new THREE.MeshLambertMaterial({ color: '#7f8fc4' }); // areia azulada (as rochas de Namek embaixo d'água)
const fundoDoMar = new THREE.Mesh(geoFundo, matFundo);
fundoDoMar.frustumCulled = false;
cena.add(fundoDoMar);

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

// Grama de Namek: azul liso com manchas escuras em degradê, de tamanhos e
// forças variados (sem pinceladas). A textura é "carimbada" pela posição no mundo
// (de cima), então é igual em todas as ilhas, de qualquer tamanho.
function texturaDaGrama() {
  const t = 512, c = document.createElement('canvas');
  c.width = c.height = t;
  const g = c.getContext('2d');
  g.fillStyle = CORES.grama;
  g.fillRect(0, 0, t, t);
  let semente = 31;
  const aleatorio = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
  const emVolta = (desenhar) => { for (const dx of [-t, 0, t]) for (const dy of [-t, 0, t]) desenhar(dx, dy); }; // emenda sem costura
  // manchas escuras, bem suaves, de tamanhos e forças bem diferentes, umas
  // esticadas pra um lado (nada de bolinhas iguais)
  for (let i = 0; i < 18; i++) {
    const x = aleatorio() * t, y = aleatorio() * t, r = 40 + Math.pow(aleatorio(), 1.5) * 150;
    const forca = 0.1 + aleatorio() * 0.22;
    const estica = 0.55 + aleatorio() * 0.9, giro = aleatorio() * Math.PI;
    emVolta((dx, dy) => {
      g.save();
      g.translate(x + dx, y + dy);
      g.rotate(giro);
      g.scale(estica, 1 / estica);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
      // a borda do degradê é a MESMA cor, só transparente: terminar em
      // "preto transparente" suja o meio do caminho de cinza/escuro
      gr.addColorStop(0, `rgba(72, 102, 196, ${forca})`);
      gr.addColorStop(1, 'rgba(72, 102, 196, 0)');
      g.fillStyle = gr;
      g.fillRect(-r, -r, r * 2, r * 2);
      g.restore();
    });
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}
const texGrama = { value: texturaDaGrama() };
function pintarGrama(sh) {
  sh.uniforms.texGrama = texGrama;
  sh.vertexShader = 'varying vec2 vChaoXZ;\n' + sh.vertexShader.replace('#include <project_vertex>', `
    #include <project_vertex>
    vChaoXZ = ( modelMatrix * vec4( transformed, 1.0 ) ).xz;
  `);
  sh.fragmentShader = 'uniform sampler2D texGrama;\nvarying vec2 vChaoXZ;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
    // duas camadas da mesma textura, em tamanhos e giros que nunca "batem"
    // (a mais escura de cada ponto vale): a repetição não aparece mais
    vec3 g1 = texture2D( texGrama, vChaoXZ / 300.0 ).rgb;
    vec3 g2 = texture2D( texGrama, mat2( 0.6, -0.8, 0.8, 0.6 ) * vChaoXZ / 690.0 + vec2( 0.31, 0.77 ) ).rgb;
    diffuseColor.rgb = min( g1, g2 );
  `);
}
// Embaixo d'água a cor some rápido na cor do fundo: a água é turva,
// então só o pedacinho logo abaixo da superfície ainda aparece.
const corSubmersa = { value: new THREE.Color(CORES.aguaFunda) };
// turvo: 1 = vendo de fora da água (tudo lá embaixo some na cor da água);
// 0 = você mergulhou (aí quem dá o tom é a neblina verde de debaixo d'água)
const turvo = { value: 1 };
// antes(sh): outra mudança no mesmo material (ex.: balançar as algas)
let materiaisTurvos = 0;
function turvarEmbaixoDagua(mat, antes) {
  // cada material ganha uma "identidade" própria: sem isso o three.js acha que
  // todos são iguais (a função abaixo é a mesma) e reaproveita o programa errado
  const id = 'turvo-' + (materiaisTurvos++);
  mat.customProgramCacheKey = () => id;
  mat.onBeforeCompile = (sh) => {
    if (antes) antes(sh);
    sh.uniforms.corSubmersa = corSubmersa;
    sh.uniforms.turvo = turvo;
    sh.vertexShader = 'varying float vAlturaMundo;\n' + sh.vertexShader.replace('#include <project_vertex>', `
      #include <project_vertex>
      #ifdef USE_INSTANCING
        vAlturaMundo = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).y;
      #else
        vAlturaMundo = ( modelMatrix * vec4( transformed, 1.0 ) ).y;
      #endif
    `);
    sh.fragmentShader = 'uniform vec3 corSubmersa;\nuniform float turvo;\nvarying float vAlturaMundo;\n' + sh.fragmentShader.replace('#include <tonemapping_fragment>', `
      gl_FragColor.rgb = mix( gl_FragColor.rgb, corSubmersa, smoothstep( 0.0, 15.0, -vAlturaMundo ) * turvo );
      #include <tonemapping_fragment>
    `);
  };
}
turvarEmbaixoDagua(matRocha);
turvarEmbaixoDagua(matGrama, pintarGrama);
turvarEmbaixoDagua(matFundo, (sh) => {
  // o chão do fundo do mar ondula pela conta alturaDoFundo (e a luz acompanha)
  sh.vertexShader = FUNDO_GLSL + sh.vertexShader
    .replace('#include <beginnormal_vertex>', `
      #include <beginnormal_vertex>
      vec2 pFundo = ( modelMatrix * vec4( position, 1.0 ) ).xz;
      objectNormal = normalize( vec3(
        alturaDoFundo( pFundo - vec2( 1.0, 0.0 ) ) - alturaDoFundo( pFundo + vec2( 1.0, 0.0 ) ), 2.0,
        alturaDoFundo( pFundo - vec2( 0.0, 1.0 ) ) - alturaDoFundo( pFundo + vec2( 0.0, 1.0 ) ) ) );
    `)
    .replace('#include <begin_vertex>', `
      #include <begin_vertex>
      transformed.y = alturaDoFundo( pFundo );
    `);
});

// Mancha no gramado: um pedaço de terra compactada, seca e dura, aparecendo
// no meio da grama, como nos cenários de Namek. Ali não nasce grama.
// Formato de café derramado: borda ondulada.
// É uma "folha" fininha deitada um tiquinho acima da grama.
// Textura da terra: nada de formas com contorno (viravam "biscoito"). São
// três camadas que se misturam: variações de tom bem largas e esfumadas,
// um granulado fininho de terra batida e umas pedrinhas miúdas espalhadas.
// Repete sem emenda (uma folha a cada 80 de chão).
function texturaDaTerra() {
  const t = 512, c = document.createElement('canvas');
  c.width = c.height = t;
  const g = c.getContext('2d');
  g.fillStyle = CORES.mancha;
  g.fillRect(0, 0, t, t);
  let semente = 77;
  const aleatorio = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
  const emVolta = (desenhar) => { for (const dx of [-t, 0, t]) for (const dy of [-t, 0, t]) desenhar(dx, dy); }; // emenda sem costura
  // 1) tom: nuvens largas e sem borda, um pouco mais claras ou mais escuras
  for (let i = 0; i < 22; i++) {
    const x = aleatorio() * t, y = aleatorio() * t, r = 60 + aleatorio() * 110;
    const claro = aleatorio() < 0.5;
    const a = 0.1 + aleatorio() * 0.08;
    emVolta((dx, dy) => {
      const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      const cor = claro ? '226, 210, 192' : '176, 154, 136'; // borda na mesma cor, transparente (sem "queimar")
      gr.addColorStop(0, `rgba(${cor}, ${a})`);
      gr.addColorStop(1, `rgba(${cor}, 0)`);
      g.fillStyle = gr;
      g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
    });
  }
  // 2) granulado: pontinhos de 1 a 2 px, claros e escuros, bem fracos
  for (let i = 0; i < 9000; i++) {
    const x = aleatorio() * t, y = aleatorio() * t, s = aleatorio() < 0.8 ? 1 : 2;
    g.fillStyle = aleatorio() < 0.5
      ? `rgba(240, 226, 210, ${0.12 + aleatorio() * 0.12})`
      : `rgba(120, 98, 84, ${0.1 + aleatorio() * 0.12})`;
    g.fillRect(x, y, s, s);
  }
  // 3) pedrinhas: miúdas, com sombra embaixo e um brilho em cima
  for (let i = 0; i < 55; i++) {
    const x = aleatorio() * t, y = aleatorio() * t, r = 1.6 + aleatorio() * 2.4;
    emVolta((dx, dy) => {
      if (x + dx < -8 || x + dx > t + 8 || y + dy < -8 || y + dy > t + 8) return;
      g.fillStyle = 'rgba(110, 88, 74, 0.35)';
      g.beginPath(); g.ellipse(x + dx + 0.6, y + dy + 1, r * 1.1, r * 0.75, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(214, 198, 182, 0.9)';
      g.beginPath(); g.ellipse(x + dx, y + dy, r, r * 0.7, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(246, 236, 224, 0.7)';
      g.beginPath(); g.ellipse(x + dx - r * 0.25, y + dy - r * 0.25, r * 0.45, r * 0.3, 0, 0, Math.PI * 2); g.fill();
    });
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / 80, 1 / 80); // as coordenadas da mancha já são o próprio chão da ilha
  tex.anisotropy = 4;
  return tex;
}
const matMancha = new THREE.MeshLambertMaterial({
  map: texturaDaTerra(),
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, // nunca "briga" com a grama
});
// borda fininha entre a terra e a grama, no azul escuro das pinceladas da grama
const matManchaBorda = new THREE.MeshLambertMaterial({
  color: '#5674c8',
  polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, // por baixo da mancha, por cima da grama
});
// (cx, cz) = centro da mancha na ilha; a parte que passar da borda é
// "aparada" rente à borda, então a mancha nunca flutua em cima da água.
// cresce: quanto a forma aumenta pra fora (usado pra borda escura em volta)
// Contorno da mancha num ângulo a: a forma de café derramado + "dentes",
// como pinceladas: pontas de terra entrando na grama e pontas de grama
// entrando na terra. Os dentes são finos, um pouco tortos (um lado mais
// comprido que o outro) e mais compridos na direção das pinceladas (o
// eixo x do mundo), como na pintura de referência.
const _dentes = new Map(); // os dentes de cada mancha, sorteados uma vez só
function dentesDaMancha(i, j, sem) {
  const chave = i + ',' + j + ',' + sem;
  let d = _dentes.get(chave);
  if (d) return d;
  if (_dentes.size > 3000) _dentes.clear();
  d = [];
  for (let n = 0; n < 80; n++) {
    const s = sem * 7 + 100 + n * 5;
    const largEsq = 0.012 + Math.pow(hash(i, j, s + 1), 2) * 0.06; // quase todos finos
    d.push({
      ang: hash(i, j, s) * Math.PI * 2,
      esq: largEsq,
      dir: largEsq * (0.35 + hash(i, j, s + 2) * 1.4), // um lado mais comprido: dente torto
      forca: (hash(i, j, s + 3) - 0.35) * (0.15 + Math.pow(hash(i, j, s + 4), 2) * 0.5), // a maioria pra fora (terra na grama), umas pra dentro
    });
  }
  _dentes.set(chave, d);
  return d;
}
// O contorno inteiro é calculado uma vez (N ângulos) e guardado: a forma,
// a borda e o "essa graminha cai na terra?" usam a mesma tabela.
const N_MANCHA = 480;
const _contornos = new Map();
function contornoDaMancha(i, j, sem) {
  const chave = i + ',' + j + ',' + sem;
  let c = _contornos.get(chave);
  if (c) return c;
  if (_contornos.size > 3000) _contornos.clear();
  c = new Float32Array(N_MANCHA);
  for (let k = 0; k < N_MANCHA; k++) c[k] = raioDaMancha((k / N_MANCHA) * Math.PI * 2, 1, i, j, sem);
  _contornos.set(chave, c);
  return c;
}
function raioDaMancha(a, r, i, j, sem) {
  const f1 = hash(i, j, sem) * 6.3, f2 = hash(i, j, sem + 1) * 6.3, f3 = hash(i, j, sem + 2) * 6.3;
  const giro = hash(i, j, sem + 4) * Math.PI * 2;
  let k = 1 + 0.16 * Math.sin(2 * a + f1) + 0.09 * Math.sin(3 * a + f2) + 0.05 * Math.sin(7 * a + f3);
  const deitado = 0.12 + 0.88 * Math.pow(Math.abs(Math.cos(a + giro)), 1.5); // 1 = apontando pro lado das pinceladas
  for (const dente of dentesDaMancha(i, j, sem)) {
    let da = a - dente.ang; // levado pra -π..π
    da -= Math.round(da / (2 * Math.PI)) * 2 * Math.PI;
    const t = 1 - Math.abs(da) / (da < 0 ? dente.esq : dente.dir);
    if (t > 0) k += dente.forca * Math.pow(t, 2.2) * deitado; // ponta fina
  }
  return r * k;
}
function geometriaMancha(r, cx, cz, ilha, i, j, sem, cresce = 0) {
  const achata = 0.7 + hash(i, j, sem + 3) * 0.3;
  const giro = hash(i, j, sem + 4) * Math.PI * 2;
  const cg = Math.cos(giro), sg = Math.sin(giro);
  const forma = new THREE.Shape();
  const tabela = contornoDaMancha(i, j, sem); // bastante ponto: os dentes são finos
  for (let k = 0; k <= N_MANCHA; k++) {
    const a = (k / N_MANCHA) * Math.PI * 2;
    const m = r * tabela[k % N_MANCHA] + cresce;
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
// esse ponto (no jeito da ilha) cai dentro da mancha m? — mesma conta da geometriaMancha
function dentroDaMancha(px, pz, m, i, j) {
  const sem = m.sem;
  const achata = 0.7 + hash(i, j, sem + 3) * 0.3;
  const giro = hash(i, j, sem + 4) * Math.PI * 2;
  const cg = Math.cos(giro), sg = Math.sin(giro);
  const dx = px - m.cx, dz = pz - m.cz;
  const lx = dx * cg + dz * sg, lz = (-dx * sg + dz * cg) / achata;
  // longe da beirada não precisa da conta dos dentes (que é cara):
  // a forma sempre fica entre ~0,45 e ~1,8 do raio
  const d = Math.hypot(lx, lz);
  if (d < m.r * 0.45) return true;
  if (d > m.r * 1.8 + 0.8) return false;
  const a = Math.atan2(lz, lx);
  const raio = m.r * contornoDaMancha(i, j, sem)[Math.round(((a + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * N_MANCHA) % N_MANCHA];
  return Math.hypot(lx, lz) < raio + 0.8; // + uma folguinha: nenhuma graminha na beirada
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
  const geo = new THREE.CylinderGeometry(1, BASE_PLATAFORMA, 1, LADOS_PLATAFORMA);
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

// ---------------------------------------------------------------------
// Embaixo d'água a ilha vira montanha: da beira da plataforma (a 3 abaixo
// da superfície) a encosta desce abrindo até o fundo do mar, com calombos
// de rocha. A largura que ela abre varia em volta (saia.E, f, g).
// ---------------------------------------------------------------------
const SAIA_TOPO = -3;
// a base da plataforma é 6% mais larga que o topo (CylinderGeometry(1, 1.06)):
// a encosta começa exatamente nessa largura, com os mesmos 40 lados, senão a
// beira da plataforma fica sobrando pra fora da encosta
const BASE_PLATAFORMA = 1.06, LADOS_PLATAFORMA = 40;
function larguraDaSaia(saia, a) {
  return saia.E * (1 + 0.25 * Math.sin(5 * a + saia.f) + 0.15 * Math.sin(11 * a + saia.g));
}
function geometriaSaia(ondas, sx, sz, saia) {
  const geo = new THREE.CylinderGeometry(1, 1, 1, LADOS_PLATAFORMA, 8, true);
  const pos = geo.attributes.position;
  for (let v = 0; v < pos.count; v++) {
    const a = Math.atan2(pos.getZ(v), pos.getX(v));
    const t = 0.5 - pos.getY(v); // 0 = rente à plataforma, 1 = no fundo
    const k = contorno(a, ondas) * BASE_PLATAFORMA;
    const extra = larguraDaSaia(saia, a) * Math.pow(t, 0.8) + 3 * Math.sin(a * 17 + t * 9) * t;
    pos.setXYZ(v, Math.cos(a) * (k * sx + extra), SAIA_TOPO - t * (PROF + 8), Math.sin(a) * (k * sz + extra));
  }
  geo.computeVertexNormals();
  return geo;
}
// altura da encosta submersa da ilha (s = solidos[0]) nesse ponto, ou -Infinity se fora dela
function alturaDaSaia(s, x, z) {
  const dx = x - s.x, dz = z - s.z;
  const a = Math.atan2(dz / s.rz, dx / s.rx);
  const k = contorno(a, s.ondas) * BASE_PLATAFORMA;
  const r0 = Math.hypot(Math.cos(a) * k * s.rx, Math.sin(a) * k * s.rz);
  const r = Math.hypot(dx, dz);
  const E = larguraDaSaia(s.saia, a);
  if (r <= r0) return SAIA_TOPO;
  if (r >= r0 + E) return -Infinity;
  return SAIA_TOPO - Math.pow((r - r0) / E, 1 / 0.8) * (PROF + 8);
}
// o chão embaixo d'água nesse ponto: o fundo do mar ou a encosta de uma ilha
function chaoDoMar(x, z) {
  let h = alturaDoFundo(x, z);
  const ci = Math.floor(x / CELULA), cj = Math.floor(z / CELULA);
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
    const ilha = ilhas.get((ci + di) + ',' + (cj + dj));
    if (ilha) h = Math.max(h, alturaDaSaia(ilha.solidos[0], x, z));
  }
  return h;
}

// Algas de fundo do mar: fitas largas de borda ondulada e ponta redonda
// (duas cruzadas, pra ter volume de qualquer lado), balançando devagar.
const geoAlga = (() => {
  const fita = new THREE.PlaneGeometry(1, 1, 1, 14);
  fita.translate(0, 0.5, 0);
  const pos = fita.attributes.position;
  for (let v = 0; v < pos.count; v++) {
    const y = pos.getY(v);
    const ponta = y > 0.82 ? Math.sqrt(Math.max(0, 1 - ((y - 0.82) / 0.18) ** 2)) : 1;
    const larg = (0.78 + 0.22 * Math.sin(y * 17)) * ponta * (0.55 + 0.45 * Math.min(1, y * 5));
    pos.setX(v, pos.getX(v) * larg);
  }
  const outra = fita.clone();
  outra.rotateY(Math.PI / 2);
  const juntas = new THREE.BufferGeometry();
  const a = fita.attributes.position.array, b = outra.attributes.position.array;
  const posicoes = new Float32Array(a.length + b.length);
  posicoes.set(a); posicoes.set(b, a.length);
  const ia = fita.index.array, n = a.length / 3;
  const indices = [...ia, ...Array.from(outra.index.array, x => x + n)];
  juntas.setAttribute('position', new THREE.BufferAttribute(posicoes, 3));
  juntas.setIndex(indices);
  juntas.computeVertexNormals();
  return juntas;
})();
const tempoAlga = { value: 0 };
const matAlga = new THREE.MeshLambertMaterial({ color: '#4fa86a', side: THREE.DoubleSide });
turvarEmbaixoDagua(matAlga, (sh) => {
  sh.uniforms.tempoAlga = tempoAlga;
  sh.vertexShader = 'uniform float tempoAlga;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
    #include <begin_vertex>
    // balanço leve: a ponta mexe mais que o pé; cada alga num ritmo
    float faseAlga = instanceMatrix[3].x * 0.13 + instanceMatrix[3].z * 0.17;
    float hAlga = position.y;
    transformed.x += sin( tempoAlga * 1.4 + faseAlga + hAlga * 3.0 ) * 0.55 * hAlga * hAlga;
    transformed.z += cos( tempoAlga * 1.1 + faseAlga + hAlga * 2.4 ) * 0.35 * hAlga * hAlga;
  `);
});
// a rocha da encosta submersa: azul-arroxeada, como as rochas debaixo d'água no anime
const matSaia = new THREE.MeshLambertMaterial({ color: '#8b80c4' });
turvarEmbaixoDagua(matSaia);
const _m4a = new THREE.Matrix4(), _qa = new THREE.Quaternion(), _ea = new THREE.Euler();
const _pa = new THREE.Vector3(), _sa = new THREE.Vector3();

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
  const FUNDO = -SAIA_TOPO;                           // a plataforma desce até a encosta submersa começar

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

  // embaixo d'água: a encosta que desce até o fundo do mar
  const saia = { E: 35 + hash(i, j, 40) * 30 + tam * 0.1, f: hash(i, j, 41) * 6.3, g: hash(i, j, 42) * 6.3 };
  solidos[0].saia = saia;
  const geoSaia = geometriaSaia(ondas, sx, sz, saia);
  grupo.add(new THREE.Mesh(geoSaia, matSaia));

  // algas no fundo, em volta do pé da ilha (bem menos que o mato)
  const nAlgas = 5 + Math.floor(hash(i, j, 800) * 9);
  const algas = new THREE.InstancedMesh(geoAlga, matAlga, nAlgas);
  for (let k = 0; k < nAlgas; k++) {
    const a = hash(i, j, 801 + k) * Math.PI * 2;
    const kk = contorno(a, ondas);
    const longe = larguraDaSaia(saia, a) * (0.55 + hash(i, j, 830 + k) * 0.9);
    const ax = Math.cos(a) * (kk * sx + longe), az = Math.sin(a) * (kk * sz + longe);
    const chao = Math.max(alturaDoFundo(x + ax, z + az), alturaDaSaia(solidos[0], x + ax, z + az));
    const h = 10 + hash(i, j, 860 + k) * 22, w = 2.5 + hash(i, j, 890 + k) * 2.5;
    _m4a.compose(_pa.set(ax, chao - 0.8, az), _qa.setFromEuler(_ea.set(0, hash(i, j, 920 + k) * 6.3, 0)), _sa.set(w, h, w));
    algas.setMatrixAt(k, _m4a);
  }
  algas.frustumCulled = false;
  grupo.add(algas);

  // manchas no gramado: toda ilha tem pelo menos uma; as maiores chegam a 3.
  // Podem ficar em qualquer lugar, até encostar na borda: o centro fica no
  // mínimo a meio raio da borda, então no máximo ~20% da mancha é aparada.
  const geosManchas = [];
  const secas = []; // onde ficam as manchas de terra (pra não nascer grama ali)
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
    const cxm = Math.cos(ang) * t * sx, czm = Math.sin(ang) * t * sz;
    secas.push({ cx: cxm, cz: czm, r, sem: sm + 3 });
    const gm = geometriaMancha(r, cxm, czm, { sx, sz, ondas }, i, j, sm + 3);
    const mancha = new THREE.Mesh(gm, matMancha);
    mancha.position.y = alt + 0.22; // um tiquinho acima da borda (que fica acima da grama)
    grupo.add(mancha);
    geosManchas.push(gm);
    // borda: a mesma forma um pouco maior, mais escura, por baixo — vira a
    // "fronteira" entre a terra e a grama
    const gb = geometriaMancha(r, cxm, czm, { sx, sz, ondas }, i, j, sm + 3, 0.8);
    const borda = new THREE.Mesh(gb, matManchaBorda);
    borda.position.y = alt + 0.11;
    grupo.add(borda);
    geosManchas.push(gb);
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
      if (secas.some(m => dentroDaMancha(tx, tz, m, i, j))) continue; // terra dura: sem grama
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
  return { grupo, geo, geosManchas, tufos, geoSaia, algas, x, z, solidos, copas };
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
      ilha.geoSaia.dispose();
      ilha.algas.dispose();
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
  KeyR: 'recomecar', // volta pro começo (como se o ar tivesse acabado)
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
  if (codigo === 'KeyR' && !apertadas.has(codigo)) recomecar();
  apertadas.add(codigo);
  marcarTecla(codigo, true);
  return true;
}

function soltar(codigo) {
  if (apertadas.delete(codigo)) marcarTecla(codigo, false);
}

// ferramentas de teste (teclado numérico): 1-2-3 pega todas as esferas;
// 4-5-6 te leva pra 499 m (logo abaixo do espaço)
let codigoTeste = '';
window.addEventListener('keydown', e => {
  if (apertar(e.code)) e.preventDefault(); // impede a página de rolar com setas/espaço
  if (/^Numpad\d$/.test(e.code)) {
    codigoTeste = (codigoTeste + e.code.slice(-1)).slice(-3);
    if (codigoTeste === '123') { codigoTeste = ''; pegarTodasAsEsferas(); }
    if (codigoTeste === '456') { codigoTeste = ''; camera.position.y = 499 * ESCALA_SENTIDA; vel.set(0, 0, 0); } // dev: quase no espaço
  }
});
window.addEventListener('keyup', e => soltar(e.code));
window.addEventListener('blur', () => [...apertadas].forEach(soltar));

// clicar/tocar nas teclas do painel funciona como apertar de verdade
document.querySelectorAll('[data-tecla]').forEach(el => {
  const codigo = el.dataset.tecla;
  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch (erro) { /* tudo bem */ }
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

// Abertura: no primeiro clique, "FIND", "THE" e "BALLS" em letras saiyajin
// (as mesmas do "m" e do "V"), uma por cima da outra, crescendo e sumindo.
// Cada letra é feita de blocos numa caixa de 10×10 (tabela em Referências).
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
// Celular: dedo do lado esquerdo da tela = joystick (anda);
// dedo em qualquer outro lugar = arrastar pra olhar. Cada dedo é seguido
// separado, então dá pra andar e olhar ao mesmo tempo.
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
  // zona morta pequena pra não sair andando com o dedo só encostado
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
    e.preventDefault(); // sem "mouse de mentirinha" depois do toque
    try { canvas.setPointerCapture(e.pointerId); } catch (erro) { /* tudo bem */ }
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

  // primeiro toque: tela cheia e (se o celular deixar) trava deitado
  canvas.addEventListener('pointerdown', () => {
    if (document.fullscreenElement) return;
    const el = document.documentElement;
    const pedir = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!pedir) return;
    try {
      const p = pedir.call(el, { navigationUI: 'hide' });
      if (p && p.then) p.then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
    } catch (erro) { /* sem tela cheia: segue normal */ }
  });

  // dash: um toque liga, outro desliga (o dedão já está ocupado no joystick)
  MAPA.ToqueDash = 'dash';
  const botaoDash = document.getElementById('toqueDash');
  botaoDash.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (apertadas.has('ToqueDash')) soltar('ToqueDash'); else apertar('ToqueDash');
    botaoDash.classList.toggle('ativa', apertadas.has('ToqueDash'));
  });

  // recomeçar pede confirmação (perde as esferas)
  document.getElementById('toqueRecomecar').addEventListener('click', () => {
    if (confirm('Recomeçar do início? Você perde as esferas.')) recomecar();
  });
}

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
  if (p.y < s.base) return; // embaixo do sólido (debaixo d'água): a encosta cuida disso
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
const R_ESFERA = 2.6;      // raio, em unidades daqui de dentro
const RAIO_CORPO = 2;      // "tamanho" do seu corpo pra esbarrar nela
const GRAVIDADE = 170;     // ≈ 9,8 m/s² na escala sentida
const DIST_POUSO = 1600;   // a essa distância do ponto, a esfera escolhe a ilha e aparece
const DIST_CAPTURA = 24;   // perto assim (~1,4 m), dá pra capturar
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
  _n.subVectors(p, camera.position);
  const dist = _n.length();
  const min = R_ESFERA + RAIO_CORPO;
  if (dist < min) {
    _n.divideScalar(dist || 1);
    camera.position.copy(p).addScaledVector(_n, -min);
    const aproxima = vel.dot(_n) - v.dot(_n); // quão rápido você vinha na direção dela
    if (aproxima > 0) {
      v.addScaledVector(_n, aproxima * 1.3);
      vel.addScaledVector(_n, -aproxima * 0.35); // você perde um pouco de velocidade
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
      if (contra < 0) { v.x -= 1.5 * contra * nx; v.z -= 1.5 * contra * nz; } // quica e perde metade
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
      if (contra < 0) { v.x -= 1.5 * contra * nx; v.z -= 1.5 * contra * nz; }
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
iconeCaptura.addEventListener('click', capturar); // no celular / sem mouse: toca no ícone

function atualizarEsfera(dt) {
  capturavel = null;
  let maisPerto = DIST_CAPTURA;
  for (const e of esferas) {
    if (e.capturada && e.sumindo <= 0) continue;
    if (!e.casca) { tentarPousar(e); continue; }
    atualizarUmaEsfera(e, dt);
    if (e.capturada) continue;
    const d = camera.position.distanceTo(e.pos);
    if (d < maisPerto) { maisPerto = d; capturavel = e; }
  }
  // ícone do botão direito em cima da esfera capturável
  if (capturavel) {
    _tela.copy(capturavel.pos);
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

  // teclas + joystick do celular (que tem força de 0 a 1, conforme o dedo afasta)
  const lim1 = x => Math.max(-1, Math.min(1, x));
  const f = lim1((segurando('frente') ? 1 : 0) - (segurando('tras') ? 1 : 0) + joy.f);
  const l = lim1((segurando('direita') ? 1 : 0) - (segurando('esquerda') ? 1 : 0) + joy.l);
  const u = (segurando('subir') ? 1 : 0) - (segurando('descer') ? 1 : 0);

  desejo.set(0, 0, 0)
    .addScaledVector(frente, f)
    .addScaledVector(direita, l);
  desejo.y += u;
  if (desejo.lengthSq() > 1) desejo.normalize();

  // debaixo d'água tudo fica "nerfado": empurra menos, freia mais, dash fraquinho
  const nerf = submerso ? AGUA.nerf : 1;
  const dashLigado = segurando('dash');
  const fator = dashLigado ? (submerso ? AGUA.dash : AJUSTE.dash) : 1;
  vel.addScaledVector(desejo, AJUSTE.acel * fator * nerf * dt);
  // arranque: o dash engata quase na hora, em vez de esperar a inércia (só fora d'água)
  if (dashLigado && !submerso && vel.length() < AJUSTE.velMax * fator * 0.95) {
    vel.addScaledVector(desejo, AJUSTE.arranqueDash * dt);
  }
  vel.multiplyScalar(Math.exp(-AJUSTE.arrasto * (submerso ? AGUA.arrasto : 1) * dt)); // inércia
  // passou do limite (ex.: soltou o Shift): desacelera suave em vez de frear seco
  const limite = AJUSTE.velMax * fator * nerf;
  const v = vel.length();
  if (v > limite) vel.setLength(suavizar(v, limite, 2.5, dt));

  camera.position.addScaledVector(vel, dt);

  // dá pra mergulhar: o chão é o fundo do mar ou a encosta submersa de uma ilha
  const chaoAqui = chaoDoMar(camera.position.x, camera.position.z) + AJUSTE.alturaOlhos;
  if (camera.position.y < chaoAqui) {
    camera.position.y = chaoAqui;
    if (vel.y < 0) vel.y = 0;
  }
  // "não mergulhar" ligado: a superfície vira chão (dá pra brincar de espirro à vontade)
  if (semMergulho && !submerso && camera.position.y < AJUSTE.alturaOlhos) {
    camera.position.y = AJUSTE.alturaOlhos;
    if (vel.y < 0) vel.y = 0;
  }
  // entrou na água: choque de mudança de meio, perde quase todo o embalo
  const agoraSubmerso = camera.position.y < 0;
  if (agoraSubmerso && !submerso) {
    explosaoDeBolhas(vel.length()); // veio rápido (dash)? um monte de bolhas de uma vez
    vel.multiplyScalar(AGUA.choque);
  }
  submerso = agoraSubmerso;

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
  atualizarNuvens(dt);
  agua.position.x = Math.round(camera.position.x / LADRILHO) * LADRILHO;
  agua.position.z = Math.round(camera.position.z / LADRILHO) * LADRILHO;
  leito.position.x = camera.position.x;
  leito.position.z = camera.position.z;
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

  // esferas: pontos laranja piscando (as longe ficam grudadas na borda do radar)
  const pisca = 0.5 + 0.5 * Math.sin(tempo * 7);
  for (const e of esferas) {
    if (e.capturada) continue;
    const dx = e.pos.x - cx, dz = e.pos.z - cz;
    let ex = (dx * Math.cos(yaw) - dz * Math.sin(yaw)) * esc;
    let ey = (dx * Math.sin(yaw) + dz * Math.cos(yaw)) * esc;
    const longe = Math.hypot(ex, ey), maximo = R - 9;
    if (longe > maximo) { ex *= maximo / longe; ey *= maximo / longe; }
    rctx.shadowColor = '#ff8a1c';
    rctx.shadowBlur = 6 + pisca * 10;
    rctx.fillStyle = `rgba(255, 140, 30, ${0.45 + pisca * 0.55})`;
    rctx.beginPath();
    rctx.arc(R + ex, R + ey, 4, 0, Math.PI * 2);
    rctx.fill();
    rctx.shadowBlur = 0;

    // triângulo vazado branco colado na esfera, apontando
    // pra ela: quanto mais perto ela está, maior o triângulo
    const dist = Math.hypot(dx, dz);
    const perto = 1 - Math.min(1, Math.max(0, Math.log(dist / 150) / Math.log(5500 / 150)));
    const tam = 3.5 + 7.5 * perto;
    const len = Math.hypot(ex, ey);
    if (len > tam * 2 + 8) {
      const ux = ex / len, uy = ey / len;              // de você pra esfera
      const px = R + ex - ux * 7, py = R + ey - uy * 7; // ponta, logo antes da bolinha
      const bx = px - ux * tam * 1.3, by = py - uy * tam * 1.3;
      const lx = -uy * tam * 0.75, ly = ux * tam * 0.75;
      rctx.strokeStyle = '#ffffff';
      rctx.lineWidth = 1.6;
      rctx.lineJoin = 'round';
      rctx.beginPath();
      rctx.moveTo(px, py);
      rctx.lineTo(bx + lx, by + ly);
      rctx.lineTo(bx - lx, by - ly);
      rctx.closePath();
      rctx.stroke();
    }
  }
  rctx.shadowBlur = 0;

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
  mostrarVelocidade();
}

// Velocidade em km/h, na mesma régua (unidades/s ÷ 17,5 = m/s; × 3,6 = km/h)
const velNum = document.getElementById('velNum');
let velMostrada = '';
function mostrarVelocidade() {
  const kmh = vel.length() / ESCALA_SENTIDA * 3.6;
  const texto = String(Math.round(kmh));
  if (texto !== velMostrada) { velNum.textContent = texto; velMostrada = texto; }
}

// ondinhas: a textura da água desliza devagar
function animarAgua(tempo) {
  texAgua.offset.set(tempo * 0.004, Math.sin(tempo * 0.3) * 0.01); // lago: desliza bem menos
  uniAgua.tempo.value = tempo;
}

// ---------------------------------------------------------------------
// Espirro: com o dash (Shift), rente ao mar (1,5 m ou menos), a água abre
// pros lados:  \\\ você ///
//
// Visto de lado, cada esguicho é um TRIÂNGULO preso no mar:
//   - o lado curto fica na FRENTE, perto de você: é onde a água sobe e
//     estoura em gotas e névoa. Ele é inclinado pra fora, então olhando
//     reto ele vira uma diagonal de baixo (perto do centro) até a lateral;
//   - o lado comprido fica deitado na superfície da água, indo pra trás
//     (e um pouco pra fora). Como está sempre encostado no mar, não aparece
//     corte de nenhum ângulo;
//   - a altura vai baixando da frente pra trás até sumir (a hipotenusa).
// São 5 paredes desse jeito de cada lado, cada uma inclinada pra fora num
// ângulo diferente e um pouco curvada: juntas têm volume de qualquer ângulo.
// Mais uma deitada no mar (a "cama"), abrindo pra fora: o tapete de espuma.
// Por cima, GOTAS saem do topo e da ponta de trás, e NÉVOA fica boiando.
// Medidas em "alturas dos olhos" (h = sua altura sobre a água), pra ficar
// igual na tela tanto colado no mar quanto a 1 m.
// ---------------------------------------------------------------------
const ESPIRRO = {
  alturaMax: 1.5 * ESCALA_SENTIDA, // só espirra a 1,5 m da água ou menos
  velMin: 25,                    // devagar não espirra
  pontaFrente: 1.5,              // spawn (pé do lado curto): à frente de você (× h)...
  pontaLado: 1.3,                // ...e pro lado (× h): bem separados, embaixo na tela
  comprimento: 3.5,              // quanto o lado comprido vai pra trás (× h)
  abre: 1.2,                     // ...e quanto se afasta pro lado no caminho (× h)
  altura: 1.6,                   // altura do lado curto, na frente (× h)
  nevoaPorSegundo: 55,
  maxNevoa: 300,
};
let forcaEspirro = 0;            // 0 a 1: sobe e desce suave (não liga/desliga seco)
const _rumo = new THREE.Vector3(0, 0, -1); // pra onde você está indo (no plano)
const _lado = new THREE.Vector3();
const _cimaY = new THREE.Vector3(0, 1, 0);

function sobreIlha(x, z) {
  for (const ilha of ilhasPerto()) {
    const s = ilha.solidos[0];
    const lx = (x - s.x) / s.rx, lz = (z - s.z) / s.rz;
    if (Math.hypot(lx, lz) < contorno(Math.atan2(lz, lx), s.ondas) * 1.06) return true;
  }
  return false;
}

// ---------- paredes de água ----------
const SEG_U = 26, SEG_V = 7; // pedaços ao longo (u: ponta -> trás) e pra cima (v: mar -> topo)
const PAREDES = [];
for (const lado of [-1, 1]) {
  // [inclinação pra fora (graus), desvio pro lado (× h), altura relativa, fase]
  [[18, 0.0, 1.15, 0.0], [30, 0.06, 1.05, 2.7], [42, 0.12, 0.95, 5.3], [54, 0.18, 0.85, 7.1], [66, 0.24, 0.75, 1.3],
   [88, 0.0, 1.1, 3.9]].forEach(([inc, dLado, alt, fase]) => {
    PAREDES.push({ lado, inc: inc * Math.PI / 180, dLado, alt, fase: fase + (lado > 0 ? 9 : 0), cama: inc > 80 });
  });
}
const geoJatos = new THREE.BufferGeometry();
{
  const porParede = (SEG_U + 1) * (SEG_V + 1);
  const uv = new Float32Array(PAREDES.length * porParede * 2);
  const fase = new Float32Array(PAREDES.length * porParede);
  const idx = [];
  PAREDES.forEach((p, k) => {
    for (let i = 0; i <= SEG_U; i++) {
      for (let j = 0; j <= SEG_V; j++) {
        const v = k * porParede + i * (SEG_V + 1) + j;
        uv[v * 2] = i / SEG_U;
        uv[v * 2 + 1] = j / SEG_V;
        fase[v] = p.fase;
        if (i < SEG_U && j < SEG_V) {
          const a = v, b = v + 1, c = v + SEG_V + 1, d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
      }
    }
  });
  geoJatos.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PAREDES.length * porParede * 3), 3));
  geoJatos.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geoJatos.setAttribute('fase', new THREE.BufferAttribute(fase, 1));
  geoJatos.setIndex(idx);
}
const uniJatos = { tempo: { value: 0 }, forca: { value: 0 } };
const jatos = new THREE.Mesh(geoJatos, new THREE.ShaderMaterial({
  uniforms: uniJatos,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  vertexShader: `
    #include <common>
    #include <logdepthbuf_pars_vertex>
    attribute float fase;
    varying vec2 vUv;
    varying float vFase;
    void main() {
      vUv = uv;
      vFase = fase;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: `
    #include <logdepthbuf_pars_fragment>
    uniform float tempo;
    uniform float forca;
    varying vec2 vUv;
    varying float vFase;
    float h( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
    float ruido( vec2 p ) {
      vec2 i = floor( p ), f = fract( p );
      f = f * f * ( 3.0 - 2.0 * f );
      return mix( mix( h( i ), h( i + vec2( 1.0, 0.0 ) ), f.x ),
                  mix( h( i + vec2( 0.0, 1.0 ) ), h( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
    }
    void main() {
      #include <logdepthbuf_fragment>
      float u = vUv.x;  // 0 = lado curto na frente (spawn), 1 = lá atrás
      float v = vUv.y;  // 0 = no mar, 1 = topo
      // manchas emboladas correndo da ponta pra trás e subindo
      vec2 p = vec2( u * 5.0 - tempo * 3.5 + vFase, v * 2.5 - tempo * 1.5 + vFase );
      float n = ruido( p * vec2( 1.0, 1.4 ) ) * 0.5
              + ruido( p * 2.7 + tempo * 1.1 ) * 0.3
              + ruido( p * 6.5 - tempo * 2.2 ) * 0.2;
      float ponta = smoothstep( 0.0, 0.14, u + ( n - 0.5 ) * 0.22 );              // lado curto estourando (esfiapado)
      float topo = 1.0 - smoothstep( 0.6, 1.0, v + ( n - 0.5 ) * 0.6 );           // topo esfiapado
      float estouro = 1.0 - smoothstep( 0.7, 1.0, u );                            // some aos poucos lá atrás
      // espuma: perto do mar a água é revolta, branca e quase opaca
      float espuma = 1.0 - smoothstep( 0.0, 0.4, v + ( n - 0.5 ) * 0.25 );
      float corpo = 0.6 + 0.4 * smoothstep( 0.25, 0.7, n );
      float a = ponta * topo * estouro * min( 1.0, corpo + espuma * 0.4 ) * forca;
      if ( a < 0.01 ) discard;
      // no meio aparece um pouco da cor da água; embaixo, espuma branca
      vec3 cor = mix( vec3( 0.80, 0.92, 0.86 ), vec3( 0.98, 1.0, 0.98 ),
                      clamp( smoothstep( 0.25, 0.75, n ) + espuma * 0.7, 0.0, 1.0 ) );
      gl_FragColor = vec4( cor, a );
    }`,
}));
jatos.frustumCulled = false;
jatos.renderOrder = 1;
jatos.visible = false;
cena.add(jatos);

// ponto (u, v) da parede: u = do lado curto na frente (0) pra trás (1); v = do mar (0) ao topo (1)
function pontoDaParede(p, u, v, alvo) {
  const c = camera.position;
  const h = c.y;
  const tempo = uniJatos.tempo.value;
  const frente = h * (ESPIRRO.pontaFrente - ESPIRRO.comprimento * u);
  // o pé no mar: vai pra trás e pra fora, com uma barriguinha pra fora
  const lateral = h * (ESPIRRO.pontaLado + p.dLado * u + ESPIRRO.abre * u + 0.15 * Math.sin(Math.PI * u));
  // altura: alta na frente, baixando até sumir lá atrás (triângulo); o topo treme
  const treme = 1 + 0.15 * Math.sin(tempo * 9 + u * 12 + p.fase);
  const alt = h * ESPIRRO.altura * p.alt * Math.pow(1 - u, 0.8) * treme * forcaEspirro * v;
  alvo.set(c.x, 0, c.z).addScaledVector(_rumo, frente).addScaledVector(_lado, lateral * p.lado);
  // sobe inclinado pra fora (cada parede num ângulo)
  alvo.y += alt * Math.cos(p.inc) + (p.cama ? 0.03 * h : 0); // a cama fica um tiquinho acima do mar
  alvo.addScaledVector(_lado, alt * Math.sin(p.inc) * p.lado);
  return alvo;
}

const _pp = new THREE.Vector3();
function montarJatos() {
  const pos = geoJatos.attributes.position.array;
  const porParede = (SEG_U + 1) * (SEG_V + 1);
  PAREDES.forEach((p, k) => {
    for (let i = 0; i <= SEG_U; i++) {
      for (let j = 0; j <= SEG_V; j++) {
        pontoDaParede(p, i / SEG_U, j / SEG_V, _pp);
        const v = (k * porParede + i * (SEG_V + 1) + j) * 3;
        pos[v] = _pp.x; pos[v + 1] = _pp.y; pos[v + 2] = _pp.z;
      }
    }
  });
  geoJatos.attributes.position.needsUpdate = true;
}

// ---------- névoa ----------
const nevoa = {
  pos: new Float32Array(ESPIRRO.maxNevoa * 3),
  vel: new Float32Array(ESPIRRO.maxNevoa * 3),
  vida: new Float32Array(ESPIRRO.maxNevoa),
  dura: new Float32Array(ESPIRRO.maxNevoa),
  tam: new Float32Array(ESPIRRO.maxNevoa),
  alfa: new Float32Array(ESPIRRO.maxNevoa),
  proxima: 0,
  acumulado: 0,
};
const geoNevoa = new THREE.BufferGeometry();
geoNevoa.setAttribute('position', new THREE.BufferAttribute(nevoa.pos, 3));
geoNevoa.setAttribute('tam', new THREE.BufferAttribute(nevoa.tam, 1));
geoNevoa.setAttribute('alfa', new THREE.BufferAttribute(nevoa.alfa, 1));
const uniNevoa = { escala: { value: 1 } };
const pontosNevoa = new THREE.Points(geoNevoa, new THREE.ShaderMaterial({
  uniforms: uniNevoa,
  transparent: true,
  depthWrite: false,
  vertexShader: `
    #include <common>
    #include <logdepthbuf_pars_vertex>
    attribute float tam;
    attribute float alfa;
    uniform float escala;
    varying float vAlfa;
    void main() {
      vAlfa = alfa;
      vec4 mv = modelViewMatrix * vec4( position, 1.0 );
      gl_Position = projectionMatrix * mv;
      gl_PointSize = alfa > 0.0 ? min( tam * escala / -mv.z, 220.0 ) : 0.0;
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: `
    #include <logdepthbuf_pars_fragment>
    varying float vAlfa;
    void main() {
      #include <logdepthbuf_fragment>
      float d = length( gl_PointCoord - 0.5 ) * 2.0;
      float a = exp( -d * d * 3.5 ) * ( 1.0 - smoothstep( 0.8, 1.0, d ) ) * vAlfa;
      if ( a < 0.005 ) discard;
      gl_FragColor = vec4( 0.96, 1.0, 0.96, a );
    }`,
}));
pontosNevoa.frustumCulled = false;
pontosNevoa.renderOrder = 1;
cena.add(pontosNevoa);

// nasce no lado curto (onde a água estoura), do pé até o topo
function soltarNevoa(rapidez) {
  const i = nevoa.proxima;
  nevoa.proxima = (i + 1) % ESPIRRO.maxNevoa;
  const p = PAREDES[Math.floor(Math.random() * PAREDES.length)];
  pontoDaParede(p, Math.random() * 0.2, Math.random(), _pp);
  const h = camera.position.y;
  nevoa.pos[i * 3]     = _pp.x;
  nevoa.pos[i * 3 + 1] = _pp.y;
  nevoa.pos[i * 3 + 2] = _pp.z;
  const fora = h * (1 + Math.random() * 2);
  nevoa.vel[i * 3]     = _lado.x * fora * p.lado + vel.x * 0.6;
  nevoa.vel[i * 3 + 1] = h * (0.5 + Math.random());
  nevoa.vel[i * 3 + 2] = _lado.z * fora * p.lado + vel.z * 0.6;
  const dura = 0.8 + Math.random() * 0.9;
  nevoa.vida[i] = dura;
  nevoa.dura[i] = dura;
  nevoa.tam[i] = h * (0.4 + Math.random() * 0.6);
}

// ---------- gotas ----------
// Gotinhas e pedaços de espuma que saltam do topo e do lado curto das
// paredes (onde a água estoura) e caem. São a "bagunça" por cima.
const MAX_GOTAS = 2400;
const gotas = {
  pos: new Float32Array(MAX_GOTAS * 3),
  vel: new Float32Array(MAX_GOTAS * 3),
  vida: new Float32Array(MAX_GOTAS),
  dura: new Float32Array(MAX_GOTAS),
  tam: new Float32Array(MAX_GOTAS),
  alfa: new Float32Array(MAX_GOTAS),
  proxima: 0,
  acumulado: 0,
};
const geoGotas = new THREE.BufferGeometry();
geoGotas.setAttribute('position', new THREE.BufferAttribute(gotas.pos, 3));
geoGotas.setAttribute('tam', new THREE.BufferAttribute(gotas.tam, 1));
geoGotas.setAttribute('alfa', new THREE.BufferAttribute(gotas.alfa, 1));
const pontosGotas = new THREE.Points(geoGotas, new THREE.ShaderMaterial({
  uniforms: uniNevoa, // mesma escala de tamanho na tela
  transparent: true,
  depthWrite: false,
  vertexShader: `
    #include <common>
    #include <logdepthbuf_pars_vertex>
    attribute float tam;
    attribute float alfa;
    uniform float escala;
    varying float vAlfa;
    void main() {
      vAlfa = alfa;
      vec4 mv = modelViewMatrix * vec4( position, 1.0 );
      gl_Position = projectionMatrix * mv;
      gl_PointSize = alfa > 0.0 ? clamp( tam * escala / -mv.z, 1.5, 48.0 ) : 0.0;
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: `
    #include <logdepthbuf_pars_fragment>
    varying float vAlfa;
    void main() {
      #include <logdepthbuf_fragment>
      float d = length( gl_PointCoord - 0.5 ) * 2.0;
      float a = ( 1.0 - smoothstep( 0.5, 1.0, d ) ) * vAlfa;
      if ( a < 0.01 ) discard;
      gl_FragColor = vec4( 0.98, 1.0, 0.98, a );
    }`,
}));
pontosGotas.frustumCulled = false;
pontosGotas.renderOrder = 2;
cena.add(pontosGotas);

function soltarGota(rapidez) {
  const i = gotas.proxima;
  gotas.proxima = (i + 1) % MAX_GOTAS;
  const h = camera.position.y;
  const p = PAREDES[Math.floor(Math.random() * PAREDES.length)];
  // metade sai do lado curto na frente (onde estoura), metade do topo
  if (Math.random() < 0.5) pontoDaParede(p, Math.random() * 0.15, Math.random(), _pp);
  else pontoDaParede(p, Math.random() * 0.7, 0.8 + Math.random() * 0.2, _pp);
  gotas.pos[i * 3]     = _pp.x;
  gotas.pos[i * 3 + 1] = _pp.y;
  gotas.pos[i * 3 + 2] = _pp.z;
  // salta pra fora e pra cima, com bagunça; acompanha o seu movimento de verdade quase todo
  const fora = h * (1.5 + Math.random() * 4);
  const cima = h * (1 + Math.random() * 3.5);
  const bagunca = h * 2;
  gotas.vel[i * 3]     = _lado.x * fora * p.lado + (Math.random() - 0.5) * bagunca + vel.x * 0.8;
  gotas.vel[i * 3 + 1] = cima;
  gotas.vel[i * 3 + 2] = _lado.z * fora * p.lado + (Math.random() - 0.5) * bagunca + vel.z * 0.8;
  const dura = 0.35 + Math.random() * 0.5;
  gotas.vida[i] = dura;
  gotas.dura[i] = dura;
  // a maioria gotinha; algumas são pedaços maiores de espuma
  gotas.tam[i] = h * (Math.random() < 0.72 ? 0.04 + Math.random() * 0.06 : 0.12 + Math.random() * 0.16);
}

function atualizarGotas(dt, rapidez) {
  if (forcaEspirro > 0.05) {
    gotas.acumulado += 1900 * forcaEspirro * dt;
    while (gotas.acumulado >= 1) { gotas.acumulado -= 1; soltarGota(rapidez); }
  } else {
    gotas.acumulado = 0;
  }
  const gravidade = camera.position.y * 9;
  for (let i = 0; i < MAX_GOTAS; i++) {
    if (gotas.vida[i] <= 0) { gotas.alfa[i] = 0; continue; }
    gotas.vida[i] -= dt;
    gotas.vel[i * 3 + 1] -= gravidade * dt;
    gotas.pos[i * 3]     += gotas.vel[i * 3] * dt;
    gotas.pos[i * 3 + 1] += gotas.vel[i * 3 + 1] * dt;
    gotas.pos[i * 3 + 2] += gotas.vel[i * 3 + 2] * dt;
    if (gotas.vida[i] <= 0 || gotas.pos[i * 3 + 1] < 0) { gotas.vida[i] = 0; gotas.alfa[i] = 0; continue; }
    const t = gotas.vida[i] / gotas.dura[i];
    gotas.alfa[i] = Math.min(1, t * 2.5) * 0.9;
  }
  geoGotas.attributes.position.needsUpdate = true;
  geoGotas.attributes.tam.needsUpdate = true;
  geoGotas.attributes.alfa.needsUpdate = true;
}

let desvioEspirro = 0; // quanto o esguicho gira pro lado do movimento (radianos)
function atualizarEspirro(dt) {
  if (!(dt > 0)) return;
  const c = camera.position;
  const rapidez = Math.hypot(vel.x, vel.z);
  // O esguicho segue pra onde a CÂMERA olha. O movimento (ex.: segurando
  // A/D, que vai na diagonal) só puxa um pouquinho, no máximo ~11°, e suave.
  if (rapidez > 1) {
    let delta = Math.atan2(-vel.x, -vel.z) - yaw;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta)); // entre -180° e 180°
    const alvoDesvio = Math.max(-0.2, Math.min(0.2, delta));
    desvioEspirro = suavizar(desvioEspirro, alvoDesvio, 4, dt);
  }
  const rumoYaw = yaw + desvioEspirro;
  _rumo.set(-Math.sin(rumoYaw), 0, -Math.cos(rumoYaw));
  _lado.set(-_rumo.z, 0, _rumo.x);

  // força alvo: só com o dash, rente, sobre a água; mais rápido/mais colado = mais forte
  let alvo = 0;
  if (segurando('dash') && c.y > 0 && c.y <= ESPIRRO.alturaMax && rapidez > ESPIRRO.velMin && !sobreIlha(c.x, c.z)) {
    const rente = 1 - (c.y - AJUSTE.alturaOlhos) / (ESPIRRO.alturaMax - AJUSTE.alturaOlhos);
    alvo = Math.max(0.35, Math.min(1, rente)) * Math.min(rapidez / (AJUSTE.velMax * 1.5), 1);
  }
  forcaEspirro = suavizar(forcaEspirro, alvo, alvo > forcaEspirro ? 6 : 3, dt);

  // paredes
  uniJatos.tempo.value += dt;
  uniJatos.forca.value = forcaEspirro;
  jatos.visible = forcaEspirro > 0.01;
  if (jatos.visible) montarJatos();

  uniNevoa.escala.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
  atualizarGotas(dt, rapidez);

  // névoa: nasce enquanto tem força, e a que já nasceu termina a vida dela
  if (forcaEspirro > 0.05) {
    nevoa.acumulado += ESPIRRO.nevoaPorSegundo * forcaEspirro * dt;
    while (nevoa.acumulado >= 1) { nevoa.acumulado -= 1; soltarNevoa(rapidez); }
  } else {
    nevoa.acumulado = 0;
  }
  for (let i = 0; i < ESPIRRO.maxNevoa; i++) {
    if (nevoa.vida[i] <= 0) { nevoa.alfa[i] = 0; continue; }
    nevoa.vida[i] -= dt;
    if (nevoa.vida[i] <= 0) { nevoa.alfa[i] = 0; continue; }
    const amortece = Math.exp(-1.2 * dt);
    nevoa.vel[i * 3] *= amortece;
    nevoa.vel[i * 3 + 2] *= amortece;
    nevoa.vel[i * 3 + 1] -= 4 * dt;
    nevoa.pos[i * 3]     += nevoa.vel[i * 3] * dt;
    nevoa.pos[i * 3 + 1] = Math.max(0.5, nevoa.pos[i * 3 + 1] + nevoa.vel[i * 3 + 1] * dt);
    nevoa.pos[i * 3 + 2] += nevoa.vel[i * 3 + 2] * dt;
    const t = nevoa.vida[i] / nevoa.dura[i]; // 1 = nasceu agora, 0 = sumindo
    nevoa.alfa[i] = Math.min(1, (1 - t) * 6) * t * 0.24; // acende rápido, apaga devagar
    nevoa.tam[i] += dt * camera.position.y * 0.6; // a névoa se espalha
  }
  geoNevoa.attributes.position.needsUpdate = true;
  geoNevoa.attributes.tam.needsUpdate = true;
  geoNevoa.attributes.alfa.needsUpdate = true;
}

// ---------------------------------------------------------------------
// Debaixo d'água: tudo se matiza de verde, aparecem bolhinhas na frente
// da tela (mais quanto mais rápido você vai), o movimento fica "nerfado"
// e uma barra de ar azul vai diminuindo. Acabou o ar: você volta pro
// ponto de partida e perde todas as esferas.
// ---------------------------------------------------------------------
const AGUA = {
  nerf: 0.55,            // força e velocidade máxima debaixo d'água (× normal)
  dash: 1.35,            // o dash debaixo d'água (fora d'água é 2)
  arrasto: 1.5,          // a água freia mais (× normal)
  choque: 0.3,           // ao entrar na água, sobra só isso do embalo
  ar: 40,                // segundos de fôlego
  gravidadeEsfera: 0.22, // esfera afunda devagar
  arrastoEsfera: 2.0,
};
let submerso = false;
let ar = AGUA.ar;
const corNeblinaAgua = new THREE.Color('#1f7a64');
const corNeblinaNormal = new THREE.Color(CORES.horizonte);
const corNeblinaEscura = new THREE.Color('#1e4a3c');

const telaDebaixo = document.getElementById('debaixo');
const barraAr = document.getElementById('ar');
const nivelAr = document.getElementById('arNivel');
const apagao = document.getElementById('apagao');

// ---------- bolhas: partículas de verdade na água, subindo e balançando ----------
// Nascem espalhadas na sua frente (mais quanto mais rápido você vai) e ficam
// paradas no lugar delas: avançando, você passa por elas e elas ficam pra trás.
const MAX_BOLHAS = 900;
const bolhas = {
  pos: new Float32Array(MAX_BOLHAS * 3),
  tam: new Float32Array(MAX_BOLHAS),
  alfa: new Float32Array(MAX_BOLHAS),
  sobe: new Float32Array(MAX_BOLHAS),
  fase: new Float32Array(MAX_BOLHAS),
  idade: new Float32Array(MAX_BOLHAS),
  proxima: 0,
  acumulado: 0,
};
const geoBolhas = new THREE.BufferGeometry();
geoBolhas.setAttribute('position', new THREE.BufferAttribute(bolhas.pos, 3));
geoBolhas.setAttribute('tam', new THREE.BufferAttribute(bolhas.tam, 1));
geoBolhas.setAttribute('alfa', new THREE.BufferAttribute(bolhas.alfa, 1));
const uniBolhas = { escala: { value: 1 } };
const pontosBolhas = new THREE.Points(geoBolhas, new THREE.ShaderMaterial({
  uniforms: uniBolhas,
  transparent: true,
  depthWrite: false,
  vertexShader: `
    #include <common>
    #include <logdepthbuf_pars_vertex>
    attribute float tam;
    attribute float alfa;
    uniform float escala;
    varying float vAlfa;
    void main() {
      vAlfa = alfa;
      vec4 mv = modelViewMatrix * vec4( position, 1.0 );
      gl_Position = projectionMatrix * mv;
      gl_PointSize = alfa > 0.0 ? clamp( tam * escala / -mv.z, 2.0, 90.0 ) : 0.0;
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: `
    #include <logdepthbuf_pars_fragment>
    varying float vAlfa;
    void main() {
      #include <logdepthbuf_fragment>
      vec2 p = gl_PointCoord - 0.5;
      float d = length( p ) * 2.0;
      if ( d > 1.0 ) discard;
      // anel claro na borda, miolo quase transparente e um brilhinho em cima
      float anel = smoothstep( 0.55, 0.8, d ) * ( 1.0 - smoothstep( 0.85, 1.0, d ) );
      float brilho = 1.0 - smoothstep( 0.0, 0.2, length( p - vec2( -0.17, -0.17 ) ) );
      float a = ( anel * 0.85 + 0.1 + brilho * 0.7 ) * vAlfa;
      gl_FragColor = vec4( 0.92, 1.0, 0.96, a );
    }`,
}));
pontosBolhas.frustumCulled = false;
pontosBolhas.renderOrder = 2;
cena.add(pontosBolhas);

const _fr = new THREE.Vector3(), _ld = new THREE.Vector3(), _ac = new THREE.Vector3(), _cm = new THREE.Vector3();
// uma bolha em: frente (distância na sua frente), lado e acima, nos eixos
// da SUA visão (funciona olhando reto, pra baixo ou pra cima)
function soltarBolha(frente, lado, alto, tam, sobe) {
  soltarBolhaEm(
    camera.position.x + _fr.x * frente + _ld.x * lado + _ac.x * alto,
    camera.position.y + _fr.y * frente + _ld.y * lado + _ac.y * alto,
    camera.position.z + _fr.z * frente + _ld.z * lado + _ac.z * alto,
    tam, sobe);
}
function soltarBolhaEm(x, y, z, tam, sobe) {
  const i = bolhas.proxima;
  bolhas.proxima = (i + 1) % MAX_BOLHAS;
  if (y > -0.6) y = -1.2 - (y + 0.6); // acima da superfície: espelha pra baixo dela (mantém o espalhado, sem formar camada)
  bolhas.pos[i * 3] = x; bolhas.pos[i * 3 + 1] = y; bolhas.pos[i * 3 + 2] = z;
  bolhas.tam[i] = tam;
  bolhas.sobe[i] = sobe;
  bolhas.fase[i] = Math.random() * 6.3;
  bolhas.idade[i] = 0;
  bolhas.alfa[i] = 0.001; // acende aos poucos
}
function direcoesDaCamera() {
  // os três eixos da câmera (frente, direita, cima). Antes o "lado" saía de
  // frente × vertical, que zera olhando reto pra baixo: as bolhas caíam
  // todas num plano só
  camera.getWorldDirection(_fr);
  _ld.set(1, 0, 0).applyQuaternion(camera.quaternion);
  _ac.set(0, 1, 0).applyQuaternion(camera.quaternion);
}
function atualizarBolhas(dt) {
  uniBolhas.escala.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
  if (submerso) {
    direcoesDaCamera();
    // parado: poucas; nadando: um bocado; dash: bastante — e nascem mais longe
    // quanto mais rápido, pra dar tempo de você chegar nelas
    const r = Math.min(vel.length() / AJUSTE.velMax, 1.5);
    bolhas.acumulado += (6 + 160 * Math.pow(r, 1.3)) * dt;
    while (bolhas.acumulado >= 1) {
      bolhas.acumulado -= 1;
      const longe = 6 + Math.random() * (25 + 70 * r);
      soltarBolha(longe, (Math.random() - 0.5) * (14 + longe * 0.7), (Math.random() - 0.5) * (10 + longe * 0.5),
        0.15 + Math.pow(Math.random(), 2) * 0.6, 2 + Math.random() * 4);
    }
  } else {
    bolhas.acumulado = 0;
  }
  for (let i = 0; i < MAX_BOLHAS; i++) {
    if (bolhas.alfa[i] <= 0) continue;
    if (!submerso) { bolhas.alfa[i] = 0; continue; } // saiu da água: some tudo
    bolhas.idade[i] += dt;
    const t = bolhas.idade[i], k = i * 3;
    bolhas.pos[k + 1] += bolhas.sobe[i] * dt;
    bolhas.pos[k] += Math.sin(t * 3 + bolhas.fase[i]) * 0.6 * dt;
    bolhas.pos[k + 2] += Math.cos(t * 2.6 + bolhas.fase[i]) * 0.6 * dt;
    _cm.set(bolhas.pos[k], bolhas.pos[k + 1], bolhas.pos[k + 2]);
    // chegou na superfície, ficou muito pra trás ou velha demais: some
    if (bolhas.pos[k + 1] > -0.3 || _cm.distanceTo(camera.position) > 160 || t > 9) { bolhas.alfa[i] = 0; continue; }
    bolhas.alfa[i] = Math.min(1, t * 3) * Math.min(1, (-0.3 - bolhas.pos[k + 1]) * 2);
  }
  geoBolhas.attributes.position.needsUpdate = true;
  geoBolhas.attributes.tam.needsUpdate = true;
  geoBolhas.attributes.alfa.needsUpdate = true;
}

// mergulhou rápido: um estouro de bolhas em volta de você, subindo depressa
function explosaoDeBolhas(embalo) {
  const n = Math.max(0, Math.min(600, Math.floor((embalo - 40) * 4)));
  if (!n) return;
  direcoesDaCamera();
  // espalhadas numa bola (no mundo, nos 3 eixos) em volta de um ponto à sua
  // frente — na direção em que você olha, seja reto ou pra baixo — sempre
  // inteira debaixo d'água; mais juntas no meio, mais raras na beirada
  const raio = 16;
  const cx = camera.position.x + _fr.x * 18, cz = camera.position.z + _fr.z * 18;
  const cy = Math.min(camera.position.y + _fr.y * 18, -raio - 2);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u), r = raio * Math.pow(Math.random(), 0.6);
    soltarBolhaEm(cx + s * Math.cos(a) * r, cy + u * r, cz + s * Math.sin(a) * r,
      0.15 + Math.pow(Math.random(), 1.5) * 0.8, 6 + Math.random() * 18);
  }
}

// "Não mergulhar": clique duplo com o botão direito liga/desliga (ou toca no
// botão do nadador). Fica guardado pro próximo jogo.
let semMergulho = false;
try { semMergulho = localStorage.getItem('planeta.semMergulho') === '1'; } catch (e) { /* sem memória: tudo bem */ }
const botaoMergulho = document.getElementById('semMergulho');
function mostrarMergulho() {
  botaoMergulho.classList.toggle('ligado', semMergulho);
  document.getElementById('toqueMergulho').classList.toggle('ligado', semMergulho);
  botaoMergulho.setAttribute('aria-checked', String(semMergulho));
}
// aviso: ligou, dois anéis saem do botão e somem; desligou, dois anéis
// grandes encolhem até encostar na borda dele
const interruptor = botaoMergulho.querySelector('.interruptor');
function avisarMergulho() {
  interruptor.querySelectorAll('.anel').forEach(a => a.remove());
  // até onde o anel vai: do centro do botão até a ponta de cima-esquerda da tecla A
  const b = interruptor.getBoundingClientRect();
  const a = document.querySelector('[data-tecla="KeyA"]').getBoundingClientRect();
  const raio = Math.hypot(a.left - (b.left + b.width / 2), a.top - (b.top + b.height / 2));
  interruptor.style.setProperty('--alem', Math.max(40, raio - b.width / 2) + 'px');
  for (let k = 0; k < 2; k++) {
    const anel = document.createElement('span');
    anel.className = 'anel ' + (semMergulho ? 'sai' : 'entra');
    anel.style.animationDelay = (k * 0.22) + 's';
    anel.addEventListener('animationend', () => anel.remove());
    interruptor.appendChild(anel);
  }
}
function alternarMergulho() {
  semMergulho = !semMergulho;
  try { localStorage.setItem('planeta.semMergulho', semMergulho ? '1' : '0'); } catch (e) { /* tudo bem */ }
  mostrarMergulho();
  avisarMergulho();
}
mostrarMergulho();
let ultimoDireito = 0;
document.addEventListener('mousedown', ev => {
  if (ev.button !== 2) return;
  const agora = performance.now();
  if (agora - ultimoDireito < 350) { alternarMergulho(); ultimoDireito = 0; }
  else ultimoDireito = agora;
});
botaoMergulho.addEventListener('click', alternarMergulho);
document.getElementById('toqueMergulho').addEventListener('click', alternarMergulho);

// acabou o ar (ou apertou R): volta pro começo e perde as esferas
function recomecar() {
  camera.position.copy(inicio);
  vel.set(0, 0, 0);
  yaw = yawInicio;
  pitch = 0;
  ar = AGUA.ar;
  submerso = false;
  apagao.classList.remove('some');
  void apagao.offsetWidth; // reinicia a animação
  apagao.classList.add('some');
  for (const e of esferas) {
    if (!e.capturada) continue;
    e.capturada = false;
    e.sumindo = 0;
    e.naAgua = false;
    const casa = caixaEsferas.querySelector(`[data-n="${e.n}"]`);
    if (casa) casa.classList.remove('pegou');
    // pega pelo atalho de teste antes de pousar: não tem bola, volta a esperar no ponto dela
    if (!e.casca) { e.pos.copy(e.alvo); continue; }
    e.pos.copy(e.origem);
    e.vel.set(0, 0, 0);
    e.casca.scale.setScalar(1);
    e.estrelas.scale.set(R_ESFERA * 1.5, R_ESFERA * 1.5, 1);
    e.casca.position.copy(e.pos);
    e.estrelas.position.copy(e.pos);
    cena.add(e.casca, e.estrelas);
  }
  escuroAlvo = 0;
  ceuPendente = false;
  atualizarIlhas();
}

// ---------- céu escuro + raios quando junta as 7 ----------
let escuroAlvo = 0;
let ceuPendente = false; // juntou as 7 debaixo d'água: escurece quando sair
let proximoRaio = 0, clarao = 0;
const telaClarao = document.getElementById('clarao');
let raios = [];
const corNuvemTopo = matNuvemTopo.color.clone(), corNuvemBase = matNuvemBase.color.clone();
const corNuvemEscura = new THREE.Color('#3e5e55'), corNuvemBaseEscura = new THREE.Color('#2a483f');

function escurecerCeu() {
  escuroAlvo = 1;
  clarao = 0.45;
  soltarRaio(); soltarRaio();
  proximoRaio = 0.2;
}
// Raio de verdade, no mundo: sai da base de uma nuvem que você está vendo
// e desce em zigue-zague até o mar (às vezes com um galho). É uma fita
// branca virada pra você, com um brilho verde em volta, e a luz do
// ambiente pisca junto. O clarão na tela fica só como reforço suave.
const matRaio = new THREE.MeshBasicMaterial({
  color: '#f4fff6', transparent: true, depthWrite: false, fog: false,
  blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});
const matRaioBrilho = new THREE.MeshBasicMaterial({
  color: '#6dffb0', transparent: true, depthWrite: false, fog: false,
  blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});
let luzRaio = 0;
const _frente = new THREE.Vector3(), _pn2 = new THREE.Vector3(), _lado2 = new THREE.Vector3(), _dir2 = new THREE.Vector3();

// fita que passa pelos pontos, sempre de lado pra câmera
function fitaDoRaio(pts, larg) {
  const pos = [], idx = [];
  pts.forEach((pt, n) => {
    const a = pts[Math.max(0, n - 1)], b = pts[Math.min(pts.length - 1, n + 1)];
    _dir2.subVectors(b, a).normalize();
    _pn2.subVectors(camera.position, pt);
    _lado2.crossVectors(_dir2, _pn2).normalize().multiplyScalar(larg * (n === pts.length - 1 ? 0.3 : 1) / 2);
    pos.push(pt.x - _lado2.x, pt.y - _lado2.y, pt.z - _lado2.z, pt.x + _lado2.x, pt.y + _lado2.y, pt.z + _lado2.z);
    if (n) { const k = (n - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return geo;
}
function caminhoDoRaio(de, ate, passos, solta) {
  const pts = [de.clone()];
  for (let n = 1; n < passos; n++) {
    const t = n / passos;
    pts.push(new THREE.Vector3(
      de.x + (ate.x - de.x) * t + (Math.random() - 0.5) * solta,
      de.y + (ate.y - de.y) * t + (Math.random() - 0.5) * solta * 0.3,
      de.z + (ate.z - de.z) * t + (Math.random() - 0.5) * solta,
    ));
  }
  pts.push(ate.clone());
  return pts;
}
function soltarRaio() {
  if (submerso) return; // debaixo d'água não dá pra ver
  // uma nuvem na sua frente, nem perto nem longe demais
  camera.getWorldDirection(_frente);
  _frente.y = 0; _frente.normalize();
  const visiveis = [];
  for (const nuvem of ceuDasNuvens.children) {
    const x = nuvem.position.x + ceuDasNuvens.position.x, z = nuvem.position.z + ceuDasNuvens.position.z;
    const dx = x - camera.position.x, dz = z - camera.position.z, d = Math.hypot(dx, dz);
    if (d < 250 || d > 2000) continue;
    if ((dx * _frente.x + dz * _frente.z) / d < 0.35) continue;
    visiveis.push(new THREE.Vector3(x, nuvem.position.y, z));
  }
  const de = visiveis.length
    ? visiveis[Math.floor(Math.random() * visiveis.length)]
    : camera.position.clone().addScaledVector(_frente, 700 + Math.random() * 800).setY(720); // sem nuvem: do alto, lá na frente
  de.x += (Math.random() - 0.5) * 120;
  de.z += (Math.random() - 0.5) * 120;
  const ate = new THREE.Vector3(de.x + (Math.random() - 0.5) * 220, 0, de.z + (Math.random() - 0.5) * 220);
  const tronco = caminhoDoRaio(de, ate, 22, 60);
  const caminhos = [[tronco, 1]];
  // um galho saindo do meio
  if (Math.random() < 0.8) {
    const k = 5 + Math.floor(Math.random() * 10);
    const ini = tronco[k];
    const fim = ini.clone().add(new THREE.Vector3((Math.random() - 0.5) * 260, -(120 + Math.random() * 200), (Math.random() - 0.5) * 260));
    caminhos.push([caminhoDoRaio(ini, fim, 8, 45), 0.55]);
  }
  const grupo = new THREE.Group();
  for (const [pts, grosso] of caminhos) {
    grupo.add(new THREE.Mesh(fitaDoRaio(pts, 22 * grosso), matRaioBrilho.clone()));
    grupo.add(new THREE.Mesh(fitaDoRaio(pts, 5 * grosso), matRaio.clone()));
  }
  grupo.renderOrder = 3;
  cena.add(grupo);
  raios.push({ grupo, vida: 0.28, dura: 0.28 });
  luzRaio = 1;
  clarao = Math.max(clarao, 0.12 + Math.random() * 0.12);
}
function atualizarRaios(dt) {
  const transicao = escuroAlvo > 0 && uniEscuro.value < 0.98;
  if (escuroAlvo > 0) {
    proximoRaio -= dt;
    if (proximoRaio <= 0) {
      soltarRaio();
      // durante a transição, um atrás do outro; depois, de vez em quando, lá longe
      proximoRaio = transicao ? 0.15 + Math.random() * 0.4 : 5 + Math.random() * 8;
    }
  }
  raios = raios.filter(r => {
    r.vida -= dt;
    if (r.vida <= 0) {
      cena.remove(r.grupo);
      r.grupo.children.forEach(m => { m.geometry.dispose(); m.material.dispose(); });
      return false;
    }
    const a = (r.vida / r.dura) * (0.55 + 0.45 * Math.random()); // pisca
    r.grupo.children.forEach((m, n) => { m.material.opacity = a * (n % 2 ? 1 : 0.35); });
    return true;
  });
  luzRaio *= Math.exp(-9 * dt);
  clarao *= Math.exp(-6 * dt);
  telaClarao.style.opacity = clarao.toFixed(3);
}

// ---------------------------------------------------------------------
// Subindo até o espaço. Tudo barato: nada do mundo de verdade é montado
// lá em cima.
// - de 200 a 500 m o céu escurece (fica rarefeito e depois preto)
// - aparecem as estrelas: uma nuvem de pontinhos que anda com você
// - embaixo, o mundo de verdade vai sendo coberto por um planeta PINTADO:
//   uma bola gigante, pintada pela placa de vídeo, com o mar verde e as faixas claras do
//   Namek do anime e um brilho azul na borda. Ela gira conforme você anda,
//   então lá de cima parece que você está sobrevoando o planeta.
// - acima de 500 m não tem ar: a barra de fôlego aparece; acabou, recomeça.
// Descendo, tudo volta ao contrário.
// ---------------------------------------------------------------------
const ESPACO = {
  rarefeito: 200,   // m: o céu começa a mudar
  espaco: 500,      // m: espaço (céu preto, sem ar)
  planetaDe: 110,   // m: o planeta pintado começa a cobrir o mundo...
  planetaAte: 230,  // ...e cobre tudo daqui pra cima
  raio: 120000,     // tamanho do planeta pintado (grande: a curva só fica forte bem no alto)
};
const uniPlaneta = {
  solDir: { value: sol.position.clone().normalize() },
  opacidade: { value: 0 },
  escuro: uniEscuro,
  alto: uniAlto,
};
// A pintura do planeta é feita na hora pela placa de vídeo, a partir do
// ponto da bola (e não de uma imagem esticada): assim não tem polo, nem
// emenda, nem "gomos de melancia". São faixas claras compridas e tortas,
// meio na diagonal, que se juntam em umas regiões e somem em outras, como
// no planeta do anime, mais umas nuvens brancas soltas.
// O planeta e o brilho são desenhados por cima de tudo (sem teste de
// profundidade): assim eles "cobrem" o mundo de verdade aos poucos.
const planeta = new THREE.Mesh(new THREE.SphereGeometry(ESPACO.raio, 256, 128), new THREE.ShaderMaterial({
  uniforms: uniPlaneta,
  transparent: true, depthTest: false, depthWrite: false,
  vertexShader: `
    #include <common>
    #include <logdepthbuf_pars_vertex>
    varying vec3 vPonto;
    varying vec3 vNormal;
    varying vec3 vVista;
    void main() {
      vPonto = normalize( position ); // o ponto na bola (gira junto com ela)
      vNormal = normalize( mat3( modelMatrix ) * normal );
      vec4 mundo = modelMatrix * vec4( position, 1.0 );
      vVista = normalize( cameraPosition - mundo.xyz );
      gl_Position = projectionMatrix * viewMatrix * mundo;
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: `
    #include <logdepthbuf_pars_fragment>
    uniform vec3 solDir;
    uniform float opacidade;
    uniform float escuro;
    varying vec3 vPonto;
    varying vec3 vNormal;
    varying vec3 vVista;
    float sorteio( vec3 p ) {
      p = fract( p * 0.3183099 + 0.1 );
      p *= 17.0;
      return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
    }
    float ruido( vec3 x ) {
      vec3 i = floor( x ), f = fract( x );
      f = f * f * ( 3.0 - 2.0 * f );
      return mix( mix( mix( sorteio( i ), sorteio( i + vec3( 1, 0, 0 ) ), f.x ),
                       mix( sorteio( i + vec3( 0, 1, 0 ) ), sorteio( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
                  mix( mix( sorteio( i + vec3( 0, 0, 1 ) ), sorteio( i + vec3( 1, 0, 1 ) ), f.x ),
                       mix( sorteio( i + vec3( 0, 1, 1 ) ), sorteio( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
    }
    float camadas( vec3 p ) {
      float s = 0.0, a = 0.5;
      for ( int k = 0; k < 5; k++ ) { s += a * ruido( p ); p = p * 2.03 + vec3( 1.7, 9.2, 3.1 ); a *= 0.5; }
      return s;
    }
    void main() {
      #include <logdepthbuf_fragment>
      vec3 q = vPonto;
      // entorta tudo um pouco (as faixas ficam curvas, não retas)
      q += 0.09 * ( vec3( camadas( q * 5.0 ), camadas( q * 5.0 + 5.2 ), camadas( q * 5.0 + 9.1 ) ) - 0.5 );
      // faixas: esticadas numa direção meio diagonal (compridas nela, finas nas outras)
      vec3 d = normalize( vec3( 1.0, 0.55, 0.25 ) );
      vec3 e1 = normalize( cross( d, vec3( 0.0, 0.0, 1.0 ) ) );
      vec3 e2 = cross( d, e1 );
      float faixa = camadas( vec3( dot( q, d ) * 7.0, dot( q, e1 ) * 85.0, dot( q, e2 ) * 85.0 ) );
      // onde elas aparecem: em umas regiões juntam muitas, em outras quase nada
      float regiao = smoothstep( 0.38, 0.62, camadas( q * 3.0 + 2.0 ) );
      float claro = smoothstep( 0.5, 0.68, faixa ) * regiao;
      // mar verde com variação larga de tom
      float tom = camadas( q * 4.0 + 7.0 );
      vec3 cor = mix( vec3( 0.16, 0.50, 0.26 ), vec3( 0.30, 0.70, 0.36 ), smoothstep( 0.3, 0.7, tom ) );
      cor = mix( cor, vec3( 0.86, 0.92, 0.62 ), claro * 0.85 );
      // nuvens brancas soltas
      float nuvem = smoothstep( 0.62, 0.78, camadas( q * 2.5 + 11.0 ) );
      cor = mix( cor, vec3( 0.95, 1.0, 0.94 ), nuvem * 0.7 );
      cor = pow( cor, vec3( 2.2 ) ); // as cores acima estão em sRGB
      float luz = 0.35 + 0.75 * max( dot( vNormal, solDir ), 0.0 );
      // perto da borda: azulado (a atmosfera vista de lado)
      float borda = pow( 1.0 - max( dot( vNormal, vVista ), 0.0 ), 2.5 );
      cor = cor * luz * ( 1.0 - 0.45 * escuro );
      cor = mix( cor, vec3( 0.05, 0.25, 0.65 ), borda * 0.55 );
      gl_FragColor = vec4( cor, opacidade );
      #include <colorspace_fragment>
    }`,
}));
planeta.renderOrder = 20;
planeta.frustumCulled = false;
const grupoPlaneta = new THREE.Group();
grupoPlaneta.visible = false;
grupoPlaneta.add(planeta);
cena.add(grupoPlaneta);
// brilho azul em volta (uma bola um pouco maior, vista por dentro)
const brilhoPlaneta = new THREE.Mesh(new THREE.SphereGeometry(ESPACO.raio * 1.02, 256, 128), new THREE.ShaderMaterial({
  uniforms: uniPlaneta,
  transparent: true, depthTest: false, depthWrite: false,
  blending: THREE.AdditiveBlending, side: THREE.BackSide,
  vertexShader: `
    #include <common>
    #include <logdepthbuf_pars_vertex>
    varying vec3 vNormal;
    varying vec3 vVista;
    void main() {
      vNormal = normalize( mat3( modelMatrix ) * normal );
      vec4 mundo = modelMatrix * vec4( position, 1.0 );
      vVista = normalize( cameraPosition - mundo.xyz );
      gl_Position = projectionMatrix * viewMatrix * mundo;
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: `
    #include <logdepthbuf_pars_fragment>
    uniform float opacidade;
    uniform float alto;
    varying vec3 vNormal;
    varying vec3 vVista;
    void main() {
      #include <logdepthbuf_fragment>
      float d = abs( dot( vNormal, vVista ) );
      // com o céu ainda claro o brilho fica fraquinho (senão vira faixa branca)
      float a = pow( 1.0 - d, 6.0 ) * 0.7 * opacidade * ( 0.15 + 0.85 * alto );
      gl_FragColor = vec4( vec3( 0.35, 0.7, 1.0 ) * a, 1.0 );
    }`,
}));
brilhoPlaneta.renderOrder = 19.5; // antes do planeta: ele cobre o miolo, sobra só a borda
brilhoPlaneta.frustumCulled = false;
grupoPlaneta.add(brilhoPlaneta);

// estrelas: pontinhos numa bola enorme em volta de você
const estrelas = (() => {
  const n = 2200, pos = new Float32Array(n * 3), cor = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos[i * 3] = s * Math.cos(a) * 50000; pos[i * 3 + 1] = u * 50000; pos[i * 3 + 2] = s * Math.sin(a) * 50000;
    const b = 0.45 + Math.random() * 0.55, azul = Math.random() * 0.15;
    cor[i * 3] = b - azul; cor[i * 3 + 1] = b - azul * 0.5; cor[i * 3 + 2] = b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(cor, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 1.8, sizeAttenuation: false, vertexColors: true, transparent: true,
    opacity: 0, depthWrite: false, fog: false,
  }));
  pts.renderOrder = -0.5; // logo depois do céu
  pts.frustumCulled = false;
  pts.visible = false;
  cena.add(pts);
  return pts;
})();

function suave(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function atualizarAltitude() {
  const m = camera.position.y / ESCALA_SENTIDA;
  const alto = Math.min(1, Math.max(0, (m - ESPACO.rarefeito) / (ESPACO.espaco - ESPACO.rarefeito)));
  uniAlto.value = alto;
  const cobre = suave(ESPACO.planetaDe, ESPACO.planetaAte, m);
  uniPlaneta.opacidade.value = cobre;
  grupoPlaneta.visible = cobre > 0.001 && !submerso;
  if (grupoPlaneta.visible) {
    // o topo da bola fica no nível do mar, bem embaixo de você; ela gira
    // conforme você anda, como se você sobrevoasse o planeta
    grupoPlaneta.position.set(camera.position.x, -ESPACO.raio, camera.position.z);
    grupoPlaneta.rotation.set(camera.position.z / ESPACO.raio, 0, -camera.position.x / ESPACO.raio);
  }
  const brilhoEstrelas = suave(0.35, 1, alto);
  estrelas.visible = brilhoEstrelas > 0.001 && !submerso;
  estrelas.material.opacity = brilhoEstrelas;
  estrelas.position.copy(camera.position);
}
function semArAqui() {
  return submerso || camera.position.y / ESCALA_SENTIDA > ESPACO.espaco;
}

const _corNeblina = new THREE.Color();
function atualizarDebaixoDagua(dt) {
  if (!(dt > 0)) return;
  if (ceuPendente && !submerso) { ceuPendente = false; escurecerCeu(); }
  // céu escurecendo (ou clareando de volta) aos poucos
  uniEscuro.value = suavizar(uniEscuro.value, escuroAlvo, 0.9, dt);
  if (Math.abs(uniEscuro.value - escuroAlvo) < 0.002) uniEscuro.value = escuroAlvo;
  const esc = uniEscuro.value;
  hemi.intensity = 2.2 * (1 - 0.62 * esc) + luzRaio * 1.8; // o raio ilumina tudo por um instante
  sol.intensity = 1.6 * (1 - 0.72 * esc);
  // o planeta no céu perde o brilho (senão parece uma lua acesa)
  for (const sat of satelites) {
    // (no espaço, sem ar na frente, ele fica mais nítido)
    sat.sprite.material.opacity = Math.min(1, 0.82 * (1 - 0.55 * esc) + 0.18 * uniAlto.value);
    sat.sprite.material.color.setRGB(1 - 0.5 * esc, 1 - 0.42 * esc, 1 - 0.48 * esc);
  }
  // a copa das árvores é uma figura sem luz: escurece na mão, junto com o resto
  for (const m of matsCopa) m.color.setRGB(1 - 0.8 * esc, 1 - 0.7 * esc, 1 - 0.82 * esc);
  matNuvemTopo.color.copy(corNuvemTopo).lerp(corNuvemEscura, esc);
  matNuvemBase.color.copy(corNuvemBase).lerp(corNuvemBaseEscura, esc);
  atualizarRaios(dt);
  atualizarAltitude();

  // o chão do fundo do mar e as algas acompanham
  fundoDoMar.position.x = Math.round(camera.position.x / PASSO_FUNDO) * PASSO_FUNDO;
  fundoDoMar.position.z = Math.round(camera.position.z / PASSO_FUNDO) * PASSO_FUNDO;
  tempoAlga.value += dt;

  // debaixo d'água: neblina verde fechada, sem céu, sem turvo
  if (submerso) {
    cena.fog.color.copy(corNeblinaAgua);
    cena.fog.near = 2;
    cena.fog.far = 240;
    cena.background = corNeblinaAgua;
  } else {
    cena.fog.color.copy(_corNeblina.copy(corNeblinaNormal).lerp(corNeblinaEscura, esc));
    cena.fog.near = AJUSTE.neblinaPerto;
    cena.fog.far = AJUSTE.neblinaLonge;
    cena.background = null;
  }
  turvo.value = submerso ? 0 : 1;
  ceu.visible = !submerso;
  ceuDasNuvens.visible = !submerso;
  for (const sat of satelites) sat.sprite.visible = !submerso;
  telaDebaixo.classList.toggle('ligada', submerso);

  // fôlego
  const semAr = semArAqui(); // debaixo d'água ou no espaço
  if (semAr) ar -= dt;
  else ar = Math.min(AGUA.ar, ar + dt * 8);
  barraAr.classList.toggle('visivel', semAr || ar < AGUA.ar - 0.05);
  nivelAr.style.width = (Math.max(0, ar) / AGUA.ar * 100).toFixed(1) + '%';
  barraAr.classList.toggle('pouco', ar < AGUA.ar * 0.2);
  if (ar <= 0) recomecar();

  atualizarBolhas(dt);
}

// ---------------------------------------------------------------------
// Laço principal
// ---------------------------------------------------------------------
let antes = performance.now();
function quadro(agora) {
  const dt = Math.min((agora - antes) / 1000, 0.05);
  antes = agora;
  atualizar(dt);
  atualizarEspirro(dt);
  atualizarDebaixoDagua(dt);
  animarAgua(agora / 1000);
  renderer.render(cena, camera);
  desenharRadar(agora / 1000);
  desenharRiscos(dt);
  mostrarAltura();
  requestAnimationFrame(quadro);
}
atualizarIlhas();
criarEsferas();
// Monta já na abertura os "programas" de desenho de tudo (inclusive do
// espirro, que fica escondido): senão o primeiro dash dá uma engasgada.
jatos.visible = true;
renderer.compile(cena, camera);
jatos.visible = false;
requestAnimationFrame(quadro);

// atalho pra testar pelo console do navegador
window.planeta = { camera, vel, apertar, soltar, ilhas, nuvens, ceuDasNuvens, esferas, capturar, chaoDoMar, escurecerCeu, bolhas, explosaoDeBolhas, get ar() { return ar; }, set ar(v) { ar = v; }, alternarMergulho, get semMergulho() { return semMergulho; },
  passo(seg = 1 / 60) { atualizar(seg); atualizarEspirro(seg); atualizarDebaixoDagua(seg); renderer.render(cena, camera); desenharRadar(0); desenharRiscos(seg); mostrarAltura(); }, get yaw() { return yaw; }, set yaw(v) { yaw = v; }, get pitch() { return pitch; }, set pitch(v) { pitch = v; } };
})();
