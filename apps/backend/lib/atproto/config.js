/**
 * Configuration for the experimental AT Protocol identity layer (Hylo as a PDS).
 *
 * Read from env on each call so tests can override process.env.
 */

const PRODUCTION_PLC_URL = 'https://plc.directory'

const list = value => (value || '')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean)

// Identifies a PLC directory: identities are scoped to (plcUrl, handleDomain)
export const normalizePlcUrl = url => (url || '').trim().toLowerCase().replace(/\/+$/, '')

export function atprotoConfig () {
  const env = process.env
  return {
    enabled: env.ATPROTO_ENABLED === 'true',
    // Sandbox mode relaxes SSRF protection so identity resolution can reach private (AiaB) addresses
    sandbox: env.ATPROTO_SANDBOX === 'true',
    plcUrl: normalizePlcUrl(env.ATPROTO_PLC_URL),
    pdsUrl: env.ATPROTO_PDS_URL,
    // Handles are minted as <name>.<handleDomain>
    handleDomain: (env.ATPROTO_HANDLE_DOMAIN || '').trim().toLowerCase(),
    allowedEmailDomains: list(env.ATPROTO_ALLOWED_EMAIL_DOMAINS),
    // Optional: when set, only these emails are eligible (e.g. test accounts on a prod-cloned staging DB)
    allowedEmails: list(env.ATPROTO_ALLOWED_EMAILS),
    // Hex-encoded secp256k1 private key authorizing PLC operations for every DID we create
    plcRotationKeyHex: env.ATPROTO_PLC_ROTATION_KEY_HEX,
    // 32 bytes (hex or base64) used to encrypt per-user signing keys at rest
    keyEncryptionSecret: env.ATPROTO_KEY_ENCRYPTION_SECRET,
    // Operations on plc.directory are public and permanent, so writing there needs explicit sign-off
    productionPlcApproved: env.ATPROTO_PRODUCTION_PLC_APPROVED === 'true'
  }
}

export const isProductionPlc = plcUrl => normalizePlcUrl(plcUrl) === PRODUCTION_PLC_URL

/**
 * The columns that tie an identity row to this instance. Rows with other values were created
 * elsewhere (e.g. copied in with a prod database clone) and must be ignored.
 */
export const instanceOf = (config = atprotoConfig()) => ({
  plc_url: config.plcUrl,
  handle_domain: config.handleDomain
})

/**
 * Throws unless every setting needed to mint identities is present and safe.
 */
export function assertAtprotoConfigured (config = atprotoConfig()) {
  if (!config.enabled) throw new Error('AT Protocol identities are disabled (ATPROTO_ENABLED)')

  const missing = ['plcUrl', 'pdsUrl', 'handleDomain', 'plcRotationKeyHex', 'keyEncryptionSecret']
    .filter(key => !config[key])
  if (config.allowedEmailDomains.length === 0) missing.push('allowedEmailDomains')
  if (missing.length > 0) throw new Error(`Missing AT Protocol config: ${missing.join(', ')}`)

  if (config.sandbox && isProductionPlc(config.plcUrl)) {
    throw new Error('ATPROTO_SANDBOX cannot be used with the production PLC directory')
  }

  return config
}

/**
 * Throws unless we may send operations (create/update/tombstone) to the configured PLC.
 */
export function assertCanWriteToPlc (config = atprotoConfig()) {
  assertAtprotoConfigured(config)
  if (isProductionPlc(config.plcUrl) && !config.productionPlcApproved) {
    throw new Error('Refusing to write to plc.directory without ATPROTO_PRODUCTION_PLC_APPROVED=true')
  }
  return config
}
