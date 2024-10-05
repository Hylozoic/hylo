import 'react-native'
import { showToast, hideToast } from './toast'
import Toast from 'react-native-root-toast'

describe('showToast', () => {
  it('shows a toast', () => {
    jest.spyOn(Toast, 'show')
    const toast = showToast('Cool Message')
    expect(Toast.show).toHaveBeenCalled()
    expect(toast).toBeDefined()
  })

  it('hides the toast', () => {
    jest.spyOn(Toast, 'hide')
    const toast = showToast('Cool Message')
    hideToast(toast)
    expect(Toast.hide).toHaveBeenCalled()
  })
})
