/**
 * Utility per fetchare i dati dei menù da Google Sheets
 * + Sistema Popup/Banner Eventi Temporizzati
 * + Sistema Cene Passate
 */

// 🔧 CONFIGURAZIONE - Sostituisci con i tuoi valori
export const GOOGLE_SHEET_ID = "1l5TrtAa3erPpNfpIcUqOlqSVJCoRqKAFHd7VLf6Cj7U";

export const SHEET_GIDS = {
  menuPizze: "1125677232",
  menuCarta: "282322300",
  menuAsporto: "1494757887",
  ceneTema: "1523677758",
  popupBanner: "1486895463",
  cenePassate: "944245654"  // <-- Aggiorna con il GID del nuovo foglio
};

// =============================================================================
// INTERFACCE ESISTENTI
// =============================================================================

export interface MenuItem {
  categoria: string;
  nome: string;
  descrizione: string;
  prezzo: string;
  allergeni: string;
  slug?: string;
}

export interface ProssimaCenaInfo {
  titolo: string;
  data: string;
  ora: string;
  prezzo: string;
}

export interface PortataCena {
  tipo: string;
  piatto: string;
  abbinamento: string;
}

export interface CenaTemaRawItem {
  categoria: string;
  campo1: string;
  campo2: string;
  campo3: string;
  campo4: string;
}

// =============================================================================
// INTERFACCE POPUP E BANNER
// =============================================================================

export interface PopupBannerRaw {
  id: string;
  type: 'popup' | 'banner';
  active: string;
  title: string;
  description: string;
  imageUrl: string;
  eventDate: string;
  startDate: string;
  endDate: string;
  ctaText: string;
  ctaLink: string;
  logo: string;
}

export interface PopupBannerItem {
  id: string;
  type: 'popup' | 'banner';
  title: string;
  description: string;
  imageUrl: string;
  eventDate: Date | null;
  startDate: Date;
  endDate: Date;
  ctaText: string;
  ctaLink: string;
  logo: string;
  isActive: boolean;
}

// =============================================================================
// NUOVE INTERFACCE - CENE PASSATE
// =============================================================================

/**
 * Dati raw dal Google Sheet per le cene passate
 * Struttura CSV:
 * slug | categoria | campo1 | campo2 | campo3 | campo4
 * 
 * Categorie disponibili:
 * - info: titolo, data, ora, prezzo
 * - seo: title, description
 * - images: heroImage, ctaImage
 * - schema: startDateISO, endDateISO
 * - portata: tipo, piatto, abbinamento (multiple rows)
 */
export interface CenaPassataRawItem {
  slug: string;
  categoria: 'info' | 'seo' | 'images' | 'schema' | 'portata';
  campo1: string;
  campo2: string;
  campo3: string;
  campo4: string;
}

/**
 * Informazioni base della cena passata (titolo, data, ora, prezzo)
 */
export interface CenaPassataInfo {
  titolo: string;
  data: string;
  ora: string;
  prezzo: string;
}

/**
 * Dati SEO della cena passata
 */
export interface CenaPassataSEO {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
  preloadImage: string;
}

/**
 * Immagini della cena passata
 */
export interface CenaPassataImages {
  heroImage: string;
  ctaImage: string;
}

/**
 * Dati Schema.org per la cena passata
 */
export interface CenaPassataSchema {
  startDateISO: string;
  endDateISO: string;
}

/**
 * Portata della cena passata
 */
export interface CenaPassataPortata {
  tipo: string;
  piatto: string;
  abbinamento: string;
}

/**
 * Cena passata completa processata
 */
export interface CenaPassataCompleta {
  slug: string;
  info: CenaPassataInfo;
  seo: CenaPassataSEO;
  images: CenaPassataImages;
  schema: CenaPassataSchema;
  portate: CenaPassataPortata[];
}

// =============================================================================
// FUNZIONI DI PARSING
// =============================================================================

function parseCSVRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseItalianDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  const parts = dateStr.includes('/') 
    ? dateStr.split('/') 
    : dateStr.split('-');
  
  if (parts.length !== 3) return null;
  
  let day: number, month: number, year: number;
  
  if (dateStr.includes('/')) {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    year = parseInt(parts[2], 10);
  } else {
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    day = parseInt(parts[2], 10);
  }
  
  const date = new Date(year, month, day);
  if (isNaN(date.getTime())) return null;
  
  return date;
}

export function formatEventDate(date: Date | null): string {
  if (!date) return '';
  
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  };
  
  return date.toLocaleDateString('it-IT', options);
}

// =============================================================================
// FETCH DATI MENU (esistente)
// =============================================================================

export async function fetchSheetData(sheetGid: string): Promise<MenuItem[]> {
  const url = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv&gid=${sheetGid}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Errore fetch Google Sheet: ${response.status}`);
      return [];
    }
    
    const csvText = await response.text();
    const rows = csvText.split('\n').filter(row => row.trim());
    const dataRows = rows.slice(1);
    
    return dataRows.map(row => {
      const columns = parseCSVRow(row);
      return {
        categoria: columns[0] || '',
        nome: columns[1] || '',
        descrizione: columns[2] || '',
        prezzo: columns[3] || '',
        allergeni: columns[4] || '',
        slug: columns[5] || undefined
      };
    }).filter(item => item.nome);
    
  } catch (error) {
    console.error('Errore nel fetch dei dati:', error);
    return [];
  }
}

// =============================================================================
// FETCH DATI CENE A TEMA (esistente)
// =============================================================================

export async function fetchCeneTemaData(): Promise<CenaTemaRawItem[]> {
  const url = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv&gid=${SHEET_GIDS.ceneTema}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Errore fetch Google Sheet Cene Tema: ${response.status}`);
      return [];
    }
    
    const csvText = await response.text();
    const rows = csvText.split('\n').filter(row => row.trim());
    const dataRows = rows.slice(1);
    
    return dataRows.map(row => {
      const columns = parseCSVRow(row);
      return {
        categoria: columns[0] || '',
        campo1: columns[1] || '',
        campo2: columns[2] || '',
        campo3: columns[3] || '',
        campo4: columns[4] || ''
      };
    }).filter(item => item.categoria);
    
  } catch (error) {
    console.error('Errore nel fetch dei dati cene tema:', error);
    return [];
  }
}

export function getProssimaCenaInfo(rawData: CenaTemaRawItem[]): ProssimaCenaInfo {
  const infoRow = rawData.find(item => item.categoria === 'info');
  
  if (!infoRow) {
    return { titolo: '', data: '', ora: '', prezzo: '' };
  }
  
  return {
    titolo: infoRow.campo1,
    data: infoRow.campo2,
    ora: infoRow.campo3,
    prezzo: infoRow.campo4
  };
}

export function getPortateCena(rawData: CenaTemaRawItem[]): PortataCena[] {
  return rawData
    .filter(item => item.categoria === 'portata')
    .map(item => ({
      tipo: item.campo1,
      piatto: item.campo2,
      abbinamento: item.campo3
    }));
}

// =============================================================================
// FETCH DATI POPUP E BANNER (esistente)
// =============================================================================

export async function fetchPopupBannerData(): Promise<PopupBannerRaw[]> {
  const url = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv&gid=${SHEET_GIDS.popupBanner}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Errore fetch Google Sheet Popup/Banner: ${response.status}`);
      return [];
    }
    
    const csvText = await response.text();
    const rows = csvText.split('\n').filter(row => row.trim());
    const dataRows = rows.slice(1);
    
    return dataRows.map(row => {
      const columns = parseCSVRow(row);
      return {
        id: columns[0] || '',
        type: (columns[1] || 'popup') as 'popup' | 'banner',
        active: columns[2] || 'FALSE',
        title: columns[3] || '',
        description: columns[4] || '',
        imageUrl: columns[5] || '',
        eventDate: columns[6] || '',
        startDate: columns[7] || '',
        endDate: columns[8] || '',
        ctaText: columns[9] || '',
        ctaLink: columns[10] || '',
        logo: columns[11] || ''
      };
    }).filter(item => item.id);
    
  } catch (error) {
    console.error('Errore nel fetch dei dati popup/banner:', error);
    return [];
  }
}

export function processPopupBannerData(rawData: PopupBannerRaw[]): PopupBannerItem[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return rawData
    .map(item => {
      const startDate = parseItalianDate(item.startDate);
      const endDate = parseItalianDate(item.endDate);
      const eventDate = parseItalianDate(item.eventDate);
      
      if (!startDate || !endDate) return null;
      
      endDate.setHours(23, 59, 59, 999);
      
      const isManuallyActive = item.active.toUpperCase() === 'TRUE' || 
                               item.active === '1' || 
                               item.active.toLowerCase() === 'vero';
      
      const isInDateRange = today >= startDate && today <= endDate;
      const isActive = isManuallyActive && isInDateRange;
      
      return {
        id: item.id,
        type: item.type,
        title: item.title,
        description: item.description,
        imageUrl: item.imageUrl,
        eventDate,
        startDate,
        endDate,
        ctaText: item.ctaText,
        ctaLink: item.ctaLink,
        logo: item.logo,
        isActive
      } as PopupBannerItem;
    })
    .filter((item): item is PopupBannerItem => item !== null);
}

export function getActivePopup(items: PopupBannerItem[]): PopupBannerItem | null {
  const activePopups = items
    .filter(item => item.type === 'popup' && item.isActive)
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  
  return activePopups[0] || null;
}

export function getActiveBanner(items: PopupBannerItem[]): PopupBannerItem | null {
  const activeBanners = items
    .filter(item => item.type === 'banner' && item.isActive)
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  
  return activeBanners[0] || null;
}

export async function getActivePopupAndBanner(): Promise<{
  popup: PopupBannerItem | null;
  banner: PopupBannerItem | null;
}> {
  try {
    const rawData = await fetchPopupBannerData();
    const processedData = processPopupBannerData(rawData);
    
    return {
      popup: getActivePopup(processedData),
      banner: getActiveBanner(processedData)
    };
  } catch (error) {
    console.error('Errore nel recupero popup/banner:', error);
    return { popup: null, banner: null };
  }
}

// =============================================================================
// NUOVE FUNZIONI - CENE PASSATE
// =============================================================================

/**
 * Fetcha tutti i dati raw dal foglio CenePassate
 */
export async function fetchCenePassateData(): Promise<CenaPassataRawItem[]> {
  const url = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv&gid=${SHEET_GIDS.cenePassate}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Errore fetch Google Sheet Cene Passate: ${response.status}`);
      return [];
    }
    
    const csvText = await response.text();
    const rows = csvText.split('\n').filter(row => row.trim());
    const dataRows = rows.slice(1); // Salta header
    
    return dataRows.map(row => {
      const columns = parseCSVRow(row);
      return {
        slug: columns[0] || '',
        categoria: (columns[1] || '') as CenaPassataRawItem['categoria'],
        campo1: columns[2] || '',
        campo2: columns[3] || '',
        campo3: columns[4] || '',
        campo4: columns[5] || ''
      };
    }).filter(item => item.slug && item.categoria);
    
  } catch (error) {
    console.error('Errore nel fetch dei dati cene passate:', error);
    return [];
  }
}

/**
 * Ottiene la lista di tutti gli slug delle cene passate disponibili
 */
export function getAvailableCenePassateSlugs(rawData: CenaPassataRawItem[]): string[] {
  const slugs = new Set<string>();
  rawData.forEach(item => slugs.add(item.slug));
  return Array.from(slugs);
}

/**
 * Filtra i dati raw per uno specifico slug
 */
export function filterCenaPassataBySlug(rawData: CenaPassataRawItem[], slug: string): CenaPassataRawItem[] {
  return rawData.filter(item => item.slug === slug);
}

/**
 * Estrae le informazioni base della cena (titolo, data, ora, prezzo)
 */
export function getCenaPassataInfo(rawData: CenaPassataRawItem[]): CenaPassataInfo {
  const infoRow = rawData.find(item => item.categoria === 'info');
  
  if (!infoRow) {
    return { titolo: '', data: '', ora: '', prezzo: '' };
  }
  
  return {
    titolo: infoRow.campo1,
    data: infoRow.campo2,
    ora: infoRow.campo3,
    prezzo: infoRow.campo4
  };
}

/**
 * Estrae i dati SEO della cena
 */
export function getCenaPassataSEO(rawData: CenaPassataRawItem[], slug: string): CenaPassataSEO {
  const seoRow = rawData.find(item => item.categoria === 'seo');
  const imagesRow = rawData.find(item => item.categoria === 'images');
  
  const baseUrl = "https://www.ristorantepizzeriatre.it";
  const heroImage = imagesRow?.campo1 || `/img/cene-tema/${slug}/hero.webp`;
  
  return {
    title: seoRow?.campo1 || '',
    description: seoRow?.campo2 || '',
    canonical: `${baseUrl}/cene-a-tema/${slug}/`,
    ogImage: `${baseUrl}${heroImage}`,
    preloadImage: heroImage
  };
}

/**
 * Estrae i percorsi delle immagini
 */
export function getCenaPassataImages(rawData: CenaPassataRawItem[], slug: string): CenaPassataImages {
  const imagesRow = rawData.find(item => item.categoria === 'images');
  
  return {
    heroImage: imagesRow?.campo1 || `/img/cene-tema/${slug}/hero.webp`,
    ctaImage: imagesRow?.campo2 || `/img/cene-tema/${slug}/cta.webp`
  };
}

/**
 * Estrae i dati per Schema.org
 */
export function getCenaPassataSchema(rawData: CenaPassataRawItem[]): CenaPassataSchema {
  const schemaRow = rawData.find(item => item.categoria === 'schema');
  
  return {
    startDateISO: schemaRow?.campo1 || '',
    endDateISO: schemaRow?.campo2 || ''
  };
}

/**
 * Estrae le portate della cena
 */
export function getCenaPassataPortate(rawData: CenaPassataRawItem[]): CenaPassataPortata[] {
  return rawData
    .filter(item => item.categoria === 'portata')
    .map(item => ({
      tipo: item.campo1,
      piatto: item.campo2,
      abbinamento: item.campo3
    }));
}

/**
 * Processa tutti i dati raw e restituisce un oggetto completo per una cena specifica
 */
export function processCenaPassata(rawData: CenaPassataRawItem[], slug: string): CenaPassataCompleta | null {
  const filteredData = filterCenaPassataBySlug(rawData, slug);
  
  if (filteredData.length === 0) {
    console.warn(`Nessun dato trovato per la cena con slug: ${slug}`);
    return null;
  }
  
  return {
    slug,
    info: getCenaPassataInfo(filteredData),
    seo: getCenaPassataSEO(filteredData, slug),
    images: getCenaPassataImages(filteredData, slug),
    schema: getCenaPassataSchema(filteredData),
    portate: getCenaPassataPortate(filteredData)
  };
}

/**
 * Funzione helper: fetch + process per una cena specifica
 */
export async function getCenaPassataBySlug(slug: string): Promise<CenaPassataCompleta | null> {
  try {
    const rawData = await fetchCenePassateData();
    return processCenaPassata(rawData, slug);
  } catch (error) {
    console.error(`Errore nel recupero della cena ${slug}:`, error);
    return null;
  }
}

/**
 * Funzione helper: ottiene tutte le cene passate processate
 */
export async function getAllCenePassate(): Promise<CenaPassataCompleta[]> {
  try {
    const rawData = await fetchCenePassateData();
    const slugs = getAvailableCenePassateSlugs(rawData);
    
    return slugs
      .map(slug => processCenaPassata(rawData, slug))
      .filter((cena): cena is CenaPassataCompleta => cena !== null);
  } catch (error) {
    console.error('Errore nel recupero di tutte le cene passate:', error);
    return [];
  }
}

/**
 * Genera l'oggetto Schema.org completo per una cena passata
 */
export function generateCenaPassataSchemaOrg(cena: CenaPassataCompleta): object {
  const baseUrl = "https://www.ristorantepizzeriatre.it";
  
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Event",
        "@id": `${baseUrl}/cene-a-tema/${cena.slug}/#event`,
        "name": `Cena a Tema ${cena.info.titolo}`,
        "description": cena.seo.description,
        "startDate": cena.schema.startDateISO,
        "endDate": cena.schema.endDateISO,
        "eventStatus": "https://schema.org/EventCancelled",
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "location": {
          "@type": "Restaurant",
          "name": "Ristorante Pizzeria TRE",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "Via Statale, 44",
            "addressLocality": "Merate",
            "addressRegion": "LC",
            "postalCode": "23807",
            "addressCountry": "IT"
          }
        },
        "image": cena.seo.ogImage,
        "offers": {
          "@type": "Offer",
          "price": cena.info.prezzo.replace(',', '.'),
          "priceCurrency": "EUR",
          "availability": "https://schema.org/SoldOut"
        },
        "organizer": {
          "@type": "Restaurant",
          "name": "Ristorante Pizzeria TRE",
          "url": baseUrl + "/"
        },
        "previousStartDate": cena.schema.startDateISO
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${baseUrl}/cene-a-tema/${cena.slug}/#breadcrumb`,
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": baseUrl + "/"
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Cene a Tema",
            "item": baseUrl + "/cene-a-tema/"
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": cena.info.titolo,
            "item": `${baseUrl}/cene-a-tema/${cena.slug}/`
          }
        ]
      },
      {
        "@type": "WebPage",
        "@id": `${baseUrl}/cene-a-tema/${cena.slug}/#webpage`,
        "url": `${baseUrl}/cene-a-tema/${cena.slug}/`,
        "name": cena.seo.title,
        "isPartOf": {
          "@id": baseUrl + "/#website"
        },
        "primaryImageOfPage": {
          "@type": "ImageObject",
          "url": cena.seo.ogImage
        },
        "breadcrumb": {
          "@id": `${baseUrl}/cene-a-tema/${cena.slug}/#breadcrumb`
        },
        "inLanguage": "it-IT"
      }
    ]
  };
}

// =============================================================================
// UTILITY ESISTENTI
// =============================================================================

export function filterByCategory(items: MenuItem[], categoria: string): MenuItem[] {
  return items.filter(item => item.categoria === categoria);
}

export function formatPrice(prezzo: string): string {
  return `€ ${prezzo.replace('.', ',')}`;
}

export function formatAllergens(allergeni: string): string {
  if (!allergeni || allergeni.trim() === '') return '';
  return `(${allergeni})`;
}