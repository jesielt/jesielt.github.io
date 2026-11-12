// ---------------------------------------------------------------------
// Fauna de Namek. Cada espécie é um molde com criar() e atualizar(); a ilha guarda
// os bichos dela (somem junto com a ilha). Todo bicho tem antenas (criarAntenas).
// Por enquanto nenhum entra na água.
// ---------------------------------------------------------------------
const _geoAntena = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1.4, 0.15),
  new THREE.Vector3(0.15, 2.6, 0.75), new THREE.Vector3(0.35, 3.3, 1.6),
]), 10, 0.1, 5);
const _geoPontaAntena = new THREE.SphereGeometry(0.26, 8, 6);
// duas antenas saindo de (x, y, z) espelhadas em x; devolve os "pivôs" pra balançar
function criarAntenas(dono, x, y, z, tam, mat) {
  return [-1, 1].map(lado => {
    const piv = new THREE.Group();
    piv.position.set(x * lado, y, z);
    const haste = new THREE.Mesh(_geoAntena, mat);
    haste.scale.set(tam * lado, tam, tam);
    const ponta = new THREE.Mesh(_geoPontaAntena, mat);
    ponta.position.set(0.35 * tam * lado, 3.3 * tam, 1.6 * tam);
    piv.add(haste, ponta);
    dono.add(piv);
    return piv;
  });
}
function balancarAntenas(antenas, t, fase, extra = 0) {
  antenas.forEach((piv, k) => {
    piv.rotation.x = Math.sin(t * 2.1 + fase + k * 1.3) * 0.12 + extra;
    piv.rotation.z = Math.sin(t * 1.6 + fase * 1.7 + k) * 0.08 * (k ? 1 : -1);
  });
}

// pele do sapo: verde-azulado com risquinhos escuros (feita na hora)
const matSapo = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#3aa596';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(20, 50, 45, 0.85)';
  g.lineCap = 'round';
  let semente = 7;
  const rnd = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 70; k++) {
    const x = rnd() * 128, y = rnd() * 128, a = -0.4 + rnd() * 0.8, l = 4 + rnd() * 8;
    g.lineWidth = 1.5 + rnd() * 1.5;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshLambertMaterial({ map: tex });
})();
const matSapoLiso = new THREE.MeshLambertMaterial({ color: '#3aa596' });
const matOlhoSapo = new THREE.MeshLambertMaterial({ color: '#d8261c', emissive: '#5a0a06' });
const matPupila = new THREE.MeshBasicMaterial({ color: '#111111' });
const matUnha = new THREE.MeshLambertMaterial({ color: '#efe6c8' });
const _geoBola = new THREE.SphereGeometry(1, 16, 12);
const _geoCrista = new THREE.ConeGeometry(1, 1, 10);

const FAUNA = {
  // Sapo: ~45 cm. Fica parado olhando em volta, dá pulinhos curtos e, se você chega
  // a ~2,5 m, foge pulando. Nunca vai pra beira nem pra cima de rocha.
  sapo: {
    chance: 0.55,          // chance de ter sapo numa ilha comum
    maxPorIlha: 3,
    tamanho: 1,            // escala do modelo (1 ≈ 45 cm de comprimento)
    medo: 44,              // ~2,5 m: chegou mais perto que isso, foge
    raio: 3.4,             // "tamanho" pra esbarrar (esfera e você), já na escala 1
    altura: 3.6,
    pulo: { dur: 0.42, altura: 5, perto: [8, 18], fuga: [16, 26] },
    atualizar: atualizarSapo,
    criar() {
      const g = new THREE.Group();
      const corpo = new THREE.Group(); // o que estica/achata no pulo
      g.add(corpo);
      const bola = (mat, sx, sy, sz, x, y, z) => {
        const m = new THREE.Mesh(_geoBola, mat);
        m.scale.set(sx, sy, sz);
        m.position.set(x, y, z);
        corpo.add(m);
        return m;
      };
      bola(matSapo, 2.4, 1.5, 3.3, 0, 1.6, 0.3);          // corpo
      bola(matSapo, 2.1, 1.25, 1.9, 0, 1.75, -2.4);      // cabeça
      bola(matSapoLiso, 1.7, 0.6, 1.5, 0, 1.1, -2.9);    // queixo
      const crista = new THREE.Mesh(_geoCrista, matSapo); // a "cauda" levantada atrás
      crista.scale.set(1.1, 3, 1.1);
      crista.position.set(0, 2.9, 3.1);
      crista.rotation.x = 1.0;
      corpo.add(crista);
      for (const lado of [-1, 1]) {
        bola(matOlhoSapo, 0.5, 0.5, 0.5, 1.35 * lado, 2.25, -3.05);
        const pup = bola(matPupila, 0.18, 0.32, 0.12, 1.55 * lado, 2.25, -3.4);
        pup.rotation.y = 0.4 * lado;
        bola(matSapo, 0.9, 1.0, 1.9, 2.25 * lado, 1.1, 1.2);    // coxa de trás
        bola(matSapo, 0.55, 0.35, 1.2, 2.5 * lado, 0.3, 2.4);   // pé de trás
        bola(matUnha, 0.18, 0.18, 0.45, 2.7 * lado, 0.25, 3.5); // unhinha
        bola(matSapo, 0.45, 1.0, 0.45, 1.75 * lado, 0.75, -2.0);// braço
        bola(matSapo, 0.6, 0.25, 0.7, 1.9 * lado, 0.2, -2.5);   // mão
      }
      const antenas = criarAntenas(corpo, 0.55, 2.8, -2.5, 1, matSapo);
      return { g, corpo, antenas };
    },
  },
};

// coloca os bichos de uma ilha (sempre os mesmos pra mesma ilha)
function criarFaunaDaIlha(i, j, ilha) {
  const bichos = [];
  for (const [nome, esp] of Object.entries(FAUNA)) {
    const sem = 30000 + nome.length * 977;
    if (hash(i, j, sem) > (ilha.enorme ? 0.9 : esp.chance) || ilha.tam < 30) continue;
    const max = ilha.enorme ? esp.maxPorIlha * 2 : esp.maxPorIlha;
    const n = 1 + Math.floor(hash(i, j, sem + 1) * max);
    for (let k = 0; k < n; k++) {
      let lugar = null;
      for (let tent = 0; tent < 8 && !lugar; tent++) {
        const a = hash(i, j, sem + 10 + k * 20 + tent) * Math.PI * 2;
        const d = Math.sqrt(hash(i, j, sem + 11 + k * 20 + tent)) * 0.75;
        const px = Math.cos(a) * d * contorno(a, ilha.ondas) * ilha.sx;
        const pz = Math.sin(a) * d * contorno(a, ilha.ondas) * ilha.sz;
        if (lugarBomPraBicho(ilha, px, pz)) lugar = { px, pz };
      }
      if (!lugar) continue;
      const m = esp.criar();
      m.g.scale.setScalar(esp.tamanho * (0.85 + hash(i, j, sem + 15 + k * 20) * 0.3));
      m.g.position.set(lugar.px, ilha.alt, lugar.pz);
      m.g.rotation.y = hash(i, j, sem + 16 + k * 20) * Math.PI * 2;
      ilha.grupo.add(m.g);
      bichos.push({
        esp, ...m, ilha,
        estado: 'parado', espera: 0.5 + Math.random() * 3, fase: Math.random() * 10,
        de: new THREE.Vector3(), para: new THREE.Vector3(), t: 0, fugindo: 0,
      });
    }
  }
  return bichos;
}

// ponto da ilha (coordenadas da ilha) onde um bicho pode ficar: no chão,
// longe da beira (água) e fora de rocha e de tronco
function lugarBomPraBicho(ilha, px, pz) {
  const r = Math.hypot(px / ilha.sx, pz / ilha.sz);
  const a = Math.atan2(pz / ilha.sz, px / ilha.sx);
  if (r > contorno(a, ilha.ondas) * 0.85 - 12 / Math.min(ilha.sx, ilha.sz)) return false;
  if (encostaEmRocha(ilha.x + px, ilha.z + pz, 6, ilha.solidos)) return false;
  for (const c of ilha.copas) {
    if (c.chao > ilha.alt + 1) continue; // árvore de cima de rocha
    if (Math.hypot(ilha.x + px - c.x, ilha.z + pz - c.z) < c.grossura + 4) return false;
  }
  return true;
}

// levou uma bolada ou um esbarrão: foge na hora
function assustar(b) {
  b.fugindo = 2.5;
  if (b.estado === 'parado') b.espera = 0;
}
// andando, você não atravessa os bichos (empurra você pra fora)
function esbarrarNaFauna() {
  const p = camera.position;
  for (const ilha of ilhasPerto()) {
    for (const b of ilha.fauna || []) {
      const sc = b.g.scale.x;
      if (pesY > b.g.position.y + b.esp.altura * sc || pesY + olhosAgora < b.g.position.y) continue;
      const bx = ilha.x + b.g.position.x, bz = ilha.z + b.g.position.z;
      const dx = p.x - bx, dz = p.z - bz;
      const d = Math.hypot(dx, dz), min = b.esp.raio * sc + ANDAR.raioPe;
      if (d >= min) continue;
      const nx = dx / (d || 1), nz = dz / (d || 1);
      p.x = bx + nx * min;
      p.z = bz + nz * min;
      const contra = vel.x * nx + vel.z * nz;
      if (contra < 0) { vel.x -= contra * nx; vel.z -= contra * nz; }
      assustar(b);
    }
  }
}

const _faunaVoce = new THREE.Vector3();
function atualizarFauna(dt, t) {
  for (const ilha of ilhasPerto()) {
    if (!ilha.fauna || !ilha.fauna.length) continue;
    // você, nas coordenadas da ilha (andando conta os pés; voando, os olhos)
    _faunaVoce.set(camera.position.x - ilha.x, modo === 'voo' ? camera.position.y : pesY, camera.position.z - ilha.z);
    for (const b of ilha.fauna) b.esp.atualizar(b, dt, t, b.ilha); // b.ilha: os dados da ilha (tamanho, contorno...)
  }
}

function atualizarSapo(b, dt, t, ilha) {
  const esp = b.esp, g = b.g;
  const dx = g.position.x - _faunaVoce.x, dz = g.position.z - _faunaVoce.z;
  const dist = Math.hypot(dx, dz);
  const perto = dist < esp.medo && Math.abs(_faunaVoce.y - ilha.alt) < 60;
  if (perto) b.fugindo = 2.5; // continua fugindo um pouco depois que você some
  else b.fugindo = Math.max(0, b.fugindo - dt);

  if (b.estado === 'parado') {
    b.espera -= b.fugindo > 0 ? dt * 6 : dt;
    // respiração
    b.corpo.scale.set(1, 1 + Math.sin(t * 3 + b.fase) * 0.03, 1);
    b.corpo.position.y = 0;
    if (b.espera <= 0) {
      // escolhe pra onde pular: fugindo, pra longe de você; senão, pra perto
      const [min, max] = b.fugindo > 0 ? esp.pulo.fuga : esp.pulo.perto;
      let achou = false;
      for (let tent = 0; tent < 8 && !achou; tent++) {
        const base = b.fugindo > 0 ? Math.atan2(dz, dx) : Math.random() * Math.PI * 2;
        const a = base + (Math.random() - 0.5) * (b.fugindo > 0 ? 1.2 + tent * 0.5 : 2);
        const l = (min + Math.random() * (max - min)) * g.scale.x;
        const nx = g.position.x + Math.cos(a) * l, nz = g.position.z + Math.sin(a) * l;
        if (!lugarBomPraBicho(ilha, nx, nz)) continue;
        b.de.copy(g.position);
        b.para.set(nx, ilha.alt, nz);
        b.estado = 'pulando';
        b.t = 0;
        achou = true;
      }
      b.espera = b.fugindo > 0 ? 0.1 + Math.random() * 0.25 : 1.2 + Math.random() * 4;
      if (!achou && Math.random() < 0.5) b.alvoGiro = g.rotation.y + (Math.random() - 0.5) * 2; // só vira
    }
    if (b.alvoGiro !== undefined) {
      g.rotation.y = suavizar(g.rotation.y, b.alvoGiro, 4, dt);
      if (Math.abs(g.rotation.y - b.alvoGiro) < 0.01) b.alvoGiro = undefined;
    }
  } else { // pulando
    const dur = esp.pulo.dur * (b.fugindo > 0 ? 0.85 : 1);
    b.t += dt / dur;
    const k = Math.min(1, b.t);
    // vira pra onde vai (o modelo olha pra -z)
    const ax = b.para.x - b.de.x, az = b.para.z - b.de.z;
    const alvo = Math.atan2(-ax, -az);
    let dif = alvo - g.rotation.y;
    dif = Math.atan2(Math.sin(dif), Math.cos(dif));
    g.rotation.y += dif * Math.min(1, dt * 18);
    g.position.x = b.de.x + ax * k;
    g.position.z = b.de.z + az * k;
    g.position.y = ilha.alt + Math.sin(k * Math.PI) * esp.pulo.altura * g.scale.x;
    // estica no ar, achata na chegada
    const est = Math.sin(k * Math.PI);
    b.corpo.scale.set(1 - est * 0.08, 1 + est * 0.12, 1 + est * 0.15);
    if (k >= 1) {
      b.estado = 'parado';
      g.position.y = ilha.alt;
      b.corpo.scale.set(1.08, 0.85, 1);
    }
  }
  // antenas: balanço calmo; no pulo jogam pra trás
  balancarAntenas(b.antenas, t, b.fase, b.estado === 'pulando' ? 0.35 : 0);
}
