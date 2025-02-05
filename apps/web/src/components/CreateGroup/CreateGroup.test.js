import React from 'react'
import { graphql, HttpResponse } from 'msw'
import { render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import CreateGroup from './CreateGroup'

describe('CreateGroup', () => {
  beforeEach(() => {
    mockGraphqlServer.use(
      graphql.query('GroupExists', () => HttpResponse.json({ data: { groupExists: { exists: true } } }))
    )
  })

  it('renders the create group form', async () => {
    render(<CreateGroup />)

    await waitFor(() => {
      expect(screen.getAllByText('Create Group')).toHaveLength(2)
      expect(screen.getByPlaceholderText("Your group's name")).toBeInTheDocument()
      expect(screen.getByText('https://hylo.com/groups/')).toBeInTheDocument()
    })
  })

  it('allows for passing in initial name and slug via query parameters', async () => {
    jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue({ search: '?name=Epic+Name&slug=bananaslug' })
    render(<CreateGroup />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Epic Name')).toBeInTheDocument()
      expect(screen.getByDisplayValue('bananaslug')).toBeInTheDocument()
    })
  })
})
