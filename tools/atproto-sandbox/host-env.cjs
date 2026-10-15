// Dev-only preload that lets a Node process on the host talk to the AiaB sandbox
// without editing /etc/hosts or the system trust store:
//   - resolves *.atmosbox.test to the loopback relay (`sandbox.sh access start`)
//   - trusts the sandbox's public CA alongside the normal roots
// Use via tools/atproto-sandbox/with-sandbox.sh; never load this in production.
const dns = require('dns')
const fs = require('fs')
const path = require('path')
const tls = require('tls')

const DOMAIN = process.env.AIAB_DOMAIN || 'atmosbox.test'
const RELAY = process.env.AIAB_RELAY_ADDRESS || '127.0.0.1'
const CA_FILE = process.env.AIAB_CA_FILE || path.join(__dirname, '.aiab/state/ca/root.crt')

const isSandboxHost = host => typeof host === 'string' &&
  (host === DOMAIN || host.endsWith(`.${DOMAIN}`))

const originalLookup = dns.lookup
dns.lookup = function (hostname, options, callback) {
  if (!isSandboxHost(hostname)) return originalLookup.apply(this, arguments)
  if (typeof options === 'function') { callback = options; options = {} }
  if (typeof options === 'number') options = { family: options }
  process.nextTick(() => options && options.all
    ? callback(null, [{ address: RELAY, family: 4 }])
    : callback(null, RELAY, 4))
}

tls.setDefaultCACertificates([
  ...tls.getCACertificates('default'),
  fs.readFileSync(CA_FILE, 'utf8')
])
