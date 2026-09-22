/**
 * Parse a GraphQL document string into kind, operation name, and first root field.
 */
export function parseGraphql (query = '') {
  const source = String(query)
  // Kind can stand alone (`mutation {…}` / `mutation ($x: T) {…}`) or with a name
  const kindMatch = source.match(/\b(query|mutation)\b/i)
  const kind = (kindMatch?.[1] || 'query').toLowerCase()
  const namedOpMatch = source.match(/\b(?:query|mutation)\s+(\w+)/i)
  const operationName = namedOpMatch?.[1] || null
  const fieldMatch = source.match(/\{\s*(\w+)/)
  const rootField = fieldMatch?.[1] || null

  return { kind, operationName, rootField }
}
