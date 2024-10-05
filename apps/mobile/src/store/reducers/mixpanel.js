import Config from 'react-native-config'
import { Mixpanel } from 'mixpanel-react-native'

const trackAutomaticEvents = true
const mixpanel = new Mixpanel(Config.MIXPANEL_TOKEN, trackAutomaticEvents)

mixpanel && mixpanel.init()

export default (state = mixpanel, action) => state
