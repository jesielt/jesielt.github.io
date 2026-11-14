// ---------------------------------------------------------------------
// Sons, todos gerados em tempo real (sem arquivo de áudio): vento, espuma do voo
// rente à água, passos e impacto com as esferas.
// Vento: ruído rosa filtrado. Parado, sopro baixo; cresce com a velocidade e no
// dash. Rajadas lentas e aleatórias evitam som estático. Abafado debaixo d'água;
// ausente no espaço.
// O navegador só libera áudio após o primeiro clique, tecla ou toque.
// ---------------------------------------------------------------------
const SOM = {
  volParado: 0.06, // volume parado
  volMax: 0.38, // volume na velocidade máxima normal
  volDash: 0.55, // volume no dash máximo
  filtroParado: 300, // Hz: parado, grave e suave...
  filtroMax: 850, // ...em velocidade, abre um pouco (sem ficar agudo)
  filtroDash: 1300,
  rajada: 0.35, // efeito das rajadas no volume (0 = nenhum)
  passo: 0.3, // volume do passo
  vidro: 0.09, // volume do impacto com a esfera
  espuma: 0.52, // volume do chiado da espuma (voo rente à água)
  ventoSobEspuma: 0.8, // quanto o vento abaixa com a espuma no máximo (0 = nada, 1 = some)
  ventoVoltaDe: 1, // m: acima desta altura, com espuma, o vento volta aos poucos até o topo da espuma (1,5 m)
};
let vento = null;
function criarVento() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  // ruído rosa (filtro de Paul Kellet), trecho de 6 s em laço; um por canal,
  // para dar largura estéreo
  function ruidoRosa(seg) {
    const n = Math.floor(ctx.sampleRate * seg);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    // emenda fim e começo sem estalo
    const f = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < f; i++) { const t = i / f; d[n - f + i] = d[n - f + i] * (1 - t) + d[i] * t; }
    return buf;
  }
  // dois passa-baixas em série: corte forte do agudo
  const filtro = ctx.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.Q.value = 0.5;
  const filtro2 = ctx.createBiquadFilter();
  filtro2.type = 'lowpass';
  filtro2.Q.value = 0.5;
  const ressoa = ctx.createBiquadFilter(); // ressonância leve que sobe com a velocidade
  ressoa.type = 'peaking';
  ressoa.Q.value = 0.9;
  ressoa.gain.value = 3;
  const corpo = ctx.createBiquadFilter(); // reforço de graves
  corpo.type = 'lowshelf';
  corpo.frequency.value = 180;
  corpo.gain.value = 5;
  const volume = ctx.createGain();
  volume.gain.value = 0;
  filtro.connect(filtro2).connect(ressoa).connect(corpo).connect(volume).connect(ctx.destination);
  // passos têm volume próprio (o do vento varia com a velocidade)
  const passos = ctx.createGain();
  passos.gain.value = 1;
  passos.connect(ctx.destination);
  // ruído curto para o estalo do passo
  const nClac = Math.floor(ctx.sampleRate * 0.06);
  const ruidoCurto = ctx.createBuffer(1, nClac, ctx.sampleRate);
  const dc = ruidoCurto.getChannelData(0);
  for (let i = 0; i < nClac; i++) dc[i] = Math.random() * 2 - 1;
  const lados = [-0.7, 0.7].map(lado => {
    const fonte = ctx.createBufferSource();
    fonte.buffer = ruidoRosa(6 + lado); // durações diferentes: não se repetem em sincronia
    fonte.loop = true;
    const pan = ctx.createStereoPanner();
    pan.pan.value = lado;
    const g = ctx.createGain();
    fonte.connect(g).connect(pan).connect(filtro);
    fonte.start();
    return g;
  });
  // Espuma (voo rente à água): lavada contínua e grave, "chuaaa", em três
  // camadas: sopro de ruído marrom e chiado de ruído rosa, ambos em passa-baixas,
  // e hiss (só os agudos do ruído rosa). Cada lado tem ruído próprio (estéreo
  // descorrelacionado). Ondulação e varrido: ver atualizarEspuma.
  function ruidoMarrom(seg) {
    const n = Math.floor(ctx.sampleRate * seg);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let ult = 0;
    for (let i = 0; i < n; i++) { ult = (ult + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = ult * 3.5; }
    const f = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < f; i++) { const t = i / f; d[n - f + i] = d[n - f + i] * (1 - t) + d[i] * t; }
    return buf;
  }
  const espuma = ctx.createGain(); // volume geral da espuma
  espuma.gain.value = 0;
  espuma.connect(ctx.destination);
  const passaGrave = ctx.createBiquadFilter();
  passaGrave.type = 'lowpass';
  passaGrave.frequency.value = 500;
  passaGrave.Q.value = 0.7;
  const sopro = ctx.createGain();
  sopro.gain.value = 0.9;
  passaGrave.connect(sopro).connect(espuma);
  const passaChiado = ctx.createBiquadFilter();
  passaChiado.type = 'lowpass';
  passaChiado.frequency.value = 1500;
  passaChiado.Q.value = 0.5;
  const chiado = ctx.createGain();
  chiado.gain.value = ESPUMA.chiado;
  passaChiado.connect(chiado).connect(espuma);
  // hiss: só os agudos do ruído rosa (o "sss" da água borrifada)
  const passaHiss = ctx.createBiquadFilter();
  passaHiss.type = 'highpass';
  passaHiss.frequency.value = 3500;
  passaHiss.Q.value = 0.5;
  const hiss = ctx.createGain();
  hiss.gain.value = ESPUMA.hiss; // já no volume certo: sem subida gradual no início
  passaHiss.connect(hiss).connect(espuma);
  for (const lado of [-1, 1]) {
    for (const [buf, destino] of [[ruidoMarrom(5 + lado * 0.7), passaGrave], [ruidoRosa(4.6 + lado * 0.3), passaChiado], [ruidoRosa(3.7 - lado * 0.4), passaHiss]]) {
      const fonte = ctx.createBufferSource();
      fonte.buffer = buf;
      fonte.loop = true;
      const pan = ctx.createStereoPanner();
      pan.pan.value = lado * 0.6;
      fonte.connect(pan).connect(destino);
      fonte.start();
    }
  }
  return {
    ctx, passos, ruidoCurto, filtro, filtro2, ressoa, volume, lados, rajada: [1, 1], alvoRajada: [1, 1], troca: [0, 0],
    espuma, passaGrave, sopro, passaChiado, chiado, hiss,
    esp: { troca: 0, onda: 0.5, forcaAntes: 0, varrido: 0, ultimoVarrido: -9 },
  };
}
// M liga/desliga o som (preferência salva)
let mudo = false;
try { mudo = localStorage.getItem('planeta.mudo') === '1'; } catch (erro) { /* ignorado */ }
// toca só com a janela em foco, visível e sem mudo; caso contrário, pausa
function aplicarSom() {
  if (!vento) return;
  const tocar = !mudo && !document.hidden && document.hasFocus();
  if (tocar && vento.ctx.state !== 'running') vento.ctx.resume();
  if (!tocar && vento.ctx.state === 'running') vento.ctx.suspend();
}
function ligarSom() {
  if (!vento) vento = criarVento();
  aplicarSom();
}
function alternarMudo() {
  mudo = !mudo;
  try { localStorage.setItem('planeta.mudo', mudo ? '1' : '0'); } catch (erro) { /* ignorado */ }
  document.querySelectorAll('[data-tecla="KeyM"]').forEach(el => el.classList.toggle('ligado', mudo));
  aplicarSom();
}
document.querySelectorAll('[data-tecla="KeyM"]').forEach(el => el.classList.toggle('ligado', mudo));
['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, ligarSom, { passive: true }));
window.addEventListener('blur', aplicarSom);
window.addEventListener('focus', aplicarSom);
document.addEventListener('visibilitychange', aplicarSom);

// Passo em 3 camadas: impacto grave, estalo metálico e, ~80 ms depois, rangido de
// motor. lado: 0/1 = pé esquerdo/direito (tom levemente diferente). pesado: pouso
// (mais grave e mais alto).
function tocarPasso(correndo = false, lado = 0, pesado = false) {
  if (!vento || vento.ctx.state !== 'running') return;
  const ctx = vento.ctx, t = ctx.currentTime;
  const vol = SOM.passo * (correndo ? 1.2 : 1) * (pesado ? 1.5 : 1);
  const tom = (lado ? 1.06 : 1) * (pesado ? 0.8 : 1) * (0.97 + Math.random() * 0.06);
  // 1. impacto: tom grave descendente + ruído filtrado (sem o ruído, soa como bipe)
  const tum = ctx.createOscillator();
  tum.type = 'sine';
  tum.frequency.setValueAtTime(90 * tom, t);
  tum.frequency.exponentialRampToValueAtTime(38 * tom, t + 0.16);
  const g0 = ctx.createGain();
  g0.gain.setValueAtTime(0.0001, t);
  g0.gain.linearRampToValueAtTime(vol * 2, t + 0.006);
  g0.gain.exponentialRampToValueAtTime(0.0001, t + (pesado ? 0.32 : 0.24));
  tum.connect(g0).connect(vento.passos);
  tum.start(t);
  tum.stop(t + 0.35);
  const baque = ctx.createBufferSource();
  baque.buffer = vento.ruidoCurto;
  baque.playbackRate.value = 0.5; // reprodução a meia velocidade: dobra a duração
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 260 * tom;
  lp.Q.value = 0.9;
  const gb = ctx.createGain();
  gb.gain.setValueAtTime(vol * 2.4, t);
  gb.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
  baque.connect(lp).connect(gb).connect(vento.passos);
  baque.start(t);
  // 2. estalo metálico: ruído em banda estreita + tom triangular curto
  const ruido = ctx.createBufferSource();
  ruido.buffer = vento.ruidoCurto;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 950 * tom;
  bp.Q.value = 2;
  const g1 = ctx.createGain();
  g1.gain.setValueAtTime(vol * 1.1, t);
  g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  ruido.connect(bp).connect(g1).connect(vento.passos);
  ruido.start(t);
  const ping = ctx.createOscillator();
  ping.type = 'triangle';
  ping.frequency.value = 520 * tom;
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(vol * 0.45, t);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  ping.connect(g2).connect(vento.passos);
  ping.start(t);
  ping.stop(t + 0.08);
  // 3. rangido de motor: dente de serra descendente, com vibrato de 30 Hz
  const t2 = t + (correndo ? 0.055 : 0.08);
  const dur = correndo ? 0.11 : 0.15;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(270 * tom, t2);
  osc.frequency.exponentialRampToValueAtTime(175 * tom, t2 + dur);
  const vib = ctx.createOscillator();
  vib.frequency.value = 30;
  const vg = ctx.createGain();
  vg.gain.value = 14 * tom;
  vib.connect(vg).connect(osc.frequency);
  const bp2 = ctx.createBiquadFilter();
  bp2.type = 'bandpass';
  bp2.frequency.value = 620 * tom;
  bp2.Q.value = 2.5;
  const g3 = ctx.createGain();
  g3.gain.setValueAtTime(0.0001, t2);
  g3.gain.linearRampToValueAtTime(vol * 0.35, t2 + 0.02);
  g3.gain.exponentialRampToValueAtTime(0.0001, t2 + dur);
  osc.connect(bp2).connect(g3).connect(vento.passos);
  osc.start(t2); vib.start(t2);
  osc.stop(t2 + dur + 0.02); vib.stop(t2 + dur + 0.02);
}

// Impacto com a esfera: som de vidro grave e baixo (parciais desafinadas entre si).
// Intensidade proporcional à pancada; intervalo mínimo por esfera (evita repetição
// contínua ao rolar encostada).
function somDaEsfera(e, forca) {
  if (forca < 6 || !vento || vento.ctx.state !== 'running') return;
  const agora = performance.now();
  if (agora - (e.ultimoSom || 0) < 140) return;
  e.ultimoSom = agora;
  const ctx = vento.ctx, t = ctx.currentTime;
  const vol = SOM.vidro * Math.min(1, Math.max(0.2, forca / 90));
  const f0 = 430 * (0.94 + Math.random() * 0.12);
  const parciais = [[1, 1, 0.45], [2.76, 0.45, 0.28], [5.4, 0.2, 0.16], [8.93, 0.08, 0.1]];
  for (const [mult, amp, dur] of parciais) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f0 * mult;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol * amp, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(vento.passos);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
}

function atualizarSom(dt) {
  if (!vento || vento.ctx.state !== 'running') return;
  // andando, o vento é bem mais fraco que voando na mesma velocidade
  const rapidez = vel.length() / AJUSTE.velMax * (modo === 'andar' ? 0.45 : 1); // 1 = normal, 2 = dash
  const r1 = Math.min(rapidez, 1);
  const r2 = Math.max(0, Math.min(rapidez - 1, 1));
  // curva: cresce pouco em baixa velocidade e mais perto do máximo
  const curva = r1 * r1 * 0.7 + r1 * 0.3;
  let vol = SOM.volParado + (SOM.volMax - SOM.volParado) * curva + (SOM.volDash - SOM.volMax) * r2;
  let freq = SOM.filtroParado + (SOM.filtroMax - SOM.filtroParado) * curva + (SOM.filtroDash - SOM.filtroMax) * r2;
  // rajadas: cada canal busca um alvo aleatório de tempos em tempos
  for (let i = 0; i < 2; i++) {
    vento.troca[i] -= dt;
    if (vento.troca[i] <= 0) {
      vento.troca[i] = 1.5 + Math.random() * 3;
      vento.alvoRajada[i] = 1 + (Math.random() * 2 - 1) * SOM.rajada;
    }
    vento.rajada[i] = suavizar(vento.rajada[i], vento.alvoRajada[i], 0.8, dt);
  }
  if (submerso) { vol *= 0.35; freq = 220; } // abafado debaixo d'água
  vol *= 1 - uniAlto.value; // diminui até sumir no espaço
  // Com espuma, o vento abre espaço para ela: abaixo de SOM.ventoVoltaDe metros
  // fica baixo; daí até a altura máxima da espuma, volta aos poucos ao normal.
  const metros = camera.position.y / ESCALA_SENTIDA, topoEspuma = ESPIRRO.alturaMax / ESCALA_SENTIDA;
  const rente = 1 - Math.min(1, Math.max(0, (metros - SOM.ventoVoltaDe) / (topoEspuma - SOM.ventoVoltaDe)));
  vol *= 1 - SOM.ventoSobEspuma * presencaEspuma * rente;
  const t = vento.ctx.currentTime;
  const media = (vento.rajada[0] + vento.rajada[1]) / 2;
  vento.volume.gain.setTargetAtTime(vol, t, 0);
  vento.filtro.frequency.setTargetAtTime(freq * (0.85 + 0.15 * media), t, 0.12);
  vento.filtro2.frequency.setTargetAtTime(freq * 1.3, t, 0.12);
  vento.ressoa.frequency.setTargetAtTime(freq * 0.45, t, 0.2);
  vento.lados[0].gain.setTargetAtTime(vento.rajada[0], t, 0.3);
  vento.lados[1].gain.setTargetAtTime(vento.rajada[1], t, 0.3);
  atualizarEspuma(dt, rapidez, t);
}

// Espuma: o volume vem da força do espirro e da proximidade da água; a
// velocidade abre um pouco o som. Uma ondulação lenta e irregular (0,5 a 2 Hz)
// mexe volume e corte juntos: mais alto = mais aberto. Ao começar a espuma, ou
// ao descer rápido rente à água, um varrido curto faz o "chu" virar "aaa".
const ESPUMA = {
  corteMin: 700,     // Hz: corte do ruído rosa no vale da ondulação, devagar...
  corteMax: 2600,    // ...e no pico, rápido (menos = mais grave e macio)
  varridoDe: 5500,   // Hz: início do varrido (o "chu")
  varridoAte: 900,   // Hz: fim do varrido (o "aaa")
  varridoDur: 0.4,   // segundos
  incha: 2.8,        // volume do chiado no auge do varrido (× o normal)
  chiado: 0.35,      // volume da camada média (ruído rosa abafado)
  hiss: 0.14,        // volume do hiss (agudos acima de 3,5 kHz); mais = mais "sss"
  cheia: 0.2,        // força da espuma em que o som já está no volume máximo
  entra: 30,         // rapidez com que o som da espuma entra...
  sai: 15,           // ...e sai (o vento volta no mesmo ritmo); maior = mais rápido
  subidaRapida: 40,  // velocidade de subida que conta como saída brusca da água
  cauda: 2.2,        // saída brusca: a espuma some devagar (a água ainda se acomoda); menor = mais longa
};
// 0 a 1: presença do som da espuma. Entra e sai rápido, seguindo a força pedida
// (alvoEspirro) e não a suavizada: ao sair da espuma, o vento volta em seguida,
// sem um intervalo em que os dois estão baixos. Usada também para abaixar o vento.
let presencaEspuma = 0;
function atualizarEspuma(dt, rapidez, t) {
  const e = vento.esp, f = forcaEspirro;
  const quer = Math.min(1, alvoEspirro / ESPUMA.cheia);
  // saída brusca (subindo rápido): a água continua soando um pouco depois de sumir
  if (quer > 0 || presencaEspuma < 0.02) e.cauda = false;
  else if (presencaEspuma > 0.3 && vel.y > ESPUMA.subidaRapida) e.cauda = true;
  presencaEspuma = suavizar(presencaEspuma, quer, quer > presencaEspuma ? ESPUMA.entra : e.cauda ? ESPUMA.cauda : ESPUMA.sai, dt);
  const rente = Math.min(1, Math.max(0, 1 - (camera.position.y - AJUSTE.alturaOlhos) / (ESPIRRO.alturaMax - AJUSTE.alturaOlhos)));
  const veloz = Math.min(1, Math.max(0, rapidez / 2)); // 1 = dash máximo
  vento.espuma.gain.setTargetAtTime(SOM.espuma * presencaEspuma * (0.45 + 0.55 * rente) * (1 - uniAlto.value), t, 0.015);
  // varrido: no início da espuma, ou descendo rápido rente à água (no máximo 1 por segundo)
  const comeca = e.forcaAntes < 0.03 && f >= 0.03;
  const mergulha = f > 0.03 && vel.y < -60 && rente > 0.4;
  e.forcaAntes = f;
  if ((comeca || mergulha) && t - e.ultimoVarrido > 1) {
    e.ultimoVarrido = t;
    e.varrido = ESPUMA.varridoDur + 0.05;
    const corte = vento.passaChiado.frequency, g = vento.chiado.gain;
    corte.cancelScheduledValues(t); g.cancelScheduledValues(t);
    corte.setValueAtTime(ESPUMA.varridoDe, t);
    corte.exponentialRampToValueAtTime(ESPUMA.varridoAte, t + ESPUMA.varridoDur);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(ESPUMA.chiado * ESPUMA.incha, t + ESPUMA.varridoDur * 0.4);
    g.linearRampToValueAtTime(ESPUMA.chiado, t + ESPUMA.varridoDur);
  }
  if (f < 0.01) return;
  // ondulação: novo alvo a cada 0,5 a 2 s, alcançado suavemente
  e.troca -= dt;
  if (e.troca <= 0) {
    e.troca = 0.5 + Math.random() * 1.5;
    e.onda = Math.random();
  }
  const w = e.onda;
  vento.sopro.gain.setTargetAtTime(0.9 * (0.7 + 0.5 * w), t, 0.35);
  vento.hiss.gain.setTargetAtTime(ESPUMA.hiss * (0.6 + 0.6 * w) * (0.6 + 0.4 * veloz), t, 0.2);
  vento.passaGrave.frequency.setTargetAtTime((300 + 300 * veloz) * (0.8 + 0.4 * w), t, 0.35);
  if (e.varrido > 0) { e.varrido -= dt; return; } // o varrido manda no chiado até acabar
  vento.chiado.gain.setTargetAtTime(ESPUMA.chiado * (0.55 + 0.6 * w), t, 0.35);
  const corteBase = ESPUMA.corteMin + (ESPUMA.corteMax - ESPUMA.corteMin) * (0.4 * veloz + 0.6 * w);
  vento.passaChiado.frequency.setTargetAtTime(corteBase, t, 0.35);
}
