import { useRef } from 'react'
import isEqual from 'lodash/fp/isEqual'

export default function useDeepCompareMemoize (value) {
  const ref = useRef()

  if (!isEqual(value, ref.current)) {
    ref.current = value
  }

  return ref.current
}
