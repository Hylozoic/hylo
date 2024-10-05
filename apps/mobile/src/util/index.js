import { eq, omitBy } from 'lodash'

export function isPromise (value) {
  return value && typeof value.then === 'function'
}

export function safeStringify (obj, space) {
  let cache = []

  const stringified = JSON.stringify(obj, function (key, value) {
    if (typeof value === 'object' && value !== null) {
      if (cache.indexOf(value) !== -1) {
        return 'removed circular reference'
      }
      cache.push(value)
    }
    return value
  }, space)
  cache = null

  return stringified
}

// remove circular references
export function noncircular (obj) {
  if (typeof obj !== 'object') return obj
  return JSON.parse(safeStringify(obj))
}

/**
  * EXAMPLE:
 *
 * shouldComponentUpdate (nextProps) {
 *   return nextProps.isFocused && didPropsChange(this.props, nextProps)
 * }
 *
 * @param props
 * @param nextProps
 * @returns {*}
 */

export function didPropsChange (props, nextProps) {
  if (props === nextProps) {
    return false
  }

  if (typeof props !== 'object' || props === null ||
      typeof nextProps !== 'object' || nextProps === null) {
    return true
  }

  const keysA = Object.keys(props)
  const keysB = Object.keys(nextProps)

  if (keysA.length !== keysB.length) {
    return true
  }

  // Test for A's keys different from B.
  for (let i = 0; i < keysA.length; i++) {
    if (
      !hasOwnProperty.call(nextProps, keysA[i]) ||
      props[keysA[i]] !== nextProps[keysA[i]]
    ) {
      return true
    }
  }
}

/**
 * Useful for debugging which props have actually changed from within componentDidUpdate.  Once you're finished debugging
 * you should remove the use of this method in your code.
 *
 * EXAMPLE:
 *
 * componentDidUpdate(prevProps) {
 *   whatPropsChanged(this.props, prevProps, 'MyComponent')
 * }
 *
 * @param props
 * @param prevProps
 * @param componentName a String identifying your component
 */

export function whatPropsChanged (props, prevProps, componentName = '') {
  console.log(`***** WHAT PROPS CHANGED ${componentName} ******`, omitBy(props, (value, key) => eq(prevProps[key], value)))
}
