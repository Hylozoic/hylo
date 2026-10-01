/* eslint-env jest */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import NoPosts from './index'

describe('NoPosts', () => {
  it('offers a primary and a secondary action', () => {
    const onAction = jest.fn()
    const onSecondaryAction = jest.fn()
    render(
      <NoPosts
        message="You're not in any groups yet"
        actionLabel='Explore Groups'
        onAction={onAction}
        secondaryActionLabel='Create a group'
        onSecondaryAction={onSecondaryAction}
      />
    )

    expect(screen.getByText('You\'re not in any groups yet')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Explore Groups' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create a group' }))
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onSecondaryAction).toHaveBeenCalledTimes(1)
  })

  it('shows no buttons without actions', () => {
    render(<NoPosts message='Nothing here yet' />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
