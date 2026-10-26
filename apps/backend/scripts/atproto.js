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
 *   yarn atproto backfill [--limit N] [--yes]   # provision every eligible user (dry run without --yes)
 *   yarn atproto purge-foreign [--yes]          # delete identities created by another instance
 *                                               # (e.g. after cloning prod's DB into staging)
 *
 * Against the local AiaB sandbox, run through tools/atproto-sandbox/with-sandbox.sh.
 */

require('@babel/register')
const crypto = require('crypto')
const { bold, green, red, yellow } = require('chalk')

const USAGE = 'Usage: yarn atproto <keygen | list | status | provision | rename | tombstone | verify | backfill | purge-foreign> [args]'

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
      // Includes other instances' rows so they're visible; they're marked and never acted on
      const identities = await AtprotoIdentity.query(q => q.orderBy('id')).fetchAll()
      if (identities.length === 0) return console.log('No identities')
      identities.forEach(i => console.log(
        `${String(i.get('user_id')).padEnd(8)} ${i.get('status').padEnd(11)} ${i.get('did')}  ${i.get('handle')}` +
        (i.belongsToInstance(config) ? '' : yellow(`  (other instance: ${i.get('plc_url')})`))
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
        identity = await AtprotoIdentity.where({ did: target }).fetch()
      } else if (target.includes('.') && !target.includes('@')) {
        identity = await AtprotoIdentity.query(q => q.where('handle', target.toLowerCase()).orderBy('id', 'desc')).fetch()
      } else {
        identity = await AtprotoIdentity.forUser((await findUser(target)).id)
      }
      if (!identity) throw new Error(`No identity found for "${target}"`)
      printIdentity(identity)
      return printVerification(identity)
    }

    case 'backfill': {
      const limit = flags.limit ? Number(flags.limit) : undefined
      if (!flags.yes) {
        const candidates = await AtprotoService.backfillCandidates({ limit })
        candidates.forEach(u => console.log(`  ${String(u.id).padEnd(8)} ${u.get('email')}`))
        return console.log(`${candidates.length} user(s) would be provisioned. Re-run with --yes to do it.`)
      }
      const results = await AtprotoService.backfill({
        limit,
        onResult: ({ user, identity, error }) => console.log(error
          ? red(`  ✘ ${user.id} ${user.get('email')}: ${error.message}`)
          : green(`  ✔ ${user.id} ${identity.get('handle')}  ${identity.get('did')}`))
      })
      console.log(`Provisioned ${results.provisioned}, failed ${results.failed}`)
      if (results.failed > 0) process.exitCode = 1
      return
    }

    case 'purge-foreign': {
      const { count, byInstance, deleted } = await AtprotoService.purgeForeign({ delete: !!flags.yes })
      byInstance.forEach(row => console.log(`  ${String(row.count).padEnd(6)} ${row.plc_url}  *.${row.handle_domain}`))
      if (count === 0) return console.log('No identities from other instances')
      return console.log(deleted
        ? green(`✔ Deleted ${deleted} identities from other instances (their DIDs are untouched)`)
        : `${count} identities from other instances. Re-run with --yes to delete them.`)
    }

    default:
      throw new Error(USAGE)
  }
}
