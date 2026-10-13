import React from 'react'
import { render } from '@testing-library/react-native'
import { TestRoot } from 'util/testing'
import MockedScreen from 'util/testing/MockedScreen'
import SignupRegistration from 'screens/Signup/SignupRegistration'

it('default render matches snapshot', async () => {
  const { toJSON } = render(
    <TestRoot>
      <MockedScreen component={SignupRegistration} />
    </TestRoot>
  )
  expect(await toJSON()).toMatchSnapshot()
})
