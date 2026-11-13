import orm from 'store/models' // this initializes redux-orm
import ormReducer from 'store/reducers/ormReducer'
import updateGroupTheme, { UPDATE_GROUP_THEME } from './updateGroupTheme'

describe('updateGroupTheme', () => {
  const theme = { light: { 'card-foreground': '160 28% 11%' }, radius: 'xl' }

  it('sends the whole theme to the updateGroupTheme mutation', () => {
    const action = updateGroupTheme('7', theme)
    expect(action.type).toEqual(UPDATE_GROUP_THEME)
    expect(action.graphql.query).toContain('updateGroupTheme(groupId: $groupId, theme: $theme)')
    expect(action.graphql.variables).toEqual({ groupId: '7', theme })
  })

  it('sends null to clear the theme', () => {
    expect(updateGroupTheme('7', null).graphql.variables).toEqual({ groupId: '7', theme: null })
  })

  describe('in the ormReducer', () => {
    function stateWithGroup () {
      const session = orm.session(orm.getEmptyState())
      session.Group.create({ id: '7', settings: { layout: 'one-column', theme: { radius: 'sm' } } })
      return session.state
    }

    function groupSettings (state) {
      return orm.session(state).Group.withId('7').ref.settings
    }

    it("replaces only settings.theme with the server's theme, keeping other settings", () => {
      const action = {
        ...updateGroupTheme('7', theme),
        payload: { data: { updateGroupTheme: { id: '7', settings: { theme } } } }
      }
      expect(groupSettings(ormReducer(stateWithGroup(), action))).toEqual({ layout: 'one-column', theme })
    })

    it('clears the theme', () => {
      const action = {
        ...updateGroupTheme('7', null),
        payload: { data: { updateGroupTheme: { id: '7', settings: { theme: null } } } }
      }
      expect(groupSettings(ormReducer(stateWithGroup(), action))).toEqual({ layout: 'one-column', theme: null })
    })

    it('changes nothing when the save failed', () => {
      const action = { ...updateGroupTheme('7', theme), payload: new Error('Invalid theme'), error: true }
      expect(groupSettings(ormReducer(stateWithGroup(), action)).theme).toEqual({ radius: 'sm' })
    })
  })
})
