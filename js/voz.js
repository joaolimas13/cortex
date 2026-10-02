// Voz do Cortex: usa a melhor voz em portugues instalada no aparelho (iPad: Luciana).
// Navegadores cortam falas longas, entao a resposta e dividida em frases curtas.
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

  // Nota de cada voz: portugues do Brasil primeiro, e entre elas as versoes
  // "Aprimorada"/"Premium" do iPad, que soam bem mais naturais que a padrao.
  function nota(v) {
    var lang = (v.lang || '').replace('_', '-').toLowerCase();
    if (lang.indexOf('pt') !== 0) { return -1; }
    var nome = (v.name || '').toLowerCase();
    var pontos = lang === 'pt-br' ? 10 : 0;
    if (/premium/.test(nome)) { pontos += 5; }
    else if (/aprimorad|enhanced|melhorad/.test(nome)) { pontos += 4; }
    if (/luciana|felipe|google/.test(nome)) { pontos += 1; }
    // Vozes "engracadas" do iOS (Eddy, Grandma, Rocko...) ficam por ultimo
    if (/eddy|flo|grand|reed|rocko|sandy|shelley/.test(nome)) { pontos -= 8; }
    return pontos;
  }

  function escolherVoz() {
    if (!sintese) { return; }
    var vozes = sintese.getVoices();
    var melhor = -1;
    for (var i = 0; i < vozes.length; i++) {
      var n = nota(vozes[i]);
      if (n > melhor) { melhor = n; voz = vozes[i]; }
    }
  }

  function nomeDaVoz() {
    return voz ? voz.name + ' (' + voz.lang + ')' : 'padrão do sistema';
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

  // Safari so deixa falar depois que a primeira fala acontece dentro de um toque.
  // Uma fala vazia no primeiro toque "destrava" a voz para as respostas depois.
  var destravada = false;
  function destravar() {
    if (destravada || !sintese) { return; }
    destravada = true;
    var u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    sintese.speak(u);
  }

  if (sintese) {
    escolherVoz();
    sintese.onvoiceschanged = escolherVoz;
  }

  return {
    falar: falar,
    parar: parar,
    destravar: destravar,
    nomeDaVoz: nomeDaVoz
  };
})();
