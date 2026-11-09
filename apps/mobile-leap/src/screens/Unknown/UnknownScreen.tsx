import useRouteParams from '../../hooks/useRouteParams'
import { Text, View } from 'react-native'

export default function UnknownScreen () {
  const params = useRouteParams()

  return (
    <View className='flex-1 items-center justify-center bg-background px-6'>
      <Text className='text-xl font-semibold text-foreground'>Unknown route</Text>
      <Text className='mt-2 text-center text-sm text-muted-foreground'>
        {JSON.stringify(params, null, 2)}
      </Text>
    </View>
  )
}
