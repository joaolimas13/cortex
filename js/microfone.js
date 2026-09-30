// Microfone do Cortex.
// O Chrome 34 do tablet nao tem MediaRecorder, entao capturamos o som cru
// com o AudioContext e montamos um arquivo WAV na mao (testado no teste.html).
// Tambem detecta quando voce parou de falar, para encerrar sozinho.
var Cortex = window.Cortex || {};
window.Cortex = Cortex;

Cortex.Microfone = (function () {
  var TAXA_WAV = 16000;       // 16 kHz basta para voz e deixa o arquivo pequeno
  var LIMIAR_MIN = 0.012;     // volume minimo (RMS) para contar como fala
  var SILENCIO_MS = 1500;     // parou de falar por esse tempo -> encerra
  var SEM_FALA_MS = 7000;     // ninguem falou nada -> desiste
  var MAX_MS = 20000;         // limite de uma pergunta
  var CALIBRAR_MS = 300;      // inicio da gravacao serve para medir o ruido do ambiente

  var AudioCtx = window.AudioContext || window.webkitAudioContext;
  var ctx = null;
  var stream = null;
  var fonte = null;
  var processador = null;

  var gravando = false;
  var blocos = [];
  var ruido = 0.005;
  var inicio = 0;
  var ultimaFala = 0;
  var falou = false;
  var ouvintes = null;

  function pedirPermissao(sucesso, erro) {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(sucesso, erro);
      return;
    }
    var antigo = navigator.webkitGetUserMedia || navigator.getUserMedia;
    if (!antigo) {
      erro({ name: 'SemMicrofone', message: 'navegador sem acesso ao microfone' });
      return;
    }
    antigo.call(navigator, { audio: true }, sucesso, erro);
  }

  // Abre o microfone uma vez e deixa ligado: assim as proximas perguntas comecam na hora
  function preparar(pronto, erro) {
    if (processador) {
      pronto();
      return;
    }
    // Cria o AudioContext ainda dentro do toque (o Safari exige), antes de pedir o microfone
    if (!ctx) { ctx = new AudioCtx(); }
    if (ctx.state === 'suspended' && ctx.resume) { ctx.resume(); }
    pedirPermissao(function (s) {
      stream = s;
      fonte = ctx.createMediaStreamSource(stream);
      var criar = ctx.createScriptProcessor || ctx.createJavaScriptNode;
      processador = criar.call(ctx, 4096, 1, 1);
      processador.onaudioprocess = processar;
      fonte.connect(processador);
      processador.connect(ctx.destination);
      pronto();
    }, erro);
  }

  function processar(e) {
    var dados = e.inputBuffer.getChannelData(0);
    var soma = 0;
    for (var i = 0; i < dados.length; i++) { soma += dados[i] * dados[i]; }
    var rms = Math.sqrt(soma / dados.length);

    if (!gravando) {
      // Parado: vai aprendendo o barulho do ambiente
      ruido = ruido * 0.9 + rms * 0.1;
      return;
    }

    blocos.push(new Float32Array(dados));
    var agora = Date.now();
    var limiar = Math.max(LIMIAR_MIN, ruido * 2.5);

    if (!falou && agora - inicio < CALIBRAR_MS) {
      ruido = ruido * 0.5 + rms * 0.5;
    } else if (rms > limiar) {
      falou = true;
      ultimaFala = agora;
    }

    if (ouvintes && ouvintes.nivel) {
      ouvintes.nivel(Math.min(1, rms / (limiar * 4)));
    }

    if (falou && agora - ultimaFala > SILENCIO_MS) {
      terminar(false);
    } else if (!falou && agora - inicio > SEM_FALA_MS) {
      terminar(false);
    } else if (agora - inicio > MAX_MS) {
      terminar(false);
    }
  }

  function terminar(forcado) {
    if (!gravando) { return; }
    gravando = false;
    var fim = ouvintes && ouvintes.fim;
    var segundos = (Date.now() - inicio) / 1000;
    var wav = null;
    // Parada manual com pelo menos meio segundo tambem vale, mesmo baixinho
    if (falou || (forcado && segundos > 0.5)) {
      wav = montarWav(blocos, ctx.sampleRate);
    }
    blocos = [];
    ouvintes = null;
    // Sai da funcao de audio antes de avisar o app
    setTimeout(function () {
      if (fim) { fim(wav, segundos); }
    }, 0);
  }

  function montarWav(lista, taxaOriginal) {
    var total = 0;
    var i, j;
    for (i = 0; i < lista.length; i++) { total += lista[i].length; }
    var tudo = new Float32Array(total);
    var pos = 0;
    for (i = 0; i < lista.length; i++) { tudo.set(lista[i], pos); pos += lista[i].length; }

    // Reduz a taxa (ex.: 44100 -> 16000) tirando a media de cada trecho
    var razao = taxaOriginal / TAXA_WAV;
    var tamanho = Math.floor(total / razao);
    var amostras = new Int16Array(tamanho);
    for (i = 0; i < tamanho; i++) {
      var ini = Math.floor(i * razao);
      var fim = Math.min(Math.floor((i + 1) * razao), total);
      var soma = 0;
      for (j = ini; j < fim; j++) { soma += tudo[j]; }
      var v = fim > ini ? soma / (fim - ini) : 0;
      v = Math.max(-1, Math.min(1, v));
      amostras[i] = v < 0 ? v * 0x8000 : v * 0x7FFF;
    }

    // Cabecalho WAV padrao (PCM 16 bits, mono)
    var buffer = new ArrayBuffer(44 + amostras.length * 2);
    var d = new DataView(buffer);
    function texto(off, s) {
      for (var k = 0; k < s.length; k++) { d.setUint8(off + k, s.charCodeAt(k)); }
    }
    texto(0, 'RIFF');
    d.setUint32(4, 36 + amostras.length * 2, true);
    texto(8, 'WAVE');
    texto(12, 'fmt ');
    d.setUint32(16, 16, true);
    d.setUint16(20, 1, true);
    d.setUint16(22, 1, true);
    d.setUint32(24, TAXA_WAV, true);
    d.setUint32(28, TAXA_WAV * 2, true);
    d.setUint16(32, 2, true);
    d.setUint16(34, 16, true);
    texto(36, 'data');
    d.setUint32(40, amostras.length * 2, true);
    for (i = 0; i < amostras.length; i++) { d.setInt16(44 + i * 2, amostras[i], true); }
    return new Blob([buffer], { type: 'audio/wav' });
  }

  // ouv = { nivel: function (0..1), fim: function (wavOuNull, segundos) }
  function iniciar(ouv, erro) {
    if (!AudioCtx) {
      erro({ name: 'SemAudioContext', message: 'navegador sem AudioContext' });
      return;
    }
    preparar(function () {
      // Safari (iPad/iPhone) cria o AudioContext "pausado": precisa retomar dentro do toque
      if (ctx.state === 'suspended' && ctx.resume) { ctx.resume(); }
      blocos = [];
      falou = false;
      inicio = Date.now();
      ultimaFala = inicio;
      ouvintes = ouv;
      gravando = true;
    }, erro);
  }

  function parar() {
    terminar(true);
  }

  return {
    iniciar: iniciar,
    parar: parar
  };
})();
