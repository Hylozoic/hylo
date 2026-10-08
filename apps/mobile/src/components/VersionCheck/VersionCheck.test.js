import 'react-native'
import React from 'react'
import TestRenderer from 'react-test-renderer'
import VersionCheck from './VersionCheck'

it('calls useInvitation', async () => {
  const props = {
    checkVersion: jest.fn()
  }
  await TestRenderer.create(<VersionCheck {...props} />)
  expect(props.checkVersion).toHaveBeenCalled()
})
