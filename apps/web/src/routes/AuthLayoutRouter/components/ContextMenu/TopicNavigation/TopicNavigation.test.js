import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import TopicNavigation from './TopicNavigation'

const topics = [
  { name: 't1', url: '/t1', newPostCount: 3 },
  { name: 't2', url: '/t2', newPostCount: 0 },
  { name: 't3', url: '/t3', current: true },
  { name: 't4', url: '/t4', newPostCount: 2 }
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

  it('renders badges for topics with new posts', () => {
    renderComponent()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('can be clicked to expand the left nav when collapsed', () => {
    const expand = jest.fn()
    renderComponent({ collapsed: true, expand })

    fireEvent.click(screen.getByText('Topics'))
    expect(expand).toHaveBeenCalled()
  })

})
