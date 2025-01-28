import RedisClient from './RedisClient'
import { createPubSub } from '@graphql-yoga/common'
import { createRedisEventTarget } from '@graphql-yoga/redis-event-target'

// https://the-guild.dev/graphql/yoga-server/v2/features/subscriptions#distributed-pubsub-for-production
const eventTarget = createRedisEventTarget({
  publishClient: RedisClient.create(),
  subscribeClient: RedisClient.create()
})

export default createPubSub({ eventTarget })
