import { ActivityIndicator, View } from 'react-native'
import useThemeStore from '../store/themeStore'

export default function LoadingScreen () {
  const backgroundColor = useThemeStore(state => state.backgroundColor)

  return (
    <View className='flex-1 items-center justify-center' style={{ backgroundColor }}>
      <ActivityIndicator size='large' />
    </View>
  )
}
