/**
 * Utility per fetchare i dati dei menù da Google Sheets
 * + Sistema Popup/Banner Eventi Temporizzati
 */

// 🔧 CONFIGURAZIONE - Sostituisci con i tuoi valori
export const GOOGLE_SHEET_ID = "1l5TrtAa3erPpNfpIcUqOlqSVJCoRqKAFHd7VLf6Cj7U";

export const SHEET_GIDS = {
  menuPizze: "1125677232",
  menuCarta: "282322300",
  menuAsporto: "1494757887",
  ceneTema: "1523677758",
  popupBanner: "1486895463" 
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
// NUOVE INTERFACCE - POPUP E BANNER
// =============================================================================

/**
 * Dati raw dal Google Sheet per popup/banner
 * Struttura CSV:
 * id | type | active | title | description | imageUrl | eventDate | startDate | endDate | ctaText | ctaLink | logo
 */
export interface PopupBannerRaw {
  id: string;
  type: 'popup' | 'banner';
  active: string;  // "TRUE" o "FALSE"
  title: string;
  description: string;
  imageUrl: string;
  eventDate: string;    // Data evento (formato DD/MM/YYYY)
  startDate: string;    // Inizio pubblicazione (formato DD/MM/YYYY)
  endDate: string;      // Fine pubblicazione (formato DD/MM/YYYY)
  ctaText: string;
  ctaLink: string;
  logo: string;
}

/**
 * Popup/Banner processato e pronto per il frontend
 */
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

/**
 * Converte una data dal formato DD/MM/YYYY a oggetto Date
 */
function parseItalianDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  // Supporta sia DD/MM/YYYY che YYYY-MM-DD
  const parts = dateStr.includes('/') 
    ? dateStr.split('/') 
    : dateStr.split('-');
  
  if (parts.length !== 3) return null;
  
  let day: number, month: number, year: number;
  
  if (dateStr.includes('/')) {
    // Formato italiano: DD/MM/YYYY
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1; // I mesi in JS sono 0-indexed
    year = parseInt(parts[2], 10);
  } else {
    // Formato ISO: YYYY-MM-DD
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    day = parseInt(parts[2], 10);
  }
  
  const date = new Date(year, month, day);
  
  // Verifica che la data sia valida
  if (isNaN(date.getTime())) return null;
  
  return date;
}

/**
 * Formatta una data per la visualizzazione (es: "15 Agosto 2025")
 */
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
    const dataRows = rows.slice(1); // Salta header
    
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
// NUOVE FUNZIONI - POPUP E BANNER
// =============================================================================

/**
 * Fetcha i dati raw dal tab popup/banner
 */
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
    const dataRows = rows.slice(1); // Salta header
    
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

/**
 * Processa i dati raw e restituisce solo gli item attivi e nel range di date
 */
export function processPopupBannerData(rawData: PopupBannerRaw[]): PopupBannerItem[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalizza a mezzanotte
  
  return rawData
    .map(item => {
      const startDate = parseItalianDate(item.startDate);
      const endDate = parseItalianDate(item.endDate);
      const eventDate = parseItalianDate(item.eventDate);
      
      // Se le date non sono valide, salta
      if (!startDate || !endDate) return null;
      
      // Normalizza endDate a fine giornata (23:59:59)
      endDate.setHours(23, 59, 59, 999);
      
      // Verifica se è attivo (TRUE in qualsiasi formato)
      const isManuallyActive = item.active.toUpperCase() === 'TRUE' || 
                               item.active === '1' || 
                               item.active.toLowerCase() === 'vero';
      
      // È attivo se: manualmente attivo E nel range di date
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

/**
 * Ottiene il popup attivo da mostrare (quello con startDate più recente)
 */
export function getActivePopup(items: PopupBannerItem[]): PopupBannerItem | null {
  const activePopups = items
    .filter(item => item.type === 'popup' && item.isActive)
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime()); // Più recente prima
  
  return activePopups[0] || null;
}

/**
 * Ottiene il banner attivo da mostrare
 */
export function getActiveBanner(items: PopupBannerItem[]): PopupBannerItem | null {
  const activeBanners = items
    .filter(item => item.type === 'banner' && item.isActive)
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  
  return activeBanners[0] || null;
}

/**
 * Funzione helper: fetch + process in un unico step
 */
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