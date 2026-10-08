import { Linking } from 'react-native'
import useLinkingStore from 'navigation/linking/store'
import {
  hyloUrlForExternalBrowser,
  shouldOpenHyloOidcInExternalBrowser
} from 'navigation/linking/oidcExternalBrowserGate'

export default async function getInitialURL () {
  const initialURL = await Linking.getInitialURL()

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
