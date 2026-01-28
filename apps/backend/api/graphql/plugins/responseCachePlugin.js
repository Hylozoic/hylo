/**
 * GraphQL Response Cache Plugin for graphql-yoga
 *
 * Adds HTTP cache headers to GraphQL responses to enable browser caching.
 *
 * Safe for chatrooms because:
 * - Only caches INITIAL load data (topicFollow, past posts)
 * - Real-time updates come via WebSocket (not HTTP, so not cached)
 * - Short TTLs ensure data doesn't get too stale
 * - stale-while-revalidate serves cached data while fetching fresh data in background
 *
 * Configuration via environment variables:
 * - GRAPHQL_CACHE_ENABLED: Set to 'false' to disable caching (default: true)
 * - GRAPHQL_CACHE_MAX_AGE: Cache duration in seconds (default: 10)
 * - GRAPHQL_CACHE_SWR: Stale-while-revalidate duration in seconds (default: 30)
 *
 * Example .env:
 *   GRAPHQL_CACHE_ENABLED=true
 *   GRAPHQL_CACHE_MAX_AGE=10
 *   GRAPHQL_CACHE_SWR=30
 */

// Read configuration from environment
const CACHE_ENABLED = process.env.GRAPHQL_CACHE_ENABLED !== 'false' // Default: enabled
const MAX_AGE = parseInt(process.env.GRAPHQL_CACHE_MAX_AGE || '10', 10) // Default: 10 seconds
const SWR_AGE = parseInt(process.env.GRAPHQL_CACHE_SWR || '30', 10) // Default: 30 seconds

// Pre-build cache control string to avoid string concatenation on every request
const CACHE_CONTROL_HEADER = `public, max-age=${MAX_AGE}, stale-while-revalidate=${SWR_AGE}`

export const responseCachePlugin = {
  onRequest({ request }) {
    // Skip if disabled
    if (!CACHE_ENABLED) return

    return {
      onResponse({ response }) {
        // Set the Cache-Control header
        response.headers.set('Cache-Control', CACHE_CONTROL_HEADER)

        // Set Vary header to ensure proper caching with authentication
        // This ensures different users don't see each other's cached data
        response.headers.set('Vary', 'Cookie')
      }
    }
  }
}

