// ---------------------------------------------------------------------
// Radar: o mundo visto de cima. Você é o pontinho amarelo no meio,
// e o mapa gira junto, então "pra cima" no radar é sempre pra onde você olha.
// ---------------------------------------------------------------------
const radar = document.getElementById('radar');
const rctx = radar.getContext('2d');
const RADAR_ALCANCE = 700; // metros do centro até a borda do radar
const RADAR_GRADE = 100;   // cada quadradinho = 100 m

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
  // tela verde
  const fundo = rctx.createRadialGradient(R, R, 0, R, R, R);
  fundo.addColorStop(0, '#37b04f');
  fundo.addColorStop(1, '#1d7a33');
  rctx.fillStyle = fundo;
  rctx.fillRect(0, 0, lado, lado);

  // daqui pra frente desenha em metros do mundo, já girado
  rctx.save();
  rctx.translate(R, R);
  rctx.rotate(yaw);
  rctx.scale(esc, esc);
  rctx.translate(-cx, -cz);
  const px = 1 / esc; // 1 pixel de tela, medido em metros

  // quadriculado preso ao mundo (ele passa por baixo de você quando voa)
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
    // rochas como manchinhas mais claras
    rctx.fillStyle = 'rgba(235, 255, 225, 0.6)';
    for (let n = 1; n < ilha.solidos.length; n++) {
      const r = ilha.solidos[n];
      rctx.beginPath();
      rctx.ellipse(r.x, r.z, r.rx, r.rz, -r.giro, 0, Math.PI * 2);
      rctx.fill();
    }
  }
  rctx.restore();

  // esferas: pontos laranja piscando (as longe ficam grudadas na borda do radar)
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

    // triângulo vazado branco colado na esfera, apontando
    // pra ela: quanto mais perto ela está, maior o triângulo
    const dist = Math.hypot(dx, dz);
    const perto = 1 - Math.min(1, Math.max(0, Math.log(dist / 150) / Math.log(5500 / 150)));
    const tam = 3.5 + 7.5 * perto;
    const len = Math.hypot(ex, ey);
    if (len > tam * 2 + 8) {
      const ux = ex / len, uy = ey / len;              // de você pra esfera
      const px = R + ex - ux * 7, py = R + ey - uy * 7; // ponta, logo antes da bolinha
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

  // você: um pontinho amarelo pulsando, com um leque mostrando pra onde olha
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
// Risquinhos de velocidade (estilo anime): aparecem nas bordas da tela
// durante o dash, e são sorteados de novo a cada quadro pra "tremer".
// ---------------------------------------------------------------------
const riscos = document.getElementById('riscos');
const kctx = riscos.getContext('2d');
let forcaRiscos = 0;

function desenharRiscos(dt) {
  const veloz = (vel.length() - AJUSTE.velMax) / AJUSTE.velMax; // 0 = normal, 1 = dash cheio
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
    // distância do centro até a borda da tela nessa direção
    const borda = Math.min(cx / Math.max(Math.abs(c0), 1e-6), cy / Math.max(Math.abs(s0), 1e-6));
    // quanto o risco "invade" a tela: nos lados, cheio; em cima e embaixo, metade
    // (assim o meio limpo fica oval, não um retângulo tipo mini tela)
    const lateral = 1 - 0.5 * s0 * s0;
    const invade = borda * (0.15 + Math.random() * 0.3) * lateral;
    const r0 = borda - invade;                               // começa dentro da tela...
    const r1 = r0 + invade * (0.7 + Math.random() * 0.6);    // ...e vai até a borda (ou quase)
    const larg = 1 + Math.random() * 2.4;
    const c = Math.cos(a), s = Math.sin(a);
    // um triângulo bem fino: ponta pro centro, mais largo pra fora
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
// Altura acima do mar, já convertida pra escala que você sente
// (17,5 unidades aqui dentro ≈ 1 metro na sensação: com os olhos rente
// à grama, a 3,5 unidades, a sensação é de uns 20 cm)
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

// Velocidade em km/h, na mesma régua (unidades/s ÷ 17,5 = m/s; × 3,6 = km/h)
const velNum = document.getElementById('velNum');
let velMostrada = '';
function mostrarVelocidade() {
  const kmh = vel.length() / ESCALA_SENTIDA * 3.6;
  const texto = String(Math.round(kmh));
  if (texto !== velMostrada) { velNum.textContent = texto; velMostrada = texto; }
}

// ondinhas: a textura da água desliza devagar
function animarAgua(tempo) {
  texAgua.offset.set(tempo * 0.004, Math.sin(tempo * 0.3) * 0.01); // lago: desliza bem menos
  uniAgua.tempo.value = tempo;
}
