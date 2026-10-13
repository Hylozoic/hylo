import React from 'react'
import ModalHeader from './ModalHeader'
import { white, white60onCaribbeanGreen, rhino } from '@hylo/presenters/colors'

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
        color: rhino,
        fontFamily: 'Circular-Bold',
        fontSize: 16
      }}
      headerTintColor={white60onCaribbeanGreen}
      statusBarOptions={{
        backgroundColor: props?.style?.backgroundColor || white,
        barStyle: 'light-content'
      }}
      {...props}
    />
  )
}
