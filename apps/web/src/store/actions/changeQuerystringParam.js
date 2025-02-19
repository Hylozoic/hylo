import qs from 'query-string'
import { push, replace } from 'redux-first-history'
import { addQuerystringToPath } from 'util/navigation'

// Could have a home in `util/navigation`, or make `util/navigation` a directory and put this in there?
export default function changeQuerystringParam (location, key, value, defaultValue, useReplace) {
  const querystringParams = qs.parse(location.search)
  const newQuerystringParams = {
    ...querystringParams,
    [key]: value === null ? defaultValue : value
  }
  const newUrl = addQuerystringToPath(location.pathname, newQuerystringParams)
  return useReplace ? replace(newUrl) : push(newUrl)
}

export function changeQuerystringParams (location, newParams, useReplace = false) {
  const querystringParams = qs.parse(location.search)
  const newQuerystringParams = {
    ...querystringParams,
    ...newParams
  }
  const newUrl = addQuerystringToPath(location.pathname, newQuerystringParams)
  return useReplace ? replace(newUrl) : push(newUrl)
}
