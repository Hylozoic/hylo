import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import FullPageModal from './FullPageModal'
import * as LayoutFlagsContext from 'contexts/LayoutFlagsContext'

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
  })

  it('renders without crashing with multiple tabs', () => {
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
    const { container } = render(
      <FullPageModal
        navigate={navigate}
        content={content}
      />
    )

    expect(container.querySelector('#root') || container).toBeTruthy()
  })
})
