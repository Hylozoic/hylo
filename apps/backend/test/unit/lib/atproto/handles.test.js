import { expect } from 'chai'
import {
  handleNameFromEmail,
  handleNameCandidate,
  buildHandle,
  handleNameProblem,
  handleNameFromHost
} from '../../../../lib/atproto/handles'

describe('atproto handles', () => {
  describe('handleNameFromEmail', () => {
    it('uses the normalized local part', () => {
      expect(handleNameFromEmail('Alice@hylo.com')).to.equal('alice')
      expect(handleNameFromEmail('alice.smith@terran.io')).to.equal('alice-smith')
      expect(handleNameFromEmail('alice_b..c@hylo.com')).to.equal('alice-b-c')
      expect(handleNameFromEmail('alice+test@hylo.com')).to.equal('alice')
      expect(handleNameFromEmail('_x_@hylo.com')).to.equal('x')
      expect(handleNameFromEmail('josé@hylo.com')).to.equal('jos')
    })

    it('caps names at 63 characters without a trailing hyphen', () => {
      const name = handleNameFromEmail(`${'a'.repeat(62)}.b@hylo.com`)
      expect(name).to.equal('a'.repeat(62))
    })

    it('returns null when nothing usable is left', () => {
      expect(handleNameFromEmail('+@hylo.com')).to.be.null
      expect(handleNameFromEmail('')).to.be.null
      expect(handleNameFromEmail()).to.be.null
    })
  })

  describe('handleNameCandidate', () => {
    it('adds numeric suffixes after the first candidate, staying within 63 characters', () => {
      expect(handleNameCandidate('alice', 1)).to.equal('alice')
      expect(handleNameCandidate('alice', 2)).to.equal('alice-2')
      const long = handleNameCandidate('a'.repeat(63), 12)
      expect(long).to.have.lengthOf(63)
      expect(long.endsWith('-12')).to.be.true
    })
  })

  describe('handleNameProblem', () => {
    it('accepts valid names in production and sandbox domains', () => {
      expect(handleNameProblem('alice', 'hylo.com')).to.be.null
      expect(handleNameProblem('alice-2', 'hylo.atmosbox.test')).to.be.null
    })

    it('rejects reserved, multi-label and malformed names', () => {
      expect(handleNameProblem('www', 'hylo.com')).to.equal('reserved')
      expect(handleNameProblem('pds', 'hylo.com')).to.equal('reserved')
      expect(handleNameProblem('a.b', 'hylo.com')).to.equal('must be a single label')
      expect(handleNameProblem('', 'hylo.com')).to.equal('empty')
      expect(handleNameProblem('-alice', 'hylo.com')).to.match(/hyphen/)
    })

    it('rejects disallowed top-level domains', () => {
      expect(handleNameProblem('alice', 'hylo.local')).to.equal('disallowed top-level domain')
    })
  })

  describe('handleNameFromHost', () => {
    it('extracts a single label directly under the handle domain', () => {
      expect(handleNameFromHost('alice.hylo.com', 'hylo.com')).to.equal('alice')
      expect(handleNameFromHost('Alice.Hylo.com:443', 'hylo.com')).to.equal('alice')
      expect(handleNameFromHost('alice.hylo.com.', 'hylo.com')).to.equal('alice')
    })

    it('ignores the bare domain, deeper names and other domains', () => {
      expect(handleNameFromHost('hylo.com', 'hylo.com')).to.be.null
      expect(handleNameFromHost('a.b.hylo.com', 'hylo.com')).to.be.null
      expect(handleNameFromHost('alice.evilhylo.com', 'hylo.com')).to.be.null
      expect(handleNameFromHost(undefined, 'hylo.com')).to.be.null
    })
  })

  it('buildHandle lowercases the full handle', () => {
    expect(buildHandle('Alice', 'Hylo.com')).to.equal('alice.hylo.com')
  })
})
