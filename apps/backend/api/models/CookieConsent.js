import { v4 as uuidv4 } from 'uuid'
import HasSettings from './mixins/HasSettings'

module.exports = bookshelf.Model.extend(Object.assign({
  tableName: 'cookie_consents',
  requireFetch: false,
  hasTimestamps: true,

  /**
   * Generate a new UUID for the consent_id field before saving
   */
  initialize: function () {
    this.on('creating', function (model) {
      if (!model.get('consent_id')) {
        model.set('consent_id', uuidv4())
      }
    })
  },

  /**
   * Relationship to User model
   * A cookie consent belongs to a single user (when user is logged in)
   */
  user: function () {
    return this.belongsTo(User, 'user_id')
  }
}, HasSettings), {
  /**
   * Default consent settings structure
   */
  DefaultSettings: {
    analytics: true,
    support: true
  },

  /**
   * Consent versions
   */
  Versions: {
    V1_0: '1.0'
  },

  /**
   * Create or update a consent record
   * If consentId is provided and exists, update the existing record
   * Otherwise create a new record
   */
  createOrUpdate: async function (consentId, settings, options = {}) {
    let consent

    if (options.user_id) {
      // Try to find the latest consent for this user
      consent = await this.where({ user_id: options.user_id })
        .orderBy('created_at', 'desc')
        .fetch()
    } else if (consentId) {
      // Try to find existing consent by consent_id
      consent = await this.where({ consent_id: consentId }).fetch()
    }

    if (consent) {
      // Update existing consent
      consent.set('settings', settings)
      consent.set('version', options.version || consent.get('version'))
      consent.set('ip_address', options.ip_address || consent.get('ip_address'))
      consent.set('user_agent', options.user_agent || consent.get('user_agent'))

      if (options.user_id !== undefined) {
        consent.set('user_id', options.user_id)
      }

      const result = await consent.save()
      return result
    } else {
      // Create new consent
      const newConsentData = {
        consent_id: consentId || uuidv4(),
        user_id: options.user_id || null,
        settings: settings,
        version: options.version || '1.0',
        ip_address: options.ip_address,
        user_agent: options.user_agent
      }

      // Validate user_id if provided
      if (newConsentData.user_id) {
        const user = await User.where({ id: newConsentData.user_id }).fetch()
        if (!user) {
          throw new Error(`User with id ${newConsentData.user_id} not found`)
        }
      }

      // Create the model instance
      const newConsent = this.forge(newConsentData)
      const savedConsent = await newConsent.save()
      return savedConsent
    }
  },

  /**
   * Get the latest consent for a user
   */
  getLatestForUser: async function (userId) {
    return await this.where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .fetch()
  },

  /**
   * Get consent by consent_id
   */
  getByConsentId: async function (consentId) {
    return await this.where({ consent_id: consentId }).fetch()
  },

  /**
   * Get consent by id
   */
  getById: async function (id) {
    return await this.where({ id }).fetch()
  }
})
