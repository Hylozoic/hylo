import React from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { render, waitFor } from 'util/testing/reactTestingLibraryExtended'
import GroupDetail from './GroupDetail'

jest.mock('sonner', () => ({ toast: { error: jest.fn() } }))

afterEach(() => {
  toast.error.mockClear()
  useLocation.mockReturnValue({ pathname: '', search: '' })
  useParams.mockReturnValue({})
})

it('shows the invalid invitation toast when JoinGroup redirected here with one', async () => {
  useParams.mockReturnValue({ groupSlug: 'test-group' })
  useLocation.mockReturnValue({ pathname: '/groups/test-group/about', search: '', state: { invalidInvite: true } })

  render(<GroupDetail />)

  await waitFor(() => {
    expect(toast.error).toHaveBeenCalledWith(
      'Sorry, your invitation to this group is expired, has already been used, or is invalid. Please contact a group Host for another one.',
      { id: 'invalid-invite' }
    )
  })
})

it('does not show the invalid invitation toast otherwise', async () => {
  useParams.mockReturnValue({ groupSlug: 'test-group' })
  useLocation.mockReturnValue({ pathname: '/groups/test-group/about', search: '' })

  render(<GroupDetail />)

  await new Promise(resolve => setTimeout(resolve, 0))
  expect(toast.error).not.toHaveBeenCalled()
})
