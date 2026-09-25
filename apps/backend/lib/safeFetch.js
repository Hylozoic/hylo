import dns from 'dns'
import http from 'http'
import https from 'https'
import net from 'net'
import fetch from 'node-fetch'

// Addresses a user-supplied URL must never reach: loopback, private networks, link-local
// (including the cloud metadata service at 169.254.169.254), carrier NAT, multicast and reserved ranges.
// IPv4-mapped IPv6 addresses (::ffff:10.0.0.1) are checked against the IPv4 rules by BlockList.
const blockedAddresses = new net.BlockList()
;[
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
].forEach(([address, prefix]) => blockedAddresses.addSubnet(address, prefix, 'ipv4'))
;[
  ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]
].forEach(([address, prefix]) => blockedAddresses.addSubnet(address, prefix, 'ipv6'))

const MAX_REDIRECTS = 5

/**
 * True for an IP address that must not be fetched from the server.
 */
export function isPrivateAddress (address) {
  const family = net.isIP(address)
  if (!family) return false
  return blockedAddresses.check(address, family === 6 ? 'ipv6' : 'ipv4')
}

/**
 * Throws unless the URL is http(s) and does not point at a private IP address.
 * Hostnames are checked when the connection is made (see safeLookup), since Node skips DNS for IP literals.
 */
export function assertPublicUrl (url) {
  let parsed
  try {
    parsed = new URL(url)
  } catch (e) {
    throw new Error(`Invalid URL: ${url}`)
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Only http and https URLs can be fetched: ${url}`)
  }
  if (isPrivateAddress(parsed.hostname.replace(/^\[|\]$/g, ''))) {
    throw new Error(`Refusing to fetch a private address: ${url}`)
  }
  return parsed
}

/**
 * dns.lookup replacement that fails when a hostname resolves to a private address.
 * Runs for every connection, so a DNS answer that changes after an earlier check is still caught.
 */
export function safeLookup (hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = {}
  }
  if (typeof options === 'number') options = { family: options }

  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err)
    const blocked = addresses.find(a => isPrivateAddress(a.address))
    if (blocked) {
      const error = new Error(`Refusing to connect to private address ${blocked.address} for ${hostname}`)
      error.code = 'EPRIVATEADDRESS'
      return callback(error)
    }
    if (options.all) return callback(null, addresses)
    callback(null, addresses[0].address, addresses[0].family)
  })
}

const httpAgent = new http.Agent({ lookup: safeLookup })
const httpsAgent = new https.Agent({ lookup: safeLookup })

/**
 * node-fetch for URLs that come from users (link previews, webhooks, remote uploads).
 * Refuses private addresses on the first request and on every redirect.
 */
export async function safeFetch (url, options = {}, redirectsLeft = MAX_REDIRECTS) {
  const parsed = assertPublicUrl(url)
  const response = await fetch(parsed.href, {
    ...options,
    redirect: 'manual',
    agent: parsed.protocol === 'http:' ? httpAgent : httpsAgent
  })

  const location = response.headers.get('location')
  if (response.status >= 300 && response.status < 400 && location) {
    if (redirectsLeft <= 0) throw new Error(`Too many redirects: ${url}`)
    const redirectOptions = [301, 302, 303].includes(response.status) && options.method && options.method.toUpperCase() !== 'GET'
      ? { ...options, method: 'GET', body: undefined }
      : options
    return safeFetch(new URL(location, parsed).href, redirectOptions, redirectsLeft - 1)
  }
  return response
}
