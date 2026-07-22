import { useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { get } from 'lodash/fp'
import { WebViewMessageTypes, HYLO_HARDWARE_BACK_EVENT } from '@hylo/shared'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import useRouteParams from 'hooks/useRouteParams'
import { sendMessageToWebView } from 'util/webView'
import { runRegisteredHardwareBackHandlers } from 'util/hardwareBackHandler'
import { performMobileNavBack } from 'util/mobileNavBack'
import store from 'store'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getPreviousLocation from 'store/selectors/getPreviousLocation'
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

function getIsOneColumnGroup (groupSlug, currentGroup) {
  if (!groupSlug) return false
  if (currentGroup?.settings?.layout === 'one-column') return true
  try {
    return window.localStorage.getItem(`hylo-group-layout-${groupSlug}`) === 'one-column'
  } catch {
    return false
  }
}

/**
 * Routes Android hardware back through web navigation: nav drawer, side drawer,
 * registered overlay handlers, open dialogs, then the same logic as the header chevron.
 */
export default function useMobileHardwareBack () {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { groupSlug } = useRouteParams()
  const { headerDetails } = useViewHeader()
  const headerDetailsRef = useRef(headerDetails)
  const groupSlugRef = useRef(groupSlug)
  const navClosedByBackRef = useRef(false)
  const pathnameRef = useRef('')

  headerDetailsRef.current = headerDetails
  groupSlugRef.current = groupSlug

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

      const currentGroup = getGroupForSlug(reduxState, groupSlugRef.current)
      const oneColumnGroup = getIsOneColumnGroup(groupSlugRef.current, currentGroup)
      const { backButton, mobileBackButton } = headerDetailsRef.current || {}
      const isPrimaryDrawerView = !mobileBackButton && !backButton && !oneColumnGroup

      if (navClosedByBackRef.current && isPrimaryDrawerView) {
        navClosedByBackRef.current = false
        sendMessageToWebView(WebViewMessageTypes.CAN_EXIT_APP)
        return
      }

      const handled = performMobileNavBack({
        dispatch,
        navigate,
        headerDetails: headerDetailsRef.current,
        previousLocation: getPreviousLocation(reduxState),
        pathname,
        groupSlug: groupSlugRef.current,
        oneColumnGroup
      })

      if (handled) {
        navClosedByBackRef.current = false
        return
      }

      sendMessageToWebView(WebViewMessageTypes.CAN_EXIT_APP)
    }

    pathnameRef.current = window.location.pathname
    window.addEventListener(HYLO_HARDWARE_BACK_EVENT, handleHardwareBack)
    return () => window.removeEventListener(HYLO_HARDWARE_BACK_EVENT, handleHardwareBack)
  }, [dispatch, navigate])
}
