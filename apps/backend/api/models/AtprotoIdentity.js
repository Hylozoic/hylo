/**
 * Experimental: a Hylo user's AT Protocol identity (did:plc + handle), hosted by Hylo as their PDS.
 * See lib/atproto for key handling, handles and config.
 */
import { atprotoConfig } from '../../lib/atproto/config'
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

  signingKey: function (config = atprotoConfig()) {
    return loadSigningKey(this.get('signing_key_encrypted'), {
      secret: config.keyEncryptionSecret,
      userId: this.get('user_id')
    })
  }
}, {
  STATUS,

  forUser: function (userId, opts) {
    return this.where({ user_id: userId }).fetch(opts)
  },

  findActiveByHandle: function (handle, opts) {
    return this.where({ handle: (handle || '').toLowerCase(), status: STATUS.Active }).fetch(opts)
  },

  findByDid: function (did, opts) {
    return this.where({ did }).fetch(opts)
  }
})
