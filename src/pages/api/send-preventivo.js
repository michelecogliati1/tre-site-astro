// src/pages/api/send-preventivo.js
// API endpoint per invio email preventivi tramite Brevo

export const prerender = false;

export async function POST({ request }) {
  try {
    const data = await request.json();

    // Validazione campi obbligatori
    if (!data.evento || !data.servizio || !data.nome || !data.cognome || !data.email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Campi obbligatori mancanti' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Formatta la data
    let dataFormattata = 'Da definire';
    if (data.data && !data.dataDaDefinire) {
      const d = new Date(data.data);
      dataFormattata = d.toLocaleDateString('it-IT', { 
        weekday: 'long',
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
      });
    }

    // Formatta partecipanti
    const partecipantiText = data.numeroDaDefinire ? 'Da definire' : (data.partecipanti || 'Non specificato');

    // Mappa eventi per testo leggibile
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

    // Mappa servizio
    const servizioText = data.servizio === 'pranzo' ? 'Pranzo' : 'Cena';

    // Genera oggetto email
    const oggetto = `Richiesta Preventivo: ${eventoText} - ${dataFormattata} - ${servizioText} - ${partecipantiText} persone`;

    // Genera corpo email HTML
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
          <span class="value"><strong>${eventoText}</strong></span>
        </div>
        <div class="field">
          <span class="label">Data:</span>
          <span class="value">${dataFormattata}</span>
        </div>
        <div class="field">
          <span class="label">Servizio:</span>
          <span class="value">${servizioText}</span>
        </div>
        <div class="field">
          <span class="label">N° Partecipanti:</span>
          <span class="value">${partecipantiText}</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title">👤 Dati di Contatto</div>
        <div class="field">
          <span class="label">Nome:</span>
          <span class="value">${data.nome} ${data.cognome}</span>
        </div>
        <div class="field">
          <span class="label">Email:</span>
          <span class="value"><a href="mailto:${data.email}">${data.email}</a></span>
        </div>
        <div class="field">
          <span class="label">Telefono:</span>
          <span class="value">${data.telefono || 'Non specificato'}</span>
        </div>
      </div>

      ${data.messaggio ? `
      <div class="section">
        <div class="section-title">💬 Messaggio</div>
        <div class="message-box">
          ${data.messaggio.replace(/\n/g, '<br>')}
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

    // Genera corpo email testo (fallback)
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

    // Invia email tramite Brevo API
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': import.meta.env.BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: {
          name: 'Sito Web TRE',
          email: 'info@ristorantepizzeriatre.it'
        },
        to: [
          {
            email: 'info@ristorantepizzeriatre.it',
            name: 'Ristorante Pizzeria TRE'
          },
          {
            email: 'residencepassone@gmail.com',
            name: 'Test TRE'
          }
        ],
        replyTo: {
          email: data.email,
          name: `${data.nome} ${data.cognome}`
        },
        subject: oggetto,
        htmlContent: htmlContent,
        textContent: textContent
      })
    });

    if (brevoResponse.ok) {
      const result = await brevoResponse.json();
      return new Response(
        JSON.stringify({ 
          success: true, 
          messageId: result.messageId,
          evento: data.evento 
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      const errorData = await brevoResponse.json();
      console.error('Brevo API Error:', errorData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Errore nell\'invio dell\'email',
          details: errorData 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Server Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Errore del server',
        details: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Gestisci altri metodi HTTP
export async function GET() {
  return new Response(
    JSON.stringify({ error: 'Metodo non consentito. Usa POST.' }),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  );
}