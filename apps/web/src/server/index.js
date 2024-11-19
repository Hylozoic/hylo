import express from 'express'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import path from 'path'
import { fileURLToPath } from 'url'
import apiProxy from './apiProxy.js'
import appMiddleware from './appMiddleware.js'
import redirectToApp from './redirectToApp.js'
import { handleStaticPages } from './proxy.js'

const port = process.env.PORT || 9001

const startTime = new Date().getTime()

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function startServer () {
  console.log('Starting server...')
  const server = express()
  server.use(cookieParser())
  server.use(compression())
  server.use(apiProxy)
  server.use(redirectToApp)
  handleStaticPages(server)
  server.use(express.static(path.join(__dirname, '../../dist')))
  server.use(appMiddleware)

  const listener = server.listen(port, err => {
    if (err) throw err
    const elapsed = new Date().getTime() - startTime
    console.log(`listening on port ${port} after ${elapsed}ms (pid ${process.pid})`)
  })

  function shutdown () {
    const waitForClose = process.env.NODE_ENV === 'production'
      ? listener.close.bind(listener)
      : fn => fn()
    waitForClose(() => {
      console.log(`shutting down (pid ${process.pid})`)
      process.exit()
    })
  }
  process.once('SIGINT', shutdown)
  process.once('SIGUSR2', shutdown) // used by nodemon

  return listener
}

// Call the function to start the server
startServer()

// Export for testing/importing if needed
export { startServer }
