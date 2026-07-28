import { Linking } from 'react-native'
import getStateFromPath from './getStateFromPath'
import getInitialURL from './getInitialURL'
import { hyloUrlForExternalBrowser, shouldOpenHyloOidcInExternalBrowser } from './oidcExternalBrowserGate'
import { prefixes } from './config'

export * from './config'

export default {
  prefixes,
  getStateFromPath,
  getInitialURL,
  subscribe (listener: (url: string) => void) {
    const onReceiveURL = ({ url }: { url: string }) => {
      // Hylo-as-OIDC-provider flows must stay in the system browser, even when
      // App Links deliver them to the native app
      if (shouldOpenHyloOidcInExternalBrowser(url)) {
        const href = hyloUrlForExternalBrowser(url)
        Linking.canOpenURL(href).then(can => {
          if (can) Linking.openURL(href)
        })
        return
      }
      listener(url)
    }
    const sub = Linking.addEventListener('url', onReceiveURL)
    return () => sub.remove()
  }
}
