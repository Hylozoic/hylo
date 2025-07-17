const CookieConsentService = {
  /**
   * Upsert a cookie consent record
   * @param {Object} opts - { consentId, settings, version, ipAddress, userAgent, userId }
   * @returns {Promise<CookieConsent>}
   */
  upsert: async function ({ consentId, settings, version, ipAddress, userAgent, userId }) {
    return await CookieConsent.createOrUpdate(
      consentId,
      settings,
      {
        version,
        ip_address: ipAddress,
        user_agent: userAgent,
        user_id: userId
      }
    )
  }
}

export default CookieConsentService
