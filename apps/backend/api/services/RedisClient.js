import Redis from 'ioredis'

// Connection pool to reuse connections and prevent leaks
const connectionPool = new Map()
let poolCleanupRegistered = false

function registerCleanup () {
  if (poolCleanupRegistered || process.env.NODE_ENV === 'test') {
    return
  }

  poolCleanupRegistered = true

  const cleanup = () => {
    connectionPool.forEach((client, key) => {
      if (client && typeof client.quit === 'function') {
        client.quit().catch(err => {
          if (sails && sails.log) {
            sails.log.error(`Error closing Redis client ${key}:`, err)
          }
        })
      }
    })
    connectionPool.clear()
  }

  process.on('SIGTERM', cleanup)
  process.on('SIGINT', cleanup)
  process.on('exit', cleanup)
}

export default {
  create: function (key = 'default') {
    // Reuse existing connection if available
    if (connectionPool.has(key)) {
      const existingClient = connectionPool.get(key)
      // Check if connection is still alive
      if (existingClient && existingClient.status === 'ready') {
        return existingClient
      }
      // Remove dead connection
      connectionPool.delete(key)
    }

    // Create new connection
    const client = new Redis(process.env.REDIS_URL, {
      // Enable connection pooling options
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      reconnectOnError: (err) => {
        const targetError = 'READONLY'
        if (err.message.includes(targetError)) {
          return true
        }
        return false
      }
    })

    client.on('error', (err) => {
      console.error('Redis Client Error:', err)
    })

    client.on('close', () => {
      // Remove from pool when connection closes
      connectionPool.delete(key)
    })

    // Store in pool
    connectionPool.set(key, client)

    // Register cleanup handlers
    registerCleanup()

    return client
  },

  // Expose cleanup method for manual cleanup if needed
  cleanup: function () {
    registerCleanup()
    const cleanup = () => {
      connectionPool.forEach((client, key) => {
        if (client && typeof client.quit === 'function') {
          client.quit().catch(err => {
            if (sails && sails.log) {
              sails.log.error(`Error closing Redis client ${key}:`, err)
            }
          })
        }
      })
      connectionPool.clear()
    }
    cleanup()
  }
}
