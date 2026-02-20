import type { MiddlewareNext } from 'astro';

const STATIC_RE = /\.(js|css|png|jpg|jpeg|gif|webp|avif|svg|ico|woff2?|ttf|eot)$/i;

// Middleware para proteger rutas de admin + cache/security headers
export async function onRequest(context, next: MiddlewareNext) {
  const { pathname } = context.url;

  // Proteger TODAS las rutas /admin excepto /admin/login y /admin/admin-login
  // La validación de sesión se hace en servidor para todas las rutas admin
  if (pathname.startsWith('/admin') && 
      !pathname.startsWith('/admin/login') && 
      !pathname.startsWith('/admin/admin-login') &&
      !pathname.includes('.html')) {
    const session = context.cookies.get('session');
    
    if (!session) {
      return context.redirect('/admin/login');
    }
  }

  const response = await next();

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Content-Security-Policy - ajustar según necesidades
  if (!STATIC_RE.test(pathname)) {
    response.headers.set('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: blob: https://*.supabase.co https://*.stripe.com https://res.cloudinary.com; " +
      "connect-src 'self' https://*.supabase.co https://api.stripe.com https://api.brevo.com https://api.cloudinary.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
      "frame-src https://js.stripe.com https://hooks.stripe.com;"
    );
  }

  // Cache headers for static assets
  if (STATIC_RE.test(pathname) || pathname.startsWith('/images/') || pathname.startsWith('/css/') || pathname.startsWith('/js/') || pathname.startsWith('/fonts/')) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    response.headers.set('Vary', 'Accept-Encoding');
  }

  return response;
}
