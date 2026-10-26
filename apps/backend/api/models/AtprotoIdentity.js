/**
 * Experimental: a Hylo user's AT Protocol identity (did:plc + handle), hosted by Hylo as their PDS.
 * See lib/atproto for key handling, handles and config.
 *
 * Each row belongs to the instance that created it (plc_url + handle_domain). Lookups only see
 * this instance's rows, so identities copied in from another environment's database (e.g. prod
 * rows in a prod-cloned staging DB) are never served or written to this instance's PLC.
 */
import { atprotoConfig, instanceOf } from '../../lib/atproto/config'
import { loadSigningKey } from '../../lib/atproto/keys'

const STATUS = {
  Pending: 'pending',
  Active: 'active',
  Tombstoned: 'tombstoned'
}

module.exports = bookshelf.Model.extend({
  tableName: 'atproto_identities',
  requireFetch: false,
  hasTimestamps: true,

  user: function () {
    return this.belongsTo(User)
  },

  isActive: function () {
    return this.get('status') === STATUS.Active
  },

  belongsToInstance: function (config = atprotoConfig()) {
    const instance = instanceOf(config)
    return this.get('plc_url') === instance.plc_url && this.get('handle_domain') === instance.handle_domain
  },

  signingKey: function (config = atprotoConfig()) {
    return loadSigningKey(this.get('signing_key_encrypted'), {
      secret: config.keyEncryptionSecret,
      userId: this.get('user_id')
    })
  }
}, {
  STATUS,

  // This instance's identities only
  forInstance: function (config = atprotoConfig()) {
    return this.where(instanceOf(config))
  },

  forUser: function (userId, { config } = {}) {
    return this.forInstance(config).where({ user_id: userId }).fetch()
  },

  findActiveByHandle: function (handle, { config } = {}) {
    return this.forInstance(config)
      .where({ handle: (handle || '').toLowerCase(), status: STATUS.Active })
      .fetch()
  },

  findByDid: function (did, { config } = {}) {
    return this.forInstance(config).where({ did }).fetch()
  },

  // Rows created by other instances (e.g. copied in with a database clone)
  foreignQuery: function (config = atprotoConfig()) {
    const { plc_url: plcUrl, handle_domain: handleDomain } = instanceOf(config)
    return bookshelf.knex('atproto_identities')
      .whereNot(function () { this.where({ plc_url: plcUrl, handle_domain: handleDomain }) })
  }
})
