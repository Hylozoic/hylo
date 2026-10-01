/* global sails */
// SendGrid Event Webhook for Hylo's bounce and complaint events (D36), at
// POST /noo/hook/email-events. The body is kept raw (config/customMiddleware.js) so its
// signature can be checked; unsigned or wrongly signed requests change nothing.
// What each event does is in lib/email/emailEvents.js.
import { isValidEventWebhookSignature } from '../../lib/email/eventWebhookSignature'
import { handleEmailEvent } from '../../lib/email/emailEvents'

module.exports = {
  receive: async function (req, res) {
    if (!process.env.SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY) {
      sails.log.error('EmailEventsController: SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY is not set, refusing email events')
      return res.status(503).json({ error: 'Not configured' })
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body : null
    if (!rawBody || !isValidEventWebhookSignature(req.headers, rawBody)) {
      return res.status(403).json({ error: 'Invalid signature' })
    }

    let events
    try {
      events = JSON.parse(rawBody.toString('utf8'))
    } catch (err) {
      return res.status(400).json({ error: 'Invalid body' })
    }
    if (!Array.isArray(events)) return res.status(400).json({ error: 'Invalid body' })

    // One bad event must not make the provider resend the whole batch
    let handled = 0
    for (const event of events) {
      try {
        if (await handleEmailEvent(event)) handled += 1
      } catch (err) {
        sails.log.error(`EmailEventsController: could not handle a ${event?.event} event: ${err.message}`)
      }
    }

    return res.ok({ received: events.length, handled })
  }
}
