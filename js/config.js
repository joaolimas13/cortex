// Endereco do servidor do Cortex (sem barra no final).
// Relativo: a pagina e o servidor ficam no mesmo endereco,
// https://cortex.jp-cortex.workers.dev
var Cortex = window.Cortex || {};
window.Cortex = Cortex;

Cortex.SERVIDOR = '/api';

(function () {
  var CASA = 'cortex.jp-cortex.workers.dev';
  var moderno = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  var caminho = location.pathname;

  if (/github\.io$/.test(location.hostname)) {
    // A copia no GitHub Pages nao tem servidor: manda para o endereco certo.
    // O tablet antigo (Chrome 34) nao confia no certificado, entao ele vai por HTTP.
    location.replace((moderno ? 'https://' : 'http://') + CASA + caminho.replace(/^\/cortex/, ''));
  } else if (moderno && location.protocol === 'http:' && location.hostname === CASA) {
    // iPad/navegador moderno: so libera o microfone em HTTPS
    location.replace('https://' + CASA + caminho + location.search);
  }
})();
