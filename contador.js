/*
 * Contador de visitas: envia sinais curtos ao Apps Script.
 * Visitante: identificador guardado no navegador (o mesmo aparelho é reconhecido entre visitas).
 * Sessão: do carregamento da página até o último sinal; sinal a cada minuto com a aba visível.
 * Apelido: abrir a página com ?apelido=Nome marca este navegador; ?apelido= (vazio) remove.
 */
(function () {
  // URL /exec da implantação "Qualquer pessoa" do Apps Script.
  var URL_SCRIPT = 'https://script.google.com/macros/s/AKfycbyKuRduf4Y7sS432fW4ZTH5b9I-46b97QBEFAQkqvBJU_1rS2LyO6GNTp7IqPTAriXC/exec';
  var INTERVALO = 60000;          // ms entre sinais
  var PAUSA_NOVA_SESSAO = 1800000; // ms com a aba oculta para começar outra sessão

  if (URL_SCRIPT.indexOf('https://') !== 0) return;
  // Não conta o servidor local de desenvolvimento.
  if (location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return;

  function ler(chave) { try { return localStorage.getItem(chave); } catch (e) { return null; } }
  function gravar(chave, valor) {
    try { valor == null ? localStorage.removeItem(chave) : localStorage.setItem(chave, valor); } catch (e) {}
  }
  function aleatorio() { return Math.random().toString(36).slice(2, 12) + Date.now().toString(36); }

  var busca = new URLSearchParams(location.search);
  if (busca.has('apelido')) {
    gravar('contador-apelido', busca.get('apelido').trim() || null);
    busca.delete('apelido');
    var resto = busca.toString();
    history.replaceState(null, '', location.pathname + (resto ? '?' + resto : '') + location.hash);
  }

  var visitante = ler('contador-id');
  if (!visitante) { visitante = aleatorio(); gravar('contador-id', visitante); }

  var sessao = null;
  var relogio = null;
  var ocultoDesde = 0;

  // Sistema e navegador a partir do user agent. A ordem importa: Edge, Opera e
  // Samsung também se declaram "Chrome", e o Chrome também se declara "Safari".
  function identificar() {
    var ua = navigator.userAgent;
    var sistema =
      /Android/.test(ua) ? 'Android' :
      /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iOS' :
      /CrOS/.test(ua) ? 'ChromeOS' :
      /Windows/.test(ua) ? 'Windows' :
      /Mac OS X|Macintosh/.test(ua) ? 'macOS' :
      /Linux/.test(ua) ? 'Linux' : '';
    var navegador =
      /Edg(e|A|iOS)?\//.test(ua) ? 'Edge' :
      /OPR\/|Opera/.test(ua) ? 'Opera' :
      /SamsungBrowser/.test(ua) ? 'Samsung Internet' :
      /Firefox|FxiOS/.test(ua) ? 'Firefox' :
      /Chrome|CriOS/.test(ua) ? 'Chrome' :
      /Safari/.test(ua) ? 'Safari' : '';
    return { sistema: sistema, navegador: navegador };
  }

  function enviar(dados) {
    var corpo = JSON.stringify(dados);
    // text/plain evita a verificação prévia de CORS; a resposta não é lida.
    if (navigator.sendBeacon && navigator.sendBeacon(URL_SCRIPT, corpo)) return;
    fetch(URL_SCRIPT, { method: 'POST', body: corpo, mode: 'no-cors', keepalive: true }).catch(function () {});
  }

  // País e IP: consulta guardada por dia, para não repetir a cada página.
  function localizar() {
    var dia = new Date().toISOString().slice(0, 10);
    try {
      var salvo = JSON.parse(ler('contador-geo'));
      if (salvo && salvo.dia === dia) return Promise.resolve(salvo);
    } catch (e) {}
    var limite = new Promise(function (ok) { setTimeout(function () { ok({}); }, 4000); });
    var consulta = fetch('https://ipwho.is/?fields=success,ip,country_code,country,city')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.success) return {};
        var geo = { dia: dia, ip: j.ip, pais: j.country_code, paisNome: j.country, cidade: j.city };
        gravar('contador-geo', JSON.stringify(geo));
        return geo;
      })
      .catch(function () { return {}; });
    return Promise.race([consulta, limite]);
  }

  function iniciar() {
    sessao = aleatorio();
    var esta = sessao;
    localizar().then(function (geo) {
      if (esta !== sessao) return;
      var id = identificar();
      enviar({
        sistema: id.sistema,
        navegador: id.navegador,
        sessao: sessao,
        visitante: visitante,
        apelido: ler('contador-apelido') || '',
        ip: geo.ip || '',
        pais: geo.pais || '',
        paisNome: geo.paisNome || '',
        cidade: geo.cidade || '',
        pagina: location.pathname,
        aparelho: matchMedia('(pointer: coarse)').matches ? 'celular' : 'PC'
      });
      clearInterval(relogio);
      relogio = setInterval(sinal, INTERVALO);
    });
  }

  function sinal() {
    if (sessao && document.visibilityState === 'visible') enviar({ sessao: sessao });
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      ocultoDesde = Date.now();
      if (sessao) enviar({ sessao: sessao }); // marca o fim exato
    } else if (ocultoDesde && Date.now() - ocultoDesde > PAUSA_NOVA_SESSAO) {
      iniciar();
    }
  });

  iniciar();
})();
