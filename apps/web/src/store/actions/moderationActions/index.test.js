import { FETCH_MODERATION_ACTIONS } from 'store/constants'
import { buildKey } from 'store/reducers/queryResults'
import { createModerationAction, fetchModerationActions, getModerationActionQueryProps } from './index'

describe('getModerationActionQueryProps', () => {
  it('builds the same cache key params used when storing fetch results', () => {
    const variables = {
      slug: 'building-hylo',
      offset: 0,
      sortBy: 'created',
      first: 20
    }

    const lookupProps = getModerationActionQueryProps({
      slug: 'building-hylo',
      sortBy: 'created'
    })
    const storeParams = getModerationActionQueryProps(variables)
    const action = fetchModerationActions({
      slug: 'building-hylo',
      offset: 0,
      sortBy: 'created'
    })
    const processedAction = {
      ...action,
      meta: {
        ...action.meta,
        graphql: action.graphql
      }
    }

    expect(storeParams).toEqual(lookupProps)
    expect(buildKey(FETCH_MODERATION_ACTIONS, lookupProps)).toEqual(
      buildKey(FETCH_MODERATION_ACTIONS, storeParams)
    )
    expect(buildKey(FETCH_MODERATION_ACTIONS, lookupProps)).toEqual(
      buildKey(FETCH_MODERATION_ACTIONS, action.meta.extractQueryResults.getRouteParams(processedAction))
    )
    expect(JSON.parse(buildKey(FETCH_MODERATION_ACTIONS, lookupProps)).params).not.toHaveProperty('first')
  })
})

describe('createModerationAction', () => {
  it('stores a temp id and unique slugs for optimistic list updates', () => {
    const action = createModerationAction({
      text: 'flagged',
      postId: '1',
      groupId: '2',
      agreements: [],
      platformAgreements: [],
      anonymous: false
    }, { slugs: ['space-slug', 'parent-slug', 'space-slug'] })

    expect(action.meta.optimistic).toBe(true)
    expect(action.meta.tempId).toMatch(/^moderationAction_/)
    expect(action.meta.slugs).toEqual(['space-slug', 'parent-slug'])
    expect(action.graphql.variables.data).not.toHaveProperty('slugs')
  })
})
