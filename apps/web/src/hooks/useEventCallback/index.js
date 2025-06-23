import { useCallback, useLayoutEffect, useRef } from 'react'

// Recommended here:
// https://github.com/ueberdosis/tiptap/issues/2403#issuecomment-1062712162
export default function useEventCallback (fn) {
  const ref = useRef()
  useLayoutEffect(() => {
    ref.current = fn
  })
  return useCallback((...args) => ref.current && (0, ref.current)(...args), [])
}
