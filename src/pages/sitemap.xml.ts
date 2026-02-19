import { supabase } from '../lib/supabase';

export async function GET() {
  const site = 'https://galiana.victoriafp.online';

  // Páginas estáticas públicas
  const staticPages = [
    { url: '/', changefreq: 'daily', priority: '1.0' },
    { url: '/productos', changefreq: 'daily', priority: '0.9' },
    { url: '/signup', changefreq: 'monthly', priority: '0.5' },
    { url: '/cookies', changefreq: 'yearly', priority: '0.2' },
    { url: '/politicas-privacidad', changefreq: 'yearly', priority: '0.2' },
    { url: '/terminos-condiciones', changefreq: 'yearly', priority: '0.2' },
    { url: '/seguimiento-paquetes', changefreq: 'monthly', priority: '0.4' },
  ];

  // Obtener productos activos
  let productEntries: { url: string; changefreq: string; priority: string }[] = [];
  try {
    const { data: products } = await supabase
      .from('products')
      .select('id')
      .gt('stock', 0);

    if (products) {
      productEntries = products.map((p) => ({
        url: `/productos/${p.id}`,
        changefreq: 'weekly',
        priority: '0.8',
      }));
    }
  } catch (e) {
    console.error('[sitemap] Error fetching products:', e);
  }

  // Obtener categorías únicas
  let categoryEntries: { url: string; changefreq: string; priority: string }[] = [];
  try {
    const { data: categories } = await supabase
      .from('products')
      .select('categoria')
      .gt('stock', 0);

    if (categories) {
      const uniqueCategories = [...new Set(categories.map((c) => c.categoria).filter(Boolean))];
      categoryEntries = uniqueCategories.map((cat) => ({
        url: `/categoria/${encodeURIComponent(cat)}`,
        changefreq: 'weekly',
        priority: '0.7',
      }));
    }
  } catch (e) {
    console.error('[sitemap] Error fetching categories:', e);
  }

  const allPages = [...staticPages, ...productEntries, ...categoryEntries];
  const today = new Date().toISOString().split('T')[0];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map(
    (page) => `  <url>
    <loc>${site}${page.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
