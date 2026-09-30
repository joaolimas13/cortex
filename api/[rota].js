// Vercel: atende /api/ping e /api/perguntar com o mesmo codigo de src/index.js.
// Usamos a Vercel porque o *.vercel.app entrega certificado RSA com raiz GlobalSign,
// que o Android 4.2 do tablet aceita (workers.dev e pages.dev so entregam ECDSA).
import app from '../servidor/src/index.js';

function atender(request) {
  return app.fetch(request, process.env);
}

export { atender as GET, atender as POST, atender as OPTIONS };
