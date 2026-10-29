import { useEffect, useState } from 'react'
import { prefersNativeDateTimePicker, subscribeToPointerChanges } from './nativeDateTimePicker'

/**
 * Whether this device should get the native pickers. Re-evaluated when the pointer media
 * queries change (e.g. a trackpad is attached to a tablet).
 */
export default function usePrefersNativeDateTimePicker () {
  const [prefersNative, setPrefersNative] = useState(() => prefersNativeDateTimePicker())
  useEffect(() => {
    const update = () => setPrefersNative(prefersNativeDateTimePicker())
    update()
    return subscribeToPointerChanges(update)
  }, [])
  return prefersNative
}
