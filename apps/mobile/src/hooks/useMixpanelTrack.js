import mixpanel from 'services/mixpanel'

export default function useMixpanelTrack () {
  return () => (event, data = {}) => mixpanel.track(event, data)
}
