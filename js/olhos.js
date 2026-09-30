// Olhos do Cortex: estados, piscadas, olhadas para os lados e reacao a voz.
var Cortex = window.Cortex || {};
window.Cortex = Cortex;

Cortex.Olhos = (function () {
  var rosto = document.getElementById('rosto');
  var grupo = document.getElementById('olhos');
  var olhos = grupo.querySelectorAll('.olho');

  var estadoAtual = 'ocioso';
  var olharX = 0;   // em vmin (1 = 1% do menor lado da tela)
  var olharY = 0;
  var escala = 1;
  var timerFeliz = null;

  function vmin() {
    return Math.min(window.innerWidth, window.innerHeight) / 100;
  }

  function aplicar() {
    var t = 'translate(' + Math.round(olharX * vmin()) + 'px,' + Math.round(olharY * vmin()) + 'px) scale(' + escala + ')';
    grupo.style.webkitTransform = t;
    grupo.style.transform = t;
  }

  function olhar(x, y) {
    olharX = x;
    olharY = y;
    aplicar();
  }

  function piscar() {
    if (estadoAtual === 'dormindo') { return; }
    for (var i = 0; i < olhos.length; i++) { olhos[i].className += ' piscando'; }
    setTimeout(function () {
      for (var i = 0; i < olhos.length; i++) {
        olhos[i].className = olhos[i].className.replace(' piscando', '');
      }
    }, 120);
  }

  function aleatorio(min, max) {
    return min + Math.random() * (max - min);
  }

  // Piscadas: de vez em quando uma piscada dupla, como gente
  function cicloPiscar() {
    piscar();
    if (Math.random() < 0.2) { setTimeout(piscar, 250); }
    setTimeout(cicloPiscar, aleatorio(2000, 6000));
  }

  // Olhadas: so quando esta parado ou pensando
  function cicloOlhar() {
    if (estadoAtual === 'ocioso') {
      if (Math.random() < 0.6) {
        olhar(aleatorio(-10, 10), aleatorio(-5, 5));
        setTimeout(function () {
          if (estadoAtual === 'ocioso') { olhar(0, 0); }
        }, aleatorio(800, 2000));
      }
    } else if (estadoAtual === 'pensando') {
      olhar(olharX > 0 ? -8 : 8, -8);
    }
    setTimeout(cicloOlhar, aleatorio(1500, 4000));
  }

  function estado(nome) {
    estadoAtual = nome;
    var feliz = rosto.className.indexOf('feliz') >= 0 ? ' feliz' : '';
    rosto.className = 'estado-' + nome + feliz;
    escala = 1;
    if (nome === 'pensando') {
      olhar(8, -8);
    } else {
      olhar(0, 0);
    }
  }

  // Volume da voz (0 a 1) enquanto ouve: os olhos "crescem" com o som
  function nivel(v) {
    if (estadoAtual !== 'ouvindo') { return; }
    escala = 1 + v * 0.12;
    aplicar();
  }

  function feliz(ms) {
    if (rosto.className.indexOf('feliz') < 0) { rosto.className += ' feliz'; }
    clearTimeout(timerFeliz);
    timerFeliz = setTimeout(function () {
      rosto.className = rosto.className.replace(' feliz', '');
    }, ms || 1500);
  }

  window.addEventListener('resize', aplicar);
  setTimeout(cicloPiscar, 1500);
  setTimeout(cicloOlhar, 3000);

  return {
    estado: estado,
    nivel: nivel,
    feliz: feliz,
    piscar: piscar
  };
})();
