import React from 'react'
import { fireEvent, render, screen } from 'util/testing/reactTestingLibraryExtended'
import AddCustomViewDialog from './AddCustomViewDialog'

jest.mock('components/TopicSelector/TopicSelector', () => () => <div data-testid='topic-selector' />)
jest.mock('components/LucideIconPicker/LucideIconPicker', () => () => <div data-testid='icon-picker' />)

function renderDialog (onAdd = jest.fn()) {
  render(<AddCustomViewDialog group={{ id: '1', slug: 'g' }} onCancel={jest.fn()} onCreated={jest.fn()} onAdd={onAdd} />)
  return onAdd
}

describe('AddCustomViewDialog', () => {
  it('keeps Add View enabled and explains a missing name instead of silently doing nothing', () => {
    const onAdd = renderDialog()
    const addButton = screen.getByTestId('custom-view-add')
    expect(addButton).toBeEnabled()

    fireEvent.click(addButton)

    expect(onAdd).not.toHaveBeenCalled()
    expect(screen.getByText('Give this view a name of at least 2 characters')).toBeInTheDocument()
    expect(screen.getByTestId('custom-view-name')).toHaveFocus()
    expect(screen.getByTestId('custom-view-name')).toHaveAttribute('aria-invalid', 'true')
  })

  it('explains an empty post type selection', () => {
    const onAdd = renderDialog()
    fireEvent.change(screen.getByTestId('custom-view-name'), { target: { value: 'Garden' } })
    ;['discussion', 'event', 'resource', 'project', 'proposal', 'request', 'offer'].forEach(key => {
      fireEvent.click(screen.getByTestId(`post-type-pill-${key}`))
    })

    fireEvent.click(screen.getByTestId('custom-view-add'))

    expect(onAdd).not.toHaveBeenCalled()
    expect(screen.getByText('Choose at least one post type')).toBeInTheDocument()
  })

  it('saves a named custom stream with the default post types', () => {
    const onAdd = renderDialog()
    fireEvent.change(screen.getByTestId('custom-view-name'), { target: { value: '  Garden  ' } })

    fireEvent.click(screen.getByTestId('custom-view-add'))

    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd.mock.calls[0][0]).toMatchObject({
      type: 'custom',
      name: 'Garden',
      icon: 'ListFilter',
      settings: {
        postTypes: ['discussion', 'event', 'resource', 'project', 'proposal', 'request', 'offer'],
        defaultViewMode: 'cards'
      }
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('saves a stream showing only offers', () => {
    const onAdd = renderDialog()
    fireEvent.change(screen.getByTestId('custom-view-name'), { target: { value: 'Gifts' } })
    ;['discussion', 'event', 'resource', 'project', 'proposal', 'request'].forEach(key => {
      fireEvent.click(screen.getByTestId(`post-type-pill-${key}`))
    })

    fireEvent.click(screen.getByTestId('custom-view-add'))

    expect(onAdd.mock.calls[0][0].settings.postTypes).toEqual(['offer'])
  })
})
