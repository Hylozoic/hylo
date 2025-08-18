import React from 'react'
import ModalHeader from './ModalHeader'
import { white } from '@hylo/presenters/colors'
import Colors from '../../style/theme-colors'

export default function WorkflowModalHeader (props) {
  return (
    <ModalHeader
      headerBackTitleVisible={false}
      headerLeftCloseIcon={false}
      headerStyle={{
        backgroundColor: props?.style?.backgroundColor || white,
        shadowColor: 'transparent'
      }}
      headerTitleStyle={{
        color: Colors.foreground,
        fontFamily: 'Circular-Bold',
        fontSize: 16
      }}
      headerTintColor={Colors.selected60}
      statusBarOptions={{
        backgroundColor: props?.style?.backgroundColor || white,
        barStyle: 'light-content'
      }}
      {...props}
    />
  )
}
