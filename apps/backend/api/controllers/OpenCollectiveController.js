import crypto from 'crypto'

// Open Collective webhooks are unsigned and best-effort (no retries), and their
// payloads only carry public fields. So a webhook is never trusted: it is only a
// hint to re-sync from the API right away instead of waiting for the daily cron.
// The OC API can't look an order up by the legacy numeric id the payload
// carries, so the hint re-runs the (cheap, throttled) full sync, which re-fetches
// every order including this one.
const WEBHOOK_SYNC_INTERVAL_MS = 30 * 1000

function secretMatches (given) {
  const expected = process.env.OPEN_COLLECTIVE_WEBHOOK_SECRET
  if (!expected || typeof given !== 'string') return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

module.exports = {
  webhook: async function (req, res) {
    if (!secretMatches(req.param('secret'))) {
      return res.status(404).send('Not found')
    }

    const type = req.body && req.body.type
    sails.log.info(`Open Collective webhook received${type ? `: ${type}` : ''}; re-syncing`)

    // Answer straight away; OC doesn't wait long and doesn't retry
    res.ok({ received: true })

    try {
      await OpenCollectiveService.syncOrders({ minIntervalMs: WEBHOOK_SYNC_INTERVAL_MS })
    } catch (err) {
      sails.log.error('Open Collective webhook re-sync failed', err)
    }
  }
}
