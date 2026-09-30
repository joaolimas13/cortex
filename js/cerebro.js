// Cerebro do Cortex.
// ETAPA 1: ainda e um "cerebro de mentira" que so confirma que ouviu.
// Na etapa 2 esta funcao vai enviar o WAV para o servidor na Cloudflare,
// que conversa com o Gemini e devolve a resposta em texto.
var Cortex = window.Cortex || {};
window.Cortex = Cortex;

Cortex.Cerebro = (function () {
  // cb(erro, textoDaResposta)
  function perguntar(wav, segundos, cb) {
    var kb = Math.round(wav.size / 1024);
    setTimeout(function () {
      cb(null, 'Eu ouvi você por ' + Math.round(segundos) + ' segundos, ' + kb + ' quilobytes de áudio. ' +
        'Ainda não tenho cérebro. Na próxima etapa vou me conectar ao Gemini para te responder de verdade.');
    }, 1500);
  }

  return {
    perguntar: perguntar
  };
})();
