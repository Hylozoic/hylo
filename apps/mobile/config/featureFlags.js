import Config from 'react-native-config'
export const PROJECT_CONTRIBUTIONS = 'PROJECT_CONTRIBUTIONS'

const featureFlag = key => Config['FEATURE_FLAG_' + key]

export default featureFlag
