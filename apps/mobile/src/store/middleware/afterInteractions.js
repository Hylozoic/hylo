import { InteractionManager } from 'react-native'

export default function afterInteractionsMiddleware (store) {
  return next => action => {
    const { meta } = action
    if (meta && meta.afterInteractions) {
      return new Promise((resolve) => {
        InteractionManager.runAfterInteractions(() => {
          resolve(next(action))
        })
      })
    }
    return next(action)
  }
}
