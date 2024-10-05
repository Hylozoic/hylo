import React from 'react'
import { TestRoot } from 'util/testing'
import PostBody from './PostBody'
import { render } from '@testing-library/react-native'

jest.mock('store/selectors/getCurrentGroupSlug', () => () => 'public')

it('matches the last snapshot', async () => {
  const post = {
    title: 'Combined breaks and links',
    details: '<p>This post has a <a data-entity-type="mention" data-user-id="86895">Flargle</a> mention.</p><p>Then a break.</p><p>Then a para ending with a mention <a data-entity-type="mention" data-user-id="86197">Anita Cartwright</a> </p><p><a data-entity-type="mention" data-user-id="86742">Alexane Rowe</a> </p><p>More characters to trigger truncate.',
    linkPreview: null,
    slug: 'notifications-testing',
    showMember: () => {},
    showTopic: () => {},
    shouldTruncate: true
  }
  const { toJSON } = render(
    <TestRoot>
      <PostBody {...post} />
    </TestRoot>
  )

  expect(await toJSON()).toMatchSnapshot()
})
