import React from 'react'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import SiteBanners from './SiteBanners'

const banner = {
  id: '3',
  title: 'New feature',
  text: '<p>Try it</p>',
  type: 'info',
  actionText: 'Take a look',
  actionUrl: 'https://example.org/new',
  createdAt: '2026-09-01T10:00:00.000Z'
}

describe('SiteBanners', () => {
  let calls

  beforeEach(() => {
    calls = []
    window.open = jest.fn()
    mockGraphqlServer.use(
      // Banner operations are anonymous, so match on the query text
      graphql.operation(({ query, variables }) => {
        if (/clickSiteBanner|dismissSiteBanner/.test(query)) {
          const field = query.includes('clickSiteBanner') ? 'clickSiteBanner' : 'dismissSiteBanner'
          calls.push({ field, id: variables.id })
          return HttpResponse.json({ data: { [field]: true } })
        }
        if (query.includes('siteBanners')) {
          return HttpResponse.json({ data: { siteBanners: [banner] } })
        }
        return HttpResponse.json({ data: {} })
      })
    )
  })

  it("records the action button as a click, and doesn't count it as a dismissal", async () => {
    render(<SiteBanners />)
    fireEvent.click(await screen.findByRole('button', { name: 'Take a look' }))

    await waitFor(() => expect(calls).toEqual([{ field: 'clickSiteBanner', id: '3' }]))
    expect(screen.queryByText('New feature')).not.toBeInTheDocument()
    expect(window.open).toHaveBeenCalledWith('https://example.org/new', '_blank', 'noopener,noreferrer')
  })

  it('records Dismiss as a dismissal', async () => {
    render(<SiteBanners />)
    await screen.findByText('New feature')
    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss' })[0])

    await waitFor(() => expect(calls).toEqual([{ field: 'dismissSiteBanner', id: '3' }]))
  })
})
