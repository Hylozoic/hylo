import { generateHyloJWT } from '../../../lib/HyloJWT'
import {
  UNSUBSCRIBE_ACTION,
  confirmPageUrl,
  createUnsubscribeToken,
  oneClickUrl,
  readUnsubscribeToken
} from '../../../lib/email/unsubscribeToken'
require('../../setup')

describe('unsubscribeToken', () => {
  const claims = { userId: 17, sender: 'sendSimpleEmail', descriptor: 'group_digest', groupId: 5 }

  it('round-trips the recipient and what to switch off', () => {
    const token = createUnsubscribeToken(claims)
    expect(readUnsubscribeToken(token)).to.deep.equal({
      userId: '17',
      sender: 'sendSimpleEmail',
      descriptor: 'group_digest',
      groupId: '5',
      frequency: null,
      slowedDaily: false
    })
  })

  it('carries a digest frequency for the unified digest', () => {
    const token = createUnsubscribeToken({ userId: 17, descriptor: 'group_digest', frequency: 'weekly' })
    expect(readUnsubscribeToken(token).frequency).to.equal('weekly')
    expect(readUnsubscribeToken(token).groupId).to.equal(null)
    expect(readUnsubscribeToken(token).slowedDaily).to.equal(false)
  })

  it('says when a weekly unified digest also carried daily groups slowed for being away', () => {
    const weekly = createUnsubscribeToken({ userId: 17, descriptor: 'group_digest', frequency: 'weekly', slowedDaily: true })
    expect(readUnsubscribeToken(weekly).slowedDaily).to.equal(true)

    const daily = createUnsubscribeToken({ userId: 17, descriptor: 'group_digest', frequency: 'daily', slowedDaily: true })
    expect(readUnsubscribeToken(daily).slowedDaily).to.equal(false)
  })

  it('accepts a named membership setting', () => {
    const token = createUnsubscribeToken({ userId: 17, descriptor: 'membership_setting:stewardDigest', groupId: 5 })
    expect(readUnsubscribeToken(token).descriptor).to.equal('membership_setting:stewardDigest')
  })

  it('makes no token without a recipient or with an unknown descriptor', () => {
    expect(createUnsubscribeToken({ descriptor: 'group_digest' })).to.equal(null)
    expect(createUnsubscribeToken({ userId: 17, descriptor: 'everything' })).to.equal(null)
  })

  it('rejects a tampered token', () => {
    const token = createUnsubscribeToken(claims)
    const [header, payload, signature] = token.split('.')
    const otherPayload = Buffer.from(JSON.stringify({
      ...JSON.parse(Buffer.from(payload, 'base64url').toString()),
      sub: '18'
    })).toString('base64url')
    expect(readUnsubscribeToken([header, otherPayload, signature].join('.'))).to.equal(null)
    expect(readUnsubscribeToken(token.slice(0, -4) + 'AAAA')).to.equal(null)
    expect(readUnsubscribeToken('not-a-token')).to.equal(null)
    expect(readUnsubscribeToken(undefined)).to.equal(null)
  })

  it('rejects an expired token', () => {
    const expired = generateHyloJWT('17', {
      action: UNSUBSCRIBE_ACTION,
      ud: 'group_digest',
      gid: '5',
      exp: Math.floor(Date.now() / 1000) - 60
    })
    expect(readUnsubscribeToken(expired)).to.equal(null)
  })

  it('rejects a token made for something else, such as the settings page', () => {
    const settingsToken = generateHyloJWT('17', { action: 'notification_settings', ud: 'group_digest' })
    expect(readUnsubscribeToken(settingsToken)).to.equal(null)
  })

  it('expires after about two months', () => {
    const token = createUnsubscribeToken(claims)
    const { exp } = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    const days = (exp * 1000 - Date.now()) / (24 * 60 * 60 * 1000)
    expect(days).to.be.within(59, 61)
  })

  it('builds the one-click and confirmation addresses from the token alone', () => {
    const token = createUnsubscribeToken(claims)
    expect(oneClickUrl(token)).to.match(/\/noo\/email\/unsubscribe\?token=[^&]+$/)
    expect(confirmPageUrl(token)).to.match(/\/email\/unsubscribe\?token=[^&]+$/)
    expect(confirmPageUrl(token)).not.to.contain('/noo/')
  })
})
