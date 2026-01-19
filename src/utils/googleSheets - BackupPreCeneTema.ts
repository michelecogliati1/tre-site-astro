/**
 * Utility per fetchare i dati dei menù da Google Sheets
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
// INTERFACCE
// =============================================================================

export interface MenuItem {
  categoria: string;
  nome: string;
  descrizione: string;
  prezzo: string;
  allergeni: string;
  slug?: string;
}

// Interfaccia per la prossima cena a tema
export interface ProssimaCenaInfo {
  titolo: string;
  data: string;
  ora: string;
  prezzo: string;
}

// Interfaccia per le portate della cena a tema
export interface PortataCena {
  tipo: string;
  piatto: string;
  abbinamento: string;
}

// Interfacce per cene passate e partner rimosse (hardcoded nel codice)

// Interfaccia generica per i dati delle cene a tema (raw dal CSV)
export interface CenaTemaRawItem {
  categoria: string;
  campo1: string;
  campo2: string;
  campo3: string;
  campo4: string;
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
// FETCH DATI CENE A TEMA
// =============================================================================

/**
 * Fetcha i dati raw dal tab cene a tema
 * Struttura CSV:
 * categoria | campo1 | campo2 | campo3 | campo4
 * 
 * Dove categoria può essere:
 * - "info": campo1=titolo, campo2=data, campo3=ora, campo4=prezzo
 * - "portata": campo1=tipo, campo2=piatto, campo3=abbinamento
 * - "passata": campo1=titolo, campo2=data, campo3=immagine
 * - "partner": campo1=nome, campo2=logo
 */
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
    const dataRows = rows.slice(1); // Salta header
    
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

/**
 * Estrae le info della prossima cena a tema
 */
export function getProssimaCenaInfo(rawData: CenaTemaRawItem[]): ProssimaCenaInfo {
  const infoRow = rawData.find(item => item.categoria === 'info');
  
  if (!infoRow) {
    return {
      titolo: '',
      data: '',
      ora: '',
      prezzo: ''
    };
  }
  
  return {
    titolo: infoRow.campo1,
    data: infoRow.campo2,
    ora: infoRow.campo3,
    prezzo: infoRow.campo4
  };
}

/**
 * Estrae le portate della prossima cena
 */
export function getPortateCena(rawData: CenaTemaRawItem[]): PortataCena[] {
  return rawData
    .filter(item => item.categoria === 'portata')
    .map(item => ({
      tipo: item.campo1,
      piatto: item.campo2,
      abbinamento: item.campo3
    }));
}

// Le funzioni per cene passate e partner sono state rimosse
// perché questi dati sono hardcoded nel file cene-a-tema.astro

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