import type { MiddlewareNext } from 'astro';

// Middleware para proteger rutas de admin
export function onRequest(context, next: MiddlewareNext) {
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

  return next();
}
