import 'react-native'
import React from 'react'
import JoinGroup from './JoinGroup'
import { TestRoot } from 'util/testing'
import { render } from '@testing-library/react-native'
import { createStackNavigator } from '@react-navigation/stack'
import Signup from 'screens/Signup'

const TestNavigator = createStackNavigator()

it.skip('forwards to Login when not authorized', async () => {
  const { findByText } = await render(
    <TestRoot>
      <TestNavigator.Navigator>
        <TestNavigator.Screen name='JoinGroup' component={JoinGroup} initialParams={{ token: 'anything' }} />
        <TestNavigator.Screen name='Signup' component={Signup} />
      </TestNavigator.Navigator>
    </TestRoot>
  )

  expect(await findByText('Welcome to Hylo')).toBeTruthy()
})
