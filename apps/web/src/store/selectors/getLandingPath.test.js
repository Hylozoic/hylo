import orm from 'store/models'
import { getMyHomePath } from './getLandingPath'

function sessionWithGroups (groups) {
  const session = orm.session(orm.getEmptyState())
  const me = session.Me.create({ id: '1' })
  groups.forEach((attrs, index) => {
    const group = session.Group.create({ id: String(index + 1), slug: `group-${index + 1}`, name: `Group ${index + 1}`, ...attrs })
    session.Membership.create({ id: `m${index + 1}`, group: group.id, person: me.id })
  })
  return session
}

describe('getMyHomePath', () => {
  it('opens My Profile for someone in no groups', () => {
    const session = sessionWithGroups([])
    expect(getMyHomePath({ orm: session.state })).toBe('/all/members/1')
  })

  it('opens All My Groups for someone in a group', () => {
    const session = sessionWithGroups([{}])
    expect(getMyHomePath({ orm: session.state })).toBe('/all/all')
  })

  it('opens All My Groups for someone in several groups', () => {
    const session = sessionWithGroups([{}, {}, { type: 'space', parentId: '1' }])
    expect(getMyHomePath({ orm: session.state })).toBe('/all/all')
  })
})
