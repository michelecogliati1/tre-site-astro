/**
 * Vercel Serverless Function - Invio Preventivi TRE
 * API endpoint per invio email preventivi tramite Brevo
 *
 * Endpoint: POST /api/send-preventivo
 *
 * ENV VARIABLES (tutte opzionali tranne BREVO_API_KEY):
 *   BREVO_API_KEY          (obbligatoria) chiave API Brevo
 *   PREVENTIVO_RECIPIENTS  destinatari, separati da virgola.
 *                          Formato: "email|Nome, email2|Nome 2" (il |Nome è opzionale)
 *                          Se assente usa i destinatari di default qui sotto.
 *   BREVO_SENDER_EMAIL     indirizzo mittente (default: info@ristorantepizzeriatre.it)
 *   BREVO_SENDER_NAME      nome mittente (default: Sito Web TRE)
 */

// --- Default: identici al comportamento attuale, usati se le env var non ci sono ---
const DEFAULT_RECIPIENTS = 'info@ristorantepizzeriatre.it|Ristorante Pizzeria TRE,michelecogliati1@gmail.com|Test Michele';
const DEFAULT_SENDER_EMAIL = 'info@ristorantepizzeriatre.it';
const DEFAULT_SENDER_NAME = 'Sito Web TRE';

/**
 * Converte la stringa dei destinatari nel formato richiesto da Brevo.
 * "a@b.it|Nome, c@d.it" -> [{email:'a@b.it', name:'Nome'}, {email:'c@d.it'}]
 */
function parseRecipients(raw) {
  return String(raw || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [email, name] = entry.split('|').map((part) => (part || '').trim());
      return name ? { email, name } : { email };
    })
    .filter((r) => r.email && r.email.includes('@'));
}

/**
 * Classifica l'errore Brevo in un codice semantico.
 * Serve per loggare e per far capire al frontend che tipo di problema e'.
 */
function classifyBrevoError(status, body) {
  const code = (body && body.code) || '';
  const message = String((body && body.message) || '');

  if (status === 401 && /unrecognised IP|unauthorised IP|authorised_ips/i.test(message)) {
    return 'BREVO_IP_BLOCKED';
  }
  if (status === 401 || code === 'unauthorized') return 'BREVO_AUTH';
  if (/sender/i.test(message) || /not.*valid.*sender/i.test(message)) return 'BREVO_SENDER';
  if (status === 402 || /credit/i.test(message)) return 'BREVO_QUOTA';
  if (status === 429) return 'BREVO_RATE_LIMIT';
  if (/blacklist|blocked/i.test(message)) return 'BREVO_RECIPIENT_BLOCKED';
  if (status >= 500) return 'BREVO_SERVER';
  return 'BREVO_ERROR';
}

/** Ritenta solo su errori transitori: mai su 4xx (tranne 429). */
function isRetryable(status) {
  return status === 429 || status >= 500;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function handler(req, res) {
  const startedAt = Date.now();

  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Metodo non consentito. Usa POST.',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  // --- Lettura body: gestisce JSON malformato come 400, non come 500 ---
  let data;
  try {
    data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (parseError) {
    console.error('[preventivo] Body JSON non valido:', parseError.message);
    return res.status(400).json({
      success: false,
      error: 'Dati della richiesta non validi',
      code: 'INVALID_JSON'
    });
  }

  if (!data || typeof data !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'Dati della richiesta mancanti',
      code: 'INVALID_JSON'
    });
  }

  try {
    // --- Validazione campi obbligatori ---
    const mancanti = ['evento', 'servizio', 'nome', 'cognome', 'email']
      .filter((campo) => !data[campo] || !String(data[campo]).trim());

    if (mancanti.length > 0) {
      console.warn('[preventivo] Campi obbligatori mancanti:', mancanti.join(', '));
      return res.status(400).json({
        success: false,
        error: 'Campi obbligatori mancanti',
        code: 'VALIDATION',
        campi: mancanti
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email).trim())) {
      return res.status(400).json({
        success: false,
        error: 'Indirizzo email non valido',
        code: 'VALIDATION',
        campi: ['email']
      });
    }

    // --- Configurazione ---
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      console.error('[preventivo] BREVO_API_KEY non trovata nelle env variables');
      return res.status(500).json({
        success: false,
        error: 'Configurazione server non completa',
        code: 'CONFIG_MISSING'
      });
    }

    const destinatari = parseRecipients(process.env.PREVENTIVO_RECIPIENTS || DEFAULT_RECIPIENTS);
    if (destinatari.length === 0) {
      console.error('[preventivo] Nessun destinatario valido configurato');
      return res.status(500).json({
        success: false,
        error: 'Configurazione server non completa',
        code: 'CONFIG_MISSING'
      });
    }

    // --- Formattazione dati ---
    let dataFormattata = 'Da definire';
    if (data.data && !data.dataDaDefinire) {
      const d = new Date(data.data);
      if (!isNaN(d.getTime())) {
        dataFormattata = d.toLocaleDateString('it-IT', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });
      }
    }

    const partecipantiText = data.numeroDaDefinire
      ? 'Da definire'
      : (data.partecipanti || 'Non specificato');

    const eventiMap = {
      'compleanno': 'Compleanno',
      'battesimo': 'Battesimo',
      'comunione': 'Comunione',
      'cresima': 'Cresima',
      'laurea': 'Laurea',
      'anniversario': 'Anniversario',
      'meeting': 'Meeting / Cena Aziendale',
      'altro': 'Altro'
    };
    const eventoText = eventiMap[data.evento] || data.evento;
    const servizioText = data.servizio === 'pranzo' ? 'Pranzo' : 'Cena';

    const oggetto = `Richiesta Preventivo: ${eventoText} - ${dataFormattata} - ${servizioText} - ${partecipantiText} persone`;

    // Escape HTML per evitare che input utente rompa il markup dell'email
    const esc = (val) => String(val == null ? '' : val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    // --- Corpo email HTML ---
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #F4773A; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
    .section { margin-bottom: 20px; }
    .section-title { background: #F4773A; color: white; padding: 8px 12px; font-weight: bold; margin-bottom: 10px; border-radius: 4px; }
    .field { padding: 8px 0; border-bottom: 1px solid #eee; }
    .field:last-child { border-bottom: none; }
    .label { font-weight: bold; color: #666; display: inline-block; width: 140px; }
    .value { color: #333; }
    .message-box { background: white; padding: 15px; border-left: 4px solid #F4773A; margin-top: 10px; }
    .footer { text-align: center; padding: 15px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🍕 Nuova Richiesta Preventivo</h1>
    </div>
    <div class="content">
      <div class="section">
        <div class="section-title">📅 Dettagli Evento</div>
        <div class="field">
          <span class="label">Tipo Evento:</span>
          <span class="value"><strong>${esc(eventoText)}</strong></span>
        </div>
        <div class="field">
          <span class="label">Data:</span>
          <span class="value">${esc(dataFormattata)}</span>
        </div>
        <div class="field">
          <span class="label">Servizio:</span>
          <span class="value">${esc(servizioText)}</span>
        </div>
        <div class="field">
          <span class="label">N° Partecipanti:</span>
          <span class="value">${esc(partecipantiText)}</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title">👤 Dati di Contatto</div>
        <div class="field">
          <span class="label">Nome:</span>
          <span class="value">${esc(data.nome)} ${esc(data.cognome)}</span>
        </div>
        <div class="field">
          <span class="label">Email:</span>
          <span class="value"><a href="mailto:${esc(data.email)}">${esc(data.email)}</a></span>
        </div>
        <div class="field">
          <span class="label">Telefono:</span>
          <span class="value">${esc(data.telefono || 'Non specificato')}</span>
        </div>
      </div>

      ${data.messaggio ? `
      <div class="section">
        <div class="section-title">💬 Messaggio</div>
        <div class="message-box">
          ${esc(data.messaggio).replace(/\n/g, '<br>')}
        </div>
      </div>
      ` : ''}
    </div>
    <div class="footer">
      Richiesta inviata dal sito web ristorantepizzeriatre.it<br>
      Per rispondere, usa il pulsante "Rispondi" della tua email.
    </div>
  </div>
</body>
</html>
`;

    // --- Corpo email testo (fallback) ---
    const textContent = `
═══════════════════════════════════════════════════
   RICHIESTA PREVENTIVO - RISTORANTE PIZZERIA TRE
═══════════════════════════════════════════════════

DETTAGLI EVENTO:
────────────────────────────────────────────────────
• Tipo Evento:         ${eventoText}
• Data:                ${dataFormattata}
• Servizio:            ${servizioText}
• N° Partecipanti:     ${partecipantiText}

DATI DI CONTATTO:
────────────────────────────────────────────────────
• Nome:                ${data.nome} ${data.cognome}
• Email:               ${data.email}
• Telefono:            ${data.telefono || 'Non specificato'}

${data.messaggio ? `MESSAGGIO DEL CLIENTE:
────────────────────────────────────────────────────
${data.messaggio}` : ''}

═══════════════════════════════════════════════════
Richiesta inviata dal sito web ristorantepizzeriatre.it
═══════════════════════════════════════════════════
`;

    // --- Payload Brevo ---
    const brevoPayload = {
      sender: {
        name: process.env.BREVO_SENDER_NAME || DEFAULT_SENDER_NAME,
        email: process.env.BREVO_SENDER_EMAIL || DEFAULT_SENDER_EMAIL
      },
      to: destinatari,
      replyTo: {
        email: String(data.email).trim(),
        name: `${data.nome} ${data.cognome}`
      },
      subject: oggetto,
      htmlContent: htmlContent,
      textContent: textContent
    };

    // --- Invio con retry sui soli errori transitori ---
    const MAX_TENTATIVI = 3;
    const RITARDI_MS = [500, 1500];
    let ultimoErrore = null;

    for (let tentativo = 1; tentativo <= MAX_TENTATIVI; tentativo++) {
      let brevoResponse;

      try {
        brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'api-key': apiKey,
            'content-type': 'application/json'
          },
          body: JSON.stringify(brevoPayload)
        });
      } catch (networkError) {
        // Errore di rete: sempre ritentabile
        ultimoErrore = { code: 'NETWORK', message: networkError.message };
        console.error(`[preventivo] Tentativo ${tentativo}/${MAX_TENTATIVI} - errore di rete:`, networkError.message);

        if (tentativo < MAX_TENTATIVI) {
          await sleep(RITARDI_MS[tentativo - 1]);
          continue;
        }
        break;
      }

      if (brevoResponse.ok) {
        const result = await brevoResponse.json();
        console.log(`[preventivo] OK in ${Date.now() - startedAt}ms | tentativo ${tentativo} | evento=${data.evento} | destinatari=${destinatari.length} | messageId=${result.messageId}`);

        return res.status(200).json({
          success: true,
          messageId: result.messageId,
          evento: data.evento
        });
      }

      // Risposta di errore da Brevo
      let errorBody = null;
      try {
        errorBody = await brevoResponse.json();
      } catch {
        errorBody = { message: await brevoResponse.text().catch(() => 'Risposta non leggibile') };
      }

      const codice = classifyBrevoError(brevoResponse.status, errorBody);
      ultimoErrore = { code: codice, status: brevoResponse.status, brevo: errorBody };

      console.error(
        `[preventivo] Tentativo ${tentativo}/${MAX_TENTATIVI} - Brevo ha risposto ${brevoResponse.status} | code=${codice} | message=${errorBody && errorBody.message}`
      );

      // Su errori NON transitori si esce subito: ritentare non serve
      if (!isRetryable(brevoResponse.status) || tentativo === MAX_TENTATIVI) {
        break;
      }

      await sleep(RITARDI_MS[tentativo - 1]);
    }

    console.error(`[preventivo] FALLITO dopo ${Date.now() - startedAt}ms |`, JSON.stringify(ultimoErrore));

    return res.status(502).json({
      success: false,
      error: 'Errore nell\'invio dell\'email',
      code: (ultimoErrore && ultimoErrore.code) || 'BREVO_ERROR',
      details: (ultimoErrore && ultimoErrore.brevo) || (ultimoErrore && ultimoErrore.message) || null
    });

  } catch (error) {
    console.error('[preventivo] Errore non gestito:', error && error.stack ? error.stack : error);

    return res.status(500).json({
      success: false,
      error: 'Errore del server',
      code: 'SERVER',
      details: error.message
    });
  }
}

/**
 * Configurazione Vercel
 * maxDuration alzato a 20s per lasciare spazio ai retry.
 */
export const config = {
  maxDuration: 20
};