// ---------------------------------------------------------------------
// Rochas: forma em camadas (geometria) e aparência de pedra (shader).
// Também guarda o ruído 3D em GLSL usado por outros materiais (copas).
// ---------------------------------------------------------------------

// Valores ajustáveis. A colisão continua cilíndrica: saliências grandes
// demais deixam o jogador atravessar a parte que sobra para fora.
const ROCHA = {
  camadas: 7,        // degraus na forma de cada rocha (qualquer altura)
  saliencia: 0.05,   // quanto cada degrau avança ou recua (fração do raio)
  inclinacao: 0.25,  // ondulação dos degraus ao redor da rocha (0 = retos)
  irregular: 0.03,   // deformação do contorno (0 = círculo perfeito)
  lados: 24,         // divisões ao redor; menos lados = aspecto mais facetado
};
const PEDRA = {
  espessura: 3.5,    // altura de cada faixa de sedimento, em metros
  ondulacao: 2.0,    // quanto as faixas sobem e descem, em metros
  contraste: 0.16,   // diferença de tom entre faixas
  sulcos: 0.25,      // escurecimento do sulco entre faixas
  granulado: 0.16,   // riscos finos ao longo das faixas
  rachaduras: 0.35,  // escurecimento das rachaduras verticais
  largRachadura: 0.03, // largura das rachaduras (0,01 a 0,08)
  relevo: 0.6,       // profundidade aparente de sulcos e rachaduras (0 = liso)
  topoClaro: 0.12,   // clareamento das superfícies voltadas para cima
};

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

// Cilindro unitário com degraus horizontais: cada camada tem raio próprio
// sorteado e a borda superior levemente recolhida, o que forma beirais.
// O deslocamento depende só de (ângulo, altura), logo os vértices repetidos
// da emenda e das tampas recebem o mesmo valor e a malha não abre frestas.
function geometriaDaRocha(afina, semente) {
  const n = ROCHA.camadas;
  const geo = new THREE.CylinderGeometry(afina, 1, 1, ROCHA.lados, n * 6);
  const p = geo.attributes.position;
  const acaso = (k) => { const s = Math.sin(k * 12.9898 + semente * 78.233) * 43758.5453; return s - Math.floor(s); };
  const fases = [acaso(-1) * 6.3, acaso(-2) * 6.3, acaso(-3) * 6.3, acaso(-4) * 6.3];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (Math.hypot(x, z) < 1e-6) continue; // centro das tampas
    const a = Math.atan2(z, x);
    const u = (y + 0.5) * n + ROCHA.inclinacao * Math.sin(2 * a + fases[0]) + 0.15 * Math.sin(5 * a + fases[1]);
    const id = Math.floor(u), f = u - id;
    const k = 1
      + ROCHA.saliencia * (acaso(id) - 0.5) * 2
      - ROCHA.saliencia * 0.6 * f ** 4
      + ROCHA.irregular * (0.6 * Math.sin(3 * a + fases[2]) + 0.4 * Math.sin(7 * a + fases[3]));
    p.setXYZ(i, x * k, y, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

// Pedra: faixas horizontais de sedimento em metros (independem do tamanho da
// rocha), sulcos entre faixas, riscos finos, rachaduras verticais e topo mais
// claro. Sulcos e rachaduras também desviam a normal (relevo sem triângulos).
const glNum = (v) => v.toFixed(4);
function pintarPedra(sh) {
  sh.vertexShader = 'varying vec3 vPosPedra;\n' + sh.vertexShader.replace('#include <project_vertex>', `
    #include <project_vertex>
    // posição em metros relativa à peça, deslocada por ela (evita perda de
    // precisão longe da origem e dá desenho diferente a cada rocha)
    vPosPedra = mat3( modelMatrix ) * transformed + fract( modelMatrix[3].xyz * 0.0137 ) * 50.0;
  `);
  sh.fragmentShader = 'varying vec3 vPosPedra;\n' + RUIDO_GLSL + sh.fragmentShader
    .replace('#include <color_fragment>', `
      #include <color_fragment>
      vec3 pp = vPosPedra;
      float yOnda = pp.y + ${glNum(PEDRA.ondulacao)} * ( ruido3( vec3( pp.xz * 0.04, 0.0 ) ) - 0.5 ) * 2.0;
      float faixa = yOnda / ${glNum(PEDRA.espessura)};
      float fFaixa = fract( faixa );
      float tomFaixa = acaso3( vec3( floor( faixa ), 1.7, 3.1 ) ) - 0.5;
      float sulco = 1.0 - smoothstep( 0.0, 0.08 + fwidth( faixa ), fFaixa );
      float risco = camadas3( pp * vec3( 0.5, 3.0, 0.5 ) );
      float cr = ruido3( vec3( pp.x * 0.15, pp.y * 0.02, pp.z * 0.15 ) );
      float racha = 1.0 - smoothstep( 0.0, ${glNum(PEDRA.largRachadura)} + fwidth( cr ), abs( cr - 0.5 ) );
      vec3 nMundo = normalize( cross( dFdx( pp ), dFdy( pp ) ) );
      diffuseColor.rgb *= ( 1.0 + ${glNum(PEDRA.contraste)} * 2.0 * tomFaixa )
        * ( 1.0 - ${glNum(PEDRA.sulcos)} * sulco )
        * ( 1.0 + ${glNum(PEDRA.granulado)} * ( risco - 0.5 ) * 2.0 )
        * ( 1.0 - ${glNum(PEDRA.rachaduras)} * racha )
        * ( 1.0 + ${glNum(PEDRA.topoClaro)} * smoothstep( 0.6, 0.9, abs( nMundo.y ) ) );
      float alturaPedra = ${glNum(PEDRA.relevo)} * ( 0.5 * risco - 0.4 * sulco - 0.8 * racha );
    `)
    .replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      {
        // perturbação de normal por derivadas (sem normalizar os vetores de
        // tela: a força do relevo não muda com a distância)
        vec3 sx = dFdx( -vViewPosition ), sy = dFdy( -vViewPosition );
        vec3 r1 = cross( sy, normal ), r2 = cross( normal, sx );
        float det = dot( sx, r1 ) * faceDirection;
        vec3 grad = sign( det ) * ( dFdx( alturaPedra ) * r1 + dFdy( alturaPedra ) * r2 );
        normal = normalize( abs( det ) * normal - grad );
      }
    `);
}
