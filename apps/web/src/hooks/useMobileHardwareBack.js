import { useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { get } from 'lodash/fp'
import { WebViewMessageTypes, HYLO_HARDWARE_BACK_EVENT } from '@hylo/shared'
import useMobileNavBack from 'hooks/useMobileNavBack'
import { sendMessageToWebView } from 'util/webView'
import { runRegisteredHardwareBackHandlers } from 'util/hardwareBackHandler'
import store from 'store'
import { toggleDrawer, toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'

/**
 * Closes the topmost open dialog via Escape. Returns true when one was found.
 */
function tryCloseOpenDialog () {
  const openDialog = document.querySelector('[role="dialog"][data-state="open"]')
  if (!openDialog) return false
  document.dispatchEvent(new window.KeyboardEvent('keydown', {
    key: 'Escape',
    code: 'Escape',
    keyCode: 27,
    bubbles: true
  }))
  return true
}

/**
 * Routes Android hardware back through web navigation: nav drawer, side drawer,
 * registered overlay handlers, open dialogs, then the same logic as the header chevron.
 */
export default function useMobileHardwareBack () {
  const dispatch = useDispatch()
  const { performBack, headerDetails } = useMobileNavBack()
  const performBackRef = useRef(performBack)
  const headerDetailsRef = useRef(headerDetails)
  const navClosedByBackRef = useRef(false)
  const pathnameRef = useRef('')

  performBackRef.current = performBack
  headerDetailsRef.current = headerDetails

  useEffect(() => {
    if (typeof window === 'undefined' || !window.HyloMobileV2) return

    const handleHardwareBack = () => {
      const reduxState = store.getState()
      const pathname = window.location.pathname

      if (pathname !== pathnameRef.current) {
        navClosedByBackRef.current = false
        pathnameRef.current = pathname
      }

      if (get('AuthLayoutRouter.isNavOpen', reduxState)) {
        dispatch(toggleNavMenu(false))
        navClosedByBackRef.current = true
        return
      }

      if (get('AuthLayoutRouter.isDrawerOpen', reduxState)) {
        dispatch(toggleDrawer())
        return
      }

      if (runRegisteredHardwareBackHandlers()) return

      if (tryCloseOpenDialog()) return

      const { backButton, mobileBackButton } = headerDetailsRef.current || {}
      const isPrimaryDrawerView = !mobileBackButton && !backButton

      if (navClosedByBackRef.current && isPrimaryDrawerView) {
        navClosedByBackRef.current = false
        sendMessageToWebView(WebViewMessageTypes.CAN_EXIT_APP)
        return
      }

      const handled = performBackRef.current()

      if (handled) {
        navClosedByBackRef.current = false
        return
      }

      sendMessageToWebView(WebViewMessageTypes.CAN_EXIT_APP)
    }

    pathnameRef.current = window.location.pathname
    window.addEventListener(HYLO_HARDWARE_BACK_EVENT, handleHardwareBack)
    return () => window.removeEventListener(HYLO_HARDWARE_BACK_EVENT, handleHardwareBack)
  }, [dispatch])
}
