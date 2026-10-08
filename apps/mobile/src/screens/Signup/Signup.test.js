import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import { render } from '@testing-library/react-native'
import { TestRoot } from 'util/testing'
import Signup from './Signup'

const TestNavigator = createStackNavigator()

it('renders with defaults', async () => {
  const { findByText, toJSON } = render(
    <TestRoot>
      <TestNavigator.Navigator>
        <TestNavigator.Screen name='Signup'>
          {screenProps => (
            <Signup {...screenProps} />
          )}
        </TestNavigator.Screen>
      </TestNavigator.Navigator>
    </TestRoot>
  )
  expect(await findByText('Enter your email below to get started!')).toBeTruthy()
  expect(await toJSON()).toMatchSnapshot()
})
