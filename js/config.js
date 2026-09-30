// Endereco do servidor do Cortex (sem barra no final).
// Relativo: a pagina e o servidor ficam no mesmo endereco
// (Cloudflare: http://cortex.jp-cortex.workers.dev, ou a copia na Vercel).
var Cortex = window.Cortex || {};
window.Cortex = Cortex;

Cortex.SERVIDOR = '/api';
