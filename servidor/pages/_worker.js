// Cloudflare Pages (pages.dev) em vez de Workers (workers.dev):
// o pages.dev ainda entrega certificado RSA, que o Android 4.2 do tablet aceita.
// O codigo do servidor e o mesmo de src/index.js.
export { default } from '../src/index.js';
