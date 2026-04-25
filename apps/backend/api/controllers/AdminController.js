import { DateTime } from 'luxon'
import { merge, transform, sortBy } from 'lodash'

/* global bookshelf, Community */

// TODO: this is old and broken
const rawMetricsQuery = startTime => Promise.props({
  community: Community.query(q => {
    q.select(['id', 'name', 'created_at', 'avatar_url'])
  }).query(),

  user: User.query(q => {
    q.where('users.created_at', '>', startTime)
    q.leftJoin('communities_users', 'users.id', 'communities_users.user_id')
    q.select(['users.id', 'users.created_at', 'communities_users.community_id'])
  }).query(),

  post: Post.query(q => {
    q.where('posts.created_at', '>', startTime)
    q.where('posts.type', '!=', 'welcome')
    q.where('posts.user_id', '!=', User.AXOLOTL_ID)
    q.join('communities_posts', 'posts.id', 'communities_posts.post_id')
    q.select(['posts.id', 'posts.created_at', 'communities_posts.community_id', 'posts.user_id'])
  }).query(),

  comment: Comment.query(q => {
    q.where('comments.created_at', '>', startTime)
    q.join('communities_posts', 'comments.post_id', 'communities_posts.post_id')
    q.select(['comments.id', 'comments.created_at', 'communities_posts.community_id', 'comments.user_id'])
  }).query()
})

module.exports = {
  loginAsUser: function (req, res) {
    return User.find(req.param('userId'))
      .then(user => UserSession.login(req, user, 'admin'))
      .then(() => res.redirect('/app'))
  },

  /**
   * Returns dispute and refund analytics for all groups with Stripe Connect accounts.
   * Used by the Management admin UI to surface potential abuse or platform risk.
   */
  stripeAnalytics: async function (req, res) {
    const now = new Date()
    const cutoff90d = new Date(now - 90 * 24 * 60 * 60 * 1000)
    const cutoff7d = new Date(now - 7 * 24 * 60 * 60 * 1000)

    // All groups with a connected Stripe account
    const groups = await bookshelf.knex('groups')
      .join('stripe_accounts', 'groups.stripe_account_id', 'stripe_accounts.id')
      .whereNotNull('groups.stripe_account_id')
      .select(
        'groups.id as group_id',
        'groups.name as group_name',
        'groups.slug as group_slug',
        'groups.stripe_sales_paused',
        'groups.stripe_sales_paused_at',
        'groups.stripe_sales_paused_reason',
        'stripe_accounts.id as stripe_account_id',
        'stripe_accounts.stripe_account_external_id'
      )

    const stats = await Promise.all(groups.map(async (g) => {
      const [disputes90d, disputes7d, refunds90d, totalCharges90d, openDisputes, lastAlert] = await Promise.all([
        bookshelf.knex('stripe_logs')
          .where({ group_id: g.group_id, log_type: 'dispute' })
          .where('created_at', '>', cutoff90d)
          .count('id as count').then(r => parseInt(r[0].count, 10)),
        bookshelf.knex('stripe_logs')
          .where({ group_id: g.group_id, log_type: 'dispute' })
          .where('created_at', '>', cutoff7d)
          .count('id as count').then(r => parseInt(r[0].count, 10)),
        bookshelf.knex('stripe_logs')
          .where({ group_id: g.group_id, log_type: 'refund' })
          .where('created_at', '>', cutoff90d)
          .count('id as count').then(r => parseInt(r[0].count, 10)),
        bookshelf.knex('content_access')
          .where({ group_id: g.group_id })
          .whereNotIn('status', ['cancelled'])
          .whereNotNull('stripe_customer_id')
          .where('created_at', '>', cutoff90d)
          .count('id as count').then(r => parseInt(r[0].count, 10)),
        bookshelf.knex('stripe_logs')
          .where({ group_id: g.group_id, log_type: 'dispute' })
          .whereNotIn('status', ['charge_refunded', 'won', 'lost'])
          .count('id as count').then(r => parseInt(r[0].count, 10)),
        bookshelf.knex('stripe_logs')
          .where({ group_id: g.group_id, log_type: 'alert' })
          .orderBy('created_at', 'desc')
          .first()
      ])

      const disputeRate90d = totalCharges90d > 0
        ? parseFloat((disputes90d / totalCharges90d).toFixed(4))
        : 0

      return {
        group_id: g.group_id,
        group_name: g.group_name,
        group_slug: g.group_slug,
        stripe_account_external_id: g.stripe_account_external_id,
        stripe_sales_paused: !!g.stripe_sales_paused,
        stripe_sales_paused_at: g.stripe_sales_paused_at || null,
        stripe_sales_paused_reason: g.stripe_sales_paused_reason || null,
        total_charges_90d: totalCharges90d,
        disputes_90d: disputes90d,
        disputes_7d: disputes7d,
        open_disputes: openDisputes,
        dispute_rate_90d: disputeRate90d,
        refunds_90d: refunds90d,
        last_alert_at: lastAlert ? lastAlert.created_at : null,
        last_alert_type: lastAlert ? lastAlert.alert_type : null,
        last_alert_threshold: lastAlert ? lastAlert.threshold_triggered : null
      }
    }))

    // Sort by dispute rate descending so highest-risk groups appear first
    stats.sort((a, b) => b.dispute_rate_90d - a.dispute_rate_90d || b.open_disputes - a.open_disputes)

    const platformTotals = stats.reduce((acc, g) => {
      acc.total_disputes_90d += g.disputes_90d
      acc.total_refunds_90d += g.refunds_90d
      acc.total_open_disputes += g.open_disputes
      acc.total_charges_90d += g.total_charges_90d
      return acc
    }, { total_disputes_90d: 0, total_refunds_90d: 0, total_open_disputes: 0, total_charges_90d: 0 })

    return res.json({ groups: stats, platform_totals: platformTotals })
  },

  /**
   * Pauses or unpauses checkout creation for a group's Stripe offerings.
   * This is a Hylo-level safety control for suspected abuse/risk, not a Stripe account disconnect.
   */
  setStripeSalesPaused: async function (req, res) {
    const groupId = parseInt(req.param('groupId'), 10)
    const paused = req.param('paused') === true || req.param('paused') === 'true'
    const reason = req.param('reason') || null

    if (!groupId || Number.isNaN(groupId)) {
      return res.badRequest({ error: 'groupId is required' })
    }

    const group = await Group.find(groupId)
    if (!group) {
      return res.notFound({ error: 'Group not found' })
    }

    const pausedAt = paused ? new Date() : null
    await group.save({
      stripe_sales_paused: paused,
      stripe_sales_paused_at: pausedAt,
      stripe_sales_paused_reason: paused ? reason : null
    }, { patch: true })

    // Audit log in unified stripe_logs table
    await bookshelf.knex('stripe_logs').insert({
      group_id: group.id,
      stripe_account_id: group.get('stripe_account_id') || null,
      log_type: 'admin_action',
      external_id: null,
      metadata: {
        action: paused ? 'pause_sales' : 'resume_sales',
        actor_user_id: req.session?.userId || null,
        reason: reason || null
      }
    })

    return res.json({
      success: true,
      groupId: group.id,
      stripeSalesPaused: paused,
      stripeSalesPausedAt: pausedAt,
      stripeSalesPausedReason: paused ? reason : null
    })
  },

  rawMetrics: function (req, res) {
    const start = DateTime.now().minus({ months: 3 }).toJSDate()
    return rawMetricsQuery(start)
      .then(props => {
        let result = props.community.reduce((acc, c) => {
          acc[c.id] = merge(c, { events: [] })
          return acc
        }, {})

        result.none = { id: 'none', name: 'No community', events: [] }

        ;['user', 'post', 'comment'].forEach(name => {
          props[name].forEach(item => {
            const key = item.community_id || 'none'
            result[key].events.push({
              time: Date.parse(item.created_at),
              user_id: item.user_id || item.id,
              name
            })
          })
        })

        result = transform(result, (acc, c, k) => {
          if (c.events.length === 0) return
          c.events = sortBy(c.events, 'time')
          acc[k] = c
        }, {})

        res.ok(result)
      })
  }
}
