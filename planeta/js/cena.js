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
