/**
 * Utility per fetchare i dati dei menù da Google Sheets
 */

// 🔧 CONFIGURAZIONE - Sostituisci con i tuoi valori
export const GOOGLE_SHEET_ID = "1l5TrtAa3erPpNfpIcUqOlqSVJCoRqKAFHd7VLf6Cj7U";

export const SHEET_GIDS = {
  menuPizze: "1125677232",  // Sostituisci con il GID reale se diverso
  menuCarta: "282322300",  // Sostituisci con il GID reale
  menuAsporto: "1494757887" // Sostituisci con il GID reale
};

export interface MenuItem {
  categoria: string;
  nome: string;
  descrizione: string;
  prezzo: string;
  allergeni: string;
  slug?: string;
}

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