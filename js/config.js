// Endereco do servidor do Cortex (sem barra no final).
// Relativo: a pagina e o servidor ficam no mesmo endereco,
// http://cortex.jp-cortex.workers.dev (HTTP porque o tablet antigo nao
// confia em nenhum certificado moderno).
var Cortex = window.Cortex || {};
window.Cortex = Cortex;

Cortex.SERVIDOR = '/api';

// A copia no GitHub Pages nao tem servidor: manda para o endereco certo
if (/github\.io$/.test(location.hostname)) {
  location.replace('http://cortex.jp-cortex.workers.dev' + location.pathname.replace(/^\/cortex/, ''));
}
