import { createYoga } from 'graphql-yoga'
import { red } from 'chalk'
import { inspect } from 'util'
import RedisPubSub from '../services/RedisPubSub'
import makeSchema from './makeSchema'

export const yoga = createYoga({
  graphqlEndpoint: '/noo/graphql',
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
  // 'info' is the default
  logging: 'info',
  graphiql: true
})

export default yoga
