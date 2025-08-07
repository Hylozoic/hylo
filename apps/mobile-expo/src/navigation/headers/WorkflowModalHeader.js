import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'

export default function WorkflowModalHeader ({ 
  headerLeftCloseIcon, 
  headerLeftStyle, 
  headerLeftOnPress, 
  headerTitleStyle, 
  style,
  ...headerProps 
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }, style]}>
      {headerLeftCloseIcon && (
        <TouchableOpacity onPress={headerLeftOnPress} style={{ padding: 8 }}>
          <Text style={[{ fontSize: 24 }, headerLeftStyle]}>×</Text>
        </TouchableOpacity>
      )}
      <Text style={[{ fontSize: 18, fontWeight: 'bold' }, headerTitleStyle]}>
        {headerProps.options?.title || ''}
      </Text>
      <View style={{ width: 40 }} />
    </View>
  )
}