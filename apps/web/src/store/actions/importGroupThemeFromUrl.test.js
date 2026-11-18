import importGroupThemeFromUrl, { IMPORT_GROUP_THEME_FROM_URL } from './importGroupThemeFromUrl'

describe('importGroupThemeFromUrl', () => {
  it('sends the group and address to the importGroupThemeFromUrl mutation', () => {
    const action = importGroupThemeFromUrl('7', 'https://example.org/')
    expect(action.type).toEqual(IMPORT_GROUP_THEME_FROM_URL)
    expect(action.graphql.query).toContain('importGroupThemeFromUrl(groupId: $groupId, url: $url)')
    expect(action.graphql.variables).toEqual({ groupId: '7', url: 'https://example.org/' })
  })
})
