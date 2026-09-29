import crypto from 'crypto'

/**
 * Checks the signature on SendGrid's Event Webhook (D36): ECDSA over the timestamp header
 * followed by the raw body, with the verification key of the webhook set up for Hylo's
 * bounce and complaint events (SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY, base64 DER). That
 * webhook is separate from any other webhook and from inbound email, and has its own key.
 * Without a key nothing is accepted.
 */
export function isValidEventWebhookSignature (headers, rawBody, publicKey = process.env.SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY) {
  if (!publicKey || !Buffer.isBuffer(rawBody)) return false

  const signature = headers?.['x-twilio-email-event-webhook-signature']
  const timestamp = headers?.['x-twilio-email-event-webhook-timestamp']
  if (!signature || !timestamp) return false

  try {
    return crypto.verify(
      'sha256',
      Buffer.concat([Buffer.from(String(timestamp)), rawBody]),
      crypto.createPublicKey({ key: Buffer.from(publicKey, 'base64'), format: 'der', type: 'spki' }),
      Buffer.from(String(signature), 'base64')
    )
  } catch (err) {
    return false
  }
}
