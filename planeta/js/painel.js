// ---------------------------------------------------------------------
// Radar: vista de cima. O jogador é o ponto amarelo central; o mapa gira junto,
// de modo que o topo do radar é sempre a direção do olhar.
// ---------------------------------------------------------------------
const radar = document.getElementById('radar');
const rctx = radar.getContext('2d');
const RADAR_ALCANCE = 700; // metros do centro até a borda
const RADAR_GRADE = 100; // cada quadrado = 100 m

function desenharRadar(tempo) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const lado = radar.clientWidth;
  if (radar.width !== Math.round(lado * dpr)) {
    radar.width = radar.height = Math.round(lado * dpr);
  }
  const R = lado / 2;
  const esc = R / RADAR_ALCANCE;
  const cx = camera.position.x, cz = camera.position.z;

  rctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // fundo verde
  const fundo = rctx.createRadialGradient(R, R, 0, R, R, R);
  fundo.addColorStop(0, '#37b04f');
  fundo.addColorStop(1, '#1d7a33');
  rctx.fillStyle = fundo;
  rctx.fillRect(0, 0, lado, lado);

  // a partir daqui, desenho em metros do mundo, já rotacionado
  rctx.save();
  rctx.translate(R, R);
  rctx.rotate(yaw);
  rctx.scale(esc, esc);
  rctx.translate(-cx, -cz);
  const px = 1 / esc; // 1 pixel de tela, em metros

  // quadriculado fixo no mundo (desliza sob o jogador)
  rctx.strokeStyle = 'rgba(10, 50, 20, 0.55)';
  rctx.lineWidth = px;
  rctx.beginPath();
  const A = RADAR_ALCANCE * 1.5;
  const x0 = Math.floor((cx - A) / RADAR_GRADE) * RADAR_GRADE;
  const z0 = Math.floor((cz - A) / RADAR_GRADE) * RADAR_GRADE;
  for (let x = x0; x <= cx + A; x += RADAR_GRADE) { rctx.moveTo(x, cz - A); rctx.lineTo(x, cz + A); }
  for (let z = z0; z <= cz + A; z += RADAR_GRADE) { rctx.moveTo(cx - A, z); rctx.lineTo(cx + A, z); }
  rctx.stroke();

  // ilhas
  for (const ilha of ilhas.values()) {
    if (!ilha) continue;
    const s = ilha.solidos[0];
    if (Math.hypot(s.x - cx, s.z - cz) > RADAR_ALCANCE * 1.5 + Math.max(s.rx, s.rz)) continue;
    rctx.beginPath();
    for (let k = 0; k <= 36; k++) {
      const a = (k / 36) * Math.PI * 2;
      const m = contorno(a, s.ondas);
      const x = s.x + Math.cos(a) * m * s.rx, z = s.z + Math.sin(a) * m * s.rz;
      k ? rctx.lineTo(x, z) : rctx.moveTo(x, z);
    }
    rctx.fillStyle = 'rgba(170, 235, 150, 0.45)';
    rctx.fill();
    rctx.strokeStyle = 'rgba(225, 255, 210, 0.95)';
    rctx.lineWidth = 1.5 * px;
    rctx.stroke();
    // rochas como manchas mais claras
    rctx.fillStyle = 'rgba(235, 255, 225, 0.6)';
    for (let n = 1; n < ilha.solidos.length; n++) {
      const r = ilha.solidos[n];
      rctx.beginPath();
      rctx.ellipse(r.x, r.z, r.rx, r.rz, -r.giro, 0, Math.PI * 2);
      rctx.fill();
    }
  }
  rctx.restore();

  // pontos cardeais em letras saiyajin, na borda interna (norte = -z)
  const tamL = Math.max(7, R * 0.085); // altura da letra, em pixels
  const uL = tamL / 10;                // a letra é desenhada numa grade 10×10
  const dL = R - tamL * 0.9 - 3;
  rctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  for (const [l, dx, dz] of [['N', 0, -1], ['E', 1, 0], ['S', 0, 1], ['W', -1, 0]]) {
    const ox = R + (dx * Math.cos(yaw) - dz * Math.sin(yaw)) * dL - tamL / 2;
    const oy = R + (dx * Math.sin(yaw) + dz * Math.cos(yaw)) * dL - tamL / 2;
    rctx.beginPath();
    for (const [x, y, w, h, r = 0.7] of LETRAS_SAIYAJIN[l]) rctx.roundRect(ox + x * uL, oy + y * uL, w * uL, h * uL, r * uL);
    rctx.fill();
  }

  // esferas: pontos laranja piscantes (as distantes ficam presas à borda)
  const pisca = 0.5 + 0.5 * Math.sin(tempo * 7);
  for (const e of esferas) {
    if (e.capturada) continue;
    const dx = e.pos.x - cx, dz = e.pos.z - cz;
    let ex = (dx * Math.cos(yaw) - dz * Math.sin(yaw)) * esc;
    let ey = (dx * Math.sin(yaw) + dz * Math.cos(yaw)) * esc;
    const longe = Math.hypot(ex, ey), maximo = R - 9;
    if (longe > maximo) { ex *= maximo / longe; ey *= maximo / longe; }
    rctx.shadowColor = '#ff8a1c';
    rctx.shadowBlur = 6 + pisca * 10;
    rctx.fillStyle = `rgba(255, 140, 30, ${0.45 + pisca * 0.55})`;
    rctx.beginPath();
    rctx.arc(R + ex, R + ey, 4, 0, Math.PI * 2);
    rctx.fill();
    rctx.shadowBlur = 0;

    // triângulo branco vazado junto à esfera, apontando para ela: quanto mais
    // perto, maior o triângulo
    const dist = Math.hypot(dx, dz);
    const perto = 1 - Math.min(1, Math.max(0, Math.log(dist / 150) / Math.log(5500 / 150)));
    const tam = 3.5 + 7.5 * perto;
    const len = Math.hypot(ex, ey);
    if (len > tam * 2 + 8) {
      const ux = ex / len, uy = ey / len; // do jogador à esfera
      const px = R + ex - ux * 7, py = R + ey - uy * 7; // ponta, logo antes do ponto da esfera
      const bx = px - ux * tam * 1.3, by = py - uy * tam * 1.3;
      const lx = -uy * tam * 0.75, ly = ux * tam * 0.75;
      rctx.strokeStyle = '#ffffff';
      rctx.lineWidth = 1.6;
      rctx.lineJoin = 'round';
      rctx.beginPath();
      rctx.moveTo(px, py);
      rctx.lineTo(bx + lx, by + ly);
      rctx.lineTo(bx - lx, by - ly);
      rctx.closePath();
      rctx.stroke();
    }
  }
  rctx.shadowBlur = 0;

  // jogador: ponto amarelo pulsante, com um leque indicando a direção do olhar
  rctx.fillStyle = 'rgba(255, 245, 160, 0.18)';
  rctx.beginPath();
  rctx.moveTo(R, R);
  rctx.arc(R, R, R * 0.45, -Math.PI / 2 - 0.45, -Math.PI / 2 + 0.45);
  rctx.closePath();
  rctx.fill();

  const pulso = 0.5 + 0.5 * Math.sin(tempo * 5);
  rctx.shadowColor = '#fff27a';
  rctx.shadowBlur = 8 + pulso * 8;
  rctx.fillStyle = '#ffe94a';
  rctx.beginPath();
  rctx.arc(R, R, 3.5 + pulso * 1.2, 0, Math.PI * 2);
  rctx.fill();
  rctx.shadowBlur = 0;
}

// ---------------------------------------------------------------------
// Linhas de velocidade: nas bordas da tela durante o dash, sorteadas a cada
// quadro (efeito de tremor).
// ---------------------------------------------------------------------
const riscos = document.getElementById('riscos');
const kctx = riscos.getContext('2d');
let forcaRiscos = 0;

function desenharRiscos(dt) {
  const veloz = (vel.length() - AJUSTE.velMax) / AJUSTE.velMax; // 0 = normal, 1 = dash máximo
  const alvo = segurando('dash') ? Math.max(0, Math.min(1, veloz * 1.3)) : 0;
  forcaRiscos = suavizar(forcaRiscos, alvo, alvo > forcaRiscos ? 6 : 4, dt);

  const W = window.innerWidth, H = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (riscos.width !== Math.round(W * dpr) || riscos.height !== Math.round(H * dpr)) {
    riscos.width = Math.round(W * dpr);
    riscos.height = Math.round(H * dpr);
  }
  kctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  kctx.clearRect(0, 0, W, H);
  if (forcaRiscos < 0.02) return;

  const cx = W / 2, cy = H / 2;
  const n = Math.round(45 * forcaRiscos);
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2;
    const c0 = Math.cos(a), s0 = Math.sin(a);
    // distância do centro até a borda da tela nesta direção
    const borda = Math.min(cx / Math.max(Math.abs(c0), 1e-6), cy / Math.max(Math.abs(s0), 1e-6));
    // avanço da linha sobre a tela: inteiro nas laterais, metade em cima e embaixo
    // (a área limpa central fica oval)
    const lateral = 1 - 0.5 * s0 * s0;
    const invade = borda * (0.15 + Math.random() * 0.3) * lateral;
    const r0 = borda - invade; // começa dentro da tela...
    const r1 = r0 + invade * (0.7 + Math.random() * 0.6); // ...e vai até a borda (ou quase)
    const larg = 1 + Math.random() * 2.4;
    const c = Math.cos(a), s = Math.sin(a);
    // triângulo fino: ponta para o centro, mais largo para fora
    kctx.fillStyle = `rgba(255, 255, 250, ${(0.55 + Math.random() * 0.4) * forcaRiscos})`;
    kctx.beginPath();
    kctx.moveTo(cx + c * r0, cy + s * r0);
    kctx.lineTo(cx + c * r1 - s * larg, cy + s * r1 + c * larg);
    kctx.lineTo(cx + c * r1 + s * larg, cy + s * r1 - c * larg);
    kctx.closePath();
    kctx.fill();
  }
}

// ---------------------------------------------------------------------
// Altura acima do mar, na escala sentida (17,5 unidades ≈ 1 m; calibrada pelos
// olhos rente à grama: 3,5 unidades ≈ 20 cm).
// ---------------------------------------------------------------------
const ESCALA_SENTIDA = 17.5;
const alturaNum = document.getElementById('alturaNum');
let alturaMostrada = '';
function mostrarAltura() {
  const h = camera.position.y / ESCALA_SENTIDA;
  const texto = h < 10 ? h.toFixed(1).replace('.', ',') : String(Math.round(h));
  if (texto !== alturaMostrada) { alturaNum.textContent = texto; alturaMostrada = texto; }
  mostrarVelocidade();
}

// Velocidade em km/h, na mesma escala (unidades/s ÷ 17,5 = m/s; × 3,6 = km/h).
const velNum = document.getElementById('velNum');
let velMostrada = '';
function mostrarVelocidade() {
  const kmh = vel.length() / ESCALA_SENTIDA * 3.6;
  const texto = String(Math.round(kmh));
  if (texto !== velMostrada) { velNum.textContent = texto; velMostrada = texto; }
}

// ondulação: a textura da água desliza devagar
function animarAgua(tempo) {
  texAgua.offset.set(tempo * 0.004, Math.sin(tempo * 0.3) * 0.01); // lago: deslocamento reduzido
  uniAgua.tempo.value = tempo;
}
