// ---------------------------------------------------------------------
// Rochas low-poly: paredões quase verticais com colunas irregulares e topo
// plano de grama, como as mesas rochosas de Namek. Algumas ganham um segundo
// andar menor por cima. Também guarda o ruído 3D em GLSL usado pelas copas.
// ---------------------------------------------------------------------

// Valores ajustáveis.
const ROCHA = {
  ladosMin: 9,       // lados do contorno (sorteado entre mínimo e máximo)
  ladosMax: 14,
  fileiras: 5,       // fileiras de faces na parede, da base ao topo
  colunas: 0.07,     // quanto cada coluna vertical avança ou recua (fração do raio)
  aspereza: 0.035,   // desvio de cada vértice, para as faces ficarem tortas
  desnivel: 0.3,     // desvio da altura dos vértices internos (fração de uma fileira)
  ombro: 0.05,       // recuo da borda do topo (arredonda a quina)
  pe: 0.04,          // alargamento da base
  tons: 0.12,        // variação de tom entre faces
  baseEscura: 0.18,  // escurecimento junto ao chão
  variantes: 3,      // formas diferentes por afinamento
  andar: 0.35,       // chance de um segundo andar em cima
};
// afinamento do topo em relação à base: paredes quase verticais
const AFINA = [0.68, 0.76, 0.84, 0.92];

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

// Rocha unitária: base em y = 0, topo em y = 1, raio 1 na base e `afina` no
// topo. O contorno segue contorno(ângulo, ondas), a mesma função usada pela
// colisão, que assim acompanha a forma vista. Geometria não indexada: cada
// face tem normal e cor próprias (facetas). Grupo 0: parede; grupo 1: topo.
function geometriaDaRocha(afina, semente) {
  let s = semente * 7919 + 13;
  const acaso = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const L = ROCHA.ladosMin + Math.floor(acaso() * (ROCHA.ladosMax - ROCHA.ladosMin + 1));
  const R = ROCHA.fileiras;
  const ondas = [acaso() * 6.3, acaso() * 6.3, acaso() * 6.3];
  const angs = [], colunas = [];
  for (let c = 0; c < L; c++) {
    angs.push(((c + (acaso() - 0.5) * 0.5) / L) * Math.PI * 2);
    colunas.push((acaso() - 0.5) * 2);
  }
  // anéis de vértices, da base (r = 0) ao topo (r = R)
  const anel = [];
  for (let r = 0; r <= R; r++) {
    const pts = [];
    for (let c = 0; c < L; c++) {
      const meio = r > 0 && r < R;
      const t = r / R + (meio ? (acaso() - 0.5) * ROCHA.desnivel / R : 0);
      let f = contorno(angs[c], ondas) * (1 + (afina - 1) * t)
        * (1 + ROCHA.colunas * colunas[c] + ROCHA.aspereza * (acaso() - 0.5) * 2);
      if (r === R) f *= 1 - ROCHA.ombro;
      if (r === 0) f *= 1 + ROCHA.pe;
      pts.push(new THREE.Vector3(Math.cos(angs[c]) * f, t, Math.sin(angs[c]) * f));
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
  return { geo, ondas };
}
// geosRocha[tipo][variante] = { geo, ondas }
const geosRocha = AFINA.map((afina, tipo) =>
  Array.from({ length: ROCHA.variantes }, (_, v) => geometriaDaRocha(afina, 1 + tipo * 10 + v)));
