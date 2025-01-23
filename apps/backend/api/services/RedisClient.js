const Redis = require('ioredis')

module.exports = {
  create: function () {
    const client = new Redis(process.env.REDIS_URL)

    client.on('error', (err) => {
      console.error('Redis Client Error:', err)
    })

    return client
  }
}
