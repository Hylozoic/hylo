import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useNavigation } from '@react-navigation/native'

export default function ModalHeader ({ title, options, navigation: providedNavigation }) {
  const navigation = providedNavigation || useNavigation()
  
  const handleClose = () => {
    if (navigation.canGoBack()) {
      navigation.goBack()
    }
  }

  return (
    <View className="flex-row items-center justify-between p-4 bg-card border-b border-border">
      <TouchableOpacity onPress={handleClose} className="p-2">
        <Text className="text-lg">×</Text>
      </TouchableOpacity>
      <Text className="text-lg font-semibold">{title}</Text>
      <View className="w-8" />
    </View>
  )
}