import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import ProjectMembersSummary from './ProjectMembersSummary'

describe('ProjectMembersSummary', () => {
  it('renders as expected', () => {
    const props = {
      count: 5,
      members: [{ id: 1 }],
      onPress: () => {}
    }
    const renderer = new ReactShallowRenderer()
    renderer.render(
      <ProjectMembersSummary {...props} />
    )
    const actual = renderer.getRenderOutput()
    expect(actual).toMatchSnapshot()
  })

  it('renders as expected without an onPress handler', () => {
    const props = {
      count: 5,
      members: [{ id: 1 }]
    }
    const renderer = new ReactShallowRenderer()
    renderer.render(
      <ProjectMembersSummary {...props} />
    )
    const actual = renderer.getRenderOutput()
    expect(actual).toMatchSnapshot()
  })
})
