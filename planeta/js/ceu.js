// ---------------------------------------------------------------------
// Céu: uma esfera gigante em volta da câmera, pintada por dentro
// ---------------------------------------------------------------------
// O degradê do céu fica numa função só, porque a água usa a mesma pra
// refletir o céu. h = quanto a direção aponta pra cima (0 = horizonte, 1 = zênite)
// escuro: 0 = céu normal, 1 = céu escuro de quando junta as 7 esferas
const uniEscuro = { value: 0 };
// alto: 0 = até 200 m; vai a 1 em 500 m (espaço). O céu fica rarefeito e depois preto
const uniAlto = { value: 0 };
const CEU_GLSL = `
  uniform float escuro;
  uniform float alto;
  vec3 corDoCeu(float h) {
    // de baixo pra cima: verde-amarelado claro -> verde-amarelado -> verde
    vec3 claro   = vec3(0.859, 0.906, 0.675); // = CORES.horizonte (#dbe7ac)
    vec3 amarelo = vec3(0.800, 0.878, 0.553);
    vec3 verdeCl = vec3(0.624, 0.824, 0.478);
    vec3 verde   = vec3(0.310, 0.702, 0.322);
    vec3 c = claro;
    c = mix(c, amarelo, smoothstep(0.00, 0.08, h));
    c = mix(c, verdeCl, smoothstep(0.08, 0.30, h));
    c = mix(c, verde,   smoothstep(0.30, 0.75, h));
    // céu escuro: verde-azulado fundo, quase noite, mais claro no horizonte
    vec3 e = mix(vec3(0.12, 0.32, 0.25), vec3(0.06, 0.21, 0.18), smoothstep(0.0, 0.25, h));
    e = mix(e, vec3(0.02, 0.10, 0.10), smoothstep(0.25, 0.85, h));
    c = mix(c, e, escuro);
    // subindo: primeiro o ar fica rarefeito (azul-esverdeado fundo, apagado),
    // depois vira espaço (quase preto, um fio azul no horizonte)
    vec3 rarefeito = mix(vec3(0.28, 0.52, 0.55), vec3(0.08, 0.20, 0.30), smoothstep(0.0, 0.6, h));
    vec3 espaco = mix(vec3(0.05, 0.10, 0.18), vec3(0.005, 0.008, 0.02), smoothstep(0.0, 0.35, h));
    c = mix(c, rarefeito, smoothstep(0.0, 0.55, alto));
    c = mix(c, espaco, smoothstep(0.45, 1.0, alto));
    return c;
  }
`;
const ceu = new THREE.Mesh(
  new THREE.SphereGeometry(5000, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    uniforms: { escuro: uniEscuro, alto: uniAlto },
    fragmentShader: CEU_GLSL + `
      varying vec3 vDir;
      void main() {
        vec3 c = corDoCeu(vDir.y);
        gl_FragColor = vec4(c, 1.0);
      }`,
  })
);
ceu.renderOrder = -1;
cena.add(ceu);

// ---------------------------------------------------------------------
// Satélites: um planeta listrado e uma lua clara. Andam junto com você,
// então nunca chegam mais perto (como a lua de verdade).
// ---------------------------------------------------------------------
function texturaDoSatelite(listras) {
  const t = 256, c = document.createElement('canvas');
  c.width = c.height = t;
  const g = c.getContext('2d');
  const m = t / 2, r = t * 0.46;
  g.save();
  g.beginPath(); g.arc(m, m, r, 0, Math.PI * 2); g.clip();
  const base = g.createRadialGradient(m - r * 0.3, m - r * 0.3, r * 0.1, m, m, r);
  base.addColorStop(0, '#fbf1cf');
  base.addColorStop(1, '#ecd9a6');
  g.fillStyle = base;
  g.fillRect(0, 0, t, t);
  if (listras) {
    // faixas onduladas, como num planeta gasoso pintado à mão
    let s = 5;
    const aleatorio = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 16; k++) {
      const y0 = m - r + aleatorio() * r * 2;
      const amp = 2 + aleatorio() * 6, freq = 0.02 + aleatorio() * 0.03, fase = aleatorio() * 6;
      g.strokeStyle = `rgba(224, 150, 80, ${0.25 + aleatorio() * 0.35})`;
      g.lineWidth = 1.5 + aleatorio() * 4;
      g.beginPath();
      for (let x = m - r; x <= m + r; x += 4) {
        const y = y0 + Math.sin(x * freq + fase) * amp;
        x === m - r ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.stroke();
    }
  }
  // sombra suave do lado oposto à luz
  const sombra = g.createRadialGradient(m - r * 0.35, m - r * 0.35, r * 0.6, m, m, r * 1.05);
  sombra.addColorStop(0, 'rgba(180, 140, 120, 0)');
  sombra.addColorStop(1, 'rgba(180, 140, 120, 0.35)');
  g.fillStyle = sombra;
  g.fillRect(0, 0, t, t);
  // atmosfera: um véu da cor do céu por cima tira a nitidez...
  g.fillStyle = 'rgba(205, 232, 170, 0.38)';
  g.fillRect(0, 0, t, t);
  g.restore();
  // ...e a borda some aos poucos, em vez de terminar num corte seco
  g.globalCompositeOperation = 'destination-in';
  const borda = g.createRadialGradient(m, m, r * 0.78, m, m, r);
  borda.addColorStop(0, 'rgba(0,0,0,1)');
  borda.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = borda;
  g.fillRect(0, 0, t, t);
  g.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const DIST_CEU = 3000;
function criarSatelite(listras, azimute, elevacao, graus) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texturaDoSatelite(listras), fog: false, depthWrite: false, transparent: true, opacity: 0.82,
  }));
  const tam = 2 * DIST_CEU * Math.tan((graus * Math.PI / 180) / 2);
  sprite.scale.set(tam, tam, 1);
  // direção no céu (azimute = pra que lado, elevação = quão alto)
  const dir = new THREE.Vector3(
    Math.sin(azimute) * Math.cos(elevacao), Math.sin(elevacao), -Math.cos(azimute) * Math.cos(elevacao)
  ).multiplyScalar(DIST_CEU);
  cena.add(sprite);
  return { sprite, dir };
}
const satelites = [
  criarSatelite(true, 0.5, 0.42, 9),    // o planetão listrado
];

// ---------------------------------------------------------------------
// Nuvens: cada uma é um monte de sprites redondos; embaixo, sprites largos e
// achatados fazem a base reta. Quadriculado próprio (como as ilhas); o vento
// leva todas juntas. Dá pra atravessar.
// ---------------------------------------------------------------------
const NUVEM = {
  alturaMin: 650, // base da nuvem mais baixa (~37 m)
  alturaMax: 850,
  celula: 900,      // uma chance de nuvem a cada 900 x 900
  chance: 0.45,
  opacidade: 0.6,   // rala: dá pra ver o céu através
  vento: new THREE.Vector3(4, 0, 1.5), // unidades por segundo
};
function texturaDaBolota() {
  const t = 128, c = document.createElement('canvas');
  c.width = c.height = t;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(t / 2, t / 2, 0, t / 2, t / 2, t / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.75)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, t, t);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const texBolota = texturaDaBolota();
const matNuvemTopo = new THREE.SpriteMaterial({
  map: texBolota, color: '#fbfff2', transparent: true, depthWrite: false, opacity: NUVEM.opacidade,
});
const matNuvemBase = new THREE.SpriteMaterial({
  map: texBolota, color: '#d3ebcf', transparent: true, depthWrite: false, opacity: NUVEM.opacidade,
});
const ceuDasNuvens = new THREE.Group(); // anda com o vento
cena.add(ceuDasNuvens);
const nuvens = new Map(); // "i,j" -> grupo ou null
const ALCANCE_NUVEM = Math.ceil(AJUSTE.neblinaLonge / NUVEM.celula);
let celulaNuvemAtual = '';

function criarNuvem(i, j) {
  if (hash(i, j, 900) > NUVEM.chance) return null;
  const grupo = new THREE.Group();
  const cx = (i + 0.2 + hash(i, j, 901) * 0.6) * NUVEM.celula;
  const cz = (j + 0.2 + hash(i, j, 902) * 0.6) * NUVEM.celula;
  const base = NUVEM.alturaMin + hash(i, j, 903) * (NUVEM.alturaMax - NUVEM.alturaMin);
  grupo.position.set(cx, base, cz);
  grupo.rotation.y = hash(i, j, 904) * Math.PI;
  const rx = 160 + hash(i, j, 905) * 220;   // comprimento
  const rz = rx * (0.35 + hash(i, j, 906) * 0.3);
  const alto = 70 + hash(i, j, 907) * 90;   // o quanto ela estufa pra cima no meio
  // bolotas de cima: mais altas e maiores no meio
  const n = 8 + Math.floor(hash(i, j, 908) * 9);
  for (let k = 0; k < n; k++) {
    const a = hash(i, j, 910 + k) * Math.PI * 2;
    const d = Math.sqrt(hash(i, j, 930 + k)) * 0.85;
    const meio = 1 - d * d;
    const r = (45 + hash(i, j, 950 + k) * 50) * (0.6 + meio * 0.6);
    const b = new THREE.Sprite(matNuvemTopo);
    b.position.set(Math.cos(a) * d * rx, r * 0.45 + meio * alto * hash(i, j, 970 + k), Math.sin(a) * d * rz);
    b.scale.set(r * 2.4, r * 2, 1);
    grupo.add(b);
  }
  // base: bolotas largas e baixinhas, um pouco mais escuras (sombra de baixo)
  const nb = 3 + Math.floor(hash(i, j, 990) * 3);
  for (let k = 0; k < nb; k++) {
    const t = nb === 1 ? 0 : k / (nb - 1) - 0.5;
    const b = new THREE.Sprite(matNuvemBase);
    b.position.set(t * rx * 1.3, 0, (hash(i, j, 991 + k) - 0.5) * rz * 0.6);
    const largura = rx * (1.1 - Math.abs(t));
    b.scale.set(largura, largura * 0.22, 1);
    b.renderOrder = -0.5; // a base fica atrás das bolotas de cima
    grupo.add(b);
  }
  ceuDasNuvens.add(grupo);
  return grupo;
}

function atualizarNuvens(dt) {
  ceuDasNuvens.position.addScaledVector(NUVEM.vento, dt);
  // posição de quem joga "dentro" do céu que está andando
  const px = camera.position.x - ceuDasNuvens.position.x;
  const pz = camera.position.z - ceuDasNuvens.position.z;
  const ci = Math.floor(px / NUVEM.celula), cj = Math.floor(pz / NUVEM.celula);
  const chave = ci + ',' + cj;
  if (chave === celulaNuvemAtual) return;
  celulaNuvemAtual = chave;
  const precisa = new Set();
  for (let di = -ALCANCE_NUVEM; di <= ALCANCE_NUVEM; di++) {
    for (let dj = -ALCANCE_NUVEM; dj <= ALCANCE_NUVEM; dj++) {
      if (di * di + dj * dj > ALCANCE_NUVEM * ALCANCE_NUVEM) continue;
      const k = (ci + di) + ',' + (cj + dj);
      precisa.add(k);
      if (!nuvens.has(k)) nuvens.set(k, criarNuvem(ci + di, cj + dj));
    }
  }
  for (const [k, grupo] of nuvens) {
    if (precisa.has(k)) continue;
    if (grupo) ceuDasNuvens.remove(grupo);
    nuvens.delete(k);
  }
}
