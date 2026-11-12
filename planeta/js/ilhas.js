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

  // Montanha: às vezes a ilha ganha uma rocha bem maior e encorpada perto do
  // centro (12 a 28 m de altura; nas enormes até 35 m; as altas são raras),
  // com o topo plano dá pra pousar e andar. Só em ilha média pra cima: 15%
  // das médias/grandes, 35% das enormes (e 10% delas ganham uma segunda). Rocha comum que
  // encostaria nela não nasce.
  const montanhas = [];
  const querMontanha = (k) => {
    if (enorme) return k === 0 ? hash(i, j, 20000) < 0.35 : hash(i, j, 20010) < 0.1;
    return k === 0 && tam >= 55 && hash(i, j, 20000) < 0.15;
  };
  for (let k = 0; k < 2; k++) {
    if (!querMontanha(k)) continue;
    const sm = 20020 + k * 20;
    const base = Math.min(menor * 0.45, Math.max(32, menor * (0.26 + hash(i, j, sm) * 0.14))); // até 40% do raio menor (nunca passa da beira)
    const rx = base * (0.85 + hash(i, j, sm + 1) * 0.3);
    const rz = base * (0.85 + hash(i, j, sm + 2) * 0.3);
    const ang = hash(i, j, sm + 3) * Math.PI * 2;
    const dist = hash(i, j, sm + 4) * (enorme ? 0.4 : 0.22); // perto do meio (nas enormes, mais solta)
    const px = Math.cos(ang) * dist * sx, pz = Math.sin(ang) * dist * sz;
    if (k > 0 && montanhas.some(m => Math.hypot(m.x - (x + px), m.z - (z + pz)) < (m.rx + rx) * 1.1)) continue;
    const metros = 12 + Math.pow(hash(i, j, sm + 5), 1.8) * (enorme ? 23 : 16); // a maioria fica nas mais baixas
    const rh = metros * 17.5;
    const tipo = 1 + Math.floor(hash(i, j, sm + 6) * 3); // 0,55 a 0,85: encorpada, nada de agulha
    const afina = AFINA[tipo];
    const giro = hash(i, j, sm + 7) * Math.PI;
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
    const sol = { x: x + px, z: z + pz, rx, rz, base: alt - 1, h: alt - 1 + rh + 1.25, afina, giro, montanha: true };
    solidos.push(sol);
    montanhas.push(sol);
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
    if (montanhas.length && encostaEmRocha(x + px, z + pz, Math.max(rx, rz) + 4, [null, ...montanhas])) continue;

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

  // árvores: poucas e espalhadas, de 0 a 5 conforme o tamanho da ilha
  const copas = [];
  // (nas enormes, proporcional: de ~4 a ~12)
  const maxArvores = enorme ? Math.floor(tam / 24) : Math.min(5, Math.floor(tam / 24));
  const nArvores = enorme
    ? Math.floor(maxArvores / 2) + Math.floor(hash(i, j, 8) * (maxArvores / 2 + 1))
    : Math.floor(hash(i, j, 8) * (maxArvores + 1));
  for (let k = 0; k < nArvores; k++) {
    const arv = sortearArvore(hash(i, j, 300 + k), hash(i, j, 310 + k));
    const r = arv.r;
    // procura um lugar livre na ilha (até 6 tentativas)
    let lugar = null;
    for (let tent = 0; tent < 6 && !lugar; tent++) {
      const s = 400 + k * 20 + tent * 2;
      const ang = hash(i, j, s) * Math.PI * 2;
      const dist = Math.sqrt(hash(i, j, s + 1)) * 0.85 * contorno(ang, ondas);
      const px = Math.cos(ang) * dist * sx;
      const pz = Math.sin(ang) * dist * sz;
      if (!encostaEmRocha(x + px, z + pz, r * 0.6 + 2, solidos)) lugar = { px, pz };
    }
    if (!lugar) continue;

    plantar(lugar.px, alt, lugar.pz, arv, hash(i, j, 320 + k));
  }

  // evento raro: ~10% das rochas têm uma árvore lá no topo plano
  for (let n = 1; n < solidos.length; n++) {
    if (hash(i, j, 500 + n * 10) > 0.1) continue;
    const roc = solidos[n];
    const arv = sortearArvore(hash(i, j, 501 + n * 10), hash(i, j, 502 + n * 10));
    // um pouco fora do centro, mas sempre dentro do topo
    const a = hash(i, j, 503 + n * 10) * Math.PI * 2;
    const d = Math.min(roc.rx, roc.rz) * roc.afina * 0.4 * hash(i, j, 504 + n * 10);
    plantar(roc.x - x + Math.cos(a) * d, roc.h, roc.z - z + Math.sin(a) * d, arv, hash(i, j, 505 + n * 10));
  }

  // planta uma árvore com o pé em (px, chao, pz), em coordenadas da ilha
  function plantar(px, chao, pz, { r, th, grossura }, sorteio) {
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

  // bichos: só no chão da plataforma (nunca em cima de rocha/montanha)
  const fauna = criarFaunaDaIlha(i, j, { grupo, alt, sx, sz, ondas, solidos, copas, x, z, tam, enorme });

  cena.add(grupo);
  return { grupo, geo, geosManchas, tufos, geoSaia, algas, x, z, solidos, copas, fauna, alt };
}

// Tamanho das árvores (altura total, do pé ao topo da copa, em metros sentidos):
// distribuição natural de 2 a 20 m — a maioria entre ~4 e ~11 m, poucas
// mini e poucas gigantes (média de dois sorteios = curva em sino, puxada pro baixo).
// Mais alta = mais velha = copa maior; da menor pra maior a copa no máximo dobra.
const M_ARVORE = 17.5;     // 1 m sentido, em unidades (ver ESCALA_SENTIDA)
const COPA_MIN = 11;       // raio da copa da árvore de 2 m (a de 20 m tem o dobro)
const ARVORE_MIN = 2, ARVORE_MAX = 20;
function sortearArvore(sorteio1, sorteio2) {
  const u = (sorteio1 + sorteio2) / 2;
  const metros = ARVORE_MIN + (ARVORE_MAX - ARVORE_MIN) * Math.pow(u, 1.6);
  const idade = (metros - ARVORE_MIN) / (ARVORE_MAX - ARVORE_MIN); // 0 = mais nova, 1 = mais velha
  const r = COPA_MIN * (1 + idade);
  const total = metros * M_ARVORE;
  // a copa vai de th + 0,6r - 1,15r até th + 0,6r + 1,15r: o topo dela é th + 1,75r
  const th = Math.max(6, total - r * 1.75);
  return { r, th, grossura: 0.8 + metros * 0.115 }; // a de 20 m: ~3 de raio (40% mais fino que antes)
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
