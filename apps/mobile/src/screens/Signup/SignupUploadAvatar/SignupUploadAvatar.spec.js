import React from 'react'
import { render } from '@testing-library/react-native'
import { createInitialStateWithCurrentUser, TestRoot } from 'util/testing'
import SignupUploadAvatar from 'screens/Signup/SignupUploadAvatar'
import MockedScreen from 'util/testing/MockedScreen'

it('default render matches snapshot', async () => {
  const { toJSON } = render(
    <TestRoot state={createInitialStateWithCurrentUser()}>
      <MockedScreen component={SignupUploadAvatar} />
    </TestRoot>
  )
  expect(await toJSON()).toMatchSnapshot()
})
