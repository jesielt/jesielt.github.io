// ---------------------------------------------------------------------
// Rochas low-poly em tronco de pirâmide ou de tetraedro, com faces tortas e
// topo plano de grama. Algumas ganham um segundo andar menor por cima. Também guarda o ruído 3D em GLSL usado pelas copas.
// ---------------------------------------------------------------------

// Valores ajustáveis.
const ROCHA = {
  chanceTriangulo: 0.4, // chance de base com 3 cantos (tronco de tetraedro); senão, 4 (tronco de pirâmide)
  torto: 0.35,       // desvio do ângulo de cada canto (0 = polígono regular)
  cantos: 0.15,      // desvio da distância de cada canto ao centro
  porLado: 3,        // divisões de cada lado da base (mais = contorno mais quebrado)
  fileiras: 4,       // fileiras de faces na parede, da base ao topo
  aspereza: 0.05,    // desvio de cada vértice, para as faces ficarem tortas
  desnivel: 0.35,    // desvio da altura dos vértices internos (fração de uma fileira)
  ombro: 0.04,       // recuo da borda do topo (arredonda a quina)
  pe: 0.03,          // alargamento da base
  tons: 0.12,        // variação de tom entre faces
  baseEscura: 0.18,  // escurecimento junto ao chão
  variantes: 4,      // formas diferentes por afinamento
  andar: 0.35,       // chance de um segundo andar em cima
};
// afinamento do topo em relação à base (tronco de pirâmide: topo bem menor)
const AFINA = [0.3, 0.4, 0.5, 0.6];

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

// Distância do centro à borda de um polígono convexo, na direção do ângulo a.
// cantos: [[x, z], ...] em volta da origem.
function raioDoPoligono(cantos, a) {
  const dx = Math.cos(a), dz = Math.sin(a), n = cantos.length;
  for (let k = 0; k < n; k++) {
    const [x1, z1] = cantos[k], [x2, z2] = cantos[(k + 1) % n];
    const ex = x2 - x1, ez = z2 - z1;
    const den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const r = (x1 * ez - z1 * ex) / den;
    const u = (x1 * dz - z1 * dx) / den;
    if (r > 0 && u >= -1e-6 && u <= 1 + 1e-6) return r;
  }
  return 1;
}
// Largura relativa de um sólido no ângulo a (referencial do sólido, normalizado
// por rx e rz): polígono das rochas, contorno ondulado da plataforma ou elipse.
function formaDoSolido(s, a) {
  if (s.cantos) return raioDoPoligono(s.cantos, a);
  if (s.ondas) return contorno(a, s.ondas);
  return 1;
}

// Rocha unitária em tronco de pirâmide (4 cantos) ou de tetraedro (3 cantos):
// base em y = 0, topo em y = 1 com a mesma forma reduzida por `afina`. Cada
// lado da base é dividido e todos os vértices recebem pequenos desvios, para
// as faces ficarem tortas. A colisão usa o mesmo polígono (raioDoPoligono).
// Geometria não indexada: cada face tem normal e cor próprias (facetas).
// Grupo 0: parede; grupo 1: topo.
function geometriaDaRocha(afina, semente) {
  let s = semente * 7919 + 13;
  const acaso = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const N = acaso() < ROCHA.chanceTriangulo ? 3 : 4;
  const alcanceBase = N === 3 ? 1.3 : 1.15; // o triângulo é mais esticado para ter área parecida
  const giro = acaso() * Math.PI * 2;
  const cantos = [];
  for (let k = 0; k < N; k++) {
    const a = giro + ((k + (acaso() - 0.5) * ROCHA.torto) / N) * Math.PI * 2;
    const r = alcanceBase * (1 - acaso() * ROCHA.cantos);
    cantos.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  // pontos do contorno da base: cantos e divisões de cada lado
  const M = ROCHA.porLado, L = N * M, contornoBase = [];
  for (let k = 0; k < N; k++) {
    const [x1, z1] = cantos[k], [x2, z2] = cantos[(k + 1) % N];
    for (let m = 0; m < M; m++) contornoBase.push([x1 + (x2 - x1) * m / M, z1 + (z2 - z1) * m / M]);
  }
  const R = ROCHA.fileiras;
  const anel = [];
  for (let r = 0; r <= R; r++) {
    const pts = [];
    for (let c = 0; c < L; c++) {
      const meio = r > 0 && r < R;
      const t = r / R + (meio ? (acaso() - 0.5) * ROCHA.desnivel / R : 0);
      let f = (1 + (afina - 1) * t) * (1 + ROCHA.aspereza * (acaso() - 0.5) * 2);
      if (r === R) f *= 1 - ROCHA.ombro;
      if (r === 0) f *= 1 + ROCHA.pe;
      pts.push(new THREE.Vector3(contornoBase[c][0] * f, t, contornoBase[c][1] * f));
    }
    anel.push(pts);
  }
  const pos = [], cor = [];
  const tri = (a, b, c, k) => {
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    cor.push(k, k, k, k, k, k, k, k, k);
  };
  const tom = (y) => (1 + ROCHA.tons * (acaso() - 0.5) * 2) * (1 - ROCHA.baseEscura * (1 - y));
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < L; c++) {
      const a = anel[r][c], b = anel[r][(c + 1) % L], d = anel[r + 1][c], e = anel[r + 1][(c + 1) % L];
      const y = (r + 0.5) / R;
      tri(a, e, b, tom(y));
      tri(a, d, e, tom(y));
    }
  }
  const nParede = pos.length / 3;
  const centro = new THREE.Vector3(0, 1, 0);
  for (let c = 0; c < L; c++) tri(centro, anel[R][(c + 1) % L], anel[R][c], 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  geo.addGroup(0, nParede, 0);
  geo.addGroup(nParede, pos.length / 3 - nParede, 1);
  geo.computeVertexNormals();
  return { geo, cantos, alcance: alcanceBase };
}
// geosRocha[tipo][variante] = { geo, cantos, alcance }
const geosRocha = AFINA.map((afina, tipo) =>
  Array.from({ length: ROCHA.variantes }, (_, v) => geometriaDaRocha(afina, 1 + tipo * 10 + v)));
