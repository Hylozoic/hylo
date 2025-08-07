import React from 'react'
import { View, Text } from 'react-native'

export default function SignupRegistration() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-foreground">Registration Screen</Text>
      <Text className="text-muted-foreground">Complete your profile (Step 1/3)</Text>
    </View>
  )
}