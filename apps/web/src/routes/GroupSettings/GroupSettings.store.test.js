import { fetchGroupSettings, updateGroupSettings } from './GroupSettings.store'

const compact = query => query.replace(/\s+/g, ' ')

describe('fetchGroupSettings', () => {
  it('loads the invite policy, the Member role and which roles include which responsibilities', () => {
    const query = compact(fetchGroupSettings('seed-library').graphql.query)

    expect(query).toContain('invitePolicy { mode roleIds }')
    expect(query).toContain('memberRole { id responsibilities { items { id title description } } }')
    expect(query).toContain('groupRoles { items { active id emoji name description type responsibilities { items { id title } } } }')
  })
})

describe('updateGroupSettings', () => {
  it('sends an invite policy and reads back the saved policy and Member role', () => {
    const action = updateGroupSettings('1', { invitePolicy: { mode: 'roles', roleIds: ['2'] } })

    expect(action.graphql.variables.changes.invitePolicy).toEqual({ mode: 'roles', roleIds: ['2'] })
    const query = compact(action.graphql.query)
    expect(query).toContain('invitePolicy { mode roleIds }')
    expect(query).toContain('memberRole { id responsibilities { items { id title description } } }')
  })
})
