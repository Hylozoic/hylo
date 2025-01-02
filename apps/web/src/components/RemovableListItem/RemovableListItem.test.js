import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import RemovableListItem from './RemovableListItem'

describe('RemovableListItem', () => {
  const defaultItem = {
    id: 7,
    name: 'Zeus',
    avatarUrl: 'zeus.png'
  }

  it('renders correctly with URL', () => {
    render(
      <RemovableListItem item={defaultItem} url='/happy/place' removeItem={() => {}} />
    )

    expect(screen.getByText('Zeus')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Zeus' })).toHaveAttribute('href', '/happy/place')
    expect(screen.getByRole('img').getAttribute('style')).toContain(`background-image: url(zeus.png)`)
    expect(screen.getByText('Remove')).toBeInTheDocument()
  })

  it('does not render as links when no URL specified', () => {
    render(<RemovableListItem item={defaultItem} removeItem={() => {}} />)

    expect(screen.getByText('Zeus')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByRole('img').getAttribute('style')).toContain(`background-image: url(zeus.png)`)
  })

  it('doesnt render a remove link when removeItem is not provided', () => {
    render(
      <RemovableListItem item={defaultItem} url='/happy/place' />
    )

    expect(screen.getByText('Zeus')).toBeInTheDocument()
    expect(screen.queryByText('Remove')).not.toBeInTheDocument()
  })

  describe('remove item', () => {
    it('calls remove with confirmation', () => {
      const removeItem = jest.fn()
      const confirmMessage = 'Are you sure?'

      window.confirm = jest.fn(() => true)

      render(
        <RemovableListItem
          item={defaultItem}
          url='/happy/place'
          removeItem={removeItem}
          confirmMessage={confirmMessage}
        />
      )

      fireEvent.click(screen.getByText('Remove'))

      expect(window.confirm).toHaveBeenCalledWith(confirmMessage)
      expect(removeItem).toHaveBeenCalledWith(defaultItem.id)
    })

    it('skips confirm when skipConfirm is true', () => {
      const removeItem = jest.fn()

      window.confirm = jest.fn()

      render(
        <RemovableListItem
          item={defaultItem}
          skipConfirm
          url='/happy/place'
          removeItem={removeItem}
        />
      )

      fireEvent.click(screen.getByText('Remove'))

      expect(window.confirm).not.toHaveBeenCalled()
      expect(removeItem).toHaveBeenCalledWith(defaultItem.id)
    })
  })
})
