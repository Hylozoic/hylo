import React from 'react'
import { Provider } from 'react-redux'
import { NavigationContainer } from '@react-navigation/native'
import getEmptyState from 'store/getEmptyState'
import { render, cleanup } from '@testing-library/react-native'
import { createMockStore } from 'util/testing'
import SignupFlow3 from 'screens/SignupFlow/SignupFlow3'

describe('SignupFlow3 Specification', () => {
  afterEach(cleanup)

  it('default render matches snapshot', async () => {
    const state = getEmptyState()
    const { toJSON } = render(
      <Provider store={createMockStore(state)}>
        <NavigationContainer>
          <SignupFlow3
            location='Hull'
            saveAndNext={() => {}}
            changeSetting={() => {}}
          />
        </NavigationContainer>
      </Provider>
    )
    expect(await toJSON()).toMatchSnapshot()
  })
})
