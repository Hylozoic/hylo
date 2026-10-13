import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import Loading from './Loading'

it('matches last snapshot', () => {
  const renderer = new ReactShallowRenderer()
  const styles = {
    container: {
      some: 'styles'
    }
  }
  renderer.render(<Loading style={styles} />)
  const actual = renderer.getRenderOutput()
  expect(actual).toMatchSnapshot()
})
