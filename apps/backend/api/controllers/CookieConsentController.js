import CookieConsentService from '../services/CookieConsentService'
import { validate as uuidValidate } from 'uuid'

module.exports = {
  /**
   * Upsert a cookie consent record (unauthenticated)
   * Accepts JSON body with: consentId (optional), settings, version, ipAddress, userAgent, userId (optional)
   */
  upsert: async function (req, res) {
    try {
      const {
        consent_id: consentId,
        settings,
        version,
        ip_address: ipAddress,
        user_agent: userAgent,
        user_id: userId
      } = req.body || req.allParams()

      // Validate required fields
      if (!settings) {
        return res.status(400).json({ error: 'Missing settings' })
      }

      // Validate consentId if provided
      if (consentId && !uuidValidate(consentId)) {
        return res.status(400).json({ error: 'Invalid consentId format - must be a valid UUID' })
      }

      // Validate settings is an object
      if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
        return res.status(400).json({ error: 'Settings must be a valid JSON object' })
      }

      // Validate and sanitize settings - only allow analytics and support keys
      const allowedKeys = ['analytics', 'support']
      const sanitizedSettings = {}

      for (const key of allowedKeys) {
        if (key in settings) {
          if (typeof settings[key] !== 'boolean') {
            return res.status(400).json({
              error: `Settings.${key} must be a boolean value`
            })
          }
          sanitizedSettings[key] = settings[key]
        }
      }

      // Ensure at least one setting is provided
      if (Object.keys(sanitizedSettings).length === 0) {
        return res.status(400).json({
          error: 'At least one setting (analytics or support) must be provided'
        })
      }

      // Validate version if provided
      if (version && typeof version !== 'string') {
        return res.status(400).json({ error: 'Version must be a string' })
      }

      // Validate IP address if provided
      if (ipAddress && typeof ipAddress !== 'string') {
        return res.status(400).json({ error: 'IP address must be a string' })
      }

      // Validate user agent if provided
      if (userAgent && typeof userAgent !== 'string') {
        return res.status(400).json({ error: 'User agent must be a string' })
      }

      const consent = await CookieConsentService.upsert({
        consentId,
        settings: sanitizedSettings,
        version,
        ipAddress: ipAddress || req.ip,
        userAgent: userAgent || req.headers['user-agent'],
        userId
      })

      res.status(200).json({ success: true, consentId: consent.get('consent_id') })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  }
}
