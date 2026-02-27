import yoga, { GRAPHQL_ENDPOINT } from '../api/graphql'
import bodyParser from 'body-parser'
import kue from 'kue'
import kueUI from 'kue-ui'
import isAdmin from '../api/policies/isAdmin'
import accessTokenAuth from '../api/policies/accessTokenAuth'
import checkClientCredentials from '../api/policies/checkClientCredentials'
import cors from 'cors'
import { cors as corsConfig } from './cors'
import oidc from '../api/services/OpenIDConnect'

/**
 * Get allowed CORS origins from environment or use defaults
 */
function getAllowedOrigins() {
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://localhost:3000',
    'https://www.hylo.com',
    'https://hylo.com',
    'https://www.hylo.io',
    'https://hylo.io'
  ]
  
  // Add origins from environment variable if set
  if (process.env.CORS_ORIGINS) {
    const envOrigins = process.env.CORS_ORIGINS.split(',').map(o => o.trim())
    return [...defaultOrigins, ...envOrigins]
  }
  
  return defaultOrigins
}

export default function (app) {
  app.enable('trust proxy')

  // XXX: has to come before bodyParser?
  app.use('/noo/oauth', oidc.callback())

  app.use(bodyParser.urlencoded({ extended: true }))
  app.use(bodyParser.json())

  kueUI.setup({
    apiURL: '/noo/admin/kue/api',
    baseURL: '/noo/admin/kue'
  })

  app.use('/noo/admin/kue', isAdmin)
  app.use('/noo/admin/kue/api', kue.app)
  app.use('/noo/admin/kue', kueUI.app)

  // CORS configuration for GraphQL endpoint - use specific origins instead of '*'
  const allowedOrigins = getAllowedOrigins()
  
  app.use(GRAPHQL_ENDPOINT, cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true)
      
      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true)
      }
      
      // Check if origin matches any regex patterns
      const allowedPatterns = [
        /^https:\/\/.*\.hylo\.com$/,
        /^https:\/\/.*\.hylo\.io$/,
        /^https:\/\/.*\.vercel\.app$/
      ]
      
      if (allowedPatterns.some(pattern => pattern.test(origin))) {
        return callback(null, true)
      }
      
      // Log blocked origins in production for security monitoring
      if (process.env.NODE_ENV === 'production') {
        console.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`)
      }
      
      callback(new Error('Not allowed by CORS'))
    },
    methods: 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
    credentials: true
  }))

  app.use(GRAPHQL_ENDPOINT, accessTokenAuth) // TODO: remove once all our URLs use JWTs
  app.use(GRAPHQL_ENDPOINT, checkClientCredentials) // To auth API calls
  app.use(GRAPHQL_ENDPOINT, yoga)
}
