import { pick } from 'lodash/fp'
import qs from 'query-string'

const getQuerystringParam = (key, props) => {
  if (!props.location) throw new Error(`getQuerystringParam('${key}') missing props.location`)
  const query = qs.parse(props.location.search)
  return Array.isArray(key) ? pick(key, query) : query[key]
}

export default getQuerystringParam
