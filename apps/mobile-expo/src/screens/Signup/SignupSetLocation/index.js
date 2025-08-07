import React from 'react'
import { View, Text } from 'react-native'

export default function SignupSetLocation() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-foreground">Set Location Screen</Text>
      <Text className="text-muted-foreground">Set your location (Step 3/3)</Text>
    </View>
  )
}