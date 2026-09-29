import crypto from 'crypto'

// How far the signed timestamp may be from now, so a batch can't be accepted again long
// after it was signed. Assumes the provider signs each delivery attempt when it sends it.
export const MAX_TIMESTAMP_SKEW_SECONDS = 10 * 60

/**
 * Checks the signature on SendGrid's Event Webhook (D36): ECDSA over the timestamp header
 * followed by the raw body, with the verification key of the webhook set up for Hylo's
 * bounce and complaint events (SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY, base64 DER). That
 * webhook is separate from any other webhook and from inbound email, and has its own key.
 * Without a key nothing is accepted, and neither is a timestamp more than
 * MAX_TIMESTAMP_SKEW_SECONDS from now.
 */
export function isValidEventWebhookSignature (headers, rawBody, publicKey = process.env.SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY) {
  if (!publicKey || !Buffer.isBuffer(rawBody)) return false

  const signature = headers?.['x-twilio-email-event-webhook-signature']
  const timestamp = headers?.['x-twilio-email-event-webhook-timestamp']
  if (!signature || !timestamp) return false

  const signedAt = Number(timestamp)
  if (!Number.isFinite(signedAt) || Math.abs(Date.now() / 1000 - signedAt) > MAX_TIMESTAMP_SKEW_SECONDS) return false

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
