import { RedisPubSub } from 'graphql-redis-subscriptions'
import RedisClient from './RedisClient'

const redisPubSub = new RedisPubSub({
  publisher: RedisClient.create(),
  subscriber: RedisClient.create()
})

export default redisPubSub
