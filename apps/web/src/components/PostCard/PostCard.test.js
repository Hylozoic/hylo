import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import PostCard from './PostCard'
import { fakePost } from 'util/testing/testData'
import faker from '@faker-js/faker'
import timezoneMock from 'timezone-mock'

faker.seed(9000)

beforeEach(() => {
  timezoneMock.register('US/Pacific')
})

afterEach(() => {
  timezoneMock.unregister()
})

it('renders post content correctly', () => {
  const post = {
    ...fakePost(),
    updatedAt: new Date('2014-01-17').toISOString(),
    title: 'Test Post Title',
    details: 'Test post content'
  }

  jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ groupSlug: 'foom' })
  render(
    <PostCard post={post} />
  )

  expect(screen.getByText('Test Post Title')).toBeInTheDocument()
  expect(screen.getByText('Test post content')).toBeInTheDocument()
})
