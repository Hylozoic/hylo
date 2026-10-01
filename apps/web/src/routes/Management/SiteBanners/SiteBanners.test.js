import React from 'react'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import SiteBanners, { clickThroughRate } from './SiteBanners'

jest.mock('components/HyloEditor/HyloEditor', () => {
  const React = require('react')
  return React.forwardRef(function MockEditor (props, ref) {
    const [content, setContent] = React.useState('')
    const latest = React.useRef('')
    const set = value => { latest.current = value || ''; setContent(value || '') }
    React.useImperativeHandle(ref, () => ({
      getHTML: () => latest.current,
      isEmpty: () => !latest.current,
      setContent: set,
      clearContent: () => set('')
    }))
    return <textarea data-testid='mock-editor' value={content} onChange={e => set(e.target.value)} />
  })
})

describe('clickThroughRate', () => {
  it('is the share of people who used the button among everyone who handled the banner', () => {
    expect(clickThroughRate(1, 3)).toBe(25)
    expect(clickThroughRate(2, 1)).toBe(67)
    expect(clickThroughRate(0, 0)).toBe(0)
  })
})

describe('Management SiteBanners', () => {
  it('shows dismissed, clicked and click-through for a published banner, and its translations', async () => {
    mockGraphqlServer.use(
      graphql.operation(() => HttpResponse.json({
        data: {
          allSiteBanners: [{
            id: '7',
            title: 'Launch',
            text: '<p>We launched</p>',
            type: 'info',
            actionText: 'See it',
            actionUrl: '/groups/x',
            showToNewUsers: false,
            publishedAt: '2026-09-01T10:00:00.000Z',
            unpublishedAt: null,
            createdAt: '2026-09-01T10:00:00.000Z',
            updatedAt: '2026-09-01T10:00:00.000Z',
            creator: { id: '1', name: 'Admin', avatarUrl: '' },
            dismissedCount: 3,
            clickedCount: 1,
            translations: { de: { title: 'Start' } }
          }]
        }
      }))
    )

    render(<SiteBanners />)

    const stats = await screen.findByTestId('banner-stats')
    expect(stats.textContent).toContain('3 dismissed')
    expect(stats.textContent).toContain('1 clicked')
    expect(stats.textContent).toContain('25% click-through')
    expect(screen.getByText('Translated into: German')).toBeInTheDocument()
  })

  it('has a field set for each of the six languages', async () => {
    mockGraphqlServer.use(graphql.operation(() => HttpResponse.json({ data: { allSiteBanners: [] } })))
    render(<SiteBanners />)
    const tabs = await screen.findAllByRole('tab')
    expect(tabs.map(tab => tab.textContent)).toEqual(['English', 'German', 'Spanish', 'French', 'Hindi', 'Portuguese'])
  })

  it('saves the text for each language, keeping English as the banner text', async () => {
    let saved = null
    mockGraphqlServer.use(graphql.operation(({ query, variables }) => {
      if (query.includes('createSiteBanner')) {
        saved = variables.data
        return HttpResponse.json({ data: { createSiteBanner: { id: '8', ...variables.data } } })
      }
      return HttpResponse.json({ data: { allSiteBanners: [] } })
    }))
    render(<SiteBanners />)

    const editor = await screen.findByTestId('mock-editor')
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Big news' } })
    fireEvent.change(editor, { target: { value: '<p>English body</p>' } })

    fireEvent.click(screen.getByRole('tab', { name: 'German' }))
    expect(screen.getByTestId('mock-editor')).toHaveValue('')
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Große Neuigkeit' } })
    fireEvent.change(screen.getByTestId('mock-editor'), { target: { value: '<p>Deutscher Text</p>' } })

    fireEvent.click(screen.getByRole('tab', { name: 'English' }))
    expect(screen.getByTestId('mock-editor')).toHaveValue('<p>English body</p>')

    fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() => expect(saved).not.toBe(null))
    expect(saved.title).toBe('Big news')
    expect(saved.text).toBe('<p>English body</p>')
    expect(saved.translations).toEqual({ de: { title: 'Große Neuigkeit', text: '<p>Deutscher Text</p>' } })
  })
})
