// jest.mock('react-native-onesignal', () => ({
//   addEventListener: jest.fn(),
//   inFocusDisplaying: jest.fn(),
//   clearOneSignalNotifications: jest.fn(),
//   removeEventListener: jest.fn()
// }))

//   it('tidies up event handlers', () => {
//     AppState.removeEventListener = jest.fn()
//     instance.componentWillUnmount()
//     expect(OneSignal.removeEventListener).toHaveBeenCalled()
//     expect(AppState.removeEventListener).toHaveBeenCalled()
//   })

//   it('stores the OneSignal payload in component state', () => {
//     const payload = { additionalData: { path: 'wombat' } }
//     instance._handleOpenedPushNotification({ notification: { payload } })
//     expect(instance.state.onesignalNotification).toEqual(payload)
//   })

//   describe('_handleAppStateChange', () => {
//     it('changes state.appState', () => {
//       const active = 'active'
//       const inactive = 'inactive'
//       instance.setState({ appState: active })
//       instance._handleAppStateChange(inactive)
//       expect(instance.state.appState).toEqual(inactive)
//     })

//     it('changes appState from inactive to background', () => {
//       const background = 'background'
//       const active = 'active'
//       instance.setState({ appState: background })
//       instance._handleAppStateChange(active)
//       expect(instance.state.appState).toEqual(active)
//       expect(OneSignal.clearOneSignalNotifications).toHaveBeenCalled()
//     })
//   })
