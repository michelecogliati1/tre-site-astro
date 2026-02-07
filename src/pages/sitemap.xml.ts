import type { APIRoute } from 'astro';

// ============================================
// CONFIGURAZIONE BASE
// ============================================
const baseUrl = 'https://www.ristorantepizzeriatre.it';

const STATIC_PAGES = [
  { url: '/', priority: 1.0, changefreq: 'weekly' },
  { url: '/menu-pizze/', priority: 0.9, changefreq: 'monthly' },
  { url: '/menu-alla-carta/', priority: 0.9, changefreq: 'monthly' },
  { url: '/menu-asporto/', priority: 0.9, changefreq: 'monthly' },
  { url: '/menu-del-giorno/', priority: 0.8, changefreq: 'daily' },
  { url: '/cene-a-tema/', priority: 0.8, changefreq: 'weekly' },
  { url: '/compleanni/', priority: 0.7, changefreq: 'monthly' },
  { url: '/battesimi-comunioni-cresime/', priority: 0.7, changefreq: 'monthly' },
  { url: '/lauree/', priority: 0.7, changefreq: 'monthly' },
  { url: '/anniversari/', priority: 0.7, changefreq: 'monthly' },
  { url: '/meeting-cene-aziendali/', priority: 0.7, changefreq: 'monthly' },
  { url: '/chi-siamo/', priority: 0.6, changefreq: 'yearly' },
  { url: '/contatti/', priority: 0.8, changefreq: 'monthly' },
  { url: '/privacy-policy/', priority: 0.3, changefreq: 'yearly' },
  { url: '/cookie-policy/', priority: 0.3, changefreq: 'yearly' },
  { url: '/sitemap/', priority: 0.4, changefreq: 'monthly' },
];

// ============================================
// FUNZIONI DI DISCOVERY AUTOMATICA
// ============================================

async function getCeneATema() {
  try {
    const ceneFiles = import.meta.glob('/src/pages/cene-a-tema/**/*.astro');
    
    const cene = [];
    for (const path in ceneFiles) {
      const urlPath = path
        .replace('/src/pages', '')
        .replace('/index.astro', '/')
        .replace('.astro', '/');
      
      // Salta se è la landing page principale
      if (urlPath === '/cene-a-tema/') continue;
      
      cene.push({
        url: urlPath,
        priority: 0.8,
        changefreq: 'weekly'
      });
    }
    
    return cene;
  } catch (error) {
    console.error('Errore recupero cene a tema:', error);
    return [];
  }
}

async function getBlogContent() {
  try {
    const blogFiles = import.meta.glob('/src/pages/tradizione/**/*.{astro,md}');
    
    const pages = {
      landing: null,
      categories: [],
      articles: []
    };
    
    for (const path in blogFiles) {
      const urlPath = path
        .replace('/src/pages', '')
        .replace('/index.astro', '/')
        .replace('/index.md', '/')
        .replace('.astro', '/')
        .replace('.md', '/');
      
      // Conta il livello di profondità
      const segments = urlPath.split('/').filter(p => p);
      const depth = segments.length;
      
      if (urlPath === '/tradizione/') {
        // Landing blog principale
        pages.landing = {
          url: urlPath,
          priority: 0.7,
          changefreq: 'weekly'
        };
      } else if (depth === 2) {
        // Category pages: /tradizione/ingredienti/
        pages.categories.push({
          url: urlPath,
          priority: 0.65, // Leggermente meno della landing
          changefreq: 'weekly' // Si aggiornano quando aggiungi articoli
        });
      } else if (depth >= 3) {
        // Articoli: /tradizione/ingredienti/mozzarella/
        pages.articles.push({
          url: urlPath,
          priority: 0.6,
          changefreq: 'monthly'
        });
      }
    }
    
    return pages;
  } catch (error) {
    console.error('Errore recupero contenuti blog:', error);
    return { landing: null, categories: [], articles: [] };
  }
}

async function getNewPages() {
  try {
    const newPages = import.meta.glob('/src/pages/*.astro');
    
    const EXCLUDE_PAGES = [
      '404',
      '500', 
      'sitemap.xml',
      'robots.txt',
      '_',
    ];
    
    const pages = [];
    for (const path in newPages) {
      const urlPath = path
        .replace('/src/pages', '')
        .replace('/index.astro', '/')
        .replace('.astro', '/');
      
      const pageName = urlPath.replace(/\//g, '');
      
      const shouldExclude = 
        EXCLUDE_PAGES.some(exclude => pageName.startsWith(exclude)) ||
        STATIC_PAGES.some(p => p.url === urlPath) ||
        urlPath === '/';
      
      if (!shouldExclude) {
        pages.push({
          url: urlPath,
          priority: 0.7,
          changefreq: 'monthly'
        });
      }
    }
    
    return pages;
  } catch (error) {
    console.error('Errore recupero nuove pagine:', error);
    return [];
  }
}

// ============================================
// ENDPOINT SITEMAP
// ============================================
export const GET: APIRoute = async () => {
  const today = new Date().toISOString().split('T')[0];
  
  // Recupera TUTTE le pagine dinamicamente
  const [ceneATema, blogContent, newPages] = await Promise.all([
    getCeneATema(),
    getBlogContent(),
    getNewPages()
  ]);
  
  // Costruisci array blog completo
  const blogPages = [];
  if (blogContent.landing) blogPages.push(blogContent.landing);
  blogPages.push(...blogContent.categories);
  blogPages.push(...blogContent.articles);
  
  // Log per debug
  console.log(`📊 Sitemap generata:`);
  console.log(`  - Pagine statiche: ${STATIC_PAGES.length}`);
  console.log(`  - Cene a tema: ${ceneATema.length}`);
  console.log(`  - Blog landing: ${blogContent.landing ? 1 : 0}`);
  console.log(`  - Blog categories: ${blogContent.categories.length}`);
  console.log(`  - Blog articles: ${blogContent.articles.length}`);
  console.log(`  - Nuove pagine: ${newPages.length}`);
  console.log(`  - TOTALE: ${STATIC_PAGES.length + ceneATema.length + blogPages.length + newPages.length}`);
  
  // Combina tutto
  const allPages = [
    ...STATIC_PAGES.map(page => ({
      ...page,
      lastmod: today
    })),
    ...ceneATema.map(cena => ({
      ...cena,
      lastmod: today
    })),
    ...blogPages.map(page => ({
      ...page,
      lastmod: today
    })),
    ...newPages.map(page => ({
      ...page,
      lastmod: today
    }))
  ];
  
  // Genera XML
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(page => `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};