import { omit } from 'lodash/fp'
import jwt from 'jsonwebtoken'
import { getPublicKeyFromPem } from './util'

export { TokenExpiredError } from 'jsonwebtoken'

export const generateHyloJWT = (sub, data = {}) => {
  const privateKey = Buffer.from(process.env.OIDC_KEYS.split(',')[0], 'base64')

  return jwt.sign(
    {
      iss: process.env.PROTOCOL + '://' + process.env.DOMAIN,
      aud: process.env.PROTOCOL + '://' + process.env.DOMAIN,
      sub,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 4), // 4 hour expiration by default
      ...omit(['iss', 'aud', 'sub'], data)
    },
    privateKey,
    {
      algorithm: 'RS256'
    }
  )
}

export const decodeHyloJWT = token => {
  const primary = `${process.env.PROTOCOL}://${process.env.DOMAIN}`
  const extras = (process.env.HYLO_JWT_EXTRA_ISSUERS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  /** Local dev / isolated E2E often mix DOMAIN :3000 (web .env) vs :3330 (Vite); minted JWTs must verify against either. */
  const devLocalIssuers =
    process.env.NODE_ENV === 'development'
      ? ['http://localhost:3000', 'http://localhost:3330']
      : []
  const issuerList = [...new Set([primary, ...extras, ...devLocalIssuers])]
  return jwt.verify(
    token,
    getPublicKeyFromPem(process.env.OIDC_KEYS.split(',')[0]),
    {
      // XXX: does checking audience make sense here? we would have to know the resource values used in generating the JWT for API calls
      // audience: process.env.PROTOCOL + '://' + process.env.DOMAIN,
      issuer: issuerList
    }
  )
}
