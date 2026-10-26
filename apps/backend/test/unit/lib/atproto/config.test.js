import { expect } from 'chai'
import { atprotoConfig, assertAtprotoConfigured, assertCanWriteToPlc, instanceOf, normalizePlcUrl } from '../../../../lib/atproto/config'
import { atprotoIneligibilityReason, isEligibleForAtprotoIdentity } from '../../../../lib/atproto/eligibility'

const ENV_KEYS = [
  'ATPROTO_ENABLED', 'ATPROTO_SANDBOX', 'ATPROTO_PLC_URL', 'ATPROTO_PDS_URL', 'ATPROTO_HANDLE_DOMAIN',
  'ATPROTO_ALLOWED_EMAIL_DOMAINS', 'ATPROTO_PLC_ROTATION_KEY_HEX', 'ATPROTO_KEY_ENCRYPTION_SECRET',
  'ATPROTO_PRODUCTION_PLC_APPROVED', 'ATPROTO_ALLOWED_EMAILS'
]

const fullEnv = {
  ATPROTO_ENABLED: 'true',
  ATPROTO_PLC_URL: 'https://plc.atmosbox.test',
  ATPROTO_PDS_URL: 'https://pds.hylo.atmosbox.test',
  ATPROTO_HANDLE_DOMAIN: 'Hylo.atmosbox.test',
  ATPROTO_ALLOWED_EMAIL_DOMAINS: 'hylo.com, Terran.io',
  ATPROTO_PLC_ROTATION_KEY_HEX: 'a'.repeat(64),
  ATPROTO_KEY_ENCRYPTION_SECRET: 'b'.repeat(64)
}

// Minimal stand-in for a bookshelf User
const user = attrs => ({ get: key => ({ active: true, email_validated: true, ...attrs })[key] })

describe('atproto config', () => {
  let saved

  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]))
    ENV_KEYS.forEach(k => delete process.env[k])
    Object.assign(process.env, fullEnv)
  })

  afterEach(() => {
    ENV_KEYS.forEach(k => {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    })
  })

  it('normalizes domains from env', () => {
    const config = atprotoConfig()
    expect(config.handleDomain).to.equal('hylo.atmosbox.test')
    expect(config.allowedEmailDomains).to.deep.equal(['hylo.com', 'terran.io'])
    expect(assertAtprotoConfigured(config)).to.equal(config)
  })

  it('requires the feature flag and all settings', () => {
    process.env.ATPROTO_ENABLED = 'false'
    expect(() => assertAtprotoConfigured()).to.throw(/disabled/)

    process.env.ATPROTO_ENABLED = 'true'
    delete process.env.ATPROTO_PLC_ROTATION_KEY_HEX
    process.env.ATPROTO_ALLOWED_EMAIL_DOMAINS = ''
    expect(() => assertAtprotoConfigured()).to.throw(/plcRotationKeyHex, allowedEmailDomains/)
  })

  it('refuses sandbox mode against the production PLC directory', () => {
    process.env.ATPROTO_SANDBOX = 'true'
    process.env.ATPROTO_PLC_URL = 'https://plc.directory/'
    expect(() => assertAtprotoConfigured()).to.throw(/production PLC/)
  })

  it('identifies the instance by normalized PLC URL and handle domain', () => {
    expect(normalizePlcUrl(' HTTPS://PLC.Example.test/ ')).to.equal('https://plc.example.test')
    process.env.ATPROTO_PLC_URL = 'https://PLC.atmosbox.test//'
    expect(instanceOf()).to.deep.equal({ plc_url: 'https://plc.atmosbox.test', handle_domain: 'hylo.atmosbox.test' })
  })

  it('only writes to plc.directory with explicit approval', () => {
    expect(assertCanWriteToPlc().plcUrl).to.equal('https://plc.atmosbox.test')

    process.env.ATPROTO_PLC_URL = 'https://plc.directory'
    expect(() => assertCanWriteToPlc()).to.throw(/ATPROTO_PRODUCTION_PLC_APPROVED/)

    process.env.ATPROTO_PRODUCTION_PLC_APPROVED = 'true'
    expect(assertCanWriteToPlc().plcUrl).to.equal('https://plc.directory')
  })

  describe('isEligibleForAtprotoIdentity', () => {
    it('allows active users with a verified email on an allowed domain', () => {
      expect(isEligibleForAtprotoIdentity(user({ email: 'alice@hylo.com' }))).to.be.true
      expect(isEligibleForAtprotoIdentity(user({ email: ' Bob@TERRAN.io ' }))).to.be.true
    })

    it('rejects unverified, inactive and other-domain users', () => {
      expect(isEligibleForAtprotoIdentity(user({ email: 'alice@hylo.com', email_validated: false }))).to.be.false
      expect(isEligibleForAtprotoIdentity(user({ email: 'alice@hylo.com', email_validated: null }))).to.be.false
      expect(isEligibleForAtprotoIdentity(user({ email: 'alice@hylo.com', active: false }))).to.be.false
      expect(isEligibleForAtprotoIdentity(user({ email: 'carol@gmail.com' }))).to.be.false
      expect(isEligibleForAtprotoIdentity(user({ email: 'eve@nothylo.com' }))).to.be.false
      expect(isEligibleForAtprotoIdentity(user({ email: 'eve@sub.hylo.com' }))).to.be.false
      expect(isEligibleForAtprotoIdentity(null)).to.be.false
    })

    it('explains why a user is ineligible', () => {
      expect(atprotoIneligibilityReason(user({ email: 'alice@hylo.com' }))).to.be.null
      expect(atprotoIneligibilityReason(user({ email: 'alice@hylo.com', active: false }))).to.equal('user is not active')
      expect(atprotoIneligibilityReason(user({ email: 'alice@hylo.com', email_validated: false }))).to.equal('email is not verified')
      expect(atprotoIneligibilityReason(user({ email: 'carol@gmail.com' }))).to.equal('email domain is not one of: hylo.com, terran.io')
    })

    it('narrows eligibility to ATPROTO_ALLOWED_EMAILS when set', () => {
      process.env.ATPROTO_ALLOWED_EMAILS = 'Test1@hylo.com, test2@terran.io'
      expect(isEligibleForAtprotoIdentity(user({ email: 'test1@hylo.com' }))).to.be.true
      expect(isEligibleForAtprotoIdentity(user({ email: 'TEST2@terran.io' }))).to.be.true
      expect(atprotoIneligibilityReason(user({ email: 'alice@hylo.com' }))).to.match(/allowlist/)
    })
  })
})
