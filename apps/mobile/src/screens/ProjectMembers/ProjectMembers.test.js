import 'react-native'
import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import ProjectMembers from './ProjectMembers'

it('renders as expected', () => {
  const members = [{ id: 'member1' }, { id: 'member2' }]
  const props = {
    route: {
      params: {
        members
      }
    },
    navigation: {
      navigate: () => {}
    }
  }

  const renderer = new ReactShallowRenderer()
  renderer.render(
    <ProjectMembers {...props} />
  )
  const actual = renderer.getRenderOutput()

  expect(actual).toMatchSnapshot()
})
