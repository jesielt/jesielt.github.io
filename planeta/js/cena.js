// ---------------------------------------------------------------------
// Ajustes de sensação
// ---------------------------------------------------------------------
const AJUSTE = {
  sensibilidade: 0.0022, // giro do olhar por pixel de mouse
  sensibilidadeToque: 0.005, // ...e por pixel de arrasto no toque
  raioJoystick: 55, // px: distância do centro do joystick até a força máxima
  acel: 100, // aceleração ao segurar uma tecla
  arrasto: 1.2, // inércia: menor = desliza mais após soltar
  velMax: 90,             // m/s
  dash: 2, // com Shift: multiplica velocidade e força
  arranqueDash: 450, // impulso extra até o dash atingir a velocidade
  alturaOlhos: 3.5, // distância mínima entre os olhos e o chão (~20 cm sentidos)
  fovParado: 70, // campo de visão parado...
  fovVeloz: 84, // ...e na velocidade máxima
  inclinaLado: 0.07, // inclinação da câmera ao mover de lado (A/D)
  inclinaCurva: 0.04, // ...e para dentro da curva ao girar o mouse
  inclinaMax: 0.2,
  neblinaPerto: 650, // início da neblina
  neblinaLonge: 2200, // distância em que tudo assume a cor do horizonte
};

const CORES = {
  horizonte: '#dbe7ac',
  agua: '#5fae8a', // superfície
  aguaFunda: '#3d8a70', // cor vista através da água turva
  rocha: '#e9aab3',
  grama: '#7d9ce2',
  tronco: '#e6c3b4',
  tufo: '#6683d6',
  mancha: '#c9b4a2', // terra batida (chão exposto no meio da grama)
};

// ---------------------------------------------------------------------
// Cena, câmera e renderizador
// ---------------------------------------------------------------------
const canvas = document.getElementById('tela');
// logarithmicDepthBuffer: precisão de profundidade perto e longe. Sem ele, vistos
// do alto, o topo das ilhas e a água piscam (z-fighting).
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
// Celular: resolução menor (tela pequena, processador mais fraco).
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TOQUE ? 1.5 : 2));

const cena = new THREE.Scene();
// Neblina na cor do horizonte: quanto mais longe, mais desbotado.
cena.fog = new THREE.Fog(CORES.horizonte, AJUSTE.neblinaPerto, AJUSTE.neblinaLonge);

// 0.5 = distância mínima de desenho (menor que a altura mínima dos olhos).
const camera = new THREE.PerspectiveCamera(AJUSTE.fovParado, 1, 0.5, 200000); // alcance longo: visto do espaço, o planeta é enorme
camera.rotation.order = 'YXZ'; // gira primeiro para os lados, depois para cima/baixo
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
