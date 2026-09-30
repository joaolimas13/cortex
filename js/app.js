// Liga tudo: toque na tela -> ouvir -> pensar -> falar -> esperar de novo.
(function () {
  var DORMIR_MS = 3 * 60 * 1000;  // 3 minutos sem uso -> dorme

  var statusEl = document.getElementById('status');
  var estado = 'ocioso';
  var ultimoUso = Date.now();

  function mudar(novo, texto) {
    estado = novo;
    Cortex.Olhos.estado(novo);
    statusEl.innerHTML = texto || '';
  }

  function telaCheia() {
    var el = document.documentElement;
    if (document.fullscreenElement || document.webkitFullscreenElement) { return; }
    if (el.requestFullscreen) { el.requestFullscreen(); }
    else if (el.webkitRequestFullscreen) { el.webkitRequestFullscreen(); }
  }

  function ouvir() {
    mudar('ouvindo', 'ouvindo...');
    Cortex.Microfone.iniciar({
      nivel: Cortex.Olhos.nivel,
      fim: function (wav, segundos) {
        if (!wav) {
          mudar('ocioso', 'não ouvi nada &middot; toque para falar');
          return;
        }
        pensar(wav, segundos);
      }
    }, function (erro) {
      mudar('ocioso', 'sem acesso ao microfone');
      falar('Não consegui acessar o microfone. Verifique a permissão do Chrome.');
    });
  }

  function pensar(wav, segundos) {
    mudar('pensando', 'pensando...');
    Cortex.Cerebro.perguntar(wav, segundos, function (erro, resposta) {
      if (erro) {
        falar('Tive um problema para pensar. ' + erro);
      } else {
        falar(resposta);
      }
    });
  }

  function falar(texto) {
    mudar('falando', '');
    Cortex.Voz.falar(texto, function () {
      ultimoUso = Date.now();
      mudar('ocioso', 'toque para falar');
    });
  }

  function acordar() {
    mudar('ocioso', 'toque para falar');
    Cortex.Olhos.feliz(1500);
  }

  document.addEventListener('click', function () {
    telaCheia();
    ultimoUso = Date.now();
    if (estado === 'dormindo') {
      acordar();
    } else if (estado === 'ocioso') {
      ouvir();
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
