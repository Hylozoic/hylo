#!/usr/bin/env node
/**
 * Hylo API Test Bot
 *
 * Tests all API endpoints and scopes to verify they work correctly.
 *
 * Usage:
 *   # With existing access token:
 *   ACCESS_TOKEN=your_token node api-test-bot.js
 *
 *   # With client credentials (server-to-server):
 *   CLIENT_ID=xxx CLIENT_SECRET=xxx node api-test-bot.js
 *
 *   # With environment file:
 *   node api-test-bot.js --env .env.test
 */

import https from 'https'
import http from 'http'

// Configuration
const config = {
  baseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
  accessToken: process.env.ACCESS_TOKEN || null,
  clientId: process.env.CLIENT_ID || null,
  clientSecret: process.env.CLIENT_SECRET || null,
  verbose: process.env.VERBOSE === 'true' || process.argv.includes('--verbose')
}

// Test results tracking
const results = {
  passed: [],
  failed: [],
  skipped: []
}

// Utility functions
function log(message, type = 'info') {
  const prefix = {
    info: '\x1b[36mℹ\x1b[0m',
    success: '\x1b[32m✓\x1b[0m',
    error: '\x1b[31m✗\x1b[0m',
    warn: '\x1b[33m⚠\x1b[0m',
    debug: '\x1b[90m·\x1b[0m'
  }
  if (type === 'debug' && !config.verbose) return
  console.log(`${prefix[type] || '·'} ${message}`)
}

function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(options.path, config.baseUrl)
    const isHttps = url.protocol === 'https:'
    const client = isHttps ? https : http

    const reqOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    }

    if (config.accessToken) {
      reqOptions.headers['Authorization'] = `Bearer ${config.accessToken}`
    }

    const req = client.request(reqOptions, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          resolve({ status: res.statusCode, data: json, headers: res.headers })
        } catch {
          resolve({ status: res.statusCode, data: data, headers: res.headers })
        }
      })
    })

    req.on('error', reject)

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body))
    }

    req.end()
  })
}

async function graphql(query, variables = {}) {
  return makeRequest({
    method: 'POST',
    path: '/noo/graphql'
  }, { query, variables })
}

// Test functions
async function testOIDCDiscovery() {
  log('Testing OIDC Discovery endpoint...', 'info')

  try {
    // The OIDC provider is mounted at /noo/oauth
    let res = await makeRequest({ path: '/noo/oauth/.well-known/openid-configuration' })

    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`)
    }

    const required = ['authorization_endpoint', 'token_endpoint', 'userinfo_endpoint', 'scopes_supported']
    const missing = required.filter(field => !res.data[field])

    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`)
    }

    log(`OIDC Discovery: Found ${res.data.scopes_supported.length} scopes`, 'success')
    log(`  Scopes: ${res.data.scopes_supported.join(', ')}`, 'debug')
    log(`  Auth endpoint: ${res.data.authorization_endpoint}`, 'debug')
    log(`  Token endpoint: ${res.data.token_endpoint}`, 'debug')

    results.passed.push('OIDC Discovery')
    return res.data
  } catch (error) {
    log(`OIDC Discovery failed: ${error.message}`, 'error')
    results.failed.push({ test: 'OIDC Discovery', error: error.message })
    return null
  }
}

async function testGraphQLEndpoint() {
  log('Testing GraphQL endpoint availability...', 'info')

  try {
    const res = await makeRequest({
      method: 'POST',
      path: '/noo/graphql'
    }, { query: '{ __typename }' })

    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`)
    }

    if (res.data.data && res.data.data.__typename === 'Query') {
      log('GraphQL endpoint: Available and responding', 'success')
      results.passed.push('GraphQL Endpoint')
      return true
    }

    throw new Error('Invalid response structure')
  } catch (error) {
    log(`GraphQL endpoint failed: ${error.message}`, 'error')
    results.failed.push({ test: 'GraphQL Endpoint', error: error.message })
    return false
  }
}

async function testMeQueryUnauthenticated() {
  log('Testing "me" query without authentication...', 'info')

  // Temporarily remove token
  const savedToken = config.accessToken
  config.accessToken = null

  try {
    const res = await graphql('{ me { id name } }')

    // Should return null for unauthenticated users (not an error)
    if (res.data.data && res.data.data.me === null) {
      log('me query (unauthenticated): Correctly returns null', 'success')
      results.passed.push('me Query (Unauthenticated)')
    } else if (res.data.errors) {
      log('me query (unauthenticated): Returns error (acceptable)', 'success')
      results.passed.push('me Query (Unauthenticated)')
    } else {
      throw new Error('Unexpected response for unauthenticated me query')
    }
  } catch (error) {
    log(`me query (unauthenticated) failed: ${error.message}`, 'error')
    results.failed.push({ test: 'me Query (Unauthenticated)', error: error.message })
  }

  // Restore token
  config.accessToken = savedToken
}

async function testMeQueryAuthenticated() {
  log('Testing "me" query with authentication...', 'info')

  if (!config.accessToken) {
    log('me query (authenticated): Skipped - no access token', 'warn')
    results.skipped.push('me Query (Authenticated)')
    return null
  }

  try {
    const res = await graphql(`{
      me {
        id
        name
        email
        avatarUrl
        memberships {
          items {
            group {
              id
              name
              slug
            }
            role
          }
        }
      }
    }`)

    if (res.data.errors) {
      throw new Error(res.data.errors[0].message)
    }

    if (!res.data.data.me) {
      throw new Error('me query returned null with valid token')
    }

    const user = res.data.data.me
    log(`me query (authenticated): User "${user.name}" (${user.id})`, 'success')
    log(`  Email: ${user.email || 'not provided'}`, 'debug')
    log(`  Memberships: ${user.memberships?.items?.length || 0} groups`, 'debug')

    results.passed.push('me Query (Authenticated)')
    return user
  } catch (error) {
    log(`me query (authenticated) failed: ${error.message}`, 'error')
    results.failed.push({ test: 'me Query (Authenticated)', error: error.message })
    return null
  }
}

async function testGroupsQuery() {
  log('Testing "groups" query...', 'info')

  try {
    const res = await graphql(`{
      groups(first: 5, visibility: 2) {
        items {
          id
          name
          slug
          description
          memberCount
        }
        total
      }
    }`)

    if (res.data.errors) {
      throw new Error(res.data.errors[0].message)
    }

    const groups = res.data.data.groups
    log(`groups query: Found ${groups.total} public groups`, 'success')

    if (groups.items && groups.items.length > 0) {
      log(`  First group: "${groups.items[0].name}" (${groups.items[0].slug})`, 'debug')
    }

    results.passed.push('Groups Query')
    return groups
  } catch (error) {
    log(`groups query failed: ${error.message}`, 'error')
    results.failed.push({ test: 'Groups Query', error: error.message })
    return null
  }
}

async function testGroupBySlugQuery(slug) {
  log(`Testing "group" query by slug (${slug})...`, 'info')

  try {
    const res = await graphql(`
      query GetGroup($slug: String!) {
        group(slug: $slug) {
          id
          name
          slug
          description
          memberCount
          posts(first: 3) {
            items {
              id
              title
              type
              createdAt
            }
            total
          }
        }
      }
    `, { slug })

    if (res.data.errors) {
      throw new Error(res.data.errors[0].message)
    }

    const group = res.data.data.group
    if (!group) {
      log(`group query: Group "${slug}" not found or not accessible`, 'warn')
      results.skipped.push(`Group Query (${slug})`)
      return null
    }

    log(`group query: "${group.name}" - ${group.memberCount} members, ${group.posts?.total || 0} posts`, 'success')

    results.passed.push(`Group Query (${slug})`)
    return group
  } catch (error) {
    log(`group query failed: ${error.message}`, 'error')
    results.failed.push({ test: `Group Query (${slug})`, error: error.message })
    return null
  }
}

async function testUserInfoEndpoint() {
  log('Testing OAuth userinfo endpoint...', 'info')

  if (!config.accessToken) {
    log('Userinfo endpoint: Skipped - no access token', 'warn')
    results.skipped.push('Userinfo Endpoint')
    return null
  }

  try {
    const res = await makeRequest({ path: '/noo/oauth/me' })

    if (res.status === 401) {
      throw new Error('Unauthorized - token may be invalid or expired')
    }

    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`)
    }

    log(`Userinfo endpoint: User sub=${res.data.sub}`, 'success')
    log(`  Name: ${res.data.name || 'N/A'}`, 'debug')
    log(`  Email: ${res.data.email || 'N/A'}`, 'debug')

    results.passed.push('Userinfo Endpoint')
    return res.data
  } catch (error) {
    log(`Userinfo endpoint failed: ${error.message}`, 'error')
    results.failed.push({ test: 'Userinfo Endpoint', error: error.message })
    return null
  }
}

async function testPostCreation(groupId) {
  log('Testing post creation mutation...', 'info')

  if (!config.accessToken) {
    log('Post creation: Skipped - no access token', 'warn')
    results.skipped.push('Post Creation')
    return null
  }

  if (!groupId) {
    log('Post creation: Skipped - no group ID provided', 'warn')
    results.skipped.push('Post Creation')
    return null
  }

  try {
    const testTitle = `API Test Post - ${new Date().toISOString()}`

    const res = await graphql(`
      mutation CreatePost($input: PostInput!) {
        createPost(input: $input) {
          id
          title
          details
          type
        }
      }
    `, {
      input: {
        title: testTitle,
        details: '<p>This is a test post created by the API test bot. It can be safely deleted.</p>',
        type: 'discussion',
        groupIds: [groupId]
      }
    })

    if (res.data.errors) {
      throw new Error(res.data.errors[0].message)
    }

    const post = res.data.data.createPost
    log(`Post creation: Created post "${post.title}" (${post.id})`, 'success')

    results.passed.push('Post Creation')
    return post
  } catch (error) {
    log(`Post creation failed: ${error.message}`, 'error')
    results.failed.push({ test: 'Post Creation', error: error.message })
    return null
  }
}

async function testCommonRolesQuery() {
  log('Testing "commonRoles" query...', 'info')

  try {
    const res = await graphql('{ commonRoles { id name responsibilities { items { id title description } } } }')

    if (res.data.errors) {
      throw new Error(res.data.errors[0].message)
    }

    const roles = res.data.data.commonRoles || []
    log(`commonRoles query: Found ${roles.length} common roles`, 'success')

    results.passed.push('Common Roles Query')
    return roles
  } catch (error) {
    log(`commonRoles query failed: ${error.message}`, 'error')
    results.failed.push({ test: 'Common Roles Query', error: error.message })
    return null
  }
}

async function testPlatformAgreementsQuery() {
  log('Testing "platformAgreements" query...', 'info')

  try {
    const res = await graphql('{ platformAgreements { id type text } }')

    if (res.data.errors) {
      throw new Error(res.data.errors[0].message)
    }

    const agreements = res.data.data.platformAgreements || []
    log(`platformAgreements query: Found ${agreements.length} agreements`, 'success')

    results.passed.push('Platform Agreements Query')
    return agreements
  } catch (error) {
    log(`platformAgreements query failed: ${error.message}`, 'error')
    results.failed.push({ test: 'Platform Agreements Query', error: error.message })
    return null
  }
}

async function testApplicationsQuery() {
  log('Testing "applications" query (for current user)...', 'info')

  if (!config.accessToken) {
    log('Applications query: Skipped - no access token', 'warn')
    results.skipped.push('Applications Query')
    return null
  }

  try {
    const res = await graphql(`{
      me {
        applications {
          id
          name
          description
          clientId
          scopes
          hasBot
          createdAt
        }
      }
    }`)

    if (res.data.errors) {
      throw new Error(res.data.errors[0].message)
    }

    const apps = res.data.data.me?.applications || []
    log(`applications query: Found ${apps.length} applications`, 'success')

    apps.forEach(app => {
      log(`  - ${app.name} (${app.clientId.substring(0, 8)}...)`, 'debug')
    })

    results.passed.push('Applications Query')
    return apps
  } catch (error) {
    log(`applications query failed: ${error.message}`, 'error')
    results.failed.push({ test: 'Applications Query', error: error.message })
    return null
  }
}

async function testNotificationsQuery() {
  log('Testing "notifications" query...', 'info')

  if (!config.accessToken) {
    log('Notifications query: Skipped - no access token', 'warn')
    results.skipped.push('Notifications Query')
    return null
  }

  try {
    const res = await graphql(`{
      notifications(first: 5) {
        items {
          id
          activity {
            id
            action
            createdAt
          }
        }
        total
      }
    }`)

    if (res.data.errors) {
      throw new Error(res.data.errors[0].message)
    }

    const notifications = res.data.data.notifications
    log(`notifications query: Found ${notifications.total} notifications`, 'success')

    results.passed.push('Notifications Query')
    return notifications
  } catch (error) {
    log(`notifications query failed: ${error.message}`, 'error')
    results.failed.push({ test: 'Notifications Query', error: error.message })
    return null
  }
}

async function testMessageThreadsQuery() {
  log('Testing message threads query...', 'info')

  if (!config.accessToken) {
    log('Message threads: Skipped - no access token', 'warn')
    results.skipped.push('Message Threads Query')
    return null
  }

  try {
    const res = await graphql(`{
      me {
        messageThreads(first: 3) {
          items {
            id
            participants {
              items {
                id
                name
              }
            }
            lastMessage {
              id
              text
              createdAt
            }
          }
          total
        }
      }
    }`)

    if (res.data.errors) {
      throw new Error(res.data.errors[0].message)
    }

    const threads = res.data.data.me?.messageThreads
    log(`messageThreads query: Found ${threads?.total || 0} threads`, 'success')

    results.passed.push('Message Threads Query')
    return threads
  } catch (error) {
    log(`messageThreads query failed: ${error.message}`, 'error')
    results.failed.push({ test: 'Message Threads Query', error: error.message })
    return null
  }
}

// Main test runner
async function runTests() {
  console.log('\n\x1b[1m╔════════════════════════════════════════╗\x1b[0m')
  console.log('\x1b[1m║        Hylo API Test Bot v1.0          ║\x1b[0m')
  console.log('\x1b[1m╚════════════════════════════════════════╝\x1b[0m\n')

  log(`Base URL: ${config.baseUrl}`, 'info')
  log(`Access Token: ${config.accessToken ? 'Provided' : 'Not provided'}`, 'info')
  console.log('')

  // Run tests
  console.log('\x1b[1m── OIDC/OAuth Endpoints ──\x1b[0m')
  await testOIDCDiscovery()
  await testUserInfoEndpoint()
  console.log('')

  console.log('\x1b[1m── GraphQL Basic ──\x1b[0m')
  await testGraphQLEndpoint()
  await testMeQueryUnauthenticated()
  await testMeQueryAuthenticated()
  console.log('')

  console.log('\x1b[1m── GraphQL Queries ──\x1b[0m')
  const groups = await testGroupsQuery()
  await testCommonRolesQuery()
  await testPlatformAgreementsQuery()
  await testApplicationsQuery()
  await testNotificationsQuery()
  await testMessageThreadsQuery()
  console.log('')

  // Test specific group if we have one
  if (groups?.items?.length > 0) {
    console.log('\x1b[1m── Group-Specific Tests ──\x1b[0m')
    const firstGroup = groups.items[0]
    await testGroupBySlugQuery(firstGroup.slug)
    console.log('')
  }

  // Test mutations if we have a group and token
  if (config.accessToken) {
    console.log('\x1b[1m── Mutation Tests ──\x1b[0m')
    const user = await graphql('{ me { memberships { items { group { id name } } } } }')
    const userGroup = user.data?.data?.me?.memberships?.items?.[0]?.group
    if (userGroup) {
      log(`Testing mutations in group: ${userGroup.name}`, 'info')
      // Uncomment to actually create test posts:
      // await testPostCreation(userGroup.id)
      log('Post creation: Skipped (uncomment in code to enable)', 'warn')
      results.skipped.push('Post Creation (disabled by default)')
    } else {
      log('Mutation tests: Skipped - user has no group memberships', 'warn')
      results.skipped.push('Mutation Tests')
    }
    console.log('')
  }

  // Print summary
  console.log('\x1b[1m╔════════════════════════════════════════╗\x1b[0m')
  console.log('\x1b[1m║              Test Summary              ║\x1b[0m')
  console.log('\x1b[1m╚════════════════════════════════════════╝\x1b[0m\n')

  console.log(`\x1b[32m✓ Passed:  ${results.passed.length}\x1b[0m`)
  console.log(`\x1b[31m✗ Failed:  ${results.failed.length}\x1b[0m`)
  console.log(`\x1b[33m⚠ Skipped: ${results.skipped.length}\x1b[0m`)
  console.log('')

  if (results.failed.length > 0) {
    console.log('\x1b[1mFailed Tests:\x1b[0m')
    results.failed.forEach(f => {
      console.log(`  \x1b[31m✗\x1b[0m ${f.test}: ${f.error}`)
    })
    console.log('')
  }

  if (results.skipped.length > 0) {
    console.log('\x1b[1mSkipped Tests:\x1b[0m')
    results.skipped.forEach(s => {
      console.log(`  \x1b[33m⚠\x1b[0m ${s}`)
    })
    console.log('')
  }

  // Exit with appropriate code
  process.exit(results.failed.length > 0 ? 1 : 0)
}

// Run if executed directly
runTests().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})

export { runTests, config, results }
