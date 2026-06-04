/**
 * Throwaway spike: validates that OIDCTokens.mintTokensForUser works against the local
 * oidc-provider (v7) by minting a token pair for an existing user and printing it.
 * Run with Node 20:
 *   node scripts/spike-mint-tokens.js [userEmail]
 * Then curl the running server to verify refresh/revoke/graphql (see chat notes).
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env'), override: false })
require('@babel/register')

const { merge } = require('lodash')
const sails = require('sails')
let rc
try { rc = require('rc') } catch (e) { rc = () => ({}) }

process.chdir(require('path').resolve(__dirname, '..'))

sails.lift(merge(rc('sails'), {
  log: { noShip: true, level: 'error' },
  hooks: { http: false, sockets: false, views: false }
}), async (err) => {
  if (err) {
    console.error('LIFT ERROR:', err)
    process.exit(1)
  }

  try {
    const { mintTokensForUser } = require('../api/services/OIDCTokens')

    const email = process.argv[2]
    const user = email
      ? await User.find(email)
      : await User.where({}).orderBy('id', 'asc').fetch()

    if (!user) throw new Error('No user found to mint tokens for')

    console.error(`Minting tokens for user ${user.id} <${user.get('email')}>`)
    const tokens = await mintTokensForUser(user)

    // stdout = just the JSON so it can be piped/parsed
    process.stdout.write(JSON.stringify(tokens) + '\n')
    process.exit(0)
  } catch (e) {
    console.error('SPIKE ERROR:', e && e.stack ? e.stack : e)
    process.exit(1)
  }
})
