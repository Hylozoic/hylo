const AUTORESPONDER_HEADERS = ['x-autoreply', 'x-autorespond', 'x-autoresponder']

// Anchored to the start because a genuine reply's subject contains the post title
const AUTORESPONDER_SUBJECT = new RegExp('^\\s*\\[?(' + [
  'auto(matic|mated)?[ -]?(reply|response|answer)',
  'out of (the )?office',
  'ooo\\b',
  'request received',
  'ticket received',
  'abwesenheit',
  'automatische antwort',
  'réponse automatique',
  'respuesta automática',
  'risposta automatica',
  'resposta automática',
  'automatisch antwoord',
  'autosvar',
  'undeliverable',
  'delivery status notification',
  'mail delivery (failed|subsystem)'
].join('|') + ')', 'i')

// Help desks (Zendesk etc.) put this marker at the top of ticket acknowledgements
const HELPDESK_BODY_MARKER = /type your reply above this line/i

/**
 * Parses the raw header block that SendGrid Inbound Parse sends in the `headers` field
 * into a map of lowercased header name to value. Folded (multi-line) values are joined.
 */
export function parseRawEmailHeaders (rawHeaders) {
  if (!rawHeaders) return {}
  return rawHeaders
    .replace(/\r\n/g, '\n')
    .replace(/\n[ \t]+/g, ' ')
    .split('\n')
    .reduce((headers, line) => {
      const separator = line.indexOf(':')
      if (separator <= 0) return headers
      const name = line.slice(0, separator).trim().toLowerCase()
      if (!(name in headers)) headers[name] = line.slice(separator + 1).trim()
      return headers
    }, {})
}

/**
 * Returns the SMTP envelope sender from SendGrid's `envelope` JSON field, or undefined if unavailable.
 * Auto-responses and bounces are sent with an empty (null) envelope sender per RFC 3834.
 */
function envelopeSender (envelope) {
  if (!envelope) return undefined
  try {
    return JSON.parse(envelope).from
  } catch (e) {
    return undefined
  }
}

/**
 * Detects out-of-office replies, help desk ticket acknowledgements, bounces and other automated
 * emails sent to a post reply address, using the fields posted by SendGrid Inbound Parse.
 */
export function isAutoresponderEmail (params) {
  const headers = parseRawEmailHeaders(params.headers)

  const autoSubmitted = (headers['auto-submitted'] || '').toLowerCase()
  if (autoSubmitted && autoSubmitted !== 'no') return true

  if (AUTORESPONDER_HEADERS.some(name => name in headers)) return true

  const precedence = (headers.precedence || headers['x-precedence'] || '').toLowerCase()
  if (['bulk', 'junk', 'auto_reply'].includes(precedence)) return true

  const sender = envelopeSender(params.envelope)
  if (sender !== undefined && (!sender || sender === '<>')) return true

  if (AUTORESPONDER_SUBJECT.test(params.subject || '')) return true

  const body = params.text || params['stripped-text'] || params.html || params['stripped-html'] || ''
  return HELPDESK_BODY_MARKER.test(body)
}
