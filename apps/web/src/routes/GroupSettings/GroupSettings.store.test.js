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

  it('keeps the preview switch and the introduction template when saving settings', () => {
    const action = updateGroupSettings('1', { settings: { introTemplate: 'Say hello', showPaywallPreview: false, agreementsLastUpdatedAt: 'now' } })

    expect(action.graphql.variables.changes.settings).toEqual({ introTemplate: 'Say hello', showPaywallPreview: false })
  })

  it('sends the post notifications new members start with (D1)', () => {
    const action = updateGroupSettings('1', { settings: { defaultPostNotifications: 'all' } })

    expect(action.graphql.variables.changes.settings).toEqual({ defaultPostNotifications: 'all' })
    expect(compact(action.graphql.query)).toContain('defaultPostNotifications')
    expect(compact(fetchGroupSettings('seed-library').graphql.query)).toContain('defaultPostNotifications')
  })
})
