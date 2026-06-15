import { ilikeContainsPattern, applyMessageThreadSearch } from '../../../api/graphql/messageThreadSearch'

describe('messageThreadSearch', () => {
  describe('ilikeContainsPattern', () => {
    it('wraps the term for substring matching', () => {
      expect(ilikeContainsPattern('jodie')).to.equal('%jodie%')
    })

    it('escapes ilike wildcards', () => {
      expect(ilikeContainsPattern('100%')).to.equal('%100\\%%')
    })
  })

  describe('applyMessageThreadSearch', () => {
    it('returns the query unchanged when search is empty', () => {
      const q = { where: spy() }
      expect(applyMessageThreadSearch(q, '1', '')).to.equal(q)
      expect(q.where).to.not.have.been.called()
    })
  })
})
