import orm from 'store/models'
import { getLandingPath, getMyHomePath, getTopLevelGroupCount } from './getLandingPath'

// Each entry is a group the person belongs to; later entries were viewed more recently
function sessionWithGroups (groups) {
  const session = orm.session(orm.getEmptyState())
  const me = session.Me.create({ id: '1' })
  groups.forEach((attrs, index) => {
    const group = session.Group.create({ id: String(index + 1), slug: `group-${index + 1}`, name: `Group ${index + 1}`, ...attrs })
    session.Membership.create({
      id: `m${index + 1}`,
      group: group.id,
      person: me.id,
      lastViewedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString()
    })
  })
  return session
}

describe('getLandingPath', () => {
  it('sends someone in no groups to the Group Explorer', () => {
    const session = sessionWithGroups([])
    expect(getLandingPath({ orm: session.state })).toBe('/public/groups')
  })

  it('reopens the last viewed group for someone in one group', () => {
    const session = sessionWithGroups([{}])
    expect(getLandingPath({ orm: session.state })).toBe('/groups/group-1')
  })

  it('reopens the last viewed group for someone in two groups', () => {
    const session = sessionWithGroups([{}, {}])
    expect(getLandingPath({ orm: session.state })).toBe('/groups/group-2')
  })

  it('lands someone in three groups on What\'s new (All My Groups)', () => {
    const session = sessionWithGroups([{}, {}, {}])
    expect(getLandingPath({ orm: session.state })).toBe('/all/all')
  })

  it('does not count spaces as groups', () => {
    const session = sessionWithGroups([{}, {}, { type: 'space', parentId: '1' }, { type: 'space', parentId: '2' }])
    expect(getTopLevelGroupCount({ orm: session.state })).toBe(2)
    expect(getLandingPath({ orm: session.state })).toBe('/groups/group-2/spaces/group-4/all')
  })
})

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
