/* eslint spaced-comment:0 */

/**
 * Cross-Origin Resource Sharing (CORS) Settings
 * (sails.config.cors)
 *
 * CORS is like a more modern version of JSONP-- it allows your server/API
 * to successfully respond to requests from client-side JavaScript code
 * running on some other domain (e.g. google.com)
 * Unlike JSONP, it works with POST, PUT, and DELETE requests
 *
 * For more information on CORS, check out:
 * http://en.wikipedia.org/wiki/Cross-origin_resource_sharing
 *
 * Note that any of these settings (besides 'allRoutes') can be changed on a per-route basis
 * by adding a "cors" object to the route configuration:
 *
 * '/get foo': {
 *   controller: 'foo',
 *   action: 'bar',
 *   cors: {
 *     origin: 'http://foobar.com,https://owlhoot.com'
 *   }
 *  }
 *
 *  For more information on this configuration file, see:
 *  http://sailsjs.org/#/documentation/reference/sails.config/sails.config.cors.html
 *
 */

/**
 * Get allowed CORS origins from environment or use secure defaults
 */
function getAllowedOrigins() {
  // Default allowed origins - never use '*' in production
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
    // Filter out '*' if someone accidentally includes it
    const safeOrigins = envOrigins.filter(o => o !== '*')
    return [...defaultOrigins, ...safeOrigins]
  }
  
  return defaultOrigins
}

module.exports.security = {
  cors: {

    /***************************************************************************
    *                                                                          *
    * Allow CORS on all routes by default? If not, you must enable CORS on a   *
    * per-route basis by either adding a "cors" configuration object to the    *
    * route config, or setting "cors:true" in the route config to use the      *
    * default settings below.                                                  *
    *                                                                          *
    ***************************************************************************/

    allRoutes: true,

    /***************************************************************************
    *                                                                          *
    * Which domains which are allowed CORS access? This can be a               *
    * comma-delimited list of hosts (beginning with http:// or https://).      *
    * NEVER use "*" to allow all domains in production - this is a security    *
    * vulnerability that can lead to CSRF attacks.                             *
    *                                                                          *
    ***************************************************************************/

    allowOrigins: getAllowedOrigins(),

    /***************************************************************************
    *                                                                          *
    * Allow cookies to be shared for CORS requests?                            *
    *                                                                          *
    ***************************************************************************/

    allowCredentials: true,

    /***************************************************************************
    *                                                                          *
    * Which methods should be allowed for CORS requests? This is only used in  *
    * response to preflight requests (see article linked above for more info)  *
    *                                                                          *
    ***************************************************************************/

    allowRequestMethods: 'GET, POST, PUT, DELETE, OPTIONS, HEAD',

    /***************************************************************************
    *                                                                          *
    * Which headers should be allowed for CORS requests? This is only used in  *
    * response to preflight requests.                                          *
    *                                                                          *
    ***************************************************************************/

    allowRequestHeaders: 'content-type, authorization, x-requested-with'

  }
}
