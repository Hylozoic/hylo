import { ActivityIndicator, View } from 'react-native'
import useThemeStore from '../store/themeStore'

/** Full-screen loading state with theme-matched background. */
export default function LoadingScreen () {
  const backgroundColor = useThemeStore(state => state.backgroundColor)

  return (
    <View
      className='flex-1 w-full items-center justify-center'
      style={{ backgroundColor }}
    >
      <ActivityIndicator size='large' />
    </View>
  )
}
