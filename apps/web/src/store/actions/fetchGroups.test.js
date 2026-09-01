import { FETCH_GROUPS } from 'store/constants'
import { buildKey } from 'store/reducers/queryResults'
import { fetchGroups, getGroupQueryProps } from './fetchGroups'

describe('getGroupQueryProps', () => {
  it('builds the same cache key params used when storing fetch results', () => {
    const farmQuery = { farmType: '', certOrManagementPlan: '', productCategories: '' }
    const variables = {
      allowedInPublic: true,
      first: 20,
      farmQuery,
      groupType: null,
      nearCoord: null,
      offset: 0,
      order: undefined,
      search: '',
      sortBy: 'name',
      groupIds: undefined
    }

    const lookupProps = getGroupQueryProps({
      sortBy: 'name',
      search: '',
      nearCoord: null,
      groupType: null,
      farmQuery
    })
    const storeParams = getGroupQueryProps(variables)
    const action = fetchGroups({
      allowedInPublic: true,
      farmQuery,
      groupType: null,
      nearCoord: null,
      offset: 0,
      search: '',
      sortBy: 'name'
    })
    const processedAction = {
      ...action,
      meta: {
        ...action.meta,
        graphql: action.graphql
      }
    }

    expect(storeParams).toEqual(lookupProps)
    expect(buildKey(FETCH_GROUPS, lookupProps)).toEqual(buildKey(FETCH_GROUPS, storeParams))
    expect(buildKey(FETCH_GROUPS, lookupProps)).toEqual(
      buildKey(FETCH_GROUPS, action.meta.extractQueryResults.getRouteParams(processedAction))
    )
    expect(JSON.parse(buildKey(FETCH_GROUPS, lookupProps)).params).not.toHaveProperty('first')
  })
})
