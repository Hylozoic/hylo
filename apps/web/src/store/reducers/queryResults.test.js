import { get } from 'lodash/fp'
import orm from 'store/models'
import queryResults, {
  buildKey,
  matchNewPostIntoQueryResults,
  makeGetQueryResults,
  makeQueryResultsModelSelector,
  matchNewThreadIntoQueryResults
} from './queryResults'
import { FETCH_MEMBERS } from 'routes/Members/Members.store'
import {
  CREATE_MODERATION_ACTION,
  CREATE_MODERATION_ACTION_PENDING,
  FETCH_MODERATION_ACTIONS,
  FETCH_POSTS,
  REMOVE_POST_PENDING,
  REORDER_VIEW_POST_PENDING
} from 'store/constants'
import { RECEIVE_POST } from 'components/SocketListener/SocketListener.store'
import { OPTIMISTIC_NOTICE_PREFIX } from 'store/util/chatActivityNotice'

const variables = { activePostsOnly: false, context: 'groups', slug: 'foo', sortBy: 'name' }

const key = JSON.stringify({
  type: FETCH_MEMBERS,
  params: variables
})

describe('using extractQueryResults', () => {
  it('adds data to empty state', () => {
    const state = {}
    const action = {
      type: FETCH_MEMBERS,
      payload: {
        data: {
          group: {
            members: {
              total: 22,
              items: [{ id: 7 }, { id: 8 }, { id: 9 }],
              hasMore: true
            }
          }
        }
      },
      meta: {
        graphql: { variables },
        extractQueryResults: {
          getItems: get('payload.data.group.members')
        }
      }
    }

    expect(queryResults(state, action)).toEqual({
      [key]: {
        ids: [7, 8, 9],
        total: 22,
        hasMore: true
      }
    })
  })

  it('appends to existing data, ignoring duplicates', () => {
    const state = {
      [key]: {
        ids: [4, 7, 5, 6],
        total: 21,
        hasMore: true
      }
    }

    const action = {
      type: FETCH_MEMBERS,
      payload: {
        data: {
          group: {
            members: {
              total: 22,
              items: [{ id: 7 }, { id: 8 }, { id: 9 }],
              hasMore: false
            }
          }
        }
      },
      meta: {
        graphql: {
          variables
        },
        extractQueryResults: {
          getItems: get('payload.data.group.members')
        }
      }
    }

    expect(queryResults(state, action)).toEqual({
      [key]: {
        ids: [4, 7, 5, 6, 8, 9],
        total: 22,
        hasMore: false
      }
    })
  })

  it('state is unchanged when extractQueryResults.getItems data not found', () => {
    const state = {
      emptyState: ''
    }
    const action = {
      type: FETCH_MEMBERS,
      payload: {
        data: {
          group: {
            members: {
              total: 22,
              items: [{ id: 7 }, { id: 8 }, { id: 9 }],
              hasMore: true
            }
          }
        }
      },
      meta: {
        graphql: { variables },
        extractQueryResults: {
          getItems: get('invalid-data-path')
        }
      }
    }

    expect(queryResults(state, action)).toEqual(state)
  })

  it('uses type returned by getType', () => {
    const initialState = {}

    const action = {
      type: FETCH_MEMBERS,
      payload: { data: { test: { items: [] } } },
      meta: {
        graphql: { variables },
        extractQueryResults: {
          getItems: get('payload.data.test'),
          getType: () => 'TEST_TYPE'
        }
      }
    }

    const expectedKey = JSON.stringify({
      type: action.meta.extractQueryResults.getType(),
      params: variables
    })

    expect(queryResults(initialState, action)).toEqual(
      expect.objectContaining({
        [expectedKey]: expect.any(Object)
      })
    )
  })

  it('uses params in key returned by getRouteParams', () => {
    const initialState = {}

    const action = {
      type: FETCH_MEMBERS,
      payload: { data: { test: { items: [] } } },
      meta: {
        graphql: { variables },
        customVariables: {
          id: 1
        },
        extractQueryResults: {
          getItems: get('payload.data.test'),
          getRouteParams: get('meta.customVariables')
        }
      }
    }

    const expectedKey = JSON.stringify({
      type: action.type,
      params: action.meta.extractQueryResults.getRouteParams(action)
    })

    expect(queryResults(initialState, action)).toEqual(
      expect.objectContaining({
        [expectedKey]: expect.any(Object)
      })
    )
  })
})

describe('queryResults reducer', () => {
  const key1 = '{"type":"FETCH_POSTS","params":{"context":"groups","slug":"foo"}}'
  const key2 = '{"type":"FETCH_POSTS","params":{"context":"groups","slug":"foo","filter":"request"}}'
  const key3 = '{"type":"FETCH_POSTS","params":{"context":"groups","slug":"bar"}}'

  const state = {
    [key1]: {
      hasMore: true,
      ids: ['18', '11']
    },
    [key2]: {
      hasMore: true,
      ids: ['18', '11']
    },
    [key3]: {
      hasMore: true,
      ids: ['18', '11']
    }
  }

  const action = {
    type: REMOVE_POST_PENDING,
    meta: {
      postId: '18',
      slug: 'foo'
    }
  }

  it('removes the id from results on REMOVE_POST_PENDING', () => {
    const newState = queryResults(state, action)
    expect(newState[key1].ids).toEqual(['11'])
    expect(newState[key2].ids).toEqual(['11'])
    expect(newState[key3].ids).toEqual(['18', '11'])
  })
})

describe('buildKey', () => {
  it('omits blank parameters', () => {
    expect(buildKey('actionType', { context: 'groups', slug: 'foo', search: null }))
      .toEqual('{"type":"actionType","params":{"context":"groups","slug":"foo"}}')
  })

  it('omits empty array parameters', () => {
    expect(buildKey('FETCH_POSTS', { context: 'groups', slug: 'foo', topics: [] }))
      .toEqual('{"type":"FETCH_POSTS","params":{"context":"groups","slug":"foo"}}')
  })
})

describe('matchNewPostIntoQueryResults', () => {
  it('prepends the post id to matching query result sets', () => {
    const state = {
      '{"type":"FETCH_POSTS","params":{"activePostsOnly":false,"childPostInclusion":"yes","context":"groups","slug":"bar"}}': {
        hasMore: true,
        ids: ['18', '11']
      },
      '{"type":"FETCH_POSTS","params":{"activePostsOnly":false,"childPostInclusion":"yes","context":"groups","filter":"request","slug":"bar"}}': {
        hasMore: true,
        ids: ['18', '11']
      }
    }
    const groups = [{ slug: 'foo' }, { slug: 'bar' }]
    const post = { id: '17', type: 'request', groups }

    expect(matchNewPostIntoQueryResults(state, post)).toEqual({
      '{"type":"FETCH_POSTS","params":{"activePostsOnly":false,"childPostInclusion":"yes","context":"groups","slug":"bar"}}': {
        hasMore: true,
        ids: ['17', '18', '11'],
        total: false
      },
      '{"type":"FETCH_POSTS","params":{"activePostsOnly":false,"childPostInclusion":"yes","context":"groups","filter":"request","slug":"bar"}}': {
        hasMore: true,
        ids: ['17', '18', '11'],
        total: false
      }
    })
  })

  it('prepends the post id to matching query result sets with a topic', () => {
    const state = {
      '{"type":"FETCH_POSTS","params":{"childPostInclusion":"no","context":"groups","filter":"chat","order":"asc","slug":"bar","sortBy":"id","topic":"123"}}': {
        hasMore: true,
        ids: ['18', '11']
      }
    }
    const groups = [{ slug: 'foo' }, { slug: 'bar' }]
    const post = { id: '17', type: 'request', groups, topics: [{ name: 'a', id: '123' }] }
    expect(matchNewPostIntoQueryResults(state, post)).toEqual({
      '{"type":"FETCH_POSTS","params":{"childPostInclusion":"no","context":"groups","filter":"chat","order":"asc","slug":"bar","sortBy":"id","topic":"123"}}': {
        hasMore: true,
        ids: ['17', '18', '11'],
        total: false
      }
    })
  })

  it('prepends a chat post onto group chat room results without a topic', () => {
    const chatKey = '{"type":"FETCH_POSTS","params":{"childPostInclusion":"no","context":"groups","filter":"chat","first":25,"order":"desc","slug":"bar","sortBy":"id"}}'
    const allActivityKey = '{"type":"FETCH_POSTS","params":{"childPostInclusion":"yes","context":"groups","filter":"all+notices","slug":"bar","sortBy":"created"}}'
    const state = {
      [chatKey]: {
        hasMore: false,
        ids: ['18', '11'],
        total: 2
      },
      [allActivityKey]: {
        hasMore: true,
        ids: ['18', '11'],
        total: 2
      }
    }
    const post = { id: '99', type: 'chat', groups: [{ slug: 'bar' }] }

    expect(matchNewPostIntoQueryResults(state, post)).toEqual({
      [chatKey]: {
        hasMore: false,
        ids: ['99', '18', '11'],
        total: 3
      },
      [allActivityKey]: {
        hasMore: true,
        ids: ['18', '11'],
        total: 2
      }
    })
  })

  it('moves a chat_activity notice to the front of All Activity', () => {
    const state = {
      '{"type":"FETCH_POSTS","params":{"childPostInclusion":"yes","context":"groups","filter":"all+notices","slug":"bar","sortBy":"created"}}': {
        hasMore: true,
        ids: ['18', 'notice-1', '11'],
        total: 3
      }
    }
    const post = {
      id: 'notice-1',
      type: 'chat_activity',
      groups: [{ slug: 'bar' }]
    }
    expect(matchNewPostIntoQueryResults(state, post)).toEqual({
      '{"type":"FETCH_POSTS","params":{"childPostInclusion":"yes","context":"groups","filter":"all+notices","slug":"bar","sortBy":"created"}}': {
        hasMore: true,
        ids: ['notice-1', '18', '11'],
        total: 3
      }
    })
  })

  it('prepends a new chat_activity notice onto All Activity', () => {
    const state = {
      '{"type":"FETCH_POSTS","params":{"childPostInclusion":"yes","context":"groups","filter":"all+notices","slug":"bar","sortBy":"created"}}': {
        hasMore: true,
        ids: ['18', '11'],
        total: 2
      }
    }
    const post = {
      id: 'notice-2',
      type: 'chat_activity',
      groups: [{ slug: 'bar' }]
    }
    expect(matchNewPostIntoQueryResults(state, post)).toEqual({
      '{"type":"FETCH_POSTS","params":{"childPostInclusion":"yes","context":"groups","filter":"all+notices","slug":"bar","sortBy":"created"}}': {
        hasMore: true,
        ids: ['notice-2', '18', '11'],
        total: 3
      }
    })
  })

  it('prepends a post onto All Activity when show chat activity is off', () => {
    const allActivityKey = '{"type":"FETCH_POSTS","params":{"childPostInclusion":"yes","context":"groups","first":20,"groupId":"5","slug":"bar","sortBy":"created"}}'
    const resourcesKey = '{"type":"FETCH_POSTS","params":{"childPostInclusion":"yes","context":"groups","first":20,"groupId":"5","slug":"bar","sortBy":"created","types":["resource"]}}'
    const topicKey = '{"type":"FETCH_POSTS","params":{"childPostInclusion":"yes","context":"groups","first":20,"groupId":"5","slug":"bar","sortBy":"created","topics":["123"]}}'
    const state = {
      [allActivityKey]: {
        hasMore: true,
        ids: ['18', '11'],
        total: 2
      },
      [resourcesKey]: {
        hasMore: true,
        ids: ['18'],
        total: 1
      },
      [topicKey]: {
        hasMore: true,
        ids: ['18'],
        total: 1
      }
    }
    const post = { id: '99', type: 'discussion', groups: [{ slug: 'bar' }] }

    expect(matchNewPostIntoQueryResults(state, post)).toEqual({
      [allActivityKey]: {
        hasMore: true,
        ids: ['99', '18', '11'],
        total: 3
      },
      [resourcesKey]: {
        hasMore: true,
        ids: ['18'],
        total: 1
      },
      [topicKey]: {
        hasMore: true,
        ids: ['18'],
        total: 1
      }
    })
  })

  it('does not prepend a chat_activity notice onto All Activity when show chat activity is off', () => {
    const allActivityKey = '{"type":"FETCH_POSTS","params":{"childPostInclusion":"yes","context":"groups","first":20,"slug":"bar","sortBy":"created"}}'
    const state = {
      [allActivityKey]: {
        hasMore: true,
        ids: ['18', '11'],
        total: 2
      }
    }
    const post = { id: 'notice-4', type: 'chat_activity', groups: [{ slug: 'bar' }] }

    expect(matchNewPostIntoQueryResults(state, post)).toEqual({
      [allActivityKey]: {
        hasMore: true,
        ids: ['18', '11'],
        total: 2
      }
    })
  })

  it('matches a space notice into the parent group All Activity', () => {
    const state = {
      '{"type":"FETCH_POSTS","params":{"childPostInclusion":"yes","context":"groups","filter":"all+notices","groupId":"1","slug":"parent","sortBy":"created"}}': {
        hasMore: true,
        ids: ['18', '11'],
        total: 2
      }
    }
    const post = {
      id: 'notice-3',
      type: 'chat_activity',
      groups: [{ slug: 'space', parentId: '1' }]
    }
    expect(matchNewPostIntoQueryResults(state, post)).toEqual({
      '{"type":"FETCH_POSTS","params":{"childPostInclusion":"yes","context":"groups","filter":"all+notices","groupId":"1","slug":"parent","sortBy":"created"}}': {
        hasMore: true,
        ids: ['notice-3', '18', '11'],
        total: 3
      }
    })
  })
})

describe('matchNewThreadIntoQueryResults', () => {
  it('prepends the thread id to matching query result sets', () => {
    const key = buildKey('FETCH_THREADS', { muted: false })
    const state = {
      [key]: {
        hasMore: true,
        ids: ['20', '21']
      }
    }

    const thread = { id: '27' }

    expect(matchNewThreadIntoQueryResults(state, thread)).toEqual({
      [key]: {
        hasMore: true,
        ids: ['27', '20', '21'],
        total: false
      }
    })
  })
})

describe('RECEIVE_POST chat_activity', () => {
  it('replaces an optimistic notice id and moves the real card to the front', () => {
    const allActivityKey = '{"type":"FETCH_POSTS","params":{"childPostInclusion":"yes","context":"groups","filter":"all+notices","slug":"bar","sortBy":"created"}}'
    const optimisticId = `${OPTIMISTIC_NOTICE_PREFIX}10:2026-08-14T04`
    const state = {
      [allActivityKey]: {
        hasMore: true,
        ids: [optimisticId, '18', '11'],
        total: 3
      }
    }
    const action = {
      type: RECEIVE_POST,
      payload: {
        data: {
          post: {
            id: '500',
            type: 'chat_activity',
            noticeData: { bucketKey: '10:2026-08-14T04' },
            groups: [{ slug: 'bar' }]
          }
        }
      }
    }

    expect(queryResults(state, action)[allActivityKey]).toEqual({
      hasMore: true,
      ids: ['500', '18', '11'],
      total: 3
    })
  })
})

describe('makeQueryResultsModelSelector', () => {
  const session = orm.session(orm.getEmptyState())

  const specs = [
    {
      modelName: 'Person',
      values: {
        id: 1,
        name: 'The Creator'
      }
    },
    {
      modelName: 'Post',
      values: {
        id: 2,
        title: 'First past the',
        creator: 1
      }
    },
    {
      modelName: 'Post',
      values: {
        id: 3,
        title: 'third post',
        creator: 1
      }
    },
    {
      modelName: 'Post',
      values: {
        id: 4,
        title: 'Fourth',
        creator: 1
      }
    },
    {
      modelName: 'Post',
      values: {
        id: 5,
        title: 'Fifth',
        creator: 1
      }
    }
  ]

  specs.forEach(spec => session[spec.modelName].create(spec.values))

  const ACTION_NAME = 'ACTION_NAME'

  const state = {
    orm: session.state,
    queryResults: {
      [buildKey(ACTION_NAME)]: {
        ids: [5, 2, 3]
      }
    }
  }

  const resultsSelector = makeGetQueryResults(ACTION_NAME)

  it('returns the models in the right order', () => {
    const modelSelector = makeQueryResultsModelSelector(
      resultsSelector,
      'Post',
      post => ({
        ...post.ref,
        creator: post.creator
      }))

    const models = modelSelector(state)
    expect(models.length).toEqual(3)
    expect(models.map(m => m.id)).toEqual([5, 2, 3])
    expect(models[0].creator.name).toEqual('The Creator')
  })
})

describe('CREATE_MODERATION_ACTION optimistic query results', () => {
  const slug = 'building-hylo'
  const parentSlug = 'parent-group'
  const groupKey = buildKey(FETCH_MODERATION_ACTIONS, { slug, sortBy: 'created' })
  const parentKey = buildKey(FETCH_MODERATION_ACTIONS, { slug: parentSlug, sortBy: 'created' })
  const otherKey = buildKey(FETCH_MODERATION_ACTIONS, { slug: 'other-group', sortBy: 'created' })

  const initialState = {
    [groupKey]: { ids: ['10'], total: 1, hasMore: false },
    [parentKey]: { ids: ['10'], total: 1, hasMore: false },
    [otherKey]: { ids: ['10'], total: 1, hasMore: false }
  }

  it('prepends the temp id to matching group and parent lists', () => {
    const nextState = queryResults(initialState, {
      type: CREATE_MODERATION_ACTION_PENDING,
      meta: { tempId: 'temp-1', slugs: [slug, parentSlug] }
    })

    expect(nextState[groupKey].ids).toEqual(['temp-1', '10'])
    expect(nextState[parentKey].ids).toEqual(['temp-1', '10'])
    expect(nextState[otherKey].ids).toEqual(['10'])
  })

  it('replaces the temp id with the server id', () => {
    const pendingState = queryResults(initialState, {
      type: CREATE_MODERATION_ACTION_PENDING,
      meta: { tempId: 'temp-1', slugs: [slug, parentSlug] }
    })
    const nextState = queryResults(pendingState, {
      type: CREATE_MODERATION_ACTION,
      payload: { data: { createModerationAction: { id: '99' } } },
      meta: { tempId: 'temp-1', slugs: [slug, parentSlug] }
    })

    expect(nextState[groupKey].ids).toEqual(['99', '10'])
    expect(nextState[parentKey].ids).toEqual(['99', '10'])
    expect(nextState[otherKey].ids).toEqual(['10'])
  })

  it('prepends the server id when the list was fetched without a pending temp id', () => {
    const nextState = queryResults(initialState, {
      type: CREATE_MODERATION_ACTION,
      payload: { data: { createModerationAction: { id: '99' } } },
      meta: { tempId: 'temp-1', slugs: [slug] }
    })

    expect(nextState[groupKey].ids).toEqual(['99', '10'])
    expect(nextState[parentKey].ids).toEqual(['10'])
  })
})

describe('REORDER_VIEW_POST_PENDING', () => {
  const viewId = 'view-1'
  const orderKey = buildKey(FETCH_POSTS, { forCollection: viewId, sortBy: 'order' })
  const createdKey = buildKey(FETCH_POSTS, { forCollection: viewId, sortBy: 'created' })
  const otherKey = buildKey(FETCH_POSTS, { slug: 'other' })

  const initialState = {
    [orderKey]: { ids: ['a', 'b', 'c'], total: 3, hasMore: false },
    [createdKey]: { ids: ['c', 'b', 'a'], total: 3, hasMore: false },
    [otherKey]: { ids: ['a', 'b'], total: 2, hasMore: false }
  }

  it('moves the post in manual-order collection results only', () => {
    const nextState = queryResults(initialState, {
      type: REORDER_VIEW_POST_PENDING,
      meta: { viewId, postId: 'a', order: 2 }
    })

    expect(nextState[orderKey].ids).toEqual(['b', 'c', 'a'])
    expect(nextState[createdKey].ids).toEqual(['c', 'b', 'a'])
    expect(nextState[otherKey].ids).toEqual(['a', 'b'])
  })
})
