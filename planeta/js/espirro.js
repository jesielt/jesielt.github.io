// ---------------------------------------------------------------------
// Espirro: com dash, rente ao mar (até 1,5 m), a água se abre para os lados em V.
// De perfil, cada esguicho é um triângulo preso ao mar: o lado curto fica à frente
// (onde a água sobe e se desfaz em gotas e névoa), inclinado para fora; o lado longo
// fica deitado na água, para trás (sempre encostado, sem corte visível); a altura
// diminui até zero no fim. 5 paredes por lado, cada uma num ângulo e curvada, dão
// volume; uma sexta, deitada (a "cama"), forma a espuma. Por cima: gotas e névoa.
// Medidas em h (altura do jogador sobre a água), para manter a proporção na tela.
// ---------------------------------------------------------------------
const ESPIRRO = {
  alturaMax: 1.5 * ESCALA_SENTIDA, // só a 1,5 m da água ou menos
  velMin: 25, // abaixo disso, sem espirro
  pontaFrente: 1.5, // início (base do lado curto): à frente do jogador (× h)...
  pontaLado: 1.3, // ...e para o lado (× h): bem separados, na parte de baixo da tela
  comprimento: 3.5, // extensão do lado longo para trás (× h)
  abre: 1.2, // ...e afastamento lateral ao longo dela (× h)
  altura: 1.6, // altura do lado curto (× h)
  nevoaPorSegundo: 55,
  maxNevoa: 300,
};
let forcaEspirro = 0; // 0 a 1: transição suave
let alvoEspirro = 0;  // força pedida agora, sem suavização (o som reage a ela)
const _rumo = new THREE.Vector3(0, 0, -1); // direção do movimento (no plano)
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
const SEG_U = 26, SEG_V = 7; // segmentos ao longo (u: ponta -> trás) e na vertical (v: mar -> topo)
const PAREDES = [];
for (const lado of [-1, 1]) {
  // [inclinação para fora (graus), desvio lateral (× h), altura relativa, fase]
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

// ponto (u, v) da parede: u = do lado curto (0) até o fim (1); v = do mar (0) ao topo (1)
function pontoDaParede(p, u, v, alvo) {
  const c = camera.position;
  const h = c.y;
  const tempo = uniJatos.tempo.value;
  const frente = h * (ESPIRRO.pontaFrente - ESPIRRO.comprimento * u);
  // base no mar: vai para trás e para fora, com leve curvatura externa
  const lateral = h * (ESPIRRO.pontaLado + p.dLado * u + ESPIRRO.abre * u + 0.15 * Math.sin(Math.PI * u));
  // altura: máxima à frente, decrescente até zero (triângulo); o topo oscila
  const treme = 1 + 0.15 * Math.sin(tempo * 9 + u * 12 + p.fase);
  const alt = h * ESPIRRO.altura * p.alt * Math.pow(1 - u, 0.8) * treme * forcaEspirro * v;
  alvo.set(c.x, 0, c.z).addScaledVector(_rumo, frente).addScaledVector(_lado, lateral * p.lado);
  // sobe inclinada para fora (ângulo próprio por parede)
  alvo.y += alt * Math.cos(p.inc) + (p.cama ? 0.03 * h : 0); // a cama fica ligeiramente acima do mar
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

// nasce no lado curto (onde a água se desfaz), da base ao topo
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
// Gotas e fragmentos de espuma que saltam do topo e do lado curto das paredes e caem.
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
  // metade sai do lado curto, metade do topo
  if (Math.random() < 0.5) pontoDaParede(p, Math.random() * 0.15, Math.random(), _pp);
  else pontoDaParede(p, Math.random() * 0.7, 0.8 + Math.random() * 0.2, _pp);
  gotas.pos[i * 3]     = _pp.x;
  gotas.pos[i * 3 + 1] = _pp.y;
  gotas.pos[i * 3 + 2] = _pp.z;
  // salta para fora e para cima, com variação; acompanha quase todo o movimento do jogador
  const fora = h * (1.5 + Math.random() * 4);
  const cima = h * (1 + Math.random() * 3.5);
  const bagunca = h * 2;
  gotas.vel[i * 3]     = _lado.x * fora * p.lado + (Math.random() - 0.5) * bagunca + vel.x * 0.8;
  gotas.vel[i * 3 + 1] = cima;
  gotas.vel[i * 3 + 2] = _lado.z * fora * p.lado + (Math.random() - 0.5) * bagunca + vel.z * 0.8;
  const dura = 0.35 + Math.random() * 0.5;
  gotas.vida[i] = dura;
  gotas.dura[i] = dura;
  // maioria gotas; algumas são fragmentos maiores de espuma
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

let desvioEspirro = 0; // giro do esguicho em direção ao movimento (radianos)
function atualizarEspirro(dt) {
  if (!(dt > 0)) return;
  const c = camera.position;
  const rapidez = Math.hypot(vel.x, vel.z);
  // O esguicho segue a direção da câmera. O movimento (ex.: A/D, que gera diagonal)
  // desvia pouco, no máximo ~11°, com suavização.
  if (rapidez > 1) {
    let delta = Math.atan2(-vel.x, -vel.z) - yaw;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta)); // entre -180° e 180°
    const alvoDesvio = Math.max(-0.2, Math.min(0.2, delta));
    desvioEspirro = suavizar(desvioEspirro, alvoDesvio, 4, dt);
  }
  const rumoYaw = yaw + desvioEspirro;
  _rumo.set(-Math.sin(rumoYaw), 0, -Math.cos(rumoYaw));
  _lado.set(-_rumo.z, 0, _rumo.x);

  // força alvo: só com dash, rente, sobre a água; mais rápido e mais baixo = mais forte
  let alvo = 0;
  if (segurando('dash') && c.y > 0 && c.y <= ESPIRRO.alturaMax && rapidez > ESPIRRO.velMin && !sobreIlha(c.x, c.z)) {
    const rente = 1 - (c.y - AJUSTE.alturaOlhos) / (ESPIRRO.alturaMax - AJUSTE.alturaOlhos);
    alvo = Math.max(0.35, Math.min(1, rente)) * Math.min(rapidez / (AJUSTE.velMax * 1.5), 1);
  }
  alvoEspirro = alvo;
  forcaEspirro = suavizar(forcaEspirro, alvo, alvo > forcaEspirro ? 6 : 3, dt);

  // paredes
  uniJatos.tempo.value += dt;
  uniJatos.forca.value = forcaEspirro;
  jatos.visible = forcaEspirro > 0.01;
  if (jatos.visible) montarJatos();

  uniNevoa.escala.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
  atualizarGotas(dt, rapidez);

  // névoa: nasce enquanto há força; a existente completa o ciclo
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
    const t = nevoa.vida[i] / nevoa.dura[i]; // 1 = recém-nascida, 0 = no fim
    nevoa.alfa[i] = Math.min(1, (1 - t) * 6) * t * 0.24; // acende rápido, apaga devagar
    nevoa.tam[i] += dt * camera.position.y * 0.6; // a névoa se expande
  }
  geoNevoa.attributes.position.needsUpdate = true;
  geoNevoa.attributes.tam.needsUpdate = true;
  geoNevoa.attributes.alfa.needsUpdate = true;
}
