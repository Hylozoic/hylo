import React from 'react'
import { render } from '@testing-library/react-native'
import { TestRoot } from 'util/testing'
import ImagePicker from 'components/ImagePicker'

describe('ImagePicker Specification', () => {
  it('default render matches snapshot', async () => {
    const { toJSON } = render(
      <TestRoot>
        <ImagePicker disabled={false} />
      </TestRoot>
    )
    expect(await toJSON()).toMatchSnapshot()
  })
})
