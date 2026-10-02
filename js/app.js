// Liga tudo: toque na tela -> ouvir -> pensar -> falar -> ouvir de novo por alguns segundos.
(function () {
  var DORMIR_MS = 3 * 60 * 1000;     // 3 minutos sem uso -> dorme
  var CONTINUAR_MS = 6000;           // depois de responder, espera uma continuacao por esse tempo

  var statusEl = document.getElementById('status');
  var estado = 'ocioso';
  var ultimoUso = Date.now();
  var travaTela = null;

  function mudar(novo, texto) {
    estado = novo;
    Cortex.Olhos.estado(novo);
    statusEl.innerHTML = texto || '';
  }

  function telaCheia() {
    var el = document.documentElement;
    if (document.fullscreenElement || document.webkitFullscreenElement) { return; }
    try {
      if (el.requestFullscreen) { el.requestFullscreen(); }
      else if (el.webkitRequestFullscreen) { el.webkitRequestFullscreen(); }
    } catch (e) {}
  }

  // Mantem a tela ligada enquanto o Cortex esta aberto (Safari 16.4+)
  function manterTelaLigada() {
    if (travaTela || !navigator.wakeLock) { return; }
    navigator.wakeLock.request('screen').then(function (trava) {
      travaTela = trava;
      trava.addEventListener('release', function () { travaTela = null; });
    }, function () {});
  }

  // A trava some quando o app vai para segundo plano: pede de novo ao voltar
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') { manterTelaLigada(); }
  });

  // continuacao = true: ouvindo logo depois de responder (sem toque);
  // se ninguem falar, volta a esperar em silencio
  function ouvir(continuacao) {
    mudar('ouvindo', continuacao ? 'pode continuar...' : 'ouvindo...');
    Cortex.Microfone.iniciar({
      nivel: Cortex.Olhos.nivel,
      semFalaMs: continuacao ? CONTINUAR_MS : 0,
      fim: function (wav, segundos) {
        if (!wav) {
          mudar('ocioso', continuacao ? 'toque para falar' : 'não ouvi nada &middot; toque para falar');
          return;
        }
        pensar(wav, segundos);
      }
    }, function (erro) {
      mudar('ocioso', 'sem acesso ao microfone');
      falar('Não consegui acessar o microfone. Permita o microfone nos ajustes do site e tente de novo.', '', true);
    });
  }

  function pensar(wav, segundos) {
    mudar('pensando', 'pensando...');
    Cortex.Cerebro.perguntar(wav, segundos, function (erro, resposta, transcricao) {
      if (erro) {
        falar('Tive um problema. ' + erro, '', true);
      } else {
        falar(resposta, transcricao ? 'você: ' + transcricao : '');
      }
    });
  }

  // semContinuacao: depois de mensagens de erro nao fica ouvindo
  function falar(texto, legenda, semContinuacao) {
    mudar('falando', '');
    // Mostra o que ele entendeu que voce disse (textContent: evita HTML vindo do servidor)
    if (legenda) { statusEl.textContent = legenda; }
    Cortex.Voz.falar(texto, function () {
      ultimoUso = Date.now();
      if (semContinuacao) {
        mudar('ocioso', 'toque para falar');
      } else {
        ouvir(true);
      }
    });
  }

  function acordar() {
    mudar('ocioso', 'toque para falar');
    Cortex.Olhos.feliz(1500);
  }

  document.addEventListener('click', function () {
    telaCheia();
    manterTelaLigada();
    Cortex.Voz.destravar();
    ultimoUso = Date.now();
    if (estado === 'dormindo') {
      acordar();
    } else if (estado === 'ocioso') {
      ouvir(false);
    } else if (estado === 'ouvindo') {
      Cortex.Microfone.parar();      // toque de novo = "terminei de falar"
    } else if (estado === 'falando') {
      Cortex.Voz.parar();            // toque enquanto fala = interrompe
      mudar('ocioso', 'toque para falar');
    }
    // pensando: ignora o toque
  });

  setInterval(function () {
    if (estado === 'ocioso' && Date.now() - ultimoUso > DORMIR_MS) {
      mudar('dormindo', 'zzz');
    }
  }, 10000);

  acordar();
})();
