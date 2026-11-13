// ---------------------------------------------------------------------
// Debaixo d'água: tons verdes, bolhas (mais quanto maior a velocidade), movimento
// reduzido e barra de ar decrescente. Sem ar: retorno ao início e perda das esferas.
// ---------------------------------------------------------------------
const AGUA = {
  nerf: 0.55, // força e velocidade máxima submersas (× normal)
  dash: 1.35, // dash submerso (fora d'água é 2)
  arrasto: 1.5, // atrito maior (× normal)
  choque: 0.3, // fração do embalo mantida ao entrar na água
  ar: 40, // segundos de ar
  gravidadeEsfera: 0.22, // velocidade de afundamento da esfera
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

// ---------- bolhas: partículas na água, subindo e oscilando ----------
// Nascem à frente do jogador (mais quanto maior a velocidade) e ficam fixas no mundo.
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
// bolha em: frente (distância à frente), lado e acima, nos eixos do olhar
// (funciona olhando reto, para baixo ou para cima)
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
  if (y > -0.6) y = -1.2 - (y + 0.6); // acima da superfície: espelha para baixo (mantém a dispersão, sem formar camada)
  bolhas.pos[i * 3] = x; bolhas.pos[i * 3 + 1] = y; bolhas.pos[i * 3 + 2] = z;
  bolhas.tam[i] = tam;
  bolhas.sobe[i] = sobe;
  bolhas.fase[i] = Math.random() * 6.3;
  bolhas.idade[i] = 0;
  bolhas.alfa[i] = 0.001; // surge gradualmente
}
function direcoesDaCamera() {
  // os três eixos da câmera. Não usar frente × vertical para o lado: zera olhando
  // para baixo e as bolhas se concentram num plano
  camera.getWorldDirection(_fr);
  _ld.set(1, 0, 0).applyQuaternion(camera.quaternion);
  _ac.set(0, 1, 0).applyQuaternion(camera.quaternion);
}
function atualizarBolhas(dt) {
  uniBolhas.escala.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
  if (submerso) {
    direcoesDaCamera();
    // parado: poucas; nadando: moderadas; dash: muitas, e nascem mais longe quanto
    // maior a velocidade, para dar tempo de alcançá-las
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
    if (!submerso) { bolhas.alfa[i] = 0; continue; } // fora da água: todas somem
    bolhas.idade[i] += dt;
    const t = bolhas.idade[i], k = i * 3;
    bolhas.pos[k + 1] += bolhas.sobe[i] * dt;
    bolhas.pos[k] += Math.sin(t * 3 + bolhas.fase[i]) * 0.6 * dt;
    bolhas.pos[k + 2] += Math.cos(t * 2.6 + bolhas.fase[i]) * 0.6 * dt;
    _cm.set(bolhas.pos[k], bolhas.pos[k + 1], bolhas.pos[k + 2]);
    // na superfície, muito para trás ou antiga demais: some
    if (bolhas.pos[k + 1] > -0.3 || _cm.distanceTo(camera.position) > 160 || t > 9) { bolhas.alfa[i] = 0; continue; }
    bolhas.alfa[i] = Math.min(1, t * 3) * Math.min(1, (-0.3 - bolhas.pos[k + 1]) * 2);
  }
  geoBolhas.attributes.position.needsUpdate = true;
  geoBolhas.attributes.tam.needsUpdate = true;
  geoBolhas.attributes.alfa.needsUpdate = true;
}

// mergulho rápido: estouro de bolhas ao redor do jogador, subindo depressa
function explosaoDeBolhas(embalo) {
  const n = Math.max(0, Math.min(600, Math.floor((embalo - 40) * 4)));
  if (!n) return;
  direcoesDaCamera();
  // distribuídas numa esfera à frente (na direção do olhar), sempre submersa;
  // densas no centro, esparsas na borda
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

// "Não mergulhar": clique duplo com o botão direito alterna (ou toque no botão do
// nadador). A escolha fica salva.
let semMergulho = false;
try { semMergulho = localStorage.getItem('planeta.semMergulho') === '1'; } catch (e) { /* sem armazenamento: ignorado */ }
const botaoMergulho = document.getElementById('semMergulho');
function mostrarMergulho() {
  botaoMergulho.classList.toggle('ligado', semMergulho);
  document.getElementById('toqueMergulho').classList.toggle('ligado', semMergulho);
  botaoMergulho.setAttribute('aria-checked', String(semMergulho));
}
// aviso: ao ligar, dois anéis saem do botão e somem; ao desligar, dois anéis
// grandes encolhem até a borda dele
const interruptor = botaoMergulho.querySelector('.interruptor');
function avisarMergulho() {
  interruptor.querySelectorAll('.anel').forEach(a => a.remove());
  // alcance do anel: do centro do botão até o canto superior esquerdo da tecla A
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
  try { localStorage.setItem('planeta.semMergulho', semMergulho ? '1' : '0'); } catch (e) { /* ignorado */ }
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

// sem ar (ou R): volta ao início e perde as esferas
function recomecar() {
  camera.position.copy(inicio);
  vel.set(0, 0, 0);
  modo = 'voo';
  tPouso = -1;
  olhosAgora = ANDAR.olhos;
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
    // capturada pelo atalho de teste antes de pousar: sem modelo, volta a aguardar no ponto
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
  reiniciarReuniao();
  atualizarIlhas();
}

// ---------- céu escuro e raios ao reunir as 7 ----------
let escuroAlvo = 0;
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
// Raio: sai da base de uma nuvem visível e desce em zigue-zague até o mar (às vezes
// com ramificação). Fita branca voltada para a câmera + brilho verde; a luz ambiente
// pisca junto, e o clarão na tela é só reforço.
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

// fita pelos pontos, sempre de lado para a câmera
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
  if (submerso) return; // submerso: não é visível
  // uma nuvem à frente, a distância média
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
    : camera.position.clone().addScaledVector(_frente, 700 + Math.random() * 800).setY(720); // sem nuvem: do alto, à frente
  de.x += (Math.random() - 0.5) * 120;
  de.z += (Math.random() - 0.5) * 120;
  const ate = new THREE.Vector3(de.x + (Math.random() - 0.5) * 220, 0, de.z + (Math.random() - 0.5) * 220);
  const tronco = caminhoDoRaio(de, ate, 22, 60);
  const caminhos = [[tronco, 1]];
  // ramificação a partir do meio
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
      // na transição, em sequência; depois, ocasionalmente e ao longe
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
    const a = (r.vida / r.dura) * (0.55 + 0.45 * Math.random()); // piscar
    r.grupo.children.forEach((m, n) => { m.material.opacity = a * (n % 2 ? 1 : 0.35); });
    return true;
  });
  luzRaio *= Math.exp(-9 * dt);
  clarao *= Math.exp(-6 * dt);
  telaClarao.style.opacity = clarao.toFixed(3);
}
