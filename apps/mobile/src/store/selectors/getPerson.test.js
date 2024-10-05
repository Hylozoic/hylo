import orm from 'store/models'
import getPerson from './getPerson'

describe('getPerson', () => {
  it("returns null if person doesn't exist", () => {
    const session = orm.session(orm.getEmptyState())
    expect(getPerson({ orm: session.state }, { personId: '31' })).toEqual(null)
  })

  it('returns the person', () => {
    const personId = 31
    const session = orm.session(orm.getEmptyState())
    session.Person.create({ id: personId })
    const result = getPerson({ orm: session.state }, { personId: '31' })
    expect(result).toMatchSnapshot()
  })
})
