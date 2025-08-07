import React from 'react'
import { View, Text } from 'react-native'

export default function AuthRootNavigator() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-foreground text-lg">Authenticated App</Text>
      <Text className="text-muted-foreground">Main app content will go here</Text>
    </View>
  )
}