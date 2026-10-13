import React from 'react'
import { render } from '@testing-library/react-native'
import { TestRoot } from 'util/testing'
import FileSelector from 'screens/PostEditor/FileSelector'

it('default render matches snapshot', async () => {
  const files = [
    { local: 'test-file-1', remote: 'https://none/test-file-1' },
    { local: 'test-file-2', remote: 'https://none/test-file-2' }
  ]
  const { findByText } = render(
    <TestRoot>
      <FileSelector files={files} />
    </TestRoot>
  )
  expect(await findByText('test-file-2')).toBeTruthy()
})
