// ---------------------------------------------------------------------
// Ilhas: plataforma baixa acima da água, com 1 a 4 rochas. O mundo é um quadriculado
// de células, cada uma com no máximo uma ilha. Só existem as células próximas do
// jogador; por isso o mundo não tem fim.
// ---------------------------------------------------------------------
const CELULA = 340;
const ALCANCE = Math.ceil(AJUSTE.neblinaLonge / CELULA);
const matRocha = new THREE.MeshLambertMaterial({ color: CORES.rocha });
const matGrama = new THREE.MeshLambertMaterial({ color: CORES.grama });

// Grama de Namek: azul com manchas escuras em degradê. Textura projetada de cima
// pela posição no mundo: emenda igual em ilhas de qualquer tamanho.
function texturaDaGrama() {
  const t = 512, c = document.createElement('canvas');
  c.width = c.height = t;
  const g = c.getContext('2d');
  g.fillStyle = CORES.grama;
  g.fillRect(0, 0, t, t);
  let semente = 31;
  const aleatorio = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
  const emVolta = (desenhar) => { for (const dx of [-t, 0, t]) for (const dy of [-t, 0, t]) desenhar(dx, dy); }; // emenda sem costura
  // manchas suaves de tamanho, intensidade e alongamento variados
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
      // borda do degradê na mesma cor, só transparente: terminar em preto transparente
      // acinzenta a transição
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
// Embaixo d'água, a cor se funde rapidamente à do fundo (água turva).
const corSubmersa = { value: new THREE.Color(CORES.aguaFunda) };
// turvo: 1 = câmera fora da água (o que está submerso some na cor da água);
// 0 = câmera submersa (o tom vem da neblina verde submarina)
const turvo = { value: 1 };
// antes(sh): outra alteração no mesmo material (ex.: movimento das algas)
let materiaisTurvos = 0;
function turvarEmbaixoDagua(mat, antes) {
  // cada material recebe identidade própria: sem isso, o three.js os considera iguais
  // (a função abaixo é a mesma) e reaproveita o programa errado
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
// rochas: faces planas com tom próprio por face (cor por vértice, ver rochas.js)
const matPedra = new THREE.MeshLambertMaterial({ color: CORES.rocha, vertexColors: true, flatShading: true });
turvarEmbaixoDagua(matPedra);
turvarEmbaixoDagua(matGrama, pintarGrama);
turvarEmbaixoDagua(matFundo, (sh) => {
  // o fundo do mar ondula segundo alturaDoFundo (a iluminação acompanha)
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

// Mancha de terra batida no gramado (sem grama): lâmina fina logo acima da grama,
// borda ondulada. Textura em 3 camadas (tons largos, granulado, pedras miúdas),
// sem formas com contorno. Repete a cada 80 de chão.
function texturaDaTerra() {
  const t = 512, c = document.createElement('canvas');
  c.width = c.height = t;
  const g = c.getContext('2d');
  g.fillStyle = CORES.mancha;
  g.fillRect(0, 0, t, t);
  let semente = 77;
  const aleatorio = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
  const emVolta = (desenhar) => { for (const dx of [-t, 0, t]) for (const dy of [-t, 0, t]) desenhar(dx, dy); }; // emenda sem costura
  // 1) tom: manchas largas sem borda, um pouco mais claras ou escuras
  for (let i = 0; i < 22; i++) {
    const x = aleatorio() * t, y = aleatorio() * t, r = 60 + aleatorio() * 110;
    const claro = aleatorio() < 0.5;
    const a = 0.1 + aleatorio() * 0.08;
    emVolta((dx, dy) => {
      const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      const cor = claro ? '226, 210, 192' : '176, 154, 136'; // borda na mesma cor, transparente
      gr.addColorStop(0, `rgba(${cor}, ${a})`);
      gr.addColorStop(1, `rgba(${cor}, 0)`);
      g.fillStyle = gr;
      g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
    });
  }
  // 2) granulado: pontos de 1 a 2 px, claros e escuros, bem fracos
  for (let i = 0; i < 9000; i++) {
    const x = aleatorio() * t, y = aleatorio() * t, s = aleatorio() < 0.8 ? 1 : 2;
    g.fillStyle = aleatorio() < 0.5
      ? `rgba(240, 226, 210, ${0.12 + aleatorio() * 0.12})`
      : `rgba(120, 98, 84, ${0.1 + aleatorio() * 0.12})`;
    g.fillRect(x, y, s, s);
  }
  // 3) pedras miúdas, com sombra embaixo e brilho em cima
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
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, // evita z-fighting com a grama
});
// borda fina entre terra e grama, no azul escuro das pinceladas
const matManchaBorda = new THREE.MeshLambertMaterial({
  color: '#5674c8',
  polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, // abaixo da mancha, acima da grama
});
// (cx, cz) = centro da mancha; o que passa da borda da ilha é aparado.
// cresce: expansão da forma para fora (usada na borda escura).
// Contorno: borda ondulada + "dentes" finos e assimétricos de terra na grama e
// vice-versa, mais longos no eixo x (direção das pinceladas).
const _dentes = new Map(); // dentes de cada mancha, sorteados uma única vez
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
      dir: largEsq * (0.35 + hash(i, j, s + 2) * 1.4), // um lado mais longo: dente assimétrico
      forca: (hash(i, j, s + 3) - 0.35) * (0.15 + Math.pow(hash(i, j, s + 4), 2) * 0.5), // maioria para fora (terra na grama), alguns para dentro
    });
  }
  _dentes.set(chave, d);
  return d;
}
// Contorno calculado uma vez (N ângulos) e guardado: forma, borda e o teste
// de grama sobre terra usam a mesma tabela.
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
  const deitado = 0.12 + 0.88 * Math.pow(Math.abs(Math.cos(a + giro)), 1.5); // 1 = alinhado às pinceladas
  for (const dente of dentesDaMancha(i, j, sem)) {
    let da = a - dente.ang; // normalizado para -π..π
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
  const tabela = contornoDaMancha(i, j, sem); // muitos pontos: os dentes são finos
  for (let k = 0; k <= N_MANCHA; k++) {
    const a = (k / N_MANCHA) * Math.PI * 2;
    const m = r * tabela[k % N_MANCHA] + cresce;
    const lx = Math.cos(a) * m, lz = Math.sin(a) * m * achata;
    let px = cx + lx * cg - lz * sg, pz = cz + lx * sg + lz * cg;
    // ponto além da borda: recuado até a borda
    const q = Math.hypot(px / ilha.sx, pz / ilha.sz);
    const limite = contorno(Math.atan2(pz / ilha.sz, px / ilha.sx), ilha.ondas) * 0.985;
    if (q > limite) { px *= limite / q; pz *= limite / q; }
    k ? forma.lineTo(px, -pz) : forma.moveTo(px, -pz); // deitar no chão inverte o sinal de z
  }
  const geo = new THREE.ShapeGeometry(forma);
  geo.rotateX(-Math.PI / 2); // deita no chão
  return geo;
}
// o ponto (em coordenadas da ilha) está dentro da mancha m? Mesma conta de geometriaMancha
function dentroDaMancha(px, pz, m, i, j) {
  const sem = m.sem;
  const achata = 0.7 + hash(i, j, sem + 3) * 0.3;
  const giro = hash(i, j, sem + 4) * Math.PI * 2;
  const cg = Math.cos(giro), sg = Math.sin(giro);
  const dx = px - m.cx, dz = pz - m.cz;
  const lx = dx * cg + dz * sg, lz = (-dx * sg + dz * cg) / achata;
  // longe da beirada dispensa a conta dos dentes (custosa):
  // a forma fica sempre entre ~0,45 e ~1,8 do raio
  const d = Math.hypot(lx, lz);
  if (d < m.r * 0.45) return true;
  if (d > m.r * 1.8 + 0.8) return false;
  const a = Math.atan2(lz, lx);
  const raio = m.r * contornoDaMancha(i, j, sem)[Math.round(((a + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * N_MANCHA) % N_MANCHA];
  return Math.hypot(lx, lz) < raio + 0.8; // folga: nenhuma grama na beirada
}
const ilhas = new Map(); // "i,j" -> { grupo, geo, solidos, copas } ou null (célula vazia)

// Grama: tufo de 3 folhas em leque, desenhado com instâncias (a GPU recebe a
// forma uma vez e a lista de posições): milhares custam pouco.
function geometriaTufo() {
  const pos = [];
  for (let f = 0; f < 3; f++) {
    const giro = (f / 3) * Math.PI + 0.3;
    const c = Math.cos(giro), s = Math.sin(giro);
    const tomba = (f - 1) * 0.35; // folhas externas pendem para os lados
    const base = 0.09;
    // triângulo: dois pontos na base, ponta no alto, levemente tombada
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
const DIST_TUFOS = 350; // além desta distância a grama é ocultada (economia)

// Árvore de Namek: tronco muito alto e fino + copa azul redonda e felpuda.
const geoTronco = new THREE.CylinderGeometry(0.7, 1, 1, 6);
const matTronco = new THREE.MeshLambertMaterial({ color: CORES.tronco });

// Copa low-poly: icosaedro com vértices deslocados ao acaso e superfície ondulada.
// Base achatada. Faces planas com gradiente vertical e variações de cor por face.
const CORES_COPA = ['#3a55b0', '#5b7bd6', '#8eaaf0'].map(c => new THREE.Color(c));
function geometriaDaCopa(semente) {
  let s = semente;
  const aleatorio = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const ondas = [];
  for (let k = 0; k < 9; k++) {
    const d = new THREE.Vector3(aleatorio() - 0.5, aleatorio() - 0.5, aleatorio() - 0.5).normalize();
    ondas.push([d, 5 + aleatorio() * 5, aleatorio() * 6.3]); // direção, frequência, fase
  }
  const relevo = (v) => ondas.reduce((t, [d, f, fase]) => t + Math.sin(v.dot(d) * f + fase), 0) / ondas.length;
  const geo = new THREE.IcosahedronGeometry(1, 6);
  const p = geo.attributes.position, v = new THREE.Vector3();
  // A geometria não é indexada: vértices na mesma posição recebem o mesmo
  // deslocamento (guardado por posição original), senão a malha abre frestas.
  const deslocados = new Map(), relevos = new Float32Array(p.count);
  for (let n = 0; n < p.count; n++) {
    v.fromBufferAttribute(p, n);
    const k = `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
    let d = deslocados.get(k);
    if (!d) {
      const h = relevo(v); // de -1 a 1, na prática perto de ±0,5
      const u = v.clone().multiplyScalar(1 + 0.08 * h + 0.07 * (aleatorio() - 0.5));
      // desvio lateral: quebra a simetria regular do icosaedro
      u.x += 0.04 * (aleatorio() - 0.5); u.y += 0.04 * (aleatorio() - 0.5); u.z += 0.04 * (aleatorio() - 0.5);
      if (u.y < -0.6) u.y = -0.6 + (u.y + 0.6) * 0.6; // achata a base
      d = { u, h };
      deslocados.set(k, d);
    }
    p.setXYZ(n, d.u.x, d.u.y, d.u.z);
    relevos[n] = d.h;
  }
  // cor por face: os três vértices de cada triângulo recebem o mesmo tom
  const cor = [], c = new THREE.Color();
  for (let n = 0; n < p.count; n += 3) {
    const y = (p.getY(n) + p.getY(n + 1) + p.getY(n + 2)) / 3;
    const h = (relevos[n] + relevos[n + 1] + relevos[n + 2]) / 3;
    const t = THREE.MathUtils.clamp((y + 1) / 2, 0, 1);
    if (t < 0.5) c.lerpColors(CORES_COPA[0], CORES_COPA[1], t / 0.5);
    else c.lerpColors(CORES_COPA[1], CORES_COPA[2], (t - 0.5) / 0.5);
    c.multiplyScalar(1 + 0.35 * h + 0.16 * (aleatorio() - 0.5));
    cor.push(c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  geo.computeVertexNormals(); // sem índice, cada face fica com a própria normal (facetas)
  return geo;
}
const geosCopa = [11, 222, 3333].map(geometriaDaCopa);
const matCopa = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
// Textura da copa: manchas de folhagem em poucos tons (estilo pôster), calculadas
// no próprio shader a partir de ruído 3D na posição local da copa. Não há imagem
// nem coordenadas UV, logo não há emenda nem distorção nos polos. A posição da
// árvore desloca o ruído: cada copa recebe um desenho diferente.
matCopa.customProgramCacheKey = () => 'copa';
matCopa.onBeforeCompile = (sh) => {
  sh.vertexShader = 'varying vec3 vPosCopa;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
    #include <begin_vertex>
    vPosCopa = position + fract( modelMatrix[3].xyz * 0.0137 ) * 50.0;
  `);
  sh.fragmentShader = 'varying vec3 vPosCopa;\n' + RUIDO_GLSL + sh.fragmentShader.replace('#include <color_fragment>', `
    #include <color_fragment>
    float manchas = camadas3( vPosCopa * 2.8 );
    float pintas = camadas3( vPosCopa * 6.5 + 11.0 );
    diffuseColor.rgb *= 1.0
      + 0.26 * degrau( 0.56, manchas )         // manchas claras
      - 0.20 * ( 1.0 - degrau( 0.40, manchas ) ) // manchas escuras
      + 0.12 * degrau( 0.62, pintas );         // pintas claras menores
  `);
};

// número pseudoaleatório fixo por célula: o mesmo lugar gera sempre o mesmo conteúdo
function hash(i, j, s = 0) {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(s + 1, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}


// plataforma: cilindro achatado com a borda deformada pelo contorno
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

// Ilha gigante (raio de 420 a 560, cerca de 4 vezes a área da maior enorme): só
// nasce em células múltiplas de 4; as 24 células em volta (2 de cada lado)
// ficam só com água.
const CHANCE_GIGANTE = 0.2;
function ehGigante(i, j) {
  return (i & 3) === 0 && (j & 3) === 0 && hash(i, j, 88) < CHANCE_GIGANTE;
}
function vizinhaDeGigante(i, j) {
  for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) {
    if ((di || dj) && ehGigante(i + di, j + dj)) return true;
  }
  return false;
}
// Ilha enorme: só nasce em células pares (uma a cada 2x2), fora do espaço das
// gigantes; as 8 células em volta ficam só com água para dar espaço.
function ehEnorme(i, j) {
  return (i & 1) === 0 && (j & 1) === 0 && hash(i, j, 77) < 0.3 && !ehGigante(i, j) && !vizinhaDeGigante(i, j);
}
function vizinhaDeEnorme(i, j) {
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
    if ((di || dj) && ehEnorme(i + di, j + dj)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------
// Embaixo d'água, a ilha vira montanha: da beira da plataforma (y = -3), a encosta
// desce alargando até o fundo, com saliências. A largura varia em volta (saia.E, f, g).
// ---------------------------------------------------------------------
const SAIA_TOPO = -3;
// a base da plataforma é 6% mais larga que o topo: a encosta começa nessa largura,
// com os mesmos 40 lados; caso contrário, a beira da plataforma sobra para fora
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
// altura da encosta submersa (s = solidos[0]) neste ponto, ou -Infinity fora dela
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
// chão submerso neste ponto: fundo do mar ou encosta de uma ilha
function chaoDoMar(x, z) {
  let h = alturaDoFundo(x, z);
  const ci = Math.floor(x / CELULA), cj = Math.floor(z / CELULA);
  // a encosta de uma gigante alcança até 2 células de distância
  for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) {
    const ilha = ilhas.get((ci + di) + ',' + (cj + dj));
    if (ilha && (ilha.gigante || (Math.abs(di) <= 1 && Math.abs(dj) <= 1))) h = Math.max(h, alturaDaSaia(ilha.solidos[0], x, z));
  }
  return h;
}

// Algas: fitas largas de borda ondulada e ponta redonda (duas cruzadas, para dar
// volume de qualquer ângulo), balançando devagar.
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
// rocha da encosta submersa: azul-arroxeada
const matSaia = new THREE.MeshLambertMaterial({ color: '#8b80c4' });
// superfícies rentes ao chão ou submersas: não projetam sombra
const SEM_SOMBRA = [matGrama, matMancha, matManchaBorda, matSaia];
turvarEmbaixoDagua(matSaia);
const _m4a = new THREE.Matrix4(), _qa = new THREE.Quaternion(), _ea = new THREE.Euler();
const _pa = new THREE.Vector3(), _sa = new THREE.Vector3();

function criarIlha(i, j) {
  const gigante = ehGigante(i, j);
  const enorme = gigante || ehEnorme(i, j); // a gigante segue as regras da enorme
  if (!enorme && (vizinhaDeEnorme(i, j) || vizinhaDeGigante(i, j) || hash(i, j) > 0.5)) return null; // só água

  // raio médio: comuns de 35 a 140, a maioria média ou grande (expoente < 1
  // puxa para cima); enormes de 190 a 300; gigantes de 420 a 560
  const tam = gigante ? 420 + hash(i, j, 1) * 140
    : enorme ? 190 + hash(i, j, 1) * 110
    : 35 + hash(i, j, 1) ** 0.75 * 105;
  const varia = enorme ? 0.3 : 0.6; // enormes variam menos, para caber no espaço reservado
  const sx = tam * (1 - varia / 2 + hash(i, j, 2) * varia); // largura...
  const sz = tam * (1 - varia / 2 + hash(i, j, 3) * varia); // ...e profundidade independentes
  const folga = Math.max(0, CELULA / 2 - Math.max(sx, sz) * 1.2);
  const x = (i + 0.5) * CELULA + (hash(i, j, 4) - 0.5) * 2 * folga;
  const z = (j + 0.5) * CELULA + (hash(i, j, 5) - 0.5) * 2 * folga;
  const alt = 1.2 + hash(i, j, 6) * 2.3; // altura da plataforma acima da água
  const FUNDO = -SAIA_TOPO; // a plataforma desce até o início da encosta submersa

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

  // embaixo d'água: encosta até o fundo do mar
  const saia = { E: 35 + hash(i, j, 40) * 30 + tam * 0.1, f: hash(i, j, 41) * 6.3, g: hash(i, j, 42) * 6.3 };
  solidos[0].saia = saia;
  const geoSaia = geometriaSaia(ondas, sx, sz, saia);
  grupo.add(new THREE.Mesh(geoSaia, matSaia));

  // algas no fundo, em volta da base da ilha (bem menos que a grama)
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

  // Manchas no gramado: no mínimo uma por ilha; as maiores chegam a 3. O centro fica
  // a pelo menos meio raio da borda, então no máximo ~20% da mancha é aparada.
  const geosManchas = [];
  const secas = []; // posições das manchas de terra (sem grama nelas)
  const menor = Math.min(sx, sz);
  // nas enormes, proporcional: de 4 a 6
  const nManchas = enorme
    ? 2 + Math.floor(tam / 70)
    : Math.min(3, 1 + Math.floor((tam + hash(i, j, 9) * 20) / 45));
  for (let k = 0; k < nManchas; k++) {
    const sm = 600 + k * 10;
    const r = Math.min(18 + hash(i, j, sm) * 38, menor * 0.42); // raio de 18 a 56
    const ang = hash(i, j, sm + 1) * Math.PI * 2;
    const ate = Math.hypot(Math.cos(ang) * sx, Math.sin(ang) * sz); // distância do centro até a borda sem ondulação
    const maxT = Math.max(0, contorno(ang, ondas) - (0.5 * r) / ate);
    const t = Math.sqrt(hash(i, j, sm + 2)) * maxT; // raiz quadrada: distribuição uniforme, inclusive perto da borda
    const cxm = Math.cos(ang) * t * sx, czm = Math.sin(ang) * t * sz;
    secas.push({ cx: cxm, cz: czm, r, sem: sm + 3 });
    const gm = geometriaMancha(r, cxm, czm, { sx, sz, ondas }, i, j, sm + 3);
    const mancha = new THREE.Mesh(gm, matMancha);
    mancha.position.y = alt + 0.22; // ligeiramente acima da borda (que fica acima da grama)
    grupo.add(mancha);
    geosManchas.push(gm);
    // borda: mesma forma, um pouco maior e mais escura, por baixo; marca a fronteira
    // entre terra e grama
    const gb = geometriaMancha(r, cxm, czm, { sx, sz, ondas }, i, j, sm + 3, 0.8);
    const borda = new THREE.Mesh(gb, matManchaBorda);
    borda.position.y = alt + 0.11;
    grupo.add(borda);
    geosManchas.push(gb);
  }

  // Ergue uma rocha (forma sorteada entre formasDeRocha) com o pé em (px, pz), em
  // coordenadas da ilha, e registra o sólido de colisão com o mesmo mapa de alturas.
  // r: raio aproximado do corpo; a grade cobre um pouco mais (a borda fica enterrada).
  function erguerRocha(px, pz, rx, rz, rh, sem) {
    const base = alt - 1;
    const giro = hash(i, j, sem + 7) * Math.PI * 2;
    const forma = formasDeRocha[Math.floor(hash(i, j, sem + 8) * formasDeRocha.length)];
    const gx = rx * 1.2, gz = rz * 1.2;
    const corpo = new THREE.Mesh(forma.geo, [matPedra, matGrama]);
    corpo.scale.set(gx, rh, gz);
    corpo.position.set(px, base, pz);
    corpo.rotation.y = giro;
    corpo.userData.sombra = true; // material duplo: sem esta marca, não projetaria sombra
    grupo.add(corpo);
    const sol = {
      x: x + px, z: z + pz, rx: gx, rz: gz, base, h: base + rh, rh, giro, afina: 1, alcance: 0.9,
      mapa: forma.mapa, G: forma.G, pico: forma.pico,
    };
    solidos.push(sol);
    return sol;
  }

  // Montanha: ocasionalmente, uma rocha bem maior perto do centro (12 a 28 m; nas
  // enormes, até 35 m; as altas são raras), com topo plano para pouso. Ocorre em 15%
  // das ilhas médias e grandes e em 35% das enormes (10% destas com duas). Rochas comuns que a tocariam não são geradas.
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
    const dist = hash(i, j, sm + 4) * (enorme ? 0.4 : 0.22); // perto do centro (nas enormes, mais dispersa)
    const px = Math.cos(ang) * dist * sx, pz = Math.sin(ang) * dist * sz;
    if (k > 0 && montanhas.some(m => Math.hypot(m.x - (x + px), m.z - (z + pz)) < (m.rx + rx) * 1.1)) continue;
    const metros = 12 + Math.pow(hash(i, j, sm + 5), 1.8) * (enorme ? 23 : 16); // maioria entre as mais baixas
    const rh = metros * 17.5;
    const sol = erguerRocha(px, pz, rx, rz, rh, sm);
    sol.montanha = true;
    montanhas.push(sol);
  }

  // rochas: ilha maior comporta mais (até 4);
  // nas enormes, proporcional ao tamanho (de ~4 a ~11)
  const maxRochas = enorme ? 1 + Math.floor(tam / 28) : Math.min(4, 1 + Math.floor(tam / 28));
  const n = enorme
    ? Math.ceil(maxRochas / 2) + Math.floor(hash(i, j, 7) * (maxRochas / 2 + 1))
    : 1 + Math.floor(hash(i, j, 7) * maxRochas);
  for (let k = 0; k < n; k++) {
    const s = 100 + k * 10;
    const ang = hash(i, j, s) * Math.PI * 2;
    const dist = Math.sqrt(hash(i, j, s + 1)) * (enorme ? 0.75 : 0.55); // nas enormes, mais dispersas
    const px = Math.cos(ang) * dist * sx;
    const pz = Math.sin(ang) * dist * sz;

    const base = 5 + hash(i, j, s + 2) * Math.min(tam * 0.32, 28);
    const rx = base * (0.65 + hash(i, j, s + 3) * 0.7);
    const rz = base * (0.65 + hash(i, j, s + 4) * 0.7);
    const rh = 10 + hash(i, j, s + 5) ** 1.5 * 95;
    if (montanhas.length && encostaEmRocha(x + px, z + pz, Math.max(rx, rz) * 1.1 + 4, [null, ...montanhas])) continue;
    erguerRocha(px, pz, rx, rz, rh, s);
  }

  // árvores: poucas e espalhadas, de 0 a 5 conforme o tamanho da ilha
  const copas = [];
  // nas enormes, proporcional: de ~4 a ~12
  const maxArvores = enorme ? Math.floor(tam / 24) : Math.min(5, Math.floor(tam / 24));
  const nArvores = enorme
    ? Math.floor(maxArvores / 2) + Math.floor(hash(i, j, 8) * (maxArvores / 2 + 1))
    : Math.floor(hash(i, j, 8) * (maxArvores + 1));
  for (let k = 0; k < nArvores; k++) {
    const arv = sortearArvore(hash(i, j, 300 + k), hash(i, j, 310 + k));
    const r = arv.r;
    // busca um lugar livre na ilha (até 6 tentativas)
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

  // raro: ~10% das rochas têm uma árvore no ponto mais alto
  for (let n = 1; n < solidos.length; n++) {
    if (hash(i, j, 500 + n * 10) > 0.1) continue;
    const roc = solidos[n];
    const arv = sortearArvore(hash(i, j, 501 + n * 10), hash(i, j, 502 + n * 10));
    const [pu, pv] = roc.pico, c = Math.cos(roc.giro), sn = Math.sin(roc.giro);
    const wx = pu * roc.rx * c + pv * roc.rz * sn, wz = -pu * roc.rx * sn + pv * roc.rz * c;
    const chao = alturaNoMapa(roc, roc.x + wx, roc.z + wz);
    if (chao > -Infinity) plantar(roc.x - x + wx, chao, roc.z - z + wz, arv, hash(i, j, 505 + n * 10));
  }

  // planta uma árvore com o pé em (px, chao, pz), em coordenadas da ilha
  function plantar(px, chao, pz, { r, th, grossura }, sorteio) {
    const tronco = new THREE.Mesh(geoTronco, matTronco);
    tronco.scale.set(grossura, th, grossura);
    tronco.position.set(px, chao + th / 2 - 0.5, pz);
    const copa = new THREE.Mesh(geosCopa[Math.floor(sorteio * geosCopa.length)], matCopa);
    copa.scale.setScalar(r);
    copa.rotation.y = sorteio * 40; // a mesma variação aparece em ângulos diferentes
    copa.position.set(px, chao + th + r * 0.6, pz);
    grupo.add(tronco, copa);
    // tronco: base, topo e grossura guardados para a colisão da esfera
    copas.push({ x: x + px, y: chao + th + r * 0.6, z: z + pz, r, chao, topo: chao + th, grossura });
  }

  // grama: em moitas espalhadas (quanto maior a ilha, mais moitas)
  const area = Math.PI * sx * sz;
  const nMoitas = Math.min(gigante ? 1000 : 260, Math.floor(area / 160));
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
      if (secas.some(m => dentroDaMancha(tx, tz, m, i, j))) continue; // terra batida: sem grama
      const tam = 0.6 + hash(i, j, sm + 30 + k) * 0.8; // 0,6 a 1,4 ≈ 3 a 8 cm sentidos
      e.set(0, a * 3, 0);
      m4.compose(p3.set(tx, alt, tz), q.setFromEuler(e), s3.set(tam, tam, tam));
      tufos.setMatrixAt(usados++, m4);
    }
  }
  tufos.count = usados;
  tufos.frustumCulled = false; // a visibilidade é decidida pela distância (em atualizar)
  grupo.add(tufos);

  // fauna: só no chão da plataforma (nunca sobre rocha ou montanha)
  const fauna = criarFaunaDaIlha(i, j, { grupo, alt, sx, sz, ondas, solidos, copas, x, z, tam, enorme });

  // sombras: tudo recebe; só o que tem volume projeta
  grupo.traverse(o => {
    if (!o.isMesh) return;
    o.receiveShadow = true;
    o.castShadow = o.userData.sombra || (!o.isInstancedMesh && !Array.isArray(o.material) && !SEM_SOMBRA.includes(o.material));
  });

  cena.add(grupo);
  return { grupo, geo, geosManchas, tufos, geoSaia, algas, x, z, solidos, copas, fauna, alt, gigante };
}

// Altura das árvores (do pé ao topo da copa, em metros sentidos): de 2 a 20 m,
// maioria entre ~4 e ~11 (média de dois sorteios = curva em sino deslocada para baixo).
// Mais alta = copa maior; da menor para a maior, a copa no máximo dobra.
const M_ARVORE = 17.5;     // 1 m sentido, em unidades (ver ESCALA_SENTIDA)
const COPA_MIN = 11;       // raio da copa da árvore de 2 m (a de 20 m tem o dobro)
const ARVORE_MIN = 2, ARVORE_MAX = 20;
function sortearArvore(sorteio1, sorteio2) {
  const u = (sorteio1 + sorteio2) / 2;
  const metros = ARVORE_MIN + (ARVORE_MAX - ARVORE_MIN) * Math.pow(u, 1.6);
  const idade = (metros - ARVORE_MIN) / (ARVORE_MAX - ARVORE_MIN); // 0 = mais nova, 1 = mais velha
  const r = COPA_MIN * (1 + idade);
  const total = metros * M_ARVORE;
  // a copa vai de th + 0,6r - 1,15r a th + 0,6r + 1,15r; o topo fica em th + 1,75r
  const th = Math.max(6, total - r * 1.75);
  return { r, th, grossura: 0.8 + metros * 0.115 }; // a de 20 m: ~3 de raio
}

// este ponto (com esta folga) está sobre alguma rocha?
function encostaEmRocha(px, pz, folga, solidos) {
  for (let n = 1; n < solidos.length; n++) {
    const s = solidos[n];
    const dx = px - s.x, dz = pz - s.z;
    const c = Math.cos(s.giro), sn = Math.sin(s.giro);
    const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
    const a = s.alcance || 1; // os cantos do polígono vão além de rx e rz
    if (Math.hypot(lx / (s.rx * a + folga), lz / (s.rz * a + folga)) < 1) return true;
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
  // células distantes são removidas (libera memória)
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

// ilhas das 9 células ao redor do jogador (as únicas com colisão), mais as
// gigantes a até 2 células: a borda delas alcança além da célula vizinha
function* ilhasPerto() {
  const ci = Math.floor(camera.position.x / CELULA);
  const cj = Math.floor(camera.position.z / CELULA);
  for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) {
    const ilha = ilhas.get((ci + di) + ',' + (cj + dj));
    if (ilha && (ilha.gigante || (Math.abs(di) <= 1 && Math.abs(dj) <= 1))) yield ilha;
  }
}

// Teste (7-8-9 no teclado numérico): as formas de rocha lado a lado, sobre a
// água, à frente do jogador, para comparar. Repetir o código as remove.
let vitrineDeRochas = null;
function mostrarFormasDasRochas() {
  if (vitrineDeRochas) { cena.remove(vitrineDeRochas); vitrineDeRochas = null; return; }
  vitrineDeRochas = new THREE.Group();
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), lx = Math.cos(yaw), lz = -Math.sin(yaw);
  const meio = (formasDeRocha.length - 1) / 2;
  formasDeRocha.forEach((forma, k) => {
    const m = new THREE.Mesh(forma.geo, [matPedra, matGrama]);
    m.scale.set(40, 70, 40);
    m.position.set(camera.position.x + fx * 260 + lx * (k - meio) * 95, 0, camera.position.z + fz * 260 + lz * (k - meio) * 95);
    m.castShadow = m.receiveShadow = true;
    vitrineDeRochas.add(m);
  });
  cena.add(vitrineDeRochas);
}
