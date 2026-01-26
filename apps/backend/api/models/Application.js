/**
 * Application Model
 *
 * Represents an OAuth application registered by a developer.
 * Applications can optionally have an associated bot user.
 */
import bcrypt from 'bcrypt'
import crypto from 'crypto'

const SALT_ROUNDS = 12

module.exports = bookshelf.Model.extend({
  tableName: 'applications',
  requireFetch: false,
  hasTimestamps: ['created_at', 'updated_at'],

  owner: function () {
    return this.belongsTo(User, 'owner_id')
  },

  bot: function () {
    return this.belongsTo(User, 'bot_user_id')
  },

  botGroupPermissions: function () {
    return this.hasMany(BotGroupPermission, 'bot_user_id', 'bot_user_id')
  },

  /**
   * Verify a client secret against the stored hash
   */
  async verifySecret (plainSecret) {
    const hash = this.get('client_secret_hash')
    return bcrypt.compare(plainSecret, hash)
  },

  /**
   * Get scopes as array (handles postgres array type)
   */
  getScopes () {
    const scopes = this.get('scopes')
    if (Array.isArray(scopes)) return scopes
    if (typeof scopes === 'string') {
      // Handle postgres array notation {a,b,c}
      return scopes.replace(/[{}]/g, '').split(',').filter(Boolean)
    }
    return ['openid', 'profile']
  },

  /**
   * Get redirect URIs as array
   */
  getRedirectUris () {
    const uris = this.get('redirect_uris')
    if (Array.isArray(uris)) return uris
    if (typeof uris === 'string') {
      return uris.replace(/[{}]/g, '').split(',').filter(Boolean)
    }
    return []
  },

  /**
   * Get webhook events as array
   */
  getWebhookEvents () {
    const events = this.get('webhook_events')
    if (Array.isArray(events)) return events
    if (typeof events === 'string') {
      return events.replace(/[{}]/g, '').split(',').filter(Boolean)
    }
    return []
  }

}, {
  // Static methods

  /**
   * Generate a new client ID
   */
  generateClientId () {
    return crypto.randomBytes(32).toString('hex')
  },

  /**
   * Generate a new client secret and return both plain and hashed versions
   */
  async generateClientSecret () {
    const plainSecret = crypto.randomBytes(32).toString('hex')
    const hash = await bcrypt.hash(plainSecret, SALT_ROUNDS)
    return { plainSecret, hash }
  },

  /**
   * Find application by ID
   */
  find (id, opts = {}) {
    if (!id) return Promise.resolve(null)
    return this.where({ id }).fetch(opts)
  },

  /**
   * Find application by client_id
   */
  findByClientId (clientId, opts = {}) {
    if (!clientId) return Promise.resolve(null)
    return this.where({ client_id: clientId }).fetch(opts)
  },

  /**
   * Find all applications owned by a user
   */
  findByOwner (userId, opts = {}) {
    if (!userId) return Promise.resolve([])
    return this.where({ owner_id: userId }).fetchAll(opts)
  },

  /**
   * Create a new application
   */
  async create (data, opts = {}) {
    const { name, description, ownerId, redirectUris, scopes } = data

    const clientId = this.generateClientId()
    const { plainSecret, hash } = await this.generateClientSecret()

    const app = await this.forge({
      name,
      description: description || null,
      owner_id: ownerId,
      client_id: clientId,
      client_secret_hash: hash,
      redirect_uris: redirectUris || [],
      scopes: scopes || ['openid', 'profile']
    }).save(null, opts)

    // Return app with the plain secret (only time it's visible)
    return { application: app, clientSecret: plainSecret }
  },

  /**
   * Regenerate client secret for an application
   */
  async regenerateSecret (id, opts = {}) {
    const app = await this.find(id, opts)
    if (!app) throw new Error('Application not found')

    const { plainSecret, hash } = await this.generateClientSecret()

    await app.save({ client_secret_hash: hash }, { patch: true, ...opts })

    return plainSecret
  },

  /**
   * Bot permission types that applications can request
   */
  BOT_PERMISSIONS: [
    'read_posts',
    'create_posts',
    'create_comments',
    'read_members',
    'send_messages',
    'manage_events',
    'read_announcements',
    'create_announcements'
  ],

  /**
   * Webhook event types that can be subscribed to
   */
  WEBHOOK_EVENTS: [
    'post.created',
    'comment.created',
    'mention.created'
  ]
})
