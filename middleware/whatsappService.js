/**
 * whatsappService.js — Send WhatsApp messages via Twilio
 * Requires: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM in .env
 */

function isConfigured() {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_WHATSAPP_FROM
  );
}

async function sendWhatsAppMessage({ to, message }) {
  if (!isConfigured()) {
    console.log('⚠️  [WhatsApp] Twilio not configured — skipping WhatsApp notification.');
    return;
  }

  // Phone must be in E.164 format e.g. +254712345678
  const phone = to.startsWith('+') ? to : `+${to}`;

  try {
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
      to:   `whatsapp:${phone}`,
      body: message,
    });
    console.log(`✅ [WhatsApp] Message sent to ${phone}`);
  } catch (err) {
    console.error(`❌ [WhatsApp] Failed to send to ${phone}:`, err.message);
  }
}

module.exports = { sendWhatsAppMessage, isConfigured };
