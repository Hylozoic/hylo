/**
 * OpenCollectiveService
 *
 * Reads Hylo's contributions from the Open Collective GraphQL API v2 and keeps
 * a local copy in open_collective_orders (#1754).
 *
 * Auth is a personal token from a dedicated integration user that is an admin
 * of the collective (OPEN_COLLECTIVE_TOKEN). When the token is not set,
 * everything degrades gracefully: syncs no-op with a log line and on-demand
 * calls throw a NotConfiguredError that callers turn into a clear message.
 */
const fetch = require('node-fetch')

const DEFAULT_API_URL = 'https://api.opencollective.com/graphql/v2'
const PAGE_SIZE = 100
const MAX_PAGES = 100 // safety net: 10,000 orders

const ORDER_FIELDS = `
  id
  status
  frequency
  createdAt
  lastChargedAt
  nextChargeDate
  tags
  amount { valueInCents currency }
  fromAccount {
    id
    slug
    type
    isIncognito
    ... on Individual { isGuest }
  }
  toAccount { slug }
`

const INCOMING_ORDERS_QUERY = `
  query HyloIncomingOrders ($slug: String!, $limit: Int!, $offset: Int!) {
    account(slug: $slug) {
      orders(filter: INCOMING, limit: $limit, offset: $offset) {
        totalCount
        nodes { ${ORDER_FIELDS} }
      }
    }
  }
`

const ORDER_QUERY = `
  query HyloOrder ($id: String!) {
    order(order: { id: $id }) { ${ORDER_FIELDS} }
  }
`

// "Admin only. To filter on the email address of a member, useful to check if a member exists."
const MEMBERS_BY_EMAIL_QUERY = `
  query HyloMembersByEmail ($slug: String!, $email: EmailAddress!) {
    account(slug: $slug) {
      members(email: $email, role: BACKER, limit: 20) {
        nodes { account { id slug isIncognito } }
      }
    }
  }
`

class NotConfiguredError extends Error {
  constructor () {
    super('Open Collective is not configured')
    this.code = 'OPEN_COLLECTIVE_NOT_CONFIGURED'
  }
}

let inFlightSync = null
let lastSyncFinishedAt = 0

function log (level, ...args) {
  const logger = global.sails && global.sails.log
  if (logger && logger[level]) return logger[level](...args)
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](...args)
}

const OpenCollectiveService = {
  NotConfiguredError,

  config () {
    return {
      token: process.env.OPEN_COLLECTIVE_TOKEN || '',
      slug: process.env.OPEN_COLLECTIVE_SLUG || 'hylo',
      apiUrl: process.env.OPEN_COLLECTIVE_API_URL || DEFAULT_API_URL
    }
  },

  isConfigured () {
    return !!OpenCollectiveService.config().token
  },

  async request (query, variables = {}) {
    const { token, apiUrl } = OpenCollectiveService.config()
    if (!token) throw new NotConfiguredError()

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Personal-Token': token
      },
      body: JSON.stringify({ query, variables })
    })
    let body
    try {
      body = await res.json()
    } catch (e) {
      throw new Error(`Open Collective API returned ${res.status} with a non-JSON body`)
    }
    if (!res.ok || (body.errors && body.errors.length > 0)) {
      const message = (body.errors && body.errors.map(e => e.message).join('; ')) || res.statusText
      throw new Error(`Open Collective API error (${res.status}): ${message}`)
    }
    return body.data
  },

  /** Every contribution to the collective, newest first as OC returns them. */
  async fetchIncomingOrders () {
    const { slug } = OpenCollectiveService.config()
    const nodes = []
    for (let page = 0; page < MAX_PAGES; page++) {
      const data = await OpenCollectiveService.request(INCOMING_ORDERS_QUERY, { slug, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      const orders = data && data.account && data.account.orders
      if (!orders) throw new Error(`Open Collective account "${slug}" not found`)
      nodes.push(...orders.nodes)
      if (orders.nodes.length < PAGE_SIZE || nodes.length >= orders.totalCount) break
    }
    return nodes
  },

  /** One order by its v2 id (the `orderIdV2` OC appends to the redirect URL), or null. */
  async fetchOrder (ocOrderId) {
    if (!ocOrderId) return null
    try {
      const data = await OpenCollectiveService.request(ORDER_QUERY, { id: String(ocOrderId) })
      return (data && data.order) || null
    } catch (e) {
      if (e instanceof NotConfiguredError) throw e
      // OC answers an unknown id with a NotFound GraphQL error
      if (/not ?found/i.test(e.message)) return null
      throw e
    }
  },

  /** The OC accounts that back the collective with this email address. */
  async findBackerAccounts (email) {
    if (!email) return []
    const { slug } = OpenCollectiveService.config()
    const data = await OpenCollectiveService.request(MEMBERS_BY_EMAIL_QUERY, { slug, email })
    const nodes = (data && data.account && data.account.members && data.account.members.nodes) || []
    const byId = {}
    nodes.forEach(n => { if (n.account && n.account.id) byId[n.account.id] = n.account })
    return Object.values(byId)
  },

  /** Maps an OC order node to open_collective_orders columns (never the Hylo-side attributed_* ones). */
  orderToRow (node) {
    const from = node.fromAccount || {}
    return {
      oc_order_id: node.id,
      oc_account_id: from.id || null,
      oc_account_slug: from.slug || null,
      account_type: from.type || null,
      is_incognito: !!from.isIncognito,
      status: node.status || null,
      frequency: node.frequency || null,
      currency: node.amount ? node.amount.currency : null,
      oc_created_at: node.createdAt || null,
      last_charged_at: node.lastChargedAt || null,
      tags: node.tags || [],
      raw: JSON.stringify(node)
    }
  },

  /** Idempotent upsert keyed on oc_order_id. Returns the stored rows. */
  async upsertOrders (nodes, { knex = bookshelf.knex } = {}) {
    const { slug } = OpenCollectiveService.config()
    // Only keep contributions to our collective (orders(filter: INCOMING) can include child accounts)
    const rows = nodes
      .filter(n => n && n.id && (!n.toAccount || !n.toAccount.slug || n.toAccount.slug === slug))
      .map(n => ({ ...OpenCollectiveService.orderToRow(n), updated_at: knex.fn.now() }))
    if (rows.length === 0) return []
    // knex 0.21's merge() doesn't take a column list, so spell out `col = EXCLUDED.col`
    const updates = {}
    Object.keys(rows[0]).filter(c => c !== 'oc_order_id').forEach(c => {
      updates[c] = knex.raw('EXCLUDED.??', [c])
    })
    return knex('open_collective_orders')
      .insert(rows)
      .onConflict('oc_order_id')
      .merge(updates)
      .returning('*')
  },

  /**
   * Pulls every order from OC and upserts it. Concurrent calls share one run,
   * and `minIntervalMs` skips a run if the last one finished recently (used by
   * the webhook and on-demand checks; the daily cron passes 0).
   */
  async syncOrders ({ minIntervalMs = 0 } = {}) {
    if (!OpenCollectiveService.isConfigured()) {
      log('info', 'Open Collective sync skipped: OPEN_COLLECTIVE_TOKEN is not set')
      return { skipped: true, count: 0 }
    }
    if (inFlightSync) return inFlightSync
    if (minIntervalMs && Date.now() - lastSyncFinishedAt < minIntervalMs) {
      return { skipped: true, count: 0 }
    }
    inFlightSync = (async () => {
      try {
        const nodes = await OpenCollectiveService.fetchIncomingOrders()
        const rows = await OpenCollectiveService.upsertOrders(nodes)
        // Contributions started from Hylo carry a hylo-<token> tag: finish those intents
        await require('./SupporterService').completeIntentsForOrders(rows)
        log('debug', `Open Collective sync: ${rows.length} orders`)
        return { skipped: false, count: rows.length }
      } finally {
        lastSyncFinishedAt = Date.now()
        inFlightSync = null
      }
    })()
    return inFlightSync
  },

  /** Re-fetches one order and stores it. Returns the stored row, or null if OC doesn't know it. */
  async syncOrder (ocOrderId) {
    const node = await OpenCollectiveService.fetchOrder(ocOrderId)
    if (!node) return null
    const [row] = await OpenCollectiveService.upsertOrders([node])
    return row ? { row, node } : { row: null, node }
  },

  // For tests: forget throttling state between cases
  resetSyncState () {
    inFlightSync = null
    lastSyncFinishedAt = 0
  }
}

module.exports = OpenCollectiveService
