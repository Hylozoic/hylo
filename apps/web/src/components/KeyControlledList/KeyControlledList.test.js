import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import KeyControlledItemList from './KeyControlledItemList'

describe('KeyControlledItemList', () => {
  const defaultMinProps = {
    onChange: jest.fn(),
    items: []
  }

  function renderComponent (props = {}) {
    return render(
      <KeyControlledItemList {...{ ...defaultMinProps, ...props }} />
    )
  }

  it('renders correctly (with min props)', () => {
    renderComponent()
    expect(screen.getByRole('list')).toBeInTheDocument()
  })

  it('renders correctly (with items)', () => {
    const props = {
      items: [
        {
          id: 1,
          name: 'one'
        },
        {
          id: 2,
          name: 'two'
        }
      ]
    }
    renderComponent(props)
    expect(screen.getByText('one')).toBeInTheDocument()
    expect(screen.getByText('two')).toBeInTheDocument()
  })

  it('renders correctly (with items and renderListItem func)', () => {
    const props = {
      items: [
        {
          id: 1,
          title: 'one'
        },
        {
          id: 2,
          title: 'two'
        }
      ],
      renderListItem: ({ item }) => <span key={item.id}>{item.title}</span>
    }
    renderComponent(props)
    expect(screen.getByText('one')).toBeInTheDocument()
    expect(screen.getByText('two')).toBeInTheDocument()
  })
})
