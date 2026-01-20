import RedisClient from './RedisClient'
import { createPubSub } from 'graphql-yoga'
import { createRedisEventTarget } from '@graphql-yoga/redis-event-target'

// Store references to Redis clients for cleanup
let publishClient = null
let subscribeClient = null
let pubSubInstance = null

// https://the-guild.dev/graphql/yoga-server/v2/features/subscriptions#distributed-pubsub-for-production
function createPubSubInstance () {
  if (pubSubInstance) {
    return pubSubInstance
  }

  // Use unique keys so connection pool doesn't reuse these clients
  publishClient = RedisClient.create('pubsub-publish')
  subscribeClient = RedisClient.create('pubsub-subscribe')

  const eventTarget = createRedisEventTarget({
    publishClient,
    subscribeClient
  })

  pubSubInstance = createPubSub({ eventTarget })

  // Set up cleanup on process exit
  // Note: These clients are also managed by RedisClient connection pool,
  // but we keep references here for explicit cleanup if needed
  const cleanup = () => {
    if (publishClient && typeof publishClient.quit === 'function') {
      publishClient.quit().catch(err => {
        if (sails && sails.log) {
          sails.log.error('Error closing Redis publish client:', err)
        }
      })
    }
    if (subscribeClient && typeof subscribeClient.quit === 'function') {
      subscribeClient.quit().catch(err => {
        if (sails && sails.log) {
          sails.log.error('Error closing Redis subscribe client:', err)
        }
      })
    }
    publishClient = null
    subscribeClient = null
    pubSubInstance = null
  }

  // Register cleanup handlers if not in test environment
  if (process.env.NODE_ENV !== 'test') {
    process.on('SIGTERM', cleanup)
    process.on('SIGINT', cleanup)
    process.on('exit', cleanup)
  }

  return pubSubInstance
}

export default createPubSubInstance()
