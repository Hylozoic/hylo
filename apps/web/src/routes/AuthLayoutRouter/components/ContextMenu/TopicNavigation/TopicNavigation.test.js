import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import TopicNavigation from './TopicNavigation'

const topics = [
  { name: 't1', url: '/t1' },
  { name: 't2', url: '/t2' },
  { name: 't3', url: '/t3', current: true },
  { name: 't4', url: '/t4' }
]

const requiredProps = {
  topics,
  location: { pathname: '/' },
  backUrl: '/return-here',
  seeAllUrl: '/seeAllTopics',
  routeParams: {
    slug: 'foo'
  }
}

const renderComponent = (props = {}) => {
  return render(
    <TopicNavigation {...requiredProps} {...props} />
  )
}

describe('TopicNavigation', () => {
  it('renders correctly for a group', () => {
    renderComponent()
    expect(screen.getByText('Topics')).toBeInTheDocument()
    expect(screen.getByText('#t1')).toBeInTheDocument()
    expect(screen.getByText('#t2')).toBeInTheDocument()
    expect(screen.getByText('#t3')).toBeInTheDocument()
    expect(screen.getByText('#t4')).toBeInTheDocument()
    expect(screen.getByText('All topics')).toBeInTheDocument()
  })
})
