/**
 * Vercel Serverless Function - GloriaFood Webhook Handler
 * 
 * Riceve prenotazioni tavoli da GloriaFood e le salva in Google Sheets
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

// Mapping stati
const STATI = {
  'accepted': '✅ Confermata',
  'rejected': '❌ Cancellata',
  'canceled': '❌ Cancellata',
  'timed_out': '❌ Cancellata',
  'pending': '⏳ In attesa'
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
 * Converte data ISO in oggetto con componenti nel fuso orario italiano
 */
function getItalianDateParts(isoString) {
  if (!isoString) return null;
  const date = new Date(isoString);
  
  // Formatta nel fuso orario italiano
  const italianDate = date.toLocaleString('it-IT', { 
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'long'
  });
  
  // Parse del risultato: "sabato 25/01/2025, 19:30"
  const parts = italianDate.match(/(\w+)\s+(\d{2})\/(\d{2})\/(\d{4}),?\s*(\d{2}):(\d{2})/);
  
  if (!parts) {
    // Fallback se il parsing fallisce
    console.warn('Parsing data fallito per:', isoString, '-> risultato:', italianDate);
    return null;
  }
  
  return {
    giorno: parts[1].charAt(0).toUpperCase() + parts[1].slice(1), // Capitalizza
    day: parts[2],
    month: parts[3],
    year: parts[4],
    hours: parts[5],
    minutes: parts[6]
  };
}

/**
 * Formatta data da ISO string a DD/MM/YYYY (fuso orario italiano)
 */
function formatDate(isoString) {
  const parts = getItalianDateParts(isoString);
  if (!parts) return '';
  return `${parts.day}/${parts.month}/${parts.year}`;
}

/**
 * Formatta ora da ISO string a HH:MM (fuso orario italiano)
 */
function formatTime(isoString) {
  const parts = getItalianDateParts(isoString);
  if (!parts) return '';
  return `${parts.hours}:${parts.minutes}`;
}

/**
 * Ottiene il giorno della settimana in italiano (fuso orario italiano)
 */
function getGiornoSettimana(isoString) {
  const parts = getItalianDateParts(isoString);
  if (!parts) return '';
  return parts.giorno;
}

/**
 * Formatta timestamp corrente per colonna "Aggiornato" (fuso orario italiano)
 */
function getTimestampNow() {
  const now = new Date();
  const italianTime = now.toLocaleString('it-IT', {
    timeZone: 'Europe/Rome',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
  // Risultato: "21/01, 15:30" -> formatto come "21/01 15:30"
  return italianTime.replace(',', '');
}

/**
 * Cerca una prenotazione esistente per ID GloriaFood
 */
async function findExistingReservation(sheets, spreadsheetId, gloriaFoodId) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Dati!K:K', // Colonna ID GloriaFood
    });

    const rows = response.data.values || [];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === gloriaFoodId.toString()) {
        return i + 1; // Ritorna numero riga (1-indexed)
      }
    }
    return null;
  } catch (error) {
    console.error('Errore ricerca prenotazione:', error);
    return null;
  }
}

/**
 * Aggiunge una nuova prenotazione
 */
async function addReservation(sheets, spreadsheetId, reservationData) {
  const row = [
    reservationData.giorno,
    reservationData.data,
    reservationData.ora,
    reservationData.nome,
    reservationData.telefono,
    reservationData.email,
    reservationData.persone,
    reservationData.stato,
    reservationData.fonte,
    reservationData.note,
    reservationData.idGloriaFood,
    reservationData.aggiornato
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Dati!A:L',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [row]
    }
  });

  console.log('Prenotazione aggiunta:', reservationData.idGloriaFood);
}

/**
 * Aggiorna una prenotazione esistente
 */
async function updateReservation(sheets, spreadsheetId, rowNumber, reservationData) {
  const row = [
    reservationData.giorno,
    reservationData.data,
    reservationData.ora,
    reservationData.nome,
    reservationData.telefono,
    reservationData.email,
    reservationData.persone,
    reservationData.stato,
    reservationData.fonte,
    reservationData.note,
    reservationData.idGloriaFood,
    reservationData.aggiornato
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Dati!A${rowNumber}:L${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [row]
    }
  });

  console.log('Prenotazione aggiornata:', reservationData.idGloriaFood, 'riga:', rowNumber);
}

/**
 * Processa un ordine/prenotazione da GloriaFood
 */
function parseGloriaFoodOrder(order) {
  // Verifica che sia una prenotazione tavolo
  if (order.type !== 'table_reservation') {
    console.log('Ignorato: non è una prenotazione tavolo, tipo:', order.type);
    return null;
  }

  const fulfillAt = order.fulfill_at;
  
  return {
    giorno: getGiornoSettimana(fulfillAt),
    data: formatDate(fulfillAt),
    ora: formatTime(fulfillAt),
    nome: `${order.client_first_name || ''} ${order.client_last_name || ''}`.trim(),
    telefono: order.client_phone || '',
    email: order.client_email || '',
    persone: order.persons || 0,
    stato: STATI[order.status] || '⏳ In attesa',
    fonte: '🌐 Online',
    note: order.instructions || '',
    idGloriaFood: order.id?.toString() || '',
    aggiornato: getTimestampNow()
  };
}

/**
 * Handler principale
 */
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

    let processed = 0;
    let skipped = 0;

    for (const order of orders) {
      // Parsa la prenotazione
      const reservationData = parseGloriaFoodOrder(order);
      
      if (!reservationData) {
        skipped++;
        continue;
      }

      // Cerca se esiste già
      const existingRow = await findExistingReservation(
        sheets, 
        spreadsheetId, 
        reservationData.idGloriaFood
      );

      if (existingRow) {
        // Aggiorna prenotazione esistente
        await updateReservation(sheets, spreadsheetId, existingRow, reservationData);
      } else {
        // Aggiungi nuova prenotazione
        await addReservation(sheets, spreadsheetId, reservationData);
      }

      processed++;
    }

    console.log(`Elaborazione completata: ${processed} processate, ${skipped} saltate`);

    return res.status(200).json({ 
      success: true, 
      processed,
      skipped
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