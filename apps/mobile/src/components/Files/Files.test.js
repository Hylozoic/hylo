import React from 'react'
import TestRenderer from 'react-test-renderer'
import Files from 'components/Files'
import { Linking, TouchableOpacity } from 'react-native'

describe('Files', () => {
  it('renders correctly', async () => {
    const renderer = TestRenderer.create(
      <Files
        urls={[
          'http://foo.com/foo.pdf',
          'http://foo.com/bar.zip'
        ]}
      />
    )
    expect(renderer).toMatchSnapshot()

    await renderer.root.findAllByType(TouchableOpacity)[0].props.onPress()
    expect(Linking.canOpenURL).toHaveBeenCalledWith('http://foo.com/foo.pdf')
    expect(Linking.openURL).toHaveBeenCalledWith('http://foo.com/foo.pdf')
  })
})
