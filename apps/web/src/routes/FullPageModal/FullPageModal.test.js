import React from 'react'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
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
    const content = <div>The Content</div>
    render(
      <FullPageModal
        content={content}
      />
    )

    expect(screen.getByText('The Content')).toBeInTheDocument()
  })

  it('renders correctly when passed children', () => {
    render(
      <FullPageModal>
        <div>First Child</div>
        <div>Second Child</div>
      </FullPageModal>
    )

    expect(screen.getByText('First Child')).toBeInTheDocument()
    expect(screen.getByText('Second Child')).toBeInTheDocument()
  })

  it('renders correctly with multiple tabs and path (1)', () => {
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
      <FullPageModal content={content} />,
      {},
      AllTheProviders({}, ['/settings'])
    )
    
    expect(screen.getByText('Account Page')).toBeInTheDocument()
    expect(screen.queryByText('Groups Page')).not.toBeInTheDocument()
  })

  it('renders correctly with multiple tabs and path (2)', () => {
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
      <FullPageModal content={content} />,
      {},
      AllTheProviders({}, ['/settings/groups'])
    )
    
    expect(screen.queryByText('Account Page')).not.toBeInTheDocument()
    expect(screen.getByText('Groups Page')).toBeInTheDocument()
  })
})
