// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

// NOTA SUI REDIRECT (settembre 2026)
//
// I redirect "storici" stanno in vercel.json e funzionano (rispondono 308).
// NON aggiungere però lì i redirect di pagine indicizzate con lo slash
// finale: un `source` tipo "/compleanni/:path*" non matcha "/compleanni/"
// (segmento vuoto) e l'URL resta in 404. Stessa trappola con i `redirects`
// di Astro, che generano route ancorate senza slash opzionale (^/compleanni$).
//
// Per quei casi si usa una pagina-tombstone che fa Astro.redirect(): la sua
// route viene generata come ^/compleanni/?$ e copre entrambe le forme.
// Vedi src/pages/compleanni/index.astro e le altre quattro pagine evento.

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel({})  // ⚠️ Oggetto vuoto richiesto
});
