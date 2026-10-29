import { fetchGroupSettings, updateGroupSettings } from './GroupSettings.store'

const compact = query => query.replace(/\s+/g, ' ')

describe('fetchGroupSettings', () => {
  it('loads the invite policy and which roles include which responsibilities', () => {
    const query = compact(fetchGroupSettings('seed-library').graphql.query)

    expect(query).toContain('invitePolicy')
    expect(query).not.toContain('invitePolicy {')
    expect(query).toContain('groupRoles { items { active id emoji name description type responsibilities { items { id title } } } }')
  })
})

describe('updateGroupSettings', () => {
  it('sends an invite policy and reads the saved policy back', () => {
    const action = updateGroupSettings('1', { invitePolicy: 'everyone' })

    expect(action.graphql.variables.changes.invitePolicy).toEqual('everyone')
    const query = compact(action.graphql.query)
    expect(query).toContain('invitePolicy')
    expect(query).not.toContain('invitePolicy {')
  })
})
