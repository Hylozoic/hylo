import orm from 'store/models'
import testData from './MemberProfile.normalized.test.json'
import { getPresentedPerson } from './MemberProfile.store'

describe('store & connector', () => {
  let session, state, selectorProps, props

  beforeEach(() => {
    const {
      groups,
      person
    } = testData
    session = orm.mutableSession(orm.getEmptyState())
    session.CommonRole.create({ id: 1, title: 'Coordinator', responsibilities: { items: [{ id: 1, title: 'Administration' }, { id: 2, title: 'Manage Content' }] } })
    session.Person.create(person)
    session.Group.create(groups[0])
    session.MembershipCommonRole.create(testData.membershipCommonRoles[0])
    state = { orm: session.state }
    selectorProps = {
      personId: '46816',
      slug: 'wombats'
    }
    props = {
      match: {
        params: selectorProps
      }
    }
  })

  describe('getPresentedPerson', () => {
    it('returns null for a non-existent person', () => {
      selectorProps.personId = '1'
      const actual = getPresentedPerson(state, selectorProps)
      expect(actual).toBe(null)
    })

    it('returns the correct person', () => {
      const expected = '46816'
      const actual = getPresentedPerson(state, selectorProps).id
      expect(actual).toBe(expected)
    })
  })
})
