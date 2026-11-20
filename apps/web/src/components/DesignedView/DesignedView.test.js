import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
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

  it('draws a hero banner and an image', () => {
    render(
      <DesignedView
        groupSlug='garden'
        design={{
          blocks: [
            { type: 'hero', imageUrl: 'https://uploads.example.org/garden.jpg', title: 'Welcome', subtitle: 'Come dig in', height: 'tall', align: 'center' },
            { type: 'image', url: 'https://uploads.example.org/tools.jpg', alt: 'Garden tools', caption: 'The shed' }
          ]
        }}
      />
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome' })).toBeInTheDocument()
    expect(screen.getByText('Come dig in')).toBeInTheDocument()
    expect(document.querySelector('[data-block="hero"] img').getAttribute('src')).toEqual('https://uploads.example.org/garden.jpg')
    expect(screen.getByRole('img', { name: 'Garden tools' }).getAttribute('src')).toEqual('https://uploads.example.org/tools.jpg')
    expect(screen.getByText('The shed')).toBeInTheDocument()
  })

  it('draws a canvas of regions that can be zoomed and moved', () => {
    render(
      <DesignedView
        groupSlug='garden'
        design={{
          blocks: [{
            type: 'canvas',
            regions: [
              { title: 'Compost', note: 'Turning and bins', tone: 'accent', col: 0, row: 0, blocks: [{ type: 'posts', search: 'compost', limit: 3 }] },
              { title: 'People', col: 2, row: 1, blocks: [{ type: 'members', limit: 4 }] }
            ]
          }]
        }}
      />
    )
    const regions = screen.getAllByTestId('designed-canvas-region')
    expect(regions).toHaveLength(2)
    expect(screen.getByRole('heading', { level: 2, name: 'Compost' })).toBeInTheDocument()
    expect(screen.getByText('Turning and bins')).toBeInTheDocument()
    expect(regions[1].style.gridColumn).toEqual('3')
    expect(regions[1].style.gridRow).toEqual('2')
    expect(screen.getByTestId('designed-canvas-surface').style.gridTemplateColumns).toEqual('repeat(3, 360px)')
    expect(mockBlockData).toHaveBeenCalledWith('garden', expect.objectContaining({ type: 'posts', search: 'compost' }))

    expect(screen.getByTestId('designed-canvas-zoom')).toHaveTextContent('100%')
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    expect(screen.getByTestId('designed-canvas-zoom')).toHaveTextContent('80%')
    expect(screen.getByTestId('designed-canvas-surface').style.transform).toContain('scale(0.8)')

    // On a page, the canvas fills the view: no frame around it and no page padding
    const canvas = document.querySelector('[data-block="canvas"]')
    expect(canvas.getAttribute('data-fill')).toEqual('true')
    expect(canvas.className).not.toContain('rounded-xl')
    expect(canvas.parentElement.className).not.toContain('p-4')

    const viewport = screen.getByTestId('designed-canvas-viewport')
    fireEvent.keyDown(viewport, { key: 'ArrowRight' })
    expect(screen.getByTestId('designed-canvas-surface').style.transform).toContain('translate(-80px, 0px)')
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
