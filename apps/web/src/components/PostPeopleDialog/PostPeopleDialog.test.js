import React from 'react'
import { cleanup, render, screen } from 'util/testing/reactTestingLibraryExtended'
import PostPeopleDialog from './PostPeopleDialog'

const member = { id: '1', name: 'Ada Lovelace', avatarUrl: '' }

function mountHost (id) {
  const host = document.createElement('div')
  host.setAttribute('id', id)
  document.body.appendChild(host)
  return host
}

describe('PostPeopleDialog', () => {
  afterEach(() => {
    cleanup()
    document.getElementById('post-dialog-host')?.remove()
    document.getElementById('center-column-container')?.remove()
    document.getElementById('center-column')?.remove()
    document.getElementById('root')?.remove()
  })

  it('portals above an open post dialog', () => {
    const host = mountHost('post-dialog-host')
    const postDialog = document.createElement('div')
    postDialog.setAttribute('id', 'post-dialog-content')
    host.appendChild(postDialog)

    render(
      <PostPeopleDialog members={[member]} title='Responses' onClose={jest.fn()} />
    )

    const overlay = document.querySelector('.PostPeopleDialog-Overlay')
    expect(overlay.parentElement).toBe(host)
    expect(overlay.className).toContain('z-[110]')
    expect(screen.getByRole('heading', { name: 'Responses' })).toBeInTheDocument()
    expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0)
  })

  it('falls back to the center column container when no post dialog is open', () => {
    const host = mountHost('center-column-container')

    render(
      <PostPeopleDialog members={[member]} title='Responses' onClose={jest.fn()} />
    )

    const overlay = document.querySelector('.PostPeopleDialog-Overlay')
    expect(overlay.parentElement).toBe(host)
  })
})
