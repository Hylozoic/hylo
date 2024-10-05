import { useSelector } from 'react-redux'
import getMixpanel from 'store/selectors/getMixpanel'

export default function useMixpanelTrack () {
  const mixpanel = useSelector(getMixpanel)

  return () => (event, data = {}) => mixpanel.track(event, data)
}
