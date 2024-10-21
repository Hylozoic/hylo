import { pick } from 'lodash/fp'
import qs from 'query-string'

const getQuerystringParam = (key, location) => {
  if (!location) throw new Error(`getQuerystringParam('${key}') missing location`)
  const query = qs.parse(location.search)
  return Array.isArray(key) ? pick(key, query) : query[key]
}

export default getQuerystringParam
