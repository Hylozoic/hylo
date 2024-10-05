import React from 'react'
import { render } from '@testing-library/react-native'
import { TestRoot } from 'util/testing'
import MemberProfile from 'screens/MemberProfile'
import MockedScreen from 'util/testing/MockedScreen'

jest.mock('store/selectors/getCurrentGroupSlug', () => () => 'public')
jest.mock('react-native-share', () => ({
  default: jest.fn()
}))

it('default render matches snapshot', async () => {
  const { toJSON } = render(
    <TestRoot>
      <MockedScreen>
        {screenProps => (
          <MemberProfile {...screenProps} route={{ name: 'test' }} />
        )}
      </MockedScreen>
    </TestRoot>
  )
  expect(await toJSON()).toMatchSnapshot()
})
