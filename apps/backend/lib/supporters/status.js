// Rules for what counts as supporting Hylo (#1754, Tom's decision 4):
// - a recurring contribution (MONTHLY/YEARLY) counts while it is ACTIVE;
// - a one-time contribution counts for 12 months after it was paid;
// - nothing else counts (cancelled, paused, refunded, disputed, pending...).
// There is no "past supporter" state: a person or group is a supporter or not.
// Manual grants from Hylo staff (supporter_grants) count the same way while
// they are not revoked or expired.

const RECURRING = ['MONTHLY', 'YEARLY']
const ONE_TIME_MONTHS = 12

const SUPPORTER = 'supporter'
const NONE = 'none'

function oneTimeCutoff (now = new Date()) {
  const cutoff = new Date(now)
  cutoff.setMonth(cutoff.getMonth() - ONE_TIME_MONTHS)
  return cutoff
}

// When a contribution was paid: the last charge, or its creation for one-time
// orders that OC doesn't report a charge date for.
function paidAt (order) {
  return order.last_charged_at || order.oc_created_at
}

/** Whether one open_collective_orders row (plain attributes) qualifies. */
function orderQualifies (order, now = new Date()) {
  if (!order) return false
  if (RECURRING.includes(order.frequency)) return order.status === 'ACTIVE'
  if (order.frequency === 'ONETIME' && order.status === 'PAID') {
    const date = paidAt(order)
    return !!date && new Date(date) > oneTimeCutoff(now)
  }
  return false
}

/**
 * The same rule as orderQualifies, for a knex query on open_collective_orders
 * aliased as `o`. Keep the two in sync.
 */
function whereOrderQualifies (q, now = new Date()) {
  return q.where(function () {
    this.where(function () {
      this.whereIn('o.frequency', RECURRING).andWhere('o.status', 'ACTIVE')
    }).orWhere(function () {
      this.where('o.frequency', 'ONETIME')
        .andWhere('o.status', 'PAID')
        .andWhereRaw('COALESCE(o.last_charged_at, o.oc_created_at) > ?', [oneTimeCutoff(now)])
    })
  })
}

function whereGrantActive (q, now = new Date()) {
  return q.whereNull('revoked_at').andWhere(function () {
    this.whereNull('expires_at').orWhere('expires_at', '>', now)
  })
}

async function userIsSupporter (userId, now = new Date(), knex = bookshelf.knex) {
  if (!userId) return false
  const order = await knex('open_collective_orders as o')
    .join('supporter_links as l', 'l.oc_account_id', 'o.oc_account_id')
    .where('l.user_id', userId)
    .modify(whereOrderQualifies, now)
    .first('o.id')
  if (order) return true
  const grant = await knex('supporter_grants')
    .where('user_id', userId)
    .modify(whereGrantActive, now)
    .first('id')
  return !!grant
}

// A group's support comes from contributions a linked supporter attributed to
// it (attributed_by_id must still own the OC account), or from a staff grant.
async function groupIsSupporter (groupId, now = new Date(), knex = bookshelf.knex) {
  if (!groupId) return false
  const order = await knex('open_collective_orders as o')
    .join('supporter_links as l', function () {
      this.on('l.oc_account_id', 'o.oc_account_id').andOn('l.user_id', 'o.attributed_by_id')
    })
    .where('o.attributed_group_id', groupId)
    .modify(whereOrderQualifies, now)
    .first('o.id')
  if (order) return true
  const grant = await knex('supporter_grants')
    .where('group_id', groupId)
    .modify(whereGrantActive, now)
    .first('id')
  return !!grant
}

module.exports = {
  SUPPORTER,
  NONE,
  orderQualifies,
  whereOrderQualifies,
  whereGrantActive,
  userIsSupporter,
  groupIsSupporter
}
