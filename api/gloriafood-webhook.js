/**
 * Vercel Serverless Function - GloriaFood Webhook Handler v4
 * 
 * Gestisce:
 * - Prenotazioni tavoli (table_reservation) → Foglio "Dati"
 * - Ordini asporto (pickup) → Foglio "Asporto"
 * 
 * Endpoint: POST /api/gloriafood-webhook
 */

import { google } from 'googleapis';

// Configurazione Google Sheets
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Mapping giorni della settimana in italiano
const GIORNI_SETTIMANA = {
  0: 'Domenica',
  1: 'Lunedì',
  2: 'Martedì',
  3: 'Mercoledì',
  4: 'Giovedì',
  5: 'Venerdì',
  6: 'Sabato'
};

// Mapping stati prenotazioni
const STATI_PRENOTAZIONE = {
  'accepted': '✅ Confermata',
  'rejected': '❌ Cancellata',
  'canceled': '❌ Cancellata',
  'timed_out': '❌ Cancellata',
  'pending': '⏳ In attesa'
};

// Mapping stati ordini asporto
const STATI_ORDINE = {
  'accepted': '✅ Confermato',
  'rejected': '❌ Annullato',
  'canceled': '❌ Annullato',
  'timed_out': '❌ Annullato',
  'pending': '⏳ In attesa'
};

// Mapping metodi di pagamento
const METODI_PAGAMENTO = {
  'CASH': '💵 Contanti',
  'CARD': '💳 Carta',
  'ONLINE': '🌐 Online'
};

/**
 * Inizializza client Google Sheets
 */
async function getGoogleSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: SCOPES,
  });

  const sheets = google.sheets({ version: 'v4', auth });
  return sheets;
}

/**
 * Formatta data da ISO string a DD/MM/YYYY (fuso orario italiano)
 */
function formatDate(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    const formatter = new Intl.DateTimeFormat('it-IT', {
      timeZone: 'Europe/Rome',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    return formatter.format(date);
  } catch (error) {
    console.error('Errore formatDate:', error, 'input:', isoString);
    return '';
  }
}

/**
 * Formatta ora da ISO string a HH:MM (fuso orario italiano)
 */
function formatTime(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    const formatter = new Intl.DateTimeFormat('it-IT', {
      timeZone: 'Europe/Rome',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return formatter.format(date);
  } catch (error) {
    console.error('Errore formatTime:', error, 'input:', isoString);
    return '';
  }
}

/**
 * Ottiene il giorno della settimana in italiano (fuso orario italiano)
 */
function getGiornoSettimana(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    const formatter = new Intl.DateTimeFormat('it-IT', {
      timeZone: 'Europe/Rome',
      weekday: 'long'
    });
    const giorno = formatter.format(date);
    return giorno.charAt(0).toUpperCase() + giorno.slice(1);
  } catch (error) {
    console.error('Errore getGiornoSettimana:', error, 'input:', isoString);
    return '';
  }
}

/**
 * Formatta timestamp corrente per colonna "Aggiornato" (fuso orario italiano)
 */
function getTimestampNow() {
  try {
    const now = new Date();
    const dateFormatter = new Intl.DateTimeFormat('it-IT', {
      timeZone: 'Europe/Rome',
      day: '2-digit',
      month: '2-digit'
    });
    const timeFormatter = new Intl.DateTimeFormat('it-IT', {
      timeZone: 'Europe/Rome',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return `${dateFormatter.format(now)} ${timeFormatter.format(now)}`;
  } catch (error) {
    console.error('Errore getTimestampNow:', error);
    return new Date().toISOString();
  }
}

/**
 * Formatta prezzo in euro
 * NOTA: GloriaFood invia il valore già in euro (es. 18.20), non in centesimi
 */
function formatPrice(value) {
  if (!value && value !== 0) return '€0,00';
  const euros = parseFloat(value);
  if (isNaN(euros)) return '€0,00';
  return `€${euros.toFixed(2).replace('.', ',')}`;
}

/**
 * Crea stringa prodotti da array items
 * Formato: "2x Margherita, 1x Diavola"
 */
function formatItems(items) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return '';
  }
  
  return items.map(item => {
    const qty = item.quantity || 1;
    const name = item.name || 'Prodotto';
    return `${qty}x ${name}`;
  }).join(', ');
}

/**
 * Determina se l'ordine è ASAP o schedulato
 */
function isAsapOrder(order) {
  // GloriaFood usa un campo specifico o il tempo tra creazione e fulfill
  // Se fulfill_at è molto vicino ad accepted_at (< 2 ore), probabilmente è ASAP
  if (!order.fulfill_at || !order.accepted_at) return true;
  
  const fulfillTime = new Date(order.fulfill_at).getTime();
  const acceptedTime = new Date(order.accepted_at).getTime();
  const diffHours = (fulfillTime - acceptedTime) / (1000 * 60 * 60);
  
  return diffHours < 2;
}

/**
 * Cerca una prenotazione/ordine esistente per ID GloriaFood
 */
async function findExistingEntry(sheets, spreadsheetId, sheetName, idColumn, gloriaFoodId) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!${idColumn}:${idColumn}`,
    });

    const rows = response.data.values || [];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === gloriaFoodId.toString()) {
        return i + 1; // Ritorna numero riga (1-indexed)
      }
    }
    return null;
  } catch (error) {
    console.error(`Errore ricerca in ${sheetName}:`, error);
    return null;
  }
}

/**
 * Aggiunge una nuova riga
 */
async function addRow(sheets, spreadsheetId, sheetName, row) {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [row]
    }
  });
}

/**
 * Aggiorna una riga esistente
 */
async function updateRow(sheets, spreadsheetId, sheetName, rowNumber, row, lastColumn) {
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A${rowNumber}:${lastColumn}${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [row]
    }
  });
}

// ============================================
// PROCESSAMENTO PRENOTAZIONI TAVOLI
// ============================================

/**
 * Processa una prenotazione tavolo da GloriaFood
 */
function parseTableReservation(order) {
  const fulfillAt = order.fulfill_at;
  
  return {
    row: [
      getGiornoSettimana(fulfillAt),           // A - Giorno
      formatDate(fulfillAt),                    // B - Data
      formatTime(fulfillAt),                    // C - Ora
      `${order.client_first_name || ''} ${order.client_last_name || ''}`.trim(), // D - Nome
      order.client_phone || '',                 // E - Telefono
      order.client_email || '',                 // F - Email
      order.persons || 0,                       // G - Persone
      STATI_PRENOTAZIONE[order.status] || '⏳ In attesa', // H - Stato
      '🌐 Online',                              // I - Fonte
      order.instructions || '',                 // J - Note
      order.id?.toString() || '',               // K - ID GloriaFood
      getTimestampNow()                         // L - Aggiornato
    ],
    sheetName: 'Dati',
    idColumn: 'K',
    lastColumn: 'L',
    id: order.id?.toString() || ''
  };
}

// ============================================
// PROCESSAMENTO ORDINI ASPORTO
// ============================================

/**
 * Processa un ordine asporto (pickup) da GloriaFood
 */
function parsePickupOrder(order) {
  const fulfillAt = order.fulfill_at;
  const isAsap = isAsapOrder(order);
  
  // Aggiungi indicatore ASAP all'ora se necessario
  let oraRitiro = formatTime(fulfillAt);
  if (isAsap) {
    oraRitiro = `${oraRitiro} ⚡`;  // Indica ordine ASAP
  }
  
  return {
    row: [
      getGiornoSettimana(fulfillAt),           // A - Giorno
      formatDate(fulfillAt),                    // B - Data
      oraRitiro,                                // C - Ora Ritiro
      `${order.client_first_name || ''} ${order.client_last_name || ''}`.trim(), // D - Nome
      order.client_phone || '',                 // E - Telefono
      order.client_email || '',                 // F - Email
      formatPrice(order.total_price),           // G - Totale €
      METODI_PAGAMENTO[order.payment] || order.payment || '', // H - Pagamento
      formatItems(order.items),                 // I - Prodotti
      STATI_ORDINE[order.status] || '⏳ In attesa', // J - Stato
      order.instructions || '',                 // K - Note
      order.id?.toString() || '',               // L - ID GloriaFood
      getTimestampNow()                         // M - Aggiornato
    ],
    sheetName: 'Asporto',
    idColumn: 'L',
    lastColumn: 'M',
    id: order.id?.toString() || ''
  };
}

// ============================================
// HANDLER PRINCIPALE
// ============================================

export default async function handler(req, res) {
  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verifica authorization header (opzionale ma consigliato)
  const authHeader = req.headers['authorization'];
  const expectedSecret = process.env.GLORIAFOOD_WEBHOOK_SECRET;
  
  if (expectedSecret && authHeader !== expectedSecret) {
    console.warn('Authorization non valida');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = req.body;
    
    // Log per debug
    console.log('Webhook ricevuto:', JSON.stringify(payload, null, 2));

    // GloriaFood invia un array di ordini oppure un singolo ordine
    const orders = payload.orders || [payload];
    
    if (!orders || orders.length === 0) {
      console.log('Nessun ordine nel payload');
      return res.status(200).json({ success: true, message: 'No orders to process' });
    }

    // Inizializza Google Sheets
    const sheets = await getGoogleSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEET_ID non configurato');
    }

    let stats = {
      reservations: { processed: 0, updated: 0 },
      pickups: { processed: 0, updated: 0 },
      skipped: 0
    };

    for (const order of orders) {
      let parsedData = null;
      let orderType = '';

      // Determina il tipo di ordine
      if (order.type === 'table_reservation') {
        parsedData = parseTableReservation(order);
        orderType = 'reservation';
      } else if (order.type === 'pickup') {
        parsedData = parsePickupOrder(order);
        orderType = 'pickup';
      } else {
        console.log('Tipo ordine non gestito:', order.type);
        stats.skipped++;
        continue;
      }

      // Cerca se esiste già
      const existingRow = await findExistingEntry(
        sheets, 
        spreadsheetId, 
        parsedData.sheetName,
        parsedData.idColumn,
        parsedData.id
      );

      if (existingRow) {
        // Aggiorna entry esistente
        await updateRow(
          sheets, 
          spreadsheetId, 
          parsedData.sheetName,
          existingRow, 
          parsedData.row,
          parsedData.lastColumn
        );
        console.log(`${orderType} aggiornato:`, parsedData.id, 'riga:', existingRow);
        
        if (orderType === 'reservation') {
          stats.reservations.updated++;
        } else {
          stats.pickups.updated++;
        }
      } else {
        // Aggiungi nuova entry
        await addRow(sheets, spreadsheetId, parsedData.sheetName, parsedData.row);
        console.log(`${orderType} aggiunto:`, parsedData.id);
        
        if (orderType === 'reservation') {
          stats.reservations.processed++;
        } else {
          stats.pickups.processed++;
        }
      }
    }

    console.log('Elaborazione completata:', JSON.stringify(stats));

    return res.status(200).json({ 
      success: true, 
      stats
    });

  } catch (error) {
    console.error('Errore webhook:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

/**
 * Configurazione Vercel
 */
export const config = {
  api: {
    bodyParser: true,
  },
};