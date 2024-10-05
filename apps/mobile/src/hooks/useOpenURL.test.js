import { Linking } from 'react-native'
import { openURL } from 'hooks/useOpenURL'

it('openURL uses Linking.openURL', async () => {
  const url = 'http://www.goodlink.com'
  await openURL(url)
  expect(Linking.canOpenURL).toHaveBeenCalled()
  expect(Linking.openURL).toHaveBeenCalledWith(url)
})
