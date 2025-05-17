import React from 'react'
import { graphql, HttpResponse } from 'msw'
import { render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import TrackEditor from './TrackEditor'

describe('TrackEditor', () => {
  beforeEach(() => {
    mockGraphqlServer.use(
      graphql.query('GroupExists', () => HttpResponse.json({ data: { groupExists: { exists: true } } }))
    )
  })

  it('renders the track editor form', async () => {
    render(<TrackEditor />)

    await waitFor(() => {
      // Check for main form elements
      expect(screen.getByText('Create Track')).toBeInTheDocument()
      expect(screen.getByPlaceholderText("Your track's name*")).toBeInTheDocument()
      expect(screen.getByText('Set track banner')).toBeInTheDocument()

      // Check for editor sections
      expect(screen.getByText('Description')).toBeInTheDocument()
      expect(screen.getByText('Welcome Message')).toBeInTheDocument()
      expect(screen.getByText('Completion Message')).toBeInTheDocument()

      // Check for completion badge section
      expect(screen.getByText('Completion badge')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Name of badge awarded to those who complete the track')).toBeInTheDocument()

      // Check for actions name section
      expect(screen.getByText('Term for track units')).toBeInTheDocument()
      expect(screen.getByText('Unit term')).toBeInTheDocument()

      // Check for publish controls
      expect(screen.getByText('Unpublished')).toBeInTheDocument()
    })
  })

  it('allows for passing in initial track data via props', async () => {
    const initialTrack = {
      name: 'Test Track',
      actionDescriptor: 'Step',
      actionDescriptorPlural: 'Steps',
      description: '<p>Test description</p>',
      welcomeMessage: '<p>Welcome message</p>',
      completionMessage: '<p>Completion message</p>',
      completionRole: {
        id: '1',
        emoji: '🏆',
        name: 'Achievement Badge'
      },
      completionRoleType: 'group',
      publishedAt: new Date().toISOString()
    }

    render(<TrackEditor editingTrack={initialTrack} />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Track')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Steps')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Achievement Badge')).toBeInTheDocument()
      expect(screen.getByText('Publish Now')).toBeInTheDocument()
    })
  })
})
