import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'

const Stack = createStackNavigator()

export default function MockedScreen ({
  children,
  ...otherProps
}) {
  if (children) {
    return (
      <Stack.Navigator>
        <Stack.Screen name='MockedScreen' {...otherProps}>
          {props => children(props)}
        </Stack.Screen>
      </Stack.Navigator>
    )
  } else {
    return (
      <Stack.Navigator>
        <Stack.Screen name='MockedScreen' {...otherProps} />
      </Stack.Navigator>
    )
  }
}
