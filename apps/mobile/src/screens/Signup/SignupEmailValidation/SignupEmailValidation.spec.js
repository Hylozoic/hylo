import React from 'react'
import { render } from '@testing-library/react-native'
import { TestRoot } from 'util/testing'
import SignupEmailValidation from 'screens/Signup/SignupEmailValidation'
import { createStackNavigator } from '@react-navigation/stack'

const Stack = createStackNavigator()

it('default render matches snapshot', async () => {
  const { toJSON } = render(
    <TestRoot>
      <Stack.Navigator>
        <Stack.Screen name='SignupEmailValidation'>
          {props => (
            <SignupEmailValidation {...props} />
          )}
        </Stack.Screen>
        <Stack.Screen name='Signup'>{() => null}</Stack.Screen>
      </Stack.Navigator>
    </TestRoot>
  )

  expect(await toJSON()).toMatchSnapshot()
})
