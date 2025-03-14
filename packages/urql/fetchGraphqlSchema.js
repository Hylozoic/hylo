import { getIntrospectionQuery } from 'graphql'
// TODO: Switch to this from isomorphic-fetch on Web as well
import fetch from 'cross-fetch'

export default async function fetchGraphqlSchema (endpoint) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: getIntrospectionQuery()
    })
  })
  const result = await response.json()

  return result.data
}
