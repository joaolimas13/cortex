// Cerebro do Cortex: recebe o audio do tablet, pergunta ao Gemini e devolve o texto.
//
// GET  /ping       -> teste de conexao (o tablet antigo consegue falar com a gente?)
// POST /perguntar  -> corpo JSON { codigo, audio (WAV em base64), historico: [{ quem, texto }] }
//                     resposta   { transcricao, resposta }  ou  { erro }
//
// O tablet manda o corpo como text/plain de proposito: assim o navegador antigo
// faz uma requisicao "simples", sem a etapa extra de CORS (preflight).

const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
const MAX_HISTORICO = 10;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(dados, status = 200) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  });
}

function instrucoes() {
  const agora = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'full',
    timeStyle: 'short',
  });
  return [
    'Você é o Cortex, o assistente pessoal de voz do João Pedro.',
    'Seu corpo é um robô em construção e seu rosto é um tablet antigo.',
    'Você recebe a fala dele como áudio. Primeiro transcreva exatamente o que ele disse, depois responda.',
    'Sua resposta vai ser FALADA por uma voz sintética, então:',
    '- responda em português do Brasil, de forma natural e amigável;',
    '- seja breve: 1 a 3 frases, a não ser que ele peça explicação detalhada;',
    '- nada de markdown, listas, asteriscos, emojis ou links;',
    '- escreva números e siglas de um jeito fácil de falar.',
    'Se o áudio estiver vazio ou incompreensível, peça com gentileza para ele repetir.',
    `Data e hora atuais em Brasília: ${agora}.`,
  ].join('\n');
}

// Modelo reserva: se o principal estiver sobrecarregado (erro 503), tenta o Flash-Lite
const MODELO_RESERVA = 'gemini-flash-lite-latest';

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Tenta o modelo principal (2 vezes) e depois o reserva, enquanto o erro for de sobrecarga
async function chamarComInsistencia(env, conteudos) {
  const tentativas = [
    { modelo: env.MODELO || 'gemini-flash-latest', esperaAntes: 0 },
    { modelo: env.MODELO || 'gemini-flash-latest', esperaAntes: 1000 },
    { modelo: MODELO_RESERVA, esperaAntes: 0 },
  ];
  let resp;
  for (const t of tentativas) {
    if (t.esperaAntes) await espera(t.esperaAntes);
    resp = await chamarGemini(env, t.modelo, conteudos, true);
    if (resp.status === 400) {
      // Alguns modelos nao aceitam desligar o pensamento: tenta de novo sem essa opcao
      console.log('Gemini 400 com thinkingBudget, tentando sem', t.modelo, await resp.text());
      resp = await chamarGemini(env, t.modelo, conteudos, false);
    }
    if (resp.status !== 500 && resp.status !== 503) return resp;
    console.log('Gemini sobrecarregado', t.modelo, resp.status, await resp.text());
  }
  return resp;
}

async function chamarGemini(env, modelo, conteudos, semThinking) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;
  const config = {
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'OBJECT',
      properties: {
        transcricao: { type: 'STRING' },
        resposta: { type: 'STRING' },
      },
      required: ['transcricao', 'resposta'],
    },
    maxOutputTokens: 1024,
  };
  // Pensamento desligado = resposta mais rapida (importa num assistente de voz)
  if (semThinking) {
    config.thinkingConfig = { thinkingBudget: 0 };
  }
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: instrucoes() }] },
      contents: conteudos,
      generationConfig: config,
    }),
  });
}

async function perguntar(request, env) {
  let corpo;
  try {
    corpo = JSON.parse(await request.text());
  } catch {
    return json({ erro: 'pedido inválido' }, 400);
  }

  if (!env.CORTEX_CODIGO || corpo.codigo !== env.CORTEX_CODIGO) {
    return json({ erro: 'código de acesso errado' }, 401);
  }
  if (typeof corpo.audio !== 'string' || !corpo.audio) {
    return json({ erro: 'áudio ausente' }, 400);
  }
  if (corpo.audio.length * 0.75 > MAX_AUDIO_BYTES) {
    return json({ erro: 'áudio grande demais' }, 413);
  }

  // Conversa recente em texto, para ele lembrar do que acabou de ser dito
  const historico = Array.isArray(corpo.historico) ? corpo.historico.slice(-MAX_HISTORICO) : [];
  const conteudos = historico
    .filter((m) => m && typeof m.texto === 'string' && m.texto)
    .map((m) => ({
      role: m.quem === 'cortex' ? 'model' : 'user',
      parts: [{ text: m.quem === 'cortex' ? JSON.stringify({ transcricao: '', resposta: m.texto }) : m.texto }],
    }));
  conteudos.push({
    role: 'user',
    parts: [{ inline_data: { mime_type: 'audio/wav', data: corpo.audio } }],
  });

  const resp = await chamarComInsistencia(env, conteudos);
  // Mensagens de erro em frases faceis de ouvir (sao faladas pela voz do tablet)
  if (resp.status === 429) {
    return json({ erro: 'Atingi o limite grátis do Gemini. Tente de novo daqui a pouco.' }, 429);
  }
  if (resp.status === 500 || resp.status === 503) {
    return json({ erro: 'O Gemini está sobrecarregado agora. Tente de novo em alguns segundos.' }, 503);
  }
  if (!resp.ok) {
    const detalhe = await resp.text();
    console.log('Gemini erro', resp.status, detalhe);
    return json({ erro: 'O Gemini recusou o pedido, código ' + resp.status + '.' }, 502);
  }

  const dados = await resp.json();
  const texto = dados?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  try {
    const saida = JSON.parse(texto);
    return json({ transcricao: saida.transcricao || '', resposta: saida.resposta || 'Não consegui pensar em uma resposta.' });
  } catch {
    return json({ transcricao: '', resposta: texto || 'Não consegui pensar em uma resposta.' });
  }
}

export default {
  async fetch(request, env) {
    // endsWith: na Vercel as rotas ficam em /api/ping e /api/perguntar
    const { pathname } = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }
    if (pathname.endsWith('/pixel')) {
      // Imagem 1x1 para diagnostico: <img> nao depende de CORS, so da conexao segura
      const gif = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), (c) => c.charCodeAt(0));
      return new Response(gif, { headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' } });
    }
    if (pathname.endsWith('/ping')) {
      return json({ ok: true, nome: 'Cortex', configurado: !!(env.GEMINI_API_KEY && env.CORTEX_CODIGO) });
    }
    if (pathname.endsWith('/perguntar') && request.method === 'POST') {
      try {
        return await perguntar(request, env);
      } catch (e) {
        console.log('erro inesperado', e);
        return json({ erro: 'erro interno do servidor' }, 500);
      }
    }
    return json({ erro: 'não encontrado' }, 404);
  },
};
