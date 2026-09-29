import React from 'react'
import userEvent from '@testing-library/user-event'
import { render, screen, within } from 'util/testing/reactTestingLibraryExtended'
import Header from './Header'

describe('Header', () => {
  it('should render participant names', () => {
    const participants = [{ id: 1, name: 'One' }, { id: 2, name: 'Two' }, { id: 3, name: 'Three' }]
    const props = {
      currentUser: {
        id: 1,
        name: 'One'
      },
      messageThread: {
        participants
      }
    }
    render(<Header {...props} />)
    // Measuring container + visible pills both render participant names
    expect(screen.getAllByText('Two').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Three').length).toBeGreaterThan(0)
  })

  it('should render "You" when current user is the only participant', () => {
    const props = {
      currentUser: { id: 1, name: 'One' },
      messageThread: {
        participants: [{ id: 1, name: 'One' }]
      }
    }
    render(<Header {...props} />)
    expect(screen.getByText('You')).toBeInTheDocument()
  })

  it('should not render when pending', () => {
    const props = {
      currentUser: { id: 1, name: 'One' },
      messageThread: {
        participants: [{ id: 1, name: 'One' }, { id: 2, name: 'Two' }]
      },
      pending: true
    }
    const { container } = render(<Header {...props} />)
    expect(container.innerHTML).toBe('')
  })

  describe('conversation options', () => {
    const props = {
      currentUser: { id: '1', name: 'One' },
      messageThread: {
        participants: [{ id: '1', name: 'One' }, { id: '2', name: 'Two' }]
      },
      threadId: '55'
    }

    it('offers Block first, then Report, then Leave conversation', async () => {
      const user = userEvent.setup()
      render(<Header {...props} />)
      await user.click(screen.getByTestId('thread-actions-trigger'))
      const menu = await screen.findByTestId('thread-actions-menu')
      const items = within(menu).getAllByRole('menuitem').map(item => item.textContent)
      expect(items).toEqual(['Block Two', 'Report to Hylo', 'Leave conversation'])
    })

    it('opens the staff report form from Report', async () => {
      const user = userEvent.setup()
      render(<Header {...props} />)
      await user.click(screen.getByTestId('thread-actions-trigger'))
      await user.click(await screen.findByTestId('thread-action-report'))
      expect(await screen.findByTestId('staff-report-explainer')).toBeInTheDocument()
    })

    it('asks before leaving', async () => {
      const user = userEvent.setup()
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false)
      render(<Header {...props} />)
      await user.click(screen.getByTestId('thread-actions-trigger'))
      await user.click(await screen.findByTestId('thread-action-leave'))
      expect(confirmSpy).toHaveBeenCalled()
      confirmSpy.mockRestore()
    })

    it('does not show options while composing a new message', () => {
      render(<Header {...props} threadId='new' />)
      expect(screen.queryByTestId('thread-actions-trigger')).not.toBeInTheDocument()
    })
  })
})
