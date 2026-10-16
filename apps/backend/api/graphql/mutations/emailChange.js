import crypto from 'crypto'
import { GraphQLError } from 'graphql'
import { omit } from 'lodash'
import validator from 'validator'
import { decodeHyloJWT } from '../../../lib/HyloJWT'
import { RATE_LIMITED_ERROR, isRateLimited, recordAttempt } from '../../../lib/rateLimit'

// A requested email change is kept in users.settings until the new address is verified.
// Until then users.email (used for login, password reset and every notification) is unchanged.
export const PENDING_EMAIL_SETTING = 'pending_email'

// Same lifetime as signup verification codes (UserVerificationCode) and the default HyloJWT expiry
export const EMAIL_CHANGE_TTL = 4 * 60 * 60 * 1000

const TOKEN_PURPOSE = 'email-change'

const normalizeEmail = (email) => {
  const normalized = typeof email === 'string' ? email.trim().toLowerCase() : ''
  return validator.isEmail(normalized) ? normalized : null
}

const hashCode = code => crypto.createHash('sha256').update(String(code)).digest('hex')

const codeMatches = (code, codeHash) => {
  if (!code || typeof codeHash !== 'string') return false
  const a = Buffer.from(hashCode(code), 'hex')
  const b = Buffer.from(codeHash, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

const isExpired = pending => !pending?.requested_at || (Date.now() - new Date(pending.requested_at).getTime()) >= EMAIL_CHANGE_TTL

/**
 * Masks an address for the notice sent to the old address: "jane@example.com" -> "j***@example.com".
 * Enough for the account owner to recognise their own request, without handing the full new address
 * to whoever can read the old inbox.
 */
export const maskEmail = (email) => {
  const [local, domain] = email.split('@')
  return `${local.slice(0, 1)}***@${domain}`
}

/**
 * The pending email address for a user, or null if there is none or it has expired.
 */
export const getPendingEmail = (user) => {
  const pending = user.getSetting(PENDING_EMAIL_SETTING)
  return pending && !isExpired(pending) ? pending.email : null
}

const clearPendingEmail = (user, options = {}) =>
  user.save({ settings: omit(user.get('settings'), PENDING_EMAIL_SETTING) }, { patch: true, ...options })

/**
 * Checks a requested new email address. Throws the same errors updateMe has always thrown for
 * email changes (invalid-email, duplicate-email), plus RATE_LIMITED_ERROR.
 * Returns the normalized address, or null when it is the user's current email.
 */
export async function validateEmailChange (user, rawEmail, { ip } = {}) {
  const email = normalizeEmail(rawEmail)
  if (!email) throw new GraphQLError('invalid-email')

  const currentEmail = user.get('email')
  if (email === (currentEmail || '').toLowerCase()) return null

  // Each request sends an email to both the new and the old address, so both are limited
  if (await isRateLimited('sendEmailVerification', { ip, email }) ||
    await isRateLimited('sendEmailVerification', { email: currentEmail })) {
    throw new GraphQLError(RATE_LIMITED_ERROR)
  }

  if (!await User.isEmailUnique(email, currentEmail)) {
    // Counted too, so this can't be used to check addresses against other accounts without limit
    await recordAttempt('sendEmailVerification', { email: currentEmail })
    throw new GraphQLError('duplicate-email')
  }

  return email
}

/**
 * Stores the pending email (replacing any earlier request, so older codes and links stop working),
 * sends a verification code and link to the new address and a notice to the current one.
 * Expects an email already checked by validateEmailChange.
 */
export async function startEmailChange (user, email, { ip } = {}) {
  const currentEmail = user.get('email')
  await recordAttempt('sendEmailVerification', { ip, email })
  await recordAttempt('sendEmailVerification', { email: currentEmail })

  const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0')
  await user.save({
    settings: {
      ...user.get('settings'),
      [PENDING_EMAIL_SETTING]: { email, code_hash: hashCode(code), requested_at: new Date().toISOString() }
    }
  }, { patch: true })

  const token = user.generateJWT({ purpose: TOKEN_PURPOSE, email, code })
  const verifyUrl = Frontend.Route.verifyEmailChange(token)
  const locale = user.getLocale()

  if (process.env.NODE_ENV === 'development') {
    console.log(`!!! Email change verification for user ${user.id} to ${email} -- code: ${code} link: ${verifyUrl}`)
  }

  Queue.classMethod('Email', 'sendEmailVerification', {
    email,
    locale,
    version: 'with link',
    templateData: {
      code,
      verify_url: verifyUrl
    }
  })

  // Never include the code or link here: whoever reads the old inbox must not be able to complete the change
  Queue.classMethod('Email', 'sendEmailChangeRequested', {
    email: currentEmail,
    locale,
    templateData: {
      name: user.get('name'),
      masked_new_email: maskEmail(email),
      account_settings_url: Frontend.Route.evo.passwordSetting()
    }
  })

  return user
}

/**
 * Completes a pending email change using either the 6 digit code or the emailed link's token.
 * The token is bound to the user, the pending address and the code, so it stops working once a
 * newer request replaces the pending one. Both are single use and expire after EMAIL_CHANGE_TTL.
 */
export const verifyEmailChange = (fetchOne) => async (userId, { code: providedCode, token }, { ip } = {}) => {
  const errorKey = token ? 'invalid-link' : 'invalid-code'

  if (!userId) throw new GraphQLError('Not authorized')

  let code = providedCode
  let tokenEmail
  if (token) {
    let decoded
    try {
      decoded = decodeHyloJWT(token)
    } catch (err) {
      return { error: errorKey }
    }
    if (decoded?.purpose !== TOKEN_PURPOSE || String(decoded.sub) !== String(userId)) return { error: errorKey }
    code = decoded.code
    tokenEmail = decoded.email
  }

  const user = await User.find(userId)
  if (!user) throw new GraphQLError('Not authorized')

  const pending = user.getSetting(PENDING_EMAIL_SETTING)
  if (!pending?.email) return { error: errorKey }

  // Codes are only 6 digits, so guesses have to be limited
  const identifiers = { ip, email: pending.email }
  if (await isRateLimited('verifyCode', identifiers)) return { error: RATE_LIMITED_ERROR }

  if (isExpired(pending)) {
    await clearPendingEmail(user)
    return { error: errorKey }
  }

  if (!codeMatches(code, pending.code_hash) || (token && tokenEmail !== pending.email)) {
    await recordAttempt('verifyCode', identifiers)
    return { error: errorKey }
  }

  let error
  try {
    error = await bookshelf.transaction(async transacting => {
      // Lock the row and re-read it, so a request or verification running at the same time can't interleave
      const fresh = await User.query(q => q.where('id', user.id).forUpdate()).fetch({ transacting })
      const freshPending = fresh.getSetting(PENDING_EMAIL_SETTING)
      if (freshPending?.code_hash !== pending.code_hash || freshPending?.email !== pending.email) {
        return errorKey
      }

      // Someone else may have taken the address since the change was requested
      if (!await User.isEmailUnique(pending.email, fresh.get('email'), { transacting })) {
        await clearPendingEmail(fresh, { transacting })
        return 'duplicate-email'
      }

      await fresh.save({
        email: pending.email,
        email_validated: true,
        settings: omit(fresh.get('settings'), PENDING_EMAIL_SETTING),
        updated_at: new Date()
      }, { patch: true, transacting })
    })
  } catch (err) {
    // The unique_email constraint catches a race with another account taking the address
    if (err.message && err.message.includes('unique_email')) return { error: 'duplicate-email' }
    throw err
  }

  return error ? { error } : { me: fetchOne('Me', user.id) }
}

/**
 * Drops a pending email change. Its code and link stop working.
 */
export async function cancelEmailChange (userId) {
  const user = await User.find(userId)
  if (!user) throw new GraphQLError('Not authorized')
  if (user.getSetting(PENDING_EMAIL_SETTING)) await clearPendingEmail(user)
  return { success: true }
}
