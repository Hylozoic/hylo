import React from 'react'
import { graphql, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { AllTheProviders, render, screen, waitFor, act } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import TrackCompletionSuggestions from './TrackCompletionSuggestions'

jest.mock('sonner', () => ({
  ...jest.requireActual('sonner'),
  toast: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() })
}))

const space = (id, name, track, extra = {}) => ({
  id,
  name,
  slug: `s${id}`,
  status: 'published',
  active: true,
  avatarUrl: null,
  track: { id: `t${id}`, isEnrolled: false, didComplete: false, numActions: 2, ...track },
  ...extra
})

describe('TrackCompletionSuggestions', () => {
  beforeEach(() => {
    mockGraphqlServer.use(
      graphql.query('FetchTrackSuggestions', () => HttpResponse.json({
        data: {
          group: {
            id: '1',
            slug: 'garden',
            spaces: {
              items: [
                space('10', 'Onboarding', {}),
                space('11', 'Composting basics', {}),
                space('12', 'Seed saving', { isEnrolled: true }),
                space('13', 'Already done', { didComplete: true })
              ]
            }
          }
        }
      }))
    )
    Object.assign(navigator, { clipboard: { writeText: jest.fn(() => Promise.resolve()) } })
    toast.success.mockClear()
  })

  it('suggests other tracks from the parent group and offers a share', async () => {
    render(
      <TrackCompletionSuggestions parentGroup={{ id: '1', slug: 'garden' }} space={{ id: '10', slug: 'garden-onboarding' }} />,
      { wrapper: AllTheProviders() }
    )

    await waitFor(() => {
      expect(screen.getByText('Seed saving')).toBeInTheDocument()
    })
    expect(screen.getByText('Composting basics')).toBeInTheDocument()
    expect(screen.queryByText('Onboarding')).not.toBeInTheDocument()
    expect(screen.queryByText('Already done')).not.toBeInTheDocument()
    expect(screen.getByText('Continue')).toBeInTheDocument()
    expect(screen.getByText('Explore')).toBeInTheDocument()

    await act(async () => { screen.getByRole('button', { name: /Share this track/ }).click() })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringMatching(/\/groups\/garden\/spaces\/.*\/about$/))
    expect(toast.success).toHaveBeenCalledWith('Link copied')
  })
})
