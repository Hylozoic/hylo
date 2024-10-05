import { Linking } from 'react-native'
import store from 'store'
import { SET_INITIAL_URL } from 'store/constants'

export default async function getInitialURL () {
  const initialURL = await Linking.getInitialURL()

  store.dispatch({ type: SET_INITIAL_URL, payload: initialURL })

  return null
}
