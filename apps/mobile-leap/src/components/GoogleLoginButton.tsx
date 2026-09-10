import { Pressable, Text } from 'react-native'
import { useFonts } from 'expo-font'
import { createIconSet } from '@expo/vector-icons'

// Legacy apps/mobile Google button color (#dd4b39)
const GOOGLE_RED = '#dd4b39'

const HyloIcon = createIconSet(
  { Google: 59673 },
  'hylo-evo-icons',
  require('../../assets/fonts/hylo-evo-icons.ttf')
)

type GoogleLoginButtonProps = {
  text: string
  onPress: () => void
}

export default function GoogleLoginButton ({ text, onPress }: GoogleLoginButtonProps) {
  const [fontsLoaded] = useFonts({
    'hylo-evo-icons': require('../../assets/fonts/hylo-evo-icons.ttf')
  })

  if (!fontsLoaded) return null

  return (
    <Pressable
      onPress={onPress}
      className='mb-2.5 min-w-[65%] flex-row items-center justify-center rounded px-4 py-2.5'
      style={{ backgroundColor: GOOGLE_RED, minHeight: 40 }}
    >
      <HyloIcon name='Google' size={16} color='#ffffff' style={{ marginRight: 6 }} />
      <Text className='text-base font-bold text-white'>{text}</Text>
    </Pressable>
  )
}
