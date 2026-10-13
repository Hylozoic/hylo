import React from 'react'
import { render } from '@testing-library/react-native'
import { TestRoot } from 'util/testing'
import PostFooter from './PostFooter'

it('renders as expected', async () => {
  const { toJSON } = render(
    <TestRoot>
      <PostFooter
        commentersTotal={19}
        type='request'
        currentUser={{}}
        members={[]}
        eventAttendees={[]}
        showActivityLabel
        commenters={[
          { id: 1, name: 'Person One', avatarUrl: 'a.png' },
          { id: 2, name: 'Person Two', avatarUrl: 'b.png' },
          { id: 3, name: 'Person Three', avatarUrl: 'c.png' }
        ]}
        t={string => string}
      />
    </TestRoot>
  )

  expect(await toJSON()).toMatchSnapshot()
})
