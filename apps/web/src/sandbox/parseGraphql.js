/**
 * Parse a GraphQL document string into kind, operation name, and first root field.
 */
export function parseGraphql (query = '') {
  const source = String(query)
  const opMatch = source.match(/\b(query|mutation)\s+(\w+)/i)
  const kind = (opMatch?.[1] || 'query').toLowerCase()
  const operationName = opMatch?.[2] || null
  const fieldMatch = source.match(/\{\s*(\w+)/)
  const rootField = fieldMatch?.[1] || null

  return { kind, operationName, rootField }
}
