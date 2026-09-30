// Voz do Cortex: usa a voz em portugues que ja vem no Android.
// O Chrome antigo corta falas longas, entao a resposta e dividida em frases curtas.
var Cortex = window.Cortex || {};
window.Cortex = Cortex;

Cortex.Voz = (function () {
  var sintese = window.speechSynthesis;
  var voz = null;
  var fila = [];
  var aoTerminar = null;
  var geracao = 0;       // muda a cada fala nova; ignora avisos de falas canceladas
  var emUso = [];        // referencias guardadas: sem isso o Chrome as vezes "perde" o onend
  var timerSeguranca = null;

  function escolherVoz() {
    if (!sintese) { return; }
    var vozes = sintese.getVoices();
    for (var i = 0; i < vozes.length; i++) {
      var lang = (vozes[i].lang || '').replace('_', '-').toLowerCase();
      if (lang === 'pt-br') { voz = vozes[i]; return; }
      if (!voz && lang.indexOf('pt') === 0) { voz = vozes[i]; }
    }
  }

  function dividir(texto) {
    var frases = texto.match(/[^.!?;:\n]+[.!?;:]*/g) || [texto];
    var partes = [];
    for (var i = 0; i < frases.length; i++) {
      var frase = frases[i].replace(/^\s+|\s+$/g, '');
      // Frase muito longa: quebra por palavras em pedacos de ate 180 letras
      while (frase.length > 180) {
        var corte = frase.lastIndexOf(' ', 180);
        if (corte < 1) { corte = 180; }
        partes.push(frase.substring(0, corte));
        frase = frase.substring(corte + 1);
      }
      if (frase) { partes.push(frase); }
    }
    return partes;
  }

  function terminou(minhaGeracao) {
    if (minhaGeracao !== geracao) { return; }
    clearTimeout(timerSeguranca);
    proxima();
  }

  function proxima() {
    if (!fila.length) {
      emUso = [];
      var cb = aoTerminar;
      aoTerminar = null;
      if (cb) { cb(); }
      return;
    }
    var trecho = fila.shift();
    var minhaGeracao = geracao;
    var u = new SpeechSynthesisUtterance(trecho);
    u.lang = 'pt-BR';
    if (voz) { u.voice = voz; }
    u.onend = function () { terminou(minhaGeracao); };
    u.onerror = function () { terminou(minhaGeracao); };
    emUso.push(u);
    sintese.speak(u);
    // Se o onend nunca chegar (bug do Chrome antigo), segue em frente mesmo assim
    timerSeguranca = setTimeout(function () { terminou(minhaGeracao); }, trecho.length * 110 + 3000);
  }

  function falar(texto, cb) {
    if (!sintese) {
      if (cb) { setTimeout(cb, 0); }
      return;
    }
    parar();
    if (!voz) { escolherVoz(); }
    fila = dividir(texto);
    aoTerminar = cb;
    proxima();
  }

  function parar() {
    geracao++;
    clearTimeout(timerSeguranca);
    fila = [];
    aoTerminar = null;
    if (sintese) { sintese.cancel(); }
  }

  if (sintese) {
    escolherVoz();
    sintese.onvoiceschanged = escolherVoz;
  }

  return {
    falar: falar,
    parar: parar
  };
})();
