import React from 'react'
import { View, StyleSheet } from 'react-native'
import Colors from '../../style/theme-colors'

export default function WorkflowModalHeader (props) {
  return (
    <ModalHeader
      headerBackTitleVisible={false}
      headerLeftCloseIcon={false}
      headerStyle={{
        backgroundColor: props?.style?.backgroundColor || Colors.muted,
        shadowColor: 'transparent'
      }}
      headerTitleStyle={{
        color: Colors.foreground,
        fontFamily: 'Circular-Bold',
        fontSize: 16
      }}
      headerTintColor={Colors.selected60}
      statusBarOptions={{
        backgroundColor: props?.style?.backgroundColor || Colors.muted,
        barStyle: 'light-content'
      }}
      {...props}
    />
  )
}
