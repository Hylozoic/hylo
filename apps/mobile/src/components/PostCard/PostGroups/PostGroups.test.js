import 'react-native'
import React from 'react'
import ReactTestRenderer from 'react-test-renderer'
import PostGroups from './PostGroups'

describe('PostGroups', () => {
  it('matches last snapshot', () => {
    const props = {
      groups: [
        {
          id: 1,
          name: 'One',
          slug: 'one'
        },
        {
          id: 2,
          name: 'Two',
          slug: 'two'
        },
        {
          id: 3,
          name: 'Three',
          slug: 'three'
        }
      ],
      slug: 'hylo'
    }

    const renderer = ReactTestRenderer.create(<PostGroups {...props} />)
    expect(renderer).toMatchSnapshot()
  })
})
