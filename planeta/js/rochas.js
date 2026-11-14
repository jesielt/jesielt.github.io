// ---------------------------------------------------------------------
// Rochas por mapa de alturas: corpo em sino com patamares planos e paredões
// sulcados, sem partir de nenhuma primitiva. Também guarda o contorno
// irregular das ilhas e o ruído 3D em GLSL usado pelas copas.
// ---------------------------------------------------------------------

// Valores ajustáveis do relevo.
const RELEVO = {
  grade: 28,          // divisões da grade (28 x 28 células; mais = mais faces)
  proporcao: 0.5,     // raio mínimo em relação à altura (0,5: largura ≥ altura); evita torres finas
  variantes: 8,       // formas diferentes, reaproveitadas com tamanho e giro sorteados
  raio: 0.85,         // alcance da queda a partir do centro (1 = borda da grade)
  ombro: 0.35,        // até onde o topo fica cheio antes de começar a cair (sino)
  descentra: 0.3,     // deslocamento sorteado do centro da queda
  corpo: 0.5,         // variação da altura pelo ruído de baixa frequência
  distorcao: 0.22,    // quanto o ruído entorta as coordenadas (sulcos nos paredões)
  freqDistorcao: 3.2, // frequência da distorção (maior = sulcos mais finos)
  niveis: 5,          // patamares
  ingreme: 0.1,       // largura da transição entre patamares (menor = paredão mais vertical)
  topoSuave: 0.6,     // suavidade do último patamar (0 = plano, 1 = segue o ruído)
  grama: 0.88,        // faces mais planas que isto (normal.y) recebem grama
  tons: 0.12,         // variação de tom entre faces
  baseEscura: 0.25,   // escurecimento junto ao chão
};

// ruído de valor 2D com semente, e soma de oitavas (fBm), ambos de 0 a 1
function acaso2(i, j, sem) {
  const s = Math.sin(i * 127.1 + j * 311.7 + sem * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
function ruido2(x, z, sem) {
  const i = Math.floor(x), j = Math.floor(z);
  let u = x - i, v = z - j;
  u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
  const a = acaso2(i, j, sem), b = acaso2(i + 1, j, sem), c = acaso2(i, j + 1, sem), d = acaso2(i + 1, j + 1, sem);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm2(x, z, sem, oitavas = 3) {
  let soma = 0, amp = 0.5, total = 0;
  for (let k = 0; k < oitavas; k++) {
    soma += amp * ruido2(x, z, sem + k * 17);
    total += amp;
    x *= 2.03; z *= 2.03; amp *= 0.5;
  }
  return soma / total;
}
const degrauSuave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Mapa de alturas unitário, (G + 1) x (G + 1) pontos sobre x, z de -1 a 1:
// queda radial descentralizada (sino) x ruído de baixa frequência, com as
// coordenadas entortadas por ruído de frequência mais alta; depois, patamares
// com transição íngreme (o último, mais suave). Altura máxima 1; a borda da
// grade fica abaixo de 0 (enterrada no chão).
function mapaDaRocha(sem) {
  const G = RELEVO.grade, n = RELEVO.niveis, L = G + 1;
  const cx = (acaso2(sem, 1, 9) - 0.5) * 2 * RELEVO.descentra;
  const cz = (acaso2(sem, 2, 9) - 0.5) * 2 * RELEVO.descentra;
  const bruto = new Float32Array(L * L);
  let max = 0;
  for (let i = 0; i <= G; i++) {
    for (let j = 0; j <= G; j++) {
      const x = -1 + 2 * i / G, z = -1 + 2 * j / G;
      const fd = RELEVO.freqDistorcao;
      const wx = x + RELEVO.distorcao * (fbm2(x * fd, z * fd, sem + 101) - 0.5) * 2;
      const wz = z + RELEVO.distorcao * (fbm2(x * fd, z * fd, sem + 202) - 0.5) * 2;
      const d = Math.hypot(wx - cx, wz - cz) / RELEVO.raio;
      const queda = 1 - degrauSuave(RELEVO.ombro, 1, d);
      const corpo = 1 - RELEVO.corpo / 2 + RELEVO.corpo * fbm2(x * 1.3, z * 1.3, sem + 303);
      const h = queda * corpo;
      bruto[i * L + j] = h;
      if (h > max) max = h;
    }
  }
  const mapa = new Float32Array(L * L);
  for (let k = 0; k < mapa.length; k++) {
    const hn = (bruto[k] / max) * n;
    const nivel = Math.min(n - 1, Math.floor(hn)), f = hn - nivel;
    const t = nivel === n - 1
      ? f * RELEVO.topoSuave
      : degrauSuave(0.5 - RELEVO.ingreme, 0.5 + RELEVO.ingreme, f);
    mapa[k] = (nivel + t) / n - 0.03; // -0.03: o pé da rocha fica enterrado
  }
  for (let k = 0; k <= G; k++) { // borda da grade bem abaixo do chão
    mapa[k] = mapa[G * L + k] = mapa[k * L] = mapa[k * L + G] = -0.1;
  }
  // ponto mais alto (onde uma árvore pode nascer); topo exatamente em 1
  let pico = 0;
  for (let k = 1; k < mapa.length; k++) if (mapa[k] > mapa[pico]) pico = k;
  const topo = mapa[pico];
  for (let k = 0; k < mapa.length; k++) mapa[k] /= topo;
  return { mapa, G, pico: [-1 + 2 * Math.floor(pico / L) / G, -1 + 2 * (pico % L) / G] };
}

// Malha facetada do mapa: dois triângulos por célula, com a diagonal entre os
// cantos (i + 1, j) e (i, j + 1), a mesma usada em alturaNoMapa. Faces quase
// planas vão para o grupo 1 (grama); as demais, para o grupo 0 (pedra).
// Triângulos inteiramente abaixo do chão são omitidos.
function geometriaDoMapa({ mapa, G }, sem) {
  const L = G + 1;
  const parede = { pos: [], cor: [] }, grama = { pos: [], cor: [] };
  const P = (i, j) => new THREE.Vector3(-1 + 2 * i / G, mapa[i * L + j], -1 + 2 * j / G);
  const _u = new THREE.Vector3(), _v = new THREE.Vector3();
  let s = sem * 7919 + 13;
  const acaso = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const tri = (a, b, c) => {
    if (a.y < 0 && b.y < 0 && c.y < 0) return;
    // normal em espaço unitário: patamares planos continuam planos em qualquer escala
    _u.subVectors(c, b); _v.subVectors(a, b); _u.cross(_v).normalize();
    const alvo = _u.y > RELEVO.grama ? grama : parede;
    const y = Math.max(0, (a.y + b.y + c.y) / 3);
    const k = alvo === grama ? 1 : (1 + RELEVO.tons * (acaso() - 0.5) * 2) * (1 - RELEVO.baseEscura * (1 - y));
    alvo.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    alvo.cor.push(k, k, k, k, k, k, k, k, k);
  };
  for (let i = 0; i < G; i++) {
    for (let j = 0; j < G; j++) {
      const a = P(i, j), b = P(i + 1, j), c = P(i, j + 1), d = P(i + 1, j + 1);
      tri(a, c, b);
      tri(b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(parede.pos.concat(grama.pos), 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(parede.cor.concat(grama.cor), 3));
  geo.addGroup(0, parede.pos.length / 3, 0);
  geo.addGroup(parede.pos.length / 3, grama.pos.length / 3, 1);
  geo.computeVertexNormals(); // sem índice: normal por face (facetas)
  return geo;
}

const formasDeRocha = Array.from({ length: RELEVO.variantes }, (_, v) => {
  const m = mapaDaRocha(1 + v * 37);
  return { ...m, geo: geometriaDoMapa(m, 1 + v), perfil: perfilDaForma(m.mapa, m.G) };
});

// Altura unitária do mapa em (lx, lz) de -1 a 1, interpolada no mesmo
// triângulo desenhado (fora da grade: -1).
function alturaLocal(mapa, G, lx, lz) {
  if (lx <= -1 || lx >= 1 || lz <= -1 || lz >= 1) return -1;
  const L = G + 1, gu = (lx + 1) / 2 * G, gv = (lz + 1) / 2 * G;
  const i = Math.min(G - 1, Math.floor(gu)), j = Math.min(G - 1, Math.floor(gv));
  const fu = gu - i, fv = gv - j;
  const a = mapa[i * L + j], b = mapa[(i + 1) * L + j], c = mapa[i * L + j + 1], d = mapa[(i + 1) * L + j + 1];
  return fu + fv <= 1 ? a + (b - a) * fu + (c - a) * fv : d + (c - d) * (1 - fu) + (b - d) * (1 - fv);
}
// Altura do relevo de uma rocha em (x, z) do mundo; -Infinity fora da rocha
// ou abaixo do pé dela.
function alturaNoMapa(s, x, z) {
  const dx = x - s.x, dz = z - s.z;
  const c = Math.cos(s.giro), sn = Math.sin(s.giro);
  const h = alturaLocal(s.mapa, s.G, (dx * c - dz * sn) / s.rx, (dx * sn + dz * c) / s.rz);
  return h <= 0 ? -Infinity : s.base + h * s.rh;
}
// Contorno do pé da rocha para o radar: em cada um de 32 ângulos, a distância
// (unitária) mais longe do centro em que o relevo ainda está acima do chão.
function perfilDaForma(mapa, G) {
  const raios = [];
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    let r = 0;
    for (let t = 1; t > 0; t -= 0.5 / G) if (alturaLocal(mapa, G, ca * t, sa * t) > 0) { r = t; break; }
    raios.push(r);
  }
  return raios;
}
// Direção horizontal morro abaixo em (x, z), normalizada; sem declive, aponta
// para fora a partir do centro da rocha.
function descidaNoMapa(s, x, z, saida) {
  const e = 1.5;
  const h = (px, pz) => { const y = alturaNoMapa(s, px, pz); return y === -Infinity ? s.base : y; };
  let gx = h(x - e, z) - h(x + e, z), gz = h(x, z - e) - h(x, z + e);
  if (Math.hypot(gx, gz) < 1e-3) { gx = x - s.x; gz = z - s.z; }
  const m = Math.hypot(gx, gz) || 1;
  return saida.set(gx / m, 0, gz / m);
}

// Ruído de valor 3D (sem textura, sem emendas) e degrau antisserrilhado.
const RUIDO_GLSL = `
  float acaso3( vec3 p ) {
    p = fract( p * 0.3183099 + 0.1 ) * 17.0;
    return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
  }
  float ruido3( vec3 x ) {
    vec3 i = floor( x ), f = fract( x );
    f = f * f * ( 3.0 - 2.0 * f );
    return mix(
      mix( mix( acaso3( i ), acaso3( i + vec3( 1, 0, 0 ) ), f.x ), mix( acaso3( i + vec3( 0, 1, 0 ) ), acaso3( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
      mix( mix( acaso3( i + vec3( 0, 0, 1 ) ), acaso3( i + vec3( 1, 0, 1 ) ), f.x ), mix( acaso3( i + vec3( 0, 1, 1 ) ), acaso3( i + 1.0 ), f.x ), f.y ),
      f.z );
  }
  float camadas3( vec3 p ) {
    return 0.55 * ruido3( p ) + 0.3 * ruido3( p * 2.1 + 3.7 ) + 0.15 * ruido3( p * 4.3 + 7.1 );
  }
  // degrau com borda suavizada pela largura do pixel (evita serrilhado de longe)
  float degrau( float limite, float v ) {
    float w = fwidth( v ) + 0.004;
    return smoothstep( limite - w, limite + w, v );
  }
`;

// contorno irregular da ilha: em cada ângulo, quanto a borda expande ou recua
function contorno(a, ondas) {
  return 1 + 0.13 * Math.sin(2 * a + ondas[0]) + 0.08 * Math.sin(5 * a + ondas[1]) + 0.04 * Math.sin(11 * a + ondas[2]);
}

// Largura relativa de um sólido no ângulo a (referencial do sólido, normalizado
// por rx e rz): contorno ondulado da plataforma ou elipse.
function formaDoSolido(s, a) {
  if (s.ondas) return contorno(a, s.ondas);
  return 1;
}
