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
  neblinaPerto: 1500, // início da neblina
  neblinaLonge: 3000, // distância em que tudo assume a cor do horizonte
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

// Neblina pela distância real até a câmera nos materiais indicados. A padrão do
// three.js usa a profundidade (eixo z da visão): ao girar a câmera, um objeto
// que vai para a borda da tela perde neblina. A água e o que fica submerso
// mantêm a padrão, que define o tom e a transparência do mar.
// Chamar depois de qualquer outro onBeforeCompile do material.
function neblinaEsferica(...materiais) {
  for (const mat of materiais) {
    const anterior = mat.onBeforeCompile;
    const chave = mat.customProgramCacheKey() + '|esferica';
    mat.onBeforeCompile = (sh, r) => {
      anterior.call(mat, sh, r);
      sh.vertexShader = sh.vertexShader.replace('#include <fog_vertex>',
        '#ifdef USE_FOG\n\tvFogDepth = length( mvPosition.xyz );\n#endif');
    };
    mat.customProgramCacheKey = () => chave;
  }
}

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

// Intensidades de dia. A sombra só bloqueia o sol: quanto maior a parte do sol
// no total, mais escura a sombra.
const LUZ_CEU = 1.95, LUZ_SOL = 1.9;
const hemi = new THREE.HemisphereLight('#e8f6d0', '#9fb3e6', LUZ_CEU);
cena.add(hemi);
const sol = new THREE.DirectionalLight('#fff4e0', LUZ_SOL);
sol.position.set(-0.5, 1, 0.3); // ~60° acima do horizonte: sol de 14 h, sombra curta
cena.add(sol);

// Sombras: só numa área em volta do jogador, que o acompanha.
// Fazem sombra rochas, árvores e bichos; grama, plataforma e manchas só recebem.
const SOMBRA_RAIO = 1000;              // meia largura da área com sombra, em unidades
const SOMBRA_MAPA = TOQUE ? 1024 : 2048;
renderer.shadowMap.enabled = true;
sol.castShadow = true;
sol.shadow.mapSize.set(SOMBRA_MAPA, SOMBRA_MAPA);
Object.assign(sol.shadow.camera, { left: -SOMBRA_RAIO, right: SOMBRA_RAIO, top: SOMBRA_RAIO, bottom: -SOMBRA_RAIO, near: 1, far: 4000 });
sol.shadow.camera.updateProjectionMatrix();
// Folgas contra listras na superfície. Valores altos descolam a sombra da base
// dos objetos (faixa clara no pé de rochas e troncos).
sol.shadow.bias = -0.00005;
sol.shadow.normalBias = 0.3;
cena.add(sol.target);
const DIR_SOL = sol.position.clone().normalize();
// giro da câmera de sombra (fixo, pois o sol não se move)
const _giroSol = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(DIR_SOL, new THREE.Vector3(), new THREE.Vector3(0, 1, 0)));
const _giroSolInv = _giroSol.clone().invert();
const _pSombra = new THREE.Vector3();
// Centraliza a área de sombra no jogador. O centro anda em passos de um texel
// do mapa: sem isso, a borda das sombras tremula durante o movimento.
function seguirSombra() {
  const passo = (2 * SOMBRA_RAIO) / SOMBRA_MAPA;
  _pSombra.set(camera.position.x, Math.min(camera.position.y, 300), camera.position.z).applyQuaternion(_giroSolInv);
  _pSombra.x = Math.round(_pSombra.x / passo) * passo;
  _pSombra.y = Math.round(_pSombra.y / passo) * passo;
  _pSombra.applyQuaternion(_giroSol);
  sol.target.position.copy(_pSombra);
  sol.position.copy(_pSombra).addScaledVector(DIR_SOL, 2000);
}
