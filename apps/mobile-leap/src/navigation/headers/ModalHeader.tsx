import { Pressable, Text, View } from 'react-native'
import type { NativeStackHeaderProps } from '@react-navigation/native-stack'

// Minimal stack header for non-auth modal screens (ForgotPassword, etc.).
export default function ModalHeader ({ options, navigation }: NativeStackHeaderProps) {
  const title = typeof options.title === 'string'
    ? options.title
    : options.headerTitle?.toString()

  return (
    <View className='border-b border-border bg-background px-4 pb-3 pt-14'>
      <View className='flex-row items-center justify-between'>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text className='text-base text-primary'>Back</Text>
        </Pressable>
        <Text className='text-base font-semibold text-foreground'>{title}</Text>
        <View className='w-12' />
      </View>
    </View>
  )
}
