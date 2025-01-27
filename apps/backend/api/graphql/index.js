import { createYoga } from 'graphql-yoga'
import { red } from 'chalk'
import { inspect } from 'util'
import { usePrometheus } from '@graphql-yoga/plugin-prometheus'
import RedisPubSub from '../services/RedisPubSub'
import makeSchema from './makeSchema'

export const GRAPHQL_ENDPOINT = '/noo/graphql'

const prometheusConfig = {
  endpoint: `${GRAPHQL_ENDPOINT}/metrics`,
  // By default, these are the metrics that are enabled:
  graphql_envelop_request_time_summary: true,
  graphql_envelop_phase_parse: true,
  graphql_envelop_phase_validate: true,
  graphql_envelop_phase_context: true,
  graphql_envelop_phase_execute: true,
  graphql_envelop_phase_subscribe: true,
  graphql_envelop_error_result: true,
  graphql_envelop_deprecated_field: true,
  graphql_envelop_request_duration: true,
  graphql_envelop_schema_change: true,
  graphql_envelop_request: true,
  graphql_yoga_http_duration: true,
  // This metric is disabled by default.
  // Warning: enabling resolvers level metrics will introduce significant overhead
  graphql_envelop_execute_resolver: true
}

export const yoga = createYoga({
  graphqlEndpoint: GRAPHQL_ENDPOINT,
  plugins: [
    // See https://the-guild.dev/graphql/yoga-server/docs/features/monitoring
    process.env.NODE_ENV === 'development' && usePrometheus(prometheusConfig)
  ],
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
