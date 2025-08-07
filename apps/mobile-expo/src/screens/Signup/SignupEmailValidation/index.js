import React from 'react'
import { View, Text } from 'react-native'

export default function SignupEmailValidation() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-foreground">Email Validation Screen</Text>
      <Text className="text-muted-foreground">Please verify your email address</Text>
    </View>
  )
}