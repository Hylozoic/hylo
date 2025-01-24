import reducer,
{
  createGroup,
  fetchGroupExists,
  clearCreateGroupStore,
  CLEAR_CREATE_GROUP_STORE,
  FETCH_URL_EXISTS,
  initialState
}
  from './CreateGroupFlow.store'

const name = 'group name'
const slug = 'group_name'

describe('reducer', () => {
  describe('on CLEAR_CREATE_GROUP_STORE', () => {
    const action = {
      type: CLEAR_CREATE_GROUP_STORE
    }
    it('sets display', () => {
      const state = {
        groupData: {
          name,
          slug
        }
      }
      const newState = reducer(state, action)
      expect(newState).toEqual(initialState)
    })
  })
  describe('on FETCH_URL_EXISTS', () => {
    const exists = true
    const action = {
      type: FETCH_URL_EXISTS,
      payload: {
        data: {
          groupExists: {
            exists
          }
        }
      }
    }
    it('sets display', () => {
      const state = {
        urlExists: null
      }
      const newState = reducer(state, action)
      expect(newState.urlExists).toEqual(exists)
    })
  })
})

describe('createGroup', () => {
  it('matches snapshot', () => expect(createGroup({ name, slug })).toMatchSnapshot())
})

describe('fetchGroupExists', () => {
  it('matches snapshot', () => expect(fetchGroupExists(slug)).toMatchSnapshot())
})


describe('clearCreateGroupStore', () => {
  it('matches snapshot', () => expect(clearCreateGroupStore()).toMatchSnapshot())
})
