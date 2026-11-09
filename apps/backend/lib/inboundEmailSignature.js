import crypto from 'crypto'

/**
 * Checks SendGrid's Inbound Parse signature: ECDSA over the timestamp header followed by the raw body.
 * The public key comes from the SendGrid webhook security policy attached to the parse setting.
 */
export function isValidInboundEmailSignature (headers, rawBody) {
  const publicKey = process.env.SENDGRID_INBOUND_PARSE_PUBLIC_KEY
  if (!publicKey) {
    // TODO from assistant: fails open until the key is configured in every environment; then remove this branch.
    sails.log.warn('SENDGRID_INBOUND_PARSE_PUBLIC_KEY is not set, accepting unsigned inbound email')
    return true
  }

  const signature = headers['x-twilio-email-event-webhook-signature']
  const timestamp = headers['x-twilio-email-event-webhook-timestamp']
  if (!signature || !timestamp) return false

  try {
    return crypto.verify(
      'sha256',
      Buffer.concat([Buffer.from(timestamp), rawBody]),
      crypto.createPublicKey({ key: Buffer.from(publicKey, 'base64'), format: 'der', type: 'spki' }),
      Buffer.from(signature, 'base64')
    )
  } catch (err) {
    return false
  }
}
