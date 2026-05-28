jest.mock('components/ui/tooltip', () => ({ TooltipProvider: ({ children }) => children }))

import React from 'react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { act, render, screen, fireEvent, waitFor, generateStore } from 'util/testing/reactTestingLibraryExtended'
import { LayoutFlagsProvider } from 'contexts/LayoutFlagsContext'
import fetchPeople from 'store/actions/fetchPeople'
import MemberSelector, { Suggestion } from './MemberSelector'
import { addMember } from './MemberSelector.store'

jest.mock('store/actions/fetchPeople', () => jest.fn((args) => ({
  type: 'MOCK_FETCH_PEOPLE',
  payload: args
})))

function withStore (store, children) {
  return (
    <LayoutFlagsProvider>
      <Provider store={store}>
        <MemoryRouter>{children}</MemoryRouter>
      </Provider>
    </LayoutFlagsProvider>
  )
}

function renderMemberSelector (props = {}, memberSelectorState = { members: [], autocomplete: '' }) {
  const onChange = props.onChange || jest.fn()
  const store = generateStore({ MemberSelector: memberSelectorState })
  const view = render(
    <MemberSelector {...props} onChange={onChange} />,
    { wrapper: ({ children }) => withStore(store, children) }
  )
  const rerenderWithProps = (newProps = {}) => {
    view.rerender(
      <MemberSelector {...props} {...newProps} onChange={newProps.onChange || onChange} />
    )
  }
  return { ...view, store, onChange, rerenderWithProps }
}

describe('MemberSelector', () => {
  beforeEach(() => {
    fetchPeople.mockClear()
  })

  it('renders correctly (with min props)', () => {
    renderMemberSelector()
    expect(screen.getByPlaceholderText('Type persons name...')).toBeInTheDocument()
  })

  it('initializes members from initialMembers on mount', () => {
    const { store } = renderMemberSelector({ initialMembers: [{ id: 1, name: 'Ada' }] })
    expect(store.getState().MemberSelector.members).toEqual([{ id: 1, name: 'Ada' }])
  })

  it('calls onChange when members change', async () => {
    const onChange = jest.fn()
    const { store } = renderMemberSelector({ onChange })
    store.dispatch(addMember({ id: 1, name: 'Ada' }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([{ id: 1, name: 'Ada' }]))
  })

  it('resets members when initialMembers change', async () => {
    const { rerenderWithProps, store } = renderMemberSelector(
      { initialMembers: [{ id: 1, name: 'Ada' }] },
      { members: [{ id: 1, name: 'Ada' }], autocomplete: '' }
    )
    rerenderWithProps({ initialMembers: [{ id: 1, name: 'Ada' }, { id: 2, name: 'Bob' }] })
    await waitFor(() => {
      expect(store.getState().MemberSelector.members).toEqual([
        { id: 1, name: 'Ada' },
        { id: 2, name: 'Bob' }
      ])
    })
  })

  it('handles input change', async () => {
    jest.useFakeTimers()
    const { store } = renderMemberSelector()
    const input = screen.getByRole('textbox', { name: 'tagInput' })
    fireEvent.change(input, { target: { value: 'John' } })
    act(() => { jest.advanceTimersByTime(200) })
    expect(store.getState().MemberSelector.autocomplete).toBe('John')
    act(() => { jest.advanceTimersByTime(300) })
    expect(fetchPeople).toHaveBeenCalledWith({ autocomplete: 'John', groupIds: null })
    jest.useRealTimers()
  })

  // TODO: Fix this test
  it.skip('handles member addition', async () => {
    renderMemberSelector({ memberMatches: [{ id: 1, name: 'John Doe' }] })
    fireEvent.change(screen.getByPlaceholderText('Type persons name...'), { target: { value: 'John' } })
    await waitFor(() => {
      fireEvent.click(screen.getByText('John Doe'))
    })
  })

  it('handles member deletion', async () => {
    const member = { id: 1, name: 'John Doe' }
    const { store, container } = renderMemberSelector(
      { initialMembers: [member] },
      { members: [member], autocomplete: '' }
    )
    fireEvent.click(container.querySelector('a[class*="selectedTagRemove"]'))
    await waitFor(() => {
      expect(store.getState().MemberSelector.members).toEqual([])
    })
  })
})

describe('Suggestion', () => {
  const defaultMinProps = {
    item: { id: 1, name: 'John Doe', avatarUrl: 'face.png' },
    handleChoice: jest.fn()
  }

  function renderComponent (props = {}) {
    return render(<Suggestion {...{ ...defaultMinProps, ...props }} />)
  }

  it('renders correctly', () => {
    renderComponent()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('calls handleChoice when clicked', () => {
    renderComponent()
    fireEvent.click(screen.getByText('John Doe'))
    expect(defaultMinProps.handleChoice).toHaveBeenCalledWith(defaultMinProps.item, expect.any(Object))
  })
})
