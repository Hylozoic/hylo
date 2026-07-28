import { Linking } from 'react-native'
import useLinkingStore from './store'
import { hyloUrlForExternalBrowser, shouldOpenHyloOidcInExternalBrowser } from './oidcExternalBrowserGate'

export default async function getInitialURL () {
  const initialURL = await Linking.getInitialURL()

  // OIDC flows launched via App Links must bounce straight back to the system
  // browser rather than being routed (or stored) in-app
  if (initialURL && shouldOpenHyloOidcInExternalBrowser(initialURL)) {
    const href = hyloUrlForExternalBrowser(initialURL)
    if (await Linking.canOpenURL(href)) {
      await Linking.openURL(href)
    }
    return null
  }

  useLinkingStore.getState().setInitialURL(initialURL)
  return null
}
