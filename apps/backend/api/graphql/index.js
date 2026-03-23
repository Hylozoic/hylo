import { createYoga } from 'graphql-yoga'
import { graphql, GraphQLError } from 'graphql'
import { red } from 'chalk'
import { inspect } from 'util'
import RedisPubSub from '../services/RedisPubSub'
import makeSchema from './makeSchema'

export const GRAPHQL_ENDPOINT = '/noo/graphql'

export const yoga = createYoga({
  graphqlEndpoint: GRAPHQL_ENDPOINT,
  schema: makeSchema,
  // plugins: [useLazyLoadedSchema(createSchema)],
  context: async ({ req, params }) => {
    if (process.env.DEBUG_GRAPHQL) {
      sails.log.info('\n' +
        red('graphql query start') + '\n' +
        params?.query + '\n' +
        red('graphql query end')
      )
      sails.log.info(inspect(params?.variables))
    }

    // Update user last active time unless this is an oAuth login
    if (req.session.userId && !req.api_client) {
      await User.query().where({ id: req.session.userId }).update({ last_active_at: new Date() })
    }

    // This is unrelated to the above which is using context as a hook,
    // this is putting the subscriptions pubSub method on context
    return {
      pubSub: RedisPubSub,
      socket: req.socket,
      currentUserId: req.session.userId
    }
  },
  logging: process.env.GRAPHQL_YOGA_LOG_LEVEL || 'info',
  graphiql: true
})

// Backward-compatible test helpers used by legacy unit tests.
export const createRequestHandler = () => ({
  inject: async ({ document, serverContext }) => {
    const req = serverContext?.req || {}
    const schema = await makeSchema({ req })
    const executionResult = await graphql({
      schema,
      source: document,
      contextValue: {
        pubSub: RedisPubSub,
        socket: req.socket,
        currentUserId: req.session?.userId,
        // Mutations (e.g. verifyEmail, login) read/write session via context.req
        req
      }
    })
    return { response: null, executionResult }
  }
})

export const makeMutations = () => ({})

export const makeAuthenticatedQueries = (currentUserId, fetchOne, fetchMany) => ({
  groupExists: (_root, { slug }) => {
    if (Group.isSlugValid(slug)) {
      return Group.where({ slug }).fetch().then(group => ({ exists: !!group }))
    }
    throw new GraphQLError('Slug is invalid')
  },
  notifications: async (_root, { resetCount } = {}) => {
    if (resetCount) await User.resetNewNotificationCount(currentUserId)
    return fetchMany ? fetchMany('notifications', {}) : []
  },
  group: async (_root, { id, updateLastViewed } = {}) => {
    if (updateLastViewed) {
      await GroupMembership.updateLastViewedAt(currentUserId, id)
    }
    return fetchOne ? fetchOne('group', { id }) : Group.find(id)
  }
})

export default yoga
