import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import ModalDialog from './ModalDialog'

describe('ModalDialog', () => {
  let props

  beforeEach(() => {
    props = {
      backgroundImage: 'foo.png',
      cancelButtonAction: jest.fn(),
      closeOnSubmit: true,
      closeModal: jest.fn(),
      modalTitle: 'Wombats',
      notificationIconName: 'Star',
      showCancelButton: true,
      showSubmitButton: true,
      submitButtonAction: jest.fn(),
      style: {},
      submitButtonText: 'Square Poop',
      useNotificationFormat: false
    }
  })

  it('renders the modal title', () => {
    render(<ModalDialog {...props} />)
    expect(screen.getByText('Wombats')).toBeInTheDocument()
  })

  it('renders children content', () => {
    render(
      <ModalDialog {...props}>
        <div>Describe how awesome wombats are:</div>
        <input />
      </ModalDialog>
    )
    expect(screen.getByText('Describe how awesome wombats are:')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('renders in notification format', () => {
    props.useNotificationFormat = true
    render(
      <ModalDialog {...props}>
        <div>Yep, they're awesome alright.</div>
      </ModalDialog>
    )
    expect(screen.getByText('Yep, they\'re awesome alright.')).toBeInTheDocument()
    expect(screen.getByTestId('icon-Star')).toBeInTheDocument()
  })

  it('invokes cancelButtonAction when cancel button is clicked', () => {
    render(<ModalDialog {...props} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(props.cancelButtonAction).toHaveBeenCalled()
    expect(props.closeModal).toHaveBeenCalled()
  })

  it('invokes submitButtonAction when submit button is clicked', () => {
    render(<ModalDialog {...props} />)
    fireEvent.click(screen.getByText('Square Poop'))
    expect(props.submitButtonAction).toHaveBeenCalled()
    expect(props.closeModal).toHaveBeenCalled()
  })

  it('does not close if closeOnSubmit is false', () => {
    props.closeOnSubmit = false
    render(<ModalDialog {...props} />)
    fireEvent.click(screen.getByText('Square Poop'))
    expect(props.submitButtonAction).toHaveBeenCalled()
    expect(props.closeModal).not.toHaveBeenCalled()
  })

  it('does not show an icon without useNotificationFormat', () => {
    render(<ModalDialog {...props} />)
    expect(screen.queryByTestId('icon-Star')).not.toBeInTheDocument()
  })

  it('shows an icon with useNotificationFormat', () => {
    props.useNotificationFormat = true
    render(<ModalDialog {...props} />)
    expect(screen.getByTestId('icon-Star')).toBeInTheDocument()
  })

  it('applies custom style', () => {
    props.style = { backgroundColor: 'red' }
    render(<ModalDialog {...props} />)
    const popupInner = screen.getByTestId('popup-inner')
    expect(popupInner).toHaveStyle('background-color: red')
  })

  it('applies background image style when useNotificationFormat is true', () => {
    props.useNotificationFormat = true
    render(<ModalDialog {...props} />)
    const popupInner = screen.getByTestId('popup-inner')
    expect(popupInner).toHaveStyle('background-image: url(/assets/foo.png)')
  })
})
