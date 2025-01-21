import { introspectionQuery } from 'graphql'
// NOTE: This can be used on Web as well
import fetch from 'cross-fetch'

// Function to fetch GraphQL schema from the server using introspection query
export async function fetchGraphqlSchema(endpoint) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: introspectionQuery
    })
  })

  const result = await response.json()
  return result.data
}
