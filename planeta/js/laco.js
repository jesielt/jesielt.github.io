// ---------------------------------------------------------------------
// Laço principal
// ---------------------------------------------------------------------
let antes = performance.now();
function quadro(agora) {
  const dt = Math.min((agora - antes) / 1000, 0.05);
  antes = agora;
  atualizar(dt);
  atualizarEspirro(dt);
  atualizarDebaixoDagua(dt);
  atualizarSom(dt);
  animarAgua(agora / 1000);
  seguirSombra();
  renderer.render(cena, camera);
  desenharRadar(agora / 1000);
  desenharRiscos(dt);
  mostrarAltura();
  requestAnimationFrame(quadro);
}
atualizarIlhas();
criarEsferas();
// Compila na abertura os programas de desenho de tudo (inclusive do espirro,
// oculto): sem isso, o primeiro dash trava por um instante.
jatos.visible = true;
renderer.compile(cena, camera);
jatos.visible = false;
requestAnimationFrame(quadro);

// atalho de teste pelo console do navegador
window.planeta = { camera, vel, apertar, soltar, ilhas, nuvens, ceuDasNuvens, esferas, capturar, chaoDoMar, escurecerCeu, bolhas, explosaoDeBolhas, get ar() { return ar; }, set ar(v) { ar = v; }, alternarMergulho, get semMergulho() { return semMergulho; },
  passo(seg = 1 / 60) { atualizar(seg); atualizarEspirro(seg); atualizarDebaixoDagua(seg); atualizarSom(seg); renderer.render(cena, camera); desenharRadar(0); desenharRiscos(seg); mostrarAltura(); }, get vento() { return vento; }, FAUNA, desistirDoVoo, get modo() { return modo; }, chaoSob, tocarPasso, get pesY() { return pesY; }, get olhosAgora() { return olhosAgora; }, alternarMudo, get mudo() { return mudo; }, SOM, get yaw() { return yaw; }, set yaw(v) { yaw = v; }, get pitch() { return pitch; }, set pitch(v) { pitch = v; } };
