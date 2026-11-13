// ---------------------------------------------------------------------
// Subida ao espaço (nada do mundo é montado lá em cima).
// - 200 a 500 m: o céu escurece; surgem estrelas (pontos que acompanham a câmera)
// - embaixo, um planeta pintado no shader (mar verde, faixas claras, brilho azul na
// borda) cobre o mundo aos poucos; gira conforme o deslocamento (efeito de sobrevoo)
// - acima de 500 m não há ar: aparece a barra de fôlego
// Na descida, tudo se inverte.
// ---------------------------------------------------------------------
const ESPACO = {
  rarefeito: 200, // m: o céu começa a mudar
  espaco: 500, // m: espaço (céu preto, sem ar)
  planetaDe: 110, // m: o planeta pintado começa a cobrir o mundo...
  planetaAte: 230, // ...e cobre tudo a partir daqui
  raio: 120000, // raio do planeta pintado (grande: a curvatura só aparece bem no alto)
};
const uniPlaneta = {
  solDir: { value: sol.position.clone().normalize() },
  opacidade: { value: 0 },
  escuro: uniEscuro,
  alto: uniAlto,
};
// Pintura do planeta calculada no shader a partir do ponto da esfera (não de imagem
// esticada): sem polo nem emenda. Faixas claras irregulares na diagonal, que se juntam
// e se dissolvem, e nuvens brancas soltas. Planeta e brilho são desenhados por cima
// de tudo (sem teste de profundidade), para cobrir o mundo gradualmente.
const planeta = new THREE.Mesh(new THREE.SphereGeometry(ESPACO.raio, 256, 128), new THREE.ShaderMaterial({
  uniforms: uniPlaneta,
  transparent: true, depthTest: false, depthWrite: false,
  vertexShader: `
    #include <common>
    #include <logdepthbuf_pars_vertex>
    varying vec3 vPonto;
    varying vec3 vNormal;
    varying vec3 vVista;
    void main() {
      vPonto = normalize( position ); // o ponto na bola (gira junto com ela)
      vNormal = normalize( mat3( modelMatrix ) * normal );
      vec4 mundo = modelMatrix * vec4( position, 1.0 );
      vVista = normalize( cameraPosition - mundo.xyz );
      gl_Position = projectionMatrix * viewMatrix * mundo;
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: `
    #include <logdepthbuf_pars_fragment>
    uniform vec3 solDir;
    uniform float opacidade;
    uniform float escuro;
    varying vec3 vPonto;
    varying vec3 vNormal;
    varying vec3 vVista;
    float sorteio( vec3 p ) {
      p = fract( p * 0.3183099 + 0.1 );
      p *= 17.0;
      return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
    }
    float ruido( vec3 x ) {
      vec3 i = floor( x ), f = fract( x );
      f = f * f * ( 3.0 - 2.0 * f );
      return mix( mix( mix( sorteio( i ), sorteio( i + vec3( 1, 0, 0 ) ), f.x ),
                       mix( sorteio( i + vec3( 0, 1, 0 ) ), sorteio( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
                  mix( mix( sorteio( i + vec3( 0, 0, 1 ) ), sorteio( i + vec3( 1, 0, 1 ) ), f.x ),
                       mix( sorteio( i + vec3( 0, 1, 1 ) ), sorteio( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
    }
    float camadas( vec3 p ) {
      float s = 0.0, a = 0.5;
      for ( int k = 0; k < 5; k++ ) { s += a * ruido( p ); p = p * 2.03 + vec3( 1.7, 9.2, 3.1 ); a *= 0.5; }
      return s;
    }
    void main() {
      #include <logdepthbuf_fragment>
      vec3 q = vPonto;
      // entorta tudo um pouco (as faixas ficam curvas, não retas)
      q += 0.09 * ( vec3( camadas( q * 5.0 ), camadas( q * 5.0 + 5.2 ), camadas( q * 5.0 + 9.1 ) ) - 0.5 );
      // faixas: esticadas numa direção meio diagonal (compridas nela, finas nas outras)
      vec3 d = normalize( vec3( 1.0, 0.55, 0.25 ) );
      vec3 e1 = normalize( cross( d, vec3( 0.0, 0.0, 1.0 ) ) );
      vec3 e2 = cross( d, e1 );
      float faixa = camadas( vec3( dot( q, d ) * 7.0, dot( q, e1 ) * 85.0, dot( q, e2 ) * 85.0 ) );
      // onde elas aparecem: em umas regiões juntam muitas, em outras quase nada
      float regiao = smoothstep( 0.38, 0.62, camadas( q * 3.0 + 2.0 ) );
      float claro = smoothstep( 0.5, 0.68, faixa ) * regiao;
      // mar verde com variação larga de tom
      float tom = camadas( q * 4.0 + 7.0 );
      vec3 cor = mix( vec3( 0.16, 0.50, 0.26 ), vec3( 0.30, 0.70, 0.36 ), smoothstep( 0.3, 0.7, tom ) );
      cor = mix( cor, vec3( 0.86, 0.92, 0.62 ), claro * 0.85 );
      // nuvens brancas soltas
      float nuvem = smoothstep( 0.62, 0.78, camadas( q * 2.5 + 11.0 ) );
      cor = mix( cor, vec3( 0.95, 1.0, 0.94 ), nuvem * 0.7 );
      cor = pow( cor, vec3( 2.2 ) ); // as cores acima estão em sRGB
      float luz = 0.35 + 0.75 * max( dot( vNormal, solDir ), 0.0 );
      // perto da borda: azulado (a atmosfera vista de lado)
      float borda = pow( 1.0 - max( dot( vNormal, vVista ), 0.0 ), 2.5 );
      cor = cor * luz * ( 1.0 - 0.45 * escuro );
      cor = mix( cor, vec3( 0.05, 0.25, 0.65 ), borda * 0.55 );
      gl_FragColor = vec4( cor, opacidade );
      #include <colorspace_fragment>
    }`,
}));
planeta.renderOrder = 20;
planeta.frustumCulled = false;
const grupoPlaneta = new THREE.Group();
grupoPlaneta.visible = false;
grupoPlaneta.add(planeta);
cena.add(grupoPlaneta);
// brilho azul em volta (esfera um pouco maior, vista por dentro)
const brilhoPlaneta = new THREE.Mesh(new THREE.SphereGeometry(ESPACO.raio * 1.02, 256, 128), new THREE.ShaderMaterial({
  uniforms: uniPlaneta,
  transparent: true, depthTest: false, depthWrite: false,
  blending: THREE.AdditiveBlending, side: THREE.BackSide,
  vertexShader: `
    #include <common>
    #include <logdepthbuf_pars_vertex>
    varying vec3 vNormal;
    varying vec3 vVista;
    void main() {
      vNormal = normalize( mat3( modelMatrix ) * normal );
      vec4 mundo = modelMatrix * vec4( position, 1.0 );
      vVista = normalize( cameraPosition - mundo.xyz );
      gl_Position = projectionMatrix * viewMatrix * mundo;
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: `
    #include <logdepthbuf_pars_fragment>
    uniform float opacidade;
    uniform float alto;
    varying vec3 vNormal;
    varying vec3 vVista;
    void main() {
      #include <logdepthbuf_fragment>
      float d = abs( dot( vNormal, vVista ) );
      // com o céu ainda claro o brilho fica fraquinho (senão vira faixa branca)
      float a = pow( 1.0 - d, 6.0 ) * 0.7 * opacidade * ( 0.15 + 0.85 * alto );
      gl_FragColor = vec4( vec3( 0.35, 0.7, 1.0 ) * a, 1.0 );
    }`,
}));
brilhoPlaneta.renderOrder = 19.5; // antes do planeta: ele cobre o miolo e resta só a borda
brilhoPlaneta.frustumCulled = false;
grupoPlaneta.add(brilhoPlaneta);

// estrelas: pontos numa esfera enorme em volta da câmera
const estrelas = (() => {
  const n = 2200, pos = new Float32Array(n * 3), cor = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos[i * 3] = s * Math.cos(a) * 50000; pos[i * 3 + 1] = u * 50000; pos[i * 3 + 2] = s * Math.sin(a) * 50000;
    const b = 0.45 + Math.random() * 0.55, azul = Math.random() * 0.15;
    cor[i * 3] = b - azul; cor[i * 3 + 1] = b - azul * 0.5; cor[i * 3 + 2] = b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(cor, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 1.8, sizeAttenuation: false, vertexColors: true, transparent: true,
    opacity: 0, depthWrite: false, fog: false,
  }));
  pts.renderOrder = -0.5; // logo após o céu
  pts.frustumCulled = false;
  pts.visible = false;
  cena.add(pts);
  return pts;
})();

function suave(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function atualizarAltitude() {
  const m = camera.position.y / ESCALA_SENTIDA;
  const alto = Math.min(1, Math.max(0, (m - ESPACO.rarefeito) / (ESPACO.espaco - ESPACO.rarefeito)));
  uniAlto.value = alto;
  const cobre = suave(ESPACO.planetaDe, ESPACO.planetaAte, m);
  uniPlaneta.opacidade.value = cobre;
  grupoPlaneta.visible = cobre > 0.001 && !submerso;
  if (grupoPlaneta.visible) {
    // o topo da esfera fica no nível do mar, sob a câmera; gira conforme o
    // deslocamento, simulando o sobrevoo do planeta
    grupoPlaneta.position.set(camera.position.x, -ESPACO.raio, camera.position.z);
    grupoPlaneta.rotation.set(camera.position.z / ESPACO.raio, 0, -camera.position.x / ESPACO.raio);
  }
  const brilhoEstrelas = suave(0.35, 1, alto);
  estrelas.visible = brilhoEstrelas > 0.001 && !submerso;
  estrelas.material.opacity = brilhoEstrelas;
  estrelas.position.copy(camera.position);
}
function semArAqui() {
  return submerso || camera.position.y / ESCALA_SENTIDA > ESPACO.espaco;
}

const _corNeblina = new THREE.Color();
function atualizarDebaixoDagua(dt) {
  if (!(dt > 0)) return;
  if (ceuPendente && !submerso) { ceuPendente = false; escurecerCeu(); }
  // escurecimento (ou retorno) gradual do céu
  uniEscuro.value = suavizar(uniEscuro.value, escuroAlvo, 0.9, dt);
  if (Math.abs(uniEscuro.value - escuroAlvo) < 0.002) uniEscuro.value = escuroAlvo;
  const esc = uniEscuro.value;
  hemi.intensity = 2.2 * (1 - 0.62 * esc) + luzRaio * 1.8; // o raio ilumina tudo por um instante
  sol.intensity = 1.6 * (1 - 0.72 * esc);
  // o planeta no céu perde brilho (senão parece uma lua acesa)
  for (const sat of satelites) {
    // no espaço, sem ar à frente, fica mais nítido
    sat.sprite.material.opacity = Math.min(1, 0.82 * (1 - 0.55 * esc) + 0.18 * uniAlto.value);
    sat.sprite.material.color.setRGB(1 - 0.5 * esc, 1 - 0.42 * esc, 1 - 0.48 * esc);
  }
  matNuvemTopo.color.copy(corNuvemTopo).lerp(corNuvemEscura, esc);
  matNuvemBase.color.copy(corNuvemBase).lerp(corNuvemBaseEscura, esc);
  atualizarRaios(dt);
  atualizarAltitude();

  // fundo do mar e algas acompanham a câmera
  fundoDoMar.position.x = Math.round(camera.position.x / PASSO_FUNDO) * PASSO_FUNDO;
  fundoDoMar.position.z = Math.round(camera.position.z / PASSO_FUNDO) * PASSO_FUNDO;
  tempoAlga.value += dt;

  // submerso: neblina verde densa, sem céu e sem turvo
  if (submerso) {
    cena.fog.color.copy(corNeblinaAgua);
    cena.fog.near = 2;
    cena.fog.far = 240;
    cena.background = corNeblinaAgua;
  } else {
    cena.fog.color.copy(_corNeblina.copy(corNeblinaNormal).lerp(corNeblinaEscura, esc));
    cena.fog.near = AJUSTE.neblinaPerto;
    cena.fog.far = AJUSTE.neblinaLonge;
    cena.background = null;
  }
  turvo.value = submerso ? 0 : 1;
  ceu.visible = !submerso;
  ceuDasNuvens.visible = !submerso;
  for (const sat of satelites) sat.sprite.visible = !submerso;
  telaDebaixo.classList.toggle('ligada', submerso);

  // ar
  const semAr = semArAqui(); // submerso ou no espaço
  if (semAr) ar -= dt;
  else ar = Math.min(AGUA.ar, ar + dt * 8);
  barraAr.classList.toggle('visivel', semAr || ar < AGUA.ar - 0.05);
  nivelAr.style.width = (Math.max(0, ar) / AGUA.ar * 100).toFixed(1) + '%';
  barraAr.classList.toggle('pouco', ar < AGUA.ar * 0.2);
  if (ar <= 0) recomecar();

  atualizarBolhas(dt);
}
