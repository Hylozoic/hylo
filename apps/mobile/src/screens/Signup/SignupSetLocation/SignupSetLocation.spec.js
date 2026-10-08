import React from 'react'
import { render } from '@testing-library/react-native'
import MockedScreen from 'util/testing/MockedScreen'
import { TestRoot } from 'util/testing'
import SignupSetLocation from 'screens/Signup/SignupSetLocation'

it('default render matches snapshot', async () => {
  const { toJSON } = render(
    <TestRoot>
      <MockedScreen component={SignupSetLocation} />
    </TestRoot>
  )
  expect(await toJSON()).toMatchSnapshot()
})
