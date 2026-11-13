import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import DesignedView from './DesignedView'

const mockBlockData = jest.fn()
jest.mock('./useDesignedViewBlockData', () => ({
  __esModule: true,
  default: (groupSlug, block) => mockBlockData(groupSlug, block)
}))

const design = {
  version: 1,
  blocks: [
    { type: 'heading', text: 'Welcome', level: 1 },
    { type: 'text', text: 'First line\nSecond line' },
    { type: 'callout', title: 'Workdays', text: 'Most Saturdays', tone: 'accent' },
    {
      type: 'columns',
      columns: [
        [{ type: 'posts', title: 'Requests', postTypes: ['request'], limit: 3, layout: 'list' }],
        [{ type: 'events', title: 'Coming up', limit: 2 }]
      ]
    },
    { type: 'members', title: 'People', limit: 4 },
    { type: 'button', label: 'All events', destination: 'events' },
    { type: 'button', label: 'Our site', destination: 'url', url: 'https://example.org/' },
    { type: 'divider' }
  ]
}

describe('DesignedView', () => {
  beforeEach(() => {
    mockBlockData.mockImplementation((groupSlug, block) => {
      if (block.type === 'members') return { items: [{ id: '5', name: 'Maya', avatarUrl: null, tagline: 'Gardener' }], loading: false, error: null }
      if (block.type === 'events') return { items: [], loading: false, error: null }
      return { items: [{ id: '9', title: 'Need a wheelbarrow', type: 'request', creator: { id: '5', name: 'Maya' }, commentsTotal: 2 }], loading: false, error: null }
    })
  })

  it('draws every block type with the group\'s live lists', () => {
    render(<DesignedView design={design} groupSlug='garden' />)

    expect(screen.getByRole('heading', { level: 1, name: 'Welcome' })).toBeInTheDocument()
    expect(screen.getByText(/First line/)).toBeInTheDocument()
    expect(screen.getByText('Most Saturdays')).toBeInTheDocument()

    const post = screen.getByRole('link', { name: /Need a wheelbarrow/ })
    expect(post.getAttribute('href')).toContain('/groups/garden/')
    expect(post.getAttribute('href')).toContain('post/9')
    expect(screen.getByText('No upcoming events.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Gardener/ }).getAttribute('href')).toContain('/members/5')

    expect(screen.getByRole('link', { name: 'All events' }).getAttribute('href')).toEqual('/groups/garden/events')
    const external = screen.getByRole('link', { name: /Our site/ })
    expect(external.getAttribute('href')).toEqual('https://example.org/')
    expect(external.getAttribute('rel')).toContain('noopener')

    expect(mockBlockData).toHaveBeenCalledWith('garden', expect.objectContaining({ type: 'posts', postTypes: ['request'], limit: 3 }))
  })

  it('links posts and events through the page when it is given a way to open them in place', () => {
    mockBlockData.mockImplementation(() => ({ items: [{ id: '9', title: 'Need a wheelbarrow', creator: {} }], loading: false, error: null }))
    render(
      <DesignedView
        groupSlug='garden'
        postUrlFor={postId => `/groups/garden/designed/3/post/${postId}`}
        design={{ blocks: [{ type: 'posts', limit: 3 }, { type: 'events', limit: 2 }] }}
      />
    )
    const links = screen.getAllByRole('link', { name: /Need a wheelbarrow/ })
    expect(links).toHaveLength(2)
    links.forEach(link => expect(link.getAttribute('href')).toEqual('/groups/garden/designed/3/post/9'))
  })

  it('drops blocks it does not know and never renders stored markup', () => {
    render(
      <DesignedView
        groupSlug='garden'
        design={{ blocks: [{ type: 'html', html: '<b>bad</b>' }, { type: 'text', text: '<img src=x onerror=alert(1)>' }] }}
      />
    )
    expect(screen.queryByText('bad')).toBeNull()
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
    expect(document.querySelector('img[src="x"]')).toBeNull()
  })

  it('says so when there is nothing to show', () => {
    render(<DesignedView design={null} groupSlug='garden' />)
    expect(screen.getByTestId('designed-view-empty')).toBeInTheDocument()
  })

  it('shows loading and error states for a live list', () => {
    mockBlockData.mockReturnValueOnce({ items: [], loading: true, error: null })
    mockBlockData.mockReturnValueOnce({ items: [], loading: false, error: new Error('nope') })
    render(<DesignedView groupSlug='garden' design={{ blocks: [{ type: 'posts', limit: 3 }, { type: 'events', limit: 2 }] }} />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading...')
    expect(screen.getByText('This list could not be loaded.')).toBeInTheDocument()
  })
})
