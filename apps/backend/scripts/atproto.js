#!/usr/bin/env node

/**
 * Manage experimental AT Protocol identities (see docs/ATPROTO_PDS_PLAN.md).
 *
 *   yarn atproto keygen                         # new rotation key + encryption secret for .env
 *   yarn atproto list
 *   yarn atproto status <user>                  # <user> = id or email
 *   yarn atproto provision <user> [--handle name]
 *   yarn atproto rename <user> <name>
 *   yarn atproto tombstone <user> --yes         # permanent
 *   yarn atproto verify <user | handle | did>   # compare our records with the PLC directory
 *
 * Against the local AiaB sandbox, run through tools/atproto-sandbox/with-sandbox.sh.
 */

require('@babel/register')
const crypto = require('crypto')
const { bold, green, red, yellow } = require('chalk')

const USAGE = 'Usage: yarn atproto <keygen | list | status | provision | rename | tombstone | verify> [args]'

async function keygen () {
  const { Secp256k1Keypair } = require('@atproto/crypto')
  const rotationKey = await Secp256k1Keypair.create({ exportable: true })
  console.log(`# Rotation key public DID: ${rotationKey.did()}`)
  console.log(`ATPROTO_PLC_ROTATION_KEY_HEX=${Buffer.from(await rotationKey.export()).toString('hex')}`)
  console.log(`ATPROTO_KEY_ENCRYPTION_SECRET=${crypto.randomBytes(32).toString('hex')}`)
}

const [command, ...args] = require('minimist')(process.argv.slice(2))._.map(String)
const flags = require('minimist')(process.argv.slice(2))

if (!command) {
  console.error(USAGE)
  process.exit(1)
}

if (command === 'keygen') {
  keygen().catch(err => { console.error(red(err.message)); process.exit(1) })
} else {
  const skiff = require('../lib/skiff')
  skiff.lift({
    silent: true,
    log: { level: 'warn' },
    start: () => run(command, args, flags)
      .catch(err => {
        console.error(red(err.message))
        process.exitCode = 1
      })
      .finally(() => skiff.lower())
  })
}

async function findUser (idOrEmail) {
  const user = await User.find(idOrEmail, {}, false)
  if (!user) throw new Error(`No user found for "${idOrEmail}"`)
  return user
}

function printIdentity (identity) {
  if (!identity) return console.log('  identity:  (none)')
  console.log(`  did:       ${bold(identity.get('did'))}`)
  console.log(`  handle:    ${bold(identity.get('handle'))}`)
  console.log(`  status:    ${identity.get('status')}`)
  console.log(`  signing:   ${identity.get('signing_key_public')}`)
  console.log(`  created:   ${identity.get('created_at')}`)
}

async function printVerification (identity) {
  const { problems, document } = await AtprotoService.verify(identity)
  if (document) console.log(JSON.stringify(document, null, 2))
  if (problems.length === 0) {
    console.log(green('✔ PLC directory matches our records'))
  } else {
    problems.forEach(p => console.log(red(`✘ ${p}`)))
    process.exitCode = 1
  }
}

async function run (command, args, flags) {
  const { atprotoConfig, isProductionPlc } = require('../lib/atproto/config')
  const config = atprotoConfig()
  console.log(`PLC: ${config.plcUrl || '(unset)'}  handles: *.${config.handleDomain || '(unset)'}  PDS: ${config.pdsUrl || '(unset)'}`)
  if (isProductionPlc(config.plcUrl)) console.log(yellow('⚠ Using the PRODUCTION PLC directory'))

  switch (command) {
    case 'list': {
      const identities = await AtprotoIdentity.query(q => q.orderBy('id')).fetchAll()
      if (identities.length === 0) return console.log('No identities')
      identities.forEach(i => console.log(
        `${String(i.get('user_id')).padEnd(8)} ${i.get('status').padEnd(11)} ${i.get('did')}  ${i.get('handle')}`
      ))
      return
    }

    case 'status': {
      const user = await findUser(args[0])
      const { eligible, ineligibleReason, identity, proposedHandle } = await AtprotoService.status(user)
      console.log(`User ${user.id} <${user.get('email')}>`)
      console.log(`  eligible:  ${eligible ? green('yes') : red(`no — ${ineligibleReason}`)}`)
      if (proposedHandle) console.log(`  would get: ${proposedHandle}`)
      return printIdentity(identity)
    }

    case 'provision': {
      const user = await findUser(args[0])
      const identity = await AtprotoService.provision(user, { handleName: flags.handle })
      console.log(green(`✔ Provisioned user ${user.id}`))
      printIdentity(identity)
      return printVerification(identity)
    }

    case 'rename': {
      if (!args[1]) throw new Error('Usage: yarn atproto rename <user> <name>')
      const user = await findUser(args[0])
      const identity = await AtprotoService.updateHandle(user, args[1])
      console.log(green(`✔ Handle is now ${identity.get('handle')}`))
      return printVerification(identity)
    }

    case 'tombstone': {
      const user = await findUser(args[0])
      if (!flags.yes) throw new Error('Tombstoning is permanent. Re-run with --yes to confirm.')
      const identity = await AtprotoService.tombstone(user)
      if (!identity) return console.log('User has no identity')
      console.log(green(`✔ Tombstoned ${identity.get('did')}`))
      return printVerification(identity)
    }

    case 'verify': {
      const target = args[0] || ''
      let identity
      if (target.startsWith('did:')) {
        identity = await AtprotoIdentity.findByDid(target)
      } else if (target.includes('.') && !target.includes('@')) {
        identity = await AtprotoIdentity.query(q => q.where('handle', target.toLowerCase()).orderBy('id', 'desc')).fetch()
      } else {
        identity = await AtprotoIdentity.forUser((await findUser(target)).id)
      }
      if (!identity) throw new Error(`No identity found for "${target}"`)
      printIdentity(identity)
      return printVerification(identity)
    }

    default:
      throw new Error(USAGE)
  }
}
