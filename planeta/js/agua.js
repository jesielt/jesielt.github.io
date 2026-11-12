// ---------------------------------------------------------------------
// Água: um plano enorme que acompanha você (então nunca acaba)
// ---------------------------------------------------------------------
// ESCALA: ~17,5 unidades aqui dentro ≈ 1 m na sensação de quem joga
// (régua calibrada pela altura dos olhos rente à grama ≈ 20 cm).
const LADRILHO = 60; // tamanho, em metros, de cada repetição da textura

function texturaDaAgua() {
  const t = 256;
  const c = document.createElement('canvas');
  c.width = c.height = t;
  const g = c.getContext('2d');
  g.fillStyle = CORES.agua;
  g.fillRect(0, 0, t, t);
  let semente = 7;
  const aleatorio = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 90; i++) {
    const x = aleatorio() * t, y = aleatorio() * t;
    const larg = 6 + aleatorio() * 26;
    g.fillStyle = aleatorio() < 0.6 ? 'rgba(255,255,225,0.28)' : 'rgba(70,150,110,0.18)';
    // desenha também nas bordas vizinhas pra emenda não aparecer
    for (const dx of [-t, 0, t]) for (const dy of [-t, 0, t]) {
      g.beginPath();
      g.ellipse(x + dx, y + dy, larg, larg * 0.18, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

const TAM_AGUA = 12000;
const texAgua = texturaDaAgua();
texAgua.repeat.set(TAM_AGUA / LADRILHO, TAM_AGUA / LADRILHO);
// Mar de lago: quase parado e meio turvo.
// - ondulação miudinha e lenta (só mexe no brilho, a superfície é plana)
// - reflete o céu: olhando rente, vira céu; olhando pra baixo, vira água
// - brilho suave do sol
// - um pouco transparente: dá pra ver de leve o que está logo embaixo
// As manchinhas da textura continuam, bem fracas, pra manter o jeito pintado.
// De longe, a camuflagem da repetição (segunda cópia girada + manchas largas).
const uniAgua = {
  escuro: uniEscuro,
  alto: uniAlto,
  tempo: { value: 0 },
  corBase: { value: new THREE.Color(CORES.agua) },
  solDir: { value: sol.position.clone().normalize() },
};
const matAgua = new THREE.MeshBasicMaterial({ map: texAgua, transparent: true, side: THREE.DoubleSide });
matAgua.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, uniAgua);
  sh.vertexShader = 'varying vec3 vMundo;\n' + sh.vertexShader.replace('#include <project_vertex>', `
    #include <project_vertex>
    vMundo = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
  `);
  sh.fragmentShader = 'uniform vec3 corBase;\nuniform float tempo;\nuniform vec3 solDir;\nvarying vec3 vMundo;\n'
    + CEU_GLSL + sh.fragmentShader.replace('#include <map_fragment>', `
    vec3 paraCamera = cameraPosition - vMundo;
    float dist = length( paraCamera );
    vec3 V = paraCamera / dist;

    // ondulação: algumas ondinhas em direções diferentes, somadas
    vec2 p = vMundo.xz;
    vec2 inc = vec2( 0.0 );
    inc += vec2( 0.80, 0.60 ) * cos( dot( p, vec2( 0.80, 0.60 ) ) * 0.11 + tempo * 0.55 );
    inc += vec2( -0.45, 0.89 ) * cos( dot( p, vec2( -0.45, 0.89 ) ) * 0.17 + tempo * 0.70 ) * 0.7;
    inc += vec2( 0.97, -0.24 ) * cos( dot( p, vec2( 0.97, -0.24 ) ) * 0.29 + tempo * 0.90 ) * 0.45;
    inc += vec2( -0.70, -0.71 ) * cos( dot( p, vec2( -0.70, -0.71 ) ) * 0.47 + tempo * 1.20 ) * 0.3;
    // de longe as ondinhas somem (senão viram chuvisco na tela)
    float forca = 0.025 * ( 1.0 - smoothstep( 60.0, 900.0, dist ) );
    vec3 N = normalize( vec3( -inc.x * forca, 1.0, -inc.y * forca ) );

    // quanto a água vira espelho: rente = muito, de cima = pouco
    float ndv = max( dot( N, V ), 0.0 );
    float espelho = 0.06 + 0.94 * pow( 1.0 - ndv, 4.0 );
    vec3 R = reflect( -V, N );
    vec3 ceu = pow( corDoCeu( max( R.y, 0.0 ) ), vec3( 2.2 ) ); // céu está em sRGB

    // cor do corpo da água, com as manchinhas bem fracas
    vec4 tA = texture2D( map, vMapUv );
    vec2 uvB = mat2( 0.8, -0.6, 0.6, 0.8 ) * vMapUv * 0.43 + vec2( 0.37, 0.71 );
    vec4 tB = texture2D( map, uvB );
    float longe = smoothstep( 150.0, 700.0, dist );
    vec3 corpo = corBase
      + ( tA.rgb - corBase ) * mix( 0.3, 0.2, longe )
      + ( tB.rgb - corBase ) * 0.35 * longe;
    vec2 q = vMapUv;
    float macro = sin( q.x * 0.21 + sin( q.y * 0.17 ) * 2.0 ) * sin( q.y * 0.19 + sin( q.x * 0.13 ) * 2.0 );
    corpo *= 1.0 + 0.05 * macro * longe;

    vec3 cor = mix( corpo, ceu, espelho );
    cor *= 1.0 - 0.45 * escuro; // céu escuro: o mar escurece junto
    // sol: um brilho fino e um halo largo e fraquinho
    float s = max( dot( R, solDir ), 0.0 );
    cor += vec3( 1.0, 0.98, 0.9 ) * ( pow( s, 400.0 ) * 0.7 + pow( s, 30.0 ) * 0.06 );

    diffuseColor.rgb = cor;
    // turva: de cima mostra só um pouco do que está embaixo; rente, nada
    diffuseColor.a = mix( 0.88, 1.0, espelho );
    // vista de baixo (você mergulhou): um teto claro, com a luz vindo de cima
    if ( cameraPosition.y < 0.0 ) {
      diffuseColor.rgb = mix( vec3( 0.42, 0.80, 0.66 ), vec3( 0.75, 0.95, 0.85 ), 1.0 - espelho ) + ( tA.rgb - corBase ) * 0.25;
      diffuseColor.a = 0.9;
    }
  `);
};
const agua = new THREE.Mesh(new THREE.PlaneGeometry(TAM_AGUA, TAM_AGUA), matAgua);
agua.rotation.x = -Math.PI / 2;
agua.renderOrder = -0.9;
cena.add(agua);

// Fundo: um chão escuro lá embaixo, só pra água turva ter o que mostrar
// quando você olha de cima (sem ele, apareceria o céu através da água).
const leito = new THREE.Mesh(
  new THREE.PlaneGeometry(TAM_AGUA, TAM_AGUA),
  new THREE.MeshBasicMaterial({ color: CORES.aguaFunda })
);
leito.rotation.x = -Math.PI / 2;
leito.position.y = -150; // bem abaixo do fundo do mar (só pra nunca aparecer buraco)
cena.add(leito);

// ---------------------------------------------------------------------
// Fundo do mar: um chão a ~120 de profundidade (≈6,9 m na sua régua), com
// ondulações e montinhos de terra espalhados — nunca 100% plano.
// A mesma conta existe em JS (pra você e as esferas pisarem nele) e no
// shader (pra desenhar), então os dois batem certinho.
// ---------------------------------------------------------------------
const PROF = 120;
function alturaDoFundo(x, z) {
  return -PROF
    + 3.5 * Math.sin(x * 0.021 + 1.3) * Math.sin(z * 0.017 + 0.4)
    + 2.0 * Math.sin(x * 0.053 + z * 0.041 + 2.1)
    + 1.2 * Math.sin(x * 0.11 - z * 0.09 + 0.7)
    + 7.0 * Math.pow(Math.max(0, Math.sin(x * 0.0083 + 5.0) * Math.sin(z * 0.0071 + 1.0)), 3);
}
const FUNDO_GLSL = `
  float alturaDoFundo( vec2 p ) {
    return -120.0
      + 3.5 * sin( p.x * 0.021 + 1.3 ) * sin( p.y * 0.017 + 0.4 )
      + 2.0 * sin( p.x * 0.053 + p.y * 0.041 + 2.1 )
      + 1.2 * sin( p.x * 0.11 - p.y * 0.09 + 0.7 )
      + 7.0 * pow( max( 0.0, sin( p.x * 0.0083 + 5.0 ) * sin( p.y * 0.0071 + 1.0 ) ), 3.0 );
  }
`;
const PASSO_FUNDO = 20; // o chão anda com você de 20 em 20 (pra não "nadar")
const geoFundo = new THREE.PlaneGeometry(2400, 2400, 120, 120);
geoFundo.rotateX(-Math.PI / 2);
const matFundo = new THREE.MeshLambertMaterial({ color: '#7f8fc4' }); // areia azulada (as rochas de Namek embaixo d'água)
const fundoDoMar = new THREE.Mesh(geoFundo, matFundo);
fundoDoMar.frustumCulled = false;
cena.add(fundoDoMar);
