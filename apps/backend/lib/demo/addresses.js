/**
 * Addresses the demo builder invents. Mail to this domain is never delivered.
 */
const DEMO_EMAIL_DOMAIN = 'demo.invalid'

/**
 * True when an address belongs to a generated demo account.
 * @param {string} address
 * @returns {boolean}
 */
function isDemoAddress (address) {
  if (!address) return false
  return String(address).toLowerCase().indexOf('@' + DEMO_EMAIL_DOMAIN) !== -1
}

module.exports = { DEMO_EMAIL_DOMAIN, isDemoAddress }
