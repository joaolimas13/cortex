// Cerebro do Cortex: envia o audio para o servidor na Cloudflare, que pergunta ao Gemini.
// Usa XMLHttpRequest (o Chrome 34 do tablet nao tem fetch) e FileReader para o base64.
var Cortex = window.Cortex || {};
window.Cortex = Cortex;

Cortex.Cerebro = (function () {
  var MAX_HISTORICO = 10;          // falas recentes enviadas junto, para ele lembrar da conversa
  var CHAVE_CODIGO = 'cortex-codigo';
  var historico = [];

  function lerCodigo() {
    try { return localStorage.getItem(CHAVE_CODIGO) || ''; } catch (e) { return ''; }
  }

  function salvarCodigo(codigo) {
    try {
      if (codigo) { localStorage.setItem(CHAVE_CODIGO, codigo); }
      else { localStorage.removeItem(CHAVE_CODIGO); }
    } catch (e) {}
  }

  function pedirCodigo() {
    var codigo = lerCodigo();
    if (!codigo) {
      codigo = window.prompt('Código de acesso do Cortex (só na primeira vez):') || '';
      codigo = codigo.replace(/^\s+|\s+$/g, '');
      salvarCodigo(codigo);
    }
    return codigo;
  }

  function paraBase64(blob, pronto) {
    var leitor = new FileReader();
    leitor.onload = function () {
      // "data:audio/wav;base64,AAAA..." -> fica so com o "AAAA..."
      var url = leitor.result;
      pronto(url.substring(url.indexOf(',') + 1));
    };
    leitor.readAsDataURL(blob);
  }

  function lembrar(quem, texto) {
    if (!texto) { return; }
    historico.push({ quem: quem, texto: texto });
    if (historico.length > MAX_HISTORICO) { historico.shift(); }
  }

  // cb(erro, resposta, transcricao)
  function perguntar(wav, segundos, cb) {
    if (!Cortex.SERVIDOR) {
      cb('O servidor ainda não foi configurado.');
      return;
    }
    var codigo = pedirCodigo();
    if (!codigo) {
      cb('Preciso do código de acesso para funcionar.');
      return;
    }

    paraBase64(wav, function (audio) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', Cortex.SERVIDOR + '/perguntar', true);
      // text/plain = requisicao "simples", sem preflight de CORS
      xhr.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8');
      xhr.timeout = 30000;
      xhr.onload = function () {
        var dados = null;
        try { dados = JSON.parse(xhr.responseText); } catch (e) {}
        if (xhr.status === 401) {
          salvarCodigo('');
          cb('O código de acesso está errado. Toque de novo para digitar outro.');
        } else if (!dados) {
          cb('O servidor respondeu algo que eu não entendi.');
        } else if (dados.erro) {
          cb(dados.erro);
        } else {
          lembrar('eu', dados.transcricao);
          lembrar('cortex', dados.resposta);
          cb(null, dados.resposta, dados.transcricao);
        }
      };
      xhr.onerror = function () {
        cb('Não consegui me conectar à internet ou ao servidor.');
      };
      xhr.ontimeout = function () {
        cb('O servidor demorou demais para responder.');
      };
      xhr.send(JSON.stringify({ codigo: codigo, audio: audio, historico: historico }));
    });
  }

  return {
    perguntar: perguntar
  };
})();
