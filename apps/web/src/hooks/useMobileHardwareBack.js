import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { get } from 'lodash/fp'
import { WebViewMessageTypes, HYLO_HARDWARE_BACK_EVENT } from '@hylo/shared'
import { sendMessageToWebView } from 'util/webView'
import { runRegisteredHardwareBackHandlers } from 'util/hardwareBackHandler'
import store from 'store'
import { toggleDrawer, toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'

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

function canNavigateBack () {
  return typeof window.history.state?.idx === 'number' && window.history.state.idx > 0
}

/**
 * Routes Android hardware back through web navigation: nav drawer, side drawer,
 * registered overlay handlers, open dialogs, history back, then app exit.
 */
export default function useMobileHardwareBack () {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  useEffect(() => {
    if (typeof window === 'undefined' || !window.HyloMobileV2) return

    const handleHardwareBack = () => {
      const reduxState = store.getState()

      if (get('AuthLayoutRouter.isNavOpen', reduxState)) {
        dispatch(toggleNavMenu(false))
        return
      }

      if (get('AuthLayoutRouter.isDrawerOpen', reduxState)) {
        dispatch(toggleDrawer())
        return
      }

      if (runRegisteredHardwareBackHandlers()) return

      if (tryCloseOpenDialog()) return

      if (canNavigateBack()) {
        navigate(-1)
        return
      }

      sendMessageToWebView(WebViewMessageTypes.CAN_EXIT_APP)
    }

    window.addEventListener(HYLO_HARDWARE_BACK_EVENT, handleHardwareBack)
    return () => window.removeEventListener(HYLO_HARDWARE_BACK_EVENT, handleHardwareBack)
  }, [dispatch, navigate])
}
