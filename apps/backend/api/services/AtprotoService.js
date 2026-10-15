/**
 * Experimental: provisions and manages Hylo-hosted AT Protocol identities (did:plc + handle).
 * See docs/ATPROTO_PDS_PLAN.md.
 *
 * Every write to the PLC directory is signed by the server rotation key. Rows are written as
 * `pending` before the genesis op is submitted, so a failed submission can be retried safely.
 */
import * as plc from '@did-plc/lib'
import { atprotoConfig, assertAtprotoConfigured, assertCanWriteToPlc } from '../../lib/atproto/config'
import { atprotoIneligibilityReason } from '../../lib/atproto/eligibility'
import { buildHandle, handleNameCandidate, handleNameFromEmail, handleNameProblem } from '../../lib/atproto/handles'
import { generateSigningKey, loadRotationKey } from '../../lib/atproto/keys'

const MAX_HANDLE_CANDIDATES = 50

const plcClient = config => new plc.Client(config.plcUrl)

// PLC errors from @did-plc/lib carry an HTTP status; tombstoned or unknown DIDs are 404/410
const isNotFound = err => err && (err.status === 404 || err.status === 410)

async function handleTaken (handle, userId) {
  const existing = await AtprotoIdentity.query(q => {
    q.where('handle', handle).whereNot('status', AtprotoIdentity.STATUS.Tombstoned)
    if (userId) q.whereNot('user_id', userId)
  }).fetch()
  return !!existing
}

async function existsAtPlc (did, config) {
  try {
    await plcClient(config).getDocumentData(did)
    return true
  } catch (err) {
    if (isNotFound(err)) return false
    throw err
  }
}

async function activeIdentityFor (user) {
  const identity = await AtprotoIdentity.forUser(user.id)
  if (!identity || !identity.isActive()) throw new Error(`User ${user.id} has no active AT Protocol identity`)
  return identity
}

module.exports = {
  /**
   * The handle `user` would get: `handleName` if given (it must be valid and free), otherwise
   * derived from their email, adding -2, -3… until a free, valid one is found.
   */
  availableHandle: async function (user, { handleName, config = atprotoConfig() } = {}) {
    if (handleName) {
      const name = handleName.toLowerCase()
      const problem = handleNameProblem(name, config.handleDomain)
      if (problem) throw new Error(`Handle name "${name}" is not allowed: ${problem}`)
      const handle = buildHandle(name, config.handleDomain)
      if (await handleTaken(handle, user.id)) throw new Error(`Handle ${handle} is already taken`)
      return handle
    }

    const base = handleNameFromEmail(user.get('email'))
    if (!base) throw new Error(`Can't derive a handle from the email of user ${user.id}`)
    for (let n = 1; n <= MAX_HANDLE_CANDIDATES; n++) {
      const name = handleNameCandidate(base, n)
      if (handleNameProblem(name, config.handleDomain)) continue
      const handle = buildHandle(name, config.handleDomain)
      if (!(await handleTaken(handle, user.id))) return handle
    }
    throw new Error(`No free handle found for user ${user.id}`)
  },

  /**
   * Summary of a user's AT Protocol state, for the CLI and later the API.
   */
  status: async function (user, config = atprotoConfig()) {
    const identity = await AtprotoIdentity.forUser(user.id)
    const ineligibleReason = atprotoIneligibilityReason(user, config)
    let proposedHandle = null
    if (!identity && !ineligibleReason && config.handleDomain) {
      proposedHandle = await this.availableHandle(user, { config }).catch(err => `(${err.message})`)
    }
    return { eligible: !ineligibleReason, ineligibleReason, identity, proposedHandle }
  },

  /**
   * Creates (or finishes creating) the user's did:plc identity. Idempotent: an active identity is
   * returned as is, and a pending one has its stored genesis op resubmitted.
   */
  provision: async function (user, { handleName } = {}) {
    const config = assertCanWriteToPlc()
    const reason = atprotoIneligibilityReason(user, config)
    if (reason) throw new Error(`User ${user.id} is not eligible for an AT Protocol identity: ${reason}`)

    const existing = await AtprotoIdentity.forUser(user.id)
    if (existing) {
      if (existing.isActive()) return existing
      if (existing.get('status') === AtprotoIdentity.STATUS.Pending) return this.submitGenesis(existing, config)
      throw new Error(`User ${user.id} has a tombstoned AT Protocol identity; re-provisioning is not supported yet`)
    }

    const handle = await this.availableHandle(user, { handleName, config })
    const rotationKey = await loadRotationKey(config.plcRotationKeyHex)
    const { publicKey, encrypted } = await generateSigningKey({ secret: config.keyEncryptionSecret, userId: user.id })
    const { op, did } = await plc.createOp({
      signingKey: publicKey,
      handle,
      pds: config.pdsUrl,
      rotationKeys: [rotationKey.did()],
      signer: rotationKey
    })

    const identity = await AtprotoIdentity.forge({
      user_id: user.id,
      did,
      handle,
      status: AtprotoIdentity.STATUS.Pending,
      signing_key_public: publicKey,
      signing_key_encrypted: encrypted,
      genesis_op: op
    }).save()

    return this.submitGenesis(identity, config)
  },

  submitGenesis: async function (identity, config = assertCanWriteToPlc()) {
    const did = identity.get('did')
    try {
      await plcClient(config).sendOperation(did, identity.get('genesis_op'))
    } catch (err) {
      // A did:plc is derived from its genesis op, so if the DID already exists, our op was accepted
      // (e.g. an earlier attempt timed out after the PLC stored it)
      if (!(await existsAtPlc(did, config))) throw err
    }
    return identity.save({ status: AtprotoIdentity.STATUS.Active }, { patch: true })
  },

  /**
   * Moves the user's identity to a new handle name under the handle domain.
   */
  updateHandle: async function (user, handleName) {
    const config = assertCanWriteToPlc()
    const identity = await activeIdentityFor(user)
    const handle = await this.availableHandle(user, { handleName, config })
    if (handle === identity.get('handle')) return identity

    const rotationKey = await loadRotationKey(config.plcRotationKeyHex)
    await plcClient(config).updateHandle(identity.get('did'), rotationKey, handle)
    return identity.save({ handle }, { patch: true })
  },

  /**
   * Permanently deactivates the user's DID at the PLC directory and releases their handle.
   */
  tombstone: async function (user) {
    const config = assertCanWriteToPlc()
    const identity = await AtprotoIdentity.forUser(user.id)
    if (!identity || identity.get('status') === AtprotoIdentity.STATUS.Tombstoned) return identity

    if (await existsAtPlc(identity.get('did'), config)) {
      const rotationKey = await loadRotationKey(config.plcRotationKeyHex)
      await plcClient(config).tombstone(identity.get('did'), rotationKey)
    }
    return identity.save({ status: AtprotoIdentity.STATUS.Tombstoned, tombstoned_at: new Date() }, { patch: true })
  },

  /**
   * Queue job target, called when a Hylo account is deleted.
   */
  tombstoneForDeletedUser: async function ({ userId }) {
    const user = await User.find(userId, {}, false)
    return user && this.tombstone(user)
  },

  /**
   * Queues tombstoning a deleted user's identity, if the feature is on and they have one.
   */
  queueTombstoneForDeletedUser: async function (userId) {
    if (!atprotoConfig().enabled) return
    const identity = await AtprotoIdentity.forUser(userId)
    if (!identity || identity.get('status') === AtprotoIdentity.STATUS.Tombstoned) return
    return Queue.classMethod('AtprotoService', 'tombstoneForDeletedUser', { userId })
  },

  /**
   * Compares the identity we have stored with what the PLC directory publishes.
   * Returns { problems: [...], document } — no problems means they agree.
   */
  verify: async function (identity, config = assertAtprotoConfigured()) {
    const did = identity.get('did')
    const tombstoned = identity.get('status') === AtprotoIdentity.STATUS.Tombstoned
    let document
    try {
      document = await plcClient(config).getDocumentData(did)
    } catch (err) {
      if (tombstoned && isNotFound(err)) return { problems: [], document: null }
      return { problems: [`PLC lookup failed: ${err.message}`], document: null }
    }

    const problems = []
    const rotationKey = await loadRotationKey(config.plcRotationKeyHex)
    if (tombstoned) problems.push('identity is tombstoned here but still live at the PLC')
    if (identity.get('status') === AtprotoIdentity.STATUS.Pending) problems.push('identity is still pending here')
    if (document.alsoKnownAs[0] !== `at://${identity.get('handle')}`) {
      problems.push(`handle mismatch: PLC has ${document.alsoKnownAs.join(', ') || '(none)'}`)
    }
    const pds = document.services.atproto_pds && document.services.atproto_pds.endpoint
    if (pds !== config.pdsUrl) problems.push(`PDS mismatch: PLC has ${pds}`)
    if (document.verificationMethods.atproto !== identity.get('signing_key_public')) {
      problems.push('signing key mismatch')
    }
    if (!document.rotationKeys.includes(rotationKey.did())) {
      problems.push('our rotation key is not a rotation key for this DID')
    }
    return { problems, document }
  }
}
