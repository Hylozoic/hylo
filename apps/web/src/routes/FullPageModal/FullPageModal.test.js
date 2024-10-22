import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import FullPageModal from './FullPageModal'
import * as LayoutFlagsContext from 'contexts/LayoutFlagsContext'

jest.mock('util/webView', () => ({
  __esModule: true,
  default: jest.fn(() => false)
}))

describe('FullPageModal', () => {
  beforeAll(() => {
    jest.spyOn(LayoutFlagsContext, 'useLayoutFlags').mockImplementation(() => ({}))
  })

  it('renders correctly with a single component', () => {
    const navigate = jest.fn()
    const content = <div>The Content</div>
    render(
      <FullPageModal
        navigate={navigate}
        content={content}
      />
    )

    expect(screen.getByText('The Content')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument() // Close button
  })

  it('renders correctly when passed children', () => {
    const navigate = jest.fn()
    render(
      <FullPageModal navigate={navigate}>
        <div>First Child</div>
        <div>Second Child</div>
      </FullPageModal>
    )

    expect(screen.getByText('First Child')).toBeInTheDocument()
    expect(screen.getByText('Second Child')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument() // Close button
  })

  it('renders correctly with multiple tabs', () => {
    const navigate = jest.fn()
    const content = [
      {
        name: 'Account',
        path: '/settings',
        component: <div>Account Page</div>
      },
      {
        name: 'Groups',
        path: '/settings/groups',
        component: <div>Groups Page</div>
      }
    ]
    render(
      <FullPageModal
        navigate={navigate}
        content={content}
      />
    )

    expect(screen.getByText('Account')).toBeInTheDocument()
    expect(screen.getByText('Groups')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument() // Close button
  })

  it('calls navigate when close button is clicked', () => {
    const navigate = jest.fn()
    const content = <div>The Content</div>
    render(
      <FullPageModal
        navigate={navigate}
        content={content}
      />
    )

    const closeButton = screen.getByRole('button')
    closeButton.click()

    expect(navigate).toHaveBeenCalled()
  })
})
