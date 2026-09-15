import { createYoga, maskError } from 'graphql-yoga'
import { graphql, GraphQLError } from 'graphql'
import { AsyncLocalStorage } from 'async_hooks'
import { red } from 'chalk'
import { inspect } from 'util'
import RedisPubSub from '../services/RedisPubSub'
import makeSchema from './makeSchema'
import { createGroupVisibilityLoader } from './filters'
import sentry from '../../lib/sentry'

export const GRAPHQL_ENDPOINT = '/noo/graphql'

// Per-execute store so maskError can attach user / operation without leaking across requests
const graphqlRequestStore = new AsyncLocalStorage()

/**
 * Yoga masks unexpected resolver errors as "Unexpected error." for clients.
 * Log the original error server-side and report it to Sentry (unmasked).
 */
function maskAndLogGraphqlError (error, message, isDev) {
  const result = maskError(error, message, isDev)
  if (result?.message === message) {
    const original = error?.originalError instanceof Error
      ? error.originalError
      : (error instanceof Error ? error : new Error(String(error)))
    sails.log.error('[graphql] unexpected error (masked for client):', original)

    const store = graphqlRequestStore.getStore() || {}
    const path = Array.isArray(error?.path) ? error.path.join('.') : error?.path

    sentry.captureException(original, {
      tags: {
        graphql: 'true',
        ...(store.operationName ? { graphqlOperation: String(store.operationName) } : {})
      },
      extra: {
        graphqlPath: path,
        currentUserId: store.currentUserId,
        operationName: store.operationName
      }
    })
  }
  return result
}

/**
 * Stashes GraphQL request identity for Sentry capture inside maskAndLogGraphqlError.
 */
const graphqlSentryContextPlugin = {
  onExecute ({ args, executeFn, setExecuteFn }) {
    setExecuteFn((executionArgs) => {
      const contextValue = executionArgs?.contextValue || args.contextValue
      return graphqlRequestStore.run({
        currentUserId: contextValue?.currentUserId,
        operationName: executionArgs?.operationName || args.operationName
      }, () => executeFn(executionArgs))
    })
  }
}

export const yoga = createYoga({
  graphqlEndpoint: GRAPHQL_ENDPOINT,
  schema: makeSchema,
  // plugins: [useLazyLoadedSchema(createSchema)],
  plugins: [graphqlSentryContextPlugin],
  context: async ({ req, params }) => {
    if (process.env.DEBUG_GRAPHQL) {
      sails.log.info('\n' +
        red('graphql query start') + '\n' +
        params?.query + '\n' +
        red('graphql query end')
      )
      sails.log.info(inspect(params?.variables))
    }

    // AUTH_DEBUG diagnostic: the final identity GraphQL will use for this request,
    // plus whether it was driven by a Bearer token (api_client set) or a cookie.
    if (process.env.AUTH_DEBUG) {
      const opName = params?.operationName
      sails.log.info(`[auth] graphql context op=${opName || '?'} currentUserId=${req.session.userId} viaToken=${!!req.api_client} hasCookieHeader=${!!req.headers.cookie}`)
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
      currentUserId: req.session.userId,
      groupVisibilityLoader: createGroupVisibilityLoader()
    }
  },
  maskedErrors: {
    maskError: maskAndLogGraphqlError
  },
  logging: process.env.GRAPHQL_YOGA_LOG_LEVEL || 'info',
  graphiql: true
})

// Test-only shim: GraphQL Yoga v3 removed handler.inject(). Unit tests (e.g. api/graphql/index.test.js)
// still call inject({ document, serverContext: { req, res } }) and assert on executionResult. This
// recreates that API by running graphql() with the same schema/context shape as production (yoga),
// without going through HTTP. response is always null; tests only use executionResult.
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
        groupVisibilityLoader: createGroupVisibilityLoader(),
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
      try {
        await GroupMembership.updateLastViewedAt(currentUserId, id)
      } catch (err) {
        sails.log.error('updateLastViewedAt failed:', err)
      }
    }
    return fetchOne ? fetchOne('group', { id }) : Group.find(id)
  }
})

export default yoga
