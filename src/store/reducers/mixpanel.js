import { Mixpanel } from 'mixpanel-react-native'

let mixpanel = new Mixpanel(process.env.MIXPANEL_TOKEN)

mixpanel && mixpanel.init()

export default (state = mixpanel, action) => state
