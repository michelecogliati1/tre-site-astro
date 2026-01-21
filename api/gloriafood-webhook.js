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
 * Formatta data da ISO string a DD/MM/YYYY
 */
function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formatta ora da ISO string a HH:MM
 */
function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Ottiene il giorno della settimana in italiano
 */
function getGiornoSettimana(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return GIORNI_SETTIMANA[date.getDay()];
}

/**
 * Formatta timestamp corrente per colonna "Aggiornato"
 */
function getTimestampNow() {
  const now = new Date();
  const day = now.getDate().toString().padStart(2, '0');
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return `${day}/${month} ${hours}:${minutes}`;
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