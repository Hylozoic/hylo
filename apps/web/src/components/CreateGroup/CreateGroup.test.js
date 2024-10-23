import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import CreateGroup from './CreateGroup'

describe('CreateGroup', () => {
  it('renders the create group form', () => {
    render(<CreateGroup />)

    expect(screen.getByText('Create Group')).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Your group's name")).toBeInTheDocument()
    expect(screen.getByText('https://hylo.com/groups/')).toBeInTheDocument()
  })

  it('allows for passing in initial name and slug via query parameters', () => {
    render(<CreateGroup initialName='Epic Name' initialSlug='bananaslug' />)

    expect(screen.getByDisplayValue('Epic Name')).toBeInTheDocument()
    expect(screen.getByDisplayValue('bananaslug')).toBeInTheDocument()
  })
})
