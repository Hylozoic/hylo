import { AnalyticsEvents } from '@hylo/shared'
import { REMOVE_REACT_ON_COMMENT, REMOVE_REACT_ON_POST } from 'store/constants'
import removeReactOnEntity from './removeReactOnEntity'

describe('removeReactOnEntity', () => {
  it('tracks removing a post reaction as Reaction Removed', () => {
    const action = removeReactOnEntity({ emojiFull: '👍', entityType: 'post', postId: '1' })

    expect(action.type).toEqual(REMOVE_REACT_ON_POST)
    expect(AnalyticsEvents.REACTION_REMOVED).toEqual('Reaction Removed')
    expect(action.meta.analytics).toEqual({ eventName: 'Reaction Removed', type: 'post' })
  })

  it('tracks removing a comment reaction as Reaction Removed', () => {
    const action = removeReactOnEntity({ commentId: '2', emojiFull: '👍', entityType: 'comment', postId: '1' })

    expect(action.type).toEqual(REMOVE_REACT_ON_COMMENT)
    expect(action.graphql.variables.entityId).toEqual('2')
    expect(action.meta.analytics).toEqual({ eventName: 'Reaction Removed', type: 'comment' })
  })
})
