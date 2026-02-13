import type { MiddlewareNext } from 'astro';

const STATIC_RE = /\.(js|css|png|jpg|jpeg|gif|webp|avif|svg|ico|woff2?|ttf|eot)$/i;

// Middleware para proteger rutas de admin + cache/security headers
export async function onRequest(context, next: MiddlewareNext) {
  const { pathname } = context.url;

  // NO proteger /admin/panel, /admin/pedidos ni /admin/login - la validación ocurre en cliente
  // Tampoco proteger archivos estáticos como /admin-login.html
  if (pathname.startsWith('/admin') && 
      !pathname.startsWith('/admin/login') && 
      !pathname.startsWith('/admin/panel') &&
      !pathname.startsWith('/admin/pedidos') &&
      !pathname.includes('.html')) {
    const session = context.cookies.get('session');
    
    if (!session) {
      return context.redirect('/admin-login.html');
    }
  }

  const response = await next();

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Cache headers for static assets
  if (STATIC_RE.test(pathname) || pathname.startsWith('/images/') || pathname.startsWith('/css/') || pathname.startsWith('/js/') || pathname.startsWith('/fonts/')) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    response.headers.set('Vary', 'Accept-Encoding');
  }

  return response;
}
