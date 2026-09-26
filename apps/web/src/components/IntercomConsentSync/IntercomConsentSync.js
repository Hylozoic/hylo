import { useEffect, useRef } from 'react'
import { useIntercom } from 'react-use-intercom'

/**
 * IntercomProvider only honours autoBoot on its first render, so a support
 * cookie choice made later is applied here: boot when support is allowed,
 * shut down when it is rejected.
 */
export default function IntercomConsentSync ({ allowed, bootProps }) {
  const { boot, shutdown } = useIntercom()
  const allowedRef = useRef(allowed)

  useEffect(() => {
    if (allowedRef.current === allowed) return
    allowedRef.current = allowed
    if (allowed) boot(bootProps)
    else shutdown()
  }, [allowed])

  return null
}
