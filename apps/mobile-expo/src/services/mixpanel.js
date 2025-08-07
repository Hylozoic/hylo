// Placeholder mixpanel service
export const trackWithConsent = (event, properties, user, noUser) => {
  if (__DEV__) {
    console.log('Mixpanel track:', event, properties)
  }
  // TODO: Implement actual mixpanel tracking
}

export default {
  track: trackWithConsent,
  getGroup: () => ({
    set: () => {}
  })
}