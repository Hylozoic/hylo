import Config from 'react-native-config'
import { Mixpanel } from 'mixpanel-react-native'

// disable legacy mobile autotrack
const trackAutomaticEvents = false
// disable Native Mode, use Javascript Mode
const useNative = false

const mixpanel = new Mixpanel(Config.MIXPANEL_TOKEN, trackAutomaticEvents, useNative)

mixpanel && mixpanel.init()

export default mixpanel
